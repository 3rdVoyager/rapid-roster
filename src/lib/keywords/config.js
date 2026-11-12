import * as align from "./align.js";
import * as balance from "./balance.js";
import * as distribute from "./distribute.js";
import * as group from "./group.js";
import * as limit from "./limit.js";
import * as match from "./match.js";

const keywordModules = [match, group, limit, balance, distribute, align];

export const keywordConfigs = keywordModules.map((module) => ({
  ...module.config,
  evaluate: module.evaluate,
  isAffected: module.isAffected,
  evaluateSwap: module.evaluateSwap,
  generateCandidate: module.generateCandidate,
}));

export function getKeywordConfig(keyword) {
  return keywordConfigs.find((config) => config.keyword === keyword);
}

export default keywordConfigs;
