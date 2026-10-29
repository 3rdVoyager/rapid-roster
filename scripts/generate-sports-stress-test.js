/**
 * generate-sports-stress-test.js
 *
 * Builds a large sports-league project for load-testing Generate:
 *   ~500 players, 20 teams, several soft + hard rules.
 *
 * Writes:
 *   frontend/testdata/sports-league-500/entries.csv
 *   frontend/testdata/sports-league-500/slots.csv
 *   frontend/testdata/sports-league-500/rules.csv
 *   frontend/testdata/sports-league-500/sports-league-500.rapidroster.json
 *
 * Import the .json from the app hub (Import) for a one-shot load.
 * Or import the three CSVs panel-by-panel in a blank project.
 *
 * Usage: node scripts/generate-sports-stress-test.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "frontend", "testdata", "sports-league-500");

const PLAYER_COUNT = 500;
const TEAM_COUNT = 20;
const TEAM_SIZE = PLAYER_COUNT / TEAM_COUNT; // 25

const FIRST_NAMES = [
  "Ava", "Noah", "Mia", "Jordan", "Sam", "Riley", "Casey", "Taylor",
  "Jamie", "Drew", "Alex", "Morgan", "Quinn", "Sky", "Parker", "Reese",
  "Cameron", "Avery", "Blake", "Hayden", "Rowan", "Sage", "Finley", "Emery",
  "Kai", "Nina", "Omar", "Priya", "Leo", "Zoe", "Ivy", "Cruz",
  "Elena", "Marcus", "Sofia", "Diego", "Amara", "Julian", "Nora", "Ethan",
  "Lila", "Mateo", "Chloe", "Isaac", "Aisha", "Owen", "Maya", "Lucas",
  "Hannah", "Felix", "Grace", "Adrian", "Vera", "Nathan", "Iris", "Caleb",
  "Ruby", "Daniel", "Jade", "Henry", "Clara", "Sienna", "Theo", "Lena"
];

const LAST_NAMES = [
  "Chen", "Patel", "Brooks", "Lee", "Okonkwo", "Quinn", "Nguyen", "Kim",
  "Ortiz", "Hassan", "Rivera", "Blake", "Hayes", "Jordan", "Diaz", "Park",
  "Wu", "Scott", "Price", "Ng", "Cole", "Singh", "Garcia", "Martinez",
  "Brown", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson",
  "Ali", "Bennett", "Carter", "Douglas", "Evans", "Foster", "Graham",
  "Hughes", "Ibrahim", "Jenkins", "Khan", "Lopez", "Murphy", "Nelson",
  "Owens", "Perez", "Reed", "Santos", "Turner", "Vargas", "Walsh",
  "Young", "Zhang", "Abbott", "Bailey", "Cruz", "Dixon", "Ellis", "Fox"
];

const SCHOOLS = [
  "Northwest HS", "Northeast HS", "Southwest HS", "Southeast HS",
  "Central Academy", "Riverdale Prep", "Oakridge", "Hillcrest",
  "Lakeside", "Parkview", "Summit", "Valley Forge"
];

const NIGHTS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** Deterministic PRNG so the file is stable across runs. */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260726);

function pick(list) {
  return list[Math.floor(rand() * list.length)];
}

function escapeCsv(value) {
  const text = String(value);
  if (text.indexOf(",") !== -1 || text.indexOf('"') !== -1) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function csvLine(cells) {
  return cells.map(escapeCsv).join(",");
}

function buildPeople() {
  const people = [];

  // Roles: 1 coach + 2 keepers per team target, rest players.
  const coachesNeeded = TEAM_COUNT;
  const keepersNeeded = TEAM_COUNT * 2;

  for (let i = 1; i <= PLAYER_COUNT; i = i + 1) {
    // Names are display-only; duplicates are fine (id is the real key).
    const name = pick(FIRST_NAMES) + " " + pick(LAST_NAMES);

    let role = "player";
    if (i <= coachesNeeded) {
      role = "coach";
    } else if (i <= coachesNeeded + keepersNeeded) {
      role = "keeper";
    }

    const skill = 1 + Math.floor(rand() * 10);
    const experience = 1 + Math.floor(rand() * 8);
    const school = pick(SCHOOLS);
    const region = pick(["North", "South", "East", "West"]);

    // 1–3 practice nights they can make.
    const nightCount = 1 + Math.floor(rand() * 3);
    const nights = [];
    const nightPool = NIGHTS.slice();
    for (let n = 0; n < nightCount; n = n + 1) {
      const idx = Math.floor(rand() * nightPool.length);
      nights.push(nightPool[idx]);
      nightPool.splice(idx, 1);
    }

    people.push({
      id: String(i),
      name: name,
      skill: skill,
      experience: experience,
      role: role,
      school: school,
      region: region,
      availability: nights.join(";"),
      teammate_requests: ""
    });
  }

  // About 35% get 1–2 teammate requests (by name).
  for (let i = 0; i < people.length; i = i + 1) {
    if (rand() > 0.35) {
      continue;
    }

    const requestCount = 1 + Math.floor(rand() * 2);
    const names = [];
    for (let r = 0; r < requestCount; r = r + 1) {
      const other = people[Math.floor(rand() * people.length)];
      if (other.id === people[i].id) {
        continue;
      }
      if (names.indexOf(other.name) === -1) {
        names.push(other.name);
      }
    }
    people[i].teammate_requests = names.join(";");
  }

  return people;
}

function buildSlots() {
  const slots = [];
  for (let t = 1; t <= TEAM_COUNT; t = t + 1) {
    slots.push({
      slot_id: "t" + String(t),
      name: "Team " + String(t),
      min_size: TEAM_SIZE,
      max_size: TEAM_SIZE,
      practice_night: NIGHTS[(t - 1) % NIGHTS.length]
    });
  }
  return slots;
}

function buildRules() {
  return [
    {
      id: "R1",
      name: "Balance skill",
      type: "Balance",
      data: "entries.skill",
      filter: "",
      options: "",
      priority: "9",
      hard: "no"
    },
    {
      id: "R2",
      name: "Balance experience",
      type: "Balance",
      data: "entries.experience",
      filter: "",
      options: "",
      priority: "6",
      hard: "no"
    },
    {
      id: "R3",
      name: "Teammate requests",
      type: "Cluster",
      data: "entries.teammate_requests > entries.name",
      filter: "",
      options: "exact",
      priority: "8",
      hard: "no"
    },
    {
      id: "R4",
      name: "Availability match",
      type: "Cluster",
      data: "entries.availability > slots.practice_night",
      filter: "",
      options: "partial",
      priority: "7",
      hard: "no"
    },
    {
      id: "R5",
      name: "Same school together",
      type: "Cluster",
      data: "entries.school",
      filter: "",
      options: "exact",
      priority: "5",
      hard: "no"
    },
    {
      id: "R6",
      name: "Same region together",
      type: "Cluster",
      data: "entries.region",
      filter: "",
      options: "exact",
      priority: "3",
      hard: "no"
    },
    {
      id: "R7",
      name: "Spread schools a bit",
      type: "Separate",
      data: "entries.school",
      filter: "",
      options: "exact",
      priority: "2",
      hard: "no"
    },
    {
      id: "R8",
      name: "Limit keepers",
      type: "Limit",
      data: "entries.role",
      filter: "keeper",
      options: "max=2",
      priority: "9",
      hard: "yes"
    },
    {
      id: "R9",
      name: "Require a coach",
      type: "Limit",
      data: "entries.role",
      filter: "coach",
      options: "min=1",
      priority: "10",
      hard: "yes"
    },
    {
      id: "R10",
      name: "Cap coaches",
      type: "Limit",
      data: "entries.role",
      filter: "coach",
      options: "max=1",
      priority: "8",
      hard: "yes"
    }
  ];
}

function writeCsv(filePath, headers, rows) {
  const lines = [csvLine(headers)];
  for (let i = 0; i < rows.length; i = i + 1) {
    const row = rows[i];
    const cells = [];
    for (let h = 0; h < headers.length; h = h + 1) {
      cells.push(row[headers[h]]);
    }
    lines.push(csvLine(cells));
  }
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

function tableFromCsvRows(headers, rows, kind) {
  const columns = headers.map(function (key) {
    let type = "text";
    if (key === "id" || key === "slot_id") {
      type = "id";
    } else if (key === "name") {
      type = "name";
    } else if (key === "skill" || key === "experience") {
      type = "number";
    } else if (key === "min_size") {
      type = "minSize";
    } else if (key === "max_size") {
      type = "maxSize";
    }
    return { key: key, label: key, type: type };
  });

  const idKey = kind === "slots" ? "slot_id" : "id";
  const outRows = [];

  for (let i = 0; i < rows.length; i = i + 1) {
    const src = rows[i];
    const cells = {};
    for (let h = 0; h < headers.length; h = h + 1) {
      cells[headers[h]] = String(src[headers[h]]);
    }
    outRows.push({
      id: String(src[idKey]),
      cells: cells
    });
  }

  return { columns: columns, rows: outRows };
}

function rulesForProject(ruleRows) {
  return ruleRows.map(function (row) {
    const rule = {
      id: row.id,
      name: row.name,
      type: row.type.toLowerCase(),
      hard: row.hard === "yes",
      priority: Number(row.priority)
    };

    const data = row.data;
    if (data.indexOf(">") !== -1) {
      const parts = data.split(">");
      const left = parts[0].trim();
      const right = parts[1].trim();
      const leftAttr = left.replace(/^entries\./, "").replace(/^preferences\./, "");
      const rightAttr = right.replace(/^slots\./, "").replace(/^entries\./, "");

      if (right.indexOf("slots.") === 0) {
        rule.shape = "entryMatchesSlot";
        rule.entryAttribute = leftAttr;
        rule.slotAttribute = rightAttr;
      } else {
        rule.shape = "entriesTogether";
        rule.entryAttribute = leftAttr;
      }
      rule.match = row.options === "partial" ? "partial" : "exact";
    } else {
      rule.entryAttribute = data.replace(/^entries\./, "");
      if (rule.type === "cluster" || rule.type === "separate") {
        rule.shape = "entriesTogether";
        rule.match = row.options === "partial" ? "partial" : "exact";
      }
    }

    if (row.filter) {
      rule.filterValue = row.filter;
    }

    if (rule.type === "limit" && row.options) {
      const optParts = row.options.split(";");
      for (let i = 0; i < optParts.length; i = i + 1) {
        const piece = optParts[i].trim();
        if (piece.indexOf("max=") === 0) {
          rule.maxCount = Number(piece.slice(4));
        }
        if (piece.indexOf("min=") === 0) {
          rule.minCount = Number(piece.slice(4));
        }
      }
    }

    return rule;
  });
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const people = buildPeople();
  const slots = buildSlots();
  const rules = buildRules();

  const entryHeaders = [
    "id",
    "name",
    "skill",
    "experience",
    "role",
    "school",
    "region",
    "availability",
    "teammate_requests"
  ];
  const slotHeaders = ["slot_id", "name", "min_size", "max_size", "practice_night"];
  const ruleHeaders = [
    "id",
    "name",
    "type",
    "data",
    "filter",
    "options",
    "priority",
    "hard"
  ];

  writeCsv(path.join(OUT_DIR, "entries.csv"), entryHeaders, people);
  writeCsv(path.join(OUT_DIR, "slots.csv"), slotHeaders, slots);
  writeCsv(path.join(OUT_DIR, "rules.csv"), ruleHeaders, rules);

  const project = {
    id: "proj-sports-league-500",
    name: "Sports league stress test (500)",
    updatedAt: new Date().toISOString(),
    presetId: "blank",
    entries: tableFromCsvRows(entryHeaders, people, "entries"),
    slots: tableFromCsvRows(slotHeaders, slots, "slots"),
    setup: {
      defaultSlotsPerEntry: 1,
      conflictGroups: []
    },
    rules: rulesForProject(rules),
    results: null
  };

  const payload = {
    format: "rapidroster-project",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    project: project
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "sports-league-500.rapidroster.json"),
    JSON.stringify(payload, null, 2),
    "utf8"
  );

  const readme = [
    "# Sports league stress test (500 people)",
    "",
    "Generated by `node scripts/generate-sports-stress-test.js`.",
    "",
    "## Quick load (recommended)",
    "",
    "1. Open `/app/`",
    "2. Click **Import**",
    "3. Choose `sports-league-500.rapidroster.json`",
    "",
    "## Or import CSVs into a blank project",
    "",
    "- Entries panel → import `entries.csv`",
    "- Slots panel → import `slots.csv`",
    "- Rules panel → import `rules.csv`",
    "- Setup → slots per entry = 1",
    "",
    "## Shape",
    "",
    "- 500 people, 20 teams of 25",
    "- 20 coaches, 40 keepers, 440 players",
    "- Soft: balance skill/experience, teammate requests, availability,",
    "  school cluster, region cluster, school separate",
    "- Hard: max 2 keepers, min 1 coach, max 1 coach per team",
    ""
  ].join("\n");

  fs.writeFileSync(path.join(OUT_DIR, "README.md"), readme, "utf8");

  console.log("Wrote stress test to " + OUT_DIR);
  console.log("  people: " + people.length);
  console.log("  teams:  " + slots.length);
  console.log("  rules:  " + rules.length);
}

main();
