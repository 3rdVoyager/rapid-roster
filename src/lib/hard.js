import { createModel } from "./model.js";
import { evaluateModel } from "./evaluation.js";
import { getKeywordConfig } from "./keywords/config.js";
import { cloneAssignments } from "./assignment.js";
import { isItemCompatibleWithSlot } from "./keywords/helpers.js";

export function improveHardAssignments(model, maxRounds = 100) {
  if (!Number.isInteger(maxRounds) || maxRounds < 1) {
    throw new Error("Max rounds must be a positive integer");
  }

  let assignments = cloneAssignments(model.assignments.slotAssignments);
  let lastEvaluation;
  const hardCompatibilityIndex = createHardCompatibilityIndex(model);
  const rulesById = new Map(model.rules.map((rule) => [rule.id, rule]));

  for (let round = 0; round < maxRounds; round++) {
    let currentModel = createModel(
      model.items,
      model.slots,
      model.rules,
      assignments,
    );
    let currentEvaluation = evaluateModel(currentModel, true);
    lastEvaluation = currentEvaluation;
    if (currentEvaluation.hardPenalty === 0) {
      return assignments;
    }

    let roundImproved = false;
    const hardRules = model.rules.filter(
      (rule) => rule.enforcement === "hard",
    );

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
      lastEvaluation = evaluateModel(currentModel, true);
      currentEvaluation = lastEvaluation;
      if (lastEvaluation.hardPenalty === 0) {
        return assignments;
      }
    }

    if (!roundImproved) {
      break;
    }
  }

  const violationCounts = countViolationsByRule(lastEvaluation);
  const error = new Error(
    `Could not create legal assignments after ${maxRounds} rounds. ` +
      `Hard penalty: ${lastEvaluation.hardPenalty}. ` +
      `Remaining violations: ${violationCounts}`,
  );
  error.hardPenalty = lastEvaluation.hardPenalty;
  error.hardViolations = lastEvaluation.hardViolations;
  throw error;
}

function isBetterHardCandidate(model, assignments, currentEvaluation) {
  const candidateModel = createModel(
    model.items,
    model.slots,
    model.rules,
    assignments,
  );
  const candidateEvaluation = evaluateModel(candidateModel, true);
  return isBetterScore(candidateEvaluation, currentEvaluation);
}

function createHardCompatibilityIndex(model) {
  const hardMatchRules = model.rules.filter(
    (rule) => rule.enforcement === "hard" && rule.keyword === "match",
  );
  return new Map(
    model.items.map((item) => [
      item.id,
      new Set(
        model.slots
          .filter((slot) =>
            hardMatchRules.every((rule) =>
              isItemCompatibleWithSlot(item, slot, rule),
            ),
          )
          .map((slot) => slot.id),
      ),
    ]),
  );
}

function generateCandidate(
  model,
  violations,
  isBetterCandidate,
  hardCompatibilityIndex,
  rulesById,
) {
  for (const violation of violations) {
    const rule = rulesById.get(violation.ruleId);
    const keywordConfig = getKeywordConfig(rule?.keyword);
    const limitedCandidateEvaluator = (candidate, swap) => {
      return isBetterCandidate(candidate, swap);
    };

    const candidate = keywordConfig?.generateCandidate?.({
      model,
      rule,
      violation,
      isBetterCandidate: limitedCandidateEvaluator,
      hardCompatibilityIndex,
    });
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function countViolationsByRule(evaluation) {
  const counts = {};
  for (const violation of evaluation.hardViolations) {
    counts[violation.ruleId] = (counts[violation.ruleId] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([ruleId, count]) => `${ruleId} (${count})`)
    .join(", ");
}

function isBetterScore(candidateScore, currentScore) {
  if (candidateScore.hardPenalty !== currentScore.hardPenalty) {
    return candidateScore.hardPenalty < currentScore.hardPenalty;
  }
  return false;
}
