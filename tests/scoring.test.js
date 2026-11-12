import test from "node:test";
import assert from "node:assert/strict";

import fullItems from "./fixtures/items.json" with { type: "json" };
import fullSlots from "./fixtures/slots.json" with { type: "json" };
import fullRules from "./fixtures/rules.json" with { type: "json" };
import fullAssignments from "./fixtures/assignments.json" with {
  type: "json",
};

import { createModel } from "../src/lib/model.js";
import {
  evaluateModel,
  evaluateSwap,
} from "../src/lib/evaluation.js";

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

test("evaluateSwap matches full scoring for match and balance rules", () => {
  const testItems = [
    { id: "I1", division: "A", rating: 10 },
    { id: "I2", division: "B", rating: 90 },
    { id: "I3", division: "A", rating: 20 },
    { id: "I4", division: "B", rating: 80 },
  ];
  const testSlots = [
    { id: "S1", division: "A" },
    { id: "S2", division: "B" },
  ];
  const rules = [
    {
      id: "R1",
      name: "Division match",
      enforcement: "soft",
      priority: 10,
      keyword: "match",
      inputs: ["division", "division"],
    },
    {
      id: "R2",
      name: "Rating balance",
      enforcement: "soft",
      priority: 20,
      keyword: "balance",
      inputs: ["rating"],
    },
    {
      id: "R3",
      name: "Slot capacity",
      enforcement: "soft",
      priority: 5,
      keyword: "limit",
      inputs: ["max", 2, "all"],
    },
  ];
  const assignments = {
    S1: ["I1", "I4"],
    S2: ["I2", "I3"],
  };
  const model = createModel(testItems, testSlots, rules, assignments);
  const currentEvaluation = evaluateModel(model);
  const candidateAssignments = {
    S1: ["I2", "I4"],
    S2: ["I1", "I3"],
  };
  const candidateModel = createModel(
    testItems,
    testSlots,
    rules,
    candidateAssignments,
  );
  const incrementalEvaluation = evaluateSwap(
    model,
    currentEvaluation,
    candidateModel,
    {
      firstItemId: "I1",
      firstSlotId: "S1",
      secondItemId: "I2",
      secondSlotId: "S2",
    },
  );
  const fullEvaluation = evaluateModel(candidateModel);

  assert.equal(incrementalEvaluation.hardPenalty, fullEvaluation.hardPenalty);
  assert.equal(incrementalEvaluation.softPenalty, fullEvaluation.softPenalty);
  assert.deepEqual(
    incrementalEvaluation.softRulePenalties.map((rule) => rule.weightedPenalty),
    fullEvaluation.softRulePenalties.map((rule) => rule.weightedPenalty),
  );
});

test("evaluateSwap matches full scoring for group, distribute, and align rules", () => {
  const testItems = [
    { id: "I1", requests: ["I2"], sibling: "I2", rating: 10 },
    { id: "I2", requests: ["I1"], sibling: "I1", rating: 90 },
    { id: "I3", requests: [], sibling: "I4", rating: 20 },
    { id: "I4", requests: [], sibling: "I3", rating: 80 },
  ];
  const testSlots = [
    { id: "S1", division: "A" },
    { id: "S2", division: "B" },
  ];
  const rules = [
    {
      id: "R1",
      name: "Group requests",
      enforcement: "soft",
      priority: 10,
      keyword: "group",
      inputs: ["id", "requests"],
    },
    {
      id: "R2",
      name: "Distribute ratings",
      enforcement: "soft",
      priority: 20,
      keyword: "distribute",
      inputs: ["rating"],
    },
    {
      id: "R3",
      name: "Align siblings",
      enforcement: "soft",
      priority: 30,
      keyword: "align",
      inputs: ["division", "sibling"],
    },
  ];
  const assignments = {
    S1: ["I1", "I4"],
    S2: ["I2", "I3"],
  };
  const model = createModel(testItems, testSlots, rules, assignments);
  const currentEvaluation = evaluateModel(model);
  const candidateAssignments = {
    S1: ["I2", "I4"],
    S2: ["I1", "I3"],
  };
  const candidateModel = createModel(
    testItems,
    testSlots,
    rules,
    candidateAssignments,
  );
  const incrementalEvaluation = evaluateSwap(
    model,
    currentEvaluation,
    candidateModel,
    {
      firstItemId: "I1",
      firstSlotId: "S1",
      secondItemId: "I2",
      secondSlotId: "S2",
    },
  );
  const fullEvaluation = evaluateModel(candidateModel);

  assert.equal(incrementalEvaluation.softPenalty, fullEvaluation.softPenalty);
  assert.deepEqual(
    incrementalEvaluation.softRulePenalties.map((rule) => rule.weightedPenalty),
    fullEvaluation.softRulePenalties.map((rule) => rule.weightedPenalty),
  );
});
