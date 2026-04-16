# For You Dashboards

Analytics and operations dashboard for For You Real Estate. The codebase is a Next.js application with App Router pages, internal API routes, external data integrations, and supporting sync scripts.

## Main Product Areas

- Marketing dashboards: `/marketing`, `/red`, `/facebook`, `/website`, `/property-finder`
- Sales dashboards: `/sales`, `/sales/directions`, `/sales/plan-fact`, `/sales/brokers`
- Partner dashboards: `/partners`, `/partners/klykov`, `/partners/facebook`
- Auth flow: `/login`

## Repository Map

- `src/app` — UI routes and API routes
- `src/components` — shared UI shell and dashboard primitives
- `src/lib` — shared auth, users, sheets access, navigation and partner config
- `scripts/sync` — canonical recurring sync pipelines
- `scripts/audit`, `scripts/debug`, `scripts/verify` — support and troubleshooting scripts
- `docs` — product and architecture documentation
- `updated_technical_task` — source requirement documents
- `data` — caches and logs
- `scratch` — temporary and non-canonical experiments

## Canonical Docs

- `docs/PROJECT_STRUCTURE_AUDIT.md` — current repository structure and risk map
- `docs/AI_AGENT_GUIDE.md` — navigation rules for coding agents
- `docs/SALES_DASHBOARD_V2.md` — sales dashboard structure
- `DEPLOYMENT.md` — deployment notes

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
npm run sync:plan-fact:bq
npm run sync:brokers:bq
```

## Notes

- Production deploy is containerized.
- The repository currently contains temporary root-level artifacts; do not treat every CSV or JSON file in the root as a canonical data source.
- Prefer `scripts/sync` for recurring operational flows.
