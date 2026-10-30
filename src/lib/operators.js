export function equals(value1, value2) {
  return value1 === value2 ? 1 : 0;
}

export function contains(value1, value2) {
  const value2IsValid =
    typeof value2 === "string" ||
    typeof value2 === "number" ||
    Array.isArray(value2);

  if (!Array.isArray(value1) || !value2IsValid) {
    throw new Error(
      "Contains requires an array and a string, number, or array",
    );
  }

  if (Array.isArray(value2)) {
    return value2.some((item) => value1.includes(item)) ? 1 : 0;
  }

  return value1.includes(value2) ? 1 : 0;
}

export function greaterThan(value1, value2) {
  if (typeof value1 !== "number" || !Number.isFinite(value1)) {
    throw new Error("Greater than requires a finite number");
  }
  if (typeof value2 !== "number" || !Number.isFinite(value2)) {
    throw new Error("Greater than requires a finite number");
  }
  return value1 > value2 ? 1 : 0;
}

export function lessThan(value1, value2) {
  if (typeof value1 !== "number" || !Number.isFinite(value1)) {
    throw new Error("Less than requires a finite number");
  }
  if (typeof value2 !== "number" || !Number.isFinite(value2)) {
    throw new Error("Less than requires a finite number");
  }
  return value1 < value2 ? 1 : 0;
}

// returns 0-1 satisfaction score
export function approximates(value1, value2) {
  if (typeof value1 !== "number" || !Number.isFinite(value1)) {
    throw new Error("Approximates requires a finite number");
  }
  if (typeof value2 !== "number" || !Number.isFinite(value2)) {
    throw new Error("Approximates requires a finite number");
  }

  const difference = Math.abs(value1 - value2);
  // 0-100 scale
  return Math.max(0, 1 - difference / 100);
}
