# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-11-30

### Added

- Oura Ring sync that creates `ouraring/YYYY-MM-DD` pages with **Sleep**, **Readiness**, **Activity**, **Heart rate**, **Workouts**, and **Tags** sections populated from the Oura Cloud API v2.
- Default CORS proxy using [corsproxy.io](https://corsproxy.io) (Cloudflare-powered) – works out of the box without any setup. Configurable `proxy_url` setting allows users to use their own proxy if preferred.
- **Sleep**: Score, bedtime window, total sleep, time in bed, sleep stages (deep, REM, light, awake), efficiency, latency, restless periods, average HR/HRV, and contributors breakdown.
- **Readiness**: Score, temperature deviation/trend, and contributors breakdown.
- **Activity**: Score, steps, daily movement, distance, calories (active/total/target), activity time breakdown (high/medium/low/sedentary/resting/non-wear), MET metrics, and goal tracking.
- **Heart rate**: Average, minimum, and maximum BPM summary from all samples.
- **Workouts**: Activity name, duration, calories, distance, intensity, and source.
- **Tags**: Support for `/enhanced_tag` endpoint with custom names, tag arrays, timestamps, and comments.
- Batch fetching: Data is fetched in batches of up to 7 days per API request for efficiency.
- Sync on extension load and via command palette (`Oura: Sync daily data`) or topbar button.
- Settings panel integration via Roam Depot with fallback config page (`roam/js/ouraring`).
- Non-blocking sync: Uses `yieldToMain()` during block creation to prevent UI freezing.

### Technical

- TypeScript with strict mode.
- Vite bundler producing single `extension.js`.
- ESLint with TypeScript support.
- Modular architecture: `main.ts`, `ouraring.ts`, `blocks.ts`, `settings.ts`, `ui.ts`, `logger.ts`, `constants.ts`.
- Oura Cloud API v2 integration with cursor-based pagination.
- CORS proxy URL encoding for corsproxy.io compatibility.

[Unreleased]: https://github.com/avelino/roamresearch-ouraring/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/avelino/roamresearch-ouraring/releases/tag/v1.0.0
