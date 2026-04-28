export default {
    tailwindStylesheet: "./src/styles/global.css",
    plugins: [
        "prettier-plugin-astro",
        "prettier-plugin-css-order",
        "prettier-plugin-organize-imports",
        "prettier-plugin-tailwindcss", // has to be last
    ],
    overrides: [
        {
            files: "*.astro",
            options: {
                parser: "astro",
            },
        },
    ],
};
