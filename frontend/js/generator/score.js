/**
 * score.js
 *
 * This file answers one question:
 *   "How good is this assignment for the soft rules?"
 *
 * Only SOFT rules add to the score.
 * Hard rules belong in legal.js (later). They do not add points here.
 *
 * ---------------------------------------------------------------------------
 * Scoring idea (from generator.md)
 * ---------------------------------------------------------------------------
 *
 * Each soft rule contributes:
 *
 *   ruleScore = priority × howWellMet
 *
 * - priority is 1–10 (higher = more important)
 * - howWellMet is a number from 0 (not met) to 1 (fully met)
 * - Partial success still counts (for example 0.6)
 *
 * totalScore = sum of every soft rule's ruleScore
 *
 * Object.keys(...) appears in a few helpers — it returns an array of an
 * object's property names (for example every person id in assignments).
 *
 * ---------------------------------------------------------------------------
 * How to call this file
 * ---------------------------------------------------------------------------
 *
 *   import { scorePlacement } from "./score.js";
 *
 *   const result = scorePlacement(assignments, scoreConfig);
 *
 *   // result.totalScore     → one number (higher is better)
 *   // result.scoresByRule   → list of per-rule breakdowns for the UI later
 *
 * ---------------------------------------------------------------------------
 * What "scoreConfig" looks like (simple on purpose)
 * ---------------------------------------------------------------------------
 *
 * Like legal.js, we use a flat config — not the full project tables yet.
 *
 *   scoreConfig = {
 *     // Attributes for each person (whatever columns the rules need)
 *     entriesAttrs: {
 *       "ava": { skill: 8, role: "player", school: "North", availability: "Mon;Wed" },
 *       "bob": { skill: 5, role: "keeper", school: "North", availability: "Wed" }
 *     },
 *
 *     // Attributes for each slot
 *     slotAttrs: {
 *       "t1": { name: "Team A", practice_night: "Mon" },
 *       "t2": { name: "Team B", practice_night: "Wed" }
 *     },
 *
 *     // Soft (and hard) rules. Hard ones are skipped by the scorer.
 *     rules: [
 *       {
 *         id: "R1",
 *         name: "Balance skill",
 *         type: "balance",
 *         hard: false,
 *         priority: 9,
 *         entryAttribute: "skill"
 *       },
 *       {
 *         id: "R2",
 *         name: "Cluster by school",
 *         type: "cluster",
 *         hard: false,
 *         priority: 8,
 *         shape: "entriesTogether",   // same attribute → prefer same slot
 *         entryAttribute: "school",
 *         match: "exact"             // or "partial" for ; -separated tags
 *       },
 *       {
 *         id: "R3",
 *         type: "cluster",
 *         hard: false,
 *         priority: 7,
 *         shape: "entryMatchesSlot", // person value ↔ slot value
 *         entryAttribute: "availability",
 *         slotAttribute: "practice_night",
 *         match: "partial"
 *       },
 *       {
 *         id: "R4",
 *         type: "limit",
 *         hard: false,
 *         priority: 5,
 *         entryAttribute: "role",
 *         filterValue: "keeper",
 *         maxCount: 2
 *         // optional: minCount: 1
 *       },
 *       {
 *         id: "R5",
 *         type: "separate",
 *         hard: false,
 *         priority: 4,
 *         entryAttribute: "school",
 *         match: "exact"
 *       }
 *     ]
 *   }
 */

import {
  getSlotsForEntry,
  getEntriesInSlot
} from "./placement.js";

/**
 * Main entry point.
 *
 * Scores every soft rule and returns a total plus a per-rule list.
 *
 * @param {Object} assignments - entryId → array of slotIds
 * @param {Object} scoreConfig - see file header
 * @returns {{ totalScore: number, scoresByRule: Object[] }}
 */
export function scorePlacement(assignments, scoreConfig) {
  const scoresByRule = [];
  let totalScore = 0;

  let rules = scoreConfig.rules;

  if (rules === undefined) {
    rules = [];
  }

  for (let i = 0; i < rules.length; i = i + 1) {
    const rule = rules[i];

    // Hard rules are constraints, not points.
    if (rule.hard === true) {
      continue;
    }

    const howWellMet = scoreOneRule(assignments, scoreConfig, rule);
    const priority = getPriority(rule);
    const ruleScore = priority * howWellMet;

    totalScore = totalScore + ruleScore;

    scoresByRule.push({
      id: rule.id,
      type: rule.type,
      priority: priority,
      howWellMet: howWellMet,
      ruleScore: ruleScore
    });
  }

  return {
    totalScore: totalScore,
    scoresByRule: scoresByRule
  };
}

/**
 * Score a single soft rule. Returns howWellMet from 0 to 1.
 *
 * @param {Object} assignments
 * @param {Object} scoreConfig
 * @param {Object} rule
 * @returns {number}
 */
function scoreOneRule(assignments, scoreConfig, rule) {
  const type = rule.type;

  if (type === "balance") {
    return scoreBalance(assignments, scoreConfig, rule);
  }

  if (type === "limit") {
    return scoreLimit(assignments, scoreConfig, rule);
  }

  if (type === "cluster") {
    return scoreCluster(assignments, scoreConfig, rule);
  }

  if (type === "separate") {
    return scoreSeparate(assignments, scoreConfig, rule);
  }

  // Unknown type: treat as fully unmet so it is obvious in tests.
  return 0;
}

/**
 * Read priority safely. Default to 5 (middle of 1–10) if missing.
 *
 * @param {Object} rule
 * @returns {number}
 */
function getPriority(rule) {
  if (rule.priority === undefined) {
    return 5;
  }

  return rule.priority;
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

/**
 * Balance: keep a numeric person attribute roughly even across slots.
 *
 * Example: skill levels should not pile all 9s on one team.
 *
 * How we measure "even":
 * 1. For each non-empty slot, compute the average of that attribute.
 * 2. Look at the highest slot average and the lowest slot average.
 * 3. If they are equal → howWellMet = 1.
 * 4. If they differ a lot compared to the overall value range → closer to 0.
 *
 * @returns {number} 0–1
 */
function scoreBalance(assignments, scoreConfig, rule) {
  const attributeName = rule.entryAttribute;
  const slotIds = getSlotIdsFromConfig(scoreConfig);
  const slotAverages = [];

  // Collect every numeric value we see (to know the overall range).
  const allValues = [];

  for (let i = 0; i < slotIds.length; i = i + 1) {
    const slotId = slotIds[i];
    const entriesInSlot = getEntriesInSlot(assignments, slotId);

    if (entriesInSlot.length === 0) {
      continue;
    }

    let sum = 0;
    let count = 0;

    for (let p = 0; p < entriesInSlot.length; p = p + 1) {
      const entryId = entriesInSlot[p];
      const value = getEntryNumber(scoreConfig, entryId, attributeName);

      if (value === null) {
        continue;
      }

      sum = sum + value;
      count = count + 1;
      allValues.push(value);
    }

    if (count > 0) {
      const average = sum / count;
      slotAverages.push(average);
    }
  }

  // Not enough data to judge balance.
  if (slotAverages.length < 2) {
    return 1;
  }

  if (allValues.length === 0) {
    return 1;
  }

  let highestAvg = slotAverages[0];
  let lowestAvg = slotAverages[0];

  for (let i = 1; i < slotAverages.length; i = i + 1) {
    if (slotAverages[i] > highestAvg) {
      highestAvg = slotAverages[i];
    }

    if (slotAverages[i] < lowestAvg) {
      lowestAvg = slotAverages[i];
    }
  }

  let highestValue = allValues[0];
  let lowestValue = allValues[0];

  for (let i = 1; i < allValues.length; i = i + 1) {
    if (allValues[i] > highestValue) {
      highestValue = allValues[i];
    }

    if (allValues[i] < lowestValue) {
      lowestValue = allValues[i];
    }
  }

  const valueRange = highestValue - lowestValue;

  // Everyone has the same number → already perfectly balanced.
  if (valueRange === 0) {
    return 1;
  }

  const averageGap = highestAvg - lowestAvg;
  let howWellMet = 1 - averageGap / valueRange;

  if (howWellMet < 0) {
    howWellMet = 0;
  }

  if (howWellMet > 1) {
    howWellMet = 1;
  }

  return howWellMet;
}

// ---------------------------------------------------------------------------
// Limit
// ---------------------------------------------------------------------------

/**
 * Limit: each slot should have between minCount and maxCount people
 * whose entryAttribute equals filterValue.
 *
 * Example: max 2 keepers per team; min 1 coach per team.
 *
 * Soft version: each slot gets a 0–1 satisfaction, then we average slots.
 *
 * @returns {number} 0–1
 */
function scoreLimit(assignments, scoreConfig, rule) {
  const attributeName = rule.entryAttribute;
  const filterValue = rule.filterValue;
  const slotIds = getSlotIdsFromConfig(scoreConfig);

  if (slotIds.length === 0) {
    return 1;
  }

  let totalSatisfaction = 0;

  for (let i = 0; i < slotIds.length; i = i + 1) {
    const slotId = slotIds[i];
    const entriesInSlot = getEntriesInSlot(assignments, slotId);
    let matchCount = 0;

    for (let p = 0; p < entriesInSlot.length; p = p + 1) {
      const entryId = entriesInSlot[p];
      const value = getEntryText(scoreConfig, entryId, attributeName);

      if (valuesMatch(value, filterValue, "exact") === true) {
        matchCount = matchCount + 1;
      }
    }

    totalSatisfaction = totalSatisfaction + limitSatisfactionForSlot(matchCount, rule);
  }

  return totalSatisfaction / slotIds.length;
}

/**
 * How satisfied is one slot with a limit rule?
 *
 * @param {number} matchCount
 * @param {Object} rule
 * @returns {number} 0–1
 */
function limitSatisfactionForSlot(matchCount, rule) {
  let minPart = 1;
  let maxPart = 1;

  if (rule.minCount !== undefined) {
    if (matchCount >= rule.minCount) {
      minPart = 1;
    } else if (rule.minCount === 0) {
      minPart = 1;
    } else {
      minPart = matchCount / rule.minCount;
    }
  }

  if (rule.maxCount !== undefined) {
    if (matchCount <= rule.maxCount) {
      maxPart = 1;
    } else if (matchCount === 0) {
      maxPart = 1;
    } else {
      // Over the cap: shrink toward 0 as the overage grows.
      maxPart = rule.maxCount / matchCount;
    }
  }

  // If both min and max exist, both must be happy.
  if (minPart < maxPart) {
    return minPart;
  }

  return maxPart;
}

// ---------------------------------------------------------------------------
// Cluster
// ---------------------------------------------------------------------------

/**
 * Cluster has two shapes (see generator.md):
 *
 * 1. entriesTogether
 *    People who share a entryAttribute prefer the SAME slot.
 *    Example: same school together.
 *
 * 2. entryMatchesSlot
 *    A person's attribute should match a slot attribute.
 *    Example: availability ↔ practice_night, or pref column ↔ slot name.
 *
 * @returns {number} 0–1
 */
function scoreCluster(assignments, scoreConfig, rule) {
  const shape = rule.shape;

  if (shape === "entriesTogether") {
    return scoreEntriesTogether(assignments, scoreConfig, rule, true);
  }

  if (shape === "entryMatchesSlot") {
    return scoreEntryMatchesSlot(assignments, scoreConfig, rule);
  }

  return 0;
}

/**
 * Separate: people who share an attribute prefer DIFFERENT slots.
 * Reuses the "people together" grouping, but scores the opposite way.
 *
 * @returns {number} 0–1
 */
function scoreSeparate(assignments, scoreConfig, rule) {
  return scoreEntriesTogether(assignments, scoreConfig, rule, false);
}

/**
 * Group people by an attribute, then score each group.
 *
 * wantTogether === true  → Cluster: reward groups sitting in one slot
 * wantTogether === false → Separate: reward groups spread across slots
 *
 * @param {boolean} wantTogether
 * @returns {number} 0–1
 */
function scoreEntriesTogether(assignments, scoreConfig, rule, wantTogether) {
  const attributeName = rule.entryAttribute;
  const matchMode = getMatchMode(rule);
  const entryIds = Object.keys(assignments);

  // Build groups: key → list of person ids
  // For exact match, key is the value string.
  // For partial match with tags, we still group by the full cell text
  // in this minimum version (simpler). True tag-overlap grouping can wait.
  const groups = {};

  for (let i = 0; i < entryIds.length; i = i + 1) {
    const entryId = entryIds[i];
    const slots = getSlotsForEntry(assignments, entryId);

    // Unassigned people do not affect this score yet.
    if (slots.length === 0) {
      continue;
    }

    const value = getEntryText(scoreConfig, entryId, attributeName);

    if (value === null || value === "") {
      continue;
    }

    if (groups[value] === undefined) {
      groups[value] = [];
    }

    groups[value].push(entryId);
  }

  const groupKeys = Object.keys(groups);

  if (groupKeys.length === 0) {
    return 1;
  }

  let total = 0;
  let usedGroups = 0;

  for (let g = 0; g < groupKeys.length; g = g + 1) {
    const key = groupKeys[g];
    const members = groups[key];

    // A group of one person cannot be "together" or "apart" with anyone.
    if (members.length < 2) {
      continue;
    }

    usedGroups = usedGroups + 1;

    // Count how many members landed in each slot.
    const countsBySlot = {};

    for (let m = 0; m < members.length; m = m + 1) {
      const entryId = members[m];
      const slots = getSlotsForEntry(assignments, entryId);

      for (let s = 0; s < slots.length; s = s + 1) {
        const slotId = slots[s];

        if (countsBySlot[slotId] === undefined) {
          countsBySlot[slotId] = 0;
        }

        countsBySlot[slotId] = countsBySlot[slotId] + 1;
      }
    }

    const slotKeys = Object.keys(countsBySlot);
    let largestPile = 0;

    for (let s = 0; s < slotKeys.length; s = s + 1) {
      const count = countsBySlot[slotKeys[s]];

      if (count > largestPile) {
        largestPile = count;
      }
    }

    // Cluster: larger pile in one slot is better.
    // Separate: smaller piles / more spread is better.
    let groupScore = 0;

    if (wantTogether === true) {
      groupScore = largestPile / members.length;
    } else {
      // If everyone is in a different slot, distinctSlots === members.length → 1.
      // If everyone is in one slot, distinctSlots === 1 → low score.
      const distinctSlots = slotKeys.length;
      groupScore = distinctSlots / members.length;

      if (groupScore > 1) {
        groupScore = 1;
      }
    }

    // matchMode is reserved for richer grouping later; keep exact path clear.
    if (matchMode === "partial") {
      // Minimum version: same formula for now.
    }

    total = total + groupScore;
  }

  if (usedGroups === 0) {
    return 1;
  }

  return total / usedGroups;
}

/**
 * Person attribute should match the slot attribute for slots they hold.
 *
 * Example:
 *   Ava availability "Mon;Wed", Team A practice_night "Mon" → match (partial)
 *   Pref column "1" = "Optics", and Ava is in slot named Optics → match
 *
 * @returns {number} 0–1
 */
function scoreEntryMatchesSlot(assignments, scoreConfig, rule) {
  const entryAttribute = rule.entryAttribute;
  const slotAttribute = rule.slotAttribute;
  const matchMode = getMatchMode(rule);
  const entryIds = Object.keys(assignments);

  let total = 0;
  let countedEntries = 0;

  for (let i = 0; i < entryIds.length; i = i + 1) {
    const entryId = entryIds[i];
    const slots = getSlotsForEntry(assignments, entryId);

    if (slots.length === 0) {
      continue;
    }

    const entryValue = getEntryText(scoreConfig, entryId, entryAttribute);

    if (entryValue === null || entryValue === "") {
      continue;
    }

    countedEntries = countedEntries + 1;

    let matchingSlots = 0;

    for (let s = 0; s < slots.length; s = s + 1) {
      const slotId = slots[s];
      const slotValue = getSlotText(scoreConfig, slotId, slotAttribute);

      if (slotValue === null) {
        continue;
      }

      if (valuesMatch(entryValue, slotValue, matchMode) === true) {
        matchingSlots = matchingSlots + 1;
      }
    }

    const entryScore = matchingSlots / slots.length;
    total = total + entryScore;
  }

  if (countedEntries === 0) {
    return 1;
  }

  return total / countedEntries;
}

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

/**
 * @param {Object} rule
 * @returns {"exact"|"partial"}
 */
function getMatchMode(rule) {
  if (rule.match === "partial") {
    return "partial";
  }

  return "exact";
}

/**
 * Compare two text values.
 *
 * exact   → must be the same string
 * partial → semicolon-separated tags; any shared tag counts as a match
 *           Also: if either side equals the other as a whole string, match.
 *
 * @param {string} a
 * @param {string} b
 * @param {"exact"|"partial"} mode
 * @returns {boolean}
 */
function valuesMatch(a, b, mode) {
  if (a === b) {
    return true;
  }

  if (mode !== "partial") {
    return false;
  }

  const tagsA = splitTags(a);
  const tagsB = splitTags(b);

  for (let i = 0; i < tagsA.length; i = i + 1) {
    for (let j = 0; j < tagsB.length; j = j + 1) {
      if (tagsA[i] === tagsB[j]) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Turn "Mon;Wed" into ["Mon", "Wed"].
 *
 * @param {string} text
 * @returns {string[]}
 */
function splitTags(text) {
  const parts = text.split(";");
  const tags = [];

  for (let i = 0; i < parts.length; i = i + 1) {
    const trimmed = parts[i].trim();

    if (trimmed !== "") {
      tags.push(trimmed);
    }
  }

  return tags;
}

/**
 * Slot ids from scoreConfig.slotAttrs keys.
 *
 * @param {Object} scoreConfig
 * @returns {string[]}
 */
function getSlotIdsFromConfig(scoreConfig) {
  if (scoreConfig.slotAttrs === undefined) {
    return [];
  }

  return Object.keys(scoreConfig.slotAttrs);
}

/**
 * Read a numeric person attribute. Returns null if missing / not a number.
 *
 * @param {Object} scoreConfig
 * @param {string} entryId
 * @param {string} attributeName
 * @returns {number|null}
 */
function getEntryNumber(scoreConfig, entryId, attributeName) {
  const text = getEntryText(scoreConfig, entryId, attributeName);

  if (text === null) {
    return null;
  }

  const numberValue = Number(text);

  if (Number.isNaN(numberValue) === true) {
    return null;
  }

  return numberValue;
}

/**
 * Read a person attribute as text. Returns null if missing.
 *
 * @param {Object} scoreConfig
 * @param {string} entryId
 * @param {string} attributeName
 * @returns {string|null}
 */
function getEntryText(scoreConfig, entryId, attributeName) {
  if (scoreConfig.entriesAttrs === undefined) {
    return null;
  }

  const entry = scoreConfig.entriesAttrs[entryId];

  if (entry === undefined) {
    return null;
  }

  const value = entry[attributeName];

  if (value === undefined || value === null) {
    return null;
  }

  // Convert numbers to string so matching code can stay simple.
  return String(value);
}

/**
 * Read a slot attribute as text. Returns null if missing.
 *
 * @param {Object} scoreConfig
 * @param {string} slotId
 * @param {string} attributeName
 * @returns {string|null}
 */
function getSlotText(scoreConfig, slotId, attributeName) {
  if (scoreConfig.slotAttrs === undefined) {
    return null;
  }

  const slot = scoreConfig.slotAttrs[slotId];

  if (slot === undefined) {
    return null;
  }

  const value = slot[attributeName];

  if (value === undefined || value === null) {
    return null;
  }

  return String(value);
}
