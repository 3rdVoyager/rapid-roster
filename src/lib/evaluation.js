import { getKeywordConfig } from "./keywords/config.js";

export function evaluateRule(rule, model) {
  const keywordConfig = getKeywordConfig(rule.keyword);
  if (!keywordConfig) {
    throw new Error(`Unknown keyword: ${rule.keyword}`);
  }

  const result = keywordConfig.evaluate(rule.inputs, model);
  const priority = rule.priority ?? 1;
  const percentage =
    result.repetitions === 0 ? 1 : result.score / result.repetitions;

  return {
    score: percentage * priority,
    percentage,
    repetitions: result.repetitions,
    violations: result.violations,
  };
}

export function evaluateModel(model, includeSoftRules = true) {
  const evaluation = {
    hardPenalty: 0,
    hardViolations: [],
    softPenalty: 0,
    softViolations: [],
    softRulePenalties: [],
  };

  for (const rule of model.rules) {
    if (!includeSoftRules && rule.enforcement !== "hard") {
      continue;
    }

    const ruleEvaluation = evaluateRule(rule, model);
    const rulePenalty = 1 - ruleEvaluation.percentage;
    const violations = ruleEvaluation.violations.map((violation) => ({
      ruleId: rule.id,
      ...violation,
    }));

    if (rule.enforcement === "hard") {
      evaluation.hardPenalty += rulePenalty;
      evaluation.hardViolations.push(...violations);
    } else if (rule.enforcement === "soft") {
      const priority = rule.priority ?? 1;
      const weightedPenalty = rulePenalty * priority;
      evaluation.softPenalty += weightedPenalty;
      evaluation.softViolations.push(...violations);
      evaluation.softRulePenalties.push({
        ruleId: rule.id,
        name: rule.name,
        priority,
        percentage: ruleEvaluation.percentage,
        score: ruleEvaluation.percentage * ruleEvaluation.repetitions,
        repetitions: ruleEvaluation.repetitions,
        penalty: rulePenalty,
        weightedPenalty,
        violationCount: violations.length,
      });
    }
  }

  return evaluation;
}

export function evaluateSwap(
  model,
  currentEvaluation,
  candidateModel,
  swap,
  includeViolations = false,
) {
  const evaluation = {
    hardPenalty: 0,
    hardViolations: [],
    softPenalty: 0,
    softViolations: [],
    softRulePenalties: [],
  };
  const currentRulePenalties = new Map(
    currentEvaluation.softRulePenalties.map((rulePenalty) => [
      rulePenalty.ruleId,
      rulePenalty,
    ]),
  );

  for (const rule of model.rules) {
    if (rule.enforcement !== "soft") {
      continue;
    }

    const keywordConfig = getKeywordConfig(rule.keyword);
    const currentRulePenalty = currentRulePenalties.get(rule.id);
    const isAffected =
      keywordConfig?.isAffected?.(rule, model, swap) ?? true;
    const nextRuleEvaluation = includeViolations && isAffected
      ? evaluateRule(rule, candidateModel)
      : null;
    const nextRulePenalty =
      !isAffected && currentRulePenalty
        ? currentRulePenalty
        : keywordConfig?.evaluateSwap
          ? keywordConfig.evaluateSwap(
              rule,
              model,
              currentRulePenalty,
              candidateModel,
              swap,
            )
          : evaluateRulePenalty(rule, candidateModel);

    evaluation.softPenalty += nextRulePenalty.weightedPenalty;
    evaluation.softRulePenalties.push(nextRulePenalty);
    if (includeViolations) {
      const nextViolations = isAffected
        ? nextRuleEvaluation.violations
        : currentEvaluation.softViolations
          .filter((violation) => violation.ruleId === rule.id)
          .map(({ ruleId, ...violation }) => violation);
      evaluation.softViolations.push(
        ...nextViolations.map((violation) => ({
          ruleId: rule.id,
          ...violation,
        })),
      );
    }
  }

  return evaluation;
}

function evaluateRulePenalty(rule, model) {
  const result = evaluateRule(rule, model);
  return {
    ruleId: rule.id,
    name: rule.name,
    priority: rule.priority ?? 1,
    percentage: result.percentage,
    score: result.percentage * result.repetitions,
    repetitions: result.repetitions,
    penalty: 1 - result.percentage,
    weightedPenalty: (1 - result.percentage) * (rule.priority ?? 1),
    violationCount: result.violations.length,
  };
}

export const scoreModel = evaluateModel;
