export function handleElse(value: number): string {
  if (value > 0) {
    // +1 cognitive
    return "positive";
  } else {
    // +1 cognitive (no nesting penalty for else)
    return "not positive";
  }
}
// Cognitive = 2
