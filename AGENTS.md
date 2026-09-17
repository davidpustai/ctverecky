# AGENTS.md

## Checks

`pnpm check` must pass before any change is considered done. It runs
`astro check`, `eslint .` and `prettier --check` in that order.

Run it, read the output, and fix what it reports. Do not report work as
complete on a failing check, and do not disable a rule to make it pass.
`pnpm format:fix` handles formatting failures.
