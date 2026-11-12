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
  inputValidators: ["itemAttribute", "targetSlots"],
};

export function evaluate(inputs, model) {
  const itemAttribute = inputs[0];
  const slotTargets = inputs[1] ?? "all";
  const targetSlots = getTargetSlots(model, slotTargets);
  const itemValues = targetSlots
    .flatMap((slot) => getItemsInSlot(model, slot.id))
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

  for (const slot of targetSlots) {
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

export function isAffected(rule, _model, swap) {
  const targetSlots = rule.inputs[1] ?? "all";
  return (
    targetSlots === "all" ||
    [swap.firstSlotId, swap.secondSlotId].some((slotId) =>
      targetSlots.some(
        (targetSlotId) => String(targetSlotId) === String(slotId),
      ),
    )
  );
}

export function evaluateSwap(rule, model, currentPenalty, candidateModel, swap) {
  const [itemAttribute, slotTargets = "all"] = rule.inputs;
  const targetSlotIds = getTargetSlots(model, slotTargets).map(
    (slot) => slot.id,
  );
  const oldScore =
    getAffectedSlotScore(
      model,
      swap.firstSlotId,
      itemAttribute,
      targetSlotIds,
    ) +
    getAffectedSlotScore(
      model,
      swap.secondSlotId,
      itemAttribute,
      targetSlotIds,
    );
  const newScore =
    getAffectedSlotScore(
      candidateModel,
      swap.firstSlotId,
      itemAttribute,
      targetSlotIds,
    ) +
    getAffectedSlotScore(
      candidateModel,
      swap.secondSlotId,
      itemAttribute,
      targetSlotIds,
    );
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
  const [itemAttribute, slotTargets = "all"] = rule.inputs;
  const slotId = violation.targetId;
  const assignments = model.assignments.slotAssignments;
  const sourceItems = getItemsInSlot(model, slotId)
    .filter((item) => isNumericValue(item[itemAttribute]))
    .sort((first, second) =>
      violation.actual < violation.target
        ? first[itemAttribute] - second[itemAttribute]
        : second[itemAttribute] - first[itemAttribute],
    );
  const numericItemsBySlot = new Map();
  const slotAverageById = new Map();
  const targetSlots = model.slots
    .filter((slot) => isTargetSlot(slot, slotTargets))
    .filter((slot) => slot.id !== slotId);
  for (const targetSlot of targetSlots) {
    const numericItems = getItemsInSlot(model, targetSlot.id)
      .filter((item) => isNumericValue(item[itemAttribute]));
    numericItemsBySlot.set(targetSlot.id, numericItems);
    slotAverageById.set(
      targetSlot.id,
      getNumericSlotAverage(model, targetSlot.id, itemAttribute),
    );
  }
  targetSlots.sort((first, second) => {
      const firstAverage = slotAverageById.get(first.id);
      const secondAverage = slotAverageById.get(second.id);
      return violation.actual < violation.target
        ? secondAverage - firstAverage
        : firstAverage - secondAverage;
    });

  for (const sourceItem of sourceItems) {
    for (const targetSlot of targetSlots) {
      const targetItems = numericItemsBySlot.get(targetSlot.id)
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

function getTargetSlots(model, slotTargets) {
  if (slotTargets === "all") {
    return model.slots;
  }

  const targetSlotIds = new Set(
    slotTargets.map((slotId) => String(slotId)),
  );
  return model.slots.filter((slot) => targetSlotIds.has(String(slot.id)));
}

function isTargetSlot(slot, slotTargets) {
  return (
    slotTargets === "all" ||
    slotTargets.some((slotId) => String(slotId) === String(slot.id))
  );
}

function getAffectedSlotScore(model, slotId, itemAttribute, targetSlotIds) {
  return targetSlotIds.some(
    (targetSlotId) => String(targetSlotId) === String(slotId),
  )
    ? getBalanceSlotScore(model, slotId, itemAttribute, targetSlotIds)
    : 0;
}
