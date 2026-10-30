# Roster Model and Search

## Core Model

- **Items** are assigned to **slots** and vice versa.
- They are the two sides of a generic assignment graph.
- Each item and slot may set minimum and maximum assignment counts.
- This supports one-to-one, one-to-many, and many-to-many assignments.
- The engine does not attach domain meanings such as player, event, or team.

## Data Schema

Items and slots may contain arbitrary named fields. Field definitions use a
small set of types:

- `string`: equality, membership, and pattern comparisons
- `number`: totals, averages, ranges, and distribution

Every record has a stable `id`. Rules define the dataset and scope in which an
string or other value is evaluated. Types only validate data and determine which
operators are available. Field names provide the domain meaning, so `height`,
`skill`, and `score` can all remain numbers.

Every type natively supports one or more values. Importers may read delimited
values, but normalized data stores multiple values as arrays. Ranges are an
operation over values or paired fields rather than a separate type. Yes/no
values may use strings and gain normalization later if needed. Calendar and
schedule data can initially use strings such as `Mon`, `Tue`, and `Wed`, or
numbers when ordering and arithmetic are needed.

## Rule Schema

Special attributes:

- `slots.assignedItems()`: returns the items assigned to the slot.
- `items.assignedSlots()`: returns the slots assigned to the item.

`attributeOperator`:

- `.count()`: returns the number of values in the column.
- `.sum()`: returns the sum of the values in the column.
- `.average()`: returns the average of the values in the column.
- `.max()`: returns the maximum value in the column.
- `.min()`: returns the minimum value in the column.
- `.custom()`: returns a custom selection of values from the column.
- `.lookup()`: returns the item or slot that matches an ID.

`attributeSelector`:

- `items.*`: returns the item attribute to evaluate.
- `slots.*`: returns the slot attribute to evaluate.

Arithmetic methods operate on numeric selector results and return a numeric
result:

- `add(value)`: add a number or numeric selector.
- `subtract(value)`: subtract a number or numeric selector.
- `multiplyBy(value)`: multiply by a number or numeric selector.
- `divideBy(value)`: divide by a number or numeric selector.

Arithmetic methods may be chained. Division by zero is invalid, and methods
are only available after a numeric value or numeric aggregate:

```text
items.count().divideBy(slots.count()).add(1)
```

Every rule has a common envelope:

- `source`: the source field to evaluate. Accepts an `attributeSelector`.
- `operator`: any can be negated by adding "not" to the operand. Accepts:
  - `contains (any)`: awards priority points if the first field contains a value in the second field.
  - `equals (any)`: awards priority points if the first field equals the second field entirely.
  - `approximates (any)`: awards priority points if based on how close the first field is to the second field.
  - `lessThan (numeric)`: awards priority points if the first field is less than the second field.
  - `greaterThan (numeric)`: awards priority points if the first field is greater than the second field.
- `target`: the target field to evaluate. Accepts an `attributeSelector`.
- `enforcement`: `hard` or `soft`
- `priority`: 1 to 100 for soft rules.

## Example

See [example-setup.md](example-setup.md) for the example data tables and league
rules.

### Hard Rules

Hard rules define legality. Each evaluator returns a non-negative violation
measure; zero means satisfied. All hard rules must reach zero before soft-rule
optimization begins.

### Soft Rules

Soft rules return satisfaction from 0 to 1. Binary rules may return only 0 or 1,
while rules such as balancing can report partial improvement.

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
