# Example CSVs

Sample files for the locked ruleset: **Cluster**, **Separate**, **Limit**, **Balance**, plus Setup (sizes, slots-per-person, conflict groups).

Illustrative only — presets and the mapping UI can accept messier sheets.

| Folder | Files | Typical setup & rules |
| --- | --- | --- |
| [sports/](./sports/) | `people.csv`, `slots.csv`, `rules.csv` | 1 slot/person; Balance skill; Cluster requests & availability↔practice; Limit keepers/coaches |
| [science-olympiad/](./science-olympiad/) | `preferences.csv`, `slots.csv`, `rules.csv` | Several events/person; conflict groups; Cluster each pref column (`1`…`6`) ↔ slot name with descending priority |
| [volunteers/](./volunteers/) | `people.csv`, `slots.csv`, `rules.csv` | Cluster strengths↔needs and availability↔time; slot min/max for headcount |

### Science Olympiad preference shape

Participants on rows; preference rank as column headers (`1` = first choice); **slot names** (or IDs) in the cells — not rank numbers:

```text
participant,1,2,3,4,5,6
Ava Chen,Astronomy,Optics,Forensics,Robotics,Chemistry Lab,Codebusters
```

Each Cluster rule compares one preference column to `slots.name` (exact match). Higher-rank columns get higher priority. Keep them soft.

### Other conventions

- Multi-value cells use `;` (e.g. `Mon;Wed`).
- Slot size columns map to MinSize / MaxSize in the generator.
- `rules.csv` rows are examples of how a rules sheet or UI might encode the flow in [generator.md](../generator.md).
