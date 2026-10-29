# Validation

Checked on 2026-10-29 against Hibi commit 05c7c39dab478f4acd32372e84264906659810e8, addon API 3.

## Environment

Windows x64, OS build 10.0.26200; AMD Ryzen 5 5500U; Node.js 24.21.0; Prettier 3.9.10. These are local checks, not cross-platform certification.

## Results

- `npm run check`: passed formatting, strict TypeScript checking, browser builds, the adapted starter package validator, package limits, and compiled-artifact reproducibility.
- `npm test`: 50 passed. Covers formatting fixtures, idempotence, BOM/frontmatter and line endings, safe UTF-16 edits, stale targets, lifecycle handling, worker errors, cancellation, and deadlines.
- `npm run test:installed -- --hibi ../hibi`: 9 passed, none skipped. Installed the actual compiled package into a disposable Hibi profile through the command palette and enabled it through Addon Manager.
- Installed checks cover Normal-view rejection, Source and side-by-side formatting, original CRLF/frontmatter bytes, one-step undo/redo, no-op history, save/reopen, a user-assigned shortcut with no default binding, disable/re-enable, enabled-package replacement, and large-note cancellation.
- The Hibi checkout's `npm run build` passed. Its source tree was left unchanged. The full Hibi regression suite was not run because this addon does not modify Hibi core.

The installed test saves a local screenshot under ignored `artifacts/source-formatted.png`.

## Responsiveness

The large-note fixture contains 230,000 bytes with LF endings and 260,000 bytes after Hibi preserves the opened file's CRLF style. During a still-pending formatter worker request, the renderer delivered 76 ten-millisecond timer callbacks over approximately 900 ms. Typing one character terminated the worker before it returned; the exact new source was retained.

The pure formatting benchmark, run outside the UI, measured single warm samples of 163.2 ms for 9,200 bytes, 837.3 ms for 92,000 bytes, and 8,314.9 ms for 460,000 bytes. These samples overlapped other local build activity and are diagnostic timings, not stable performance guarantees. They motivated running Prettier in a separate worker. The worker has a 30-second deadline.

## Distribution limits

The package is approximately 384 KB in six files and imports no Hibi runtime code or external dependencies at install time. It requests no editor/UI SDK capabilities or network origins.

The original starter validator only accepted API 2; its local API-version check is adapted to accept this API-3 package. The garden's current validator still accepts API 1 and 2 only. An unmodified garden catalog check will therefore reject this entry until API-3 support is added upstream. The garden listing must remain a draft until that prerequisite is resolved.
