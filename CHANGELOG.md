# [1.2.0](https://github.com/avelino/roamresearch-ouraring/compare/v1.1.0...v1.2.0) (2025-12-13)


### Features

* **constants:** update topbar icon to 'ring' for Oura branding ([11c3ce5](https://github.com/avelino/roamresearch-ouraring/commit/11c3ce516fc53a42ab4c7f56c394f7b3017060b0))

# [1.1.0](https://github.com/avelino/roamresearch-ouraring/compare/v1.0.0...v1.1.0) (2025-12-13)


### Features

* use Roam native CORS proxy and add build.sh for Roam Depot ([6f2becf](https://github.com/avelino/roamresearch-ouraring/commit/6f2becfb44fa0b5c624bdd77a65178fd5ec1eaa1))

# 1.0.0 (2025-11-30)

### Bug Fixes

* interpret ISO date-only (YYYY-MM-DD) values as local time in formatDisplayDate ([1005f9c](https://github.com/avelino/roamresearch-ouraring/commit/1005f9ce1f148e5c7483149227057fd797e60352))
* prevent sync from blocking typing in Roam by yielding to browser main thread during block creation ([5314769](https://github.com/avelino/roamresearch-ouraring/commit/5314769b12e37677f724e6a2de6d50edbcb0fadd))
* **settings:** increase MUTATION_DELAY_MS from 50ms to 100ms for safer Roam API throttling ([8deed71](https://github.com/avelino/roamresearch-ouraring/commit/8deed714b4d1c1ac05e81192e03d6a5ecfcd4349))

### Features

* **blocks.ts:** add `buildHeaderText` for correct page header with inline scores ([a4db32b](https://github.com/avelino/roamresearch-ouraring/commit/a4db32b7b7e2c2354cbaed8ea13cb04db2015046))
* create Roam Oura Ring extension for Roam Research ([1da5e9e](https://github.com/avelino/roamresearch-ouraring/commit/1da5e9e32f8fefa100314c8898a75c7696ae57cd))
* initial release of Oura Ring → Roam Research extension ([df923c4](https://github.com/avelino/roamresearch-ouraring/commit/df923c49fb3579c5132a530f6ba153c791853725))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

* Header block now displays sleep and readiness scores inline: `#ouraring [[Date]] sleep: X / readiness: Y` for quick overview without expanding sections.
* Switched from external CORS proxy (corsproxy.io) to Roam's native CORS proxy (`roamAlphaAPI.constants.corsAnywhereProxyUrl`). This simplifies setup and removes the need for a configurable proxy URL setting.
* Changed topbar icon from `heart` to `ring` to better represent the Oura Ring product.

### Added

* Added `build.sh` script for Roam Depot GitHub Action compatibility.

### Removed

* Removed `proxy_url` setting – the extension now automatically uses Roam's built-in CORS proxy, which is more reliable and requires no configuration.

## [1.0.0] - 2025-11-30

### Added

* Oura Ring sync that creates `ouraring/YYYY-MM-DD` pages with **Sleep**, **Readiness**, **Activity**, **Heart rate**, **Workouts**, and **Tags** sections populated from the Oura Cloud API v2.
* Default CORS proxy using [corsproxy.io](https://corsproxy.io) (Cloudflare-powered) – works out of the box without any setup. Configurable `proxy_url` setting allows users to use their own proxy if preferred.
* **Sleep**: Score, bedtime window, total sleep, time in bed, sleep stages (deep, REM, light, awake), efficiency, latency, restless periods, average HR/HRV, and contributors breakdown.
* **Readiness**: Score, temperature deviation/trend, and contributors breakdown.
* **Activity**: Score, steps, daily movement, distance, calories (active/total/target), activity time breakdown (high/medium/low/sedentary/resting/non-wear), MET metrics, and goal tracking.
* **Heart rate**: Average, minimum, and maximum BPM summary from all samples.
* **Workouts**: Activity name, duration, calories, distance, intensity, and source.
* **Tags**: Support for `/enhanced_tag` endpoint with custom names, tag arrays, timestamps, and comments.
* Batch fetching: Data is fetched in batches of up to 7 days per API request for efficiency.
* Sync on extension load and via command palette (`Oura: Sync daily data`) or topbar button.
* Settings panel integration via Roam Depot with fallback config page (`roam/js/ouraring`).
* Non-blocking sync: Uses `yieldToMain()` during block creation to prevent UI freezing.

### Technical

* TypeScript with strict mode.
* Vite bundler producing single `extension.js`.
* ESLint with TypeScript support.
* Modular architecture: `main.ts`, `ouraring.ts`, `blocks.ts`, `settings.ts`, `ui.ts`, `logger.ts`, `constants.ts`.
* Oura Cloud API v2 integration with cursor-based pagination.
* CORS proxy URL encoding for corsproxy.io compatibility.

[Unreleased]: https://github.com/avelino/roamresearch-ouraring/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/avelino/roamresearch-ouraring/releases/tag/v1.0.0
