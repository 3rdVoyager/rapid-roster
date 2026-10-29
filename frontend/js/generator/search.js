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
 * 5. Run many independent attempts, keep only the TOP optionCount layouts
 *    (trim after every attempt to save memory). Once the kept set is full,
 *    stop early when scores stop improving for stagnationLimit attempts
 *    in a row (never early-stop while still short of optionCount uniques).
 *
 * ---------------------------------------------------------------------------
 * How to call this file
 * ---------------------------------------------------------------------------
 *
 *   import { runSearch } from "./search.js";
 *
 *   const result = runSearch(legalConfig, scoreConfig, {
 *     // optional (defaults shown):
 *     startAssignments: existingMap, // only used on attempt 1, if provided
 *     optionCount: 5,         // how many ranked options to keep / return
 *     maxAttempts: 60,        // hard cap on independent searches
 *     stagnationLimit: 15,    // after a full set, stop after this many flat attempts
 *     maxShakes: 3,
 *     shakeSwaps: 12,
 *     maxImprovePasses: 30,
 *     maxSwapSamples: null,   // null = try every swap partner; number = sample that many
 *     improveIdleFraction: 0.5, // end pass after this fraction of people with no gain
 *     timeBudgetMs: null,     // optional; usually null from the UI
 *     shouldCancel: function () { return false; },
 *     onProgress: function (info) { console.log(info); },
 *     onOptionsUpdate: function (update) { console.log(update); }
 *   });
 *
 * Prefer buildSearchOptions(entryCount, project.setup.generate) from the UI.
 *
 *   // result.ok === false → could not find any legal start
 *   // result.ok === true
 *   //   result.options     → [{ rank, assignments, totalScore, scoresByRule }, ...]
 *   //   result.assignments → same as options[0] (best), for convenience
 *   //   result.stopReason  → "max-attempts" | "stagnation" | "time-budget" | "cancelled"
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
import { getMaxSlotsForEntry } from "../project-config.js";

/**
 * Size-aware search knobs. Small projects stay thorough; large ones sample
 * swaps and run fewer attempts. Quality mode mainly changes how soon an
 * improve pass gives up after a streak of people with no gain.
 *
 * @param {number} entryCount
 * @returns {Object}
 */
export function defaultSearchOptions(entryCount) {
  const n = entryCount || 0;

  // Large projects: many short finished attempts beat one very long climb.
  if (n > 250) {
    return {
      optionCount: 5,
      maxAttempts: 12,
      stagnationLimit: 3,
      maxShakes: 0,
      shakeSwaps: 0,
      maxImprovePasses: 2,
      maxSwapSamples: 16,
      timeBudgetMs: null,
      improveIdleFraction: 0.5
    };
  }

  if (n > 100) {
    return {
      optionCount: 5,
      maxAttempts: 16,
      stagnationLimit: 4,
      maxShakes: 1,
      shakeSwaps: 8,
      maxImprovePasses: 4,
      maxSwapSamples: 32,
      timeBudgetMs: null,
      improveIdleFraction: 0.5
    };
  }

  if (n > 40) {
    return {
      optionCount: 5,
      maxAttempts: 40,
      stagnationLimit: 10,
      maxShakes: 2,
      shakeSwaps: 12,
      maxImprovePasses: 12,
      maxSwapSamples: 80,
      timeBudgetMs: null,
      improveIdleFraction: 0.5
    };
  }

  return {
    optionCount: 5,
    maxAttempts: 60,
    stagnationLimit: 15,
    maxShakes: 2,
    shakeSwaps: 12,
    maxImprovePasses: 20,
    maxSwapSamples: null,
    timeBudgetMs: null,
    improveIdleFraction: 0.5
  };
}

/**
 * Default Generate-page settings (stored on project.setup.generate).
 *
 * @returns {Object}
 */
export function defaultGenerateSettings() {
  return {
    mode: "balanced"
  };
}

/**
 * Merge size-aware defaults with the user's Generate quality mode.
 *
 * Quick → very short improve pass (idle fraction 0.05); aggressive caps on large n
 * Balanced → after ~1/2
 * Best → full pass required (fraction 1)
 *
 * @param {number} entryCount
 * @param {Object} [generateSettings]
 * @returns {Object} options for runSearch
 */
export function buildSearchOptions(entryCount, generateSettings) {
  const settings = normalizeGenerateSettings(generateSettings);
  const base = defaultSearchOptions(entryCount);
  const n = Number(entryCount) || 0;
  const opts = {
    optionCount: base.optionCount,
    maxAttempts: base.maxAttempts,
    stagnationLimit: base.stagnationLimit,
    maxShakes: base.maxShakes,
    shakeSwaps: base.shakeSwaps,
    maxImprovePasses: base.maxImprovePasses,
    maxSwapSamples: base.maxSwapSamples,
    timeBudgetMs: null,
    improveIdleFraction: 0.5
  };

  if (settings.mode === "quick") {
    opts.maxShakes = 0;
    opts.maxImprovePasses = 1;
    opts.improveIdleFraction = 0.05;
    opts.stagnationLimit = Math.min(base.stagnationLimit, 3);

    if (n > 250) {
      opts.maxAttempts = 4;
      opts.maxSwapSamples = 8;
    } else if (n > 100) {
      opts.maxAttempts = 6;
      opts.maxSwapSamples = 12;
    } else {
      opts.maxAttempts = Math.max(6, Math.ceil(base.maxAttempts / 2));
      if (opts.maxSwapSamples === null || opts.maxSwapSamples > 32) {
        opts.maxSwapSamples = 32;
      }
    }
  } else if (settings.mode === "best") {
    opts.maxAttempts = Math.max(base.maxAttempts, 120);
    opts.stagnationLimit = Math.max(base.stagnationLimit, 25);
    opts.maxShakes = Math.max(base.maxShakes || 0, 3);
    opts.shakeSwaps = Math.max(base.shakeSwaps || 0, 16);
    opts.maxImprovePasses = Math.max(base.maxImprovePasses || 20, 200);
    opts.maxSwapSamples = null;
    opts.improveIdleFraction = 1;
  } else {
    opts.improveIdleFraction = 0.5;
  }

  return opts;
}

/**
 * @param {Object|undefined} raw
 * @returns {Object}
 */
export function normalizeGenerateSettings(raw) {
  const defaults = defaultGenerateSettings();

  if (raw === undefined || raw === null || typeof raw !== "object") {
    return defaults;
  }

  let mode = defaults.mode;
  if (raw.mode === "quick" || raw.mode === "balanced" || raw.mode === "best") {
    mode = raw.mode;
  }

  return {
    mode: mode
  };
}

/**
 * Main entry point.
 *
 * Runs many independent attempts, keeps only the top optionCount layouts
 * after each attempt, and stops early once a full set stops improving
 * or shouldCancel() returns true.
 *
 * Optional timeBudgetMs (null by default) never aborts mid-attempt.
 * Cancel still stops as soon as the current improve step notices it.
 *
 * @param {Object} legalConfig
 * @param {Object} scoreConfig
 * @param {Object} [options]
 * @returns {Object} result (see file header)
 */
export function runSearch(legalConfig, scoreConfig, options) {
  if (options === undefined) {
    options = {};
  }

  let optionCount = options.optionCount;
  if (optionCount === undefined) {
    optionCount = 5;
  }

  // Prefer maxAttempts; fall back to legacy `attempts` if callers still pass it.
  let maxAttempts = options.maxAttempts;
  if (maxAttempts === undefined) {
    maxAttempts = options.attempts;
  }
  if (maxAttempts === undefined) {
    maxAttempts = 60;
  }

  let stagnationLimit = options.stagnationLimit;
  if (stagnationLimit === undefined) {
    stagnationLimit = 15;
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

  // null / undefined = try every other person (fine for small projects).
  const maxSwapSamples = options.maxSwapSamples;

  let timeBudgetMs = options.timeBudgetMs;
  if (timeBudgetMs === undefined) {
    timeBudgetMs = null;
  }

  // End an improve pass after this fraction of people in a row with no gain.
  // 0.05 = quick, 0.5 = balanced, 1 = best (full pass).
  let improveIdleFraction = options.improveIdleFraction;
  if (
    improveIdleFraction === undefined ||
    Number.isNaN(Number(improveIdleFraction)) === true
  ) {
    improveIdleFraction = 0.5;
  }
  if (improveIdleFraction < 0.01) {
    improveIdleFraction = 0.01;
  }
  if (improveIdleFraction > 1) {
    improveIdleFraction = 1;
  }

  const onProgress = options.onProgress;
  const shouldCancel = options.shouldCancel;
  const startedAt = Date.now();

  /** @type {Object[]} */
  let ranked = [];
  let stagnantAttempts = 0;
  let lastSignature = "";
  let stopReason = "max-attempts";
  let lastAttemptMs = 0;

  function isCancelled() {
    return typeof shouldCancel === "function" && shouldCancel() === true;
  }

  function isTimedOut() {
    return timeBudgetMs !== null && Date.now() - startedAt >= timeBudgetMs;
  }

  /**
   * Skip starting another attempt when the budget is effectively spent.
   * Uses the last attempt's runtime as a hint so we do not begin a climb
   * we almost certainly cannot finish before the deadline.
   */
  function shouldSkipNewAttempt() {
    if (timeBudgetMs === null) {
      return false;
    }

    const elapsedMs = Date.now() - startedAt;
    const remainingMs = timeBudgetMs - elapsedMs;

    if (remainingMs <= 0) {
      return true;
    }

    // Need a little headroom for the next climb.
    if (lastAttemptMs > 0 && remainingMs < lastAttemptMs * 0.6) {
      return true;
    }

    // Absolute floor so tiny leftovers do not start another 500-person pass.
    if (remainingMs < 2500) {
      return true;
    }

    return false;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt = attempt + 1) {
    if (isCancelled() === true) {
      stopReason = "cancelled";
      break;
    }

    // Soft deadline: do not start another climb once the budget is spent.
    // The attempt already in progress (if any) always finishes first.
    if (shouldSkipNewAttempt() === true) {
      stopReason = "time-budget";
      break;
    }

    const elapsedMs = Date.now() - startedAt;

    reportProgress(onProgress, {
      phase: "attempt",
      attempt: attempt,
      attempts: maxAttempts,
      maxAttempts: maxAttempts,
      kept: ranked.length,
      bestScore: ranked.length > 0 ? ranked[0].totalScore : null,
      stagnantAttempts: stagnantAttempts,
      elapsedMs: elapsedMs,
      timeBudgetMs: timeBudgetMs
    });

    // Only the first attempt may reuse a caller-provided start map.
    let startAssignments = undefined;
    if (attempt === 1) {
      startAssignments = options.startAssignments;
    }

    const attemptStartedAt = Date.now();

    const one = runOneAttempt(legalConfig, scoreConfig, {
      startAssignments: startAssignments,
      maxShakes: maxShakes,
      shakeSwaps: shakeSwaps,
      maxImprovePasses: maxImprovePasses,
      maxSwapSamples: maxSwapSamples,
      improveIdleFraction: improveIdleFraction,
      onProgress: onProgress,
      attempt: attempt,
      // Cancel may interrupt a climb; time budget waits for this attempt to finish.
      shouldStop: function () {
        return isCancelled() === true;
      }
    });

    lastAttemptMs = Date.now() - attemptStartedAt;

    if (one.ok === true) {
      const combined = ranked.slice();
      combined.push({
        assignments: one.assignments,
        totalScore: one.totalScore,
        scoresByRule: one.scoresByRule
      });
      // Memory: never keep more than the top optionCount unique layouts.
      ranked = rankAndTrimOptions(combined, optionCount);

      const signature = topOptionsSignature(ranked);
      if (signature === lastSignature) {
        stagnantAttempts = stagnantAttempts + 1;
      } else {
        stagnantAttempts = 0;
        lastSignature = signature;
        // Let the UI show options as soon as the kept set changes
        // (first unique layout, then better / additional ones).
        emitOptionsUpdate(options.onOptionsUpdate, ranked);
      }
    } else if (attempt === 1 && ranked.length === 0) {
      // If even the first attempt cannot start, fail clearly.
      return {
        ok: false,
        reasons: one.reasons,
        assignments: null,
        totalScore: 0,
        scoresByRule: [],
        options: [],
        stopReason: "failed"
      };
    } else {
      stagnantAttempts = stagnantAttempts + 1;
    }

    if (isCancelled() === true) {
      stopReason = "cancelled";
      break;
    }

    // After a finished attempt, stop if there is not enough budget left
    // for another full climb.
    if (shouldSkipNewAttempt() === true) {
      stopReason = "time-budget";
      break;
    }

    // Only plateau-stop once we have a full unique set. Stopping earlier
    // left users with 3–4 options when many attempts converged to the same layouts.
    if (
      ranked.length >= optionCount &&
      stagnantAttempts >= stagnationLimit
    ) {
      stopReason = "stagnation";
      break;
    }
  }

  if (ranked.length === 0) {
    let reasons = ["No legal placements were found."];
    if (stopReason === "cancelled") {
      reasons = ["Cancelled before a legal placement was found."];
    }
    return {
      ok: false,
      reasons: reasons,
      assignments: null,
      totalScore: 0,
      scoresByRule: [],
      options: [],
      stopReason: stopReason
    };
  }

  reportProgress(onProgress, {
    phase: "done",
    bestScore: ranked[0].totalScore,
    optionCount: ranked.length,
    stopReason: stopReason,
    stagnantAttempts: stagnantAttempts,
    elapsedMs: Date.now() - startedAt,
    timeBudgetMs: timeBudgetMs
  });

  return {
    ok: true,
    reasons: [],
    // Convenience copies of the #1 option:
    assignments: ranked[0].assignments,
    totalScore: ranked[0].totalScore,
    scoresByRule: ranked[0].scoresByRule,
    options: ranked,
    stopReason: stopReason
  };
}

/**
 * Notify the caller that the current top options list changed.
 *
 * @param {Function|undefined} onOptionsUpdate
 * @param {Object[]} ranked
 */
function emitOptionsUpdate(onOptionsUpdate, ranked) {
  if (typeof onOptionsUpdate !== "function") {
    return;
  }

  if (ranked.length === 0) {
    return;
  }

  onOptionsUpdate({
    options: ranked,
    kept: ranked.length,
    bestScore: ranked[0].totalScore
  });
}

/**
 * Stable signature of the current top option scores (high → low).
 * Used to detect when another attempt did not improve the kept set.
 *
 * @param {Object[]} ranked
 * @returns {string}
 */
function topOptionsSignature(ranked) {
  const parts = [];
  for (let i = 0; i < ranked.length; i = i + 1) {
    parts.push(String(ranked[i].totalScore));
  }
  return parts.join("|");
}

/**
 * Merge two option lists, drop duplicate layouts, keep top keepCount by score.
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
    keepCount = 5;
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
    if (typeof options.shouldStop === "function" && options.shouldStop() === true) {
      break;
    }

    const improved = improveAssignments(
      workingAssignments,
      workingScore,
      legalConfig,
      scoreConfig,
      options.maxImprovePasses,
      options.maxSwapSamples,
      options.improveIdleFraction,
      options.onProgress,
      options.shouldStop
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
 * One pass = walk people and try their moves.
 * Stop a pass early when improveIdleFraction of people in a row find no gain
 * (quick ≈ 1/10, balanced ≈ 1/2, best = 1 = full pass).
 * If anything got better during the pass, run another pass.
 * Stop when a pass finds no improvement (or we hit maxImprovePasses).
 *
 * @returns {{ assignments: Object, bestScore: number, scoresByRule: Object[] }}
 */
function improveAssignments(
  assignments,
  startingScore,
  legalConfig,
  scoreConfig,
  maxImprovePasses,
  maxSwapSamples,
  improveIdleFraction,
  onProgress,
  shouldStop
) {
  let current = assignments;
  let bestScore = startingScore;
  let scored = scorePlacement(current, scoreConfig);
  let bestBreakdown = scored.scoresByRule;

  let fraction = improveIdleFraction;
  if (fraction === undefined || Number.isNaN(Number(fraction)) === true) {
    fraction = 0.5;
  }
  if (fraction < 0.01) {
    fraction = 0.01;
  }
  if (fraction > 1) {
    fraction = 1;
  }

  let passNumber = 0;
  let keepGoing = true;

  while (keepGoing === true) {
    passNumber = passNumber + 1;

    if (passNumber > maxImprovePasses) {
      break;
    }

    if (typeof shouldStop === "function" && shouldStop() === true) {
      break;
    }

    const entryIds = Object.keys(current);
    let improvedThisPass = false;
    let idleStreak = 0;
    // How many people in a row with no gain before we end this pass.
    const idleLimit = Math.max(1, Math.ceil(entryIds.length * fraction));

    for (let p = 0; p < entryIds.length; p = p + 1) {
      if (typeof shouldStop === "function" && shouldStop() === true) {
        keepGoing = false;
        break;
      }

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
        scoreConfig,
        maxSwapSamples
      );

      if (afterEntry.improved === true) {
        current = afterEntry.assignments;
        bestScore = afterEntry.bestScore;
        bestBreakdown = afterEntry.scoresByRule;
        improvedThisPass = true;
        idleStreak = 0;
      } else {
        idleStreak = idleStreak + 1;
        if (idleStreak >= idleLimit) {
          // Enough people in a row with no gain — end this pass.
          break;
        }
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
 *   2. Swap with sampled (or all) other people
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
  scoreConfig,
  maxSwapSamples
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

  // ----- 2. Swaps (all partners on small sets; sample on large ones) -----
  const swapPartners = pickSwapPartners(otherEntries, entryId, maxSwapSamples);

  for (let i = 0; i < swapPartners.length; i = i + 1) {
    const otherId = swapPartners[i];
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
 * Choose who to try swapping with.
 * null / undefined maxSwapSamples → every other person.
 *
 * @param {string[]} otherEntries
 * @param {string} entryId
 * @param {number|null|undefined} maxSwapSamples
 * @returns {string[]}
 */
function pickSwapPartners(otherEntries, entryId, maxSwapSamples) {
  const partners = [];

  for (let i = 0; i < otherEntries.length; i = i + 1) {
    if (otherEntries[i] !== entryId) {
      partners.push(otherEntries[i]);
    }
  }

  if (
    maxSwapSamples === undefined ||
    maxSwapSamples === null ||
    maxSwapSamples >= partners.length
  ) {
    return partners;
  }

  return shuffledCopy(partners).slice(0, maxSwapSamples);
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

  // ----- Fill slot minimums first -----
  for (let s = 0; s < slotIds.length; s = s + 1) {
    const slotId = slotIds[s];
    const minSize = readMinSize(legalConfig, slotId);

    while (getEntriesInSlot(assignments, slotId).length < minSize) {
      const entryId = findEntryWhoCanTakeSlot(
        assignments,
        slotId,
        legalConfig
      );

      if (entryId === null) {
        break;
      }

      assignments = addEntryToSlot(assignments, entryId, slotId);
    }
  }

  // ----- Place anyone still under their own slot limit -----
  for (let p = 0; p < entryIds.length; p = p + 1) {
    const entryId = entryIds[p];
    const maxSlots = getMaxSlotsForEntry(legalConfig, entryId);

    while (getSlotsForEntry(assignments, entryId).length < maxSlots) {
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
  legalConfig
) {
  const entryIds = Object.keys(assignments);

  // Shuffle order a bit so starts are not always identical.
  const order = shuffledCopy(entryIds);

  for (let i = 0; i < order.length; i = i + 1) {
    const entryId = order[i];

    if (entryIsInSlot(assignments, entryId, slotId) === true) {
      continue;
    }

    if (
      getSlotsForEntry(assignments, entryId).length >=
      getMaxSlotsForEntry(legalConfig, entryId)
    ) {
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
    slotsPerEntryById: legalConfig.slotsPerEntryById,
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

  // Fisher-Yates shuffle (simple and clear).
  for (let i = copy.length - 1; i > 0; i = i - 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }

  return copy;
}
