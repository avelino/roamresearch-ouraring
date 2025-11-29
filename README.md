# Roam Oura Ring Integration

Roam Research extension that downloads your Oura Ring metrics into daily pages, one day per page.

## Overview

- Pulls sleep, readiness, activity, heart rate, and workout data from the Oura Cloud API.
- Creates pages named `ouraring/YYYY-MM-DD` with the header `#ouraring [[Month Do, YYYY]]`.
- Sections per page: **Sleep**, **Readiness**, **Activity**, **Heart rate**, and **Workouts** (omitted when empty).
- Syncs when the extension loads and through the command palette (`Oura: Sync daily data`) or the topbar button.

## Requirements

- Roam Research with extension support (Roam Depot or custom script loader).
- Oura personal access token with read access to your data.

## Configuration

Open `Roam Depot → Extension Settings → Oura Ring` and configure:

- **Oura Personal Access Token** – token generated in Oura Cloud → Personal Access Tokens.
- **Page Prefix** – prefix used in page names (default `ouraring`).
- **Days to Sync** – how many past days to fetch (includes today).
- **Enable Debug Logs** – show extra logs in the browser console.

 If the settings panel is unavailable, the extension creates a fallback page at `roam/js/ouraring` with the same fields.

## Usage

- **Automatic on load**: the extension fetches recent data each time it loads.
- **Manual sync**: click the topbar icon or run `Oura: Sync daily data` from the command palette.
- **Page layout**:
  - Title: `ouraring/YYYY-MM-DD`
  - First block: `#ouraring [[November 29th, 2025]]`
  - Children (only when data exists):
    - `Sleep`
    - `Readiness`
    - `Activity`
    - `Heart rate`
    - `Workouts` (one bullet per workout: `HH:MM – Activity (duration, calories, distance, …)`).

## Development

- `pnpm install`
- `pnpm build` to produce `dist/extension.js` for loading into Roam.
- Source entry point: `src/main.ts`.

Contributions are welcome via issues or pull requests.
