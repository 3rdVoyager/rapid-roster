export function average(values) {
  if (values.length === 0) {
    throw new Error("Cannot average an empty array");
  }

  let sum = 0;
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("Average requires finite numbers");
    }
    sum += value;
  }
  return sum / values.length;
}

export function count(data) {
  return data.length;
}

export function sum(data) {
  let sum = 0;
  for (const item of data) {
    if (typeof item !== "number" || !Number.isFinite(item)) {
      throw new Error("Sum requires finite numbers");
    }
    sum += item;
  }
  return sum;
}

export function min(values) {
  if (values.length === 0) {
    throw new Error("Cannot find the minimum of an empty array");
  }

  let min = Infinity;
  for (const item of values) {
    if (typeof item !== "number" || !Number.isFinite(item)) {
      throw new Error("Min requires finite numbers");
    }
    if (item < min) {
      min = item;
    }
  }
  return min;
}

export function max(values) {
  if (values.length === 0) {
    throw new Error("Cannot find the maximum of an empty array");
  }

  let max = -Infinity;
  for (const item of values) {
    if (typeof item !== "number" || !Number.isFinite(item)) {
      throw new Error("Max requires finite numbers");
    }
    if (item > max) {
      max = item;
    }
  }
  return max;
}

export function add(value1, value2) {
  if (typeof value1 !== "number" || !Number.isFinite(value1)) {
    throw new Error("Add requires finite numbers");
  }
  if (typeof value2 !== "number" || !Number.isFinite(value2)) {
    throw new Error("Add requires finite numbers");
  }
  return value1 + value2;
}

export function subtract(value1, value2) {
  if (typeof value1 !== "number" || !Number.isFinite(value1)) {
    throw new Error("Subtract requires finite numbers");
  }
  if (typeof value2 !== "number" || !Number.isFinite(value2)) {
    throw new Error("Subtract requires finite numbers");
  }
  return value1 - value2;
}

export function multiplyBy(value1, value2) {
  if (typeof value1 !== "number" || !Number.isFinite(value1)) {
    throw new Error("Multiply requires finite numbers");
  }
  if (typeof value2 !== "number" || !Number.isFinite(value2)) {
    throw new Error("Multiply requires finite numbers");
  }
  return value1 * value2;
}

export function divideBy(value1, value2) {
  if (typeof value1 !== "number" || !Number.isFinite(value1)) {
    throw new Error("Divide requires finite numbers");
  }
  if (typeof value2 !== "number" || !Number.isFinite(value2)) {
    throw new Error("Divide requires finite numbers");
  }
  if (value2 === 0) {
    throw new Error("Cannot divide by zero");
  }
  return value1 / value2;
}
