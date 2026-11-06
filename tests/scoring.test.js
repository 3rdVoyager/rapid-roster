import test from "node:test";
import assert from "node:assert/strict";

import items from "./fixtures/items.json" with { type: "json" };
import slots from "./fixtures/slots.json" with { type: "json" };
import assignments from "./fixtures/assignments.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import { scoreModel } from "../src/lib/scoring.js";

function createTestModel(rules, modelAssignments = assignments) {
  return createModel(
    structuredClone(items),
    structuredClone(slots),
    rules,
    structuredClone(modelAssignments),
  );
}

test("scoreModel reports passing hard rules and weighted soft scores", () => {
  const rules = [
    {
      id: "R1",
      name: "Assigned items match slot divisions",
      enforcement: "hard",
      priority: 1,
      keyword: "match",
      inputs: {
        source: { collection: "items", attribute: "division" },
        target: { collection: "slots", attribute: "division" },
      },
    },
    {
      id: "R2",
      name: "Assigned items match slot genders",
      enforcement: "soft",
      priority: 10,
      keyword: "match",
      inputs: {
        source: { collection: "items", attribute: "gender" },
        target: { collection: "slots", attribute: "divisionGender" },
      },
    },
  ];

  const passingAssignments = {
    T1: ["P1", "P4", "P12"],
    T2: ["P3", "P6", "P9", "P10", "P11"],
    T3: ["P7", "P8"],
    T4: ["P2", "P5"],
    T5: [],
  };
  const result = scoreModel(createTestModel(rules, passingAssignments));

  assert.equal(result.legal, true);
  assert.deepEqual(result.hardViolations, []);
  assert.equal(result.softScore, (7 / 12) * 10);

  assert.deepEqual(result.rules, [
    {
      id: "R1",
      name: "Assigned items match slot divisions",
      enforcement: "hard",
      score: 1,
      percentage: 1,
      repetitions: 12,
      violations: 0,
    },
    {
      id: "R2",
      name: "Assigned items match slot genders",
      enforcement: "soft",
      score: (7 / 12) * 10,
      percentage: 7 / 12,
      repetitions: 12,
      violations: 5,
    },
  ]);
});

test("scoreModel reports failed hard rule IDs", () => {
  const rules = [
    {
      id: "R3",
      name: "Assigned items match slot genders",
      enforcement: "hard",
      priority: 1,
      keyword: "match",
      inputs: {
        source: { collection: "items", attribute: "gender" },
        target: { collection: "slots", attribute: "divisionGender" },
      },
    },
  ];

  const result = scoreModel(createTestModel(rules));

  assert.equal(result.legal, false);
  assert.deepEqual(result.hardViolations, ["R3"]);
  assert.equal(result.softScore, 0);
});
