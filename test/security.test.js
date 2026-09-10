import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

test("electron shell keeps renderer isolated and token out of preload", async () => {
  const main = await readFile(path.join(root, "src/main.js"), "utf8");
  const preload = await readFile(path.join(root, "src/preload.cjs"), "utf8");
  const html = await readFile(path.join(root, "src/renderer.html"), "utf8");
  assert.match(main, /contextIsolation: true/);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /sandbox: true/);
  assert.match(main, /requestSingleInstanceLock/);
  assert.doesNotMatch(main, /192\.168\./);
  assert.match(main, /safeStorage/);
  assert.match(main, /uIOhook/);
  assert.doesNotMatch(preload, /Bearer|apiKeyEncrypted|fetch\(/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /<script type="module" src="renderer\.js"><\/script>/);
});

test("ASR client uses authenticated multipart WAV upload", async () => {
  const main = await readFile(path.join(root, "src/main.js"), "utf8");
  assert.match(main, /audio\/wav/);
  assert.match(main, /audio\/transcriptions/);
  assert.match(main, /Bearer/);
  assert.match(main, /recording\.wav/);
});
