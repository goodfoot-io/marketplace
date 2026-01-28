/**
 * Add two numbers together
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Multiply two numbers
 */
export function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * Calculate the sum of an array
 */
export function sum(numbers: number[]): number {
  return numbers.reduce((acc, n) => add(acc, n), 0);
}
