import { getAssignedSlots, getItemById } from "../selectors.js";
import { swapAssignments } from "../assignment.js";
import {
  canSwapWithoutBreakingHardMatches,
  createRulePenalty,
  isEmptyValue,
  valuesMatch,
} from "./helpers.js";

export const config = {
  keyword: "match",
  inputValidators: ["itemAttribute", "slotAttribute"],
};

export function evaluate(inputs, model) {
  const [itemAttribute, slotAttribute] = inputs;
  let score = 0;
  let repetitions = 0;
  const violations = [];

  for (const item of model.items) {
    for (const slot of getAssignedSlots(model, item.id)) {
      const itemValue = item[itemAttribute];
      const slotValue = slot[slotAttribute];

      if (isEmptyValue(itemValue)) {
        continue;
      }

      if (valuesMatch(itemValue, slotValue)) {
        score++;
      } else {
        violations.push({
          sourceId: item.id,
          targetId: slot.id,
          sourceValue: itemValue,
          targetValue: slotValue,
        });
      }
      repetitions++;
    }
  }

  return { score, repetitions, violations };
}

export function isAffected() {
  return true;
}

export function evaluateSwap(rule, model, currentPenalty, _candidateModel, swap) {
  const [itemAttribute, slotAttribute] = rule.inputs;
  const firstItem = getItemById(model, swap.firstItemId);
  const secondItem = getItemById(model, swap.secondItemId);
  const firstSlot = model.slots.find((slot) => slot.id === swap.firstSlotId);
  const secondSlot = model.slots.find((slot) => slot.id === swap.secondSlotId);
  const oldScore =
    matchValue(firstItem, firstSlot, itemAttribute, slotAttribute) +
    matchValue(secondItem, secondSlot, itemAttribute, slotAttribute);
  const newScore =
    matchValue(secondItem, firstSlot, itemAttribute, slotAttribute) +
    matchValue(firstItem, secondSlot, itemAttribute, slotAttribute);
  const score = currentPenalty.score - oldScore + newScore;
  const percentage =
    currentPenalty.repetitions === 0
      ? 1
      : score / currentPenalty.repetitions;

  return createRulePenalty(
    rule,
    percentage,
    score,
    currentPenalty.repetitions,
  );
}

function matchValue(item, slot, itemAttribute, slotAttribute) {
  if (!item || !slot || isEmptyValue(item[itemAttribute])) {
    return 0;
  }
  return valuesMatch(item[itemAttribute], slot[slotAttribute]) ? 1 : 0;
}

export function generateCandidate({
  model,
  violation,
  isBetterCandidate,
  hardCompatibilityIndex,
}) {
  const [itemAttribute, slotAttribute] = model.rules.find(
    (rule) => rule.id === violation.ruleId,
  ).inputs;
  const item = getItemById(model, violation.sourceId);
  const targetSlots = model.slots.filter((slot) =>
    valuesMatch(item[itemAttribute], slot[slotAttribute]),
  );
  const assignments = model.assignments.slotAssignments;

  for (const targetSlot of targetSlots) {
    if (targetSlot.id === violation.targetId) {
      continue;
    }

    for (const targetItemId of assignments[targetSlot.id] ?? []) {
      if (
        !canSwapWithoutBreakingHardMatches(
          hardCompatibilityIndex,
          violation.sourceId,
          violation.targetId,
          targetItemId,
          targetSlot.id,
        )
      ) {
        continue;
      }

      const candidate = swapAssignments(
        assignments,
        violation.targetId,
        violation.sourceId,
        targetSlot.id,
        targetItemId,
      );
      if (
        isBetterCandidate(candidate, {
          firstItemId: violation.sourceId,
          firstSlotId: violation.targetId,
          secondItemId: targetItemId,
          secondSlotId: targetSlot.id,
        })
      ) {
        return candidate;
      }
    }
  }

  return null;
}
