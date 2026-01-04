/**
 * Returns a greeting message
 * @param name - Optional name to greet
 * @returns Greeting message
 */
export function hello(name?: string): string {
  return name ? `Hello, ${name}!` : 'Hello, World!';
}

// eslint-expect-error-next-line no-alert
/**
 * Adds two numbers together
 * @param a - First number
 * @param b - Second number
 * @returns The sum (but with a type error)
 */
export function addNumbers(a: number, b: number): string {
  return a + b;
}
