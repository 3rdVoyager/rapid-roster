import test from "node:test";
import assert from "node:assert/strict";

import {
  average,
  count,
  sum,
  min,
  max,
  add,
  subtract,
  multiplyBy,
  divideBy,
} from "../src/lib/math.js";

test("calculates an average", () => {
  assert.equal(average([60, 70, 80]), 70);
});

test("rejects an empty average", () => {
  assert.throws(() => average([]), /Cannot average an empty array/);
});

test("rejects non-numeric average values", () => {
  assert.throws(
    () => average([60, "70", 80]),
    /Average requires finite numbers/,
  );
});

test("counts values", () => {
  assert.equal(count([60, 70, 80]), 3);
});

test("counts an empty array", () => {
  assert.equal(count([]), 0);
});

test("sums values", () => {
  assert.equal(sum([60, 70, 80]), 210);
});

test("sums an empty array", () => {
  assert.equal(sum([]), 0);
});

test("finds the minimum value", () => {
  assert.equal(min([60, 70, 80]), 60);
});

test("finds the maximum value", () => {
  assert.equal(max([60, 70, 80]), 80);
});

test("rejects an empty minimum", () => {
  assert.throws(() => min([]), /Cannot find the minimum of an empty array/);
});

test("rejects an empty maximum", () => {
  assert.throws(() => max([]), /Cannot find the maximum of an empty array/);
});

test("numeric functions reject non-numeric values", () => {
  assert.throws(() => sum([60, "70", 80]), /Sum requires finite numbers/);
  assert.throws(() => min([60, "70", 80]), /Min requires finite numbers/);
  assert.throws(() => max([60, "70", 80]), /Max requires finite numbers/);
});

test("adds two numbers", () => {
  assert.equal(add(10, 5), 15);
});

test("subtracts two numbers", () => {
  assert.equal(subtract(10, 5), 5);
});

test("multiplies two numbers", () => {
  assert.equal(multiplyBy(10, 5), 50);
});

test("divides two numbers", () => {
  assert.equal(divideBy(10, 5), 2);
});

test("arithmetic functions reject non-numeric values", () => {
  assert.throws(() => add(10, "5"), /Add requires finite numbers/);
  assert.throws(() => subtract(10, "5"), /Subtract requires finite numbers/);
  assert.throws(() => multiplyBy(10, "5"), /Multiply requires finite numbers/);
  assert.throws(() => divideBy(10, "5"), /Divide requires finite numbers/);
});

test("rejects division by zero", () => {
  assert.throws(() => divideBy(10, 0), /Cannot divide by zero/);
});
