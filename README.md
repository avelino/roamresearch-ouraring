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
2. Load `dist-ouraring/extension.js` via Roam's custom script loader

## Configuration

Open **Roam Depot → Extension Settings → Oura Ring** and configure:

| Setting | Default | Description |
|---------|---------|-------------|
| **Oura Personal Access Token** | (empty) | Token from [Oura Cloud → Personal Access Tokens](https://cloud.ouraring.com/personal-access-tokens) |
| **Page Prefix** | `ouraring` | Prefix for daily pages (pages saved as `prefix/YYYY-MM-DD`) |
| **Days to Sync** | `7` | How many past days to fetch (includes today) |
| **Enable Debug Logs** | `false` | Show detailed logs in browser console |
| **CORS Proxy URL** | `https://corsproxy.io/?url=` | Proxy for API requests (see below) |

If the settings panel is unavailable, the extension creates a fallback config page at `roam/js/ouraring`.

## Why a CORS Proxy?

**The Oura API doesn't include CORS headers**, which means browsers block direct requests from web applications like Roam Research. This is a security feature called [Same-Origin Policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy).

To work around this limitation, this extension routes API requests through a CORS proxy that adds the necessary headers. The default proxy is [corsproxy.io](https://corsproxy.io), a free Cloudflare-powered service that works immediately without any setup.

### How it works

```
Roam (browser) → corsproxy.io → api.ouraring.com → response → corsproxy.io → Roam
```

The proxy forwards your request to Oura's API and returns the response with proper CORS headers, allowing the browser to process it.

### Security Considerations

- Your Oura token is sent through the proxy to authenticate with Oura's API
- corsproxy.io is open-source and Cloudflare-powered
- The proxy only forwards requests; it doesn't store or log your data
- If you prefer, you can deploy your own proxy (see below)

### Custom Proxy (Optional)

If you prefer full control over your data flow, deploy your own Cloudflare Worker:

1. Create a free account at [Cloudflare Workers](https://workers.cloudflare.com/)
2. Create a new Worker with this code:

```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (!targetUrl || !targetUrl.startsWith('https://api.ouraring.com/')) {
      return new Response('Invalid request', { status: 400 });
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
    });

    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  },
};
```

3. Deploy and update the extension setting to use your worker URL (format: `https://your-worker.workers.dev?url=`)

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

Output: `dist-ouraring/extension.js`

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Run `pnpm check` before submitting
4. Open a pull request

See [AGENTS.md](AGENTS.md) for development guidelines and code conventions.

## License

MIT
