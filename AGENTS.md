# Roam Oura Ring – Agent Guidelines

## Project Snapshot

Roam Research extension written in strict TypeScript, bundled with Vite.

- **Entry:** `src/main.ts` exports `{ onload, onunload }` for Roam Depot (ES module)
- **Output:** `extension.js` at project root
- **Runtime:** Roam Alpha API for page/block mutations; Oura Cloud API v2 via HTTPS
- **Settings:** Roam Depot panel or fallback config page `roam/js/ouraring`
- **Data:** Daily pages at `{pagePrefix}/YYYY-MM-DD` with Sleep, Readiness, Activity, Heart rate, Workouts, Tags sections

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         main.ts                                  │
│  onload() → initSettings → registerUI → syncOura()              │
└──────────────────────────────┬──────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐    ┌─────────────────┐    ┌────────────────┐
│   ui.ts       │    │   ouraring.ts   │    │   settings.ts  │
│ command/btn   │    │ API client      │    │ Roam wrappers  │
└───────────────┘    │ DTOs/interfaces │    │ settings I/O   │
                     └────────┬────────┘    └────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │   blocks.ts     │
                     │ page creation   │
                     │ section builders│
                     └─────────────────┘
                              │
                     ┌────────┴────────┐
                     ▼                 ▼
              ┌────────────┐   ┌──────────────┐
              │ logger.ts  │   │ constants.ts │
              └────────────┘   └──────────────┘
```

## Data Flow

```
1. syncOura(trigger)
   │
   ├─► refreshSettings() → SettingsSnapshot { token, pagePrefix, daysToSync }
   │
   ├─► buildDateRange(days) → ["2025-01-05", "2025-01-04", ...]
   │
   ├─► fetchAllDailyData(token, dates)
   │   │
   │   ├─► splitDatesIntoChunks(dates, 7) → chunks
   │   │
   │   └─► for each chunk:
   │       fetchBatchData(startDate, endDate)
   │       │
   │       └─► Promise.all([
   │             fetchCollection("/daily_sleep", ...),
   │             fetchCollection("/daily_readiness", ...),
   │             fetchCollection("/daily_activity", ...),
   │             fetchCollection("/workout", ...),
   │             fetchCollection("/heartrate", ...),
   │             fetchCollection("/enhanced_tag", ...)
   │           ])
   │           │
   │           └─► groupDataByDate() → Map<date, DailyOuraData>
   │
   └─► for each date:
       writeDailyOuraPage(pagePrefix, data)
       │
       └─► createPage/replacePageContent
           └─► buildHeaderNode → section builders
```

## Commands

```bash
pnpm install    # Install dependencies (required first)
pnpm build      # tsc + vite build → extension.js
pnpm lint       # ESLint with TypeScript
pnpm check      # lint + build (run before PR)
```

Node 20.8+ required (matches CI).

## Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `main.ts` | Entry point, lifecycle, sync orchestration |
| `ouraring.ts` | Oura DTOs, API client, batch fetching, data grouping |
| `blocks.ts` | Block composition, section builders, formatting |
| `settings.ts` | Roam API wrappers, settings panel/page, utilities |
| `ui.ts` | Command palette, topbar button registration |
| `logger.ts` | `logInfo`/`logWarn`/`logDebug`/`logError` with debug flag |
| `constants.ts` | API URLs, defaults, UI labels, patterns |

**Rules:**
- Keep module boundaries strict
- Never use raw `console.*` – use logger helpers
- UI registration only in `ui.ts`
- New Oura helpers go in `ouraring.ts`

## Key Interfaces

```typescript
// Aggregated daily data (ouraring.ts)
interface DailyOuraData {
  date: string;
  sleep: OuraSleep[];
  readiness: OuraReadiness[];
  activity: OuraActivity[];
  heartrate: OuraHeartRateSample[];
  workouts: OuraWorkout[];
  tags: OuraTag[];
}

// Settings snapshot (settings.ts)
interface SettingsSnapshot {
  token?: string;
  pagePrefix: string;      // default: "ouraring"
  daysToSync: number;      // default: 7
  enableDebugLogs: boolean;
}

// Block structure (settings.ts)
interface InputTextNode {
  text: string;
  children?: InputTextNode[];
}
```

## Oura API Endpoints

| Endpoint | Interface | Date Field |
|----------|-----------|------------|
| `/daily_sleep` | `OuraSleep` | `day` |
| `/daily_readiness` | `OuraReadiness` | `day` |
| `/daily_activity` | `OuraActivity` | `day` |
| `/workout` | `OuraWorkout` | `day` or `start_datetime` |
| `/heartrate` | `OuraHeartRateSample` | `timestamp` |
| `/enhanced_tag` | `OuraTag` | `start_day` or `day` |

**Notes:**
- `/tag` endpoint is deprecated – use `/enhanced_tag` only
- All requests go through Roam's CORS proxy: `roamAlphaAPI.constants.corsAnywhereProxyUrl`
- Batch requests max 7 days to avoid API issues with single-day queries

## Block Structure

Daily pages follow this structure (sections omitted when empty):

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
      ...
  Readiness
    Score: 78
    Temperature deviation: +0.15°C
    Temperature trend: -0.05°C
    Contributors
      Activity balance: 85
      ...
  Activity
    Score: 90
    Steps: 8543
    Daily movement: 5.20 km
    ...
  Heart rate
    62 bpm avg / min 48 / max 145
  Workouts
    07:30 – Running (45m, 320 kcal, 5.20 km, moderate, via manual)
  Tags
    22:00 – [[No Caffeine]]
    08:30 – [[Meditation]] – 15 min session
```

## TypeScript & Validation

- Strict mode enabled; honor null safety
- Validate all external inputs:
  - Oura responses: guard optional fields, validate dates against `ISO_DATE_PATTERN`
  - Settings: trim strings, coerce numbers, clamp values (`daysToSync >= 1`)
- Prefer `unknown` over `any`; narrow via type guards
- Handle async errors with try/catch; use `showStatusMessage` for user feedback

## Performance

- **Never block UI**: use `yieldToMain()` in loops during sync
- Batch API requests (max 7 days per request)
- Fetch all 6 data types in parallel with `Promise.all`
- Respect Roam mutation rate limit: `MUTATION_DELAY_MS` (100ms) between API calls
- `YIELD_BATCH_SIZE` (3) operations before yielding to main thread

## Security & Privacy

- Never log or store raw Oura tokens
- Only send `Authorization: Bearer` when token is present
- Sanitize errors before logging

## Settings Reference

| Setting | Key | Default | Description |
|---------|-----|---------|-------------|
| Oura Token | `ouraring_token` | (empty) | Personal Access Token from Oura Cloud |
| Page Prefix | `page_prefix` | `ouraring` | Pages saved to `prefix/YYYY-MM-DD` |
| Days to Sync | `days_to_sync` | `7` | Past days to fetch (includes today) |
| Debug Logs | `enable_debug_logs` | `false` | Show debug logs in console |

## Review Checklist

- [ ] Code respects module boundaries
- [ ] All inputs validated and strongly typed
- [ ] `pnpm check` passes (lint + build)
- [ ] Manually tested in Roam if behavior changes
- [ ] CHANGELOG.md updated under `[Unreleased]`

## CHANGELOG Guidelines

Every PR with user-facing changes needs a CHANGELOG entry under `[Unreleased]`:

- `### Added` – new features
- `### Changed` – changes in existing functionality
- `### Fixed` – bug fixes
- `### Security` – vulnerability fixes

Keep entries concise and user-focused. Reference issues/PRs when applicable.
