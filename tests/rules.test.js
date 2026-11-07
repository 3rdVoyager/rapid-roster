import test from "node:test";
import assert from "node:assert/strict";

import items from "./fixtures/items.json" with { type: "json" };
import slots from "./fixtures/slots.json" with { type: "json" };
import rules from "./fixtures/rules.json" with { type: "json" };
import assignments from "./fixtures/assignments.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import {
  evaluateAlign,
  evaluateBalance,
  evaluateDistribute,
  evaluateLimit,
  evaluateMatch,
} from "../src/lib/rules.js";

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

  assert.equal(result.repetitions, Object.values(assignments).flat().length);
  assert.equal(
    result.score + result.violations.length,
    result.repetitions,
  );
});

test("match compares slot attributes with their assigned item attributes", () => {
  const result = evaluateMatch(
    {
      source: { collection: "slots", attribute: "division" },
      target: { collection: "items", attribute: "division" },
    },
    createTestModel(),
  );

  assert.equal(result.repetitions, Object.values(assignments).flat().length);
  assert.equal(
    result.score + result.violations.length,
    result.repetitions,
  );
});

test("match handles an item array against an assigned slot value", () => {
  const result = evaluateMatch(
    {
      source: { collection: "items", attribute: "practiceNights" },
      target: { collection: "slots", attribute: "practiceNight" },
    },
    createTestModel(),
  );

  assert.equal(result.repetitions, Object.values(assignments).flat().length);
  assert.equal(
    result.score + result.violations.length,
    result.repetitions,
  );
});

test("match ignores empty optional source values", () => {
  const model = createModel(
    [
      { id: "I1", teammateRequest: [] },
      { id: "I2", teammateRequest: ["I1"] },
      { id: "I3", teammateRequest: null },
    ],
    [{ id: "S1" }, { id: "S2" }],
    [],
    { S1: ["I1", "I2"], S2: ["I3"] },
  );

  const result = evaluateMatch(
    {
      source: { collection: "items", attribute: "teammateRequest" },
      target: { collection: "items", attribute: "id" },
    },
    model,
  );

  assert.deepEqual(result, {
    score: 1,
    repetitions: 1,
    violations: [],
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

test("align compares assigned slot attributes with sibling assigned slots", () => {
  const model = createModel(
    [
      { id: "I1", sibling: "I2" },
      { id: "I2", sibling: "I1" },
      { id: "I3", sibling: null },
    ],
    [
      { id: "S1", practiceNight: "Monday", gymLocation: "ROC" },
      { id: "S2", practiceNight: "Monday", gymLocation: "Sequoyah" },
    ],
    [],
    { S1: ["I1"], S2: ["I2", "I3"] },
  );

  const result = evaluateAlign(
    {
      source: { collection: "assignedSlots", attribute: "practiceNight" },
      target: {
        collection: "siblingAssignedSlots",
        attribute: "practiceNight",
      },
    },
    model,
  );

  assert.deepEqual(result, {
    score: 2,
    repetitions: 2,
    violations: [],
  });
});

test("align reports mismatched sibling slot attributes", () => {
  const model = createModel(
    [
      { id: "I1", sibling: "I2" },
      { id: "I2", sibling: "I1" },
    ],
    [
      { id: "S1", gymLocation: "ROC" },
      { id: "S2", gymLocation: "Sequoyah" },
    ],
    [],
    { S1: ["I1"], S2: ["I2"] },
  );

  const result = evaluateAlign(
    {
      source: { collection: "assignedSlots", attribute: "gymLocation" },
      target: {
        collection: "siblingAssignedSlots",
        attribute: "gymLocation",
      },
    },
    model,
  );

  assert.equal(result.score, 0);
  assert.equal(result.repetitions, 2);
  assert.deepEqual(result.violations, [
    {
      sourceId: "S1",
      targetId: "S2",
      sourceValue: "ROC",
      targetValue: "Sequoyah",
    },
    {
      sourceId: "S2",
      targetId: "S1",
      sourceValue: "Sequoyah",
      targetValue: "ROC",
    },
  ]);
});

test("distribute separates neighboring ranked values across slots", () => {
  const model = createModel(
    [
      { id: "I1", height: 40 },
      { id: "I2", height: 30 },
      { id: "I3", height: 20 },
      { id: "I4", height: 10 },
    ],
    [{ id: "S1" }, { id: "S2" }],
    [],
    {
      S1: ["I1", "I3"],
      S2: ["I2", "I4"],
    },
  );

  const result = evaluateDistribute(
    {
      source: { collection: "items", attribute: "height" },
      target: "slots",
    },
    model,
  );

  assert.deepEqual(result, {
    score: 3,
    repetitions: 3,
    violations: [],
  });
});

test("distribute reports neighboring values concentrated in one slot", () => {
  const model = createModel(
    [
      { id: "I1", height: 40 },
      { id: "I2", height: 30 },
      { id: "I3", height: 20 },
      { id: "I4", height: 10 },
    ],
    [{ id: "S1" }, { id: "S2" }],
    [],
    {
      S1: ["I1", "I2"],
      S2: ["I3", "I4"],
    },
  );

  const result = evaluateDistribute(
    {
      source: { collection: "items", attribute: "height" },
      target: "slots",
    },
    model,
  );

  assert.equal(result.score, 1);
  assert.equal(result.repetitions, 3);
  assert.deepEqual(result.violations, [
    {
      sourceId: "I1",
      targetId: "I2",
      sourceValue: 40,
      targetValue: 30,
      sharedSlotIds: ["S1"],
    },
    {
      sourceId: "I3",
      targetId: "I4",
      sourceValue: 20,
      targetValue: 10,
      sharedSlotIds: ["S2"],
    },
  ]);
});

test("limit evaluates assignment counts for each slot", () => {
  const model = createModel(
    [{ id: "I1" }, { id: "I2" }],
    [{ id: "S1" }, { id: "S2" }],
    [],
    { S1: ["I1", "I2"], S2: [] },
  );

  const result = evaluateLimit(
    {
      source: "slots",
      target: 1,
    },
    model,
  );

  assert.deepEqual({ ...result, violations: result.violations.length }, {
    score: 1.5,
    repetitions: 2,
    violations: 1,
  });
});

test("limit evaluates assignment counts for each item", () => {
  const model = createModel(
    [{ id: "I1" }, { id: "I2" }],
    [{ id: "S1" }, { id: "S2" }],
    [],
    { S1: ["I1"], S2: ["I1", "I2"] },
  );

  const result = evaluateLimit(
    {
      source: "items",
      target: 1,
    },
    model,
  );

  assert.deepEqual({ ...result, violations: result.violations.length }, {
    score: 1.5,
    repetitions: 2,
    violations: 1,
  });
});

test("limit rejects invalid targets", () => {
  assert.throws(
    () =>
      evaluateLimit(
        {
          source: "slots",
          target: -1,
        },
        createTestModel(),
      ),
    /Limit target must be a non-negative integer/,
  );
});

test("balance scores slot averages against the overall average", () => {
  const model = createModel(
    [
      { id: "I1", height: 10 },
      { id: "I2", height: 20 },
      { id: "I3", height: 30 },
      { id: "I4", height: 40 },
    ],
    [{ id: "S1" }, { id: "S2" }],
    [],
    { S1: ["I1", "I4"], S2: ["I2", "I3"] },
  );

  const result = evaluateBalance(
    {
      source: { collection: "items", attribute: "height" },
      target: { collection: "slots" },
    },
    model,
  );

  assert.deepEqual({ ...result, violations: result.violations.length }, {
    score: 2,
    repetitions: 2,
    violations: 0,
  });
});

test("balance scores deviations from the overall average", () => {
  const model = createModel(
    [
      { id: "I1", height: 10 },
      { id: "I2", height: 20 },
      { id: "I3", height: 30 },
      { id: "I4", height: 40 },
    ],
    [{ id: "S1" }, { id: "S2" }],
    [],
    { S1: ["I1", "I2"], S2: ["I3", "I4"] },
  );

  const result = evaluateBalance(
    {
      source: { collection: "items", attribute: "height" },
      target: { collection: "slots" },
    },
    model,
  );

  assert.deepEqual({ ...result, violations: result.violations.length }, {
    score: 1.8,
    repetitions: 2,
    violations: 2,
  });
});

test("balance supports slots as the source and items as the target", () => {
  const model = createModel(
    [{ id: "I1" }, { id: "I2" }],
    [
      { id: "S1", height: 10 },
      { id: "S2", height: 20 },
      { id: "S3", height: 30 },
      { id: "S4", height: 40 },
    ],
    [],
    { S1: ["I1"], S4: ["I1"], S2: ["I2"], S3: ["I2"] },
  );

  const result = evaluateBalance(
    {
      source: { collection: "slots", attribute: "height" },
      target: "items",
    },
    model,
  );

  assert.deepEqual({ ...result, violations: result.violations.length }, {
    score: 2,
    repetitions: 2,
    violations: 0,
  });
});
