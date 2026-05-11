// @ts-check
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
    site:
        process.env.NODE_ENV === "production"
            ? "https://ctverecky.djvesko.cz"
            : "http://localhost:3000",
    adapter: vercel(),
    server: {
        port: 3000,
    },
    vite: {
        plugins: [tailwindcss()],
    },
    experimental: {
        svgo: {
            plugins: [
                {
                    name: "addAttributesToSVGElement",
                    params: {
                        attributes: [
                            {
                                "aria-hidden": "true",
                            },
                            {
                                focusable: "false",
                            },
                        ],
                    },
                },
            ],
        },
    },
});
