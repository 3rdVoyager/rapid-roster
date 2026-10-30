import test from "node:test";
import assert from "node:assert/strict";

import items from "./fixtures/items.json" with { type: "json" };
import slots from "./fixtures/slots.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import {
  evaluateRule,
  evaluateOperator,
  evaluateRecursiveRule,
  resolvePath,
} from "../src/lib/rules.js";

function createTestModel() {
  return createModel(structuredClone(items), structuredClone(slots));
}

test("evaluateRule aggregates a soft rule with an average score", () => {
  const model = createTestModel();
  const rule = {
    source: "items.height",
    operator: "greaterThan",
    target: 50,
    enforcement: "soft",
  };

  const result = evaluateRule(rule, model);

  assert.equal(result.enforcement, "soft");
  assert.equal(result.score, 8 / 12);
});

test("evaluateRule requires every score to pass for a hard rule", () => {
  const model = createTestModel();
  const rule = {
    source: "items.height",
    operator: "greaterThan",
    target: 0,
    enforcement: "hard",
  };

  assert.deepEqual(evaluateRule(rule, model), {
    score: 1,
    enforcement: "hard",
  });
});

test("evaluateRule fails a hard rule when one score fails", () => {
  const model = createTestModel();
  const rule = {
    source: "items.height",
    operator: "greaterThan",
    target: 50,
    enforcement: "hard",
  };

  assert.deepEqual(evaluateRule(rule, model), {
    score: 0,
    enforcement: "hard",
  });
});

test("evaluateOperator runs the requested operator", () => {
  assert.equal(evaluateOperator("equals", "M", "M"), 1);
  assert.equal(evaluateOperator("equals", "M", "F"), 0);
  assert.equal(evaluateOperator("approximates", 50, 100), 0.5);
});

test("evaluateOperator rejects unknown operators", () => {
  assert.throws(
    () => evaluateOperator("unknown", "M", "M"),
    /Unknown operator: unknown/,
  );
});

test("evaluateRecursiveRule evaluates every source value against one target", () => {
  assert.deepEqual(
    evaluateRecursiveRule("equals", ["M", "F", "M"], "M"),
    [1, 0, 1],
  );
});

test("evaluateRecursiveRule evaluates one source against every target", () => {
  assert.deepEqual(
    evaluateRecursiveRule("equals", "M", ["M", "F", "M"]),
    [1, 0, 1],
  );
});

test("evaluateRecursiveRule evaluates every source-target combination", () => {
  assert.deepEqual(
    evaluateRecursiveRule("equals", ["M", "F"], ["M", "F"]),
    [1, 0, 0, 1],
  );
});

test("resolves an item attribute", () => {
  const model = createTestModel();

  assert.deepEqual(resolvePath("items.gender", model), [
    "M",
    "M",
    "F",
    "M",
    "F",
    "F",
    "M",
    "F",
    "M",
    "F",
    "M",
    "F",
  ]);
});

test("resolves another item attribute", () => {
  const model = createTestModel();

  assert.deepEqual(resolvePath("items.height", model), [
    54,
    42,
    62,
    56,
    38,
    61,
    46,
    49,
    59,
    64,
    67,
    55,
  ]);
});

test("resolves a slot attribute", () => {
  const model = createTestModel();

  assert.deepEqual(resolvePath("slots.division", model), [
    "4/5",
    "6/7/8",
    "2/3",
    "K/1",
    "4/5",
  ]);
});

test("resolves another slot attribute", () => {
  const model = createTestModel();

  assert.deepEqual(resolvePath("slots.practiceNight", model), [
    "Tue",
    "Thu",
    "Thu",
    "Mon",
    "Wed",
  ]);
});

test("rejects an unknown collection", () => {
  const model = createTestModel();

  assert.throws(
    () => resolvePath("teams.name", model),
    /Unknown collection: teams/,
  );
});

test("rejects paths with unsupported methods", () => {
  const model = createTestModel();

  assert.throws(
    () => resolvePath("items.height.average()", model),
    /Unsupported path: items.height.average\(\)/,
  );
});
