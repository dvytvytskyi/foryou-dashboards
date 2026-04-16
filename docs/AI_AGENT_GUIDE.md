# AI Agent Guide

## Goal

This repository should be easy to navigate for both humans and coding agents. The main rule is simple: agents should be able to identify the correct module in one pass, without reading unrelated files.

## Canonical Paths

### If the task is about UI pages

- start in `src/app/<feature>/page.tsx`
- if the page is large, continue into the local `*UI.tsx` file
- shared shell/layout behavior lives in `src/components/DashboardPage.tsx`

### If the task is about backend data

- start in `src/app/api/<domain>`
- then inspect `src/lib` for shared auth, user, or sheets logic
- prefer canonical sync scripts in `scripts/sync`

### If the task is about partners

- shared partner metadata lives in `src/lib/partners.ts`
- UI routes live in `src/app/partners/*`
- backend routes live in `src/app/api/partners/*`

### If the task is about navigation

- shared navigation metadata lives in `src/lib/navigation.ts`

## Files To Treat As High-Noise By Default

- root-level CSV, XLSX, and JSON dumps
- `scratch/*`
- `scripts/debug/*` unless the issue is explicitly operational/debugging

## Safe Editing Rules

1. Prefer editing feature-local files before touching shared wrappers.
2. Do not assume root-level data files are current production sources.
3. Treat `scripts/sync` as canonical for recurring sync jobs.
4. Treat docs in `updated_technical_task` as reference specs, not executable truth.

## Recommended Refactor Order

1. Shared config extraction
2. Shared types and response envelopes
3. `DashboardPage` decomposition
4. Service layer extraction from API routes
5. Root cleanup and archive policy