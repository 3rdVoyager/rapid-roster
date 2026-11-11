import { evaluateRule } from "./rules.js";

export function evaluateModel(model, hardOnly = false) {
  const evaluation = {
    hardPenalty: 0,
    hardViolations: [],
    softPenalty: 0,
    softViolations: [],
    softRulePenalties: [],
  };
  for (const rule of model.rules) {
    if (hardOnly && rule.enforcement !== "hard") {
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
        penalty: rulePenalty,
        weightedPenalty,
        violationCount: violations.length,
      });
    }
  }

  return evaluation;
}

export const scoreModel = evaluateModel;
