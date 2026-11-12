import { getAssignedSlotIds, getItemById } from "../selectors.js";
import { swapAssignments } from "../assignment.js";
import {
  canSwapWithoutBreakingHardMatches,
  createRulePenalty,
  getItemsInSlot,
  isNumericValue,
} from "./helpers.js";

export const config = {
  keyword: "distribute",
  inputValidators: ["itemAttribute", "targetSlots"],
};

export function evaluate(inputs, model) {
  const itemAttribute = inputs[0];
  const targetSlots = inputs[1] ?? "all";
  const rankedItems = getRankedItems(model, itemAttribute, targetSlots);

  if (rankedItems.length < 2) {
    return { score: 1, repetitions: 1, violations: [] };
  }

  let score = 0;
  const violations = [];
  for (let index = 1; index < rankedItems.length; index++) {
    const previousItem = rankedItems[index - 1];
    const currentItem = rankedItems[index];
    const sharedSlotIds = previousItem.assignedSlotIds.filter((slotId) =>
      currentItem.assignedSlotIds.includes(slotId),
    );

    if (sharedSlotIds.length === 0) {
      score++;
    } else {
      violations.push({
        sourceId: previousItem.item.id,
        targetId: currentItem.item.id,
        sourceValue: previousItem.itemValue,
        targetValue: currentItem.itemValue,
        sharedSlotIds,
      });
    }
  }

  return {
    score,
    repetitions: rankedItems.length - 1,
    violations,
  };
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
  const targetSlots = rule.inputs[1] ?? "all";
  const rankedItems = getRankedItems(model, rule.inputs[0], targetSlots);
  const candidateRankedItems = getRankedItems(
    candidateModel,
    rule.inputs[0],
    targetSlots,
  );
  const affectedIndexes = getAffectedPairIndexes(
    rankedItems,
    candidateRankedItems,
    swap,
  );
  let score = currentPenalty.score;

  for (const index of affectedIndexes) {
    score -= getPairScore(rankedItems, index);
    score += getPairScore(candidateRankedItems, index);
  }

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

function getRankedItems(model, itemAttribute, targetSlots = "all") {
  const targetSlotIds = getTargetSlotIds(model, targetSlots);
  return model.items
    .filter((item) => isNumericValue(item[itemAttribute]))
    .map((item) => ({
      item,
      itemValue: item[itemAttribute],
      assignedSlotIds: getAssignedSlotIds(model, item.id).filter((slotId) =>
        targetSlotIds.has(String(slotId)),
      ),
    }))
    .filter((entry) => entry.assignedSlotIds.length > 0)
    .sort((first, second) => second.itemValue - first.itemValue);
}

function getAffectedPairIndexes(firstRankedItems, secondRankedItems, swap) {
  const affectedItemIds = new Set([swap.firstItemId, swap.secondItemId]);
  const indexes = new Set();
  for (const rankedItems of [firstRankedItems, secondRankedItems]) {
    for (let index = 0; index < rankedItems.length; index++) {
      if (!affectedItemIds.has(rankedItems[index].item.id)) {
        continue;
      }
      if (index > 0) {
        indexes.add(index - 1);
      }
      if (index < rankedItems.length - 1) {
        indexes.add(index);
      }
    }
  }
  return indexes;
}

function getPairScore(rankedItems, index) {
  const first = rankedItems[index];
  const second = rankedItems[index + 1];
  if (!first || !second) {
    return 0;
  }
  return first.assignedSlotIds.some((slotId) =>
    second.assignedSlotIds.includes(slotId),
  )
    ? 0
    : 1;
}

export function generateCandidate({
  model,
  rule,
  violation,
  isBetterCandidate,
  hardCompatibilityIndex,
  diagnostic,
}) {
  const [itemAttribute, targetSlots = "all"] = rule.inputs;
  const targetSlotIds = getTargetSlotIds(model, targetSlots);
  const sourceItemId = violation.sourceId;
  const targetItemId = violation.targetId;
  const sourceSlotIds = getAssignedSlotIds(model, sourceItemId).filter(
    (slotId) => targetSlotIds.has(String(slotId)),
  );
  const targetItemSlotIds = getAssignedSlotIds(model, targetItemId).filter(
    (slotId) => targetSlotIds.has(String(slotId)),
  );
  const assignments = model.assignments.slotAssignments;
  const sourceValue = getItemById(model, sourceItemId)[itemAttribute];
  const targetValue = getItemById(model, targetItemId)[itemAttribute];

  for (const sourceSlotId of sourceSlotIds) {
    for (const targetSlotId of targetItemSlotIds) {
      if (sourceSlotId === targetSlotId) {
        continue;
      }
      const candidate = trySwap({
        assignments,
        sourceItemId,
        sourceSlotId,
        targetItemId,
        targetSlotId,
        isBetterCandidate,
        hardCompatibilityIndex,
        diagnostic,
      });
      if (candidate) {
        return candidate;
      }
    }
  }

  for (const sharedSlotId of violation.sharedSlotIds ?? []) {
    for (const targetSlot of model.slots) {
      if (!targetSlotIds.has(String(targetSlot.id))) {
        continue;
      }
      if (targetSlot.id === sharedSlotId) {
        continue;
      }
      const targetItems = getItemsInSlot(model, targetSlot.id)
        .filter((item) => isNumericValue(item[itemAttribute]))
        .sort((first, second) =>
          sourceValue >= targetValue
            ? first[itemAttribute] - second[itemAttribute]
            : second[itemAttribute] - first[itemAttribute],
        );
      for (const targetItem of targetItems) {
        const candidate = trySwap({
          assignments,
          sourceItemId,
          sourceSlotId: sharedSlotId,
          targetItemId: targetItem.id,
          targetSlotId: targetSlot.id,
          isBetterCandidate,
          hardCompatibilityIndex,
          diagnostic,
        });
        if (candidate) {
          return candidate;
        }
      }
    }
  }

  return null;
}

function getTargetSlotIds(model, targetSlots) {
  if (targetSlots === "all") {
    return new Set(model.slots.map((slot) => String(slot.id)));
  }

  return new Set(targetSlots.map((slotId) => String(slotId)));
}

function trySwap({
  assignments,
  sourceItemId,
  sourceSlotId,
  targetItemId,
  targetSlotId,
  isBetterCandidate,
  hardCompatibilityIndex,
  diagnostic,
}) {
  if (
    !canSwapWithoutBreakingHardMatches(
      hardCompatibilityIndex,
      sourceItemId,
      sourceSlotId,
      targetItemId,
      targetSlotId,
    )
  ) {
    diagnostic.hardRejected++;
    return null;
  }
  const candidate = swapAssignments(
    assignments,
    sourceSlotId,
    sourceItemId,
    targetSlotId,
    targetItemId,
  );
  return isBetterCandidate(candidate, {
    firstItemId: sourceItemId,
    firstSlotId: sourceSlotId,
    secondItemId: targetItemId,
    secondSlotId: targetSlotId,
  })
    ? candidate
    : null;
}
