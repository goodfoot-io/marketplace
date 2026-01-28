import { Button, createButton } from "./Button.js";
import { Widget } from "./Widget.js";

/**
 * Form component containing multiple widgets
 */
export class Form {
  private widgets: Widget[] = [];
  private submitButton: Button;

  constructor(name: string) {
    this.submitButton = createButton("Submit");
    this.submitButton.setName(name);
  }

  /**
   * Add a widget to the form
   */
  addWidget(widget: Widget): void {
    this.widgets.push(widget);
  }

  /**
   * Render the form
   */
  render(): string {
    const widgetHtml = this.widgets.map((w) => w.render()).join("\n");
    const buttonHtml = this.submitButton.render();
    return `<form>\n${widgetHtml}\n${buttonHtml}\n</form>`;
  }

  /**
   * Submit the form
   */
  submit(): void {
    this.submitButton.click();
  }
}
