import { evaluateRule } from "./rules.js";

export function scoreModel(model) {
  const score = {
    legal: true,
    hardViolations: [],
    softScore: 0,
    rules: [],
  };
  for (const rule of model.rules) {
    const ruleResult = evaluateRule(rule, model);

    score.rules.push({
      id: rule.id,
      name: rule.name,
      enforcement: rule.enforcement,
      score: ruleResult.score,
    });

    if (rule.enforcement === "hard" && ruleResult.score !== 1) {
      score.legal = false;
      score.hardViolations.push(rule.id);
    } else if (rule.enforcement === "soft") {
      score.softScore += (rule.priority ?? 0) * ruleResult.score;
    }
  }

  return score;
}
