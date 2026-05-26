# Changelog

## 0.1.1
- Added a browser-based HTML stage that renders custom content alongside voice conversations, controllable via the `voice html` CLI command and a bidirectional update channel
- Added an MCP server enabling channel notifications, HTML stage control, and conversation steering
- Migrated the voice engine from OpenAI Realtime to the xAI Voice Agent
- Improved transcript display so messages render in logical order rather than by event-arrival timing, and coalesced streaming user-speech transcript updates
- Fixed conversation reset handling so sessions reliably auto-open, recover audio after reset, and no longer go silent on mid-conversation teardown
- Fixed a reload issue that left zombie sessions, plus placeholder UX and startup input handling
- Improved interrupt and pause detection for more natural turn-taking

