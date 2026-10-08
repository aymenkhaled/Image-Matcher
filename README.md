# Image Matcher

A pnpm/TypeScript workspace for an image-search application with a supporting API and UI sandbox.

## Structure
- `artifacts/image-search/` — image-search client
- `artifacts/api-server/` — server
- `artifacts/mockup-sandbox/` — UI experimentation
- `lib/` and `scripts/` — shared support code

## Local development
The root project requires **pnpm**.

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

To start an individual application, inspect that workspace's `package.json` and required environment variables.

## Status
Prototype / portfolio codebase. Matching accuracy, supported image formats, and any live service integrations have not been independently validated.
