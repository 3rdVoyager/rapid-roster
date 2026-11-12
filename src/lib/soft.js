import { createModel } from "./model.js";
import { evaluateModel, evaluateSwap } from "./evaluation.js";
import { getKeywordConfig } from "./keywords/config.js";
import { applySwapToModel, cloneAssignments } from "./assignment.js";
import { isItemCompatibleWithSlot } from "./keywords/helpers.js";

const MAX_SOFT_CANDIDATE_ATTEMPTS = 25;
const MIN_SOFT_IMPROVEMENT = 0.05;

export function improveSoftAssignments(model, maxIterations = 100, onProgress) {
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new Error("Max iterations must be a positive integer");
  }

  let assignments = cloneAssignments(model.assignments.slotAssignments);
  let currentModel = createModel(
    model.items,
    model.slots,
    model.rules,
    assignments,
  );
  let currentEvaluation = evaluateModel(currentModel);
  const hardCompatibilityIndex = createHardCompatibilityIndex(model);

  if (currentEvaluation.hardPenalty > 0) {
    const error = new Error(
      "Cannot improve soft assignments while hard rules are violated",
    );
    error.hardPenalty = currentEvaluation.hardPenalty;
    error.hardViolations = currentEvaluation.hardViolations;
    throw error;
  }

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const candidateDiagnostics = [];
    const candidateModel = createModel(
      model.items,
      model.slots,
      model.rules,
      cloneAssignments(assignments),
    );
    const candidate = generateCandidate(
      currentModel,
      currentEvaluation.softViolations,
      currentEvaluation,
      (candidateAssignments, swap) =>
        isBetterSoftCandidate(
          currentModel,
          candidateAssignments,
          currentEvaluation,
          swap,
          candidateModel,
        ),
      MAX_SOFT_CANDIDATE_ATTEMPTS,
      hardCompatibilityIndex,
      candidateDiagnostics,
    );

    if (!candidate) {
      onProgress?.({
        iteration: iteration + 1,
        softPenalty: currentEvaluation.softPenalty,
        improvement: 0,
        improved: false,
        complete: true,
        softRulePenalties: currentEvaluation.softRulePenalties,
        candidateDiagnostics,
      });
      break;
    }

    const previousSoftPenalty = currentEvaluation.softPenalty;
    assignments = candidate;
    currentModel = createModel(
      model.items,
      model.slots,
      model.rules,
      assignments,
    );
    currentEvaluation = evaluateModel(currentModel);
    onProgress?.({
      iteration: iteration + 1,
      softPenalty: currentEvaluation.softPenalty,
      improvement: previousSoftPenalty - currentEvaluation.softPenalty,
      improved: true,
      complete: false,
      softRulePenalties: currentEvaluation.softRulePenalties,
      candidateDiagnostics,
    });
  }

  return assignments;
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
  const prioritizedViolations = prioritizeViolations(
    violations,
    evaluation.softRulePenalties,
  );

  for (const violation of prioritizedViolations) {
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

function prioritizeViolations(violations, softRulePenalties = []) {
  if (softRulePenalties.length === 0) {
    return violations;
  }
  const weightedPenaltyByRuleId = new Map(
    softRulePenalties.map((rulePenalty) => [
      rulePenalty.ruleId,
      rulePenalty.weightedPenalty,
    ]),
  );
  return [...violations].sort(
    (first, second) =>
      (weightedPenaltyByRuleId.get(second.ruleId) ?? 0) -
      (weightedPenaltyByRuleId.get(first.ruleId) ?? 0),
  );
}

function isBetterSoftCandidate(
  model,
  assignments,
  currentEvaluation,
  swap,
  candidateModel,
) {
  const undoSwap = applySwapToModel(candidateModel, swap);
  const candidateEvaluation = evaluateSwap(
    model,
    currentEvaluation,
    candidateModel,
    swap,
  );
  const improved =
    candidateEvaluation.hardPenalty === 0 &&
    currentEvaluation.softPenalty - candidateEvaluation.softPenalty >=
      MIN_SOFT_IMPROVEMENT;

  if (!improved) {
    undoSwap();
  }
  return improved;
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
