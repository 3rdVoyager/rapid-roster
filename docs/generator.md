# Generator

The generator is the core of the application. It is responsible for generating the groupings based on the rules and the participants.

## How it works

The generator works by following these steps:

    Primary Generation Process:
    1. Create initial groupings based on the highest priority goal or hard constraint
    2. For each participant, evaluate candidate moves (relocate or swap) against every other group
    3. Apply the candidate with the best positive score delta
    4. Repeat steps 2 and 3 until no more meaningful moves can be found for 20+ iterations
    5. Output the groupings

    Secondary Generation Process:
    1. Create random initial groupings
    2. For each participant, evaluate candidate moves (relocate or swap) against every other group
    3. Apply the candidate with the best positive score delta
    4. Repeat steps 2 and 3 until no more meaningful moves can be found for 20+ iterations
    5. Output the groupings
    6. Repeat this process a few times to get outlier groupings

The primary generation process is the main process that is used to generate the groupings. The secondary generation process is used to get other options.

### Moves: relocate and swap

Groups are limited by count and/or size, so a one-way move is often illegal when the target group is full. The generator therefore considers two move types and always picks the **best improving** candidate (not a random swap partner).

For each participant `P` currently in group `A`:

```text
candidates = []

for each group B ≠ A:
  if B has capacity:
    candidates += relocate(P → B)
  else:
    for each participant Q in B:
      candidates += swap(P ↔ Q)

apply the candidate with the best positive score delta
if several candidates tie for best delta, pick one at random
```

- **Relocate** — move `P` into `B` when `B` still has room. Changes group sizes.
- **Swap** — exchange `P` with a specific `Q` in `B` when `B` is full. Keeps both group sizes the same.

Only moves that pass the hard-constraint legal-move filter are candidates. Soft goals decide which legal candidate has the best delta.

## Data types

Data types are the different types of data that can be used in the rules.

| Data Type     | Examples                                  | Description |
| ------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| ID            | #532; #533; #534                          | A unique identifier for the participant                                                              |
| Numeric       | 8; 25; 136                                | A numeric value (e.g. skill level, age, height, experience level, etc.)                              |
| Date          | 2026-01-01; 2026-01-02                    | A date value (e.g. birth date, event date, etc.)                                                     |
| Time          | 12:00:00; 13:00:00                        | A time value (e.g. availability time, event time, etc.)                                              |
| DateTime      | 2026-01-01 13:00:00                       | A date and time value (e.g. availability date and time, event date and time, etc.)                   |
| TimeRange     | 12:00:00 - 13:00:00                       | A time range value (e.g. availability time range, event time range, etc.)                            |
| DateTimeRange | 2026-01-01 12:00:00 - 2026-01-01 13:00:00 | A date and time range value (e.g. availability date and time range, event date and time range, etc.) |
| Text          | "John Smith"; "Emily Chen"                | A text value (e.g. name, email, phone number, etc.)                                                  |

### Multiple Values

Cells may contain multiple values by separating them with semicolons.

Examples:

```text
Monday;Wednesday;Friday

English;Spanish

Room 101;Room 203

John Smith;Emily Chen
```

The generator interprets these as lists of values rather than a single string.

## Goals

Goals are a list of constraints that the generator will follow when generating the groupings.

Goals can be marked as a "Hard Constraint", which prompts the generator to prioritize that goal at all costs. For example, if separating boys and girls into different groups is a hard constraint, the generator will make sure that no future goals will be able to override this.

**Every rule should follow this workflow**

#### Step 1: Select columns

Choose the columns that will be processed in the goal.

- All
- Skill
- Gender
- Availability
- Department
- Languages
- Experience
- Age
- School

Multiple columns can be selected.

#### Step 2: Filter the participants

This determines the target participants.

Everyone

Only participants matching a condition

- Gender = Male
- Skill >= 8
- Availability contains Tuesday
- Languages contains Spanish
- Age between 12 and 14

#### Step 3: Choose a goal

Instead of dozens of hardcoded rules, users choose one goal. There are currently 4 fundamental goals.

1. Cluster: Group similar participants together.

- Keep siblings together
- Keep departments together
- Keep language speakers together
- Keep similar availability together

2. Separate: Group similar participants apart.

- Spread boys across groups
- Spread schools
- Spread experienced players

3. Limit: Limit occurrences.

- Minimum 1 Coach
- Maximum 2 Goalkeepers
- Exactly 3 Volunteers

4. (Future) Balance: Balance the values across groups. Works only with numeric values.

- Balance skill levels
- Balance ages
- Balance experience levels

#### Step 4: Configure the goal

Each goal has slightly different options.

Limit

- Minimum
- Maximum

Cluster

- Partial match
- Exact match

Separate

- Partial match
- Exact match

#### Step 5: Priority

The priority is the importance of the goal. It is a value between 1 and 100. 1 is the lowest priority and 100 is the highest priority.

Also determine whether the goal is a hard constraint.

- Hard constraint: Yes
  - The generator will prioritize this goal at all costs by activating a legal move filter: illegal placements are never considered. If it is not possible to fulfill the goal, the generator will return an error message detailing exactly what occurred.

#### Scenario Examples

Scenario 1: Value teammate requests

- Step 1: Choose attributes (columns): Teammate Requests; Player Name
- Step 2: Filter the participants: Everyone
- Step 3: Choose a goal: Cluster
- Step 4: Configure the goal: Exact match
- Step 5: Priority: 75

Scenario 2: Prioritize availability

- Step 1: Choose attributes (columns): Availability
- Step 2: Filter the participants: Everyone
- Step 3: Choose a goal: Cluster
- Step 4: Configure the goal: Partial match
- Step 5: Priority: 100

For this one specifically, the generator will know how to process dates and times. An exact match would be if the availability is exactly the same as the other participants in the group. A partial match would be if the availability is partially overlapping with the other participants in the group.

Scenario 3: Separate Siblings

- Step 1: Choose attributes (columns): Sibling
- Step 2: Filter the participants: Everyone
- Step 3: Choose a goal: Separate
- Step 4: Configure the goal: Exact match
- Step 5: Priority: 50

Scenario 4: Limit the number of coaches

- Step 1: Choose attributes (columns): Coach
- Step 2: Filter the participants: Coach = "Yes"
- Step 3: Choose a goal: Limit
- Step 4: Configure the goal: Maximum 2
- Step 5: Priority: 90

Scenario 5: Balance skill levels across groups

- Step 1: Choose attributes (columns): Skill
- Step 2: Filter the participants: Everyone
- Step 3: Choose a goal: Balance
- Step 4: Configure the goal: N/A
- Step 5: Priority: 85

OR:

- Step 1: Choose attributes (columns): Skill
- Step 2: Filter the participants: Everyone
- Step 3: Choose a goal: Separate
- Step 4: Configure the goal: Partial match
- Step 5: Priority: 85

## Prioritization

After the initial matching stage, the generator improves groupings by scoring **candidate moves** (relocate or swap), not just “which group looks best for this player in isolation.”

For each candidate, compute the **score delta**: total assignment score after the move minus total score before the move. Apply the candidate with the highest positive delta. If none improve the score, skip that participant for this pass.

When scoring a placement against a goal: if the goal is fulfilled, add that goal’s priority to the score; if not, add nothing. Hard constraints do not contribute soft points — they only filter illegal candidates out.

For example, if a Cluster goal on School has priority 100, a relocate or swap that puts a participant into a group that already has a matching school earns +100 toward that goal’s contribution. A swap is scored for **both** participants’ new placements (and any Limit / size effects), since exchanging `P` and `Q` changes two memberships at once.

If two or more candidates tie for the best delta, the generator picks one at random.
