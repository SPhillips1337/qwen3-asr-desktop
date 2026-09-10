export const DEFAULT_SHORTCUT = "Control+Alt+Shift+Space";

const MODIFIERS = new Set(["Control", "Alt", "Shift", "Meta"]);
const RESERVED = new Set([
  "Control+Alt+Delete",
  "Meta+L",
  "Meta+D",
  "Meta+E",
  "Meta+R",
  "Meta+Tab",
  "Alt+Tab",
  "Alt+F4",
]);
const ALIASES = new Map([
  ["Ctrl", "Control"],
  ["Cmd", "Meta"],
  ["Command", "Meta"],
  ["CommandOrControl", "Control"],
  ["Win", "Meta"],
  ["Windows", "Meta"],
]);
const MODIFIER_ORDER = ["Control", "Alt", "Shift", "Meta"];

export function normalizeShortcut(value) {
  if (typeof value !== "string") throw new TypeError("shortcut must be a string");
  const parts = value.split("+").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error("shortcut cannot be empty");
  const normalized = parts.map((part) => ALIASES.get(part) ?? (part.length === 1 ? part.toUpperCase() : part));
  const key = normalized.at(-1);
  const modifiers = [...new Set(normalized.slice(0, -1))].sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b));
  return [...modifiers, key].join("+");
}

export function isSafeShortcut(value) {
  let normalized;
  try { normalized = normalizeShortcut(value); } catch (error) { return { ok: false, reason: error.message }; }
  const parts = normalized.split("+");
  const key = parts.at(-1);
  const modifiers = parts.slice(0, -1);
  if (!modifiers.some((modifier) => MODIFIERS.has(modifier))) return { ok: false, reason: "at least one modifier is required" };
  if (modifiers.some((modifier) => !MODIFIERS.has(modifier))) return { ok: false, reason: "unknown modifier" };
  if (!/^(?:[A-Z0-9]|F(?:[1-9]|1[0-2])|Space|Enter|Escape|Tab|Up|Down|Left|Right|Home|End|PageUp|PageDown|Insert|Delete|Backspace)$/.test(key)) {
    return { ok: false, reason: "unsupported key" };
  }
  if (RESERVED.has(normalized)) return { ok: false, reason: "Windows-reserved shortcut" };
  return { ok: true, value: normalized };
}

export function shortcutToKey(value) {
  const normalized = normalizeShortcut(value);
  return normalized.split("+").at(-1);
}

export function matchesKeyEvent(shortcut, event) {
  const normalized = normalizeShortcut(shortcut);
  const parts = normalized.split("+");
  const key = parts.at(-1);
  const required = new Set(parts.slice(0, -1));
  const keyMatches = event.keyName === key || (key === "Space" && event.keyName === "Space");
  return keyMatches && Boolean(event.ctrlKey) === required.has("Control") && Boolean(event.altKey) === required.has("Alt") && Boolean(event.shiftKey) === required.has("Shift") && Boolean(event.metaKey) === required.has("Meta");
}
