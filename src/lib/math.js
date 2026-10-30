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
