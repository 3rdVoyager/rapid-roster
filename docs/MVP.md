# RapidRoster MVP

## Goal

Build a web application that lets organizers import participant data, configure grouping goals, and generate high-quality groups.

The MVP solves one problem well: turning a participant CSV plus a small set of goals into usable groupings. Anything that does not serve that flow is out of scope.

---

## Wizard

Single-page wizard with a progress indicator:

```
RapidRoster

    - Configure data          (import CSV, map columns / types, set group count)
    - Configure goals         (Cluster / Separate / Limit, priority, hard vs soft)
    - Generate groups         (primary run + optional alternatives)
    - Review and export       (inspect groups, export CSV)
```

---

## In scope

### Data

- Import participants from a CSV file.
- Support typed columns: ID, Numeric, Date, Time, DateTime, TimeRange, DateTimeRange, Text.
- Allow multiple values in a cell, separated by semicolons.
- Let the organizer set how many groups to create (and respect capacity when moving people).

### Goals

Organizers build rules with a fixed workflow:

1. Select column(s)
2. Filter participants (everyone, or a condition)
3. Choose a goal: **Cluster**, **Separate**, or **Limit**
4. Configure the goal (exact/partial match, or min/max)
5. Set priority (1–100) and whether it is a **hard constraint**

Hard constraints use a legal-move filter: illegal placements are never considered. If a hard constraint cannot be satisfied, generation fails with a clear error.

**Balance** (numeric spread across groups) is deferred; organizers can approximate it with Separate for MVP.

### Generator

- **Primary process:** seed from the highest-priority goal or hard constraint, then improve with best-scoring relocate/swap moves until no improving move is found for 20+ iterations.
- **Secondary process:** random restarts to surface alternative groupings.
- Moves: **relocate** into a group with capacity, or **swap** with the best partner when the target is full.
- Scoring: apply the candidate with the best positive score delta across all soft goals. Ties break randomly.

Details: [generator.md](./generator.md).

### Review and export

- Show the primary grouping and any alternatives from secondary runs.
- Export final groupings as CSV.

---

## Out of scope (post-MVP)

- Balance goal type
- Accounts, auth, or multi-user collaboration
- Saving/loading projects to a backend
- Real-time collaboration or history
- Mobile-native apps

---

## Success criteria

The MVP is complete when an organizer can:

1. Import a CSV of participants and map columns to data types.
2. Configure group count and at least one Cluster, Separate, or Limit goal (including a hard constraint).
3. Generate a primary grouping via relocate/swap local search.
4. Optionally see alternative groupings from secondary runs.
5. Review groups and export them as CSV.
6. Receive a clear error when hard constraints make generation impossible.

If that path works end to end, the MVP has met its goal.
