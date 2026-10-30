import test from "node:test";
import assert from "node:assert/strict";

import { average, count, sum, min, max } from "../src/lib/math.js";

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
  assert.throws(
    () => min([]),
    /Cannot find the minimum of an empty array/,
  );
});

test("rejects an empty maximum", () => {
  assert.throws(
    () => max([]),
    /Cannot find the maximum of an empty array/,
  );
});

test("numeric functions reject non-numeric values", () => {
  assert.throws(() => sum([60, "70", 80]), /Sum requires finite numbers/);
  assert.throws(() => min([60, "70", 80]), /Min requires finite numbers/);
  assert.throws(() => max([60, "70", 80]), /Max requires finite numbers/);
});
