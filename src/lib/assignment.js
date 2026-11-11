import { createModel } from "./model.js";
import { evaluateModel } from "./scoring.js";
import { getAssignedSlotIds, getItemById } from "./selectors.js";

const MAX_SOFT_CANDIDATE_ATTEMPTS = 25;
const MIN_SOFT_IMPROVEMENT = 0.05;

export function createCompatibleAssignments(model) {
  const assignments = Object.fromEntries(
    model.slots.map((slot) => [slot.id, []]),
  );
  const hardMatchRules = model.rules.filter(
    (rule) => rule.enforcement === "hard" && rule.keyword === "match",
  );
  const hardLimitRules = model.rules.filter(
    (rule) => rule.enforcement === "hard" && rule.keyword === "limit",
  );
  const slotLimits = Object.fromEntries(
    model.slots.map((slot) => [
      slot.id,
      getSlotLimits(hardLimitRules, slot.id),
    ]),
  );

  const invalidLimitSlots = model.slots.filter(
    (slot) => slotLimits[slot.id].minimum > slotLimits[slot.id].maximum,
  );
  if (invalidLimitSlots.length > 0) {
    throw new Error(
      "Cannot create compatible assignments: minimum slot size exceeds " +
        "maximum for slots: " +
        invalidLimitSlots.map((slot) => slot.id).join(", "),
    );
  }

  const itemOptions = model.items.map((item) => ({
    item,
    compatibleSlots: model.slots.filter((slot) =>
      hardMatchRules.every((rule) => isItemCompatibleWithSlot(item, slot, rule)),
    ),
  }));
  const incompatibleItems = itemOptions.filter(
    ({ compatibleSlots }) => compatibleSlots.length === 0,
  );

  if (incompatibleItems.length > 0) {
    const error = new Error(
      "Could not create compatible assignments for items: " +
        incompatibleItems.map(({ item }) => item.id).join(", "),
    );
    error.incompatibleItemIds = incompatibleItems.map(({ item }) => item.id);
    throw error;
  }

  itemOptions.sort(
    (first, second) =>
      first.compatibleSlots.length - second.compatibleSlots.length,
  );

  const itemOptionsById = new Map(
    itemOptions.map((itemOption) => [itemOption.item.id, itemOption]),
  );

  for (const { item } of itemOptions) {
    const assigned = assignItemToSlot(
      item.id,
      itemOptionsById,
      assignments,
      slotLimits,
    );

    if (!assigned) {
      const error = new Error(
        `Could not create compatible assignments within slot limits for item: ${item.id}`,
      );
      error.incompatibleItemIds = [item.id];
      throw error;
    }

  }

  const underfilledSlotIds = model.slots
    .filter(
      (slot) =>
        assignments[slot.id].length < slotLimits[slot.id].minimum,
    )
    .map((slot) => slot.id);

  if (underfilledSlotIds.length > 0) {
    const error = new Error(
      "Could not satisfy minimum slot limits for slots: " +
        underfilledSlotIds.join(", "),
    );
    error.underfilledSlotIds = underfilledSlotIds;
    throw error;
  }

  return assignments;
}

function assignItemToSlot(
  itemId,
  itemOptionsById,
  assignments,
  slotLimits,
  visitedItems = new Set(),
  visitedSlots = new Set(),
) {
  if (visitedItems.has(itemId)) {
    return false;
  }
  visitedItems.add(itemId);

  const compatibleSlots = itemOptionsById.get(itemId).compatibleSlots
    .slice()
    .sort((first, second) =>
      compareSlotCapacity(
        first,
        second,
        assignments,
        slotLimits,
      ),
    );

  for (const slot of compatibleSlots) {
    if (visitedSlots.has(slot.id)) {
      continue;
    }
    visitedSlots.add(slot.id);

    const assignedItemIds = assignments[slot.id];
    if (assignedItemIds.length < slotLimits[slot.id].maximum) {
      assignedItemIds.push(itemId);
      return true;
    }

    for (const displacedItemId of [...assignedItemIds]) {
      const displacedIndex = assignedItemIds.indexOf(displacedItemId);
      assignedItemIds.splice(displacedIndex, 1);

      const displacedItemAssigned = assignItemToSlot(
        displacedItemId,
        itemOptionsById,
        assignments,
        slotLimits,
        visitedItems,
        visitedSlots,
      );

      if (displacedItemAssigned) {
        assignedItemIds.push(itemId);
        return true;
      }

      assignedItemIds.splice(displacedIndex, 0, displacedItemId);
    }
  }

  return false;
}

function compareSlotCapacity(
  firstSlot,
  secondSlot,
  assignments,
  slotLimits,
) {
  const firstCount = assignments[firstSlot.id].length;
  const secondCount = assignments[secondSlot.id].length;
  const firstBelowMinimum =
    firstCount < slotLimits[firstSlot.id].minimum;
  const secondBelowMinimum =
    secondCount < slotLimits[secondSlot.id].minimum;

  if (firstBelowMinimum !== secondBelowMinimum) {
    return firstBelowMinimum ? -1 : 1;
  }

  return firstCount - secondCount;
}

function getSlotLimits(limitRules, slotId) {
  return limitRules.reduce(
    (limits, rule) => {
      const [limitType, limit, targetSlotTargets] = rule.inputs;
      const appliesToSlot =
        targetSlotTargets === "all" ||
        targetSlotTargets.some(
          (targetSlotId) => String(targetSlotId) === String(slotId),
        );

      if (!appliesToSlot) {
        return limits;
      }

      if (limitType === "min") {
        limits.minimum = Math.max(limits.minimum, limit);
      } else {
        limits.maximum = Math.min(limits.maximum, limit);
      }

      return limits;
    },
    {
      minimum: 0,
      maximum: Number.POSITIVE_INFINITY,
    },
  );
}

export function improveHardAssignments(model, maxIterations = 100) {
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new Error("Max iterations must be a positive integer");
  }

  let assignments = cloneAssignments(model.assignments.slotAssignments);
  let lastEvaluation;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const currentModel = createModel(
      model.items,
      model.slots,
      model.rules,
      assignments,
    );
    const currentEvaluation = evaluateModel(currentModel, true);
    lastEvaluation = currentEvaluation;

    if (currentEvaluation.hardPenalty === 0) {
      return assignments;
    }

    const candidate = generateCandidate(
      currentModel,
      currentEvaluation.hardViolations,
      currentEvaluation,
      isBetterHardCandidate,
      Number.POSITIVE_INFINITY,
    );

    if (candidate) {
      assignments = candidate;
    } else {
      break;
    }
  }

  const violationCounts = countViolationsByRule(lastEvaluation);
  const error = new Error(
    `Could not create legal assignments after ${maxIterations} iterations. ` +
      `Hard penalty: ${lastEvaluation.hardPenalty}. ` +
      `Remaining violations: ${violationCounts}`,
  );
  error.hardPenalty = lastEvaluation.hardPenalty;
  error.hardViolations = lastEvaluation.hardViolations;
  throw error;
}

export function improveSoftAssignments(
  model,
  maxIterations = 100,
  onProgress,
) {
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new Error("Max iterations must be a positive integer");
  }

  let assignments = cloneAssignments(model.assignments.slotAssignments);
  let currentModel = createModel(
    model.items,
    model.slots,
    model.rules,
    assignments,
  );
  let currentEvaluation = evaluateModel(currentModel);

  if (currentEvaluation.hardPenalty > 0) {
    const error = new Error(
      "Cannot improve soft assignments while hard rules are violated",
    );
    error.hardPenalty = currentEvaluation.hardPenalty;
    error.hardViolations = currentEvaluation.hardViolations;
    throw error;
  }

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const candidate = generateCandidate(
      currentModel,
      currentEvaluation.softViolations,
      currentEvaluation,
      isBetterSoftCandidate,
      MAX_SOFT_CANDIDATE_ATTEMPTS,
    );

    if (!candidate) {
      onProgress?.({
        iteration: iteration + 1,
        softPenalty: currentEvaluation.softPenalty,
        improvement: 0,
        improved: false,
        complete: true,
        softRulePenalties: currentEvaluation.softRulePenalties,
      });
      break;
    }

    const previousSoftPenalty = currentEvaluation.softPenalty;
    assignments = candidate;
    currentModel = createModel(
      model.items,
      model.slots,
      model.rules,
      assignments,
    );
    currentEvaluation = evaluateModel(currentModel);
    onProgress?.({
      iteration: iteration + 1,
      softPenalty: currentEvaluation.softPenalty,
      improvement: previousSoftPenalty - currentEvaluation.softPenalty,
      improved: true,
      complete: false,
      softRulePenalties: currentEvaluation.softRulePenalties,
    });
  }

  return assignments;
}

function countViolationsByRule(evaluation) {
  const counts = {};

  for (const violation of evaluation.hardViolations) {
    counts[violation.ruleId] = (counts[violation.ruleId] ?? 0) + 1;
  }

  return Object.entries(counts)
    .map(([ruleId, count]) => `${ruleId} (${count})`)
    .join(", ");
}

function isItemCompatibleWithSlot(item, slot, rule) {
  const itemValue = item[rule.inputs[0]];

  // Empty item fields are optional for match rules and do not restrict
  // the item's compatible slots.
  if (isEmptyValue(itemValue)) {
    return true;
  }

  return valuesMatch(itemValue, slot[rule.inputs[1]]);
}

function canSwapWithoutBreakingHardMatches(
  model,
  firstItemId,
  firstSlotId,
  secondItemId,
  secondSlotId,
) {
  const firstItem = getItemById(model, firstItemId);
  const secondItem = getItemById(model, secondItemId);
  const firstSlot = model.slots.find((slot) => slot.id === firstSlotId);
  const secondSlot = model.slots.find((slot) => slot.id === secondSlotId);
  const hardMatchRules = model.rules.filter(
    (rule) => rule.enforcement === "hard" && rule.keyword === "match",
  );

  return hardMatchRules.every(
    (rule) =>
      isItemCompatibleWithSlot(firstItem, secondSlot, rule) &&
      isItemCompatibleWithSlot(secondItem, firstSlot, rule),
  );
}

function isEmptyValue(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function generateCandidate(
  model,
  violations,
  evaluation,
  isBetterCandidate,
  maximumAttempts,
) {
  const prioritizedViolations = prioritizeViolations(
    violations,
    evaluation.softRulePenalties,
  );

  for (const violation of prioritizedViolations) {
    let attempts = 0;
    const limitedCandidateEvaluator = (candidateModel, candidate, score) => {
      if (attempts >= maximumAttempts) {
        return false;
      }
      attempts++;
      return isBetterCandidate(candidateModel, candidate, score);
    };
    const candidate = generateCandidateForViolation(
      model,
      violation,
      evaluation,
      limitedCandidateEvaluator,
    );

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function prioritizeViolations(violations, softRulePenalties = []) {
  if (softRulePenalties.length === 0) {
    return violations;
  }

  const weightedPenaltyByRuleId = new Map(
    softRulePenalties.map((rulePenalty) => [
      rulePenalty.ruleId,
      rulePenalty.weightedPenalty,
    ]),
  );

  return [...violations].sort(
    (first, second) =>
      (weightedPenaltyByRuleId.get(second.ruleId) ?? 0) -
      (weightedPenaltyByRuleId.get(first.ruleId) ?? 0),
  );
}

function generateCandidateForViolation(
  model,
  violation,
  evaluation,
  isBetterCandidate,
) {
  const rule = getRuleById(model, violation.ruleId);

  if (rule?.keyword === "match") {
    return generateMatchCandidate(
      model,
      rule,
      violation,
      evaluation,
      isBetterCandidate,
    );
  }
  if (rule?.keyword === "group") {
    return generateGroupCandidate(
      model,
      rule,
      violation,
      evaluation,
      isBetterCandidate,
    );
  }
  if (rule?.keyword === "balance") {
    return generateBalanceCandidate(
      model,
      rule,
      violation,
      evaluation,
      isBetterCandidate,
    );
  }
  if (rule?.keyword === "distribute") {
    return generateDistributeCandidate(
      model,
      violation,
      evaluation,
      isBetterCandidate,
    );
  }
  if (rule?.keyword === "align") {
    return generateAlignCandidate(
      model,
      violation,
      evaluation,
      isBetterCandidate,
    );
  }

  return null;
}

function generateMatchCandidate(
  model,
  rule,
  violation,
  evaluation,
  isBetterCandidate,
) {
  const itemAttribute = rule.inputs[0];
  const slotAttribute = rule.inputs[1];
  const item = getItemById(model, violation.sourceId);
  const itemAttributeValue = item[itemAttribute];
  const assignments = model.assignments.slotAssignments;

  const targetSlots = model.slots.filter((slot) =>
    valuesMatch(itemAttributeValue, slot[slotAttribute]),
  );

  for (const targetSlot of targetSlots) {
    if (targetSlot.id === violation.targetId) {
      continue;
    }

    const targetItemIds = assignments[targetSlot.id] ?? [];
    for (const targetItemId of targetItemIds) {
      if (
        !canSwapWithoutBreakingHardMatches(
          model,
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
      if (isBetterCandidate(model, candidate, evaluation)) {
        return candidate;
      }
    }
  }

  return null;
}

function generateGroupCandidate(
  model,
  rule,
  violation,
  evaluation,
  isBetterCandidate,
) {
  const [itemAttribute] = rule.inputs;
  const sourceItemId = violation.sourceId;
  const requestedValue = violation.targetId;
  const assignments = model.assignments.slotAssignments;
  const sourceSlotIds = getAssignedSlotIds(model, sourceItemId);
  const targetItems = model.items.filter(
    (item) =>
      item.id !== sourceItemId &&
      valuesMatch(requestedValue, item[itemAttribute]),
  );

  for (const targetItem of targetItems) {
    for (const sourceSlotId of sourceSlotIds) {
      for (const targetSlotId of getAssignedSlotIds(model, targetItem.id)) {
        if (targetSlotId === sourceSlotId) {
          continue;
        }
        if (
          !canSwapWithoutBreakingHardMatches(
            model,
            sourceItemId,
            sourceSlotId,
            targetItem.id,
            targetSlotId,
          )
        ) {
          continue;
        }
        const candidate = swapAssignments(
          assignments,
          sourceSlotId,
          sourceItemId,
          targetSlotId,
          targetItem.id,
        );
        if (isBetterCandidate(model, candidate, evaluation)) {
          return candidate;
        }
      }
    }
  }

  return null;
}

function generateBalanceCandidate(
  model,
  rule,
  violation,
  evaluation,
  isBetterCandidate,
) {
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
            model,
            sourceItem.id,
            slotId,
            targetItem.id,
            targetSlot.id,
          )
        ) {
          continue;
        }
        const candidate = swapAssignments(
          assignments,
          slotId,
          sourceItem.id,
          targetSlot.id,
          targetItem.id,
        );
        if (isBetterCandidate(model, candidate, evaluation)) {
          return candidate;
        }
      }
    }
  }

  return null;
}

function generateDistributeCandidate(
  model,
  violation,
  evaluation,
  isBetterCandidate,
) {
  const sourceItemId = violation.sourceId;
  const targetItemId = violation.targetId;
  const sourceSlotIds = getAssignedSlotIds(model, sourceItemId);
  const targetSlotIds = getAssignedSlotIds(model, targetItemId);
  const assignments = model.assignments.slotAssignments;

  for (const sourceSlotId of sourceSlotIds) {
    for (const targetSlotId of targetSlotIds) {
      if (sourceSlotId === targetSlotId) {
        continue;
      }
      if (
        !canSwapWithoutBreakingHardMatches(
          model,
          sourceItemId,
          sourceSlotId,
          targetItemId,
          targetSlotId,
        )
      ) {
        continue;
      }

      const candidate = swapAssignments(
        assignments,
        sourceSlotId,
        sourceItemId,
        targetSlotId,
        targetItemId,
      );
      if (isBetterCandidate(model, candidate, evaluation)) {
        return candidate;
      }
    }
  }

  for (const sharedSlotId of violation.sharedSlotIds ?? []) {
    for (const targetSlot of model.slots) {
      if (targetSlot.id === sharedSlotId) {
        continue;
      }

      for (const targetItemIdInSlot of assignments[targetSlot.id] ?? []) {
        if (
          !canSwapWithoutBreakingHardMatches(
            model,
            sourceItemId,
            sharedSlotId,
            targetItemIdInSlot,
            targetSlot.id,
          )
        ) {
          continue;
        }
        const candidate = swapAssignments(
          assignments,
          sharedSlotId,
          sourceItemId,
          targetSlot.id,
          targetItemIdInSlot,
        );
        if (isBetterCandidate(model, candidate, evaluation)) {
          return candidate;
        }
      }
    }
  }

  return null;
}

function generateAlignCandidate(
  model,
  violation,
  evaluation,
  isBetterCandidate,
) {
  const firstSlotId = violation.sourceId;
  const secondSlotId = violation.targetId;
  if (firstSlotId === secondSlotId) {
    return null;
  }

  const assignments = model.assignments.slotAssignments;
  for (const firstItemId of assignments[firstSlotId] ?? []) {
    for (const secondItemId of assignments[secondSlotId] ?? []) {
      if (
        !canSwapWithoutBreakingHardMatches(
          model,
          firstItemId,
          firstSlotId,
          secondItemId,
          secondSlotId,
        )
      ) {
        continue;
      }
      const candidate = swapAssignments(
        assignments,
        firstSlotId,
        firstItemId,
        secondSlotId,
        secondItemId,
      );
      if (isBetterCandidate(model, candidate, evaluation)) {
        return candidate;
      }
    }
  }

  return null;
}

function getItemsInSlot(model, slotId) {
  const itemIds = model.assignments.slotAssignments[slotId] ?? [];
  return itemIds
    .map((itemId) => getItemById(model, itemId))
    .filter(Boolean);
}

function getNumericSlotAverage(model, slotId, itemAttribute) {
  const numericValues = getItemsInSlot(model, slotId)
    .map((item) => item[itemAttribute])
    .filter(isNumericValue);

  if (numericValues.length === 0) {
    return 0;
  }

  return (
    numericValues.reduce((total, value) => total + value, 0) /
    numericValues.length
  );
}

function isNumericValue(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isBetterSoftCandidate(model, assignments, currentEvaluation) {
  const candidateModel = createModel(
    model.items,
    model.slots,
    model.rules,
    assignments,
  );
  const candidateEvaluation = evaluateModel(candidateModel);

  return (
    candidateEvaluation.hardPenalty === 0 &&
    currentEvaluation.softPenalty - candidateEvaluation.softPenalty >=
      MIN_SOFT_IMPROVEMENT
  );
}

function isBetterHardCandidate(model, assignments, currentEvaluation) {
  const candidateModel = createModel(
    model.items,
    model.slots,
    model.rules,
    assignments,
  );
  const candidateEvaluation = evaluateModel(candidateModel, true);

  return isBetterScore(candidateEvaluation, currentEvaluation);
}

function getRuleById(model, id) {
  return model.rules.find((rule) => rule.id === id);
}

function isBetterScore(candidateScore, currentScore) {
  if (
    candidateScore.hardPenalty !== currentScore.hardPenalty
  ) {
    return (
      candidateScore.hardPenalty < currentScore.hardPenalty
    );
  }

  return false;
}

function valuesMatch(sourceValue, targetValue) {
  if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
    return sourceValue.some((value) => targetValue.includes(value));
  }

  if (Array.isArray(sourceValue)) {
    return sourceValue.includes(targetValue);
  }

  if (Array.isArray(targetValue)) {
    return targetValue.includes(sourceValue);
  }

  return sourceValue === targetValue;
}

export function swapAssignments(
  assignments,
  firstSlotId,
  firstItemId,
  secondSlotId,
  secondItemId,
) {
  if (firstSlotId === secondSlotId || firstItemId === secondItemId) {
    throw new Error("Swap requires two different assignments");
  }

  if (
    !(assignments[firstSlotId] ?? []).includes(firstItemId) ||
    !(assignments[secondSlotId] ?? []).includes(secondItemId)
  ) {
    throw new Error("Cannot swap an unassigned item");
  }

  const nextAssignments = cloneAssignments(assignments);
  nextAssignments[firstSlotId] = nextAssignments[firstSlotId].map((itemId) =>
    itemId === firstItemId ? secondItemId : itemId,
  );
  nextAssignments[secondSlotId] = nextAssignments[secondSlotId].map((itemId) =>
    itemId === secondItemId ? firstItemId : itemId,
  );

  return nextAssignments;
}

function cloneAssignments(assignments) {
  return Object.fromEntries(
    Object.entries(assignments).map(([slotId, itemIds]) => [
      slotId,
      [...itemIds],
    ]),
  );
}
