# Current Keyword-Based Rule Schema

This is the current rule design for RapidRoster. It favors a small catalog of
specific, understandable keywords over a general-purpose expression language.

## Rule Shape

Each rule names one specific evaluator keyword and supplies only the fields or
values that evaluator needs. The keyword performs collection traversal,
assignment lookup, comparison, aggregation, and scoring internally.

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

Rule JSON does not contain selectors, nested loops, calculations, or generic
operators. Soft rules also include `priority` from 1 to 100. A new supported
behavior is added by registering a new keyword in the engine.

## Keyword Catalog

### `itemFieldEqualsAssignedSlotField`

For every assignment, compare one item field with one slot field.

```json
{
    "keyword": "itemFieldEqualsAssignedSlotField",
  "inputs": {
    "itemField": "division",
    "slotField": "division"
  }
}
```

User-facing label: **Match item and assigned-slot fields**.

Supports R1 and R2.

### `itemFieldContainsAssignedSlotField`

For every assignment, require an item array to contain the slot value.

```json
{
  "keyword": "itemFieldContainsAssignedSlotField",
  "inputs": {
    "itemField": "practiceNights",
    "slotField": "practiceNight"
  }
}
```

User-facing label: **Require the item field to include the assigned-slot value**.

Supports R3.

### `itemIsAssignedToEveryRequestedSlot`

Read one or more slot IDs from an item field and require all of them to be
assigned to that item. An empty request is non-applicable.

```json
{
  "keyword": "itemIsAssignedToEveryRequestedSlot",
  "inputs": {
    "requestField": "coachChildRequest"
  }
}
```

User-facing label: **Assign the item to every requested slot**.

Supports R4 and R9.

### `assignedItemCountDifferenceIsAtMost`

Count assigned items in every slot and limit the difference between the largest
and smallest counts.

```json
{
  "keyword": "assignedItemCountDifferenceIsAtMost",
  "inputs": {
    "difference": 1
  }
}
```

User-facing label: **Keep assigned-item counts within a limit**.

Supports R5.

### `slotAssignedItemFieldAverageIsCloseToOverallItemAverage`

For every slot, compare the average assigned-item value with the average across
all items. The evaluator normalizes deviation using the field's data range.

```json
{
  "keyword": "slotAssignedItemFieldAverageIsCloseToOverallItemAverage",
  "inputs": {
    "field": "height"
  }
}
```

User-facing label: **Balance each slot's average against the overall average**.

Supports R6 and R12.

### `selectedItemsAreEvenlyDistributedAcrossSlots`

Count selected items in each slot and reward the smallest possible count
spread.

```json
{
  "keyword": "selectedItemsAreEvenlyDistributedAcrossSlots",
  "inputs": {
    "itemIds": ["P1", "P3", "P4", "P6"]
  }
}
```

User-facing label: **Distribute selected items evenly across slots**.

Supports R7. A rule builder or importer may calculate the selected IDs before
creating the rule.

### `itemSharesAssignedSlotWithReferencedItems`

Read item IDs from an item field and require every referenced item to share at
least one slot with the current item.

```json
{
  "keyword": "itemSharesAssignedSlotWithReferencedItems",
  "inputs": {
    "referenceField": "teammateRequest"
  }
}
```

User-facing label: **Keep the item with its requested teammates**.

Supports R8.

### `itemAndReferencedItemsShareAssignedSlotFieldValue`

Read item IDs from an item field and require their assigned slots to share at
least one value for the selected slot field.

```json
{
  "keyword": "itemAndReferencedItemsShareAssignedSlotFieldValue",
  "inputs": {
    "referenceField": "sibling",
    "slotField": "practiceNight"
  }
}
```

User-facing label: **Match an item's assigned-slot field with its references**.

Supports R10 and R11.

## Example Rule Coverage

The twelve example rules require eight keywords:

1. R1: `itemFieldEqualsAssignedSlotField` with `gender` and `divisionGender`
2. R2: `itemFieldEqualsAssignedSlotField` with `division` and `division`
3. R3: `itemFieldContainsAssignedSlotField` with `practiceNights` and
   `practiceNight`
4. R4: `itemIsAssignedToEveryRequestedSlot` with `coachChildRequest`
5. R5: `assignedItemCountDifferenceIsAtMost` with a difference of `1`
6. R6: `slotAssignedItemFieldAverageIsCloseToOverallItemAverage` with `height`
7. R7: `selectedItemsAreEvenlyDistributedAcrossSlots` with selected item IDs
8. R8: `itemSharesAssignedSlotWithReferencedItems` with `teammateRequest`
9. R9: `itemIsAssignedToEveryRequestedSlot` with `coachRequest`
10. R10: `itemAndReferencedItemsShareAssignedSlotFieldValue` with `sibling` and
    `practiceNight`
11. R11: `itemAndReferencedItemsShareAssignedSlotFieldValue` with `sibling` and
    `gymLocation`
12. R12: `slotAssignedItemFieldAverageIsCloseToOverallItemAverage` with
    `evaluationScore`

## Engine Contract

Every keyword has its own input validator and evaluator, but all evaluators
return the same result shape:

```json
{
  "applicable": true,
  "comparisonCount": 12,
  "satisfactionTotal": 10,
  "violationTotal": 2,
  "score": 0.8333,
  "details": []
}
```

Common behavior remains consistent:

- Missing optional requests are non-applicable.
- Unknown referenced IDs are validation errors.
- Multi-value fields are normalized to arrays.
- Hard rules are legal only when `violationTotal` is zero.
- Soft contribution is `priority × score`.
- Each keyword documents how it handles empty assignments and numeric
  normalization.

The engine can use a registry rather than a large conditional:

```js
const ruleKeywords = {
  itemFieldEqualsAssignedSlotField: {
    validate: validateAssignedFieldEquals,
    evaluate: evaluateAssignedFieldEquals
  },
  itemIsAssignedToEveryRequestedSlot: {
    validate: validateRequestedSlotAssigned,
    evaluate: evaluateRequestedSlotAssigned
  }
};
```

Adding a keyword requires its evaluator, input validation, tests, and rule
builder form. Existing keywords and stored rules do not change.

## Presets

Predefined roster types could provide fixed columns and fixed rules, but they
should be presets on top of the keyword engine rather than a separate engine.
For example, a youth sports preset could create division, practice-night,
coach-request, team-size, and evaluation-balance rules automatically.

This gives common users a nearly configuration-free setup while still allowing
fields, priorities, and supported rules to differ between leagues. A completely
fixed model would be simpler initially but would likely require separate code
paths as soon as two leagues use different columns or policies.

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
