import test from "node:test";
import assert from "node:assert/strict";

import items from "./fixtures/items.json" with { type: "json" };
import slots from "./fixtures/slots.json" with { type: "json" };
import rules from "./fixtures/rules.json" with { type: "json" };
import assignments from "./fixtures/assignments.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import { evaluate as evaluateAlign } from "../src/lib/keywords/align.js";
import { evaluate as evaluateBalance } from "../src/lib/keywords/balance.js";
import {
  evaluate as evaluateDistribute,
} from "../src/lib/keywords/distribute.js";
import { evaluate as evaluateGroup } from "../src/lib/keywords/group.js";
import { evaluate as evaluateLimit } from "../src/lib/keywords/limit.js";
import { evaluate as evaluateMatch } from "../src/lib/keywords/match.js";

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
    ["gender", "divisionGender"],
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
    ["division", "division"],
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
    ["practiceNights", "practiceNight"],
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
      { id: "I1", matchValue: [] },
      { id: "I2", matchValue: "Monday" },
      { id: "I3", matchValue: null },
    ],
    [{ id: "S1", slotValue: "Monday" }, { id: "S2" }],
    [],
    { S1: ["I1", "I2"], S2: ["I3"] },
  );

  const result = evaluateMatch(["matchValue", "slotValue"], model);

  assert.deepEqual(result, {
    score: 1,
    repetitions: 1,
    violations: [],
  });
});

test("group checks requested item IDs against co-assigned items", () => {
  const model = createModel(
    [
      { id: "I1", teammateRequest: ["I2"] },
      { id: "I2", teammateRequest: [] },
      { id: "I3", teammateRequest: [] },
    ],
    [{ id: "S1" }, { id: "S2" }],
    [],
    { S1: ["I1", "I2"], S2: ["I3"] },
  );

  const result = evaluateGroup(["id", "teammateRequest"], model);

  assert.deepEqual(result, {
    score: 1,
    repetitions: 1,
    violations: [],
  });
});

test("group reports requested items that are not co-assigned", () => {
  const model = createModel(
    [
      { id: "I1", teammateRequest: ["I2", "I3"] },
      { id: "I2", teammateRequest: [] },
      { id: "I3", teammateRequest: [] },
    ],
    [{ id: "S1" }, { id: "S2" }],
    [],
    { S1: ["I1", "I2"], S2: ["I3"] },
  );

  const result = evaluateGroup(["id", "teammateRequest"], model);

  assert.deepEqual(result, {
    score: 1,
    repetitions: 2,
    violations: [
      {
        sourceId: "I1",
        targetId: "I3",
        sourceValue: ["I2", "I3"],
        targetValue: ["I2"],
      },
    ],
  });
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

  const result = evaluateAlign(["practiceNight", "sibling"], model);

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

  const result = evaluateAlign(["gymLocation", "sibling"], model);

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

  const result = evaluateDistribute(["height"], model);

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

  const result = evaluateDistribute(["height"], model);

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

  const result = evaluateLimit(["max", 1, "all"], model);

  assert.deepEqual({ ...result, violations: result.violations.length }, {
    score: 1.5,
    repetitions: 2,
    violations: 1,
  });
});

test("limit supports minimum assignment counts", () => {
  const model = createModel(
    [{ id: "I1" }],
    [{ id: "S1" }, { id: "S2" }],
    [],
    { S1: ["I1"], S2: [] },
  );

  const result = evaluateLimit(["min", 1, "all"], model);

  assert.deepEqual({ ...result, violations: result.violations.length }, {
    score: 1,
    repetitions: 2,
    violations: 1,
  });
});

test("limit can target selected slots", () => {
  const model = createModel(
    [{ id: "I1" }, { id: "I2" }],
    [{ id: "S1" }, { id: "S2" }],
    [],
    { S1: ["I1", "I2"], S2: [] },
  );

  const result = evaluateLimit(["max", 1, ["S2"]], model);

  assert.deepEqual(result, {
    score: 1,
    repetitions: 1,
    violations: [],
  });
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

  const result = evaluateBalance(["height"], model);

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

  const result = evaluateBalance(["height"], model);

  assert.deepEqual({ ...result, violations: result.violations.length }, {
    score: 1.8,
    repetitions: 2,
    violations: 2,
  });
});

test("balance can be scoped to selected slots", () => {
  const model = createModel(
    [
      { id: "I1", height: 10 },
      { id: "I2", height: 20 },
      { id: "I3", height: 30 },
      { id: "I4", height: 40 },
      { id: "I5", height: 100 },
      { id: "I6", height: 110 },
      { id: "I7", height: 120 },
      { id: "I8", height: 130 },
    ],
    [{ id: "S1" }, { id: "S2" }, { id: "S3" }, { id: "S4" }],
    [],
    {
      S1: ["I1", "I2"],
      S2: ["I3", "I4"],
      S3: ["I5", "I6"],
      S4: ["I7", "I8"],
    },
  );

  const result = evaluateBalance(["height", ["S1", "S2"]], model);

  assert.deepEqual({ ...result, violations: result.violations.length }, {
    score: 1.8,
    repetitions: 2,
    violations: 2,
  });
});

