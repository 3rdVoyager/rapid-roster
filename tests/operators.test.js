import test from "node:test";
import assert from "node:assert/strict";

import {
  equals,
  contains,
  greaterThan,
  lessThan,
  approximates,
} from "../src/lib/operators.js";

test("equals compares values", () => {
  assert.equal(equals("Male", "Male"), 1);
  assert.equal(equals("Male", "Female"), 0);
  assert.equal(equals(10, 10), 1);
});

test("contains finds a scalar in an array", () => {
  assert.equal(contains(["Mon", "Wed"], "Mon"), 1);
  assert.equal(contains(["Mon", "Wed"], "Tue"), 0);
});

test("contains detects overlap between arrays", () => {
  assert.equal(contains(["P1", "P2"], ["P2", "P3"]), 1);
  assert.equal(contains(["P1", "P2"], ["P3", "P4"]), 0);
});

test("contains rejects unsupported values", () => {
  assert.throws(() => contains("Mon", "Mon"), /Contains requires an array/);
  assert.throws(() => contains(["Mon"], true), /Contains requires an array/);
});

test("compares numbers with greaterThan", () => {
  assert.equal(greaterThan(10, 5), 1);
  assert.equal(greaterThan(5, 10), 0);
});

test("compares numbers with lessThan", () => {
  assert.equal(lessThan(5, 10), 1);
  assert.equal(lessThan(10, 5), 0);
});

test("numeric comparison operators reject non-numbers", () => {
  assert.throws(
    () => greaterThan("10", 5),
    /Greater than requires a finite number/,
  );
  assert.throws(() => lessThan(5, "10"), /Less than requires a finite number/);
});

test("approximates returns a full score for equal values", () => {
  assert.equal(approximates(80, 80), 1);
});

test("approximates scores distance", () => {
  assert.equal(approximates(50, 100), 0.5);
});

test("approximates clamps scores at zero", () => {
  assert.equal(approximates(0, 200), 0);
});

test("approximates rejects non-numbers", () => {
  assert.throws(
    () => approximates("80", 80),
    /Approximates requires a finite number/,
  );
});
