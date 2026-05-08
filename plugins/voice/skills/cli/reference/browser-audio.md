Use when the browser hasn't connected or audio isn't ready.

## Diagnose

```xml
<invoke name="Bash">
<parameter name="command">voice status</parameter>
</invoke>
```

Key fields in the response:
- `browserClient` — `"none"` or `"connected"`
- `browserClient.audio.permission` — `"unknown"` | `"prompt"` | `"granted"` | `"denied"`
- `browserClient.audio.ready` — `true` when a mic is selected and available

## Subroutines

### §BROWSER_NOT_OPEN
**When:** `browserClient` is `"none"`.
Tell the user to open their browser to the URL shown at skill load. The conversation cannot start until the browser connects.

### §MIC_PERMISSION
**When:** `browserClient.audio.permission` is `"denied"` or `"prompt"`.
Tell the user to grant microphone permission in their browser — camera/mic icon in the address bar. The page may need a refresh after granting.

### §AUDIO_NOT_READY
**When:** `browserClient.audio.ready` is `false` but permission is `"granted"`.
Tell the user to select a microphone in the voice console settings (gear icon). If no devices appear, ask them to check that a microphone is connected and recognised by the OS.

### §AUDIO_ERROR
**When:** `event` is `browser.audio.error`.
Show `data.error` to the user. Run diagnose and apply §MIC_PERMISSION or §AUDIO_NOT_READY as appropriate.

## Events

### `browser.client.connected`
```typescript
{ clientId: string; connectedAt: string }
```

### `browser.client.disconnected`
```typescript
{ clientId: string; disconnectedAt: string }
```

### `browser.audio.deviceChange`
```typescript
{
  clientId: string;
  audio: {
    permission: "unknown" | "prompt" | "granted" | "denied";
    devices: { deviceId: string; label: string }[];
    selectedDeviceId?: string;
    ready: boolean;
  };
  createdAt: string;
}
```

### `browser.audio.error`
```typescript
{ clientId?: string; error: RealtimeVoiceServerError; createdAt: string }
```
