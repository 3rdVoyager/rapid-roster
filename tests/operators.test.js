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
  assert.equal(equals("Male", "Male"), true);
  assert.equal(equals("Male", "Female"), false);
  assert.equal(equals(10, 10), true);
});

test("contains finds a scalar in an array", () => {
  assert.equal(contains(["Mon", "Wed"], "Mon"), true);
  assert.equal(contains(["Mon", "Wed"], "Tue"), false);
});

test("contains detects overlap between arrays", () => {
  assert.equal(contains(["P1", "P2"], ["P2", "P3"]), true);
  assert.equal(contains(["P1", "P2"], ["P3", "P4"]), false);
});

test("contains rejects unsupported values", () => {
  assert.throws(
    () => contains("Mon", "Mon"),
    /Contains requires an array/,
  );
  assert.throws(
    () => contains(["Mon"], true),
    /Contains requires an array/,
  );
});

test("compares numbers with greaterThan", () => {
  assert.equal(greaterThan(10, 5), true);
  assert.equal(greaterThan(5, 10), false);
});

test("compares numbers with lessThan", () => {
  assert.equal(lessThan(5, 10), true);
  assert.equal(lessThan(10, 5), false);
});

test("numeric comparison operators reject non-numbers", () => {
  assert.throws(
    () => greaterThan("10", 5),
    /Greater than requires a finite number/,
  );
  assert.throws(
    () => lessThan(5, "10"),
    /Less than requires a finite number/,
  );
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
