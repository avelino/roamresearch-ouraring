// API
export const OURA_API_BASE = "https://api.ouraring.com/v2/usercollection";

// Settings
export const DEFAULT_PAGE_PREFIX = "ouraring";
export const CONFIG_PAGE_TITLE = "roam/js/ouraring";

// UI
export const COMMAND_LABEL = "Oura: Sync daily data";
export const TOPBAR_BUTTON_ID = "roam-ouraring-button";
export const TOPBAR_ICON_NAME = "ring";

// Validation
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Performance tuning
export const MAX_DAYS_PER_REQUEST = 7;
export const MUTATION_DELAY_MS = 100;
export const YIELD_BATCH_SIZE = 3;
