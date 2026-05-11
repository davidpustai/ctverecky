import Browserbase from "@browserbasehq/sdk";
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async () => {
    const id = import.meta.env.SQUADRATS_ID as string;
    if (!id) {
        return new Response("SQUADRATS_ID not configured", { status: 500 });
    }

    const bb = new Browserbase({
        apiKey: import.meta.env.BROWSERBASE_API_KEY as string,
    });

    const mapReponse = await bb.fetchAPI.create({
        url: `https://squadrats.com/map/${id}/17`,
        proxies: true,
    });
    if (mapReponse.statusCode !== 200) {
        return new Response("Could not fetch map", { status: 500 });
    }

    const imgs =
        /<img[^>]*class="[^"]*\btrophies-map\b[^"]*"[^>]*src="([^"]+)"/.exec(
            mapReponse.content,
        );
    const src = imgs?.[1] ?? "";
    const currentId = src.slice(src.lastIndexOf("/") + 1, src.lastIndexOf("_"));
    if (!currentId) {
        return new Response("Could not extract trophy id", { status: 500 });
    }

    const geoRes = await fetch(
        `https://squadrats.org/trophies/${id}/${currentId}.geojson`,
    );
    if (!geoRes.ok) {
        return new Response("Upstream geojson failed", { status: 500 });
    }

    return new Response(geoRes.body, {
        status: 200,
        headers: {
            "Content-Type": "application/geo+json",
            "Cache-Control": "public, max-age=60, s-maxage=60",
        },
    });
};
