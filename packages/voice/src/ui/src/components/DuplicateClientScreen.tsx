/**
 * Q11: rendered instead of the whole app when `ui.duplicateClient` is true.
 * Pure render — `voiceSessionRunner` already performed audio teardown
 * synchronously in its `host/duplicate-client` listener before this mounts.
 */
export function DuplicateClientScreen(): React.JSX.Element {
  return (
    <main className="duplicate-page">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10" />
        <path d="m4.9 4.9 14.2 14.2" />
      </svg>
      <h1>Session unavailable</h1>
      <p>
        Another browser window is already connected to this Voice Agent. Close the other session
        and refresh this page.
      </p>
    </main>
  );
}
