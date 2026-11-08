import {
  getAssignedItems,
  getAssignedItemIds,
  getAssignedSlots,
  getAssignedSlotIds,
  getCoAssignedItems,
} from "./selectors.js";

const evaluators = {
  match: evaluateMatch,
  group: evaluateGroup,
  equalize: evaluateEqualize,
  limit: evaluateLimit,
  balance: evaluateBalance,
  distribute: evaluateDistribute,
  align: evaluateAlign,
};

export function evaluateRule(rule, model) {
  const evaluator = evaluators[rule.keyword];
  const result = evaluator(rule.inputs, model);
  const priority = rule.priority ?? 1;

  return {
    score: (result.score / result.repetitions) * priority,
    percentage: result.score / result.repetitions,
    repetitions: result.repetitions,
    violations: result.violations,
  };
}

export function evaluateMatch(inputs, model) {
  const [itemAttribute, slotAttribute] = inputs;
  let score = 0;
  let repetitions = 0;
  const violations = [];

  for (const item of model.items) {
    const assignedSlots = getAssignedSlots(model, item.id);

    for (const slot of assignedSlots) {
      const itemValue = item[itemAttribute];
      const slotValue = slot[slotAttribute];

      // Empty request fields mean that this comparison does not apply to
      // the item. They should not become false violations.
      if (isEmptyMatchValue(itemValue)) {
        continue;
      }

      let matches;

      // TODO: Score each item-array value separately instead of
      // reducing the whole array comparison to one boolean result.
      if (Array.isArray(itemValue) && Array.isArray(slotValue)) {
        matches = itemValue.some((value) => slotValue.includes(value));
      } else if (Array.isArray(itemValue)) {
        matches = itemValue.includes(slotValue);
      } else if (Array.isArray(slotValue)) {
        matches = slotValue.includes(itemValue);
      } else {
        matches = itemValue === slotValue;
      }

      if (matches) {
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

export function evaluateGroup(inputs, model) {
  const [itemAttribute1, itemAttribute2] = inputs;
  let satisfaction = 0;
  let repetitions = 0;
  const violations = [];

  for (const item of model.items) {
    const requestedValues = normalizeValues(item[itemAttribute2]);

    if (requestedValues.length === 0) {
      continue;
    }

    const coAssignedItems = getCoAssignedItems(model, item.id);

    for (const requestedValue of requestedValues) {
      const matches = coAssignedItems.some((coAssignedItem) =>
        valuesMatch(requestedValue, coAssignedItem[itemAttribute1]),
      );

      if (matches) {
        satisfaction++;
      } else {
        violations.push({
          sourceId: item.id,
          targetId: requestedValue,
          sourceValue: requestedValues,
          targetValue: coAssignedItems.map(
            (coAssignedItem) => coAssignedItem[itemAttribute1],
          ),
        });
      }

      repetitions++;
    }
  }

  return {
    score: satisfaction,
    repetitions,
    violations,
  };
}

function isEmptyMatchValue(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function normalizeValues(value) {
  if (isEmptyMatchValue(value)) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  return values.filter((entry) => !isEmptyMatchValue(entry));
}

export function evaluateEqualize(inputs, model) {
  const maximumDifference = inputs[0];
  const records = model.slots;

  if (
    typeof maximumDifference !== "number" ||
    !Number.isInteger(maximumDifference) ||
    maximumDifference < 0
  ) {
    throw new Error(
      "Equalize target must be a non-negative integer",
    );
  }

  const counts = records.map((record) => ({
    record,
    count: getAssignedItemIds(model, record.id).length,
  }));

  if (counts.length === 0) {
    return { score: 1, repetitions: 1, violations: [] };
  }

  const minimumCount = Math.min(...counts.map((entry) => entry.count));
  const maximumCount = Math.max(...counts.map((entry) => entry.count));
  const actualDifference = maximumCount - minimumCount;
  let score = 0;
  const violations = [];

  for (const entry of counts) {
    const excess = Math.max(
      0,
      entry.count - minimumCount - maximumDifference,
    );
    const recordScore = excess === 0 ? 1 : 1 / (1 + excess);
    score += recordScore;

    if (excess > 0) {
      violations.push({
        sourceId: entry.record.id,
        actual: entry.count,
        minimum: minimumCount,
        maximum: maximumCount,
        difference: actualDifference,
        maximumDifference,
        excess,
      });
    }
  }

  return {
    score,
    repetitions: counts.length,
    violations,
  };
}

export function evaluateLimit(inputs, model) {
  const sourceCollection = inputs.source;
  const limit = inputs.target;

  if (!["items", "slots"].includes(sourceCollection)) {
    throw new Error(`Unsupported limit collection: ${sourceCollection}`);
  }

  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 0
  ) {
    throw new Error("Limit target must be a non-negative integer");
  }

  let score = 0;
  let repetitions = 0;
  const violations = [];

  for (const record of model[sourceCollection]) {
    const assignmentCount =
      sourceCollection === "items"
        ? getAssignedSlotIds(model, record.id).length
        : getAssignedItemIds(model, record.id).length;

    const recordScore =
      assignmentCount <= limit ? 1 : limit / assignmentCount;

    score += recordScore;
    repetitions++;
    if (recordScore < 1) {
      violations.push({
        sourceId: record.id,
        actual: assignmentCount,
        limit,
        excess: assignmentCount - limit,
      });
    }
  }

  return { score, repetitions, violations };
}

export function evaluateBalance(inputs, model) {
  const sourceCollection = inputs.source.collection;
  const targetCollection =
    typeof inputs.target === "string"
      ? inputs.target
      : inputs.target.collection;

  if (
    !["items", "slots"].includes(sourceCollection) ||
    !["items", "slots"].includes(targetCollection) ||
    sourceCollection === targetCollection
  ) {
    throw new Error(
      `Unsupported balance collections: ${sourceCollection} -> ${targetCollection}`,
    );
  }

  const values = model[sourceCollection]
    .map((record) => record[inputs.source.attribute])
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  if (values.length === 0) {
    return { score: 1, repetitions: 1, violations: [] };
  }

  let overallSum = 0;
  for (const value of values) {
    overallSum += value;
  }
  const overallAverage = overallSum / values.length;
  let score = 0;
  let repetitions = 0;
  const violations = [];

  for (const target of model[targetCollection]) {
    let assignedSourceRecords;
    if (sourceCollection === "items" && targetCollection === "slots") {
      assignedSourceRecords = getAssignedItems(model, target.id);
    } else {
      assignedSourceRecords = getAssignedSlots(model, target.id);
    }

    let groupAverage = 0;
    if (assignedSourceRecords.length > 0) {
      let groupSum = 0;
      let validValueCount = 0;
      for (const record of assignedSourceRecords) {
        const value = record[inputs.source.attribute];
        if (typeof value !== "number" || !Number.isFinite(value)) {
          continue;
        }
        groupSum += value;
        validValueCount++;
      }
      if (validValueCount > 0) {
        groupAverage = groupSum / validValueCount;
      }
    }

    const difference = Math.abs(groupAverage - overallAverage);
    const groupScore = Math.max(0, 1 - difference / 100);
    score += groupScore;
    repetitions++;
    if (groupScore < 1) {
      violations.push({
        targetId: target.id,
        actual: groupAverage,
        target: overallAverage,
        difference,
      });
    }
  }

  return { score, repetitions, violations };
}
export function evaluateDistribute(inputs, model) {
  const sourceCollection = inputs.source.collection;
  const targetCollection =
    typeof inputs.target === "string"
      ? inputs.target
      : inputs.target.collection;

  if (sourceCollection !== "items" || targetCollection !== "slots") {
    throw new Error(
      `Unsupported distribute collections: ${sourceCollection} -> ${targetCollection}`,
    );
  }

  const rankedRecords = [];

  for (const record of model[sourceCollection]) {
    const value = record[inputs.source.attribute];

    // Missing numeric values cannot be ranked, so they do not participate.
    if (typeof value !== "number" || !Number.isFinite(value)) {
      continue;
    }

    const relatedIds = getAssignedSlotIds(model, record.id);
    if (relatedIds.length > 0) {
      rankedRecords.push({ record, value, relatedIds });
    }
  }

  rankedRecords.sort((first, second) => second.value - first.value);

  // With fewer than two ranked items there is nothing to distribute.
  if (rankedRecords.length < 2) {
    return { score: 1, repetitions: 1, violations: [] };
  }

  let score = 0;
  const violations = [];

  for (let index = 1; index < rankedRecords.length; index++) {
    const previous = rankedRecords[index - 1];
    const current = rankedRecords[index];
    const sharedRelatedIds = previous.relatedIds.filter((relatedId) =>
      current.relatedIds.includes(relatedId),
    );

    if (sharedRelatedIds.length === 0) {
      score++;
    } else {
      violations.push({
        sourceId: previous.record.id,
        targetId: current.record.id,
        sourceValue: previous.value,
        targetValue: current.value,
        sharedSlotIds: sharedRelatedIds,
      });
    }
  }

  return {
    score,
    repetitions: rankedRecords.length - 1,
    violations,
  };
}

export function evaluateAlign(inputs, model) {
  const sourceCollection = inputs.source.collection;
  const targetCollection = inputs.target.collection;

  if (
    sourceCollection !== "assignedSlots" ||
    targetCollection !== "siblingAssignedSlots"
  ) {
    throw new Error(
      `Unsupported align collections: ${sourceCollection} -> ${targetCollection}`,
    );
  }

  let score = 0;
  let repetitions = 0;
  const violations = [];

  for (const record of model.items) {
    if (isEmptyMatchValue(record.sibling)) {
      continue;
    }

    const relatedRecord = model.items.find(
      (candidate) => candidate.id === record.sibling,
    );

    if (!relatedRecord) {
      continue;
    }

    const sourceRelatedRecords = getAssignedSlots(model, record.id);
    const targetRelatedRecords = getAssignedSlots(model, relatedRecord.id);

    // An unassigned item cannot be compared yet, so this relationship is
    // non-applicable until both sides have an assignment.
    for (const sourceRecord of sourceRelatedRecords) {
      for (const targetRecord of targetRelatedRecords) {
        const sourceValue = sourceRecord[inputs.source.attribute];
        const targetValue = targetRecord[inputs.target.attribute];

        repetitions++;

        if (valuesMatch(sourceValue, targetValue)) {
          score++;
        } else {
          violations.push({
            sourceId: sourceRecord.id,
            targetId: targetRecord.id,
            sourceValue,
            targetValue,
          });
        }
      }
    }
  }

  return { score, repetitions, violations };
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
