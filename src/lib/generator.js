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
  maxHardIterations = 100,
  maxSoftIterations = 100,
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
    maxHardIterations,
  );
  const hardImprovedModel = createModel(items, slots, rules, hardAssignments);
  const softAssignments = improveSoftAssignments(
    hardImprovedModel,
    maxSoftIterations,
    onProgress,
  );
  const softImprovedModel = createModel(items, slots, rules, softAssignments);

  return {
    assignments: softAssignments,
    model: softImprovedModel,
    evaluation: evaluateModel(softImprovedModel),
  };
}

