# Current Keyword-Based Rule Schema

This is the current rule design for RapidRoster. It favors a small catalog of
specific, understandable action verbs.

## Rule Shape

Each rule names one specific evaluator action verb and supplies only the fields or
values that evaluator needs.

```json
{
  "id": "R1",
  "name": "Match Gender",
  "description": "An item's gender must match its assigned slot.",
  "enforcement": "hard",
  "keyword": "match",
  "inputs": {
    "source": {
      "collection": "items",
      "attribute": "gender"
    },
    "target": {
      "collection": "slots",
      "attribute": "divisionGender"
    }
  }
}
```

Rule JSON does not contain selectors, nested loops, calculations, or generic
operators. Soft rules also include `priority` from 1 to 100. A new supported
behavior is added by registering a new action verb in the engine.

## Keyword Catalog

The current schema uses four action verbs. Their inputs identify the values
being operated on; the action verb supplies the traversal and comparison behavior.

### `match`

Matches values across an assignment or relationship. It covers scalar equality,
an array against a value, and each value in one array against another array.
This supports R1-R4 and R8-R11.

```json
{
  "keyword": "match",
  "inputs": {
    "source": {
      "collection": "items",
      "attribute": "gender"
    },
    "target": {
      "collection": "slots",
      "attribute": "divisionGender"
    }
  }
}
```

### `limit`

Limits the difference between grouped item counts. The MVP supports the
assigned-item count limit used by R5.

```json
{
  "keyword": "limit",
  "inputs": {
    "source": "items",
    "target": "slots"
  }
}
```

### `balance`

Balances a numeric value across groups, normally using each group's average.
This supports R6 and R12.

```json
{
  "keyword": "balance",
  "inputs": {
    "source": {
      "collection": "items",
      "attribute": "height"
    },
    "target": "slots"
  }
}
```

### `distribute`

Distributes values across groups so high and low values are spread apart rather
than concentrated together. This supports R7.

```json
{
  "keyword": "distribute",
  "inputs": {
    "source": {
      "collection": "items",
      "attribute": "height"
    },
    "target": "slots"
  }
}
```

## User-Facing Rule Sentences

The rule builder should present these sentences instead of exposing keyword
names or JSON directly.

| Rule | User-facing sentence                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| R1   | `Match` each `item`'s `Gender` to its assigned `slot`'s `Division Gender`.                                      |
| R2   | `Match` each `item`'s `Division` to its assigned `slot`'s `Division`.                                           |
| R3   | `Match` each `item`'s `Practice Nights` to its assigned `slot`'s `Practice Night`.                              |
| R4   | `Match` each `item`'s `Coach Child Request` to its assigned `slot`'s `ID`.                                      |
| R5   | `Limit` the difference in the count of `item`'s in each `slot` to be less than 1.                               |
| R6   | `Balance` the average `item` `Height` across all `slot`'s.                                                      |
| R7   | `Distribute` the values of each `item`'s `Height` evenly across all `slot`'s.                                   |
| R8   | `Match` each `item`'s `Teammate Requests` to its co-assigned `item`'s `ID`.                                     |
| R9   | `Match` each `item`'s `Coach Request` to its assigned `slot`'s `ID`.                                            |
| R10  | `Match` each `item`'s `Sibling`'s assigned `slot`'s `Practice Night` to its assigned `slot`'s `Practice Night`. |
| R11  | `Match` each `item`'s `Sibling`'s assigned `slot`'s `Gym Location` to its assigned `slot`'s `Gym Location`.     |
| R12  | `Balance` the average `item` `Evaluation Score` across all `slot`'s.                                            |

## Engine Contract

Every keyword has its own input validator and evaluator, but all evaluators
return the same result shape:

```json
{
  "score": 40,
  "percentage": 0.8,
  "repetitions": 12,
  "violations": 2
}
```

Common behavior remains consistent:

- Missing optional requests are non-applicable.
- Unknown referenced IDs are validation errors.
- Multi-value fields are normalized to arrays.
- Hard rules are legal only when `violations` is zero.
- Soft contribution is `priority × score`.
- Each keyword documents how it handles empty assignments and numeric
  normalization.

## Design Boundaries

The keyword schema is simpler to execute and validate because each rule
dispatches directly to known code. Its JSON is also easier to generate from a
form and easier to explain in diagnostics.

The trade-off is user composability. Users can combine the inputs supported by
a keyword, but they cannot create a genuinely new operation from primitives.
Developer extensibility remains straightforward because a new operation is one
new registry entry rather than a change to the schema language.

This approach is strongest if the real roster rules settle into a manageable
catalog of reusable patterns. The archived composable schema is more flexible
when users must invent new rule logic without waiting for a new keyword.
