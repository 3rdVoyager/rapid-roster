import test from "node:test";
import assert from "node:assert/strict";

import items from "./fixtures/items.json" with { type: "json" };
import slots from "./fixtures/slots.json" with { type: "json" };
import rules from "./fixtures/rules.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import { evaluateModel } from "../src/lib/evaluation.js";
import { createInitialAssignments } from "../src/lib/assignment.js";
import { improveHardAssignments } from "../src/lib/hard.js";
import { improveSoftAssignments } from "../src/lib/soft.js";
import { swapAssignments } from "../src/lib/assignment.js";

function createTestModel(itemData = items, slotData = slots) {
  return createModel(structuredClone(itemData), structuredClone(slotData));
}

test("creates assignments compatible with hard match rules", () => {
  const model = createModel(
    [
      { id: "I1", gender: "M" },
      { id: "I2", gender: "F" },
    ],
    [
      { id: "S1", divisionGender: "M" },
      { id: "S2", divisionGender: "F" },
    ],
    [
      {
        id: "R1",
        name: "Match gender",
        enforcement: "hard",
        keyword: "match",
        inputs: ["gender", "divisionGender"],
      },
    ],
  );

  assert.deepEqual(createInitialAssignments(model), {
    S1: ["I1"],
    S2: ["I2"],
  });
});

test("creates assignments within hard minimum and maximum slot limits", () => {
  const model = createModel(
    [{ id: "I1" }, { id: "I2" }, { id: "I3" }, { id: "I4" }, { id: "I5" }],
    [{ id: "S1" }, { id: "S2" }],
    [
      {
        id: "R1",
        name: "Minimum slot size",
        enforcement: "hard",
        keyword: "limit",
        inputs: ["min", 2, "all"],
      },
      {
        id: "R2",
        name: "Maximum slot size",
        enforcement: "hard",
        keyword: "limit",
        inputs: ["max", 3, "all"],
      },
    ],
  );

  const assignments = createInitialAssignments(model);
  const slotSizes = Object.values(assignments).map((itemIds) => itemIds.length);

  assert.deepEqual(slotSizes, [3, 2]);
});

test("applies targeted hard slot limits", () => {
  const model = createModel(
    [{ id: "I1" }, { id: "I2" }, { id: "I3" }],
    [{ id: "S1" }, { id: "S2" }],
    [
      {
        id: "R1",
        name: "Small first slot",
        enforcement: "hard",
        keyword: "limit",
        inputs: ["max", 1, ["S1"]],
      },
    ],
  );

  const assignments = createInitialAssignments(model);

  assert.equal(assignments.S1.length, 1);
  assert.equal(assignments.S2.length, 2);
});

test("improves soft scores without breaking hard rules", () => {
  const model = createModel(
    [
      { id: "I1", gender: "F", height: 0 },
      { id: "I2", gender: "F", height: 0 },
      { id: "I3", gender: "F", height: 0 },
      { id: "I4", gender: "F", height: 100 },
      { id: "I5", gender: "F", height: 100 },
    ],
    [
      { id: "S1", divisionGender: "F" },
      { id: "S2", divisionGender: "F" },
    ],
    [
      {
        id: "R1",
        name: "Match gender",
        enforcement: "hard",
        keyword: "match",
        inputs: ["gender", "divisionGender"],
      },
      {
        id: "R2",
        name: "Balance heights",
        enforcement: "soft",
        priority: 1,
        keyword: "balance",
        inputs: ["height"],
      },
    ],
    { S1: ["I1", "I2", "I3"], S2: ["I4", "I5"] },
  );
  const startingEvaluation = evaluateModel(model);
  const assignments = improveSoftAssignments(model, 1);
  const finalModel = createModel(
    model.items,
    model.slots,
    model.rules,
    assignments,
  );
  const finalEvaluation = evaluateModel(finalModel);

  assert.equal(finalEvaluation.hardPenalty, 0);
  assert.ok(finalEvaluation.softPenalty < startingEvaluation.softPenalty);
});

test("improves the complete fixture without creating hard violations", () => {
  const model = createModel(
    structuredClone(items),
    structuredClone(slots),
    structuredClone(rules),
    createInitialAssignments(createModel(items, slots, rules)),
  );
  const startingEvaluation = evaluateModel(model);
  const assignments = improveSoftAssignments(model, 1);
  const finalModel = createModel(
    model.items,
    model.slots,
    model.rules,
    assignments,
  );
  const finalEvaluation = evaluateModel(finalModel);

  assert.equal(finalEvaluation.hardPenalty, 0);
  assert.ok(finalEvaluation.softPenalty <= startingEvaluation.softPenalty);
});

test("rejects creating a model without slots", () => {
  assert.throws(() => createTestModel(items, []), /Slots must not be empty/);
});

test("repairs an illegal candidate with a swap", () => {
  const model = createModel(
    [
      { id: "I1", division: "B" },
      { id: "I2", division: "A" },
    ],
    [
      { id: "S1", division: "A" },
      { id: "S2", division: "B" },
    ],
    [
      {
        id: "R1",
        name: "Match divisions",
        enforcement: "hard",
        keyword: "match",
        inputs: ["division", "division"],
      },
    ],
  );

  const assignedModel = createModel(
    model.items,
    model.slots,
    model.rules,
    { S1: ["I1"], S2: ["I2"] },
  );
  const assignments = improveHardAssignments(assignedModel);

  assert.deepEqual(assignments, { S1: ["I2"], S2: ["I1"] });
});

test("stops after the round limit", () => {
  const model = createModel(
    [{ id: "I1" }, { id: "I2" }],
    [{ id: "S1" }],
    [
      {
        id: "R1",
        name: "No assigned items",
        enforcement: "hard",
        keyword: "limit",
        inputs: ["max", 0, "all"],
      },
    ],
  );

  const assignedModel = createModel(
    model.items,
    model.slots,
    model.rules,
    { S1: ["I1", "I2"] },
  );

  let error;
  try {
    improveHardAssignments(assignedModel, 3);
  } catch (caughtError) {
    error = caughtError;
  }

  assert.match(
    error.message,
    /Could not create legal assignments after 3 rounds/,
  );
  assert.equal(error.hardPenalty, 1);
  assert.deepEqual(error.hardViolations.map((violation) => violation.ruleId), [
    "R1",
  ]);
});

test("swaps assignments between slots", () => {
  const assignments = { S1: ["I1"], S2: ["I2"] };

  assert.deepEqual(
    swapAssignments(assignments, "S1", "I1", "S2", "I2"),
    { S1: ["I2"], S2: ["I1"] },
  );
});
