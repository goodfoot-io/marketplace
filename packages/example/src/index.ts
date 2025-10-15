/**
 * Returns a greeting message
 * @param name - Optional name to greet
 * @returns Greeting message
 */
export function hello(name?: string): string {
  return name ? `Hello, ${name}!` : 'Hello, World!';
}
