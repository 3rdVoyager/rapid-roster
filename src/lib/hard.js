import { createModel } from "./model.js";
import { evaluateModel } from "./evaluation.js";
import { getKeywordConfig } from "./keywords/config.js";
import { cloneAssignments } from "./assignment.js";
import { isItemCompatibleWithSlot } from "./keywords/helpers.js";

export function improveHardAssignments(model, maxIterations = 100) {
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new Error("Max iterations must be a positive integer");
  }

  let assignments = cloneAssignments(model.assignments.slotAssignments);
  let lastEvaluation;
  const hardCompatibilityIndex = createHardCompatibilityIndex(model);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const currentModel = createModel(
      model.items,
      model.slots,
      model.rules,
      assignments,
    );
    const currentEvaluation = evaluateModel(currentModel, true);
    lastEvaluation = currentEvaluation;
    if (currentEvaluation.hardPenalty === 0) {
      return assignments;
    }

    const candidate = generateCandidate(
      currentModel,
      currentEvaluation.hardViolations,
      currentEvaluation,
      (candidateAssignments) =>
        isBetterHardCandidate(
          currentModel,
          candidateAssignments,
          currentEvaluation,
        ),
      Number.POSITIVE_INFINITY,
      hardCompatibilityIndex,
    );
    if (!candidate) {
      break;
    }
    assignments = candidate;
  }

  const violationCounts = countViolationsByRule(lastEvaluation);
  const error = new Error(
    `Could not create legal assignments after ${maxIterations} iterations. ` +
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
  evaluation,
  isBetterCandidate,
  maximumAttempts,
  hardCompatibilityIndex,
  candidateDiagnostics = [],
) {
  for (const violation of violations) {
    const rule = model.rules.find(
      (candidate) => candidate.id === violation.ruleId,
    );
    const keywordConfig = getKeywordConfig(rule?.keyword);
    const diagnostic = {
      ruleId: violation.ruleId,
      keyword: rule?.keyword,
      attempts: 0,
      hardRejected: 0,
      scored: 0,
      accepted: 0,
      scoringMs: 0,
    };
    let attempts = 0;
    const limitedCandidateEvaluator = (candidate, swap) => {
      if (attempts >= maximumAttempts) {
        return false;
      }
      attempts++;
      diagnostic.attempts++;
      diagnostic.scored++;
      const scoringStartedAt = globalThis.performance.now();
      const improved = isBetterCandidate(candidate, swap);
      diagnostic.scoringMs += globalThis.performance.now() - scoringStartedAt;
      if (improved) {
        diagnostic.accepted++;
      }
      return improved;
    };

    const candidate = keywordConfig?.generateCandidate?.({
      model,
      rule,
      violation,
      isBetterCandidate: limitedCandidateEvaluator,
      hardCompatibilityIndex,
      diagnostic,
    });
    candidateDiagnostics.push(diagnostic);
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
