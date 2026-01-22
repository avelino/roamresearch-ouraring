import {
  createBlock as roamCreateBlock,
  updateBlock as roamUpdateBlock,
  createPage,
  deleteBlock,
  getBasicTreeByParentUid,
  getPageUidByPageTitle,
} from "./settings";
import { DEFAULT_PAGE_PREFIX, ISO_DATE_PATTERN } from "./constants";
import { logDebug, logWarn } from "./logger";
import {
  calculateDuration,
  formatActivityName,
  formatBedtime,
  formatDailyNoteDate,
  formatDistance,
  formatHeartRate,
  formatMinutesFromSeconds,
  formatNumber,
  formatPercentage,
  formatTagTime,
  formatTagType,
  formatTemperature,
  formatTime,
  formatTimestamp,
} from "./formatters";
import {
  DailyOuraData,
  OuraActivity,
  OuraHeartRateSample,
  OuraReadiness,
  OuraSleep,
  OuraTag,
  OuraWorkout,
  summarizeHeartRate,
} from "./ouraring";
import {
  BlockReconciler,
  createRoamApiAdapter,
  type BlockPayload,
  type RoamNode,
} from "roam-block-reconciler";

const OURA_DATE_PROPERTY = "oura-date";

/**
 * Creates a Roam API adapter for the reconciler.
 */
function createOuraRoamAdapter() {
  return createRoamApiAdapter({
    getBasicTreeByParentUid,
    createBlock: roamCreateBlock,
    updateBlock: roamUpdateBlock,
    deleteBlock,
  });
}

/**
 * Creates a BlockReconciler configured for Oura daily data.
 * Uses a fixed identifier since each page has only one Oura data block.
 * This allows matching both legacy blocks (without oura-date) and new blocks.
 */
function createOuraReconciler() {
  const roamApi = createOuraRoamAdapter();

  return new BlockReconciler<BlockPayload>(
    {
      // All Oura blocks use the same ID since there's only one per page
      extractId: (block) => {
        // Verify it's an Oura block by checking for the header pattern or property
        if (!isOuraHeaderBlock(block.text ?? "") && !extractOuraDateFromBlock(block)) {
          throw new Error(`Block is not an Oura block: ${block.text.substring(0, 50)}`);
        }
        return OURA_BLOCK_ID;
      },
      buildBlock: (block) => block,
      extractIdFromBlock: (node: RoamNode) => extractOuraIdFromNode(node),
    },
    roamApi
  ).withChildrenReconciler({
    extractKey: extractSectionKey,
  });
}

// Fixed ID for all Oura blocks (only one per page)
const OURA_BLOCK_ID = "oura-daily";

/**
 * Extracts oura-date from a BlockPayload.
 * Checks main text and children for the property.
 */
function extractOuraDateFromBlock(block: BlockPayload): string | undefined {
  let id = extractOuraDateProperty(block.text ?? "");
  if (id) return id;

  for (const child of block.children ?? []) {
    id = extractOuraDateProperty(child.text ?? "");
    if (id) return id;
  }
  return undefined;
}

/**
 * Extracts oura identifier from a RoamNode.
 * Supports both new format (oura-date:: property) and legacy format (#ouraring header).
 * Returns a fixed ID since each page has only one Oura block.
 */
function extractOuraIdFromNode(node: RoamNode): string | undefined {
  // Check for oura-date property in children (new format)
  for (const child of node.children ?? []) {
    const id = extractOuraDateProperty(child.text ?? "");
    if (id) return OURA_BLOCK_ID;
  }

  // Check for #ouraring header (legacy and new format)
  if (isOuraHeaderBlock(node.text ?? "")) {
    return OURA_BLOCK_ID;
  }

  return undefined;
}

/**
 * Extracts oura-date value from property text content.
 */
function extractOuraDateProperty(content: string): string | undefined {
  const match = content.match(new RegExp(`^${OURA_DATE_PROPERTY}::\\s*(.+)$`, "mi"));
  return match ? match[1].trim() : undefined;
}

/**
 * Checks if the text is an Oura header block (starts with #ouraring).
 */
function isOuraHeaderBlock(text: string): boolean {
  return text.trim().startsWith("#ouraring ");
}

/**
 * Extracts section key from a block (e.g., "Sleep", "Readiness").
 * Used by children reconciler to match sections.
 */
function extractSectionKey(text: string): string | undefined {
  const trimmed = text.trim();
  const sections = ["Sleep", "Readiness", "Activity", "Heart rate", "Workouts", "Tags"];
  for (const section of sections) {
    if (trimmed === section || trimmed.startsWith(`${section}:`)) {
      return section;
    }
  }
  // Check for property lines
  const match = text.match(/^([\w-]+)::/);
  return match ? match[1] : undefined;
}

export async function writeDailyOuraPage(prefix: string, data: DailyOuraData): Promise<void> {
  if (!ISO_DATE_PATTERN.test(data.date)) {
    logWarn("invalid_date", { date: data.date });
    return;
  }

  const pageTitle = `${prefix || DEFAULT_PAGE_PREFIX}/${data.date}`;
  const header = buildHeaderText(data);

  const existingPageUid = getPageUidByPageTitle(pageTitle);
  const pageUid = existingPageUid ?? (await createPage({
    title: pageTitle,
    tree: [],
  }));

  const block = buildDailyBlock(header, data);
  const reconciler = createOuraReconciler();
  const stats = await reconciler.reconcile(pageUid, [block]);

  logDebug("page_written", {
    pageUid,
    date: data.date,
    ...stats,
  });
}

/**
 * Builds the complete block structure for a day's Oura data.
 */
function buildDailyBlock(header: string, data: DailyOuraData): BlockPayload {
  const children: BlockPayload[] = [];

  // Add oura-date property as first child for identification
  children.push({ text: `${OURA_DATE_PROPERTY}:: ${data.date}`, children: [] });

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

function buildSleepNode(sessions: OuraSleep[]): BlockPayload | null {
  if (sessions.length === 0) return null;
  const primary = sessions[0];
  const rows: BlockPayload[] = [];

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
    const contributorsNode: BlockPayload = { text: "Contributors", children: [] };
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

function buildReadinessNode(entries: OuraReadiness[]): BlockPayload | null {
  if (entries.length === 0) return null;
  const primary = entries[0];
  const rows: BlockPayload[] = [];

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
    const contributorsNode: BlockPayload = { text: "Contributors", children: [] };
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

function buildActivityNode(entries: OuraActivity[]): BlockPayload | null {
  if (entries.length === 0) return null;
  const primary = entries[0];
  const rows: BlockPayload[] = [];

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

function buildHeartRateNode(samples: OuraHeartRateSample[]): BlockPayload | null {
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

function buildWorkoutsNode(workouts: OuraWorkout[]): BlockPayload | null {
  if (workouts.length === 0) return null;
  const rows = workouts.map((workout) => ({
    text: formatWorkoutLine(workout),
    children: [] as BlockPayload[],
  }));
  return { text: "Workouts", children: rows };
}

function buildTagsNode(tags: OuraTag[]): BlockPayload | null {
  if (tags.length === 0) return null;
  const rows = tags.map((tag) => ({
    text: formatTagLine(tag),
    children: [] as BlockPayload[],
  }));
  return { text: "Tags", children: rows };
}

function pushIfValue(collection: BlockPayload[], label: string, value?: string): void {
  if (value) {
    collection.push({ text: `${label}: ${value}`, children: [] });
  }
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
  const activity = workout.activity ?? workout.sport ?? workout.label ?? "Workout";
  const activityFormatted = formatActivityName(activity);
  const details = parts.length > 0 ? ` (${parts.join(", ")})` : "";
  return `${startTime} – ${activityFormatted}${details}`;
}

function formatTagLine(tag: OuraTag): string {
  const time = formatTagTime(tag.start_time) || formatTimestamp(tag.timestamp);

  let tagDisplay: string;
  if (tag.custom_name) {
    tagDisplay = `[[${formatTagType(tag.custom_name)}]]`;
  } else if (tag.tags && tag.tags.length > 0) {
    tagDisplay = tag.tags.map((t) => `[[${formatTagType(t)}]]`).join(" ");
  } else if (tag.tag_type_code && tag.tag_type_code !== "custom") {
    tagDisplay = `[[${formatTagType(tag.tag_type_code)}]]`;
  } else if (tag.text) {
    tagDisplay = `[[${formatTagType(tag.text)}]]`;
  } else {
    tagDisplay = "[[Tag]]";
  }

  const comment = tag.comment ? ` – ${tag.comment}` : "";
  return time ? `${time} – ${tagDisplay}${comment}` : `${tagDisplay}${comment}`;
}
