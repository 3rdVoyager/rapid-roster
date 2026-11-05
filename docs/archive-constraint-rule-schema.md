# Archived Constraint Rule Schema Proposal

> Archived exploration. The current rule design is documented in
> [keyword-rule-schema.md](keyword-rule-schema.md).

This proposal was generated as an alternative to the current keyword schema.
It is retained for comparison and future reference. Suggested by GPT 5.6 Sol.

## Main Idea

Rules should describe a small number of assignment problems rather than act as
a general-purpose query language. Each rule has a `constraint.kind`, and the
engine has one clear evaluator for each kind.

The example league needs only three kinds:

1. `assignment`: compare the item and slot on each assignment edge.
2. `reference`: follow IDs stored on a record and require a relationship.
3. `balance`: compare grouped measurements across slots.

This is less flexible than a free-form expression tree, but it is easier to
validate, explain in a rule builder, evaluate, and test.

## Common Rule Shape

```json
{
  "id": "R1",
  "name": "Match Gender",
  "description": "An item's gender must match its assigned slot.",
  "enforcement": "hard",
  "constraint": {}
}
```

Soft rules add `weight` from 1 to 100. The UI could still label this value
"priority"; `weight` describes how the engine uses it.

## 1. Assignment Constraints

An assignment constraint runs once for every actual item-slot relationship.

```json
{
  "id": "R1",
  "name": "Match Gender",
  "description": "An item's gender must match its assigned slot.",
  "enforcement": "hard",
  "constraint": {
    "kind": "assignment",
    "left": { "record": "item", "field": "gender" },
    "operator": "equals",
    "right": { "record": "slot", "field": "divisionGender" }
  }
}
```

This directly supports:

- R1: item `gender` equals slot `divisionGender`
- R2: item `division` equals slot `division`
- R3: item `practiceNights` contains slot `practiceNight`

## 2. Reference Constraints

A reference constraint reads IDs from a field and tests a relationship between
the current record and the referenced records. Empty reference fields are
non-applicable; unknown IDs are validation errors.

```json
{
  "id": "R4",
  "name": "Honor Coach's Child Request",
  "description": "The item must be assigned to every requested slot.",
  "enforcement": "hard",
  "constraint": {
    "kind": "reference",
    "from": "item",
    "referenceField": "coachChildRequest",
    "references": "slot",
    "quantifier": "all",
    "require": { "relation": "isAssignedTo" }
  }
}
```

The same kind handles item-to-item relationships:

```json
{
  "id": "R10",
  "name": "Match Sibling Practice Nights",
  "description": "Sibling items should have an assigned practice night in common.",
  "enforcement": "soft",
  "weight": 65,
  "constraint": {
    "kind": "reference",
    "from": "item",
    "referenceField": "sibling",
    "references": "item",
    "quantifier": "all",
    "require": {
      "relation": "assignedSlotFieldOverlaps",
      "field": "practiceNight"
    }
  }
}
```

This supports:

- R4 and R9 with `isAssignedTo`
- R8 with `sharesSlot`
- R10 and R11 with `assignedSlotFieldOverlaps`

`quantifier` makes multi-value requests explicit. `all` means every referenced
record must satisfy the relationship; `any` means at least one must.

## 3. Balance Constraints

A balance constraint measures each group and then evaluates the measurements
together. The grouping, measurement, and goal remain separate.

Team-size balance:

```json
{
  "id": "R5",
  "name": "Balance Team Sizes",
  "description": "Slot sizes must differ by no more than one.",
  "enforcement": "hard",
  "constraint": {
    "kind": "balance",
    "groups": "slots",
    "measure": {
      "from": "assignedItems",
      "aggregate": "count"
    },
    "goal": {
      "type": "rangeAtMost",
      "value": 1
    }
  }
}
```

Average-height balance:

```json
{
  "id": "R6",
  "name": "Balance Average Heights",
  "description": "Each slot's average height should approach the overall average.",
  "enforcement": "soft",
  "weight": 80,
  "constraint": {
    "kind": "balance",
    "groups": "slots",
    "measure": {
      "from": "assignedItems",
      "field": "height",
      "aggregate": "average"
    },
    "goal": {
      "type": "minimizeDeviation",
      "target": {
        "from": "items",
        "field": "height",
        "aggregate": "average"
      },
      "normalizeBy": "dataRange"
    }
  }
}
```

Selected-item distribution:

```json
{
  "id": "R7",
  "name": "Distribute Tallest Players",
  "description": "Selected items should be spread evenly across slots.",
  "enforcement": "soft",
  "weight": 80,
  "constraint": {
    "kind": "balance",
    "groups": "slots",
    "measure": {
      "from": "assignedItems",
      "filter": {
        "idIn": ["P1", "P3", "P4", "P6"]
      },
      "aggregate": "count"
    },
    "goal": {
      "type": "minimizeRange"
    }
  }
}
```

This supports:

- R5 with assigned-item count and `rangeAtMost`
- R6 with average height and `minimizeDeviation`
- R7 with filtered assigned-item count and `minimizeRange`
- R12 with average evaluation score and `minimizeDeviation`

## Evaluation and Scoring

- Assignment and reference constraints return one result per applicable
  comparison.
- Hard rules are legal only when they have zero failed comparisons.
- Binary soft rules score `passed / applicable`.
- Numeric balance rules produce a normalized score from 0 to 1. A rule must
  declare its normalization method so inches, evaluation points, and counts are
  not silently treated as equivalent.
- The final soft score is `sum(weight × ruleScore)`.
- Diagnostics include applicable, passed, failed, raw measurement, and
  normalized score values.

## How All Example Rules Fit

1. Gender: `assignment`
2. Division: `assignment`
3. Practice-night availability: `assignment`
4. Coach's child: `reference` to a slot with `isAssignedTo`
5. Team sizes: `balance` using assigned-item counts
6. Average height: `balance` using assigned-item averages
7. Tallest players: `balance` using filtered assigned-item counts
8. Teammates: `reference` to items with `sharesSlot`
9. Coach request: `reference` to a slot with `isAssignedTo`
10. Sibling practice night: `reference` with slot-field overlap
11. Sibling gym: `reference` with slot-field overlap
12. Evaluation score: `balance` using assigned-item averages

## Historical Trade-Off

The composable schema is more reusable: users can construct new
operations from collections, loops, lookups, calculations, and operators.
However, the evaluator must interpret a small programming language, and invalid
or ambiguous combinations are harder to prevent.

This proposal intentionally limits composition. It makes every supported rule
obvious and gives the rule builder a predictable form for each kind. Supporting
a genuinely new behavior would require adding a new constraint kind to the
engine, but existing rule JSON would remain stable.
