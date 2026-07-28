# Rule Examples

Review each scenario. If the rule does not match your expectation, refine the rule shape or your expectation.

---

## Science Olympiad: ranked preferences

### 1. 1st choice

**Goal:** Prefer entries in their 1st choice event.

```json
{
  "action": "match",
  "label": "1st choice",
  "priority": 10,
  "config": {
    "entryColumn": "entries.1",
    "slotColumn": "slots.name"
  }
}
```

### 2. 2nd choice

```json
{
  "action": "match",
  "label": "2nd choice",
  "priority": 8,
  "config": {
    "entryColumn": "entries.2",
    "slotColumn": "slots.name"
  }
}
```

---

## Sports

### 3. Max 2 coaches per team

**Goal:** At most 2 entries with role=coach in each slot.

```json
{
  "action": "limit",
  "label": "Max 2 coaches per team",
  "priority": "hard",
  "config": {
    "data": {
      "parameter1": "entries.role",
      "parameter2": ["coach"]
    },
    "data2": {
      "parameter1": "slots",
      "parameter2": ""
    },
    "min": 0,
    "max": 2
  }
}
```

### 4. Balance skill across all teams

**Goal:** Keep average skill roughly even across all slots.

```json
{
  "action": "balance",
  "label": "Balance skill",
  "priority": 9,
  "config": {
    "attribute": "skill",
    "data": {
      "parameter1": "entries",
      "parameter2": ""
    }
  }
}
```

### 5. Teammate requests together

**Goal:** Keep matched teammate requests together.

```json
{
  "action": "cluster",
  "label": "Teammate requests",
  "priority": 8,
  "config": {
    "data": {
      "parameter1": "entries.teammate_requests",
      "parameter2": ["entries.id"]
    }
  }
}
```

---

## Volunteers

### 6. Match strengths to needed strengths

```json
{
  "action": "match",
  "label": "Match strengths",
  "priority": 8,
  "config": {
    "entryColumn": "entries.strengths",
    "slotColumn": "slots.needed_strengths"
  }
}
```

### 7. Availability match

```json
{
  "action": "match",
  "label": "Availability match",
  "priority": 6,
  "config": {
    "entryColumn": "entries.availability",
    "slotColumn": "slots.time_block"
  }
}
```

---

## Classroom

### 8. Friends together

**Goal:** Keep specific entries together regardless of slot.

```json
{
  "action": "cluster",
  "label": "Friends together",
  "priority": 5,
  "config": {
    "data": {
      "parameter1": "entries.id",
      "parameter2": ["alice", "bob"]
    }
  }
}
```

### 9. Separate by school

**Goal:** Spread entries so no two from the same school share a slot.

```json
{
  "action": "separate",
  "label": "Different schools apart",
  "priority": 5,
  "config": {
    "data": {
      "parameter1": "entries.school",
      "parameter2": ""
    }
  }
}
```