import test from "node:test";
import assert from "node:assert/strict";

import items from "./fixtures/items.json" with { type: "json" };
import slots from "./fixtures/slots.json" with { type: "json" };
import rules from "./fixtures/rules.json" with { type: "json" };
import assignments from "./fixtures/assignments.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import { evaluateMatch } from "../src/lib/rules.js";

function createTestModel() {
  return createModel(
    structuredClone(items),
    structuredClone(slots),
    structuredClone(rules),
    structuredClone(assignments),
  );
}

test("match compares item attributes with assigned slot attributes", () => {
  const result = evaluateMatch(
    {
      source: { collection: "items", attribute: "gender" },
      target: { collection: "slots", attribute: "divisionGender" },
    },
    createTestModel(),
  );

  assert.deepEqual(result, {
    score: 7,
    repetitions: 12,
    violations: 5,
  });
});

test("match compares slot attributes with their assigned item attributes", () => {
  const result = evaluateMatch(
    {
      source: { collection: "slots", attribute: "division" },
      target: { collection: "items", attribute: "division" },
    },
    createTestModel(),
  );

  assert.deepEqual(result, {
    score: 10,
    repetitions: 12,
    violations: 2,
  });
});

test("match handles an item array against an assigned slot value", () => {
  const result = evaluateMatch(
    {
      source: { collection: "items", attribute: "practiceNights" },
      target: { collection: "slots", attribute: "practiceNight" },
    },
    createTestModel(),
  );

  assert.deepEqual(result, {
    score: 6,
    repetitions: 12,
    violations: 6,
  });
});

test("match rejects unsupported collections", () => {
  assert.throws(
    () =>
      evaluateMatch(
        {
          source: { collection: "teams", attribute: "name" },
          target: { collection: "slots", attribute: "id" },
        },
        createTestModel(),
      ),
    /Unsupported match collections: teams -> slots/,
  );
});
