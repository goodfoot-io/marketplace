// Test various import styles
import { add, multiply } from "../utils/math.js";
import { add as addNumbers } from "../utils/math.js";
import * as mathUtils from "../utils/math.js";

/**
 * Calculator service demonstrating various call patterns
 */
export class Calculator {
  /**
   * Direct function call
   */
  addDirect(a: number, b: number): number {
    return add(a, b);
  }

  /**
   * Aliased import call
   */
  addAliased(a: number, b: number): number {
    return addNumbers(a, b);
  }

  /**
   * Namespace import call
   */
  addNamespaced(a: number, b: number): number {
    return mathUtils.add(a, b);
  }

  /**
   * Multiple calls in one method
   */
  calculate(a: number, b: number, c: number): number {
    const sum = add(a, b);
    const product = multiply(sum, c);
    return add(product, 1);
  }

  /**
   * Nested call
   */
  nestedAdd(a: number, b: number, c: number): number {
    return add(add(a, b), c);
  }
}

/**
 * Standalone function that uses add
 */
export function quickAdd(a: number, b: number): number {
  return add(a, b);
}
