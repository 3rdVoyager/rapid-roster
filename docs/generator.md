# Generator

The generator places **participants into slots** (teams, events, roles, shifts, etc.) using the rules you set.

It does not have special modes for different events. A **preset** only fills in starter people/slot settings and rules.

You customize three things:

1. **Setup** — participant data, slot data, sizes, slots-per-person, conflict groups  
2. **Rules** — Cluster, Separate, Limit, Balance (what “good” means)  
3. **Generate** — find a placement that respects hard rules and scores best on soft ones  

---

## The Idea

- Each **person** can be placed in one or more **slots**.
- You set how many slots a person may hold (often exactly one for teams; several for event lists).
- You set how many people each slot should hold (min and max).
- **Hard rules** must never be broken. If they cannot all be met, generation fails with a clear error.
- **Soft rules** have a priority from 1–100. The generator tries to satisfy higher-priority soft rules more, but can trade them off.
- Soft rules are scored by how well they are met (not just yes/no). Partial success still counts.

When everyone is limited to one slot, you get normal “split into teams.” When people can hold several slots, you get things like “each person on a few events.” Same engine either way.

**Spreadsheets hold facts. Rules hold policies.** Slot min/max size and conflict groups live in Setup. “Max 2 keepers” and “balance skill” live in Rules.

---

## Setup

**Participants** — a table with columns (name, skill, availability, preference ranks, and so on). A cell may list several values separated by semicolons. Assign a column type to each column (see below).

**Slots** — named places to assign participants (Team A, Optics, Friday shift, …), each with min/max size. Slots can also have their own info (needed strengths, time, tags). Assign a column type to each column.

**Global setup (not Cluster/Separate/Limit/Balance):**

- Number of slots each participant can be assigned to (single, multiple, or different per participant).
- Groups of slots that the same person cannot hold at once (for example, two events in the same time block).

Importers and presets read common spreadsheet shapes and turn them into this setup. The generator only sees cleaned-up people, slots, and rules.

Examples: [docs/examples/](./examples/).

---

## Participant Attributes (Columns)

- ID - A unique identifier used to identify a participant. Either configured by the user or generated automatically.
- Number - A number.
- Time - A single date or time, or a range of dates and times.
- Text - A text value. Can be a category, attribute, preference, etc.
- Ignore - A value that is ignored by the generator.

## Slot Attributes (Columns)

- ID - A unique identifier used to identify a slot. Either configured by the user or generated automatically.
- MinSize - The minimum number of participants that should be assigned to the slot. Default is none.
- MaxSize - The maximum number of participants that should be assigned to the slot. Default is number of participants divided by the number of slots.
- Text - A text value. Can be a category, attribute, preference, etc.
- Ignore - A value that is ignored by the generator.

## Rules

Every rule uses the same short flow:

1. **Choose rule type**
   - Cluster - Prefer that matched participants or slots remain together.
   - Separate - Prefer that matched participants or slots remain apart.
   - Limit - Cap or require how many of a chosen set of participants appear in each slot.
   - Balance - Keep a number (skill, age, …) roughly even across slots.
2. **Choose data** 
   - *Cluster or Separate* - Give multiple columns, ranges, or cells to compare different attributes between participants and slots. Give a single column, range, or cell to compare the same attribute among participants. Show a preview list of participant and slot matches.
   - *Limit or Balance* - Give a single column, range, or cell. Give a single column, range, or cell that contains numeric values.
3. **Apply Filter** - Apply an optional filter (role=coach, skill=advanced, preference=1 etc.) to the data. Just specify a single value (like "1" if searching through a preference grid) to filter through the entire selected range without caring about column or row.
3. **Adjust options**
   - *Cluster or Separate* - exact vs partial match
   - *Limit* - min/max counts
   - *Balance* - None
4. **Set priority (1–100) and hard vs soft**

---

## What each rule type means

| Type | What it does | Example |
| --- | --- | --- |
| **Cluster** | Keep matched things together: people who share a value in the same slot, **or** a person in a slot whose name/ID matches a preference cell | Same school together; teammate requests; pref column `1` ↔ slot name |
| **Separate** | Keep matched things apart | Spread schools; keep two people apart |
| **Limit** | Min/max how many of a filtered set appear in each slot | Max 2 keepers; min 1 coach |
| **Balance** | Keep a number roughly even across slots | Balance skill or age |

### Cluster: two common data shapes

1. **One participant column** — people with the same value prefer the same slot (school, tags with partial overlap, etc.).
2. **Participant column(s) ↔ slot column** — when values match, prefer that **person in that slot** (preference rank columns full of slot names; strengths ↔ needed strengths; availability ↔ practice night).

Ranked slot picks (Science Olympiad / Google Form style) use shape 2: columns named `1`…`6` contain slot names; one soft Cluster rule per column with descending priority. See [examples/science-olympiad/](./examples/science-olympiad/).

### How similarity works (simple version)

When a rule compares values:

- **Exact** — same value counts as a match; different does not.
- **Partial** — closer values score better (shared tags, closer numbers, overlapping time ranges).

---

## How scoring works

- Only **soft** rules add to the score.
- Each soft rule contributes roughly: **priority × how well it is met** (from not at all to fully).
- The generator looks for a placement that is fully legal (setup limits + hard rules) and has the best total soft score it can find.
- After a run, you see how well each soft rule did, so you can tell what was traded off.

---

## How generation works

The generator tries small changes and keeps ones that improve the score without breaking hard rules:

- Put someone into a slot  
- Remove someone from a slot  
- Move someone from one slot to another  
- Swap people (or swap which slots two people hold)  

**Main run:** start from a legal placement → keep improving → if stuck, shake things up a bit and improve again → stop when nothing useful improves for a while.

**Extra runs:** start from different legal beginnings to offer alternative layouts.

Same steps for every project. Different results come from different setup and rules, not from a different algorithm.

---

## Presets

A preset is a saved starter pack:

- Participants template CSV  
- Slots template CSV  
- Starter rules (and global setup defaults)  

Applying a preset just writes those into the project. You can change or delete anything afterward. Domain packs (sports, Science Olympiad, volunteers) are presets only — not separate engines.

---

## Errors and feedback

**Before generating**

- Bad or unreadable values in columns a rule needs  
- Preferences or requests that point at unknown people or slots  
- Empty rules or impossible min/max sizes  
- Totals that cannot work (not enough seats for everyone, etc.)

**If hard rules cannot all be met**

- Fail clearly and explain what is fighting what, when that can be detected  

**After a successful run**

- Score / satisfaction per soft rule  
- Simple breakdowns where helpful (e.g. who got weak preference matches)  

---

## Principles

1. One engine for every project.  
2. Customize with setup + rules, not special modes.  
3. Presets only fill in settings.  
4. Hard = must never break; soft = try hard, allow tradeoffs.  
5. Soft success can be partial, not only pass/fail.  
6. UI shortcuts only help you fill in a rule; they do not change the engine.
