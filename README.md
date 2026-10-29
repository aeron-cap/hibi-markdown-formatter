# Hibi Markdown Formatter

A standalone Hibi addon written in TypeScript. The installable package is in [addons/markdown-formatter](addons/markdown-formatter/README.md).

## Development

Use Node.js 24 (minimum 22.18). Run `npm ci --legacy-peer-deps`, `npm run check`, and `npm test`. Source is in `src/`; esbuild produces the committed browser module. Hibi installs compiled JavaScript without running a build or installing dependencies.

The type-only Hibi API 3 SDK in `vendor/` was packed from the Hibi checkout. Its GPL-3.0-only license is included in the archive. It is used for development type checking, never bundled into the addon. Library declaration checking is skipped because this addon does not load the editor SDK peers.

Run `npm run test:installed -- --hibi ../hibi` against a built Hibi checkout for installed-package integration tests. Run `npm run bench` for source formatting timings.

## Distribution

Publish the source and compiled package together. Garden entries reference a full commit SHA and `addons/markdown-formatter`, so rebuild and commit the output before releasing.

The starter package validator is adapted from hibigarden/addon-starter (MIT); its API-version check accepts 3 for this addon. The live garden validator currently accepts API 1 and 2 only. An API-3 catalog entry therefore requires upstream garden support before it can pass the unmodified release checks.

See [the garden contribution guide](https://github.com/hibigarden/addons-repository/blob/main/CONTRIBUTING.md) for catalog review and signing. No signing key is needed for garden submission. Direct repository installations remain unsigned.

Format-on-save is deferred until Hibi exposes an awaited save hook. Formatting and document command handling are separate so that hook can reuse the formatter.
