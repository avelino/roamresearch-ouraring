import { OURA_API_BASE } from "./constants";
import { logDebug, logError, logInfo } from "./logger";

export interface OuraSleep {
  day: string;
  score?: number;
  efficiency?: number;
  total_sleep_duration?: number;
  time_in_bed?: number;
  average_hr?: number;
  lowest_hr?: number;
  bedtime_start?: string;
  bedtime_end?: string;
  [key: string]: unknown;
}

export interface OuraReadiness {
  day: string;
  score?: number;
  score_activity_balance?: number;
  score_sleep_balance?: number;
  score_previous_day?: number;
  score_previous_night?: number;
  score_recovery_index?: number;
  score_resting_hr?: number;
  score_hrv_balance?: number;
  [key: string]: unknown;
}

export interface OuraActivity {
  day: string;
  score?: number;
  steps?: number;
  daily_movement?: number;
  non_wear_time?: number;
  active_calories?: number;
  total_calories?: number;
  equivalent_walking_distance?: number;
  high_activity_time?: number;
  medium_activity_time?: number;
  low_activity_time?: number;
  inactivity_alerts?: number;
  [key: string]: unknown;
}

export interface OuraHeartRateSample {
  bpm?: number;
  source?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface OuraWorkout {
  id?: string;
  start_datetime?: string;
  end_datetime?: string;
  sport?: string;
  calories?: number;
  distance?: number;
  intensity?: string;
  [key: string]: unknown;
}

export interface DailyOuraData {
  date: string;
  sleep: OuraSleep[];
  readiness: OuraReadiness[];
  activity: OuraActivity[];
  heartrate: OuraHeartRateSample[];
  workouts: OuraWorkout[];
}

interface CollectionResponse<T> {
  data?: T[];
  next_token?: string;
}

/**
 * Fetches all Oura data for a given date (sleep, readiness, activity, workouts, heart rate).
 * @param token - Oura Personal Access Token
 * @param date - ISO date string (YYYY-MM-DD)
 * @param corsProxyUrl - Optional CORS proxy URL prefix (e.g., "https://corsproxy.io/?")
 */
export async function fetchDailyData(token: string, date: string, corsProxyUrl?: string): Promise<DailyOuraData> {
  const [sleep, readiness, activity, workouts, heartrate] = await Promise.all([
    fetchCollection<OuraSleep>("/daily_sleep", { start_date: date, end_date: date }, token, corsProxyUrl),
    fetchCollection<OuraReadiness>("/daily_readiness", { start_date: date, end_date: date }, token, corsProxyUrl),
    fetchCollection<OuraActivity>("/daily_activity", { start_date: date, end_date: date }, token, corsProxyUrl),
    fetchCollection<OuraWorkout>("/workout", { start_date: date, end_date: date }, token, corsProxyUrl),
    fetchCollection<OuraHeartRateSample>(
      "/heartrate",
      {
        start_datetime: `${date}T00:00:00Z`,
        end_datetime: `${date}T23:59:59Z`,
      },
      token,
      corsProxyUrl
    ),
  ]);

  logDebug("fetch_daily_data", {
    date,
    sleep: sleep.length,
    readiness: readiness.length,
    activity: activity.length,
    workouts: workouts.length,
    heartrate: heartrate.length,
  });

  return { date, sleep, readiness, activity, heartrate, workouts };
}

/**
 * Builds the final URL, optionally wrapping with CORS proxy.
 * @param baseUrl - The original API URL
 * @param corsProxyUrl - Optional CORS proxy prefix (e.g., "https://corsproxy.io/?")
 *
 * Proxy URL formats supported:
 * - "https://corsproxy.io/?" → appends URL directly (no encoding)
 * - "https://api.allorigins.win/raw?url=" → appends URL encoded
 */
function buildProxiedUrl(baseUrl: string, corsProxyUrl?: string): string {
  if (!corsProxyUrl || corsProxyUrl.trim() === "") {
    return baseUrl;
  }
  // Proxies ending with "?url=" expect encoded URL, others expect raw URL
  const needsEncoding = corsProxyUrl.includes("?url=");
  return `${corsProxyUrl}${needsEncoding ? encodeURIComponent(baseUrl) : baseUrl}`;
}

async function fetchCollection<T>(
  path: string,
  params: Record<string, string>,
  token: string,
  corsProxyUrl?: string
): Promise<T[]> {
  const allItems: T[] = [];
  let nextToken: string | undefined;

  do {
    const searchParams = new URLSearchParams(params);
    if (nextToken) {
      searchParams.set("next_token", nextToken);
    }
    const originalUrl = `${OURA_API_BASE}${path}?${searchParams.toString()}`;
    const url = buildProxiedUrl(originalUrl, corsProxyUrl);

    logDebug("fetch_request", { originalUrl, proxied: url !== originalUrl });

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      logError("oura_api_error", { url: originalUrl, status: response.status, body });
      throw new Error(`Oura API request failed (${response.status})`);
    }

    const json = (await response.json()) as CollectionResponse<T>;
    const items = Array.isArray(json.data) ? json.data : [];
    allItems.push(...items);
    nextToken = json.next_token;
    logInfo("oura_page_fetched", { path, count: items.length, nextToken });
  } while (nextToken);

  return allItems;
}

export function formatMinutesFromSeconds(seconds?: number): string | undefined {
  if (seconds === undefined || Number.isNaN(seconds)) return undefined;
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

export function summarizeHeartRate(samples: OuraHeartRateSample[]): {
  min?: number;
  max?: number;
  average?: number;
} {
  const values = samples.map((sample) => sample.bpm).filter((value): value is number => typeof value === "number");
  if (values.length === 0) {
    return {};
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  return { min, max, average };
}
