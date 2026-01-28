// Main entry point that uses various components
import { add, sum } from "./utils/math.js";
import { capitalize } from "./utils/strings.js";
import { Button, createButton } from "./components/Button.js";
import { Form } from "./components/Form.js";
import { Widget } from "./components/Widget.js";
import { Calculator, quickAdd } from "./services/calculator.js";
import { formatUser, formatNames } from "./services/formatter.js";

/**
 * Main application function
 */
export function main(): void {
  // Use add function
  const result = add(1, 2);
  console.log("Add result:", result);

  // Use sum with array
  const total = sum([1, 2, 3, 4, 5]);
  console.log("Sum:", total);

  // Use capitalize
  const name = capitalize("hello");
  console.log("Capitalized:", name);

  // Use createButton
  const button = createButton("Click me");
  button.render();

  // Use Widget directly
  const widget = new Widget("test");
  widget.render();
  widget.getName();

  // Use Form
  const form = new Form("my-form");
  form.addWidget(widget);
  form.render();

  // Use Calculator
  const calc = new Calculator();
  calc.addDirect(1, 2);

  // Use quickAdd
  quickAdd(5, 10);

  // Use formatUser
  formatUser({ firstName: "john", lastName: "doe" });

  // Use formatNames
  formatNames(["alice", "bob", "charlie"]);
}

/**
 * Secondary function that also uses add
 */
export function compute(values: number[]): number {
  let result = 0;
  for (const val of values) {
    result = add(result, val);
  }
  return result;
}
