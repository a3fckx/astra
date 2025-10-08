# Migration Notes — Python Monolith ➜ Next.js Only

This document captures the clean-up that removed the FastAPI monolith and explains how to work with the new layout.

---

## Timeline

1. **Snapshot (main)** — Commits up to `chore: snapshot current dual-service state` preserve the old Python + Next.js dual-service structure.
2. **New branch (`dev`)** — All cleanup work continues here.
3. **Removal** — Deleted `backend/`, `buffer/`, `config.json`, `shared/`, and auxiliary Python tooling (`test_mongo.py`, agent runner scripts).
4. **Replacement** — Introduced `agents/` directory, refreshed documentation, and simplified `.gitignore`.

---

## Current Expectations

- Only the Next.js app remains in this repository.
- Personas and agent assets live under `agents/`.
- Julep handles agent execution; no local Python services.
- Biome (`bun run lint`) replaces the previous Ruff/Pyre pipeline.

---

## What If You Need Legacy Code?

- Checkout the commit on `main` created before this cleanup.
- Branch from that commit if you must reintroduce portions of the Python stack.
- Avoid re-adding filesystem buffers or `config.json`; use Julep docs and secrets instead.

---

## Future Work

- Implement Julep tasks that replace the deleted FastAPI workers.
- Port any remaining helper utilities (e.g., Google People API integrations) into TypeScript or hosted microservices.
- Update docs whenever new components are added so the repository stays source-of-truth.
