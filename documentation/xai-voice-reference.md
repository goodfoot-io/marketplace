#### Inference API

# Voice

## POST /v1/realtime/client\_secrets

Create an ephemeral client secret for authenticating browser-side Realtime API connections.

### Request Body

* `expires_after` (object)

  * `seconds` (integer) — Number of seconds until the client secret expires. Maximum: 3600 (1 hour). Defaults to 600 (10 minutes) when omitted.

* `session` (object | null) — Optional initial session configuration to bind to the client secret. This JSON value is stored alongside the secret and applied when the WebSocket connection opens.

  * `model` ("grok-voice-latest" | "grok-voice-think-fast-1.0" | "grok-voice-fast-1.0") — Model to use for the session. Use grok-voice-latest for the best experience.

### Response Body

* `value` (string, required) — The ephemeral token value. Use as a Bearer token in the WebSocket \`Authorization\` header, or in the \`sec-websocket-protocol\` header with prefix \`xai-client-secret.\`.

* `expires_at` (integer, required) — Unix timestamp (seconds) when this client secret expires.

### Code Examples

```bash
curl -s https://api.x.ai/v1/realtime/client_secrets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "expires_after": {
      "seconds": 300
    }
  }'
```

```javascriptWithoutSDK
const response = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    expires_after: {
      seconds: 300,
    },
  }),
});

const data = await response.json();
console.log(JSON.stringify(data, null, 2));
```

```pythonWithoutSDK
import json
import os

import requests

response = requests.post(
    "https://api.x.ai/v1/realtime/client_secrets",
    headers={
        "Authorization": f"Bearer {os.environ['XAI_API_KEY']}",
        "Content-Type": "application/json",
    },
    json={
        "expires_after": {
            "seconds": 300,
        },
    },
)

print(json.dumps(response.json(), indent=2))
```

\*\*Response example:\*\*

```json
{
  "value": "xai-realtime-client-secret-abc123...",
  "expires_at": 1750000000
}
```

***

## Realtime

WebSocket endpoint: `wss://api.x.ai/v1/realtime`

Real-time voice conversations with Grok models via WebSocket. The connection begins with an HTTP GET that is upgraded to WebSocket (status 101). Once connected, the client and server exchange JSON messages to configure the session, stream audio, and receive responses.

Full schemas and examples: [`/voice-realtime.ws.json`](/voice-realtime.ws.json)

### Query Parameters

* `model` (string, optional, default: grok-voice-latest) — Model to use for the session. Use grok-voice-latest for the best experience.

### Client Messages

* `session.update` — Update session configuration such as system prompt, voice, audio format, turn detection, and tools.

* `input_audio_buffer.append` — Append chunks of base64-encoded audio data to the input buffer. The server does not send back a corresponding message.

* `input_audio_buffer.commit` — Commit the audio buffer as a user message. Only available when \`turn\_detection\` type is \`null\`. Confirmed by \`input\_audio\_buffer.committed\` from the server.

* `conversation.item.create` — Create a new conversation item. Can be a user text message, an assistant text message for history seeding, a function call for seeding tool-use history, or a function call output.

* `input_audio_buffer.clear` — Clear the input audio buffer. Use this to discard any pending audio data without committing it.

* `conversation.item.delete` — Delete a conversation item by ID. The server confirms deletion with a \`conversation.item.deleted\` event.

* `response.create` — Request the server to create a new assistant response. This is handled automatically when using server-side VAD.

* `response.cancel` — Cancel an in-progress response. In VAD mode, interruptions are automatic — use this for manual cancel in non-VAD mode.

### Server Messages

* `session.created` — Sent automatically on WebSocket connection. Contains the session configuration.

* `conversation.created` — The first message on connection. Notifies the client that a conversation session has been created.

* `session.updated` — Acknowledges the client's session.update message that the session has been configured.

* `input_audio_buffer.speech_started` — Notifies that the server's VAD detected the start of speech. Only available with server\_vad turn detection.

* `input_audio_buffer.speech_stopped` — Notifies that the server's VAD detected the end of speech. Only available with server\_vad turn detection.

* `input_audio_buffer.committed` — Input audio buffer has been committed as a user message.

* `input_audio_buffer.cleared` — Confirms the input audio buffer has been cleared.

* `conversation.item.deleted` — Confirms a conversation item has been deleted.

* `conversation.item.added` — A new user or assistant message has been added to the conversation history.

* `conversation.item.input_audio_transcription.completed` — Audio transcription for the user's input has been completed.

* `response.created` — A new assistant response turn is in progress. Audio deltas from this turn share the same response\_id.

* `response.output_item.added` — A new assistant response item is added to the message history.

* `response.output_item.done` — An output item is complete.

* `response.content_part.added` — A content part starts within an output item.

* `response.content_part.done` — A content part finishes.

* `response.output_audio_transcript.delta` — Streaming text transcript delta of the assistant's audio response.

* `response.output_audio_transcript.done` — The audio transcript for this assistant turn has finished generating.

* `response.output_audio.delta` — Streaming base64-encoded audio delta of the assistant's response.

* `response.output_audio.done` — Audio generation for this assistant turn has finished.

* `response.text.delta` — Text-mode output delta (when using text modality).

* `response.function_call_arguments.delta` — Streaming function call arguments.

* `response.function_call_arguments.done` — A function call has been triggered with complete arguments. Your code should execute the function and return results via \`conversation.item.create\` with type \`function\_call\_output\`.

* `mcp_list_tools.in_progress` — MCP tool discovery has started.

* `mcp_list_tools.completed` — MCP tool discovery succeeded.

* `mcp_list_tools.failed` — MCP tool discovery failed.

* `response.mcp_call_arguments.delta` — MCP call arguments streaming.

* `response.mcp_call_arguments.done` — MCP call arguments finalized.

* `response.mcp_call.in_progress` — MCP server HTTP call starting.

* `response.mcp_call.completed` — MCP tool execution succeeded.

* `response.mcp_call.failed` — MCP tool execution failed.

* `response.done` — The assistant's response is completed. Sent after all audio and transcript deltas. Ready for the client to add a new conversation item.

* `error` — Sent when an error occurs. Contains error code and message. Most errors are recoverable and the session stays open.

### Example Message Flow

1. `session.created` (server)

2. `conversation.created` (server)

3. `session.update` (client)

4. `session.updated` (server)

5. `conversation.item.create` (client)

6. `conversation.item.added` (server)

7. `response.create` (client)

8. `response.created` (server)

9. `response.output_item.added` (server)

10. `response.content_part.added` (server)

11. `response.output_audio.delta` (server)

12. `response.output_audio_transcript.delta` (server)

13. `response.output_audio.done` (server)

14. `response.output_audio_transcript.done` (server)

15. `response.content_part.done` (server)

16. `response.output_item.done` (server)

17. `response.done` (server)

***

## POST /v1/tts

Convert text into speech audio.

### Request Body

* `text` (string, required) — The text to convert to speech. Maximum 15,000 characters. Supports inline speech tags for expressive output: \`\[pause]\`, \`\[long-pause]\`, \`\[hum-tune]\`, \`\[laugh]\`, \`\[chuckle]\`, \`\[giggle]\`, \`\[cry]\`, \`\[tsk]\`, \`\[tongue-click]\`, \`\[lip-smack]\`, \`\[breath]\`, \`\[inhale]\`, \`\[exhale]\`, \`\[sigh]\`. Also supports wrapping tags for style control: \`\<soft>\`, \`\<whisper>\`, \`\<loud>\`, \`\<build-intensity>\`, \`\<decrease-intensity>\`, \`\<higher-pitch>\`, \`\<lower-pitch>\`, \`\<slow>\`, \`\<fast>\`, \`\<sing-song>\`, \`\<singing>\`, \`\<laugh-speak>\`, \`\<emphasis>\`.

* `voice_id` (string) — Voice identifier. Use a built-in voice from \`GET /v1/tts/voices\` (e.g. \`eve\`, \`ara\`) or a custom voice ID. Defaults to \`eve\` when omitted.

* `output_format` (object)

  * `codec` ("mp3" | "wav" | "pcm" | "mulaw" | "alaw", required) — Audio codec.

  * `sample_rate` (integer | null) — Sample rate in Hz. Supported values: 8000, 16000, 22050, 24000, 44100, 48000. Defaults to 24000.

  * `bit_rate` (integer | null) — Bit rate in bps. Applies to MP3 codec only. Supported values: 32000, 64000, 96000, 128000, 192000. Defaults to 128000.

* `language` (string, required) — BCP-47 language code (e.g. \`en\`, \`zh\`, \`pt-BR\`) or \`auto\` for automatic language detection. Case-insensitive. Supported values: \`auto\`, \`en\`, \`ar-EG\`, \`ar-SA\`, \`ar-AE\`, \`bn\`, \`zh\`, \`fr\`, \`de\`, \`hi\`, \`id\`, \`it\`, \`ja\`, \`ko\`, \`pt-BR\`, \`pt-PT\`, \`ru\`, \`es-MX\`, \`es-ES\`, \`tr\`, \`vi\`. Additional languages may work with varying accuracy.

* `optimize_streaming_latency` ("0" | "1") — Latency optimization level for streaming synthesis. \`0\` (default): No optimization — best audio quality. \`1\`: Reduced first-chunk size for lower time-to-first-audio, with minor quality tradeoff at chunk boundaries.

* `text_normalization` (boolean) — Enable text normalization before synthesis. When enabled, the model normalizes written-form text (e.g. numbers, abbreviations, symbols) into spoken-form before generating audio.

### Code Examples

```bash
tmpfile=$(mktemp /tmp/tts-output-XXXXXX.mp3)
trap 'rm -f "$tmpfile"' EXIT

http_code=$(curl -s -o "$tmpfile" -w "%{http_code}" \
  https://api.x.ai/v1/tts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "text": "Hello, this is a text-to-speech test from xAI.",
    "voice_id": "eve",
    "language": "en"
  }')

if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
  file_size=$(wc -c < "$tmpfile" | tr -d ' ')
  echo "{\"status\": $http_code, \"audio_bytes\": $file_size}"
else
  cat "$tmpfile"
  exit 1
fi
```

```javascriptWithoutSDK
const response = await fetch("https://api.x.ai/v1/tts", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    text: "Hello, this is a text-to-speech test from xAI.",
    voice_id: "eve",
    language: "en",
  }),
});

if (response.ok) {
  const audioBuffer = await response.arrayBuffer();
  console.log(
    JSON.stringify(
      {
        status: response.status,
        audio_bytes: audioBuffer.byteLength,
        content_type: response.headers.get("content-type") || "",
      },
      null,
      2,
    ),
  );
} else {
  const errorText = await response.text();
  console.error(errorText);
  process.exit(1);
}
```

```pythonWithoutSDK
import json
import os

import requests

response = requests.post(
    "https://api.x.ai/v1/tts",
    headers={
        "Authorization": f"Bearer {os.environ['XAI_API_KEY']}",
        "Content-Type": "application/json",
    },
    json={
        "text": "Hello, this is a text-to-speech test from xAI.",
        "voice_id": "eve",
        "language": "en",
    },
)

if response.ok:
    print(
        json.dumps(
            {
                "status": response.status_code,
                "audio_bytes": len(response.content),
                "content_type": response.headers.get("Content-Type", ""),
            },
            indent=2,
        )
    )
else:
    print(response.text)
    raise SystemExit(1)
```

***

## Text to speech - Streaming

WebSocket endpoint: `wss://api.x.ai/v1/tts`

Bidirectional streaming text-to-speech via WebSocket. Send text incrementally and receive audio chunks in real time. Shares the \`/v1/tts\` path with the batch POST endpoint — a GET with \`Upgrade: websocket\` activates streaming mode. Configuration is done via query parameters at connection time. Supports multi-utterance: after \`audio.done\`, send another stream of \`text.delta\` messages on the same connection.

Full schemas and examples: [`/tts-streaming.ws.json`](/tts-streaming.ws.json)

### Query Parameters

* `voice` (string, optional, default: eve) — Voice identifier. Use a built-in voice from \`GET /v1/tts/voices\` (e.g. \`eve\`, \`ara\`) or a custom voice ID.

* `language` (string, required) — BCP-47 language code (e.g. \`en\`, \`zh\`, \`pt-BR\`) or \`auto\` for automatic language detection. Case-insensitive.

* `codec` (string, optional, default: mp3) — Audio codec for the output.

* `sample_rate` (integer, optional, default: 24000) — Sample rate in Hz.

* `bit_rate` (integer, optional, default: 128000) — Bit rate in bps. Only applies when \`codec\` is \`mp3\`.

* `optimize_streaming_latency` (integer, optional, default: 0) — Latency optimization level. \`0\` (default): No optimization — best audio quality. \`1\`: Reduced first-chunk size for lower time-to-first-audio, with minor quality tradeoff at chunk boundaries.

* `text_normalization` (boolean, optional, default: false) — Enable text normalization before synthesis. When enabled, the model normalizes written-form text (e.g. numbers, abbreviations, symbols) into spoken-form before generating audio.

### Client Messages

* `text.delta` — Send a chunk of text to be synthesized. Text is processed incrementally — audio generation begins as soon as enough text is buffered. Individual deltas are capped at 15,000 characters.

* `text.done` — Signal that all text for this utterance has been sent. The server will finish generating audio and send \`audio.done\`. After receiving \`audio.done\`, you can start a new utterance with another \`text.delta\`.

### Server Messages

* `audio.delta` — A chunk of base64-encoded audio data. Decode and append to your audio buffer or pipe directly to playback. The format matches the \`codec\` and \`sample\_rate\` specified in the query parameters.

* `audio.done` — Audio generation for this utterance is complete. The connection remains open for multi-utterance — send another \`text.delta\` to start a new synthesis, or close the connection.

* `error` — An error occurred during synthesis. The connection may be closed after this message.

### Example Message Flow

1. `text.delta` (client)

2. `text.delta` (client)

3. `text.done` (client)

4. `audio.delta` (server)

5. `audio.delta` (server)

6. `audio.delta` (server)

7. `audio.done` (server)

***

## GET /v1/tts/voices

List all available TTS voices.

### Response Body

* `voices` (array\<object>, required) — List of available voices.

  * `voice_id` (string, required) — Unique identifier for the voice (lowercase). Pass this value as \`voice\_id\` in TTS requests or as the \`voice\` parameter in Realtime API session configuration.

  * `name` (string, required) — Human-readable display name for the voice.

  * `language` (string | null) — Language code for the voice (e.g. \`en\`).

### Code Examples

```bash
curl -s https://api.x.ai/v1/tts/voices \
  -H "Authorization: Bearer $XAI_API_KEY"
```

```javascriptWithoutSDK
const response = await fetch("https://api.x.ai/v1/tts/voices", {
  headers: {
    Authorization: `Bearer ${process.env.XAI_API_KEY}`,
  },
});

const data = await response.json();
console.log(JSON.stringify(data, null, 2));
```

```pythonWithoutSDK
import json
import os

import requests

response = requests.get(
    "https://api.x.ai/v1/tts/voices",
    headers={
        "Authorization": f"Bearer {os.environ['XAI_API_KEY']}",
    },
)

print(json.dumps(response.json(), indent=2))
```

\*\*Response example:\*\*

```json
{
  "voices": [
    {
      "voice_id": "ara",
      "name": "Ara",
      "language": "en"
    },
    {
      "voice_id": "eve",
      "name": "Eve",
      "language": "en"
    },
    {
      "voice_id": "leo",
      "name": "Leo",
      "language": "en"
    },
    {
      "voice_id": "rex",
      "name": "Rex",
      "language": "en"
    },
    {
      "voice_id": "sal",
      "name": "Sal",
      "language": "en"
    }
  ]
}
```

***

## GET /v1/tts/voices/\{voice\_id}

Get details for a specific voice.

### Path Parameters

* `voice_id` (string, required) — The unique identifier of the voice (e.g. \`eve\`, \`ara\`).

### Response Body

* `voice_id` (string, required) — Unique identifier for the voice (lowercase). Pass this value as \`voice\_id\` in TTS requests or as the \`voice\` parameter in Realtime API session configuration.

* `name` (string, required) — Human-readable display name for the voice.

* `language` (string | null) — Language code for the voice (e.g. \`en\`).

### Code Examples

```bash
curl -s https://api.x.ai/v1/tts/voices/eve \
  -H "Authorization: Bearer $XAI_API_KEY"
```

```javascriptWithoutSDK
const voiceId = "eve";

const response = await fetch(`https://api.x.ai/v1/tts/voices/${voiceId}`, {
  headers: {
    Authorization: `Bearer ${process.env.XAI_API_KEY}`,
  },
});

const data = await response.json();
console.log(JSON.stringify(data, null, 2));
```

```pythonWithoutSDK
import json
import os

import requests

voice_id = "eve"

response = requests.get(
    f"https://api.x.ai/v1/tts/voices/{voice_id}",
    headers={
        "Authorization": f"Bearer {os.environ['XAI_API_KEY']}",
    },
)

print(json.dumps(response.json(), indent=2))
```

\*\*Response example:\*\*

```json
{
  "voice_id": "eve",
  "name": "Eve",
  "language": "en"
}
```

***

## POST /v1/stt

Transcribe an audio file to text.

### Request Body

* `file` (string) — Audio file to transcribe. Maximum size: 500 MB. Supported container formats (auto-detected): \`wav\`, \`mp3\`, \`ogg\`, \`opus\`, \`flac\`, \`aac\`, \`mp4\`, \`m4a\`, \`mkv\` (MP3/AAC/FLAC codecs only). Supported raw formats (requires \`audio\_format\` and \`sample\_rate\`): \`pcm\`, \`mulaw\`, \`alaw\`. Must be the last field in the multipart form.

* `url` (string) — URL of an audio file to download and transcribe (server-side). Either \`file\` or \`url\` must be provided.

* `audio_format` ("pcm" | "mulaw" | "alaw" | "wav" | "mp3" | "ogg" | "opus" | "flac" | "aac" | "mp4" | "m4a" | "mkv") — Audio format hint. \*\*Only required for raw/headerless formats\*\* (\`pcm\`, \`mulaw\`, \`alaw\`). For container formats (MP3, WAV, OGG, etc.) the server auto-detects the format from the file header — do not set this field.

* `sample_rate` ("8000" | "16000" | "22050" | "24000" | "44100" | "48000") — Audio sample rate in Hz. \*\*Required when \`audio\_format\` is a raw format\*\* (\`pcm\`, \`mulaw\`, \`alaw\`). Ignored for container formats. Either \`sample\_rate\` or \`sample\_rate\_hertz\` may be used.

* `language` (string) — Language code for the audio (e.g. \`en\`, \`fr\`, \`de\`, \`ja\`). When set together with \`format=true\`, enables Inverse Text Normalization — spoken-form numbers, currencies, and units are converted to their written form.

* `format` ("true" | "false") — When \`true\`, enables text formatting. Requires \`language\` to be set.

* `multichannel` ("true" | "false") — When \`true\`, enables per-channel transcription. Each audio channel is transcribed independently and results are returned in the \`channels\` array.

* `channels` (integer) — Number of audio channels. Required for multichannel raw audio (min 2, max 8). For container formats, the channel count is auto-detected from the file header.

* `diarize` ("true" | "false") — When \`true\`, enables speaker diarization. Each word in the response includes a \`speaker\` field (integer) identifying the detected speaker.

* `keyterm` (array\<string>) — Key terms to bias transcription toward (e.g. product names, proper nouns). Repeat the field for each term (e.g. \`keyterm=Understand+The+Universe\`). Max 100 terms, each up to 50 characters.

* `filler_words` ("true" | "false") — When \`true\`, filler words (e.g. "uh", "um", "er") are included in the transcript. When \`false\` (default), filler words are automatically removed from the transcript text and the \`words\` array.

### Response Body

* `text` (string, required) — Full transcript text. For multichannel requests, this is a merged transcript across all channels (words interleaved by timestamp).

* `language` (string, required) — Detected language code (ISO 639-1, e.g. \`en\`). Currently empty — language detection is not yet enabled.

* `duration` (number, required) — Audio duration in seconds (rounded to 2 decimal places).

* `words` (array\<object>) — Word-level segments with timestamps. Omitted when empty.

  * `text` (string, required) — The word text.

  * `start` (number, required) — Word start time in seconds (2 d.p.).

  * `end` (number, required) — Word end time in seconds (2 d.p.).

  * `confidence` (number) — Confidence score (0.0–1.0, entropy-based). Omitted when 0.

  * `speaker` (integer) — Speaker index (0-based). Only present when \`diarize=true\`.

* `channels` (array\<object>) — Per-channel transcripts. Only present when \`multichannel=true\`. Omitted for single-channel audio.

  * `index` (integer, required) — Zero-based channel index in the source audio.

  * `language` (string) — Detected language code for this channel. Currently empty.

  * `text` (string, required) — Full transcript text for this channel.

  * `words` (array\<object>) — Word-level segments with timestamps for this channel.

    * `text` (string, required) — The word text.

    * `start` (number, required) — Word start time in seconds (2 d.p.).

    * `end` (number, required) — Word end time in seconds (2 d.p.).

    * `confidence` (number) — Confidence score (0.0–1.0, entropy-based). Omitted when 0.

    * `speaker` (integer) — Speaker index (0-based). Only present when \`diarize=true\`.

\*\*Response example:\*\*

```json
{
  "text": "The balance is $167,983.15. That is $23.4 kilograms.",
  "language": "",
  "duration": 8.4,
  "words": [
    {
      "text": "The",
      "start": 0,
      "end": 0.24,
      "confidence": 0.33
    },
    {
      "text": "balance",
      "start": 0.24,
      "end": 0.64,
      "confidence": 0.67
    },
    {
      "text": "is",
      "start": 0.64,
      "end": 0.88,
      "confidence": 0.41
    },
    {
      "text": "$167,983.15.",
      "start": 0.88,
      "end": 4.8,
      "confidence": 0.07
    },
    {
      "text": "That",
      "start": 6.16,
      "end": 6.48,
      "confidence": 0.29
    },
    {
      "text": "is",
      "start": 6.48,
      "end": 6.64,
      "confidence": 0.4
    },
    {
      "text": "$23.4",
      "start": 6.64,
      "end": 7.52,
      "confidence": 0.07
    },
    {
      "text": "kilograms.",
      "start": 7.76,
      "end": 8.4,
      "confidence": 0.09
    }
  ]
}
```

***

## Speech to text - Streaming

WebSocket endpoint: `wss://api.x.ai/v1/stt`

Real-time streaming speech-to-text via WebSocket. Stream raw audio as binary frames and receive JSON transcript events as the audio is processed. Configuration is done via query parameters at connection time. Each connection handles a single utterance — reconnect to transcribe another.

Full schemas and examples: [`/stt-streaming.ws.json`](/stt-streaming.ws.json)

### Query Parameters

* `sample_rate` (integer, optional, default: 16000) — Audio sample rate in Hz. Supported values: \`8000\`, \`16000\`, \`22050\`, \`24000\`, \`44100\`, \`48000\`.

* `encoding` (string, optional, default: pcm) — Audio encoding format. \`pcm\` — signed 16-bit little-endian (2 bytes/sample). \`mulaw\` — G.711 µ-law (1 byte/sample). \`alaw\` — G.711 A-law (1 byte/sample).

* `interim_results` (boolean, optional, default: false) — When \`true\`, the server emits partial transcript events (\`is\_final=false\`) approximately every 500 ms while audio is being processed. When \`false\` (default), only finalized results are sent.

* `endpointing` (integer, optional, default: 10) — Silence duration in milliseconds before the server fires a \`speech\_final=true\` event, indicating the speaker stopped talking. Range: 0–5000. Set to \`0\` for no delay (fire on any VAD silence boundary). Default: 10ms.

* `language` (string, optional, default: ) — Language code (e.g. \`en\`, \`fr\`, \`de\`, \`ja\`). When set, enables Inverse Text Normalization — spoken-form numbers, currencies, and units are converted to their written form.

* `multichannel` (boolean, optional, default: false) — When \`true\`, enables per-channel transcription for interleaved multichannel audio. Requires \`channels\` to be set to ≥ 2.

* `channels` (integer, optional, default: 1) — Number of interleaved audio channels. Required when \`multichannel=true\`. Min: 2, Max: 8.

* `diarize` (boolean, optional, default: false) — When \`true\`, enables speaker diarization. Words in \`transcript.partial\` and \`transcript.done\` events include a \`speaker\` field (integer) identifying the detected speaker.

* `keyterm` (string (repeatable), optional) — A key term to bias transcription toward (e.g. product names, proper nouns). Repeat the parameter for each term (e.g. \`keyterm=Understand+The+Universe\`). Max 100 terms, each up to 50 characters.

* `filler_words` (boolean, optional, default: false) — When \`true\`, filler words (e.g. \`uh\`, \`um\`, \`er\`) are included in the transcript. When \`false\` (default), filler words are automatically removed from the transcript text and the \`words\` array.

### Client Messages

* `Binary frame (audio)` — Send raw audio as binary WebSocket frames in the encoding specified by the \`encoding\` query parameter. Audio should be streamed in real-time-paced chunks (e.g. 100 ms at a time). No base64 encoding — send raw bytes directly.

* `audio.done` — Signal that all audio has been sent. The server flushes any remaining buffered audio, emits final transcript events, and sends a \`transcript.done\` event. The connection closes after \`transcript.done\`.

### Server Messages

* `transcript.created` — Sent immediately after the WebSocket connection is established and the server is ready to receive audio. \*\*Wait for this event before sending audio\*\* — the server needs to initialize its ASR backend.

* `transcript.partial` — A transcript result for a portion of the audio stream. Two boolean fields convey state: interim (\`is\_final=false\`) means text may still change, chunk final (\`is\_final=true\`, \`speech\_final=false\`) means the chunk is locked, and utterance final (\`is\_final=true\`, \`speech\_final=true\`) means the speaker stopped talking.

* `transcript.done` — Final transcript after \`audio.done\`. \`duration\` always present. One per channel when \`multichannel=true\`. Connection closes after this event.

* `error` — An error occurred during the session. Most errors (pipeline failures, stream timeouts) close the connection. Only client message parse errors keep the connection open.

### Example Message Flow

1. `transcript.created` (server)

2. `Binary frame (audio)` (client)

3. `Binary frame (audio)` (client)

4. `transcript.partial` (server)

5. `Binary frame (audio)` (client)

6. `transcript.partial` (server)

7. `Binary frame (audio)` (client)

8. `transcript.partial` (server)

9. `audio.done` (client)

10. `transcript.done` (server)

***

## POST /v1/custom-voices

Create a custom voice from a reference audio clip.

### Request Body

* `file` (string, required) — Reference audio file. Maximum duration: 120 seconds. Supported formats: WAV, MP3, FLAC, OGG, Opus, M4A, AAC, MKV, MP4 (anything \`ffmpeg\` can decode).

* `name` (string) — Display name for the voice. Shown in the console and returned by \`GET /v1/custom-voices\`.

* `description` (string) — Free-text description of the voice.

* `gender` ("male" | "female" | "neutral") — Voice gender label.

* `accent` (string) — Free-text accent label (e.g. \`British\`, \`American\`).

* `age` ("young" | "middle-aged" | "old") — Voice age label.

* `language` (string) — ISO 639 language code (e.g. \`en\`) or BCP-47-style code (e.g. \`en-US\`, \`zh-CN\`). Region must be uppercase.

* `use_case` ("conversational" | "narration" | "characters" | "educational" | "advertisement" | "social\_media" | "entertainment") — Intended use case label.

* `tone` ("warm" | "casual" | "professional" | "friendly" | "authoritative" | "expressive" | "calm") — Tonal label.

### Response Body

* `voice_id` (string, required) — 8-character lowercase alphanumeric voice identifier. Use this as \`voice\_id\` in \`POST /v1/tts\`, as the \`voice\` query parameter on the streaming TTS WebSocket, or as \`voice\` in a Voice Agent \`session.update\` message.

* `name` (string | null) — Display name.

* `description` (string | null) — Free-text description.

* `gender` ("male" | "female" | "neutral" | "null") — Voice gender label.

* `accent` (string | null) — Free-text accent label.

* `age` ("young" | "middle-aged" | "old" | "null") — Voice age label.

* `language` (string | null) — ISO 639 / BCP-47 language code.

* `use_case` (string | null) — Intended use case label.

* `tone` (string | null) — Tonal label.

* `created_at` (string, required) — RFC 3339 timestamp.

### Code Examples

```bash
curl -s https://api.x.ai/v1/custom-voices \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -F "name=Friendly Narrator" \
  -F "language=en" \
  -F "gender=female" \
  -F "tone=warm" \
  -F "use_case=narration" \
  -F "file=@reference.wav;type=audio/wav"
```

```javascriptWithoutSDK
import fs from 'fs';

const form = new FormData();
form.append('file', new Blob([fs.readFileSync('reference.wav')]), 'reference.wav');
form.append('name', 'Friendly Narrator');
form.append('language', 'en');
form.append('gender', 'female');
form.append('tone', 'warm');
form.append('use_case', 'narration');

const response = await fetch('https://api.x.ai/v1/custom-voices', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` },
  body: form,
});

console.log(JSON.stringify(await response.json(), null, 2));
```

```pythonWithoutSDK
import json
import os

import requests

with open("reference.wav", "rb") as f:
    response = requests.post(
        "https://api.x.ai/v1/custom-voices",
        headers={"Authorization": f"Bearer {os.environ['XAI_API_KEY']}"},
        files={"file": ("reference.wav", f, "audio/wav")},
        data={
            "name": "Friendly Narrator",
            "language": "en",
            "gender": "female",
            "tone": "warm",
            "use_case": "narration",
        },
    )

print(json.dumps(response.json(), indent=2))
```

\*\*Response example:\*\*

```json
{
  "voice_id": "nlbqfwie",
  "name": "Friendly Narrator",
  "description": "Warm, conversational tone for narration.",
  "gender": "female",
  "accent": "American",
  "age": "young",
  "language": "en",
  "use_case": "narration",
  "tone": "warm",
  "created_at": "2026-04-26T18:56:34.872993+00:00"
}
```

***

## GET /v1/custom-voices

List custom voices owned by your team.

### Query Parameters

* `limit` (integer) — Maximum number of voices to return per page. Range: 1-1000. Default: 100.

* `pagination_token` (string) — Token from a previous response's \`pagination\_token\` field. Pass to fetch the next page.

### Response Body

* `voices` (array\<object>, required) — List of custom voices owned by the calling team.

  * `voice_id` (string, required) — 8-character lowercase alphanumeric voice identifier. Use this as \`voice\_id\` in \`POST /v1/tts\`, as the \`voice\` query parameter on the streaming TTS WebSocket, or as \`voice\` in a Voice Agent \`session.update\` message.

  * `name` (string | null) — Display name.

  * `description` (string | null) — Free-text description.

  * `gender` ("male" | "female" | "neutral" | "null") — Voice gender label.

  * `accent` (string | null) — Free-text accent label.

  * `age` ("young" | "middle-aged" | "old" | "null") — Voice age label.

  * `language` (string | null) — ISO 639 / BCP-47 language code.

  * `use_case` (string | null) — Intended use case label.

  * `tone` (string | null) — Tonal label.

  * `created_at` (string, required) — RFC 3339 timestamp.

* `pagination_token` (string | null) — Opaque token to fetch the next page. Absent when there are no more results.

### Code Examples

```bash
curl -s https://api.x.ai/v1/custom-voices \
  -H "Authorization: Bearer $XAI_API_KEY"
```

```javascriptWithoutSDK
const response = await fetch('https://api.x.ai/v1/custom-voices', {
  headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` },
});

console.log(JSON.stringify(await response.json(), null, 2));
```

```pythonWithoutSDK
import json
import os

import requests

response = requests.get(
    "https://api.x.ai/v1/custom-voices",
    headers={"Authorization": f"Bearer {os.environ['XAI_API_KEY']}"},
)

print(json.dumps(response.json(), indent=2))
```

\*\*Response example:\*\*

```json
{
  "voices": [
    {
      "voice_id": "nlbqfwie",
      "name": "Friendly Narrator",
      "description": "Warm, conversational tone for narration.",
      "gender": "female",
      "accent": "American",
      "age": "young",
      "language": "en",
      "use_case": "narration",
      "tone": "warm",
      "created_at": "2026-04-26T18:56:34.872993+00:00"
    },
    {
      "voice_id": "k17hrosg",
      "name": "Phone Agent",
      "description": null,
      "gender": "male",
      "accent": null,
      "age": null,
      "language": "en",
      "use_case": "conversational",
      "tone": "professional",
      "created_at": "2026-04-23T06:20:31.784256+00:00"
    }
  ],
  "pagination_token": null
}
```

***

## GET /v1/custom-voices/\{voice\_id}

Get a single custom voice.

### Path Parameters

* `voice_id` (string, required) — The 8-character lowercase alphanumeric custom voice ID returned by \`POST /v1/custom-voices\`.

### Response Body

* `voice_id` (string, required) — 8-character lowercase alphanumeric voice identifier. Use this as \`voice\_id\` in \`POST /v1/tts\`, as the \`voice\` query parameter on the streaming TTS WebSocket, or as \`voice\` in a Voice Agent \`session.update\` message.

* `name` (string | null) — Display name.

* `description` (string | null) — Free-text description.

* `gender` ("male" | "female" | "neutral" | "null") — Voice gender label.

* `accent` (string | null) — Free-text accent label.

* `age` ("young" | "middle-aged" | "old" | "null") — Voice age label.

* `language` (string | null) — ISO 639 / BCP-47 language code.

* `use_case` (string | null) — Intended use case label.

* `tone` (string | null) — Tonal label.

* `created_at` (string, required) — RFC 3339 timestamp.

### Code Examples

```bash
curl -s https://api.x.ai/v1/custom-voices/nlbqfwie \
  -H "Authorization: Bearer $XAI_API_KEY"
```

```javascriptWithoutSDK
const response = await fetch('https://api.x.ai/v1/custom-voices/nlbqfwie', {
  headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` },
});

console.log(JSON.stringify(await response.json(), null, 2));
```

```pythonWithoutSDK
import json
import os

import requests

response = requests.get(
    "https://api.x.ai/v1/custom-voices/nlbqfwie",
    headers={"Authorization": f"Bearer {os.environ['XAI_API_KEY']}"},
)

print(json.dumps(response.json(), indent=2))
```

\*\*Response example:\*\*

```json
{
  "voice_id": "nlbqfwie",
  "name": "Friendly Narrator",
  "description": "Warm, conversational tone for narration.",
  "gender": "female",
  "accent": "American",
  "age": "young",
  "language": "en",
  "use_case": "narration",
  "tone": "warm",
  "created_at": "2026-04-26T18:56:34.872993+00:00"
}
```

***

## PATCH /v1/custom-voices/\{voice\_id}

Update custom voice metadata.

### Path Parameters

* `voice_id` (string, required)

### Request Body

* `name` (string | null)

* `description` (string | null)

* `gender` ("male" | "female" | "neutral" | "null")

* `accent` (string | null)

* `age` ("young" | "middle-aged" | "old" | "null")

* `language` (string | null)

* `use_case` ("conversational" | "narration" | "characters" | "educational" | "advertisement" | "social\_media" | "entertainment" | "null")

* `tone` ("warm" | "casual" | "professional" | "friendly" | "authoritative" | "expressive" | "calm" | "null")

### Response Body

* `voice_id` (string, required) — 8-character lowercase alphanumeric voice identifier. Use this as \`voice\_id\` in \`POST /v1/tts\`, as the \`voice\` query parameter on the streaming TTS WebSocket, or as \`voice\` in a Voice Agent \`session.update\` message.

* `name` (string | null) — Display name.

* `description` (string | null) — Free-text description.

* `gender` ("male" | "female" | "neutral" | "null") — Voice gender label.

* `accent` (string | null) — Free-text accent label.

* `age` ("young" | "middle-aged" | "old" | "null") — Voice age label.

* `language` (string | null) — ISO 639 / BCP-47 language code.

* `use_case` (string | null) — Intended use case label.

* `tone` (string | null) — Tonal label.

* `created_at` (string, required) — RFC 3339 timestamp.

### Code Examples

```bash
curl -s -X PATCH https://api.x.ai/v1/custom-voices/nlbqfwie \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated after a tuning pass.",
    "tone": "calm"
  }'
```

```javascriptWithoutSDK
const response = await fetch('https://api.x.ai/v1/custom-voices/nlbqfwie', {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    description: 'Updated after a tuning pass.',
    tone: 'calm',
  }),
});

console.log(JSON.stringify(await response.json(), null, 2));
```

```pythonWithoutSDK
import json
import os

import requests

response = requests.patch(
    "https://api.x.ai/v1/custom-voices/nlbqfwie",
    headers={
        "Authorization": f"Bearer {os.environ['XAI_API_KEY']}",
        "Content-Type": "application/json",
    },
    json={
        "description": "Updated after a tuning pass.",
        "tone": "calm",
    },
)

print(json.dumps(response.json(), indent=2))
```

\*\*Response example:\*\*

```json
{
  "voice_id": "nlbqfwie",
  "name": "Friendly Narrator",
  "description": "Updated after a tuning pass.",
  "gender": "female",
  "accent": "American",
  "age": "young",
  "language": "en",
  "use_case": "narration",
  "tone": "calm",
  "created_at": "2026-04-26T18:56:34.872993+00:00"
}
```

***

## DELETE /v1/custom-voices/\{voice\_id}

Delete a custom voice.

### Path Parameters

* `voice_id` (string, required)

### Response Body

* `deleted` (boolean, required) — Always \`true\` on success.

### Code Examples

```bash
curl -s -X DELETE https://api.x.ai/v1/custom-voices/nlbqfwie \
  -H "Authorization: Bearer $XAI_API_KEY"
```

```javascriptWithoutSDK
const response = await fetch('https://api.x.ai/v1/custom-voices/nlbqfwie', {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` },
});

console.log(JSON.stringify(await response.json(), null, 2));
```

```pythonWithoutSDK
import json
import os

import requests

response = requests.delete(
    "https://api.x.ai/v1/custom-voices/nlbqfwie",
    headers={"Authorization": f"Bearer {os.environ['XAI_API_KEY']}"},
)

print(json.dumps(response.json(), indent=2))
```

\*\*Response example:\*\*

```json
{
  "deleted": true
}
```

***

## GET /v1/custom-voices/\{voice\_id}/audio

Download the reference audio for a custom voice.

### Path Parameters

* `voice_id` (string, required)

### Code Examples

```bash
curl -s https://api.x.ai/v1/custom-voices/nlbqfwie/audio \
  -H "Authorization: Bearer $XAI_API_KEY" \
  --output reference.wav
```

```javascriptWithoutSDK
const response = await fetch('https://api.x.ai/v1/custom-voices/nlbqfwie/audio', {
  headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` },
});

const audioBuffer = await response.arrayBuffer();
console.log(
  JSON.stringify(
    {
      status: response.status,
      audio_bytes: audioBuffer.byteLength,
      content_type: response.headers.get('content-type') || '',
    },
    null,
    2,
  ),
);
```

```pythonWithoutSDK
import json
import os

import requests

response = requests.get(
    "https://api.x.ai/v1/custom-voices/nlbqfwie/audio",
    headers={"Authorization": f"Bearer {os.environ['XAI_API_KEY']}"},
)

print(
    json.dumps(
        {
            "status": response.status_code,
            "audio_bytes": len(response.content),
            "content_type": response.headers.get("Content-Type", ""),
        },
        indent=2,
    )
)
```