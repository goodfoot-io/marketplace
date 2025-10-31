# Changelog

## 0.1.13

- Added configurable session TTL via `BROWSER_SESSION_TTL_MS` environment variable (default: 5 minutes)
- Added automatic idle timeout for chrome-proxy via `CHROME_PROXY_IDLE_TIMEOUT_MS` environment variable (default: 5 minutes)
- Enhanced session cleanup with improved logging when sessions expire
- Added activity tracking to chrome-proxy to prevent resource leaks from stale browser sessions
- Automatic chrome-proxy shutdown when no activity detected, preventing frozen browser sessions
- Added comprehensive tests for session TTL and idle timeout functionality
- Updated documentation with troubleshooting guide for browser session freezing issues

## 0.1.12

- Minor improvements and bug fixes

## 0.1.10

- Added `chrome-proxy` command for managing Chrome remote debugging connections
- Improved browser connection by auto-detecting primary external IP when `--browserUrl` is not specified

## 0.1.8

- Fixed compatibility with NPX by resolving symlinks in auto-start detection

## 0.1.6

- Fixed package installation issues that prevented the MCP server from reconnecting properly

## 0.1.4

- Minor improvements and bug fixes

## 0.1.2

- Initial release of browser automation MCP server with Chrome DevTools Protocol support
- Added automated browser task execution capabilities for navigation, interaction, and screenshots
- Enhanced package configuration for improved TypeScript compatibility and npm distribution

## 0.1.0

- Initial release of browser automation MCP server using Chrome DevTools Protocol
- Added support for page navigation, element interaction, and screenshot capture
- Added session-based browser automation with conversation continuity
