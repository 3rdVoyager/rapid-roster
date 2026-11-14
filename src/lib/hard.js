import { createModel } from "./model.js";
import { evaluateModel } from "./evaluation.js";
import { cloneAssignments } from "./assignment.js";
import {
  countViolationsByRule,
  createHardCompatibilityIndex,
  generateCandidate,
} from "./optimizer-helpers.js";

export function improveHardAssignments(model, maxRounds = 100) {
  if (!Number.isInteger(maxRounds) || maxRounds < 1) {
    throw new Error("Max rounds must be a positive integer");
  }

  let assignments = cloneAssignments(model.assignments.slotAssignments);
  let currentEvaluation;
  const hardCompatibilityIndex = createHardCompatibilityIndex(model);
  const rulesById = new Map(model.rules.map((rule) => [rule.id, rule]));
  const hardRules = model.rules.filter(
    (rule) => rule.enforcement === "hard",
  );

  for (let round = 0; round < maxRounds; round++) {
    let currentModel = createModel(
      model.items,
      model.slots,
      model.rules,
      assignments,
    );
    currentEvaluation = evaluateModel(currentModel, false);
    if (currentEvaluation.hardPenalty === 0) {
      return assignments;
    }

    let roundImproved = false;

    for (const rule of hardRules) {
      const ruleViolations = currentEvaluation.hardViolations.filter(
        (violation) => violation.ruleId === rule.id,
      );
      if (ruleViolations.length === 0) {
        continue;
      }

      const candidate = generateCandidate(
        currentModel,
        ruleViolations,
        (candidateAssignments) =>
          isBetterHardCandidate(
            currentModel,
            candidateAssignments,
            currentEvaluation,
          ),
        hardCompatibilityIndex,
        rulesById,
      );
      if (!candidate) {
        continue;
      }

      roundImproved = true;
      assignments = candidate;
      currentModel = createModel(
        model.items,
        model.slots,
        model.rules,
        assignments,
      );
      currentEvaluation = evaluateModel(currentModel, false);
      if (currentEvaluation.hardPenalty === 0) {
        return assignments;
      }
    }

    if (!roundImproved) {
      break;
    }
  }

  const violationCounts = countViolationsByRule(currentEvaluation);
  const error = new Error(
    `Could not create legal assignments after ${maxRounds} rounds. ` +
      `Hard penalty: ${currentEvaluation.hardPenalty}. ` +
      `Remaining violations: ${violationCounts}`,
  );
  error.hardPenalty = currentEvaluation.hardPenalty;
  error.hardViolations = currentEvaluation.hardViolations;
  throw error;
}

function isBetterHardCandidate(model, assignments, currentEvaluation) {
  const candidateModel = createModel(
    model.items,
    model.slots,
    model.rules,
    assignments,
  );
  const candidateEvaluation = evaluateModel(candidateModel, false);
  return candidateEvaluation.hardPenalty < currentEvaluation.hardPenalty;
}
