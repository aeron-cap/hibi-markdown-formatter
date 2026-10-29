# Type-only Hibi SDK

hibi-addon-sdk-0.2.0.tgz was produced with `npm run sdk:pack` from schmayterling/hibi at commit 05c7c39dab478f4acd32372e84264906659810e8 (addon API 3).

This archive contains the official development declarations and their GPL-3.0-only license. It is installed only as a development dependency and is never part of the installable addon or its browser bundle. No Hibi runtime source is imported.

The package's editor and UI peer dependencies are intentionally not installed: this addon declares no such capabilities, and TypeScript checks its own source with `skipLibCheck`. Use `npm ci --legacy-peer-deps` to reproduce the development environment.
