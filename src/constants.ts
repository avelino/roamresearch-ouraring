export const OURA_API_BASE = "https://api.ouraring.com/v2/usercollection";
export const DEFAULT_PAGE_PREFIX = "ouraring";
export const CONFIG_PAGE_TITLE = "roam/js/ouraring";
export const COMMAND_LABEL = "Oura: Sync daily data";
export const TOPBAR_BUTTON_ID = "roam-ouraring-button";
export const TOPBAR_ICON_NAME = "heart";
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Default CORS proxy URL. Uses corsproxy.io which supports the format:
 * https://corsproxy.io/?<encoded_url>
 * Users can configure their own proxy or use alternatives like:
 * - https://api.allorigins.win/raw?url=<encoded_url>
 * - Custom Cloudflare Worker
 */
export const DEFAULT_CORS_PROXY = "https://corsproxy.io/?";
