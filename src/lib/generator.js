import { createModel } from "./model.js";
import { evaluateModel } from "./evaluation.js";
import {
  createInitialAssignments,
} from "./assignment.js";
import { improveHardAssignments } from "./hard.js";
import { improveSoftAssignments } from "./soft.js";

export function generateRoster({
  items,
  slots,
  rules = [],
  assignments,
  maxHardRounds = 100,
  maxSoftRounds,
  maxSoftTimeMs,
  onProgress,
} = {}) {
  const baseModel = createModel(items, slots, rules);
  const startingAssignments =
    assignments ?? createInitialAssignments(baseModel);
  const startingModel = createModel(
    items,
    slots,
    rules,
    startingAssignments,
  );
  const hardAssignments = improveHardAssignments(
    startingModel,
    maxHardRounds,
  );
  const hardImprovedModel = createModel(items, slots, rules, hardAssignments);
  if (maxSoftRounds !== undefined && maxSoftTimeMs !== undefined) {
    throw new Error(
      "Provide either maxSoftRounds or maxSoftTimeMs, not both",
    );
  }
  const softLimit =
    maxSoftTimeMs !== undefined
      ? { maxTimeMs: maxSoftTimeMs }
      : { maxRounds: maxSoftRounds ?? 100 };
  const softAssignments = improveSoftAssignments(
    hardImprovedModel,
    softLimit,
    onProgress,
  );
  const softImprovedModel = createModel(items, slots, rules, softAssignments);

  return {
    assignments: softAssignments,
    model: softImprovedModel,
    evaluation: evaluateModel(softImprovedModel),
  };
}

