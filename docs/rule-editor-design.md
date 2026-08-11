# Rule Editor Design

## Core Concept

The rule editor converts human-readable rule descriptions into the JSON format defined in `json-rule-schema.md`. The interface uses sentence templates from `generator.md` as a starting point.

---

## UI Layout

```
┌─────────────────────────────────────────────┐
│ Rule List (sidebar)                          │
│  - Rule 1: "Cluster coaches together"        │
│  - Rule 2: "Limit 2 coaches per slot"        │
│  - [+ Add Rule]                              │
├─────────────────────────────────────────────┤
│ Rule Editor (main area)                      │
│                                              │
│  [Action Dropdown]                           │
│  "I want to: [Cluster ▼]"                    │
│                                              │
│  [Dynamic form based on action type]         │
│                                              │
│  Sentence Preview:                           │
│  "I want to Cluster coaches together"        │
│                                              │
│  [Advanced: Show JSON ▼]                     │
│                                              │
│  [Save Rule] [Cancel]                        │
└─────────────────────────────────────────────┘
```

---

## Action Types & Forms

### 1. Cluster (Group Together)

**Sentence:** "I want to Cluster [data selector] together"

**Form fields:**
- Data selector (dropdown or custom selector builder)
  - Options: "all entries", "all slots", "entries where [column] = [value]"
  - Preview: shows count of matching items

**JSON output:**
```json
{
  "action": "cluster",
  "data": { "selector config here" }
}
```

---

### 2. Separate (Group Apart)

**Sentence:** "I want to Separate [data selector]"

**Form fields:**
- Data selector (same as Cluster)

**JSON output:**
```json
{
  "action": "separate",
  "data": { "selector config here" }
}
```

---

### 3. Limit (Require)

**Sentence:** "I want to Limit [data1 selector] per [data2 selector] to between [min] and [max]"

**Form fields:**
- Data selector 1 (entries side)
- Data selector 2 (slots side)
- Min number (input)
- Max number (input)

**JSON output:**
```json
{
  "action": "limit",
  "data": { "selector1 config" },
  "data2": { "selector2 config" },
  "min": 1,
  "max": 1
}
```

---

### 4. Assign (Place)

**Sentence:** "I want to Assign [data selector 1] to [data selector 2]"

**Form fields:**
- Data selector 1 (entries to place)
- Data selector 2 (slots to place them in)

**JSON output:**
```json
{
  "action": "assign",
  "data": { "selector1 config" },
  "data2": { "selector2 config" }
}
```

---

### 5. Avoid Assignment (Remove)

**Sentence:** "I want to Avoid Assignment of [data selector 1] to [data selector 2]"

**Form fields:**
- Data selector 1 (entries to avoid)
- Data selector 2 (slots to avoid)

**JSON output:**
```json
{
  "action": "avoid",
  "data": { "selector1 config" },
  "data2": { "selector2 config" }
}
```

---

### 6. Match (Find Correlation)

**Sentence:** "I want to Match [entry column] to [slot column]"

**Form fields:**
- Entry column dropdown (lists all entry columns)
- Slot column dropdown (lists all slot columns)

**JSON output:**
```json
{
  "action": "match",
  "entryColumn": "entries.Availability",
  "slotColumn": "slots.Availability"
}
```

---

### 7. Balance (Even Distribution)

**Sentence:** "I want to Balance [attribute] across [data selector]"

**Form fields:**
- Attribute (column name from entries)
- Data selector (what to balance across - usually slots)

**JSON output:**
```json
{
  "action": "balance",
  "attribute": "Skill",
  "data": { "selector config" }
}
```

---

## Selector Builder

All data selectors share the same structure. The selector builder lets users construct them without writing JSON.

### Basic selector types:

1. **All/Any** - matches everything
   - `"entries"` or `"slots"`

2. **Column equals value** - exact match
   - `"entries.Availability"` = `"Monday"`

3. **Column in list** - one of multiple values
   - `"entries.Skill"` = `["8", "9", "10"]`

4. **Column matches column** - cross-reference
   - `"entries.School"` = `"entries.School"` (same school)

### UI pattern:

```
Selector: [entries ▼] where [column dropdown] [= ▼] [value input]

Example rendered:
"entries where Availability = Monday"

Preview: (12 entries match)
```

**Advanced:** Add a [+ Add condition] button for AND/OR logic (MVP can skip this).

---

## Priority & Hard/Soft

**Separate from rule editor - global rule settings:**

```
Rule: [Cluster coaches together]
Priority: [5] (1-10, higher = more important)
Type: [Soft ▼] (Hard = must satisfy, Soft = preferred)

Hard rules: Must be satisfied or generation fails
Soft rules: Preferred but not required
```

**JSON adds to rule:**
```json
{
  "label": "Cluster coaches",
  "priority": 5,
  "hard": false,
  "action": "cluster",
  "data": { ... }
}
```

---

## Rule List Display

Each rule in the sidebar shows:
- Label (user-editable short name)
- Sentence preview
- Priority badge (1-10)
- Hard/Soft indicator (🔴 Hard / ⚪ Soft)

Example:
```
[Cluster coaches together]
"Limit 2 coaches per slot"
Priority: 5 | 🔴 Hard
```

---

## Validation

Before saving a rule, validate:
1. All required fields filled
2. Column names exist in data
3. Min ≤ Max for Limit rules
4. Selector returns at least one match (warn if empty)

Show validation errors inline next to the problematic field.

---

## Implementation Priority

**Build this first:**
1. Selector builder (simplest, most reusable)
2. One rule type (Limit is good - shows the pattern)
3. Priority/hard-soft toggle
4. Rule list management (add, edit, delete, reorder)
5. Remaining rule types (6 more)

**Why this order:** The selector is used everywhere. Once you build it once, all other rule types reuse it. Limit rules are common and show the "two selector + min/max" pattern clearly.

---

## Future Enhancements

- AI assistant: "Describe your rule" → generates selector + rule JSON
- Natural language preview toggle: show JSON vs sentence
- Rule templates per preset (pre-configured rules for sports, science olympiad, etc.)
- Rule groups (apply multiple rules at once)
- Import/export rules as JSON