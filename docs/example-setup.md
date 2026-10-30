# Example League Data and Rules

## Example Items

| ID  | Gender | Grade | Division | Height (in) | Practice Nights | Teammate Request | Coach Request | Coach's Child Request | Sibling | Eval Score |
| --- | ------ | ----- | -------- | ----------- | --------------- | ---------------- | ------------- | --------------------- | ------- | ---------- |
| P1  | M      | 4     | 4/5      | 54          | Mon, Wed        | P4               | None          | T1                    | P2      | 78         |
| P2  | M      | 1     | K/1      | 42          | Mon, Wed        | None             | None          | None                  | P1      | 45         |
| P3  | F      | 7     | 6/7/8    | 62          | Fri             | P6               | None          | T2                    | None    | 92         |
| P4  | M      | 5     | 4/5      | 56          | Tue             | P1               | T1            | None                  | None    | 105        |
| P5  | F      | K     | K/1      | 38          | Mon-Fri         | None             | None          | None                  | None    | 28         |
| P6  | F      | 7     | 6/7/8    | 61          | Mon             | P3               | T2            | None                  | None    | 88         |
| P7  | M      | 2     | 2/3      | 46          | Thu             | P8               | None          | None                  | None    | 64         |
| P8  | F      | 3     | 2/3      | 49          | Thu             | P7               | None          | None                  | None    | 71         |
| P9  | M      | 6     | 6/7/8    | 59          | Tue, Thu        | None             | None          | None                  | None    | 84         |
| P10 | F      | 8     | 6/7/8    | 64          | Wed             | P11              | None          | None                  | None    | 97         |
| P11 | M      | 8     | 6/7/8    | 67          | Wed             | P10              | None          | None                  | None    | 90         |
| P12 | F      | 5     | 4/5      | 55          | Mon, Fri        | None             | None          | None                  | None    | 73         |

## Example Slots

| ID  | Division Gender | Division | Practice Night | Gym Location       | Time Slot |
| --- | --------------- | -------- | -------------- | ------------------ | --------- |
| T1  | M               | 4/5      | Tuesday        | Main Gym - Court A | 6:00 PM   |
| T2  | F               | 6/7/8    | Thursday       | North Elementary   | 7:30 PM   |
| T3  | M               | 2/3      | Thursday       | Main Gym - Court B | 6:00 PM   |
| T4  | F               | K/1      | Monday         | South Elementary   | 5:30 PM   |
| T5  | F               | 4/5      | Wednesday      | North Elementary   | 6:00 PM   |

## Rule Schema Examples

### Hard Rules

#### 1. Match gender and division (supported)

```json
[
  {
    "name": "Match Gender",
    "rule": {
      "source": "items.gender",
      "operator": "equals",
      "target": "slots.divisionGender",
      "enforcement": "hard"
    }
  },
  {
    "name": "Match Division",
    "rule": {
      "source": "items.division",
      "operator": "equals",
      "target": "slots.division",
      "enforcement": "hard"
    }
  }
]
```

#### 2. Match available practice nights (supported)

```json
{
  "name": "Match Available Practice Nights",
  "rule": {
    "source": "items.practiceNights",
    "operator": "contains",
    "target": "slots.practiceNight",
    "enforcement": "hard"
  }
}
```

#### 3. Coach's child request (supported)

```json
{
  "name": "Honor Coach's Child Request",
  "rule": {
    "source": "items.coachChildRequest",
    "operator": "equals",
    "target": "slots.id",
    "enforcement": "hard"
  }
}
```

#### 4. Team size balance within a division (supported)

```json
{
  "name": "Balance Team Sizes",
  "source": "slots.assignedItems().count().max().subtract(slots.assignedItems().count().min())",
  "operator": "lessThan",
  "target": 2,
  "enforcement": "hard"
}
```

### Soft Rules

#### 5. Height distribution (supported)

```json
{
  "name": "Balance Average Heights",
  "source": "slots.assignedItems().height.average()",
  "operator": "approximates",
  "target": "items.height.average()",
  "enforcement": "soft",
  "priority": 80
}
```

```json
{
  "name": "Distribute Tallest Players",
  "source": "slots.assignedItems().height.max()",
  "operator": "approximates",
  "target": "items.height.custom(select the top 10 heights).average()",
  "enforcement": "soft",
  "priority": 80
}
```

#### 6. Teammate or carpool requests

```json
{
  "name": "Honor Teammate Requests",
  "rule": {
    "source": "items.teammateRequest",
    "operator": "contains",
    "target": "slots.assignedItems().id",
    "enforcement": "soft",
    "priority": 75
  }
}
```

#### 7. Coach requests (supported)

```json
{
  "name": "Honor Coach Requests",
  "rule": {
    "source": "items.coachRequest",
    "operator": "equals",
    "target": "slots.id",
    "enforcement": "soft",
    "priority": 60
  }
}
```

#### 8. Sibling practice night and gym match

```json
[
  {
    "name": "Match Sibling Practice Nights",
    "source": "items.sibling.lookup().assignedSlots().practiceNight",
    "operator": "equals",
    "target": "items.assignedSlots().practiceNight",
    "enforcement": "soft",
    "priority": 65
  },
  {
    "name": "Match Sibling Gym",
    "source": "items.sibling.lookup().assignedSlots().gymLocation",
    "operator": "equals",
    "target": "items.assignedSlots().gymLocation",
    "enforcement": "soft",
    "priority": 65
  }
]
```

#### 9. Evaluation score balance (supported)

```json
{
  "name": "Balance Evaluation Scores",
  "source": "slots.assignedItems().evalScore.average()",
  "operator": "approximates",
  "target": "items.evalScore.average()",
  "enforcement": "soft",
  "priority": 100
}
```
