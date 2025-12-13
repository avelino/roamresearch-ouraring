# Roam Oura Ring Integration

Roam Research extension that syncs your Oura Ring health metrics into daily pages.

## Features

- **Sleep**: Score, bedtime, duration, sleep stages (deep/REM/light/awake), efficiency, HRV, and contributor scores.
- **Readiness**: Score, temperature deviation/trend, and contributor breakdown.
- **Activity**: Steps, movement, calories, activity time breakdown, MET metrics, and goals.
- **Heart Rate**: Daily average, minimum, and maximum BPM.
- **Workouts**: Activity type, duration, calories, distance, intensity, and source.
- **Tags**: Custom tags with timestamps and comments from the Oura app.

Pages are created as `ouraring/YYYY-MM-DD` with the header `#ouraring [[Month Do, YYYY]]`.

## Requirements

- Roam Research with extension support (Roam Depot or custom script loader).
- Oura personal access token with read access to your data.

## Installation

### Via Roam Depot (Recommended)

1. Open Roam Research
2. Go to **Settings → Roam Depot → Community Extensions**
3. Search for "Oura Ring" and click Install

### Manual Installation

1. Build the extension: `pnpm install && pnpm build`
2. Load `extension.js` via Roam's custom script loader

## Configuration

Open **Roam Depot → Extension Settings → Oura Ring** and configure:

| Setting | Default | Description |
|---------|---------|-------------|
| **Oura Personal Access Token** | (empty) | Token from [Oura Cloud → Personal Access Tokens](https://cloud.ouraring.com/personal-access-tokens) |
| **Page Prefix** | `ouraring` | Prefix for daily pages (pages saved as `prefix/YYYY-MM-DD`) |
| **Days to Sync** | `7` | How many past days to fetch (includes today) |
| **Enable Debug Logs** | `false` | Show detailed logs in browser console |

If the settings panel is unavailable, the extension creates a fallback config page at `roam/js/ouraring`.

## CORS Proxy

The Oura API doesn't include CORS headers, which means browsers block direct requests from web applications. This extension uses **Roam's native CORS proxy** (`roamAlphaAPI.constants.corsAnywhereProxyUrl`) to route API requests, adding the necessary headers automatically.

This proxy is hosted by the Roam team and only works from Roam domains, ensuring security and reliability without any configuration required.

## Usage

- **Automatic**: The extension syncs recent data when it loads.
- **Manual**: Click the heart icon in the topbar or run `Oura: Sync daily data` from the command palette (Cmd/Ctrl + P).

### Page Structure

Each daily page follows this structure (sections are omitted when empty):

```md
#ouraring [[November 29th, 2025]]
  Sleep
    Score: 85
    Bedtime: 22:30 – 06:45
    Total sleep: 7h 32m
    ...
    Contributors
      Deep sleep: 85
      ...
  Readiness
    Score: 78
    Temperature deviation: +0.15°C
    ...
  Activity
    Score: 90
    Steps: 8543
    ...
  Heart rate
    62 bpm avg / min 48 / max 145
  Workouts
    07:30 – Running (45m, 320 kcal, 5.20 km, moderate)
  Tags
    22:00 – [[No Caffeine]]
    08:30 – [[Meditation]] – 15 min session
```

## Development

```bash
# Install dependencies
pnpm install

# Build extension
pnpm build

# Run linter
pnpm lint

# Run lint + build
pnpm check
```

Output: `extension.js` (at project root)

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Run `pnpm check` before submitting
4. Open a pull request

See [AGENTS.md](AGENTS.md) for development guidelines and code conventions.

## License

MIT
