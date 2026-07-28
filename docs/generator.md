# Generator

Goal: the **smallest set of sentence shapes** that still cover sports, SciOly, volunteers, classroom, committees, etc. 

---

## Entry and Slot selection:
Like an SQL Query: SELECT FROM Entries WHERE Availability EQUALS Mon OR Tue

Slots
- All/Any Slots
- Where attribute
    - Availability = Monday AND Wednesday 
    - Skill = 8 OR 9 OR 10
    - Teammate-Request matches another slot’s
        - Name
        - ID
        - Class = Coach AND Name != Bob
- Custom Selection 

Entries
- All/Any Entries
- Where attribute
    - Availability = Monday AND Wednesday 
    - Skill = 8 OR 9 OR 10
    - Teammate-Request matches another entry’s
        - Name
        - ID
        - Class = Coach AND Name != Bob
- Custom Selection 

The selector will show a small preview of the selected entries or slots to ensure expected configuration.



## Core templates

1. Cluster (Group Together)
    - I want to [Cluster] [Entry(s)]
        - I want to [Cluster] [Entries where teammate-request matches another entry’s ID]

2. Separate (Group Apart)
    - I want to [Separate] [Entry(s)]
        - I want to [Separate] [Entries where school matches another entry’s school]

3. Limit (Require)
    - I want to [Limit] the number of [Entry(s)] per [Slot(s)] to be between [Num] and [Num]
        - I want to [Limit] the number of [Entries where Type = Coach] per [All/Any Slots] to be between [1] and [1]
    - I want to [Limit] the number of [Slot(s)] per [Entry(s)] to be between [Num] and [Num]
        - I want to [Limit] the number of [Slots where conflict-group = group3] per [All/Any Entries] to be between [0] and [1]

4. Assign (Place)
    - I want to [Assign] [Entry(s)] to [Slot(s)]
        - I want to [Assign] [Specific Entry] to [Specific Slot]
        - I want to [Assign] [Entries where Skill = High] to [Slots where Skill = High]
    - I want to [Assign] [Slot(s)] to [Entry(s)]
        - I want to [Assign] [Specific Slot] to [Specific Entry]

5. Avoid Assignment (Remove)
    - I want to [Avoid Assignment] of [Entry(s)] to [Slot(s)]
        - I want to [Avoid Assignment] of [Specific Entry] to [Specific Slot]
    - I want to [Avoid Assignment] of [Slot(s)] to [Entry(s)]
        - I want to [Avoid Assignment] of [Specific Slot] to [Specific Entry]

6. Tentative (Future)
    - I want to [Balance] [Attribute(s)] across [Slot(s)]
    - I want to [Match] [Attribute(s)] of [Entry(s)] to [Attribute(s)] of [Slot(s)]

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