const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("qwenAsr", {
  getState: () => ipcRenderer.invoke("state"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  transcribe: (audio) => ipcRenderer.invoke("transcribe", audio),
  health: () => ipcRenderer.invoke("health"),
  showWindow: () => ipcRenderer.invoke("show-window"),
  onRecordingStart: (handler) => ipcRenderer.on("recording-start", handler),
  onRecordingStop: (handler) => ipcRenderer.on("recording-stop", handler),
});
