import { evaluateRule } from "./rules.js";

export function scoreModel(model, hardOnly = false) {
  const score = {
    legal: true,
    hardPenalty: 0,
    softScore: 0,
    hardViolations: [],
    rules: [],
  };
  for (const rule of model.rules) {
    if (hardOnly && rule.enforcement !== "hard") {
      continue;
    }

    const ruleEvaluation = evaluateRule(rule, model);

    score.rules.push({
      id: rule.id,
      name: rule.name,
      enforcement: rule.enforcement,
      ...ruleEvaluation,
    });

    if (rule.enforcement === "hard") {
      score.hardPenalty += 1 - ruleEvaluation.percentage;
      if (ruleEvaluation.percentage !== 1) {
        score.legal = false;
        score.hardViolations.push(rule.id);
      }
    } else if (rule.enforcement === "soft") {
      score.softScore += ruleEvaluation.score;
    }
  }

  return score;
}
