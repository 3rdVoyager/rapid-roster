# Current Keyword-Based Rule Schema

This is the current rule design for RapidRoster. It features a small catalog of
specific, understandable action verbs.

## Rule Shape

Each rule names one specific evaluator action verb and supplies only the fields or
values that evaluator needs. The action verb defines the relationship and
calculation; the rule builder supplies the selected attributes or numbers.

```json
{
  "id": "R1",
  "name": "Match Gender",
  "description": "An item's gender must match its assigned slot.",
  "enforcement": "hard",
  "keyword": "match",
  "inputs": ["gender", "divisionGender"]
}
```

Soft rules also include `priority` from 1 to 100. A new supported
behavior is added by registering a new action verb in the engine.

## Keyword Catalog

The current schema uses six action verbs. Their inputs identify selected
attributes or numbers; the action verb supplies the traversal and comparison
behavior.

### `match`

Matches an item attribute to an assigned slot attribute.

```json
{
  "keyword": "match",
  "inputs": ["gender", "divisionGender"]
}
```

The input order is `[itemAttribute, slotAttribute]`.

### `group`

Matches an item attribute to another item's attribute.

```json
{
  "keyword": "group",
  "inputs": ["ID", "teammateRequest"]
}
```

The input order is `[itemAttribute, itemAttribute]`.

### `limit`

Restricts the number of items assigned to each slot.

```json
{
  "keyword": "limit",
  "inputs": ["max", 10, ["Thunder", "Celtics"]]
}
```

The inputs are `[limitType, number, slotTargets]`. `limitType` is either
`"min"` or `"max"`. `slotTargets` is either `"all"` or an array of slot IDs.
Use `"all"` when the limit applies to every slot; otherwise, it applies only
to the listed slots.

### `balance`

Balances a numeric attribute across groups, using each group's average for that attribute.

```json
{
  "keyword": "balance",
  "inputs": ["height", "all"]
}
```

The inputs are `[numericAttribute, slotTargets]`. `slotTargets` is either
`"all"` or an array of slot IDs. Balance is calculated only across the
selected slots, including the average used as the comparison target.

### `distribute`

Distributes values across groups so high and low values are spread apart rather
than concentrated together.

```json
{
  "keyword": "distribute",
  "inputs": ["height"]
}
```

The input is `[numericAttribute]`.

### `align`

Follows each item's sibling relationship and compares an attribute on the
assigned slots.

```json
{
  "keyword": "align",
  "inputs": ["practiceNight", "sibling"]
}
```

The input order is `[assignedSlotAttribute, relationshipAttribute]`.

## User-Facing Rule Sentences

The rule builder should present these sentences instead of exposing keyword
names or JSON directly.

| Rule | User-facing sentence                                                                               |
| ---- | -------------------------------------------------------------------------------------------------- |
| R1   | `Match` each item's `Gender` to its assigned slot's `Division Gender`.                             |
| R2   | `Match` each item's `Division` to its assigned slot's `Division`.                                  |
| R3   | `Match` each item's `Practice Night` to its assigned slot's `Practice Night`.                      |
| R4   | `Match` each item's `Coach Child Request` to its assigned slot's `ID`.                             |
| R5   | `Limit` `all` to at least `9` assigned items.                                                    |
| R6   | `Limit` `(custom selection)` slots to at most `10` assigned items.                                               |
| R7   | `Limit` `(custom selection)` slots to at most `11` assigned items.                                               |
| R8   | `Balance` the average item `Height` across all slots.                                                |
| R9   | `Distribute` item `Height` values evenly across all slots.                                           |
| R10  | `Group` each item with items whose `ID`s are in its `Teammate Requests`.                             |
| R11  | `Match` each item's `Coach Request` to its assigned slot's `ID`.                                     |
| R12  | `Align` each item's assigned slot's `Practice Night` with its `Sibling`'s.                           |
| R13  | `Align` each item's assigned slot's `Gym Location` with its `Sibling`'s.                             |
| R14  | `Balance` the average item `Evaluation Score` across all slots.                                      |

## Engine Contract

Every keyword has its own input validator and evaluator, but all evaluators
return the same result shape:

```json
{
  "score": 9.6,
  "percentage": 0.8,
  "repetitions": 12,
  "violations": []
}
```