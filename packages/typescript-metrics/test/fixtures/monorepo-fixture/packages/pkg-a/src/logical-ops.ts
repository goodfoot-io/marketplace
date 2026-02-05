export function checkLogical(a: boolean, b: boolean, c: boolean, d: boolean): boolean {
  // Consecutive && counts as +1, not +3
  const result1 = a && b && c && d; // +1 cognitive (all same operator)
  // Mix of operators: each type counts separately
  const result2 = a || b || c; // +1 cognitive
  const result3 = (a && b) || c; // +1 && + 1 || = +2 cognitive
  return result1 || result2 || result3; // +1 cognitive
}
// Cognitive = 5
