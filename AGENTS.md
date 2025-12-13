# Roam Oura Ring – Agent Guidelines

Project Snapshot

- Roam Research extension written in strict TypeScript, bundled with Vite (`npx pnpm build`).
- Main entry: `src/main.ts`; supporting modules: `ouraring.ts`, `blocks.ts`, `settings.ts`, `ui.ts`, `logger.ts`, `constants.ts`.
- Exports `{ onload, onunload }` object for Roam Depot compatibility (ES module format).
- Interacts with the Roam runtime via direct `roamAlphaAPI` calls for UI and page mutations; communicates with Oura Cloud API v2 via HTTPS.
- Configuration is managed via Roam Depot → Extension Settings → "Oura Ring". Defaults are applied on first load; respect user edits and persist values using `extensionAPI.settings`. Falls back to config page `roam/js/ouraring` when settings panel is unavailable.
- Data is organized in daily pages: `{pagePrefix}/YYYY-MM-DD`. Dates displayed follow the Roam daily note pattern (`MMMM Do, YYYY` – e.g., "November 29th, 2025").
- Each page contains sections for Sleep, Readiness, Activity, Heart rate, Workouts, and Tags (omitted when empty).

## Environment & Tooling

- Package manager: pnpm (`npx pnpm ...`); lockfile `pnpm-lock.yaml`.
- Install deps before running scripts: `npx pnpm install`.
- Build command: `npx pnpm build` (runs `tsc` then `vite build` producing `extension.js` at project root).
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

- `fetchAllDailyData`: Main entry point for fetching Oura data. Fetches data for multiple dates using batch requests (max 7 days per request). Returns a Map of date → DailyOuraData.
- `fetchBatchData`: Fetches all Oura data for a date range in batch. More efficient than day-by-day fetching and avoids API issues with single-day queries.
- `splitDatesIntoChunks`: Splits an array of dates into chunks of maximum 7 days for batch processing.
- `groupDataByDate`: Groups raw batch API response data by date, creating DailyOuraData for each day.
- `fetchCollection<T>`: Generic cursor-based pagination for Oura Cloud API endpoints. Routes requests through Roam's native CORS proxy (`roamAlphaAPI.constants.corsAnywhereProxyUrl`).
- `formatMinutesFromSeconds`: Converts seconds to human-readable duration (e.g., "7h 32m").
- `summarizeHeartRate`: Computes min/max/average from heart rate samples.
- Interfaces (based on Oura API v2 and [training-personal-data](https://github.com/avelino/training-personal-data) Clojure implementation):
  - `OuraSleepContributors`: Sleep quality contributor scores (deep_sleep, efficiency, latency, rem_sleep, restfulness, timing, total_sleep).
  - `OuraSleep`: Full sleep data including stages (deep, REM, light, awake), HRV, latency, and contributors.
  - `OuraReadinessContributors`: Readiness contributor scores (activity_balance, body_temperature, hrv_balance, etc.).
  - `OuraReadiness`: Readiness data with temperature deviation/trend and contributors.
  - `OuraActivity`: Activity data with movement metrics, calorie tracking, time breakdown (high/medium/low/sedentary/resting), MET metrics, and goal tracking.
  - `OuraHeartRateSample`: Heart rate sample with bpm, source, and timestamp.
  - `OuraWorkout`: Workout data with activity, sport, label, intensity, calories, distance, and source.
  - `OuraTag`: Enhanced tag from `/enhanced_tag` endpoint with custom_name and tags array support. Note: `/tag` endpoint is deprecated.
  - `DailyOuraData`: Aggregated daily data container.

### blocks.ts

- `writeDailyOuraPage`: Creates or updates a page for a given date with Oura data.
- `buildHeaderText`: Constructs header text with date and inline scores: `#ouraring [[Date]] sleep: X / readiness: Y`.
- `buildHeaderNode`: Constructs the main block with header text and section children.
- Section builders: `buildSleepNode`, `buildReadinessNode`, `buildActivityNode`, `buildHeartRateNode`, `buildWorkoutsNode`, `buildTagsNode`.
- Formatting utilities: `formatNumber`, `formatPercentage`, `formatHeartRate`, `formatBedtime`, `formatTime`, `formatTimestamp`, `formatDistance`, `formatTemperature`, `formatDailyNoteDate`, `formatOrdinal`, `formatTagLine`, `formatTagTime`, `formatTagType`, `formatActivityName`, `formatWorkoutLine`.

### settings.ts

- Roam API wrappers: `getBasicTreeByParentUid`, `getPageUidByPageTitle`, `createPage`, `createBlock`, `deleteBlock`.
- `initializeSettings`: Detects settings panel support; registers panel or creates config page.
- `readSettings`: Returns `SettingsSnapshot` from panel or page-based config.
- Settings keys: `ouraring_token`, `page_prefix`, `days_to_sync`, `enable_debug_logs`.
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
- Default values: page prefix (`ouraring`), config page title (`roam/js/ouraring`).
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

Daily pages are written with the following structure (fields shown when data is available):

```
#ouraring [[November 29th, 2025]] sleep: 85 / readiness: 78
  Sleep
    Score: 85
    Bedtime: 22:30 – 06:45
    Total sleep: 7h 32m
    Time in bed: 8h 15m
    Deep sleep: 1h 45m
    REM sleep: 2h 10m
    Light sleep: 3h 37m
    Awake time: 25m
    Efficiency: 92%
    Latency: 8m
    Restless periods: 3
    Avg HR: 52 bpm avg / min 48
    Avg HRV: 45 ms
    Contributors
      Deep sleep: 85
      Efficiency: 90
      Latency: 88
      REM sleep: 82
      Restfulness: 78
      Timing: 95
      Total sleep: 88
  Readiness
    Score: 78
    Temperature deviation: +0.15°C
    Temperature trend: -0.05°C
    Activity balance: 82
    Sleep balance: 75
    Recovery index: 80
    Resting HR: 48
    HRV balance: 72
    Contributors
      Activity balance: 85
      Body temperature: 90
      HRV balance: 75
      Previous day activity: 82
      Previous night: 88
      Recovery index: 80
      Resting heart rate: 78
      Sleep balance: 75
  Activity
    Score: 90
    Steps: 8543
    Daily movement: 5.20 km
    Distance: 6.82 km
    Active calories: 450 kcal
    Total calories: 2100 kcal
    Target calories: 2000 kcal
    High activity: 45m
    Medium activity: 1h 20m
    Low activity: 3h 15m
    Sedentary time: 8h 30m
    Resting time: 7h 45m
    Non-wear time: 1h 30m
    High activity MET: 120 min
    Medium activity MET: 180 min
    Low activity MET: 360 min
    Target meters: 8000.00 km
    Meters to target: 1180.00 km
    Inactivity alerts: 2
  Heart rate
    62 bpm avg / min 48 / max 145
  Workouts
    07:30 – Running (45m, 320 kcal, 5.20 km, moderate, via manual)
    18:00 – Cycling (1h 10m, 450 kcal, high)
  Tags
    22:00 – [[No Caffeine]]
    08:30 – [[Meditation]] – 15 min session
    [[Sleep]] [[Focus]]
```

Error Handling & Logging

- Use logging helpers; never log raw tokens or sensitive data.
- Debug/info logs obey the `enable_debug_logs` flag; errors always surface.
- Structured debug logs should follow `logDebug("operation_name", { key: value })`.
- Distinguish manual vs automatic sync context: surface warnings only for manual triggers, rely on info logs for background jobs.

Performance

- **Never block the UI thread**: use `yieldToMain()` periodically during sync operations to allow user input and UI updates.
- Fetch Oura resources in parallel (`Promise.all`) for all six data types per date (sleep, readiness, activity, heart rate, workouts, enhanced_tag).
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

> **CORS Proxy**: The extension uses Roam's native CORS proxy (`roamAlphaAPI.constants.corsAnywhereProxyUrl`) to bypass browser restrictions when calling the Oura API. This proxy is hosted by the Roam team and only works from Roam domains.

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
