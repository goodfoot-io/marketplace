import { capitalize } from "../utils/strings.js";

/**
 * Base widget class
 */
export class Widget {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Render the widget to a string
   */
  render(): string {
    return `<widget>${capitalize(this.name)}</widget>`;
  }

  /**
   * Get the widget name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Update the widget name
   */
  setName(name: string): void {
    this.name = name;
  }
}
