# Rule JSON Schema

All rules share a top-level shape.

```json
{
  "action": "cluster | separate | assign | avoid | limit | balance",
  "label": "Short name shown in rule list",

  // 1-10, higher is more important. Or "hard" for hard rules.
  "priority": 1,
  "config": {}
}
```

## Selector (reused across verbs)

```json
{
  // "entries" or "slots" with no dot after to select all/any
  // "entries.column" or "slots.column" for specific column selection
  "parameter1": "",

  // "entries" or "slots" with no dot after to select all/any
  // Can be an array of values `["value1", "value2"]` or a single value to find specific matches.
  // Can also be a column selector like "entries.column" or "slots.column" to compare the two columns to find all matching values
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

Engine derives direction from the data configuration.

## Examples

### Science Olympiad: ranked preference column 1

```json
{
  "action": "assign",
  "label": "Prioritize 1st choice astronomy assignments",
  "priority": 10,
  "config": {
    "data": {
      "parameter1": "entries.1stchoice",
      "parameter2": ["Astronomy"]
    },
    "data2": {
      "parameter1": "slots.name",
      "parameter2": ["Astronomy"] 
    }
  }
}
```

### Sports: max 2 coaches per team

```json
{
  "action": "limit",
  "label": "Min 1, Max 2 coaches per team",
  "priority": "hard",
  "config": {
    "data": {
      "parameter1": "entries.role",
      "parameter2": ["coach"]
    },
    "data2": {
      "parameter1": "slots",
      "parameter2": "slots"
    },
    "min": 1,
    "max": 2
  }
}
```

### Volunteers: conflict group (slots per entry)

```json
{
  "action": "avoid",
  "label": "Jerry should not be assigned to the fifth slot",
  "priority": 8,
  "config": {
    "data": {
      "parameter1": "entries.name",
      "parameter2": ["Jerry"]
    },
    "data2": {
      "parameter1": "slots.id",
      "parameter2": ["5"]
    }
  }
}
```

## Validator checks

Before generation runs, check:

1. **Hard rule min/max sanity**: For each Limit, `min <= max`. If not, error.
2. **Hard rule capacity check**: Sum of all hard Limit mins across matching entries ≤ total available slot seats. If not, warn.
3. **Assign / Avoid collision**: Hard Assign and Hard Avoid on overlapping entry-slot pairs → error.
4. **Data is not empty**: Every rule's data must have at least one result.