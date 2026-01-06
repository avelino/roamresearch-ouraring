/**
 * Utility functions shared across modules.
 */

/**
 * Checks if a value is a valid number (not null, undefined, or NaN).
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

/**
 * Converts a string to Title Case.
 * Handles snake_case, camelCase, and space-separated words.
 */
export function toTitleCase(text: string): string {
  return text
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(" ")
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Extracts date (YYYY-MM-DD) from an ISO timestamp string.
 * @param timestamp - ISO timestamp (e.g., "2025-10-29T14:30:00.000-03:00")
 */
export function extractDateFromTimestamp(timestamp?: string): string | undefined {
  if (!timestamp) return undefined;
  const match = timestamp.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : undefined;
}
