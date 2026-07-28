# Rule JSON Schema

All rules share a top-level shape.

```json
{
  "label": "Short name shown in rule list",
  // 1-10, higher is more important. Or "hard" for hard rules.
  "priority": 1,
  "action": "cluster | separate | assign | avoid | limit | match | balance",
  "config": {}
}
```

## Selector (reused across actions)

```json
{
  // "entries" or "slots" with no dot after to select all/any
  // "entries.column" or "slots.column" for specific column selection
  "parameter1": "",

  // "entries" or "slots" with no dot after to select all/any
  // Can be an array of values `["value1", "value2"]` or a single value to find specific matches.
  // Can be a column selector like "entries.column" or "slots.column" to compare the two columns to find all matching values
  "parameter2": ""
  }
```

## Actions

### Cluster and Separate

```json
{
  "data": {},
}
```

### Assign and Avoid

```json
{
  "data": {},
  "data2": {}
}
```

### Limit

```json
{
  "data": {},
  "data2": {},
  "min": 1,
  "max": 1
}
```

`direction` is inferred from the selectors. One side must reference entries, the other slots.

### Match

```json
{
  "entryColumn": "entries.1",
  "slotColumn": "slots.name"
}
```

Match is an exception to the selector pattern. Instead of returning sets, it correlates values from two columns. The engine prefers placements where the entry column value equals the slot column value.

### Balance

```json
{
  "attribute": "",
  "data": {}
}
```

## Validator checks

Before generation runs, check:

1. **Hard rule min/max sanity**: For each Limit, `min <= max`. If not, error.
2. **Hard rule capacity check**: Sum of all hard Limit mins across matching entries ≤ total available slot seats. If not, warn.
3. **Assign / Avoid collision**: Hard Assign and Hard Avoid on overlapping entry-slot pairs → error.
4. **Data is not empty**: Every rule's data must have at least one result.