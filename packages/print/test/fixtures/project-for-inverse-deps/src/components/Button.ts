import { capitalize } from "../utils/helpers";
import { ComponentBase } from "./ComponentBase";

export class Button extends ComponentBase {
  constructor(private label: string) {
    super("button");
  }

  render() {
    const formattedLabel = capitalize(this.label);
    console.log(`<button>${formattedLabel}</button>`);
  }
}
