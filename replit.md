# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Python**: 3.11 with torch, transformers, faiss-cpu, pillow, numpy

## Artifacts

### image-search (React + Vite web app)
- **Preview path**: `/`
- **Description**: AI-powered image similarity search app using OpenAI CLIP model + FAISS
- **Pages**:
  - `/` — Search page: upload query image, adjust similarity threshold (0-100%), find matching images
  - `/database` — Database management: upload images to index, view stats, clear database

### api-server (Express 5 backend)
- **Preview path**: `/api`
- **Routes**:
  - `GET /api/images/stats` — Database statistics
  - `GET /api/images/list` — List all indexed images
  - `POST /api/images/upload` — Upload and index images (multipart)
  - `POST /api/images/index` — Index images from a folder path
  - `POST /api/images/clear` — Clear the FAISS database
  - `GET /api/images/:id` — Serve indexed image by ID
  - `POST /api/search` — Search for similar images (multipart with query image)

## Python Image Search Engine

- Script: `artifacts/api-server/python_scripts/image_search.py`
- Model: OpenAI CLIP (openai/clip-vit-base-patch32) — downloads ~600MB on first use
- Vector index: FAISS IndexFlatIP (512-dimensional embeddings)
- Database stored in: `data/images.index` and `data/image_paths.json`
- Uploaded images stored in: `uploaded_images/`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
