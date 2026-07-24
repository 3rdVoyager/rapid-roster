/**
 * search.js
 *
 * This file answers one question:
 *   "Can we find a legal assignment with a better soft score?"
 *
 * It uses:
 *   - placement.js  → change who is in which slot
 *   - legal.js      → only keep allowed layouts
 *   - score.js      → prefer layouts with a higher totalScore
 *
 * ---------------------------------------------------------------------------
 * How a main run works (from generator.md)
 * ---------------------------------------------------------------------------
 *
 * 1. Start from a legal placement (build one, or use one you pass in)
 * 2. Improve with PERSON PASSES:
 *      for each person, try move / swap / add / remove
 *      keep a change when it is legal and the score goes up
 *      repeat full passes until one pass finds nothing better
 * 3. Optionally SHAKE (random legal swaps), then improve again
 * 4. Always remember the GLOBAL BEST score seen (shakes may go downhill)
 * 5. By default, do several independent attempts and return the TOP OPTIONS
 *    ranked by score so the user can pick one (Generate / Retry in the UI)
 *
 * ---------------------------------------------------------------------------
 * How to call this file
 * ---------------------------------------------------------------------------
 *
 *   import { runSearch, mergeOptions } from "./search.js";
 *
 *   const result = runSearch(legalConfig, scoreConfig, {
 *     // optional (defaults shown):
 *     startAssignments: existingMap, // only used on attempt 1, if provided
 *     optionCount: 3,         // how many ranked options to return
 *     attempts: 3,            // how many independent searches to try
 *     maxShakes: 3,
 *     shakeSwaps: 12,
 *     maxImprovePasses: 30,
 *     onProgress: function (info) { console.log(info); }
 *   });
 *
 *   // result.ok === false → could not find any legal start
 *   // result.ok === true
 *   //   result.options     → [{ rank, assignments, totalScore, scoresByRule }, ...]
 *   //   result.assignments → same as options[0] (best), for convenience
 *
 * Later UI "Retry":
 *   const more = runSearch(legalConfig, scoreConfig, { optionCount: 3, attempts: 3 });
 *   const combined = mergeOptions(existingOptions, more.options, 6); // or whatever cap
 *
 * legalConfig and scoreConfig are the same shapes used by legal.js and score.js.
 * Person ids come from scoreConfig.entriesAttrs (every key is a person).
 */

import {
  createEmptyAssignments,
  copyAssignments,
  addEntryToSlot,
  removeEntryFromSlot,
  moveEntry,
  swapEntries,
  getSlotsForEntry,
  getEntriesInSlot,
  entryIsInSlot
} from "./placement.js";

import { checkLegal } from "./legal.js";
import { scorePlacement } from "./score.js";

/**
 * Main entry point.
 *
 * Runs one or more independent attempts, keeps the best layout from each,
 * then returns the top optionCount layouts ranked by totalScore.
 *
 * @param {Object} legalConfig
 * @param {Object} scoreConfig
 * @param {Object} [options]
 * @returns {Object} result (see header)
 */
export function runSearch(legalConfig, scoreConfig, options) {
  if (options === undefined) {
    options = {};
  }

  let optionCount = options.optionCount;
  if (optionCount === undefined) {
    optionCount = 3;
  }

  let attempts = options.attempts;
  if (attempts === undefined) {
    attempts = optionCount;
  }

  let maxShakes = options.maxShakes;
  if (maxShakes === undefined) {
    maxShakes = 3;
  }

  let shakeSwaps = options.shakeSwaps;
  if (shakeSwaps === undefined) {
    shakeSwaps = 12;
  }

  let maxImprovePasses = options.maxImprovePasses;
  if (maxImprovePasses === undefined) {
    maxImprovePasses = 30;
  }

  const onProgress = options.onProgress;
  const collected = [];

  for (let attempt = 1; attempt <= attempts; attempt = attempt + 1) {
    reportProgress(onProgress, {
      phase: "attempt",
      attempt: attempt,
      attempts: attempts
    });

    // Only the first attempt may reuse a caller-provided start map.
    let startAssignments = undefined;
    if (attempt === 1) {
      startAssignments = options.startAssignments;
    }

    const one = runOneAttempt(legalConfig, scoreConfig, {
      startAssignments: startAssignments,
      maxShakes: maxShakes,
      shakeSwaps: shakeSwaps,
      maxImprovePasses: maxImprovePasses,
      onProgress: onProgress,
      attempt: attempt
    });

    if (one.ok === true) {
      collected.push({
        assignments: one.assignments,
        totalScore: one.totalScore,
        scoresByRule: one.scoresByRule
      });
    } else if (attempt === 1 && collected.length === 0) {
      // If even the first attempt cannot start, fail clearly.
      // (Later attempts might still work if randomness helps, but a
      //  hard-impossible setup will keep failing.)
      return {
        ok: false,
        reasons: one.reasons,
        assignments: null,
        totalScore: 0,
        scoresByRule: [],
        options: []
      };
    }
  }

  const ranked = rankAndTrimOptions(collected, optionCount);

  if (ranked.length === 0) {
    return {
      ok: false,
      reasons: ["No legal placements were found."],
      assignments: null,
      totalScore: 0,
      scoresByRule: [],
      options: []
    };
  }

  reportProgress(onProgress, {
    phase: "done",
    bestScore: ranked[0].totalScore,
    optionCount: ranked.length
  });

  return {
    ok: true,
    reasons: [],
    // Convenience copies of the #1 option:
    assignments: ranked[0].assignments,
    totalScore: ranked[0].totalScore,
    scoresByRule: ranked[0].scoresByRule,
    options: ranked
  };
}

/**
 * Merge two option lists for a later UI "Retry" button.
 *
 * - Combines old + new
 * - Drops duplicate layouts
 * - Sorts by score (highest first)
 * - Keeps at most keepCount items
 *
 * @param {Object[]} existingOptions
 * @param {Object[]} newOptions
 * @param {number} keepCount
 * @returns {Object[]} ranked options with fresh rank numbers
 */
export function mergeOptions(existingOptions, newOptions, keepCount) {
  let existing = existingOptions;
  let incoming = newOptions;

  if (existing === undefined) {
    existing = [];
  }

  if (incoming === undefined) {
    incoming = [];
  }

  if (keepCount === undefined) {
    keepCount = 6;
  }

  const combined = [];

  for (let i = 0; i < existing.length; i = i + 1) {
    combined.push(existing[i]);
  }

  for (let i = 0; i < incoming.length; i = i + 1) {
    combined.push(incoming[i]);
  }

  return rankAndTrimOptions(combined, keepCount);
}

/**
 * One independent climb: build/use a start, improve, shake, improve…
 * Always returns the GLOBAL BEST layout seen (not whatever the last shake left).
 *
 * @returns {Object}
 */
function runOneAttempt(legalConfig, scoreConfig, options) {
  let assignments = options.startAssignments;
  let startSource = "provided";

  if (assignments === undefined) {
    const built = buildInitialAssignments(legalConfig, scoreConfig);
    startSource = "built";

    if (built.ok === false) {
      return {
        ok: false,
        reasons: built.reasons,
        assignments: null,
        totalScore: 0,
        scoresByRule: []
      };
    }

    assignments = built.assignments;
  }

  const startLegal = checkLegal(assignments, legalConfig);

  if (startLegal.ok === false) {
    return {
      ok: false,
      reasons: startLegal.reasons,
      assignments: null,
      totalScore: 0,
      scoresByRule: []
    };
  }

  let scored = scorePlacement(assignments, scoreConfig);

  // working* = layout we are currently climbing from (may get worse after a shake)
  // best*    = best layout seen in THIS attempt (never thrown away)
  let workingAssignments = assignments;
  let workingScore = scored.totalScore;

  let bestAssignments = copyAssignments(assignments);
  let bestScore = scored.totalScore;
  let bestBreakdown = scored.scoresByRule;

  reportProgress(options.onProgress, {
    phase: "start",
    attempt: options.attempt,
    startSource: startSource,
    bestScore: bestScore
  });

  let shakesUsed = 0;

  while (shakesUsed <= options.maxShakes) {
    const improved = improveAssignments(
      workingAssignments,
      workingScore,
      legalConfig,
      scoreConfig,
      options.maxImprovePasses,
      options.onProgress
    );

    workingAssignments = improved.assignments;
    workingScore = improved.bestScore;

    if (workingScore > bestScore) {
      bestAssignments = copyAssignments(workingAssignments);
      bestScore = workingScore;
      bestBreakdown = improved.scoresByRule;
    }

    if (shakesUsed < options.maxShakes) {
      reportProgress(options.onProgress, {
        phase: "shake",
        attempt: options.attempt,
        shakeNumber: shakesUsed + 1,
        bestScore: bestScore
      });

      workingAssignments = shakeAssignments(
        workingAssignments,
        legalConfig,
        options.shakeSwaps
      );

      scored = scorePlacement(workingAssignments, scoreConfig);
      workingScore = scored.totalScore;

      // A lucky shake might already beat the best before we improve again.
      if (workingScore > bestScore) {
        bestAssignments = copyAssignments(workingAssignments);
        bestScore = workingScore;
        bestBreakdown = scored.scoresByRule;
      }
    }

    shakesUsed = shakesUsed + 1;
  }

  return {
    ok: true,
    reasons: [],
    assignments: bestAssignments,
    totalScore: bestScore,
    scoresByRule: bestBreakdown
  };
}

/**
 * Sort by score (high → low), drop duplicate layouts, assign rank 1..n, trim.
 *
 * @param {Object[]} optionsList
 * @param {number} keepCount
 * @returns {Object[]}
 */
function rankAndTrimOptions(optionsList, keepCount) {
  const unique = [];

  for (let i = 0; i < optionsList.length; i = i + 1) {
    const candidate = optionsList[i];
    const fingerprint = assignmentFingerprint(candidate.assignments);
    let alreadyHave = false;

    for (let u = 0; u < unique.length; u = u + 1) {
      if (unique[u].fingerprint === fingerprint) {
        alreadyHave = true;

        // If duplicate, keep the copy with the higher score (should be equal).
        if (candidate.totalScore > unique[u].totalScore) {
          unique[u].totalScore = candidate.totalScore;
          unique[u].assignments = candidate.assignments;
          unique[u].scoresByRule = candidate.scoresByRule;
        }

        break;
      }
    }

    if (alreadyHave === false) {
      unique.push({
        fingerprint: fingerprint,
        assignments: candidate.assignments,
        totalScore: candidate.totalScore,
        scoresByRule: candidate.scoresByRule
      });
    }
  }

  // Sort highest score first (simple bubble sort — clear, fine for tiny lists).
  for (let i = 0; i < unique.length; i = i + 1) {
    for (let j = i + 1; j < unique.length; j = j + 1) {
      if (unique[j].totalScore > unique[i].totalScore) {
        const temp = unique[i];
        unique[i] = unique[j];
        unique[j] = temp;
      }
    }
  }

  const ranked = [];
  const limit = Math.min(keepCount, unique.length);

  for (let i = 0; i < limit; i = i + 1) {
    ranked.push({
      rank: i + 1,
      assignments: unique[i].assignments,
      totalScore: unique[i].totalScore,
      scoresByRule: unique[i].scoresByRule
    });
  }

  return ranked;
}

/**
 * A stable text id for an assignments map, used to detect duplicates.
 *
 * @param {Object} assignments
 * @returns {string}
 */
function assignmentFingerprint(assignments) {
  const entryIds = Object.keys(assignments).sort();
  const parts = [];

  for (let i = 0; i < entryIds.length; i = i + 1) {
    const entryId = entryIds[i];
    const slots = getSlotsForEntry(assignments, entryId).sort();
    parts.push(entryId + ":" + slots.join("+"));
  }

  return parts.join("|");
}

/**
 * Improve by full PERSON PASSES.
 *
 * One pass = walk every person once and try their moves.
 * If anything got better during the pass, run another pass.
 * Stop when a whole pass finds no improvement (or we hit maxImprovePasses).
 *
 * @returns {{ assignments: Object, bestScore: number, scoresByRule: Object[] }}
 */
function improveAssignments(
  assignments,
  startingScore,
  legalConfig,
  scoreConfig,
  maxImprovePasses,
  onProgress
) {
  let current = assignments;
  let bestScore = startingScore;
  let scored = scorePlacement(current, scoreConfig);
  let bestBreakdown = scored.scoresByRule;

  let passNumber = 0;
  let keepGoing = true;

  while (keepGoing === true) {
    passNumber = passNumber + 1;

    if (passNumber > maxImprovePasses) {
      break;
    }

    const entryIds = Object.keys(current);
    let improvedThisPass = false;

    for (let p = 0; p < entryIds.length; p = p + 1) {
      const entryId = entryIds[p];

      reportProgress(onProgress, {
        phase: "improving",
        pass: passNumber,
        entryIndex: p + 1,
        entryCount: entryIds.length,
        entryId: entryId,
        bestScore: bestScore
      });

      const afterEntry = improveOneEntry(
        current,
        entryId,
        bestScore,
        legalConfig,
        scoreConfig
      );

      if (afterEntry.improved === true) {
        current = afterEntry.assignments;
        bestScore = afterEntry.bestScore;
        bestBreakdown = afterEntry.scoresByRule;
        improvedThisPass = true;
      }
    }

    if (improvedThisPass === false) {
      keepGoing = false;
    }
  }

  return {
    assignments: current,
    bestScore: bestScore,
    scoresByRule: bestBreakdown
  };
}

/**
 * For one person, try sensible moves in a fixed order.
 * Take the FIRST move that is legal and raises the score (greedy).
 *
 * Order:
 *   1. Move each of their slots → each other slot
 *   2. Swap with every other person
 *   3. Add them to a slot they are not in
 *   4. Remove them from one of their slots
 *
 * @returns {{ improved: boolean, assignments: Object, bestScore: number, scoresByRule: Object[] }}
 */
function improveOneEntry(
  assignments,
  entryId,
  currentScore,
  legalConfig,
  scoreConfig
) {
  const slotIds = legalConfig.slotIds;
  const otherEntries = Object.keys(assignments);
  const theirSlots = getSlotsForEntry(assignments, entryId);

  // ----- 1. Moves -----
  for (let s = 0; s < theirSlots.length; s = s + 1) {
    const fromSlotId = theirSlots[s];

    for (let t = 0; t < slotIds.length; t = t + 1) {
      const toSlotId = slotIds[t];

      if (fromSlotId === toSlotId) {
        continue;
      }

      const moved = moveEntry(assignments, entryId, fromSlotId, toSlotId);
      const accepted = acceptIfBetter(
        moved,
        currentScore,
        legalConfig,
        scoreConfig
      );

      if (accepted !== null) {
        return accepted;
      }
    }
  }

  // ----- 2. Swaps -----
  for (let i = 0; i < otherEntries.length; i = i + 1) {
    const otherId = otherEntries[i];

    if (otherId === entryId) {
      continue;
    }

    const swapped = swapEntries(assignments, entryId, otherId);
    const accepted = acceptIfBetter(
      swapped,
      currentScore,
      legalConfig,
      scoreConfig
    );

    if (accepted !== null) {
      return accepted;
    }
  }

  // ----- 3. Adds -----
  for (let t = 0; t < slotIds.length; t = t + 1) {
    const slotId = slotIds[t];

    if (entryIsInSlot(assignments, entryId, slotId) === true) {
      continue;
    }

    const added = addEntryToSlot(assignments, entryId, slotId);
    const accepted = acceptIfBetter(
      added,
      currentScore,
      legalConfig,
      scoreConfig
    );

    if (accepted !== null) {
      return accepted;
    }
  }

  // ----- 4. Removes -----
  for (let s = 0; s < theirSlots.length; s = s + 1) {
    const slotId = theirSlots[s];
    const removed = removeEntryFromSlot(assignments, entryId, slotId);
    const accepted = acceptIfBetter(
      removed,
      currentScore,
      legalConfig,
      scoreConfig
    );

    if (accepted !== null) {
      return accepted;
    }
  }

  return {
    improved: false,
    assignments: assignments,
    bestScore: currentScore,
    scoresByRule: []
  };
}

/**
 * If candidate is legal and scores higher than currentScore, return a success object.
 * Otherwise return null.
 */
function acceptIfBetter(candidate, currentScore, legalConfig, scoreConfig) {
  const legal = checkLegal(candidate, legalConfig);

  if (legal.ok === false) {
    return null;
  }

  const scored = scorePlacement(candidate, scoreConfig);

  if (scored.totalScore > currentScore) {
    return {
      improved: true,
      assignments: candidate,
      bestScore: scored.totalScore,
      scoresByRule: scored.scoresByRule
    };
  }

  return null;
}

/**
 * Swap the full slot lists of two different people (used by shake).
 */
function tryRandomSwap(assignments, legalConfig) {
  const entryIds = Object.keys(assignments);

  if (entryIds.length < 2) {
    return null;
  }

  const entryA = pickRandomFromList(entryIds);
  const entryB = pickRandomFromList(entryIds);

  if (entryA === entryB) {
    return null;
  }

  const next = swapEntries(assignments, entryA, entryB);
  return onlyIfLegal(next, legalConfig);
}

/**
 * Shake: do several random legal swaps (score may go down).
 * Gives improveAssignments a new neighborhood to climb from.
 */
function shakeAssignments(assignments, legalConfig, shakeSwaps) {
  let current = assignments;

  for (let i = 0; i < shakeSwaps; i = i + 1) {
    const next = tryRandomSwap(current, legalConfig);

    if (next !== null) {
      current = next;
    }
  }

  return current;
}

/**
 * Return next only when checkLegal says ok; otherwise null.
 */
function onlyIfLegal(nextAssignments, legalConfig) {
  const result = checkLegal(nextAssignments, legalConfig);

  if (result.ok === true) {
    return nextAssignments;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Building a legal starting placement
// ---------------------------------------------------------------------------

/**
 * Greedy start:
 * 1. Create empty assignments for every person in scoreConfig.entriesAttrs
 * 2. Fill each slot up to its minimum size
 * 3. Give remaining people a slot when capacity allows
 * 4. If the result is not legal, fail with reasons
 *
 * This is not fancy — it only needs to be good enough to begin improving.
 *
 * @returns {{ ok: true, assignments: Object } | { ok: false, reasons: string[] }}
 */
function buildInitialAssignments(legalConfig, scoreConfig) {
  let entryIds = [];

  if (scoreConfig.entriesAttrs !== undefined) {
    entryIds = Object.keys(scoreConfig.entriesAttrs);
  }

  if (entryIds.length === 0) {
    return {
      ok: false,
      reasons: ["No entries found in scoreConfig.entriesAttrs."]
    };
  }

  if (legalConfig.slotIds === undefined || legalConfig.slotIds.length === 0) {
    return {
      ok: false,
      reasons: ["No slots found in legalConfig.slotIds."]
    };
  }

  let assignments = createEmptyAssignments(entryIds);
  const slotIds = legalConfig.slotIds;

  // How many slots each person may hold (same default as legal.js).
  let maxSlotsPerEntry = legalConfig.defaultSlotsPerEntry;
  if (maxSlotsPerEntry === undefined) {
    maxSlotsPerEntry = 1;
  }

  // ----- Fill slot minimums first -----
  for (let s = 0; s < slotIds.length; s = s + 1) {
    const slotId = slotIds[s];
    const minSize = readMinSize(legalConfig, slotId);

    while (getEntriesInSlot(assignments, slotId).length < minSize) {
      const entryId = findEntryWhoCanTakeSlot(
        assignments,
        slotId,
        legalConfig,
        maxSlotsPerEntry
      );

      if (entryId === null) {
        break;
      }

      assignments = addEntryToSlot(assignments, entryId, slotId);
    }
  }

  // ----- Place anyone still under their slot limit -----
  for (let p = 0; p < entryIds.length; p = p + 1) {
    const entryId = entryIds[p];

    while (getSlotsForEntry(assignments, entryId).length < maxSlotsPerEntry) {
      const slotId = findSlotForEntry(
        assignments,
        entryId,
        legalConfig
      );

      if (slotId === null) {
        break;
      }

      assignments = addEntryToSlot(assignments, entryId, slotId);
    }
  }

  const legal = checkLegal(assignments, legalConfig);

  if (legal.ok === false) {
    return {
      ok: false,
      reasons: legal.reasons
    };
  }

  return {
    ok: true,
    assignments: assignments
  };
}

/**
 * Find a person who is not in slotId yet, still has slot capacity,
 * and would not break max size / conflicts if added.
 * (We check full legality after the real add in the main loops;
 *  here we use a quick trial add.)
 */
function findEntryWhoCanTakeSlot(
  assignments,
  slotId,
  legalConfig,
  maxSlotsPerEntry
) {
  const entryIds = Object.keys(assignments);

  // Shuffle order a bit so starts are not always identical.
  const order = shuffledCopy(entryIds);

  for (let i = 0; i < order.length; i = i + 1) {
    const entryId = order[i];

    if (entryIsInSlot(assignments, entryId, slotId) === true) {
      continue;
    }

    if (getSlotsForEntry(assignments, entryId).length >= maxSlotsPerEntry) {
      continue;
    }

    const trial = addEntryToSlot(assignments, entryId, slotId);

    // During construction, mins may still be unmet globally.
    // So we only reject if THIS add clearly breaks max / slots / conflicts.
    // Full checkLegal at the end still decides success.
    if (breaksHardCapacity(trial, legalConfig) === false) {
      return entryId;
    }
  }

  return null;
}

/**
 * Find a slot this person can join without breaking capacity checks.
 */
function findSlotForEntry(assignments, entryId, legalConfig) {
  const slotIds = shuffledCopy(legalConfig.slotIds);

  for (let i = 0; i < slotIds.length; i = i + 1) {
    const slotId = slotIds[i];

    if (entryIsInSlot(assignments, entryId, slotId) === true) {
      continue;
    }

    const trial = addEntryToSlot(assignments, entryId, slotId);

    if (breaksHardCapacity(trial, legalConfig) === false) {
      return slotId;
    }
  }

  return null;
}

/**
 * True if the layout breaks max size, slots-per-entry, conflicts, or unknown slots.
 * Ignores minimum sizes (used only while building a start).
 *
 * We do this by temporarily checking legal with mins forced to 0.
 */
function breaksHardCapacity(assignments, legalConfig) {
  const relaxed = {
    slotIds: legalConfig.slotIds,
    slotMinSizes: 0,
    slotMaxSizes: legalConfig.slotMaxSizes,
    defaultSlotsPerEntry: legalConfig.defaultSlotsPerEntry,
    conflictGroups: legalConfig.conflictGroups
  };

  const result = checkLegal(assignments, relaxed);
  return result.ok === false;
}

/**
 * Min size for one slot (number or map), same idea as legal.js.
 */
function readMinSize(legalConfig, slotId) {
  const sizes = legalConfig.slotMinSizes;

  if (sizes === undefined) {
    return 0;
  }

  if (typeof sizes === "number") {
    return sizes;
  }

  if (sizes[slotId] === undefined) {
    return 0;
  }

  return sizes[slotId];
}

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

function reportProgress(onProgress, info) {
  if (typeof onProgress === "function") {
    onProgress(info);
  }
}

function pickRandomFromList(list) {
  if (list === undefined || list.length === 0) {
    return undefined;
  }

  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

function shuffledCopy(list) {
  const copy = list.slice();

  // Fisher–Yates shuffle (simple and clear).
  for (let i = copy.length - 1; i > 0; i = i - 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }

  return copy;
}
