export type RecordId = string | number;

export interface DataRecord {
  id: RecordId;
  name?: string;
  [attribute: string]: any;
}

export type Item = DataRecord;
export type Slot = DataRecord;

export interface Rule {
  id: RecordId;
  name?: string;
  description?: string;
  enforcement: "hard" | "soft";
  priority?: number;
  keyword: string;
  inputs: any[];
}

export type Assignments = Record<string, RecordId[]>;

export interface Model {
  items: Item[];
  slots: Slot[];
  rules: Rule[];
  assignments: {
    slotAssignments: Assignments;
    itemAssignments: Assignments;
  };
}

export interface RuleViolation {
  ruleId?: RecordId;
  sourceId?: RecordId;
  targetId?: RecordId;
  [detail: string]: any;
}

export interface RulePenalty {
  ruleId: RecordId;
  name?: string;
  priority: number;
  percentage: number;
  score: number;
  repetitions: number;
  penalty: number;
  weightedPenalty: number;
  violationCount: number;
}

export interface Evaluation {
  hardPenalty: number;
  hardViolations: RuleViolation[];
  softPenalty: number;
  softViolations: RuleViolation[];
  softRulePenalties: RulePenalty[];
}

export interface GenerationResult {
  assignments: Assignments;
  evaluation: Evaluation;
  model?: Model;
}

export interface ProjectData {
  items: Item[];
  slots: Slot[];
  rules: Rule[];
}
