/** Q6: animated three-dot "thinking" strip, rendered inside the modal only. */
export function ThinkingDots(): React.JSX.Element {
  return (
    <div className="thinking" aria-live="polite" aria-label="Assistant is responding">
      <span className="tdot" />
      <span className="tdot" />
      <span className="tdot" />
    </div>
  );
}
