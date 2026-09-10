import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SHORTCUT, normalizeShortcut, shortcutToKey, isSafeShortcut } from "../src/shortcut-policy.js";

test("default shortcut is modifier-based and stable", () => {
  assert.equal(DEFAULT_SHORTCUT, "Control+Alt+Shift+Space");
  assert.equal(isSafeShortcut(DEFAULT_SHORTCUT).ok, true);
});

test("normalizes common accelerator aliases", () => {
  assert.equal(normalizeShortcut("Ctrl+Alt+Shift+Space"), DEFAULT_SHORTCUT);
  assert.equal(normalizeShortcut("CommandOrControl + Alt + Shift + Space"), DEFAULT_SHORTCUT);
});

test("rejects bare keys and reserved combinations", () => {
  assert.equal(isSafeShortcut("A").ok, false);
  assert.equal(isSafeShortcut("Control+Alt+Delete").ok, false);
  assert.equal(isSafeShortcut("Meta+L").ok, false);
});

test("maps supported final keys to uiohook enum names", () => {
  assert.equal(shortcutToKey("Control+Alt+Shift+Space"), "Space");
  assert.equal(shortcutToKey("Control+Alt+Q"), "Q");
});
