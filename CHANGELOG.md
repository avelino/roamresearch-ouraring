## [1.0.2](https://github.com/avelino/roamresearch-ouraring/compare/v1.0.1...v1.0.2) (2025-11-28)

### Bug Fixes

* prevent sync from blocking typing in Roam by yielding to browser main thread during block creation ([5314769](https://github.com/avelino/roamresearch-ouraring/commit/5314769b12e37677f724e6a2de6d50edbcb0fadd))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

* Oura Ring sync that creates `ouraring/YYYY-MM-DD` pages with `Sleep`, `Readiness`, `Activity`, `Heart rate`, and `Workouts` sections populated from the Oura Cloud API.
* CORS proxy support via `cors_proxy_url` setting to bypass browser CORS restrictions when calling Oura API. Default uses `corsproxy.io`.

### Changed

* Sync now runs on extension load or manual command instead of using a recurring schedule.

### Fixed

* Improved page rewrite flow to avoid duplicated blocks when refreshing Oura pages.

### Removed

* Todoist-specific sync logic and settings in favor of the dedicated Oura integration.

## [0.1.0] - 2025-11-27

### Added

* Initial release of Roam Todoist Backup extension
* Sync active and completed tasks from Todoist to Roam Research
* Dedicated page per task: `{pagePrefix}/{todoist-id}`
* Task properties stored as child blocks (id, due, status, labels, description)
* Optional comment sync with nested block structure
* Automatic sync scheduling with configurable interval
* Manual sync via command palette ("Todoist: Sync backup") and topbar button
* Title exclusion patterns (regex) to skip specific tasks
* Customizable status aliases (◼️ active, ✅ completed, ❌ deleted)
* Development mode with mock data when debug logs enabled
* Settings panel integration via Roam Depot
* Fallback config page (`roam/js/todoist-backup`) for legacy support
* Date formatting following Roam daily note pattern (`MMMM Do, YYYY`)
* Inline Todoist label conversion (`@label` → `#label`)
* Preserve completed tasks history during sync
* Respect Roam API rate limits (50ms mutation delay)

### Technical

* TypeScript with strict mode
* Vite bundler producing single `extension.js`
* ESLint with TypeScript support
* Modular architecture: `main.ts`, `todoist.ts`, `blocks.ts`, `settings.ts`, `scheduler.ts`, `ui.ts`, `logger.ts`, `constants.ts`
* Todoist REST API v2 and Sync API v9 integration
* Cursor-based pagination for REST endpoints
* Offset-based pagination for Sync API completed items

[Unreleased]: https://github.com/avelino/roamresearch-ouraring/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/avelino/roamresearch-ouraring/releases/tag/v0.1.0
