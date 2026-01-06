/**
 * Formatting functions for displaying Oura data in Roam blocks.
 */

import { isValidNumber, toTitleCase } from "./utils";

/**
 * Formats a number with optional suffix.
 */
export function formatNumber(value?: number | null, suffix?: string): string | undefined {
  if (!isValidNumber(value)) return undefined;
  return suffix ? `${value} ${suffix}` : `${value}`;
}

/**
 * Formats a number as percentage.
 */
export function formatPercentage(value?: number | null): string | undefined {
  if (!isValidNumber(value)) return undefined;
  return `${value}%`;
}

/**
 * Formats heart rate with average and minimum values.
 */
export function formatHeartRate(avg?: number | null, min?: number | null): string | undefined {
  if (!isValidNumber(avg) && !isValidNumber(min)) return undefined;
  const parts: string[] = [];
  if (isValidNumber(avg)) parts.push(`${avg} bpm avg`);
  if (isValidNumber(min)) parts.push(`min ${min}`);
  return parts.join(" / ");
}

/**
 * Formats bedtime range from start to end timestamps.
 */
export function formatBedtime(start?: string, end?: string): string | undefined {
  if (!start && !end) return undefined;
  const startLabel = start ? formatTime(start) : "";
  const endLabel = end ? formatTime(end) : "";
  return `${startLabel}${startLabel && endLabel ? " – " : ""}${endLabel}`;
}

/**
 * Formats distance in kilometers from meters.
 */
export function formatDistance(meters?: number | null): string | undefined {
  if (!isValidNumber(meters)) return undefined;
  const km = meters / 1000;
  return `${km.toFixed(2)} km`;
}

/**
 * Formats temperature deviation with sign.
 */
export function formatTemperature(deviation?: number | null): string | undefined {
  if (!isValidNumber(deviation)) return undefined;
  const sign = deviation >= 0 ? "+" : "";
  return `${sign}${deviation.toFixed(2)}°C`;
}

/**
 * Formats seconds into human-readable duration (e.g., "2h 30m").
 */
export function formatMinutesFromSeconds(seconds?: number | null): string | undefined {
  if (!isValidNumber(seconds)) return undefined;
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * Formats an ISO timestamp to local time (HH:MM).
 */
export function formatTime(value?: string): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Formats a timestamp from ISO format to local time.
 */
export function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Extracts time (HH:MM) from a time string like "HH:MM:SS" or "HH:MM:SS+00:00".
 */
export function formatTagTime(timeStr?: string): string {
  if (!timeStr) return "";
  const match = timeStr.match(/^(\d{2}):(\d{2})/);
  if (!match) return "";
  return `${match[1]}:${match[2]}`;
}

/**
 * Formats a YYYY-MM-DD date into Roam daily note format (e.g., "November 29th, 2025").
 */
export function formatDailyNoteDate(date: string): string {
  const [year, month, day] = date.split("-").map((part) => parseInt(part, 10));
  const parsedDate = new Date(year, month - 1, day);
  const monthName = parsedDate.toLocaleString("en", { month: "long" });
  const dayWithOrdinal = formatOrdinal(day);
  return `${monthName} ${dayWithOrdinal}, ${year}`;
}

/**
 * Formats a day number with ordinal suffix (1st, 2nd, 3rd, 4th, etc.).
 */
export function formatOrdinal(day: number): string {
  const remainder = day % 100;
  if (remainder >= 11 && remainder <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/**
 * Calculates duration between two ISO timestamps and formats it.
 */
export function calculateDuration(start?: string, end?: string): string | undefined {
  if (!start || !end) return undefined;
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return undefined;
  return formatMinutesFromSeconds(Math.max(0, (endTime - startTime) / 1000));
}

/**
 * Formats an activity name from snake_case or camelCase to Title Case.
 */
export function formatActivityName(activity: string): string {
  return toTitleCase(activity);
}

/**
 * Formats a tag type code to a readable name.
 * Removes "tag_" and "generic_" prefixes and converts to Title Case.
 */
export function formatTagType(code?: string): string {
  if (!code) return "Tag";
  const cleaned = code.replace(/^tag_(generic_)?/, "").replace(/_/g, " ");
  return toTitleCase(cleaned);
}
