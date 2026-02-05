export function processData(input: unknown): string {
  // Base cyclomatic = 1
  // Needs 14 more decision points for CC=15
  // Needs nesting for cognitive = 20

  if (input === null) {
    // +1 CC, +1 cognitive
    return "null";
  } else if (input === undefined) {
    // +1 CC, +1 cognitive (else if)
    return "undefined";
  }

  if (typeof input === "string") {
    // +1 CC, +1 cognitive
    if (input.length === 0) {
      // +1 CC, +2 cognitive (nested +1)
      return "empty";
    }
    for (let i = 0; i < input.length; i++) {
      // +1 CC, +2 cognitive
      if (input[i] === "x") {
        // +1 CC, +3 cognitive (nested x2)
        return "found x";
      }
    }
  }

  if (typeof input === "number") {
    // +1 CC, +1 cognitive
    switch (
      true // switch itself doesn't add
    ) {
      case input < 0: // +1 CC, +2 cognitive
        return "negative";
      case input === 0: // +1 CC, +2 cognitive
        return "zero";
      case input > 100: // +1 CC, +2 cognitive
        return "large";
      default:
        break;
    }
  }

  try {
    if (Array.isArray(input)) {
      // +1 CC, +1 cognitive
      if (input.length > 0 && input[0] !== null) {
        // +1 CC, +1 && = +1 cognitive
        return "non-empty array";
      }
    }
  } catch (_e) {
    // +1 CC, +1 cognitive
    return "error";
  }

  return "unknown";
}
// Total CC: 1 + 14 = 15
// Total cognitive: approximately 20
