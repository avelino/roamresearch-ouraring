import { OURA_API_BASE } from "./constants";
import { logDebug, logError, logInfo } from "./logger";

/**
 * Sleep contributors breakdown from Oura API.
 * Contains individual scores for each sleep quality factor.
 */
export interface OuraSleepContributors {
  deep_sleep?: number;
  efficiency?: number;
  latency?: number;
  rem_sleep?: number;
  restfulness?: number;
  timing?: number;
  total_sleep?: number;
}

/**
 * Daily sleep data from /daily_sleep endpoint.
 * Based on Oura API v2 and training-personal-data Clojure implementation.
 */
export interface OuraSleep {
  id?: string;
  day: string;
  score?: number;
  timestamp?: string;
  contributors?: OuraSleepContributors;
  // Direct fields (some APIs return these directly)
  efficiency?: number;
  total_sleep_duration?: number;
  time_in_bed?: number;
  average_hr?: number;
  lowest_hr?: number;
  bedtime_start?: string;
  bedtime_end?: string;
  // Additional fields from API
  awake_time?: number;
  deep_sleep_duration?: number;
  light_sleep_duration?: number;
  rem_sleep_duration?: number;
  restless_periods?: number;
  average_hrv?: number;
  latency?: number;
  [key: string]: unknown;
}

/**
 * Readiness contributors breakdown from Oura API.
 */
export interface OuraReadinessContributors {
  activity_balance?: number;
  body_temperature?: number;
  hrv_balance?: number;
  previous_day_activity?: number;
  previous_night?: number;
  recovery_index?: number;
  resting_heart_rate?: number;
  sleep_balance?: number;
}

/**
 * Daily readiness data from /daily_readiness endpoint.
 * Based on Oura API v2 and training-personal-data Clojure implementation.
 */
export interface OuraReadiness {
  id?: string;
  day: string;
  score?: number;
  timestamp?: string;
  temperature_deviation?: number;
  temperature_trend_deviation?: number;
  contributors?: OuraReadinessContributors;
  // Legacy score fields (some APIs return these)
  score_activity_balance?: number;
  score_sleep_balance?: number;
  score_previous_day?: number;
  score_previous_night?: number;
  score_recovery_index?: number;
  score_resting_hr?: number;
  score_hrv_balance?: number;
  [key: string]: unknown;
}

/**
 * Daily activity data from /daily_activity endpoint.
 * Based on Oura API v2 and training-personal-data Clojure implementation.
 */
export interface OuraActivity {
  id?: string;
  day: string;
  score?: number;
  timestamp?: string;
  // Movement metrics
  steps?: number;
  daily_movement?: number;
  equivalent_walking_distance?: number;
  // Calorie metrics
  active_calories?: number;
  total_calories?: number;
  target_calories?: number;
  // Activity time breakdown
  high_activity_time?: number;
  medium_activity_time?: number;
  low_activity_time?: number;
  sedentary_time?: number;
  resting_time?: number;
  non_wear_time?: number;
  // MET (Metabolic Equivalent) metrics
  average_met_minutes?: number;
  high_activity_met_minutes?: number;
  medium_activity_met_minutes?: number;
  low_activity_met_minutes?: number;
  sedentary_met_minutes?: number;
  // Goals
  meters_to_target?: number;
  target_meters?: number;
  inactivity_alerts?: number;
  // Detailed data (arrays)
  class_5_min?: string;
  met?: { interval?: number; items?: number[]; timestamp?: string };
  [key: string]: unknown;
}

/**
 * Heart rate sample from /heartrate endpoint.
 */
export interface OuraHeartRateSample {
  bpm?: number;
  source?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Workout data from /workout endpoint.
 * Based on Oura API v2 and training-personal-data Clojure implementation.
 */
export interface OuraWorkout {
  id?: string;
  day?: string;
  activity?: string;
  sport?: string;
  label?: string;
  start_datetime?: string;
  end_datetime?: string;
  calories?: number;
  distance?: number;
  intensity?: string;
  source?: string;
  [key: string]: unknown;
}

/**
 * Enhanced tag data from /enhanced_tag endpoint.
 * Note: /tag endpoint is deprecated, using only /enhanced_tag.
 */
export interface OuraTag {
  id?: string;
  day?: string;
  start_day?: string;
  end_day?: string;
  start_time?: string;
  end_time?: string;
  tag_type_code?: string;
  custom_name?: string;
  comment?: string;
  timestamp?: string;
  text?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface DailyOuraData {
  date: string;
  sleep: OuraSleep[];
  readiness: OuraReadiness[];
  activity: OuraActivity[];
  heartrate: OuraHeartRateSample[];
  workouts: OuraWorkout[];
  tags: OuraTag[];
}

/**
 * Raw batch data from Oura API (before grouping by date).
 */
interface BatchOuraData {
  sleep: OuraSleep[];
  readiness: OuraReadiness[];
  activity: OuraActivity[];
  heartrate: OuraHeartRateSample[];
  workouts: OuraWorkout[];
  tags: OuraTag[];
}

interface CollectionResponse<T> {
  data?: T[];
  next_token?: string;
}

/** Maximum days per API request to avoid issues with single-day queries */
const MAX_DAYS_PER_REQUEST = 7;

/**
 * Splits an array of dates into chunks of maximum size.
 * @param dates - Array of date strings (YYYY-MM-DD)
 * @param maxSize - Maximum chunk size (default: 7)
 */
export function splitDatesIntoChunks(dates: string[], maxSize: number = MAX_DAYS_PER_REQUEST): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < dates.length; i += maxSize) {
    chunks.push(dates.slice(i, i + maxSize));
  }
  return chunks;
}

/**
 * Fetches all Oura data for a date range in batch (up to 7 days per request).
 * This is more efficient than fetching day by day and avoids API issues with single-day queries.
 * @param token - Oura Personal Access Token
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param proxyUrl - CORS proxy URL to route requests through
 */
export async function fetchBatchData(
  token: string,
  startDate: string,
  endDate: string,
  proxyUrl: string
): Promise<BatchOuraData> {
  logDebug("fetch_batch_start", { startDate, endDate });

  const [sleep, readiness, activity, workouts, heartrate, tags] = await Promise.all([
    fetchCollection<OuraSleep>("/daily_sleep", { start_date: startDate, end_date: endDate }, token, proxyUrl),
    fetchCollection<OuraReadiness>("/daily_readiness", { start_date: startDate, end_date: endDate }, token, proxyUrl),
    fetchCollection<OuraActivity>("/daily_activity", { start_date: startDate, end_date: endDate }, token, proxyUrl),
    fetchCollection<OuraWorkout>("/workout", { start_date: startDate, end_date: endDate }, token, proxyUrl),
    fetchCollection<OuraHeartRateSample>(
      "/heartrate",
      {
        start_datetime: `${startDate}T00:00:00Z`,
        end_datetime: `${endDate}T23:59:59Z`,
      },
      token,
      proxyUrl
    ),
    // Note: /tag endpoint is deprecated, using only /enhanced_tag
    fetchCollection<OuraTag>("/enhanced_tag", { start_date: startDate, end_date: endDate }, token, proxyUrl),
  ]);

  logDebug("fetch_batch_complete", {
    startDate,
    endDate,
    sleep: sleep.length,
    readiness: readiness.length,
    activity: activity.length,
    workouts: workouts.length,
    heartrate: heartrate.length,
    tags: tags.length,
  });

  return { sleep, readiness, activity, heartrate, workouts, tags };
}

/**
 * Groups batch data by date, creating DailyOuraData for each requested date.
 * @param batchData - Raw batch data from API
 * @param dates - Array of dates to group by (YYYY-MM-DD)
 */
export function groupDataByDate(batchData: BatchOuraData, dates: string[]): Map<string, DailyOuraData> {
  const result = new Map<string, DailyOuraData>();

  // Initialize empty data for each date
  for (const date of dates) {
    result.set(date, {
      date,
      sleep: [],
      readiness: [],
      activity: [],
      heartrate: [],
      workouts: [],
      tags: [],
    });
  }

  // Group sleep by day
  for (const item of batchData.sleep) {
    const data = result.get(item.day);
    if (data) data.sleep.push(item);
  }

  // Group readiness by day
  for (const item of batchData.readiness) {
    const data = result.get(item.day);
    if (data) data.readiness.push(item);
  }

  // Group activity by day
  for (const item of batchData.activity) {
    const data = result.get(item.day);
    if (data) data.activity.push(item);
  }

  // Group workouts by day
  for (const item of batchData.workouts) {
    const day = item.day ?? extractDateFromTimestamp(item.start_datetime);
    if (day) {
      const data = result.get(day);
      if (data) data.workouts.push(item);
    }
  }

  // Group heart rate by timestamp date
  for (const item of batchData.heartrate) {
    const day = extractDateFromTimestamp(item.timestamp);
    if (day) {
      const data = result.get(day);
      if (data) data.heartrate.push(item);
    }
  }

  // Group tags by day (use start_day or day field)
  for (const item of batchData.tags) {
    const day = item.start_day ?? item.day ?? extractDateFromTimestamp(item.timestamp);
    if (day) {
      const data = result.get(day);
      if (data) data.tags.push(item);
    }
  }

  return result;
}

/**
 * Extracts date (YYYY-MM-DD) from an ISO timestamp string.
 * @param timestamp - ISO timestamp (e.g., "2025-10-29T14:30:00.000-03:00")
 */
function extractDateFromTimestamp(timestamp?: string): string | undefined {
  if (!timestamp) return undefined;
  const match = timestamp.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : undefined;
}

/**
 * Fetches all Oura data for multiple dates, using batch requests (max 7 days each).
 * This is the main entry point for fetching Oura data.
 * @param token - Oura Personal Access Token
 * @param dates - Array of dates to fetch (YYYY-MM-DD), most recent first
 * @param proxyUrl - CORS proxy URL to route requests through
 */
export async function fetchAllDailyData(
  token: string,
  dates: string[],
  proxyUrl: string
): Promise<Map<string, DailyOuraData>> {
  if (dates.length === 0) {
    return new Map();
  }

  // Sort dates to find min/max for each chunk
  const sortedDates = [...dates].sort();
  const chunks = splitDatesIntoChunks(sortedDates);

  logDebug("fetch_all_start", { totalDates: dates.length, chunks: chunks.length });

  const allResults = new Map<string, DailyOuraData>();

  for (const chunk of chunks) {
    const startDate = chunk[0];
    const endDate = chunk[chunk.length - 1];

    const batchData = await fetchBatchData(token, startDate, endDate, proxyUrl);
    const groupedData = groupDataByDate(batchData, chunk);

    // Merge into results
    for (const [date, data] of groupedData) {
      allResults.set(date, data);
    }
  }

  logDebug("fetch_all_complete", { totalDates: allResults.size });

  return allResults;
}

/**
 * Builds the proxied URL for corsproxy.io or similar CORS proxies.
 * corsproxy.io format: https://corsproxy.io/?url={encoded_url}
 * @param proxyUrl - The proxy base URL (e.g., "https://corsproxy.io/?url=")
 * @param targetUrl - The target URL to proxy
 */
function buildProxiedUrl(proxyUrl: string, targetUrl: string): string {
  // corsproxy.io expects: https://corsproxy.io/?url={encoded_url}
  // If proxy ends with "=" we just append the encoded URL (corsproxy.io style)
  // Otherwise we append ?url= for custom proxies
  if (proxyUrl.endsWith("=")) {
    return `${proxyUrl}${encodeURIComponent(targetUrl)}`;
  }
  return `${proxyUrl}?url=${encodeURIComponent(targetUrl)}`;
}

/**
 * Fetches a paginated collection from the Oura API.
 * Routes requests through the CORS proxy (default: corsproxy.io).
 * @param path - API endpoint path (e.g., "/daily_sleep")
 * @param params - Query parameters
 * @param token - Oura Personal Access Token
 * @param proxyUrl - CORS proxy URL (default: corsproxy.io)
 */
async function fetchCollection<T>(
  path: string,
  params: Record<string, string>,
  token: string,
  proxyUrl: string
): Promise<T[]> {
  const allItems: T[] = [];
  let nextToken: string | undefined;

  do {
    const searchParams = new URLSearchParams(params);
    if (nextToken) {
      searchParams.set("next_token", nextToken);
    }
    const ouraUrl = `${OURA_API_BASE}${path}?${searchParams.toString()}`;
    const fetchUrl = buildProxiedUrl(proxyUrl, ouraUrl);

    logDebug("fetch_request", { url: fetchUrl, ouraUrl });

    const response = await fetch(fetchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      logError("oura_api_error", { url: fetchUrl, status: response.status, body });
      throw new Error(`Oura API request failed (${response.status})`);
    }

    const json = (await response.json()) as CollectionResponse<T>;

    // Log raw response for tag endpoints to help debug missing tags
    if (path.includes("tag")) {
      logDebug("tag_api_raw_response", { path, response: json });
    }

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
