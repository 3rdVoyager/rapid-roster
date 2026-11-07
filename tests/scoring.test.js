import test from "node:test";
import assert from "node:assert/strict";

import { createModel } from "../src/lib/model.js";
import { scoreModel } from "../src/lib/scoring.js";

const items = [
  { id: "I1", gender: "M", division: "M A" },
  { id: "I2", gender: "F", division: "M A" },
  { id: "I3", gender: "M", division: "F B" },
  { id: "I4", gender: "F", division: "F B" },
];

const slots = [
  { id: "S1", divisionGender: "M", division: "M A" },
  { id: "S2", divisionGender: "F", division: "F B" },
];

function createTestModel(rules, modelAssignments) {
  return createModel(
    structuredClone(items),
    structuredClone(slots),
    rules,
    structuredClone(modelAssignments ?? {
      S1: ["I1", "I4"],
      S2: ["I2", "I3"],
    }),
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
    S1: ["I1", "I2"],
    S2: ["I3", "I4"],
  };
  const result = scoreModel(createTestModel(rules, passingAssignments));

  assert.equal(result.legal, true);
  assert.deepEqual(result.hardViolations, []);
  assert.equal(result.softScore, (2 / 4) * 10);

  assert.deepEqual(result.rules, [
    {
      id: "R1",
      name: "Assigned items match slot divisions",
      enforcement: "hard",
      score: 1,
      percentage: 1,
      repetitions: 4,
      violations: result.rules[0].violations,
    },
    {
      id: "R2",
      name: "Assigned items match slot genders",
      enforcement: "soft",
      score: (2 / 4) * 10,
      percentage: 2 / 4,
      repetitions: 4,
      violations: result.rules[1].violations,
    },
  ]);

  assert.equal(result.rules[0].violations.length, 0);
  assert.equal(result.rules[1].violations.length, 2);
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
