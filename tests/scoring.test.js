import test from "node:test";
import assert from "node:assert/strict";

import fullItems from "./fixtures/items.json" with { type: "json" };
import fullSlots from "./fixtures/slots.json" with { type: "json" };
import fullRules from "./fixtures/rules.json" with { type: "json" };
import fullAssignments from "./fixtures/assignments.json" with {
  type: "json",
};

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
      inputs: ["division", "division"],
    },
    {
      id: "R2",
      name: "Assigned items match slot genders",
      enforcement: "soft",
      priority: 10,
      keyword: "match",
      inputs: ["gender", "divisionGender"],
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
      inputs: ["gender", "divisionGender"],
    },
  ];

  const result = scoreModel(createTestModel(rules));

  assert.equal(result.legal, false);
  assert.deepEqual(result.hardViolations, ["R3"]);
  assert.equal(result.softScore, 0);
});

test("scoreModel scores the complete roster dataset", () => {
  const model = createModel(
    structuredClone(fullItems),
    structuredClone(fullSlots),
    structuredClone(fullRules),
    structuredClone(fullAssignments),
  );

  const result = scoreModel(model);

  assert.equal(result.rules.length, fullRules.length);
  assert.equal(result.hardViolations.length > 0, true);
  assert.equal(typeof result.softScore, "number");
  assert.equal(
    result.rules.every((rule) => Number.isFinite(rule.percentage)),
    true,
  );
});
