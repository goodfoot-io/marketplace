import { Widget } from "./Widget.js";

/**
 * Button widget that extends Widget
 */
export class Button extends Widget {
  private onClick: () => void;

  constructor(label: string, onClick: () => void) {
    super(label);
    this.onClick = onClick;
  }

  /**
   * Override render to show button-specific markup
   */
  render(): string {
    const baseName = this.getName();
    return `<button>${baseName}</button>`;
  }

  /**
   * Handle click event
   */
  click(): void {
    this.onClick();
  }
}

/**
 * Create a button with a default handler
 */
export function createButton(label: string): Button {
  return new Button(label, () => console.log("clicked"));
}
