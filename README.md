# Qwen3 ASR Desktop

A Windows 11 tray app for voice typing with a Qwen3-ASR server. Hold a configurable, modifier-based shortcut, speak, release it, and the transcript is pasted into the application that was focused before recording.

## Status

Version 0.1.0 is an early Windows release. It provides a secure Electron shell, hold-to-talk shortcut capture and conflict checks, microphone capture encoded as WAV, authenticated transcription, clipboard paste, and local settings.

## Requirements

- Windows 11
- Node.js 22 or newer for development
- A reachable Qwen3-ASR server exposing `/v1/audio/transcriptions`
- An ASR bearer token, if required by the server

## Development

```powershell
npm ci
npm test
npm start
```

On first launch, enter the ASR server URL and API key in Settings. The default URL is `http://localhost:8765`; LAN or remote servers can be entered directly in the app. The API key is encrypted with Windows-protected storage and is never sent to the renderer or committed to the repository.

The default shortcut is `Ctrl+Alt+Shift+Space`. It requires at least one modifier and refuses common Windows-reserved combinations. The app verifies registration with Windows and keeps the previous shortcut when registration fails.

## Safety and limitations

The app uses Electron context isolation, disabled Node integration, sandboxing, a restrictive CSP, and a narrow preload API. Clipboard contents are restored after automatic paste when possible. Elevated applications may require separate testing because Windows input and clipboard boundaries can differ across privilege levels.

## Packaging

```powershell
npm run dist:dir
```

This creates an unpacked Windows build under `dist/win-unpacked`. Code signing and installer smoke testing are not included in this release.

## License

MIT. See [LICENSE](LICENSE).
