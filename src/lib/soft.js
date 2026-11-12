import { createModel } from "./model.js";
import { evaluateModel, evaluateSwap } from "./evaluation.js";
import { getKeywordConfig } from "./keywords/config.js";
import { applySwapToModel, cloneAssignments } from "./assignment.js";
import { isItemCompatibleWithSlot } from "./keywords/helpers.js";

export function improveSoftAssignments(
  model,
  limit = { maxRounds: 100 },
  onProgress,
) {
  const { maxRounds, maxTimeMs } = limit;
  if (
    (maxRounds === undefined && maxTimeMs === undefined) ||
    (maxRounds !== undefined && maxTimeMs !== undefined)
  ) {
    throw new Error("Provide exactly one soft optimization limit");
  }
  if (
    maxRounds !== undefined &&
    (!Number.isInteger(maxRounds) || maxRounds < 1)
  ) {
    throw new Error("Max rounds must be a positive integer");
  }
  if (
    maxTimeMs !== undefined &&
    (!Number.isFinite(maxTimeMs) || maxTimeMs < 1)
  ) {
    throw new Error("Max time must be a positive number of milliseconds");
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

  const optimizationStartedAt = globalThis.performance.now();
  let stopReason;
  let currentRound = 0;
  for (
    let pass = 0;
    maxRounds === undefined || pass < maxRounds;
    pass++
  ) {
    currentRound = pass + 1;
    if (maxTimeMs !== undefined && passStartedAt(maxTimeMs)) {
      stopReason = "time";
      break;
    }
    const priorityRules = getPriorityRules(
      model.rules,
      currentEvaluation.softRulePenalties,
    );
    let passImproved = false;

    for (const rule of priorityRules) {
      if (maxTimeMs !== undefined && passStartedAt(maxTimeMs)) {
        stopReason = "time";
        break;
      }
      const ruleViolations = currentEvaluation.softViolations.filter(
        (violation) => violation.ruleId === rule.id,
      );
      if (ruleViolations.length === 0) {
        continue;
      }

      const candidateDiagnostics = [];
      const candidateModel = createModel(
        model.items,
        model.slots,
        model.rules,
        cloneAssignments(assignments),
      );
      const previousSoftPenalty = currentEvaluation.softPenalty;
      const candidate = generateCandidate(
        currentModel,
        ruleViolations,
        currentEvaluation,
        (candidateAssignments, swap) =>
          isBetterSoftCandidate(
            currentModel,
            candidateAssignments,
            currentEvaluation,
            swap,
            candidateModel,
          ),
        hardCompatibilityIndex,
        candidateDiagnostics,
      );

      if (!candidate) {
        continue;
      }

      passImproved = true;
      assignments = candidate;
      currentModel = createModel(
        model.items,
        model.slots,
        model.rules,
        assignments,
      );
      currentEvaluation = evaluateModel(currentModel);
      onProgress?.({
        round: pass + 1,
        ruleId: rule.id,
        softPenalty: currentEvaluation.softPenalty,
        improvement: previousSoftPenalty - currentEvaluation.softPenalty,
        improved: true,
        complete: false,
        softRulePenalties: currentEvaluation.softRulePenalties,
        candidateDiagnostics,
      });
    }

    if (stopReason === "time") {
      break;
    }

    if (!passImproved) {
      stopReason = "no-improvement";
      onProgress?.({
        round: pass + 1,
        softPenalty: currentEvaluation.softPenalty,
        improvement: 0,
        improved: false,
        complete: true,
        softRulePenalties: currentEvaluation.softRulePenalties,
        candidateDiagnostics: [],
      });
      break;
    }
  }

  if (stopReason === "time") {
    onProgress?.({
      round: currentRound,
      softPenalty: currentEvaluation.softPenalty,
      improvement: 0,
      improved: false,
      complete: true,
      stopReason,
      softRulePenalties: currentEvaluation.softRulePenalties,
      candidateDiagnostics: [],
    });
  }

  return assignments;

  function passStartedAt(timeLimit) {
    return globalThis.performance.now() - optimizationStartedAt >= timeLimit;
  }
}

function generateCandidate(
  model,
  violations,
  evaluation,
  isBetterCandidate,
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
    const limitedCandidateEvaluator = (candidate, swap) => {
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

function getPriorityRules(rules, softRulePenalties) {
  const weightedPenaltyByRuleId = new Map(
    softRulePenalties.map((rulePenalty) => [
      rulePenalty.ruleId,
      rulePenalty.weightedPenalty,
    ]),
  );
  return rules
    .filter((rule) => rule.enforcement === "soft")
    .sort(
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
    candidateEvaluation.softPenalty < currentEvaluation.softPenalty;

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
