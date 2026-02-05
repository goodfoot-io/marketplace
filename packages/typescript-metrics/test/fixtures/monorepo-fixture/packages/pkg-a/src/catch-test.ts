export function catchNesting(): string {
  try {
    try {
      throw new Error("inner");
    } catch (_e) {
      // +1 cognitive + nesting penalty
      return "inner catch";
    }
  } catch (_e) {
    // +1 cognitive
    return "outer catch";
  }
}
