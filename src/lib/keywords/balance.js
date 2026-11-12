import {
  canSwapWithoutBreakingHardMatches,
  createRulePenalty,
  getBalanceSlotScore,
  getItemsInSlot,
  getNumericSlotAverage,
  isNumericValue,
} from "./helpers.js";
import { swapAssignments } from "../assignment.js";

export const config = {
  keyword: "balance",
  inputValidators: ["itemAttribute"],
};

export function evaluate(inputs, model) {
  const itemAttribute = inputs[0];
  const itemValues = model.items
    .map((item) => item[itemAttribute])
    .filter(isNumericValue);

  if (itemValues.length === 0) {
    return { score: 1, repetitions: 1, violations: [] };
  }

  const overallAverage =
    itemValues.reduce((total, value) => total + value, 0) / itemValues.length;
  let score = 0;
  let repetitions = 0;
  const violations = [];

  for (const slot of model.slots) {
    const assignedItems = getItemsInSlot(model, slot.id);
    const numericValues = assignedItems
      .map((item) => item[itemAttribute])
      .filter(isNumericValue);
    const slotAverage =
      numericValues.length === 0
        ? 0
        : numericValues.reduce((total, value) => total + value, 0) /
          numericValues.length;
    const difference = Math.abs(slotAverage - overallAverage);
    const slotScore = Math.max(0, 1 - difference / 100);

    score += slotScore;
    repetitions++;
    if (slotScore < 1) {
      violations.push({
        targetId: slot.id,
        actual: slotAverage,
        target: overallAverage,
        difference,
      });
    }
  }

  return { score, repetitions, violations };
}

export function isAffected() {
  return true;
}

export function evaluateSwap(rule, model, currentPenalty, candidateModel, swap) {
  const itemAttribute = rule.inputs[0];
  const oldScore =
    getBalanceSlotScore(model, swap.firstSlotId, itemAttribute) +
    getBalanceSlotScore(model, swap.secondSlotId, itemAttribute);
  const newScore =
    getBalanceSlotScore(candidateModel, swap.firstSlotId, itemAttribute) +
    getBalanceSlotScore(candidateModel, swap.secondSlotId, itemAttribute);
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

export function generateCandidate({
  model,
  rule,
  violation,
  isBetterCandidate,
  hardCompatibilityIndex,
  diagnostic,
}) {
  const itemAttribute = rule.inputs[0];
  const slotId = violation.targetId;
  const assignments = model.assignments.slotAssignments;
  const sourceItems = getItemsInSlot(model, slotId)
    .filter((item) => isNumericValue(item[itemAttribute]))
    .sort((first, second) =>
      violation.actual < violation.target
        ? first[itemAttribute] - second[itemAttribute]
        : second[itemAttribute] - first[itemAttribute],
    );
  const targetSlots = model.slots
    .filter((slot) => slot.id !== slotId)
    .sort((first, second) => {
      const firstAverage = getNumericSlotAverage(
        model,
        first.id,
        itemAttribute,
      );
      const secondAverage = getNumericSlotAverage(
        model,
        second.id,
        itemAttribute,
      );
      return violation.actual < violation.target
        ? secondAverage - firstAverage
        : firstAverage - secondAverage;
    });

  for (const sourceItem of sourceItems) {
    for (const targetSlot of targetSlots) {
      const targetItems = getItemsInSlot(model, targetSlot.id)
        .filter((item) => isNumericValue(item[itemAttribute]))
        .sort((first, second) =>
          violation.actual < violation.target
            ? second[itemAttribute] - first[itemAttribute]
            : first[itemAttribute] - second[itemAttribute],
        );

      for (const targetItem of targetItems) {
        if (
          !canSwapWithoutBreakingHardMatches(
            hardCompatibilityIndex,
            sourceItem.id,
            slotId,
            targetItem.id,
            targetSlot.id,
          )
        ) {
          diagnostic.hardRejected++;
          continue;
        }

        const candidate = swapAssignments(
          assignments,
          slotId,
          sourceItem.id,
          targetSlot.id,
          targetItem.id,
        );
        if (
          isBetterCandidate(candidate, {
            firstItemId: sourceItem.id,
            firstSlotId: slotId,
            secondItemId: targetItem.id,
            secondSlotId: targetSlot.id,
          })
        ) {
          return candidate;
        }
      }
    }
  }

  return null;
}
