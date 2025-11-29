# Roam Oura Ring – Agent Guidelines

Project Snapshot

- Roam Research extension written in strict TypeScript, bundled with Vite (`npx pnpm build`).
- Main entry: `src/main.ts`; supporting modules: `ouraring.ts`, `blocks.ts`, `settings.ts`, `ui.ts`, `logger.ts`, `constants.ts`.
- Exports `{ onload, onunload }` object for Roam Depot compatibility (ES module format).
- Interacts with the Roam runtime via direct `roamAlphaAPI` calls for UI and page mutations; communicates with Oura Cloud API v2 via HTTPS.
- Configuration is managed via Roam Depot → Extension Settings → "Oura Ring". Defaults are applied on first load; respect user edits and persist values using `extensionAPI.settings`. Falls back to config page `roam/js/ouraring` when settings panel is unavailable.
- Data is organized in daily pages: `{pagePrefix}/YYYY-MM-DD`. Dates displayed follow the Roam daily note pattern (`MMMM Do, YYYY` – e.g., "November 29th, 2025").
- Each page contains sections for Sleep, Readiness, Activity, Heart rate, and Workouts (omitted when empty).

## Environment & Tooling

- Package manager: pnpm (`npx pnpm ...`); lockfile `pnpm-lock.yaml`.
- Install deps before running scripts: `npx pnpm install`.
- Build command: `npx pnpm build` (runs `tsc` then `vite build` producing `dist-ouraring/extension.js`).
- Lint command: `npx pnpm lint` (uses ESLint with TypeScript support).
- Check command: `npx pnpm check` (runs lint + build in sequence).
- Target Node version matches CI (`actions/setup-node@v3`) using Node 20.8+. Avoid APIs unavailable in that runtime.
- No runtime dependencies; all dev dependencies are for build/lint/release tooling.

## Code Structure Rules

- Preserve module boundaries:
  - `ouraring.ts`: Oura DTOs, API helpers, data fetching, summary utilities.
  - `blocks.ts`: Block composition, page creation, section builders (`buildSleepNode`, `buildReadinessNode`, etc.).
  - `settings.ts`: Roam API wrappers (`getBasicTreeByParentUid`, `createPage`, etc.), settings reading/initialization, panel registration.
  - `logger.ts`: Logging helpers (`logInfo`, `logWarn`, `logDebug`, `logError`) with debug flag control.
  - `ui.ts`: UI wiring (command palette, topbar button).
  - `constants.ts`: Runtime constants (API URLs, default values, UI labels).
- UI wiring (command palette, top bar icons) must remain in `ui.ts`; avoid ad-hoc DOM manipulations elsewhere.
- Reuse logging helpers instead of raw `console.*`. For structured data use `logDebug(operation, data)`.
- Always prefer pure functions returning new data unless Roam APIs mandate mutation.
- Document public functions with concise JSDoc describing purpose and parameters.

Module Details

### main.ts

- Entry point for the extension with `onload` and `onunload` handlers.
- Manages extension lifecycle: settings initialization, command/button registration.
- Orchestrates sync flow: build date range → fetch daily data → write pages.
- Syncs automatically on load and manually via command palette or topbar button.

### ouraring.ts

- `fetchDailyData`: Fetches all Oura data for a given date (sleep, readiness, activity, workouts, heart rate) in parallel. Accepts optional `corsProxyUrl` parameter.
- `fetchCollection<T>`: Generic cursor-based pagination for Oura Cloud API endpoints. Routes requests through CORS proxy when configured.
- `buildProxiedUrl`: Wraps API URLs with CORS proxy prefix when configured (e.g., `https://corsproxy.io/?<encoded_url>`).
- `formatMinutesFromSeconds`: Converts seconds to human-readable duration (e.g., "7h 32m").
- `summarizeHeartRate`: Computes min/max/average from heart rate samples.
- Interfaces: `OuraSleep`, `OuraReadiness`, `OuraActivity`, `OuraHeartRateSample`, `OuraWorkout`, `DailyOuraData`.

### blocks.ts

- `writeDailyOuraPage`: Creates or updates a page for a given date with Oura data.
- `buildHeaderNode`: Constructs the main block with `#ouraring [[Date]]` header and section children.
- Section builders: `buildSleepNode`, `buildReadinessNode`, `buildActivityNode`, `buildHeartRateNode`, `buildWorkoutsNode`.
- Formatting utilities: `formatNumber`, `formatPercentage`, `formatHeartRate`, `formatBedtime`, `formatTime`, `formatDistance`, `formatDailyNoteDate`, `formatOrdinal`.

### settings.ts

- Roam API wrappers: `getBasicTreeByParentUid`, `getPageUidByPageTitle`, `createPage`, `createBlock`, `deleteBlock`.
- `initializeSettings`: Detects settings panel support; registers panel or creates config page.
- `readSettings`: Returns `SettingsSnapshot` from panel or page-based config.
- Settings keys: `ouraring_token`, `page_prefix`, `days_to_sync`, `enable_debug_logs`, `cors_proxy_url`.
- `MUTATION_DELAY_MS`: 100ms throttle between Roam mutations (respects rate limits).
- `yieldToMain()`: Yields control back to browser main thread during sync operations, preventing UI blocking.
- `YIELD_BATCH_SIZE`: Number of operations (default: 3) to process before yielding to main thread.

### ui.ts

- `registerCommand`: Adds "Oura: Sync daily data" to command palette via extensionAPI or legacy roamAlphaAPI.
- `registerTopbarButton`: Creates icon button in Roam topbar with `heart` icon.

### logger.ts

- `setDebugEnabled`: Toggles debug/info log visibility.
- `logInfo`, `logWarn`: Conditional logging when debug is enabled.
- `logError`: Always visible regardless of debug setting.
- `logDebug`: Structured logging with operation name and data object.

### constants.ts

- API URL: `OURA_API_BASE` (v2 usercollection endpoint).
- Default values: page prefix (`ouraring`), config page title (`roam/js/ouraring`), CORS proxy (`corsproxy.io`).
- `DEFAULT_CORS_PROXY`: Default CORS proxy URL prefix for bypassing browser CORS restrictions.
- UI constants: command label, topbar button ID/icon.
- Pattern: `ISO_DATE_PATTERN` for validating date strings.

TypeScript & Validation Expectations

- Project compiles with `strict` options; honor null safety and inference.
- Validate all external inputs aggressively:
  - Oura responses: guard optional fields, validate dates against `ISO_DATE_PATTERN`, handle pagination cursors defensively.
  - Roam settings: trim strings, coerce numbers, clamp values (`days_to_sync >= 1`); reuse `readSettings` to obtain sanitized snapshots.
- Prefer `unknown` over `any` for new external payloads; narrow via type guards or validators.
- Handle async errors with try/catch; display actionable messages via `showStatusMessage` and log details with `logError`.

Quality Gates Before Submitting Changes

- Run `npx pnpm install` when dependencies change or in new environments.
- Run `npx pnpm lint` to ensure zero lint errors.
- Run `npx pnpm build` to ensure type-checking and bundling succeed.
- Manually test in Roam when behavior changes: manual sync, page creation, data display.

Development Conventions

- Avoid new global state beyond existing module-level flags (`syncInProgress`). Prefer closures or module-scoped constants.
- Background syncs must not interrupt the user: do not steal focus or scroll position in Roam. Use `yieldToMain()` in loops to prevent blocking typing.
- Use template literals only when interpolation is required; keep strings ASCII.
- Keep network utilities reusable; new Oura helpers belong in `ouraring.ts` and should respect shared pagination behavior.
- When updating pages, delete existing content and recreate to ensure fresh data without duplicates.

Block Structure

Daily pages are written with the following structure:

```
#ouraring [[November 29th, 2025]]
  Sleep
    Score: 85
    Efficiency: 92%
    Total sleep: 7h 32m
    Time in bed: 8h 15m
    Avg HR: 52 bpm avg / min 48
    Bedtime: 22:30 – 06:45
  Readiness
    Score: 78
    Activity balance: 82
    Sleep balance: 75
    Recovery index: 80
    Resting HR: 48 bpm
    HRV balance: 72
  Activity
    Score: 90
    Steps: 8543
    Active calories: 450 kcal
    Total calories: 2100 kcal
    Distance: 6.82 km
    High activity: 45m
    Medium activity: 1h 20m
    Low activity: 3h 15m
  Heart rate
    62 bpm avg / min 48 / max 145
  Workouts
    07:30 – Running (45m, 320 kcal, 5.20 km, moderate)
    18:00 – Cycling (1h 10m, 450 kcal, high)
```

Error Handling & Logging

- Use logging helpers; never log raw tokens or sensitive data.
- Debug/info logs obey the `enable_debug_logs` flag; errors always surface.
- Structured debug logs should follow `logDebug("operation_name", { key: value })`.
- Distinguish manual vs automatic sync context: surface warnings only for manual triggers, rely on info logs for background jobs.

Performance

- **Never block the UI thread**: use `yieldToMain()` periodically during sync operations to allow user input and UI updates.
- Fetch Oura resources in parallel (`Promise.all`) for all five data types per date.
- Respect Roam mutation rate limit: use `MUTATION_DELAY_MS` (100ms) between API calls.

Security & Privacy

- Never log or store raw Oura tokens.
- Only send `Authorization: Bearer` headers when tokens are present; short-circuit otherwise.
- Sanitize errors before logging to avoid leaking sensitive payloads.

Settings Reference

| Setting | Key | Default | Description |
|---------|-----|---------|-------------|
| Oura Token | `ouraring_token` | (empty) | Personal Access Token from Oura Cloud |
| Page Prefix | `page_prefix` | `ouraring` | Prefix for daily pages; pages saved to `prefix/YYYY-MM-DD` |
| Days to Sync | `days_to_sync` | `7` | How many past days to fetch (includes today) |
| Enable Debug Logs | `enable_debug_logs` | `false` | Show debug logs in browser console |
| CORS Proxy URL | `cors_proxy_url` | `https://corsproxy.io/?` | Proxy URL to bypass CORS restrictions; leave empty to disable |

Review Checklist

- [ ] Code respects module boundaries and naming conventions.
- [ ] All new inputs validated, sanitized, and strongly typed.
- [ ] Lint and build commands succeed locally.
- [ ] No stray files committed; unused assets removed.
- [ ] Documentation (README, AGENTS.md) updated for behavioral changes.
- [ ] CHANGELOG.md updated with new features, bug fixes, or breaking changes under `[Unreleased]` section.

CHANGELOG Guidelines

- Every pull request with user-facing changes **must** include a CHANGELOG.md entry.
- Add entries under the `[Unreleased]` section using appropriate subsections:
  - `### Added` – new features
  - `### Changed` – changes in existing functionality
  - `### Deprecated` – soon-to-be removed features
  - `### Removed` – removed features
  - `### Fixed` – bug fixes
  - `### Security` – vulnerability fixes
- Keep entries concise and user-focused (what changed, not how).
- Reference issue/PR numbers when applicable (e.g., `(#42)`).
- On release, maintainers move `[Unreleased]` entries to a versioned section.

Maintainers favor maintainability, readability, and defensive programming. When uncertain, add explicit validation, document assumptions, and err on the side of safety.
