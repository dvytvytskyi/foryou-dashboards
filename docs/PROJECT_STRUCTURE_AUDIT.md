# Project Structure Audit

## Purpose

This document maps the current repository structure as it exists now and marks which areas are production-critical, reusable application code, or operational/debug noise.

## Top-Level Zones

### Runtime and platform files

- `package.json` — app scripts and dependency entrypoint
- `Dockerfile`, `docker-compose.yml` — container runtime
- `middleware.ts`, `next.config.ts`, `tsconfig.json` — framework and routing configuration
- `README.md`, `DEPLOYMENT.md`, `BACKLOG.md` — root guidance documents

### Product source

- `src/app` — App Router pages and API routes
- `src/components` — shared UI, currently centered around `DashboardPage.tsx`
- `src/lib` — auth, users, sheets access, shared config

### Production data and caches

- `data/cache` — cached operational data
- `data/logs` — logs and diagnostics
- `pf_listings_report.json`, `pf_projects_report.json` — embedded Property Finder reports used by the app/runtime scripts
- `broker_mapping.json` — broker/source mapping input

### Scripts and operations

- `scripts/sync` — canonical sync pipelines
- `scripts/audit` — diagnostics and inspection tools
- `scripts/debug` — ad hoc debugging scripts
- `scripts/verify` — validation scripts
- `scripts/kpi` — KPI-related utilities

### Documentation and specifications

- `docs` — product and dashboard documents
- `updated_technical_task` — source specification materials and requirement snapshots

### High-noise temporary artifacts

- root-level CSV, XLSX, JSON dumps
- `scratch` — one-off experiments and legacy utilities
- `secondary_rental.html` and similar extraction/debug files

## Application Modules

### Marketing

- Pages: `src/app/marketing`, `src/app/red`, `src/app/facebook`, `src/app/website`, `src/app/property-finder`
- APIs: `src/app/api/marketing`, `src/app/api/pf-listings`, `src/app/api/pf-projects`

### Sales

- Pages: `src/app/sales`, `src/app/sales/directions`, `src/app/sales/plan-fact`, `src/app/sales/brokers`
- Heavy UIs: `OverviewUI.tsx`, `DirectionsUI.tsx`, `PlanFactUI.tsx`, `BrokersUI.tsx`
- APIs: `src/app/api/sales/*`

### Partners

- Pages: `src/app/partners`, `src/app/partners/klykov`, `src/app/partners/facebook`
- APIs: `src/app/api/partners/klykov`, `src/app/api/partners/facebook`

### Auth

- Pages: `src/app/login`
- APIs: `src/app/api/auth/*`
- Shared logic: `src/lib/auth.ts`, `src/lib/users.ts`

## Current Architectural Hotspots

### Large shared UI wrapper

- `src/components/DashboardPage.tsx` mixes navigation, layout, filters, table, formatting, auth-dependent redirects, and theme state.

### Heavy route handlers

- `src/app/api/sales/plan-fact/route.ts`
- `src/app/api/sales/brokers/route.ts`
- partner APIs that combine transport and business logic

### Source of AI context waste

- many temporary files in repo root look like active inputs
- `scratch` has no boundary between experimental and obsolete tools
- navigation and partner configuration were previously duplicated in feature files

## Safe Structural Direction

### Immediate changes that do not break runtime

1. Extract shared configuration and routing metadata into `src/lib`.
2. Add canonical documentation for module ownership and script purpose.
3. Keep current routes and file locations stable.

### Medium-term refactor targets

1. Split `DashboardPage.tsx` into sidebar, header, filters, and table modules.
2. Move API orchestration into `src/lib/services`.
3. Standardize API response envelopes and shared types.
4. Move operational noise out of the root into clearly named zones.