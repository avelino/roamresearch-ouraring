import "./polyfills";

import { writeDailyOuraPage } from "./blocks";
import { fetchDailyData } from "./ouraring";
import {
  initializeSettings,
  readSettings,
  type SettingsHandle,
  type SettingsSnapshot,
} from "./settings";
import { registerCommand, registerTopbarButton } from "./ui";
import { logError, logInfo, logDebug, setDebugEnabled } from "./logger";

export interface ExtensionAPI {
  settings: {
    get: (key: string) => unknown;
    getAll: () => Record<string, unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    panel?: {
      create: (config: SettingsPanelConfig) => void;
    };
  };
  ui?: {
    commandPalette?: {
      addCommand: (config: { label: string; callback: () => void }) => Promise<void>;
      removeCommand: (config: { label: string }) => Promise<void>;
    };
  };
}

interface SettingsPanelConfig {
  tabTitle: string;
  settings: Array<{
    id: string;
    name: string;
    description: string;
    action: {
      type: string;
      component: React.ComponentType;
    };
  }>;
}

interface OnloadArgs {
  extensionAPI: ExtensionAPI;
}

let syncInProgress = false;
let settingsHandle: SettingsHandle | null = null;
let extensionAPIRef: ExtensionAPI | null = null;
let unregisterCommand: (() => Promise<void>) | null = null;
let removeTopbarButton: (() => void) | null = null;
let initialized = false;

async function onload(args: OnloadArgs): Promise<void> {
  if (initialized) return;

  try {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const { extensionAPI } = args;
    extensionAPIRef = extensionAPI;
    settingsHandle = await initializeSettings(extensionAPI);
    refreshSettings();

    unregisterCommand = await registerCommand(extensionAPI, () => syncOura("manual"));
    removeTopbarButton = registerTopbarButton(() => syncOura("manual"));

    void syncOura("auto");

    initialized = true;
    logInfo("Oura integration loaded");
  } catch (error) {
    logError("Extension initialization failed", error);
  }
}

function onunload(): void {
  if (removeTopbarButton) {
    removeTopbarButton();
    removeTopbarButton = null;
  }
  if (unregisterCommand) {
    void unregisterCommand();
    unregisterCommand = null;
  }
  settingsHandle?.dispose();
  settingsHandle = null;
  extensionAPIRef = null;
  initialized = false;
  logInfo("Oura integration unloaded");
}

const extension = { onload, onunload };
export default extension;

function refreshSettings(): SettingsSnapshot {
  if (!extensionAPIRef || !settingsHandle) {
    throw new Error("Settings have not been initialized.");
  }
  const snapshot = readSettings(extensionAPIRef, settingsHandle);
  setDebugEnabled(snapshot.enableDebugLogs);
  return snapshot;
}

async function syncOura(trigger: "manual" | "auto") {
  if (syncInProgress) {
    if (trigger === "manual") {
      showStatusMessage("Sync is already in progress.", "warning");
    }
    return;
  }

  const settings = refreshSettings();
  if (!settings.token) {
    if (trigger === "manual") {
      showStatusMessage("Please add your Oura token in the extension settings.", "warning");
    }
    return;
  }

  syncInProgress = true;
  if (trigger === "manual") {
    showStatusMessage("Syncing Oura data...", "info");
  }

  try {
    const dates = buildDateRange(settings.daysToSync);
    for (const date of dates) {
      const data = await fetchDailyData(settings.token, date, settings.corsProxyUrl);
      await writeDailyOuraPage(settings.pagePrefix, data);
    }

    if (trigger === "manual") {
      showStatusMessage(`Synced Oura data for ${dates.length} day(s).`, "success");
    } else {
      logInfo("automatic sync completed");
    }
    logDebug("sync_completed", { dates });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("failed to sync", error);
    showStatusMessage(`Failed to sync Oura data: ${message}`, "error");
  } finally {
    syncInProgress = false;
  }
}

function buildDateRange(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const current = new Date(today);
    current.setDate(today.getDate() - i);
    dates.push(formatDate(current));
  }
  return dates;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showStatusMessage(message: string, type: "info" | "warning" | "success" | "error") {
  const roamUI = (window as unknown as { roamAlphaAPI?: { ui?: { mainWindow?: { setStatusMessage?: (options: { message: string; type: string }) => void } } } }).roamAlphaAPI?.ui;
  const setStatus = roamUI?.mainWindow?.setStatusMessage;
  if (typeof setStatus === "function") {
    setStatus({ message, type });
  } else if (type === "error") {
    console.error(message);
  } else {
    console.info(message);
  }
}
