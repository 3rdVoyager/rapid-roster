const keywordConfigs = [
  {
    keyword: "match",
    inputValidators: ["itemAttribute", "slotAttribute"],
  },
  {
    keyword: "group",
    inputValidators: ["itemAttribute", "itemAttribute"],
  },
  {
    keyword: "limit",
    inputValidators: ["limitType", "nonNegativeInteger", "slotTargets"],
  },
  {
    keyword: "balance",
    inputValidators: ["itemAttribute"],
  },
  {
    keyword: "distribute",
    inputValidators: ["itemAttribute"],
  },
  {
    keyword: "align",
    inputValidators: ["slotAttribute", "itemAttribute"],
  },
];

export default keywordConfigs;