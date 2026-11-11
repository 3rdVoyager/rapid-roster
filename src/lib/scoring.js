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
        score: ruleEvaluation.percentage * ruleEvaluation.repetitions,
        repetitions: ruleEvaluation.repetitions,
        penalty: rulePenalty,
        weightedPenalty,
        violationCount: violations.length,
      });
    }
  }

  return evaluation;
}

export function evaluateSwap(model, currentEvaluation, candidateModel, swap) {
  const evaluation = {
    // Candidate generation has already checked hard match compatibility.
    // Swaps also preserve slot counts, so hard limit rules cannot change.
    hardPenalty: 0,
    hardViolations: [],
    softPenalty: 0,
    softViolations: [],
    softRulePenalties: [],
  };
  const currentRulePenalties = new Map(
    currentEvaluation.softRulePenalties.map((rulePenalty) => [
      rulePenalty.ruleId,
      rulePenalty,
    ]),
  );

  for (const rule of model.rules) {
    if (rule.enforcement !== "soft") {
      continue;
    }

    const currentRulePenalty = currentRulePenalties.get(rule.id);
    const nextRulePenalty = isRuleAffectedBySwap(rule, model, swap)
      ? evaluateAffectedRuleSwap(
          rule,
          model,
          candidateModel,
          currentRulePenalty,
          swap,
        )
      : currentRulePenalty;

    evaluation.softPenalty += nextRulePenalty.weightedPenalty;
    evaluation.softRulePenalties.push(nextRulePenalty);
  }

  return evaluation;
}

function evaluateAffectedRuleSwap(
  rule,
  model,
  candidateModel,
  currentRulePenalty,
  swap,
) {
  if (!currentRulePenalty) {
    return evaluateRulePenalty(rule, candidateModel);
  }

  if (rule.keyword === "match") {
    return evaluateMatchSwap(rule, model, currentRulePenalty, swap);
  }
  if (rule.keyword === "balance") {
    return evaluateBalanceSwap(
      rule,
      model,
      candidateModel,
      currentRulePenalty,
      swap,
    );
  }
  if (rule.keyword === "group") {
    return evaluateGroupSwap(
      rule,
      model,
      candidateModel,
      currentRulePenalty,
      swap,
    );
  }
  if (rule.keyword === "distribute") {
    return evaluateDistributeSwap(
      rule,
      model,
      candidateModel,
      currentRulePenalty,
      swap,
    );
  }
  if (rule.keyword === "align") {
    return evaluateAlignSwap(
      rule,
      model,
      candidateModel,
      currentRulePenalty,
      swap,
    );
  }

  return evaluateRulePenalty(rule, candidateModel);
}

function isRuleAffectedBySwap(rule, model, swap) {
  if (rule.keyword === "limit") {
    // Swapping preserves every slot's item count.
    return false;
  }
  if (rule.keyword === "match" || rule.keyword === "balance") {
    return true;
  }
  if (rule.keyword === "group") {
    const requestAttribute = rule.inputs[1];
    return [swap.firstItemId, swap.secondItemId].some((itemId) => {
      const item = model.items.find((candidate) => candidate.id === itemId);
      return normalizeValues(item?.[requestAttribute]).length > 0;
    }) || getSlotItemIds(model, swap.firstSlotId, swap.secondSlotId).some(
      (itemId) => {
        const item = model.items.find((candidate) => candidate.id === itemId);
        return normalizeValues(item?.[requestAttribute]).length > 0;
      },
    );
  }
  if (rule.keyword === "distribute") {
    const itemAttribute = rule.inputs[0];
    return [swap.firstItemId, swap.secondItemId].some((itemId) => {
      const item = model.items.find((candidate) => candidate.id === itemId);
      return isNumericValue(item?.[itemAttribute]);
    });
  }
  if (rule.keyword === "align") {
    const siblingAttribute = rule.inputs[1];
    return model.items.some((item) =>
      [swap.firstItemId, swap.secondItemId].includes(item.id) ||
      [swap.firstItemId, swap.secondItemId].includes(item[siblingAttribute]),
    );
  }

  // Unknown rule keywords must remain correct if they are added later.
  return true;
}

function getSlotItemIds(model, firstSlotId, secondSlotId) {
  return [
    ...(model.assignments.slotAssignments[firstSlotId] ?? []),
    ...(model.assignments.slotAssignments[secondSlotId] ?? []),
  ];
}

function evaluateMatchSwap(rule, model, currentRulePenalty, swap) {
  const [itemAttribute, slotAttribute] = rule.inputs;
  const firstItem = model.items.find((item) => item.id === swap.firstItemId);
  const secondItem = model.items.find((item) => item.id === swap.secondItemId);
  const firstSlot = model.slots.find((slot) => slot.id === swap.firstSlotId);
  const secondSlot = model.slots.find((slot) => slot.id === swap.secondSlotId);
  const oldScore =
    matchValue(firstItem, firstSlot, itemAttribute, slotAttribute) +
    matchValue(secondItem, secondSlot, itemAttribute, slotAttribute);
  const newScore =
    matchValue(secondItem, firstSlot, itemAttribute, slotAttribute) +
    matchValue(firstItem, secondSlot, itemAttribute, slotAttribute);
  const score = currentRulePenalty.score - oldScore + newScore;
  const percentage = currentRulePenalty.repetitions === 0
    ? 1
    : score / currentRulePenalty.repetitions;

  return createRulePenalty(
    rule,
    percentage,
    score,
    currentRulePenalty.repetitions,
  );
}

function evaluateBalanceSwap(
  rule,
  model,
  candidateModel,
  currentRulePenalty,
  swap,
) {
  const itemAttribute = rule.inputs[0];
  const oldFirstScore = getBalanceSlotScore(model, swap.firstSlotId, itemAttribute);
  const oldSecondScore = getBalanceSlotScore(
    model,
    swap.secondSlotId,
    itemAttribute,
  );
  const newFirstScore = getBalanceSlotScore(
    candidateModel,
    swap.firstSlotId,
    itemAttribute,
  );
  const newSecondScore = getBalanceSlotScore(
    candidateModel,
    swap.secondSlotId,
    itemAttribute,
  );
  const score =
    currentRulePenalty.score -
    oldFirstScore -
    oldSecondScore +
    newFirstScore +
    newSecondScore;
  const percentage = currentRulePenalty.repetitions === 0
    ? 1
    : score / currentRulePenalty.repetitions;

  return createRulePenalty(
    rule,
    percentage,
    score,
    currentRulePenalty.repetitions,
  );
}

function evaluateRulePenalty(rule, model) {
  const result = evaluateRule(rule, model);
  return createRulePenalty(
    rule,
    result.percentage,
    result.percentage * result.repetitions,
    result.repetitions,
  );
}

function evaluateGroupSwap(
  rule,
  model,
  candidateModel,
  currentRulePenalty,
  swap,
) {
  const [itemAttribute, requestAttribute] = rule.inputs;
  const affectedItemIds = getAffectedGroupItemIds(
    model,
    candidateModel,
    swap,
    requestAttribute,
  );
  let score = currentRulePenalty.score;

  for (const itemId of affectedItemIds) {
    score -= getGroupItemScore(model, itemId, itemAttribute, requestAttribute);
    score += getGroupItemScore(
      candidateModel,
      itemId,
      itemAttribute,
      requestAttribute,
    );
  }

  return createRulePenalty(
    rule,
    currentRulePenalty.repetitions === 0
      ? 1
      : score / currentRulePenalty.repetitions,
    score,
    currentRulePenalty.repetitions,
  );
}

function getAffectedGroupItemIds(
  model,
  candidateModel,
  swap,
  requestAttribute,
) {
  const itemIds = new Set([
    swap.firstItemId,
    swap.secondItemId,
  ]);
  for (const currentModel of [model, candidateModel]) {
    for (const slotId of [swap.firstSlotId, swap.secondSlotId]) {
      for (const itemId of currentModel.assignments.slotAssignments[slotId] ?? []) {
        itemIds.add(itemId);
      }
    }
  }

  // An item's requested values determine whether it contributes repetitions.
  // Including all items in the affected slots is sufficient because only their
  // co-assigned item set can change during a swap.
  return [...itemIds].filter((itemId) => {
    const item = model.items.find((candidate) => candidate.id === itemId);
    return normalizeValues(item?.[requestAttribute]).length > 0;
  });
}

function getGroupItemScore(model, itemId, itemAttribute, requestAttribute) {
  const item = model.items.find((candidate) => candidate.id === itemId);
  const requestedValues = normalizeValues(item?.[requestAttribute]);
  if (!item || requestedValues.length === 0) {
    return 0;
  }

  const assignedSlotIds = model.assignments.itemAssignments[itemId] ?? [];
  const coAssignedItemIds = new Set();
  for (const slotId of assignedSlotIds) {
    for (const coAssignedItemId of model.assignments.slotAssignments[slotId] ?? []) {
      if (coAssignedItemId !== itemId) {
        coAssignedItemIds.add(coAssignedItemId);
      }
    }
  }
  const coAssignedItems = [...coAssignedItemIds]
    .map((coAssignedItemId) =>
      model.items.find((candidate) => candidate.id === coAssignedItemId),
    )
    .filter(Boolean);

  return requestedValues.reduce(
    (score, requestedValue) =>
      score +
      (coAssignedItems.some((coAssignedItem) =>
        valuesMatch(requestedValue, coAssignedItem[itemAttribute]),
      )
        ? 1
        : 0),
    0,
  );
}

function evaluateDistributeSwap(
  rule,
  model,
  candidateModel,
  currentRulePenalty,
  swap,
) {
  const rankedItemIds = getRankedItemIds(model, rule.inputs[0]);
  const candidateRankedItemIds = getRankedItemIds(
    candidateModel,
    rule.inputs[0],
  );
  const affectedPairIndexes = getAffectedPairIndexes(
    rankedItemIds,
    candidateRankedItemIds,
    swap,
  );
  let score = currentRulePenalty.score;

  for (const pairIndex of affectedPairIndexes) {
    score -= getDistributePairScore(model, rankedItemIds, pairIndex);
    score += getDistributePairScore(
      candidateModel,
      candidateRankedItemIds,
      pairIndex,
    );
  }

  return createRulePenalty(
    rule,
    currentRulePenalty.repetitions === 0
      ? 1
      : score / currentRulePenalty.repetitions,
    score,
    currentRulePenalty.repetitions,
  );
}

function getRankedItemIds(model, itemAttribute) {
  return model.items
    .filter((item) => isNumericValue(item[itemAttribute]))
    .map((item) => ({
      id: item.id,
      value: item[itemAttribute],
      slotIds: model.assignments.itemAssignments[item.id] ?? [],
    }))
    .filter((item) => item.slotIds.length > 0)
    .sort((first, second) => second.value - first.value);
}

function getAffectedPairIndexes(firstRankedItems, secondRankedItems, swap) {
  const affectedItemIds = new Set([swap.firstItemId, swap.secondItemId]);
  const pairIndexes = new Set();
  for (const rankedItems of [firstRankedItems, secondRankedItems]) {
    for (let index = 0; index < rankedItems.length; index++) {
      if (affectedItemIds.has(rankedItems[index].id)) {
        if (index > 0) {
          pairIndexes.add(index - 1);
        }
        if (index < rankedItems.length - 1) {
          pairIndexes.add(index);
        }
      }
    }
  }
  return [...pairIndexes];
}

function getDistributePairScore(model, rankedItems, pairIndex) {
  const firstItem = rankedItems[pairIndex];
  const secondItem = rankedItems[pairIndex + 1];
  if (!firstItem || !secondItem) {
    return 0;
  }

  return firstItem.slotIds.some((slotId) =>
    secondItem.slotIds.includes(slotId),
  )
    ? 0
    : 1;
}

function evaluateAlignSwap(
  rule,
  model,
  candidateModel,
  currentRulePenalty,
  swap,
) {
  const affectedItemIds = getAffectedAlignItemIds(model, rule, swap);
  let score = currentRulePenalty.score;
  let repetitions = currentRulePenalty.repetitions;

  for (const itemId of affectedItemIds) {
    const currentStats = getAlignItemStats(model, rule, itemId);
    const candidateStats = getAlignItemStats(candidateModel, rule, itemId);
    score += candidateStats.score - currentStats.score;
    repetitions += candidateStats.repetitions - currentStats.repetitions;
  }

  return createRulePenalty(
    rule,
    repetitions === 0 ? 1 : score / repetitions,
    score,
    repetitions,
  );
}

function getAffectedAlignItemIds(model, rule, swap) {
  const affectedItemIds = new Set([swap.firstItemId, swap.secondItemId]);
  const siblingAttribute = rule.inputs[1];
  for (const item of model.items) {
    if (
      item[siblingAttribute] === swap.firstItemId ||
      item[siblingAttribute] === swap.secondItemId
    ) {
      affectedItemIds.add(item.id);
    }
  }
  return affectedItemIds;
}

function getAlignItemStats(model, rule, itemId) {
  const [slotAttribute, siblingAttribute] = rule.inputs;
  const item = model.items.find((candidate) => candidate.id === itemId);
  const siblingId = item?.[siblingAttribute];
  const sibling = model.items.find((candidate) => candidate.id === siblingId);
  if (!item || !sibling) {
    return { score: 0, repetitions: 0 };
  }

  const itemSlotIds = model.assignments.itemAssignments[itemId] ?? [];
  const siblingSlotIds = model.assignments.itemAssignments[siblingId] ?? [];
  let score = 0;
  let repetitions = 0;
  for (const itemSlotId of itemSlotIds) {
    const itemSlot = model.slots.find((slot) => slot.id === itemSlotId);
    for (const siblingSlotId of siblingSlotIds) {
      const siblingSlot = model.slots.find(
        (slot) => slot.id === siblingSlotId,
      );
      repetitions++;
      if (valuesMatch(itemSlot?.[slotAttribute], siblingSlot?.[slotAttribute])) {
        score++;
      }
    }
  }
  return { score, repetitions };
}

function normalizeValues(value) {
  if (Array.isArray(value)) {
    return value.filter((entry) => entry !== undefined && entry !== null && entry !== "");
  }
  return value === undefined || value === null || value === "" ? [] : [value];
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

function isNumericValue(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function createRulePenalty(rule, percentage, score, repetitions) {
  const priority = rule.priority ?? 1;
  const penalty = 1 - percentage;

  return {
    ruleId: rule.id,
    name: rule.name,
    priority,
    percentage,
    score,
    repetitions,
    penalty,
    weightedPenalty: penalty * priority,
    violationCount: 0,
  };
}

function matchValue(item, slot, itemAttribute, slotAttribute) {
  if (!item || !slot) {
    return 0;
  }

  const itemValue = item[itemAttribute];
  if (
    itemValue === undefined ||
    itemValue === null ||
    itemValue === "" ||
    (Array.isArray(itemValue) && itemValue.length === 0)
  ) {
    return 0;
  }

  const slotValue = slot[slotAttribute];
  if (Array.isArray(itemValue) && Array.isArray(slotValue)) {
    return itemValue.some((value) => slotValue.includes(value)) ? 1 : 0;
  }
  if (Array.isArray(itemValue)) {
    return itemValue.includes(slotValue) ? 1 : 0;
  }
  if (Array.isArray(slotValue)) {
    return slotValue.includes(itemValue) ? 1 : 0;
  }
  return itemValue === slotValue ? 1 : 0;
}

function getBalanceSlotScore(model, slotId, itemAttribute) {
  const numericValues = (model.assignments.slotAssignments[slotId] ?? [])
    .map((itemId) => model.items.find((item) => item.id === itemId))
    .map((item) => item?.[itemAttribute])
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  const allValues = model.items
    .map((item) => item[itemAttribute])
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  if (allValues.length === 0) {
    return 1;
  }

  const overallAverage =
    allValues.reduce((total, value) => total + value, 0) / allValues.length;
  const slotAverage =
    numericValues.length === 0
      ? 0
      : numericValues.reduce((total, value) => total + value, 0) /
        numericValues.length;
  return Math.max(0, 1 - Math.abs(slotAverage - overallAverage) / 100);
}

export const scoreModel = evaluateModel;
