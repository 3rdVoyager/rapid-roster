import test from "node:test";
import assert from "node:assert/strict";

import items from "./fixtures/items.json" with { type: "json" };
import slots from "./fixtures/slots.json" with { type: "json" };
import assignments from "./fixtures/assignments.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import { scoreModel } from "../src/lib/scoring.js";

function createTestModel(rules) {
  return createModel(
    structuredClone(items),
    structuredClone(slots),
    rules,
    structuredClone(assignments),
  );
}

test("scoreModel reports passing hard rules and weighted soft scores", () => {
  const rules = [
    {
      id: "R1",
      name: "All heights are positive",
      source: "items.height",
      operator: "greaterThan",
      target: 0,
      enforcement: "hard",
    },
    {
      id: "R2",
      name: "Most players are taller than 50 inches",
      source: "items.height",
      operator: "greaterThan",
      target: 50,
      enforcement: "soft",
      priority: 10,
    },
  ];

  const result = scoreModel(createTestModel(rules));

  assert.equal(result.legal, true);
  assert.deepEqual(result.hardViolations, []);
  assert.equal(result.softScore, (8 / 12) * 10);
  assert.deepEqual(result.rules, [
    {
      id: "R1",
      name: "All heights are positive",
      enforcement: "hard",
      score: 1,
    },
    {
      id: "R2",
      name: "Most players are taller than 50 inches",
      enforcement: "soft",
      score: 8 / 12,
    },
  ]);
});

test("scoreModel reports failed hard rule IDs", () => {
  const rules = [
    {
      id: "R3",
      name: "All players are taller than 50 inches",
      source: "items.height",
      operator: "greaterThan",
      target: 50,
      enforcement: "hard",
    },
  ];

  const result = scoreModel(createTestModel(rules));

  assert.equal(result.legal, false);
  assert.deepEqual(result.hardViolations, ["R3"]);
  assert.equal(result.softScore, 0);
});
