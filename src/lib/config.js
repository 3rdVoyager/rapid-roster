const keywordConfigs = [
  {
    keyword: "match",
    inputValidators: ["itemAttribute", "slotAttribute"],
    affectedBy: ["move", "remove", "add", "swap"],
  },
  {
    keyword: "group",
    inputValidators: ["itemAttribute", "itemAttribute"],
    affectedBy: ["move", "remove", "add", "swap"],
  },
  {
    keyword: "limit",
    inputValidators: ["limitType", "nonNegativeInteger"],
    affectedBy: ["move", "remove", "add"],
  },
  {
    keyword: "balance",
    inputValidators: ["itemAttribute"],
    affectedBy: ["move", "remove", "add", "swap"],
  },
  {
    keyword: "distribute",
    inputValidators: ["itemAttribute"],
    affectedBy: ["move", "remove", "add", "swap"],
  },
  {
    keyword: "align",
    inputValidators: ["slotAttribute", "itemAttribute"],
    affectedBy: ["move", "remove", "add", "swap"],
  },
];

export default keywordConfigs;