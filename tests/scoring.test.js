import test from "node:test";
import assert from "node:assert/strict";

import fullItems from "./fixtures/items.json" with { type: "json" };
import fullSlots from "./fixtures/slots.json" with { type: "json" };
import fullRules from "./fixtures/rules.json" with { type: "json" };
import fullAssignments from "./fixtures/assignments.json" with {
  type: "json",
};

import { createModel } from "../src/lib/model.js";
import { evaluateModel } from "../src/lib/scoring.js";

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

test("evaluateModel reports hard and weighted soft penalties", () => {
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
  const result = evaluateModel(createTestModel(rules, passingAssignments));

  assert.equal(result.hardPenalty, 0);
  assert.deepEqual(result.hardViolations, []);
  assert.equal(result.softPenalty, (1 - 2 / 4) * 10);

  assert.equal(result.softViolations.length, 2);
});

test("evaluateModel reports failed hard-rule violations", () => {
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

  const result = evaluateModel(createTestModel(rules));

  assert.equal(result.hardPenalty, 1 - 2 / 4);
  assert.equal(result.hardViolations.length, 2);
  assert.deepEqual(
    result.hardViolations.map((violation) => violation.ruleId),
    ["R3", "R3"],
  );
  assert.equal(result.softPenalty, 0);
});

test("scoreModel scores the complete roster dataset", () => {
  const model = createModel(
    structuredClone(fullItems),
    structuredClone(fullSlots),
    structuredClone(fullRules),
    structuredClone(fullAssignments),
  );

  const result = evaluateModel(model);

  assert.equal(result.hardViolations.length > 0, true);
  assert.equal(typeof result.hardPenalty, "number");
  assert.equal(typeof result.softPenalty, "number");
});

test("evaluateModel can skip soft rules", () => {
  const model = createTestModel([
    {
      id: "R1",
      name: "Assigned items match slot divisions",
      enforcement: "hard",
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
  ]);

  const result = evaluateModel(model, true);

  assert.equal(result.softPenalty, 0);
  assert.deepEqual(result.softViolations, []);
});
