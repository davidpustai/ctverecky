// @ts-check
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, svgoOptimizer } from "astro/config";

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
        svgOptimizer: svgoOptimizer({
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
        }),
    },
});
