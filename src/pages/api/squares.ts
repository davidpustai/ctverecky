import Browserbase from "@browserbasehq/sdk";
import type { APIRoute } from "astro";

export const prerender = false;

const TROPHY_ID_TTL = 6 * 60 * 60 * 1000;
const SCRAPE_ATTEMPTS = 2;
const CHALLENGE_TIMEOUT = 15_000;

/**
 * Last trophy id we successfully scraped. Survives across requests on a warm
 * instance, so the expensive browser session runs only on a cold start or after
 * the TTL — and stays available as a fallback when a scrape fails.
 */
let memo: { id: string; at: number } | null = null;

const TROPHY_IMG =
    /<img[^>]*class="[^"]*\btrophies-map\b[^"]*"[^>]*src="([^"]+)"/;

/**
 * squadrats.com sits behind Vercel's bot challenge: it answers plain HTTP
 * fetches (Browserbase's fetchAPI included) with a 429 and a JS checkpoint page.
 * Only a real browser clears it, so drive the Browserbase session over CDP.
 * Raw WebSocket rather than playwright-core — three commands is not worth a
 * browser automation library in a serverless bundle.
 */
interface CdpMessage {
    id?: number;
    error?: unknown;
    result?: unknown;
}

interface TargetInfo {
    type: string;
    targetId: string;
}

async function scrapePage(connectUrl: string, url: string) {
    const ws = new WebSocket(connectUrl);
    let nextId = 0;
    const pending = new Map<
        number,
        { resolve: (value: unknown) => void; reject: (reason: Error) => void }
    >();

    const send = <T>(method: string, params = {}, sessionId?: string) =>
        new Promise<T>((resolve, reject) => {
            const id = ++nextId;
            pending.set(id, {
                resolve: (value) => resolve(value as T),
                reject,
            });
            ws.send(
                JSON.stringify({
                    id,
                    method,
                    params,
                    ...(sessionId ? { sessionId } : {}),
                }),
            );
        });

    try {
        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => resolve();
            ws.onerror = () => reject(new Error("CDP socket failed"));
        });

        ws.onmessage = (event) => {
            const message = JSON.parse(String(event.data)) as CdpMessage;
            const waiter = message.id ? pending.get(message.id) : undefined;
            if (!waiter || message.id == null) return;
            pending.delete(message.id);
            if (message.error) {
                waiter.reject(new Error(JSON.stringify(message.error)));
            } else {
                waiter.resolve(message.result);
            }
        };

        const { targetInfos } = await send<{ targetInfos: TargetInfo[] }>(
            "Target.getTargets",
        );
        const page =
            targetInfos.find((target) => target.type === "page") ??
            (await send<TargetInfo>("Target.createTarget", {
                url: "about:blank",
            }));
        const { sessionId } = await send<{ sessionId: string }>(
            "Target.attachToTarget",
            { targetId: page.targetId, flatten: true },
        );

        const navigation = await send<{ errorText?: string }>(
            "Page.navigate",
            { url },
            sessionId,
        );
        if (navigation.errorText) {
            throw new Error(`navigation failed: ${navigation.errorText}`);
        }

        // The checkpoint replaces the document once solved, so poll the DOM for
        // the trophy image instead of trusting any single load event.
        const deadline = Date.now() + CHALLENGE_TIMEOUT;
        while (Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const { result } = await send<{ result: { value?: string } }>(
                "Runtime.evaluate",
                {
                    expression: "document.documentElement.outerHTML",
                    returnByValue: true,
                },
                sessionId,
            );
            const src = TROPHY_IMG.exec(result.value ?? "")?.[1];
            if (src) return src;
        }

        throw new Error("timed out waiting for the trophies-map image");
    } finally {
        ws.close();
    }
}

async function scrapeTrophyId(id: string) {
    const bb = new Browserbase({
        apiKey: import.meta.env.BROWSERBASE_API_KEY as string,
        timeout: 15_000,
        maxRetries: 0,
    });

    for (let attempt = 1; attempt <= SCRAPE_ATTEMPTS; attempt++) {
        let sessionId: string | null = null;
        try {
            const session = await bb.sessions.create({
                projectId: import.meta.env.BROWSERBASE_PROJECT_ID as string,
            });
            sessionId = session.id;

            const src = await scrapePage(
                session.connectUrl,
                `https://squadrats.com/map/${id}/17`,
            );
            const trophyId = src.slice(
                src.lastIndexOf("/") + 1,
                src.lastIndexOf("_"),
            );
            if (!trophyId) {
                throw new Error(`unexpected trophy image src: ${src}`);
            }

            memo = { id: trophyId, at: Date.now() };
            return trophyId;
        } catch (error) {
            console.error(
                `squares: scrape attempt ${attempt}/${SCRAPE_ATTEMPTS} failed:`,
                error,
            );
        } finally {
            // Sessions bill until they time out on their own.
            if (sessionId) {
                await bb.sessions
                    .update(sessionId, {
                        projectId: import.meta.env
                            .BROWSERBASE_PROJECT_ID as string,
                        status: "REQUEST_RELEASE",
                    })
                    .catch((error: unknown) =>
                        console.error(
                            "squares: session release failed:",
                            error,
                        ),
                    );
            }
        }
    }

    return null;
}

function geojsonResponse(upstream: Response, stale: boolean) {
    return new Response(upstream.body, {
        status: 200,
        headers: {
            "Content-Type": "application/geo+json",
            // A stale body must not be pinned by the CDN, or the client's
            // background retries could never reach a fresh one.
            "Cache-Control": stale
                ? "no-store"
                : "public, max-age=900, s-maxage=900",
            "X-Squares-Stale": stale ? "1" : "0",
        },
    });
}

export const GET: APIRoute = async () => {
    const id = import.meta.env.SQUADRATS_ID as string;
    if (!id) {
        return new Response("SQUADRATS_ID not configured", { status: 500 });
    }

    const geojsonUrl = (trophyId: string) =>
        `https://squadrats.org/trophies/${id}/${trophyId}.geojson`;

    try {
        const cached =
            memo && Date.now() - memo.at < TROPHY_ID_TTL ? memo.id : null;

        let trophyId = cached ?? (await scrapeTrophyId(id));
        let stale = false;

        if (!trophyId) {
            if (!memo) {
                console.error("squares: no trophy id and no cached fallback");
                return new Response("Could not fetch map", { status: 500 });
            }
            console.error(
                "squares: scrape failed, serving stale trophy id",
                memo.id,
            );
            trophyId = memo.id;
            stale = true;
        }

        let geoRes = await fetch(geojsonUrl(trophyId));

        // An id we did not scrape just now may have been rotated away upstream.
        if (geoRes.status === 404 && (cached || stale)) {
            memo = null;
            const rescraped = await scrapeTrophyId(id);
            if (!rescraped) {
                console.error("squares: rescrape after 404 failed");
                return new Response("Could not fetch map", { status: 500 });
            }
            geoRes = await fetch(geojsonUrl(rescraped));
            stale = false;
        }

        if (!geoRes.ok) {
            console.error(`squares: geojson returned ${geoRes.status}`);
            return new Response("Upstream geojson failed", { status: 500 });
        }

        return geojsonResponse(geoRes, stale);
    } catch (error) {
        console.error("squares: unhandled failure:", error);
        return new Response("Could not fetch map", { status: 500 });
    }
};
