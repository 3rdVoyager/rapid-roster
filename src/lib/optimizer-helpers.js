import { getKeywordConfig } from "./keywords/config.js";
import { isItemCompatibleWithSlot } from "./keywords/helpers.js";

export function createHardCompatibilityIndex(model) {
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

export function generateCandidate(
  model,
  violations,
  isBetterCandidate,
  hardCompatibilityIndex,
  rulesById,
) {
  for (const violation of violations) {
    const rule = rulesById.get(violation.ruleId);
    const keywordConfig = getKeywordConfig(rule?.keyword);
    const candidate = keywordConfig?.generateCandidate?.({
      model,
      rule,
      violation,
      isBetterCandidate,
      hardCompatibilityIndex,
    });
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

export function countViolationsByRule(evaluation) {
  const counts = {};
  for (const violation of evaluation.hardViolations) {
    counts[violation.ruleId] = (counts[violation.ruleId] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([ruleId, count]) => `${ruleId} (${count})`)
    .join(", ");
}
