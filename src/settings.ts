// Use React from window to avoid version conflicts with Roam's React
const getReact = () => (window as unknown as { React: typeof import("react") }).React;

import { CONFIG_PAGE_TITLE, DEFAULT_PAGE_PREFIX, MUTATION_DELAY_MS, YIELD_BATCH_SIZE } from "./constants";
import type { ExtensionAPI } from "./main";

interface RoamBasicNode {
  text: string;
  uid: string;
  children?: RoamBasicNode[];
}

export interface InputTextNode {
  text: string;
  children?: InputTextNode[];
}

interface RoamAlphaAPI {
  q?: (query: string, ...args: unknown[]) => unknown[][];
  data?: { pull?: (selector: string, eid: string) => unknown };
  util?: { generateUID?: () => string };
  createPage?: (config: { page: { title: string; uid?: string } }) => Promise<void>;
  createBlock?: (config: {
    location: { "parent-uid": string; order: number | "last" };
    block: { string: string; uid?: string };
  }) => Promise<void>;
  updateBlock?: (config: { block: { uid: string; string: string } }) => Promise<void>;
  deleteBlock?: (config: { block: { uid: string } }) => Promise<void>;
}

function getRoamAPI(): RoamAlphaAPI | undefined {
  return (window as unknown as { roamAlphaAPI?: RoamAlphaAPI }).roamAlphaAPI;
}

function generateUID(): string {
  return Math.random().toString(36).substring(2, 11);
}

export async function createPage(config: { title: string; tree?: InputTextNode[] }): Promise<string> {
  const api = getRoamAPI();
  const uid = api?.util?.generateUID?.() ?? generateUID();

  if (api?.createPage) {
    await api.createPage({ page: { title: config.title, uid } });
    await delay(MUTATION_DELAY_MS);
    await yieldToMain();

    if (config.tree) {
      for (let i = 0; i < config.tree.length; i++) {
        await createBlockRecursive(uid, config.tree[i], i);
      }
    }
  }

  return uid;
}

export async function createBlock(config: { parentUid: string; order: number | "last"; node: InputTextNode }): Promise<string> {
  const api = getRoamAPI();
  const uid = api?.util?.generateUID?.() ?? generateUID();

  if (api?.createBlock) {
    await api.createBlock({
      location: { "parent-uid": config.parentUid, order: config.order },
      block: { string: config.node.text, uid },
    });
    await delay(MUTATION_DELAY_MS);
    await yieldToMain();

    if (config.node.children) {
      for (let i = 0; i < config.node.children.length; i++) {
        await createBlockRecursive(uid, config.node.children[i], i);
      }
    }
  }

  return uid;
}

async function createBlockRecursive(parentUid: string, node: InputTextNode, order: number, depth = 0): Promise<void> {
  const api = getRoamAPI();
  const uid = api?.util?.generateUID?.() ?? generateUID();

  if (api?.createBlock) {
    await api.createBlock({
      location: { "parent-uid": parentUid, order },
      block: { string: node.text, uid },
    });
    await delay(MUTATION_DELAY_MS);

    if (depth % YIELD_BATCH_SIZE === 0) {
      await yieldToMain();
    }

    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        await createBlockRecursive(uid, node.children[i], i, depth + 1);
      }
    }
  }
}

export async function updateBlock(config: { uid: string; text: string }): Promise<void> {
  const api = getRoamAPI();
  if (api?.updateBlock) {
    await api.updateBlock({ block: { uid: config.uid, string: config.text } });
    await delay(MUTATION_DELAY_MS);
  }
}

export async function deleteBlock(uid: string): Promise<void> {
  const api = getRoamAPI();
  if (api?.deleteBlock) {
    await api.deleteBlock({ block: { uid } });
    await delay(MUTATION_DELAY_MS);
  }
}

export function getBasicTreeByParentUid(parentUid: string): RoamBasicNode[] {
  const api = getRoamAPI();
  if (!api?.q) return [];

  const result = api.q(
    `[:find ?string ?uid ?order
      :where
      [?parent :block/uid "${parentUid}"]
      [?parent :block/children ?child]
      [?child :block/string ?string]
      [?child :block/uid ?uid]
      [?child :block/order ?order]]`
  );

  if (!result || result.length === 0) return [];

  return (result as Array<[string, string, number]>)
    .map(([text, uid, order]) => ({
      text: text ?? "",
      uid: uid ?? "",
      order: order ?? 0,
      children: getBasicTreeByParentUid(uid),
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function getPageUidByPageTitle(title: string): string | undefined {
  const api = getRoamAPI();
  if (!api?.q) return undefined;

  const result = api.q(`[:find ?uid :where [?p :node/title "${title}"] [?p :block/uid ?uid]]`);
  return result?.[0]?.[0] as string | undefined;
}

export type SettingsSnapshot = {
  token?: string;
  pagePrefix: string;
  daysToSync: number;
  enableDebugLogs: boolean;
};

export type SettingsHandle =
  | { mode: "panel"; dispose: () => void }
  | { mode: "page"; pageUid: string; dispose: () => void };

const SETTINGS_KEYS = {
  token: "ouraring_token",
  pagePrefix: "page_prefix",
  daysToSync: "days_to_sync",
  enableDebugLogs: "enable_debug_logs",
} as const;

const DEFAULT_SETTINGS: Record<string, unknown> = {
  [SETTINGS_KEYS.token]: "",
  [SETTINGS_KEYS.pagePrefix]: DEFAULT_PAGE_PREFIX,
  [SETTINGS_KEYS.daysToSync]: 7,
  [SETTINGS_KEYS.enableDebugLogs]: false,
};

const SETTINGS_TEMPLATE: InputTextNode[] = [
  { text: "Oura Token", children: [{ text: "" }] },
  { text: "Page Prefix", children: [{ text: DEFAULT_PAGE_PREFIX }] },
  { text: "Days to Sync", children: [{ text: "7" }] },
  { text: "Enable Debug Logs" },
];

export async function initializeSettings(extensionAPI: ExtensionAPI): Promise<SettingsHandle> {
  const hasPanel = typeof extensionAPI.settings.panel?.create === "function";
  if (hasPanel) {
    await ensureDefaults(extensionAPI);
    registerSettingsPanel(extensionAPI);
    return { mode: "panel", dispose: () => undefined };
  }

  const pageUid = await ensureSettingsPage();
  return { mode: "page", pageUid, dispose: () => undefined };
}

export function readSettings(extensionAPI: ExtensionAPI, handle: SettingsHandle): SettingsSnapshot {
  if (handle.mode === "panel") {
    return readSettingsFromPanel(extensionAPI);
  }
  return readSettingsFromPage(handle.pageUid);
}

function readSettingsFromPanel(extensionAPI: ExtensionAPI): SettingsSnapshot {
  const allSettings = extensionAPI.settings.getAll() ?? {};
  const token = sanitizeToken(getString(allSettings, SETTINGS_KEYS.token));
  const pagePrefix = getString(allSettings, SETTINGS_KEYS.pagePrefix) || DEFAULT_PAGE_PREFIX;
  const daysToSync = Math.max(getNumber(allSettings, SETTINGS_KEYS.daysToSync, 7), 1);
  const enableDebugLogs = getBoolean(allSettings, SETTINGS_KEYS.enableDebugLogs, false);
  return {
    token,
    pagePrefix,
    daysToSync,
    enableDebugLogs,
  };
}

function readSettingsFromPage(pageUid: string): SettingsSnapshot {
  const tree = getBasicTreeByParentUid(pageUid);
  const token = sanitizeToken(
    getSettingValueFromTree({ tree, key: "Oura Token", defaultValue: "" })
  );
  const pagePrefix =
    getSettingValueFromTree({ tree, key: "Page Prefix", defaultValue: DEFAULT_PAGE_PREFIX }).trim() || DEFAULT_PAGE_PREFIX;
  const daysToSync = Math.max(
    getSettingIntFromTree({ tree, key: "Days to Sync", defaultValue: 7 }),
    1
  );
  const enableDebugLogs = hasFlag(tree, "Enable Debug Logs");

  return {
    token,
    pagePrefix,
    daysToSync,
    enableDebugLogs,
  };
}

async function ensureDefaults(extensionAPI: ExtensionAPI): Promise<void> {
  const entries = Object.entries(DEFAULT_SETTINGS);
  for (const [key, value] of entries) {
    const current = extensionAPI.settings.get(key);
    if (current === null || current === undefined) {
      await extensionAPI.settings.set(key, value);
    }
  }
}

async function ensureSettingsPage(): Promise<string> {
  const existing = getPageUidByPageTitle(CONFIG_PAGE_TITLE);
  if (existing) return existing;

  return createPage({
    title: CONFIG_PAGE_TITLE,
    tree: SETTINGS_TEMPLATE,
  });
}

function getSettingValueFromTree(config: { tree: RoamBasicNode[]; key: string; defaultValue: string }): string {
  const node = config.tree.find((n) => toFlexRegex(config.key).test(n.text.trim()));
  return node?.children?.[0]?.text?.trim() ?? config.defaultValue;
}

function getSettingIntFromTree(config: { tree: RoamBasicNode[]; key: string; defaultValue: number }): number {
  const value = getSettingValueFromTree({ tree: config.tree, key: config.key, defaultValue: "" });
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? config.defaultValue : parsed;
}

function hasFlag(tree: RoamBasicNode[], label: string): boolean {
  return tree.some((node) => toFlexRegex(label).test(node.text.trim()));
}

function toFlexRegex(key: string): RegExp {
  return new RegExp(`^\\s*${key.replace(/([()])/g, "\\$1")}\\s*(#\\.[\\w\\d-]*\\s*)?$`, "i");
}

function sanitizeToken(raw: string | undefined): string | undefined {
  const trimmed = (raw ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function getNumber(source: Record<string, unknown>, key: string, fallback: number): number {
  const value = source[key];
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function getBoolean(source: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = source[key];
  return typeof value === "boolean" ? value : fallback;
}

function registerSettingsPanel(extensionAPI: ExtensionAPI): void {
  const React = getReact();
  const { useState, useEffect } = React;

  const TextInput = (key: string, type: string, placeholder: string) =>
    function TextInputComponent() {
      const getInitial = () => `${extensionAPI.settings.get(key) ?? placeholder}`;
      const [value, setValue] = useState(getInitial());
      useEffect(() => {
        setValue(getInitial());
      }, []);
      return React.createElement("input", {
        type,
        placeholder,
        value,
        style: { width: "100%" },
        onChange: (event: { target: { value: string } }) => {
          const next = event.target.value;
          setValue(next);
          void extensionAPI.settings.set(key, type === "number" ? Number(next) : next);
        },
      });
    };

  const Toggle = (key: string) =>
    function ToggleComponent() {
      const getInitial = () => getBoolean(extensionAPI.settings.getAll() ?? {}, key, Boolean(DEFAULT_SETTINGS[key]));
      const [checked, setChecked] = useState(getInitial());
      useEffect(() => {
        setChecked(getInitial());
      }, []);
      return React.createElement(
        "label",
        { style: { display: "inline-flex", alignItems: "center", gap: "0.5rem" } },
        React.createElement("input", {
          type: "checkbox",
          checked,
          onChange: (event: { target: { checked: boolean } }) => {
            const next = event.target.checked;
            setChecked(next);
            void extensionAPI.settings.set(key, next);
          },
        }),
        checked ? "Enabled" : "Disabled"
      );
    };

  extensionAPI.settings.panel!.create({
    tabTitle: "Oura Ring",
    settings: [
      {
        id: SETTINGS_KEYS.token,
        name: "Oura Personal Access Token",
        description: "Bearer token generated from Oura Cloud → Personal Access Tokens.",
        action: {
          type: "reactComponent",
          component: TextInput(SETTINGS_KEYS.token, "text", "ouraring_token"),
        },
      },
      {
        id: SETTINGS_KEYS.pagePrefix,
        name: "Page Prefix",
        description: "Prefix for daily Oura pages (final page will be prefix/YYYY-MM-DD).",
        action: {
          type: "reactComponent",
          component: TextInput(SETTINGS_KEYS.pagePrefix, "text", DEFAULT_PAGE_PREFIX),
        },
      },
      {
        id: SETTINGS_KEYS.daysToSync,
        name: "Days to Sync",
        description: "How many past days to download (includes today).",
        action: {
          type: "reactComponent",
          component: TextInput(SETTINGS_KEYS.daysToSync, "number", "7"),
        },
      },
      {
        id: SETTINGS_KEYS.enableDebugLogs,
        name: "Enable Debug Logs",
        description: "Show detailed logs in the browser console while syncing.",
        action: {
          type: "reactComponent",
          component: Toggle(SETTINGS_KEYS.enableDebugLogs),
        },
      },
    ],
  });
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as unknown as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) {
    return scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Re-export constants for backwards compatibility
export { MUTATION_DELAY_MS, YIELD_BATCH_SIZE } from "./constants";
