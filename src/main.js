import { app, BrowserWindow, clipboard, globalShortcut, Menu, nativeImage, Notification, Tray, safeStorage, ipcMain, session } from "electron";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uIOhook, UiohookKey } from "uiohook-napi";
import { DEFAULT_SHORTCUT, isSafeShortcut, matchesKeyEvent, normalizeShortcut, shortcutToKey } from "./shortcut-policy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULTS = { serverUrl: "http://localhost:8765", shortcut: DEFAULT_SHORTCUT, shortcutMode: "hold", language: "", autoPaste: true, startWithWindows: false };
let mainWindow;
let tray;
let settings = { ...DEFAULTS };
let recording = false;
let shortcutListener;
let registeredShortcut = "";
let settingsPath;

function validateServerUrl(raw) {
  const url = new URL(raw);
  if (!(["http:", "https:"].includes(url.protocol)) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Server URL must be an HTTP(S) origin without credentials or a path");
  return url.origin;
}

async function loadSettings() {
  settingsPath = path.join(app.getPath("userData"), "settings.json");
  try {
    const saved = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    settings = { ...DEFAULTS, ...saved, serverUrl: validateServerUrl(saved.serverUrl ?? DEFAULTS.serverUrl) };
  } catch { settings = { ...DEFAULTS }; }
}

async function saveSettings(next) {
  const shortcut = isSafeShortcut(next.shortcut ?? settings.shortcut);
  if (!shortcut.ok) throw new Error(shortcut.reason);
  const clean = { ...settings, ...next, serverUrl: validateServerUrl(next.serverUrl ?? settings.serverUrl), shortcut: shortcut.value };
  if (typeof next.apiKey === "string") {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows-protected storage is unavailable");
    clean.apiKeyEncrypted = next.apiKey ? safeStorage.encryptString(next.apiKey).toString("base64") : "";
  }
  delete clean.apiKey;
  const oldShortcut = settings.shortcut;
  settings = clean;
  if (oldShortcut !== clean.shortcut) {
    try { registerShortcut(); } catch (error) { settings.shortcut = oldShortcut; throw error; }
  }
  app.setLoginItemSettings({ openAtLogin: settings.startWithWindows, openAsHidden: true });
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), { mode: 0o600 });
  return publicSettings();
}

function apiKey() {
  if (!settings.apiKeyEncrypted || !safeStorage.isEncryptionAvailable()) return "";
  try { return safeStorage.decryptString(Buffer.from(settings.apiKeyEncrypted, "base64")); } catch { return ""; }
}
function publicSettings() { return { ...settings, apiKeyEncrypted: undefined, hasApiKey: Boolean(apiKey()) }; }

function createWindow() {
  mainWindow = new BrowserWindow({ width: 520, height: 650, show: false, webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow.loadFile(path.join(__dirname, "renderer.html"));
  mainWindow.on("close", (event) => { if (!app.isQuitting) { event.preventDefault(); mainWindow.hide(); } });
}
function showWindow() { mainWindow?.show(); mainWindow?.focus(); }
function notify(title, body) { if (Notification.isSupported()) new Notification({ title, body }).show(); }

function keyNameForEvent(event) {
  for (const [name, value] of Object.entries(UiohookKey)) if (value === event.keycode) return name;
  return "";
}
function registerShortcut() {
  const check = isSafeShortcut(settings.shortcut);
  if (!check.ok) throw new Error(check.reason);
  const previousShortcut = registeredShortcut;
  if (previousShortcut) globalShortcut.unregister(previousShortcut);
  if (!globalShortcut.register(check.value, beginRecording)) {
    if (previousShortcut) { globalShortcut.register(previousShortcut, beginRecording); registeredShortcut = previousShortcut; }
    throw new Error("Windows rejected this shortcut because it is already in use");
  }
  registeredShortcut = check.value;
  if (shortcutListener) { uIOhook.off("keydown", shortcutListener.down); uIOhook.off("keyup", shortcutListener.up); }
  const keyName = shortcutToKey(check.value);
  let down = false;
  const handle = (event, isDown) => {
    const enriched = { ...event, keyName: keyNameForEvent(event) };
    if (enriched.keyName !== keyName || !matchesKeyEvent(check.value, enriched)) return;
    if (isDown && !down) { down = true; beginRecording(); }
    if (!isDown && down) { down = false; endRecording(); }
  };
  const downHandler = (event) => handle(event, true);
  const upHandler = (event) => handle(event, false);
  shortcutListener = { down: downHandler, up: upHandler };
  uIOhook.on("keydown", downHandler); uIOhook.on("keyup", upHandler);
}
function beginRecording() {
  if (recording) return;
  recording = true;
  mainWindow?.hide();
  mainWindow?.webContents.send("recording-start");
}
function endRecording() {
  if (!recording) return;
  recording = false;
  mainWindow?.webContents.send("recording-stop");
}

async function transcribe(audio) {
  const key = apiKey();
  if (!key) throw new Error("ASR API key has not been configured");
  const response = await fetch(`${settings.serverUrl}/v1/audio/transcriptions`, { method: "POST", headers: { authorization: `Bearer ${key}` }, body: (() => { const form = new FormData(); form.append("file", new Blob([audio], { type: "audio/wav" }), "recording.wav"); form.append("model", "qwen3-asr-0.6b-q8-0"); if (settings.language) form.append("language", settings.language); return form; })() });
  if (!response.ok) throw new Error(`ASR server returned HTTP ${response.status}`);
  const data = await response.json();
  if (typeof data.text !== "string") throw new Error("ASR server returned no transcript");
  return data.text.trim();
}
async function pasteText(text) {
  if (!settings.autoPaste || !text) return;
  const previous = clipboard.readText();
  clipboard.writeText(text);
  await new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "$ws=New-Object -ComObject WScript.Shell; $ws.SendKeys('^v')"], { windowsHide: true, stdio: "ignore" });
    child.once("error", reject); child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`paste helper exited with ${code}`)));
  });
  setTimeout(() => clipboard.writeText(previous), 350);
}

ipcMain.handle("state", () => ({ settings: publicSettings(), recording }));
ipcMain.handle("save-settings", (_event, next) => saveSettings(next));
ipcMain.handle("transcribe", async (_event, audio) => { const text = await transcribe(Buffer.from(audio)); await pasteText(text); return { text }; });
ipcMain.handle("health", async () => { const response = await fetch(`${settings.serverUrl}/health`); return { ok: response.ok, body: await response.json() }; });
ipcMain.handle("show-window", () => showWindow());

app.isQuitting = false;
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on("second-instance", showWindow);
  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => callback(permission === "media" && webContents === mainWindow?.webContents));
    await loadSettings();
    registerShortcut();
    uIOhook.start();
    createWindow();
    tray = new Tray(nativeImage.createEmpty());
    tray.setToolTip("Qwen3 ASR voice typing");
    tray.setContextMenu(Menu.buildFromTemplate([{ label: "Qwen3 ASR", enabled: false }, { label: "Show window", click: showWindow }, { label: "Quit", click: () => app.quit() }]));
    app.setLoginItemSettings({ openAtLogin: settings.startWithWindows, openAsHidden: true });
    app.on("before-quit", () => { app.isQuitting = true; uIOhook.stop(); });
  }).catch((error) => { console.error(error); app.quit(); });
}
