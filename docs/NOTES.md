Notes:
Clustering and separating slots makes no sense
Clustering and separating entries is useful

Group
Don't Group
Assign
Don't Assign

Cluster basically means create a group of entries that should be assigned to the same slot
Data is a group or collection of entries or slots.



The point of RapidRoster is to assign:
- Entries to slots or
- Slots to entries
In a way that fits certain rules.

Direct assignment:
assign these slots to this entry
assign these entries to this slot
assign this entry to this slot
assign this slot to this entry

Relative assignment:
assign these entries to the same slot
assign these slots to the same entry


assign entries with this attribute to slots with this attribute
I don't want to assign slots with this attribute to entries with this attribute

There are both basic rules and optimizer rules:
- Basic rules are simple, direct, and easy to understand. Like "assign this entry to this slot" or "assign these entries to this slot"
- Optimizer rules are more complex and involve multiple entries and slots. Like "assign these entries to the same slot" or "assign entries with this attribute to slots with this matching attribute" They can often be accomplished with multiple basic rules, but the optimizer rules are more efficient.

Assignments are just relationships. They can be expressed in two ways:
Entry to Slot: assign this entry to this slot
Slot to Entry: assign this slot to this entry

DataQuery: finds a specific set of data
RelationshipQuery: uses a relationship to repeatedly find sets of related data and perform a different action on each set

Tentative group: a group that the user configures that they would like to tentatively assign together. The generator will try to assign the whole group or as many as possible into the same slot.