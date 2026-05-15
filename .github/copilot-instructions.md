For full project context (workspaces, build targets, env vars, CI, do/don't guidance, and doc gaps), read [.github/MOTHERDOC.md](./MOTHERDOC.md).

Versioned product and developer guides (Markdown, same sources as the website): https://github.com/SomeAussieGaymer/fxPanel-Docs/tree/main

Comments in code that place `NC` right after `!` (the no-commit tag described in `docs/CONTRIBUTING.md`) are used by a git pre-commit hook to prevent committing those lines, and generally mark TODOs that must be resolved before committing the changes.
Import `suite, it, expect` from vitest for writing tests, whith each method having one `suite()` and a list of tests using the `it()` for its definition.
Prefer implicit over explicit function return types.
Except for React components, prefer arrow functions.
Prefer using for..of instead of forEach.
Prefer single quotes over doble quotes.
