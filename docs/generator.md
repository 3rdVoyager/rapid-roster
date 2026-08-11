# Generator

## Data selection:
The point of RapidRoster is to assign:
- Entries to slots or
- Slots to entries
In a way that fits certain rules.

Assignments are just relationships. They can be expressed in two ways:
- Entry to Slot: assign this entry to this slot
- Slot to Entry: assign this slot to this entry

**DataQuery:** finds a specific set of data to operate on. RelationshipQueries can often be accomplished with multiple repetitive DataQueries, but RelationshipQueries are more efficient.
**RelationshipQuery:** uses a relationship query to repeatedly find sets of related data and perform a different action on each set. They are more difficult to understand and use, but they are much more powerful and flexible.


### DataQueries
**DataQueries** are like an SQL Query: SELECT FROM Entries WHERE Availability EQUALS Mon OR Tue

Most DataQueries are searches, but when desired they can indicate custom selections as well. For example, a DataQuery can be used to search for all the ID's of a specific set of entries or slots that the user has chosen, even if they don't have an easy relationship that connects them. This custom selection is useful for things like "these 3 entries should be assigned to the same slot" or "these 4 slots should be assigned to the same entry" where there is no other relationship that can be used to find them.

A standard [DataQuery] is [Table].[Column].[Value]
- [Table] - Table (Entries or Slots).
- [Column] - Column to be matched in the table.
- [Value] - Value to be matched in the column. 

Examples:
- **Entries.Availability.Monday**: Selects all entries with availability on Monday.
- **Entries.Name.john**: Selects all entries with the name "john".
- **Slots.ID.12**: Selects the one slot with ID 12.

Multiple queries can be combined with AND/OR to create more complex queries. 

For example:
- **Entries.Availability.Monday AND Entries.Skill.8**: Selects all entries with availability on Monday and a skill level of 8.
- **Entries.Name.john OR Entries.Name.jane**: Selects all entries with the name "john" or the name "jane".


### RelationshipQueries
RelationshipQueries are more complex queries that save the user time by using a relationship to repeatedly find multiple sets of related data. Rather than grouping all the sets together like a DataQuery, it then performs a different action on each set. RelationshipQueries can often be accomplished with multiple repetitive DataQueries, but RelationshipQueries are more efficient.

For example, if you want to select all entries that have a skill level that matches the skill level of another entry, you could use multiple Rules and DataQueries to find all entries with each skill level:

    - Rule 1: Find all entries with skill level 1. Perform action.
    - Rule 2: Find all entries with skill level 2. Perform action.
    - Rule 3: Find all entries with skill level 3. Perform action.
    - ... and so on.

RelationshipQueries allow you to do this in one Rule, by finding all entries with a skill level that matches the skill level of another entry, and performing the action on each set of related entries:

    - Rule: Find all entries with a skill level that matches the skill level of another entry. Perform dynamic action on each set.

A standard [RelationshipQuery] is [Table].[Column]
Similar to a DataQuery, but instead of searching for a value it finds matches in the specified column. This allows you to find all entries that have a value that matches the value of another entry or slot.

- **Entries.Availability**: Groups entries into sets based on their availability. All entries with the same availability will be grouped together.

Returns the sets:
{
    "Monday": ["Entry1", "Entry2"],
    "Tuesday": ["Entry3", "Entry4"],
    "Wednesday": ["Entry5", "Entry6"]
}

- **Entries.Name**: Groups entries into sets based on their name. All entries with the same name will be grouped together.

Returns the sets:
{
    "john": ["Entry1", "Entry2"],
    "jane": ["Entry3", "Entry4"],
    "bob": ["Entry5", "Entry6"]
}

The computer has a ton of sets of data, but now processing isn't as simple as a standard DataQuery. So the computer no longer operates on entries themselves. It now treats each group as it's own entry essentially. The computer will now perform target actions on each set of entries, rather than on each individual entry. This allows for more complex and dynamic actions to be performed on the data.

Let's say the user wants all entries with the same availability to be assigned to the slot with the same meeting time. 

[Assign] [Entries.Availability] to [Slots.MeetingTime]

It finds sets of entries with the same availability, and then finds the slot with the same meeting time, and assigns all entries in that set to that slot.

[Assign] [Entries.Availability] to [Slots.SameSlot]

## JSON Rule Format
More detail can be found in the [JSON Rule Schema](json-rule-schema.md) document.
{
  queries: ["Entries.Availability.Monday", "Entries.Skill.8"]
}



## Core templates
1. Limit (Require)
    - [Limit] the number of [DataQuery] per [DataQuery] to be between [Num] and [Num]
        - [Limit] the number of [Entries where Type = Coach] per [All/Any Slots] to be between [1] and [1]

2. Assign (Place)
    - [Assign] [DataQuery] to [DataQuery]
        - [Assign] [Specific Entry] to [Specific Slot]
        - [Assign] [Entries where Skill = High] to [Slots where Skill = High]
        - [Assign] [Entries where Availability = Monday] to [the same slot]
        - [Assign] [Entries where Availability = Monday] to [different slots]
        - [Assign] [Entries where Teammate-Request = Name] to [the same slot]
    - [Assign] [RelationshipQuery] to [RelationshipQuery]
        - [Assign] [Entries with matching availability] to [the same slot]

3. Prevent (Remove)
    - [Prevent] [DataQuery] from being assigned to [DataQuery]
        - [Prevent] [Specific Entry] from being assigned to [Specific Slot]
        - [Prevent] [Entries where Availability = Monday] from being assigned to [the same slot]
        - [Prevent] [Entries where Availability = Monday] from being assigned to [different slots]
        - [Prevent] [Entries where Opponents = Name] from being assigned to [the same slot]

4. Cluster (Group)
    - [Cluster] [DataQuery] together
        - [Cluster] [Entries where Teammate-Request = Name] together in [the same slot]
        - [Cluster] [Entries where Availability = Monday] together in [the same slot]

5. Separate (Ungroup)
    - [Separate] [DataQuery] from each other
        - [Separate] [Entries where Opponents = Name] from each other in [different slots]

6. Balance (Even Distribution)
    - [Balance] [Attribute(s)] across [DataQuery]

## Priority and Hard vs Soft

After writing a rule, you can set its priority (1-10) and whether it is hard or soft. Hard rules must be satisfied, while soft rules are preferred but not required. The generator will try to satisfy as many soft rules as possible without violating any hard rules.

Total score is calculated based on how well each generated assignment satisfies each rule, with higher priority rules contributing more to the score. The generator will attempt to maximize the total score while respecting hard constraints. For example, if a rule has a priority of 5 and is fully satisfied, it contributes 5 points to the total score. If it is partially satisfied, it contributes a fraction of that score based on how well it is met.

If a hard rule is violated, the total score is set to zero, and the generator will discard that assignment and try a different one. If it is impossible to satisfy all hard rules, the generator will report an error with a detailed message and allow you to adjust the rules or constraints.

## How generation works

The generator tries small changes and keeps ones that improve the total calculated score without breaking any hard rules:

- Put someone into a slot
- Remove someone from a slot
- Move someone from one slot to another
- Swap people (or swap which slots two people hold)  

**Flow:** start from a random legal placement -> try to improve -> stop when nothing useful improves for a defined period -> repeat as needed for multiple runs.

---

## Presets

A preset is a saved starter pack:

- Participants template CSV  
- Slots template CSV  
- Starter rules (and global setup defaults)  

Applying a preset just writes those into the project. You can change or delete anything afterward.

---