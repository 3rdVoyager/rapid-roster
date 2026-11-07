import {
  getAssignedItems,
  getAssignedItemIds,
  getAssignedSlots,
  getAssignedSlotIds,
  getCoAssignedItems,
  getCoAssignedSlots,
} from "./selectors.js";

const evaluators = {
  match: evaluateMatch,
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
  let score = 0;
  let repetitions = 0;
  const violations = [];
  const sourceCollection = inputs.source.collection;
  const targetCollection = inputs.target.collection;

  if (
    !["items", "slots"].includes(sourceCollection) ||
    !["items", "slots"].includes(targetCollection)
  ) {
    throw new Error(
      `Unsupported match collections: ${sourceCollection} -> ${targetCollection}`,
    );
  }

  for (const sourceRecord of model[sourceCollection]) {
    let relatedRecords = [];
    if (sourceCollection === "items") {
      if (targetCollection === "slots") {
        relatedRecords = getAssignedSlots(model, sourceRecord.id);
      } else if (targetCollection === "items") {
        relatedRecords = getCoAssignedItems(model, sourceRecord.id);
      }
    } else if (sourceCollection === "slots") {
      if (targetCollection === "slots") {
        relatedRecords = getCoAssignedSlots(model, sourceRecord.id);
      } else if (targetCollection === "items") {
        relatedRecords = getAssignedItems(model, sourceRecord.id);
      }
    }

    for (const targetRecord of relatedRecords) {
      const sourceValue = sourceRecord[inputs.source.attribute];
      const targetValue = targetRecord[inputs.target.attribute];

      // Empty request fields mean that this comparison does not apply to
      // the source record. They should not become false violations.
      if (isEmptyMatchValue(sourceValue)) {
        continue;
      }

      let matches;

      // TODO: Score each source-array value separately instead of
      // reducing the whole array comparison to one boolean result.
      if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
        matches = sourceValue.some((value) => targetValue.includes(value));
      } else if (Array.isArray(sourceValue)) {
        matches = sourceValue.includes(targetValue);
      } else if (Array.isArray(targetValue)) {
        matches = targetValue.includes(sourceValue);
      } else {
        matches = sourceValue === targetValue;
      }

      if (matches) {
        score++;
      } else {
        violations.push({
          sourceId: sourceRecord.id,
          targetId: targetRecord.id,
          sourceValue,
          targetValue,
        });
      }
      repetitions++;
    }
  }

  return { score, repetitions, violations };
}

function isEmptyMatchValue(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function evaluateEqualize(inputs, model) {}

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

  const values = model[sourceCollection].map(
    (record) => record[inputs.source.attribute],
  );

  if (values.length === 0) {
    throw new Error("Cannot average an empty array");
  }

  let overallSum = 0;
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("Balance requires finite numeric values");
    }
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
      for (const record of assignedSourceRecords) {
        const value = record[inputs.source.attribute];
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw new Error("Balance requires finite numeric values");
        }
        groupSum += value;
      }
      groupAverage = groupSum / assignedSourceRecords.length;
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
export function evaluateDistribute(inputs, model) {}

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

  for (const item of model.items) {
    if (isEmptyMatchValue(item.sibling)) {
      continue;
    }

    const sibling = model.items.find(
      (candidate) => candidate.id === item.sibling,
    );

    if (!sibling) {
      continue;
    }

    const assignedSlots = getAssignedSlots(model, item.id);
    const siblingAssignedSlots = getAssignedSlots(model, sibling.id);

    // An unassigned item cannot be compared yet, so this relationship is
    // non-applicable until both sides have an assignment.
    for (const sourceSlot of assignedSlots) {
      for (const targetSlot of siblingAssignedSlots) {
        const sourceValue = sourceSlot[inputs.source.attribute];
        const targetValue = targetSlot[inputs.target.attribute];

        repetitions++;

        if (valuesMatch(sourceValue, targetValue)) {
          score++;
        } else {
          violations.push({
            sourceId: sourceSlot.id,
            targetId: targetSlot.id,
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
