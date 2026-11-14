import test from "node:test";
import assert from "node:assert/strict";

import { createModel } from "../src/lib/model.js";
import {
  createHardCompatibilityIndex,
  generateCandidate,
} from "../src/lib/optimizer-helpers.js";

test("indexes slots compatible with every hard match rule", () => {
  const model = createModel(
    [
      { id: "I1", gender: "F", division: "A" },
      { id: "I2", gender: "M", division: "B" },
    ],
    [
      { id: "S1", divisionGender: "F", division: "A" },
      { id: "S2", divisionGender: "M", division: "B" },
      { id: "S3", divisionGender: "F", division: "B" },
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
        name: "Match division",
        enforcement: "hard",
        keyword: "match",
        inputs: ["division", "division"],
      },
    ],
  );

  const index = createHardCompatibilityIndex(model);

  assert.deepEqual([...index.get("I1")], ["S1"]);
  assert.deepEqual([...index.get("I2")], ["S2"]);
});

test("dispatches a violation to its keyword candidate generator", () => {
  const model = createModel(
    [
      { id: "I1", gender: "F" },
      { id: "I2", gender: "M" },
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
    { S1: ["I1"], S2: ["I2"] },
  );
  const rulesById = new Map(model.rules.map((rule) => [rule.id, rule]));
  const candidate = generateCandidate(
    model,
    [
      {
        ruleId: "R1",
        sourceId: "I1",
        targetId: "S1",
      },
    ],
    () => true,
    createHardCompatibilityIndex(model),
    rulesById,
  );

  assert.deepEqual(candidate, { S1: ["I2"], S2: ["I1"] });
});
