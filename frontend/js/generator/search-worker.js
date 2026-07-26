/**
 * search-worker.js
 *
 * Runs runSearch off the main thread so the Generate page stays responsive.
 *
 * Logs to the browser console (DevTools → Console). Worker lines usually show
 * with a worker source badge — filter by "search-worker" if the log is busy.
 *
 * Main thread → worker:
 *   { type: "run", legalConfig, scoreConfig, options }
 *   { type: "cancel" }
 *
 * Worker → main thread:
 *   { type: "progress", info }
 *   { type: "options", options, partial: true }  // streaming; may fire many times
 *   { type: "result", result }                   // final (also includes options)
 *
 * Loaded as a module worker:
 *   new Worker("/js/generator/search-worker.js", { type: "module" })
 */

import { runSearch } from "./search.js";

/** Set true when the main thread asks us to stop early. */
let cancelRequested = false;

/** Throttle progress posts so we do not flood the UI thread. */
let lastProgressAt = 0;

self.onmessage = function (event) {
  const message = event.data;

  if (message === undefined || message === null) {
    return;
  }

  if (message.type === "cancel") {
    cancelRequested = true;
    console.log("[search-worker] cancel requested");
    return;
  }

  if (message.type !== "run") {
    console.log("[search-worker] ignored message type:", message.type);
    return;
  }

  cancelRequested = false;
  lastProgressAt = 0;

  const options = message.options || {};
  const entryCount = countEntries(message.scoreConfig);
  const slotCount = countSlots(message.legalConfig);

  console.log("[search-worker] run starting", {
    entries: entryCount,
    slots: slotCount,
    optionCount: options.optionCount,
    maxAttempts: options.maxAttempts,
    stagnationLimit: options.stagnationLimit,
    maxShakes: options.maxShakes,
    shakeSwaps: options.shakeSwaps,
    maxImprovePasses: options.maxImprovePasses,
    maxSwapSamples: options.maxSwapSamples,
    timeBudgetMs: options.timeBudgetMs
  });

  const startedAt = Date.now();

  const result = runSearch(message.legalConfig, message.scoreConfig, {
    optionCount: options.optionCount,
    maxAttempts: options.maxAttempts,
    stagnationLimit: options.stagnationLimit,
    maxShakes: options.maxShakes,
    shakeSwaps: options.shakeSwaps,
    maxImprovePasses: options.maxImprovePasses,
    maxSwapSamples: options.maxSwapSamples,
    timeBudgetMs: options.timeBudgetMs,
    startAssignments: options.startAssignments,
    shouldCancel: function () {
      return cancelRequested === true;
    },
    onProgress: function (info) {
      logProgress(info);
      postProgressThrottled(info);
    },
    onOptionsUpdate: function (update) {
      console.log("[search-worker] options update", {
        kept: update.kept,
        bestScore: update.bestScore,
        scores: update.options.map(function (opt) {
          return opt.totalScore;
        })
      });
      self.postMessage({
        type: "options",
        options: update.options,
        partial: true
      });
    }
  });

  const elapsedMs = Date.now() - startedAt;

  console.log("[search-worker] run finished", {
    ok: result.ok,
    stopReason: result.stopReason,
    elapsedMs: elapsedMs,
    bestScore: result.totalScore,
    optionCount: result.options ? result.options.length : 0,
    reasons: result.reasons
  });

  if (result.ok === true && result.options !== undefined) {
    for (let i = 0; i < result.options.length; i = i + 1) {
      const option = result.options[i];
      console.log(
        "[search-worker] option #" +
          String(option.rank) +
          " score=" +
          String(option.totalScore)
      );
    }
  }

  self.postMessage({
    type: "result",
    result: result
  });
};

/**
 * @param {Object} info
 */
function logProgress(info) {
  const phase = info.phase;

  if (phase === "attempt") {
    console.log(
      "[search-worker] attempt " +
        String(info.attempt) +
        "/" +
        String(info.maxAttempts) +
        " · kept " +
        String(info.kept) +
        " · best " +
        String(info.bestScore) +
        " · stagnant×" +
        String(info.stagnantAttempts) +
        " · elapsed " +
        String(info.elapsedMs) +
        "ms"
    );
    return;
  }

  if (phase === "start") {
    console.log(
      "[search-worker] attempt " +
        String(info.attempt) +
        " start (" +
        String(info.startSource) +
        ") · score " +
        String(info.bestScore)
    );
    return;
  }

  if (phase === "shake") {
    console.log(
      "[search-worker] attempt " +
        String(info.attempt) +
        " shake #" +
        String(info.shakeNumber) +
        " · best " +
        String(info.bestScore)
    );
    return;
  }

  if (phase === "improving") {
    // Log every person step so you can watch the climb in DevTools.
    console.log(
      "[search-worker] improve pass " +
        String(info.pass) +
        " · entry " +
        String(info.entryIndex) +
        "/" +
        String(info.entryCount) +
        " (" +
        String(info.entryId) +
        ") · best " +
        String(info.bestScore)
    );
    return;
  }

  if (phase === "done") {
    console.log(
      "[search-worker] done · best " +
        String(info.bestScore) +
        " · options " +
        String(info.optionCount) +
        " · reason " +
        String(info.stopReason) +
        " · elapsed " +
        String(info.elapsedMs) +
        "ms"
    );
    return;
  }

  console.log("[search-worker] progress", info);
}

/**
 * Always send attempt / shake / done. Throttle noisy "improving" updates.
 *
 * @param {Object} info
 */
function postProgressThrottled(info) {
  const now = Date.now();
  const phase = info.phase;

  if (phase === "attempt" || phase === "shake" || phase === "done" || phase === "start") {
    lastProgressAt = now;
    self.postMessage({ type: "progress", info: info });
    return;
  }

  if (phase === "improving") {
    if (info.entryIndex === 1 || now - lastProgressAt >= 250) {
      lastProgressAt = now;
      self.postMessage({ type: "progress", info: info });
    }
  }
}

/**
 * @param {Object} scoreConfig
 * @returns {number}
 */
function countEntries(scoreConfig) {
  if (
    scoreConfig === undefined ||
    scoreConfig === null ||
    scoreConfig.entriesAttrs === undefined
  ) {
    return 0;
  }
  return Object.keys(scoreConfig.entriesAttrs).length;
}

/**
 * @param {Object} legalConfig
 * @returns {number}
 */
function countSlots(legalConfig) {
  if (
    legalConfig === undefined ||
    legalConfig === null ||
    legalConfig.slotIds === undefined
  ) {
    return 0;
  }
  return legalConfig.slotIds.length;
}
