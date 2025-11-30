import {
  createBlock,
  createPage,
  deleteBlock,
  getBasicTreeByParentUid,
  getPageUidByPageTitle,
  type InputTextNode,
} from "./settings";
import { DEFAULT_PAGE_PREFIX, ISO_DATE_PATTERN } from "./constants";
import { logDebug, logWarn } from "./logger";
import {
  DailyOuraData,
  formatMinutesFromSeconds,
  OuraActivity,
  OuraHeartRateSample,
  OuraReadiness,
  OuraSleep,
  OuraTag,
  OuraWorkout,
  summarizeHeartRate,
} from "./ouraring";

export async function writeDailyOuraPage(prefix: string, data: DailyOuraData): Promise<void> {
  if (!ISO_DATE_PATTERN.test(data.date)) {
    logWarn("invalid_date", { date: data.date });
    return;
  }

  const pageTitle = `${prefix || DEFAULT_PAGE_PREFIX}/${data.date}`;
  const header = buildHeaderText(data);

  const pageUid = (getPageUidByPageTitle(pageTitle)) ?? (await createPage({
    title: pageTitle,
    tree: [buildHeaderNode(header, data)],
  }));

  const current = getBasicTreeByParentUid(pageUid);
  await replacePageContent(pageUid, header, data, current);
}

async function replacePageContent(
  pageUid: string,
  header: string,
  data: DailyOuraData,
  current: Array<{ uid: string }>
): Promise<void> {
  for (const node of current) {
    await deleteBlock(node.uid);
  }

  const headerNode = buildHeaderNode(header, data);
  await createBlock({ parentUid: pageUid, order: 0, node: headerNode });
  logDebug("page_written", { pageUid, date: data.date });
}

function buildHeaderText(data: DailyOuraData): string {
  const dateStr = formatDailyNoteDate(data.date);
  const sleepScore = data.sleep.length > 0 ? data.sleep[0].score : undefined;
  const readinessScore = data.readiness.length > 0 ? data.readiness[0].score : undefined;

  const scoreParts: string[] = [];
  if (sleepScore !== undefined) scoreParts.push(`sleep: ${sleepScore}`);
  if (readinessScore !== undefined) scoreParts.push(`readiness: ${readinessScore}`);

  const scoresSuffix = scoreParts.length > 0 ? ` ${scoreParts.join(" / ")}` : "";
  return `#ouraring [[${dateStr}]]${scoresSuffix}`;
}

function buildHeaderNode(header: string, data: DailyOuraData): InputTextNode {
  const children: InputTextNode[] = [];

  const sleepNode = buildSleepNode(data.sleep);
  if (sleepNode) children.push(sleepNode);

  const readinessNode = buildReadinessNode(data.readiness);
  if (readinessNode) children.push(readinessNode);

  const activityNode = buildActivityNode(data.activity);
  if (activityNode) children.push(activityNode);

  const hrNode = buildHeartRateNode(data.heartrate);
  if (hrNode) children.push(hrNode);

  const workoutsNode = buildWorkoutsNode(data.workouts);
  if (workoutsNode) children.push(workoutsNode);

  const tagsNode = buildTagsNode(data.tags);
  if (tagsNode) children.push(tagsNode);

  return {
    text: header,
    children,
  };
}

function buildSleepNode(sessions: OuraSleep[]): InputTextNode | null {
  if (sessions.length === 0) return null;
  const primary = sessions[0];
  const rows: InputTextNode[] = [];

  // Main score and timing
  pushIfValue(rows, "Score", formatNumber(primary.score));
  pushIfValue(rows, "Bedtime", formatBedtime(primary.bedtime_start, primary.bedtime_end));
  pushIfValue(rows, "Total sleep", formatMinutesFromSeconds(primary.total_sleep_duration));
  pushIfValue(rows, "Time in bed", formatMinutesFromSeconds(primary.time_in_bed));

  // Sleep stages
  pushIfValue(rows, "Deep sleep", formatMinutesFromSeconds(primary.deep_sleep_duration));
  pushIfValue(rows, "REM sleep", formatMinutesFromSeconds(primary.rem_sleep_duration));
  pushIfValue(rows, "Light sleep", formatMinutesFromSeconds(primary.light_sleep_duration));
  pushIfValue(rows, "Awake time", formatMinutesFromSeconds(primary.awake_time));

  // Quality metrics
  pushIfValue(rows, "Efficiency", formatPercentage(primary.efficiency));
  pushIfValue(rows, "Latency", formatMinutesFromSeconds(primary.latency));
  pushIfValue(rows, "Restless periods", formatNumber(primary.restless_periods));

  // Heart metrics
  pushIfValue(rows, "Avg HR", formatHeartRate(primary.average_hr, primary.lowest_hr));
  pushIfValue(rows, "Avg HRV", formatNumber(primary.average_hrv, "ms"));

  // Contributors (if available)
  if (primary.contributors) {
    const c = primary.contributors;
    const contributorsNode: InputTextNode = { text: "Contributors", children: [] };
    pushIfValue(contributorsNode.children!, "Deep sleep", formatNumber(c.deep_sleep));
    pushIfValue(contributorsNode.children!, "Efficiency", formatNumber(c.efficiency));
    pushIfValue(contributorsNode.children!, "Latency", formatNumber(c.latency));
    pushIfValue(contributorsNode.children!, "REM sleep", formatNumber(c.rem_sleep));
    pushIfValue(contributorsNode.children!, "Restfulness", formatNumber(c.restfulness));
    pushIfValue(contributorsNode.children!, "Timing", formatNumber(c.timing));
    pushIfValue(contributorsNode.children!, "Total sleep", formatNumber(c.total_sleep));
    if (contributorsNode.children!.length > 0) {
      rows.push(contributorsNode);
    }
  }

  return rows.length > 0 ? { text: "Sleep", children: rows } : null;
}

function buildReadinessNode(entries: OuraReadiness[]): InputTextNode | null {
  if (entries.length === 0) return null;
  const primary = entries[0];
  const rows: InputTextNode[] = [];

  // Main score
  pushIfValue(rows, "Score", formatNumber(primary.score));

  // Temperature metrics
  pushIfValue(rows, "Temperature deviation", formatTemperature(primary.temperature_deviation));
  pushIfValue(rows, "Temperature trend", formatTemperature(primary.temperature_trend_deviation));

  // Legacy score fields (for APIs that return these directly)
  pushIfValue(rows, "Activity balance", formatNumber(primary.score_activity_balance));
  pushIfValue(rows, "Sleep balance", formatNumber(primary.score_sleep_balance));
  pushIfValue(rows, "Previous day", formatNumber(primary.score_previous_day));
  pushIfValue(rows, "Recovery index", formatNumber(primary.score_recovery_index));
  pushIfValue(rows, "Resting HR", formatNumber(primary.score_resting_hr));
  pushIfValue(rows, "HRV balance", formatNumber(primary.score_hrv_balance));

  // Contributors (if available)
  if (primary.contributors) {
    const c = primary.contributors;
    const contributorsNode: InputTextNode = { text: "Contributors", children: [] };
    pushIfValue(contributorsNode.children!, "Activity balance", formatNumber(c.activity_balance));
    pushIfValue(contributorsNode.children!, "Body temperature", formatNumber(c.body_temperature));
    pushIfValue(contributorsNode.children!, "HRV balance", formatNumber(c.hrv_balance));
    pushIfValue(contributorsNode.children!, "Previous day activity", formatNumber(c.previous_day_activity));
    pushIfValue(contributorsNode.children!, "Previous night", formatNumber(c.previous_night));
    pushIfValue(contributorsNode.children!, "Recovery index", formatNumber(c.recovery_index));
    pushIfValue(contributorsNode.children!, "Resting heart rate", formatNumber(c.resting_heart_rate));
    pushIfValue(contributorsNode.children!, "Sleep balance", formatNumber(c.sleep_balance));
    if (contributorsNode.children!.length > 0) {
      rows.push(contributorsNode);
    }
  }

  return rows.length > 0 ? { text: "Readiness", children: rows } : null;
}

function buildActivityNode(entries: OuraActivity[]): InputTextNode | null {
  if (entries.length === 0) return null;
  const primary = entries[0];
  const rows: InputTextNode[] = [];

  // Main score
  pushIfValue(rows, "Score", formatNumber(primary.score));

  // Movement metrics
  pushIfValue(rows, "Steps", formatNumber(primary.steps));
  pushIfValue(rows, "Daily movement", formatDistance(primary.daily_movement));
  pushIfValue(rows, "Distance", formatDistance(primary.equivalent_walking_distance));

  // Calorie metrics
  pushIfValue(rows, "Active calories", formatNumber(primary.active_calories, "kcal"));
  pushIfValue(rows, "Total calories", formatNumber(primary.total_calories, "kcal"));
  pushIfValue(rows, "Target calories", formatNumber(primary.target_calories, "kcal"));

  // Activity time breakdown
  pushIfValue(rows, "High activity", formatMinutesFromSeconds(primary.high_activity_time));
  pushIfValue(rows, "Medium activity", formatMinutesFromSeconds(primary.medium_activity_time));
  pushIfValue(rows, "Low activity", formatMinutesFromSeconds(primary.low_activity_time));
  pushIfValue(rows, "Sedentary time", formatMinutesFromSeconds(primary.sedentary_time));
  pushIfValue(rows, "Resting time", formatMinutesFromSeconds(primary.resting_time));
  pushIfValue(rows, "Non-wear time", formatMinutesFromSeconds(primary.non_wear_time));

  // MET metrics (if available)
  pushIfValue(rows, "High activity MET", formatNumber(primary.high_activity_met_minutes, "min"));
  pushIfValue(rows, "Medium activity MET", formatNumber(primary.medium_activity_met_minutes, "min"));
  pushIfValue(rows, "Low activity MET", formatNumber(primary.low_activity_met_minutes, "min"));

  // Goals and alerts
  pushIfValue(rows, "Target meters", formatDistance(primary.target_meters));
  pushIfValue(rows, "Meters to target", formatDistance(primary.meters_to_target));
  pushIfValue(rows, "Inactivity alerts", formatNumber(primary.inactivity_alerts));

  return rows.length > 0 ? { text: "Activity", children: rows } : null;
}

function buildHeartRateNode(samples: OuraHeartRateSample[]): InputTextNode | null {
  const summary = summarizeHeartRate(samples);
  if (!summary.average && !summary.min && !summary.max) {
    return null;
  }
  const parts: string[] = [];
  if (summary.average !== undefined) parts.push(`${summary.average} bpm avg`);
  if (summary.min !== undefined) parts.push(`min ${summary.min}`);
  if (summary.max !== undefined) parts.push(`max ${summary.max}`);
  return { text: "Heart rate", children: [{ text: parts.join(" / ") }] };
}

function buildWorkoutsNode(workouts: OuraWorkout[]): InputTextNode | null {
  if (workouts.length === 0) return null;
  const rows = workouts.map((workout) => ({
    text: formatWorkoutLine(workout),
  }));
  return { text: "Workouts", children: rows };
}

function buildTagsNode(tags: OuraTag[]): InputTextNode | null {
  if (tags.length === 0) return null;
  const rows = tags.map((tag) => ({
    text: formatTagLine(tag),
  }));
  return { text: "Tags", children: rows };
}

function pushIfValue(collection: InputTextNode[], label: string, value?: string): void {
  if (value) {
    collection.push({ text: `${label}: ${value}` });
  }
}

function formatNumber(value?: number, suffix?: string): string | undefined {
  if (value === undefined || Number.isNaN(value)) return undefined;
  return suffix ? `${value} ${suffix}` : `${value}`;
}

function formatPercentage(value?: number): string | undefined {
  if (value === undefined || Number.isNaN(value)) return undefined;
  return `${value}%`;
}

function formatHeartRate(avg?: number, min?: number): string | undefined {
  if (avg === undefined && min === undefined) return undefined;
  const parts: string[] = [];
  if (avg !== undefined) parts.push(`${avg} bpm avg`);
  if (min !== undefined) parts.push(`min ${min}`);
  return parts.join(" / ");
}

function formatBedtime(start?: string, end?: string): string | undefined {
  if (!start && !end) return undefined;
  const startLabel = start ? formatTime(start) : "";
  const endLabel = end ? formatTime(end) : "";
  return `${startLabel}${startLabel && endLabel ? " – " : ""}${endLabel}`;
}

function formatWorkoutLine(workout: OuraWorkout): string {
  const startTime = formatTime(workout.start_datetime);
  const duration = calculateDuration(workout.start_datetime, workout.end_datetime);
  const parts: string[] = [];
  if (duration) parts.push(duration);
  if (workout.calories !== undefined) parts.push(`${workout.calories} kcal`);
  const distance = formatDistance(workout.distance);
  if (distance) parts.push(distance);
  if (workout.intensity) parts.push(workout.intensity);
  if (workout.source) parts.push(`via ${workout.source}`);
  // Use activity, sport, or label for the workout name
  const activity = workout.activity ?? workout.sport ?? workout.label ?? "Workout";
  const activityFormatted = formatActivityName(activity);
  const details = parts.length > 0 ? ` (${parts.join(", ")})` : "";
  return `${startTime} – ${activityFormatted}${details}`;
}

function formatActivityName(activity: string): string {
  // Convert snake_case or camelCase to Title Case
  return activity
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatTagLine(tag: OuraTag): string {
  // Use start_time for time display
  const time = formatTagTime(tag.start_time) || formatTimestamp(tag.timestamp);

  // Build tag display: use custom_name, tag_type_code, tags array, or text
  let tagDisplay: string;
  if (tag.custom_name) {
    // Custom tag name (when tag_type_code is "custom")
    tagDisplay = `[[${formatTagType(tag.custom_name)}]]`;
  } else if (tag.tags && tag.tags.length > 0) {
    // Multiple tags array
    tagDisplay = tag.tags.map((t) => `[[${formatTagType(t)}]]`).join(" ");
  } else if (tag.tag_type_code && tag.tag_type_code !== "custom") {
    tagDisplay = `[[${formatTagType(tag.tag_type_code)}]]`;
  } else if (tag.text) {
    tagDisplay = `[[${formatTagType(tag.text)}]]`;
  } else {
    tagDisplay = "[[Tag]]";
  }

  // Add comment if present
  const comment = tag.comment ? ` – ${tag.comment}` : "";
  return time ? `${time} – ${tagDisplay}${comment}` : `${tagDisplay}${comment}`;
}

function formatTagTime(timeStr?: string): string {
  if (!timeStr) return "";
  // start_time is in format "HH:MM:SS" or "HH:MM:SS+00:00"
  const match = timeStr.match(/^(\d{2}):(\d{2})/);
  if (!match) return "";
  return `${match[1]}:${match[2]}`;
}

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return "";
  // timestamp is in ISO format "2025-11-30T14:30:00+00:00"
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatTagType(code?: string): string {
  if (!code) return "Tag";
  // Convert snake_case to Title Case (e.g., "tag_generic_nocaffeine" -> "No Caffeine")
  const cleaned = code
    .replace(/^tag_(generic_)?/, "")
    .replace(/_/g, " ");
  return cleaned
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function calculateDuration(start?: string, end?: string): string | undefined {
  if (!start || !end) return undefined;
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return undefined;
  return formatMinutesFromSeconds(Math.max(0, (endTime - startTime) / 1000));
}

function formatTime(value?: string): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDailyNoteDate(date: string): string {
  const [year, month, day] = date.split("-").map((part) => parseInt(part, 10));
  const parsedDate = new Date(year, month - 1, day);
  const monthName = parsedDate.toLocaleString("en", { month: "long" });
  const dayWithOrdinal = formatOrdinal(day);
  return `${monthName} ${dayWithOrdinal}, ${year}`;
}

function formatOrdinal(day: number): string {
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

function formatDistance(meters?: number): string | undefined {
  if (meters === undefined || Number.isNaN(meters)) return undefined;
  const km = meters / 1000;
  return `${km.toFixed(2)} km`;
}

function formatTemperature(deviation?: number): string | undefined {
  if (deviation === undefined || Number.isNaN(deviation)) return undefined;
  const sign = deviation >= 0 ? "+" : "";
  return `${sign}${deviation.toFixed(2)}°C`;
}
