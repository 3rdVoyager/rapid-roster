# Roster Model and Search

## Core Model

- **Items** are assigned to **slots** and vice versa.
- They are the two sides of a generic assignment graph.
- This supports one-to-one, one-to-many, and many-to-many assignments.
- The engine does not attach domain meanings such as player, event, or team.
- Assignments are stored separately as slot IDs mapped to item ID arrays.

## Data Schema

Items and slots may contain arbitrary named fields. Values use a small set of
types:

- `string`: equality and membership comparisons
- `number`: totals, averages, ranges, and distribution

Every record has a stable ID that is unique across both items and slots. Types
are inferred from JSON values rather than declared in the data. Field names
provide the domain meaning, so `height`, `skill`, and `score` remain numbers.

Every type natively supports one or more values. Importers may read delimited
values, but normalized data stores multiple values as arrays. Ranges are an
operation over values or paired fields rather than a separate type. Yes/no
values may use strings and gain normalization later if needed. Calendar and
schedule data can initially use strings such as `Mon`, `Tue`, and `Wed`, or
numbers when ordering and arithmetic are needed.

## Example Data

These tables are illustrative only. The engine does not require sports-specific
columns; any named fields can be used by a keyword.

| ID  | Gender | Grade | Division | Height | Practice Nights | Teammate Request | Coach Request | Coach's Child Request | Sibling | Eval Score |
| --- | ------ | ----- | -------- | -----: | --------------- | ---------------- | ------------- | --------------------- | ------- | ---------: |
| P1  | M      | 4     | 4/5      |     54 | Mon, Wed        | P4               | None          | T1                    | P2      |         78 |
| P2  | M      | 1     | K/1      |     42 | Mon, Wed        | None             | None          | None                  | P1      |         45 |
| P3  | F      | 7     | 6/7/8    |     62 | Fri             | P6               | None          | T2                    | None    |         92 |
| P4  | M      | 5     | 4/5      |     56 | Tue             | P1               | T1            | None                  | None    |        105 |
| P5  | F      | K     | K/1      |     38 | Mon-Fri         | None             | None          | None                  | None    |         28 |
| P6  | F      | 7     | 6/7/8    |     61 | Mon             | P3               | T2            | None                  | None    |         88 |
| P7  | M      | 2     | 2/3      |     46 | Thu             | P8               | None          | None                  | None    |         64 |
| P8  | F      | 3     | 2/3      |     49 | Thu             | P7               | None          | None                  | None    |         71 |
| P9  | M      | 6     | 6/7/8    |     59 | Tue, Thu        | None             | None          | None                  | None    |         84 |
| P10 | F      | 8     | 6/7/8    |     64 | Wed             | P11              | None          | None                  | None    |         97 |
| P11 | M      | 8     | 6/7/8    |     67 | Wed             | P10              | None          | None                  | None    |         90 |
| P12 | F      | 5     | 4/5      |     55 | Mon, Fri        | None             | None          | None                  | None    |         73 |

| ID  | Division Gender | Division | Practice Night | Gym Location       | Time Slot |
| --- | --------------- | -------- | -------------- | ------------------ | --------- |
| T1  | M               | 4/5      | Tue            | Main Gym - Court A | 6:00 PM   |
| T2  | F               | 6/7/8    | Thu            | North Elementary   | 7:30 PM   |
| T3  | M               | 2/3      | Thu            | Main Gym - Court B | 6:00 PM   |
| T4  | F               | K/1      | Mon            | South Elementary   | 5:30 PM   |
| T5  | F               | 4/5      | Wed            | North Elementary   | 6:00 PM   |

Assignments remain separate from records and are persisted in compact slot-keyed
form:

```json
{
  "T1": ["P1", "P4"],
  "T2": ["P3"]
}
```

## Current Rule Model

Rules use one specific keyword rather than a general-purpose expression
language. The keyword performs the traversal, assignment lookup, comparison,
aggregation, and scoring required by that rule.

```json
{
  "id": "R1",
  "name": "Match Gender",
  "description": "An item's gender must match its assigned slot.",
  "enforcement": "hard",
  "keyword": "itemFieldEqualsAssignedSlotField",
  "inputs": {
    "itemField": "gender",
    "slotField": "divisionGender"
  }
}
```

Soft rules add `priority` from 1 to 100. Keywords currently cover assignment
field comparisons, requested assignments, count balancing, average balancing,
selected-item distribution, teammate relationships, and sibling relationships.
See [keyword-rule-schema.md](keyword-rule-schema.md) for the current catalog
and input definitions.

The keyword registry gives every rule a common validation and evaluation
interface. Adding a new supported behavior means adding a keyword, its input
validator, evaluator, tests, and rule-builder form.

## Rule Evaluation

### Hard Rules

Each applicable leaf comparison returns satisfaction from 0 to 1. A rule
reports `comparisonCount`, `satisfactionTotal`, `violationTotal`, `applicable`,
and its normalized average score. Empty or non-applicable values are skipped.

Hard rules define legality. A result is legal only when
`violationTotal === 0`. All hard rules must be legal before soft-rule
optimization begins.

### Soft Rules

Binary comparisons return 0 or 1, while rules such as balancing may return
partial satisfaction.

```text
soft score = sum(priority × satisfaction)
```

## Search Algorithm

1. Validate and normalize the data and rules.
2. Build a random assignment, preserving simple limits when practical.
3. **Repair:** target violated hard rules with moves and swaps until every hard

   violation is accounted for.

4. Restart from a new random assignment if the repair budget is exhausted.
5. **Optimize:** propose legal moves and swaps and keep soft-score improvements.
6. Stop after the optimization budget is exhausted.
7. Repeat to collect unique legal results until the requested count or restart limit is

   reached.

8. Return the best results, scores, and rule-by-rule diagnostics.

Suggested search settings:

```text
requestedSolutions, maxRestarts, maxRepairIterations,
maxOptimizationIterations, randomSeed
```

## User-Facing Rules

Users should choose sentence-like templates rather than edit the raw schema:

- Only assign items where `[division]` matches the slot's `[division]`.
- Keep the average `[height]` difference between slots below `[10]`.
- Assign an item with the IDs in `[requested teammates]`.
- Assign items only when `[availability]` overlaps the slot's `[time]`.

The rule builder should show only templates and operators compatible with the
selected fields.

## Important Limits

- Exhausting a heuristic search means **no solution found**, not proof that no
  solution exists.
- Repair and optimization can become trapped in local optima.
- Equal-cost repair moves, targeted moves, and random restarts help escape them.
- Seeded randomness makes failures reproducible.
