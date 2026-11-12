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
  inputValidators: ["itemAttribute"],
};

export function evaluate(inputs, model) {
  const itemAttribute = inputs[0];
  const rankedItems = getRankedItems(model, itemAttribute);

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

export function isAffected(rule, model, swap) {
  const itemAttribute = rule.inputs[0];
  return [swap.firstItemId, swap.secondItemId].some((itemId) =>
    isNumericValue(getItemById(model, itemId)?.[itemAttribute]),
  );
}

export function evaluateSwap(rule, model, currentPenalty, candidateModel, swap) {
  const rankedItems = getRankedItems(model, rule.inputs[0]);
  const candidateRankedItems = getRankedItems(
    candidateModel,
    rule.inputs[0],
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

function getRankedItems(model, itemAttribute) {
  return model.items
    .filter((item) => isNumericValue(item[itemAttribute]))
    .map((item) => ({
      item,
      itemValue: item[itemAttribute],
      assignedSlotIds: getAssignedSlotIds(model, item.id),
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
  const itemAttribute = rule.inputs[0];
  const sourceItemId = violation.sourceId;
  const targetItemId = violation.targetId;
  const sourceSlotIds = getAssignedSlotIds(model, sourceItemId);
  const targetSlotIds = getAssignedSlotIds(model, targetItemId);
  const assignments = model.assignments.slotAssignments;
  const sourceValue = getItemById(model, sourceItemId)[itemAttribute];
  const targetValue = getItemById(model, targetItemId)[itemAttribute];

  for (const sourceSlotId of sourceSlotIds) {
    for (const targetSlotId of targetSlotIds) {
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
