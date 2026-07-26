/**
 * Documentation page — tabs, walkthrough steps, and article rendering.
 */

const TAB_ORDER = ["walkthroughs", "tutorials", "explanations", "tricks"];

const WALKTHROUGH_STEPS = [
  { id: "project", label: "Start a project" },
  { id: "entries", label: "Entries" },
  { id: "slots", label: "Slots" },
  { id: "rules", label: "Rules" },
  { id: "review", label: "Review" },
  { id: "generate", label: "Generate" },
  { id: "results", label: "Results & export" }
];

const CONTENT = {
  walkthroughs: {
    project: {
      title: "Start a project",
      blocks: [
        {
          type: "p",
          html: "Everything in RapidRoster lives inside a <strong>project</strong> — your entries, slots, rules, and generated options stay together."
        },
        {
          type: "ol",
          items: [
            "Open <strong>Projects</strong> from <strong>Open App</strong> (or go to <code>/app/</code>).",
            "Click <strong>New project</strong> and give it a clear name you will recognize later.",
            "Choose a blank start, or load a sample <strong>preset</strong> (sports, Science Olympiad, volunteers) so you have data to explore immediately."
          ]
        },
        {
          type: "callout",
          html: "<strong>Saved in this browser.</strong> Projects stay on this device in local storage. Cloud accounts and sync are planned for later."
        }
      ]
    },
    entries: {
      title: "Entries",
      blocks: [
        {
          type: "p",
          html: "Entries are the people, teams, or resources you want to place — players, students, volunteers, and so on."
        },
        {
          type: "ol",
          items: [
            "Open the <strong>Entries</strong> step in the workflow sidebar.",
            "Import a CSV, or add rows by hand with <strong>+ Add entry</strong>.",
            "Set each column’s type (ID, Number, Text, Time, Ignore) so the generator reads fields correctly.",
            "Use the editor to fix messy cells — for example availability tags or teammate requests."
          ]
        },
        {
          type: "callout",
          html: "<strong>Multi-value cells.</strong> Separate several tags with semicolons, like <code>Mon;Wed</code> for availability."
        }
      ]
    },
    slots: {
      title: "Slots",
      blocks: [
        {
          type: "p",
          html: "Slots are the destinations — teams, events, rooms, or shifts that entries get assigned into."
        },
        {
          type: "ol",
          items: [
            "Open <strong>Slots</strong>.",
            "Import a CSV or add slots manually.",
            "Set <strong>min size</strong> and <strong>max size</strong> — these feed the generator’s hard capacity checks.",
            "Add attributes the rules will match against (practice night, time block, needs, and so on)."
          ]
        },
        {
          type: "callout",
          html: "<strong>Sizes matter.</strong> If every slot must be full, set matching min and max. Leave slack when the roster can be uneven."
        }
      ]
    },
    rules: {
      title: "Rules",
      blocks: [
        {
          type: "p",
          html: "Rules turn your constraints into something the search can score. There are four types: Cluster, Separate, Limit, and Balance."
        },
        {
          type: "ol",
          items: [
            "Open <strong>Rules</strong> and add a short list — start with what truly matters.",
            "Pick a type, point it at the right data fields, and set priority from 1–10.",
            "Mark a rule <strong>Hard</strong> only when a placement must never break it.",
            "Optional: set conflict groups so overlapping slots cannot be held by the same entry."
          ]
        },
        {
          type: "callout",
          html: "See the <strong>Explanations</strong> tab for what each rule type does, and hard vs soft scoring."
        }
      ]
    },
    review: {
      title: "Review",
      blocks: [
        {
          type: "p",
          html: "Review is a last look before you spend time searching — counts, sample rows, and the rule list in one place."
        },
        {
          type: "ul",
          items: [
            "Confirm slot counts and sizes look right.",
            "Skim the entry preview for missing IDs or empty critical fields.",
            "Check that hard rules and conflict groups match what you intended.",
            "Jump back to Entries, Slots, or Rules if anything looks off — then return here."
          ]
        }
      ]
    },
    generate: {
      title: "Generate",
      blocks: [
        {
          type: "p",
          html: "Generate runs many independent searches in your browser, keeps the best unique layouts, and stops when scores stop improving."
        },
        {
          type: "ol",
          items: [
            "Open <strong>Generate</strong> and click <strong>Generate</strong>.",
            "Watch status while attempts run — you will see how many options are kept.",
            "When it finishes, compare Option #1, #2, … by score.",
            "If you change data or rules later, generate again to refresh the set."
          ]
        },
        {
          type: "callout",
          html: "<strong>Up to five options.</strong> Near-duplicates are dropped so you compare meaningfully different layouts."
        }
      ]
    },
    results: {
      title: "Results & export",
      blocks: [
        {
          type: "p",
          html: "Results show who landed where. Pick an option, inspect it, then export when it feels right."
        },
        {
          type: "ol",
          items: [
            "Open <strong>Results</strong> and select an option from the ranked list.",
            "Toggle <strong>By slot</strong> or <strong>By entry</strong>, and List vs Grid, to review the roster.",
            "Check soft-rule tradeoffs if something looks unfair — then tweak rules and generate again.",
            "Use <strong>Export CSV</strong> when you are ready to share or publish the roster."
          ]
        }
      ]
    }
  },

  tutorials: {
    title: "Complete tutorials",
    lead: "End-to-end paths you can follow with sample presets or your own CSVs.",
    articles: [
      {
        title: "Sports teams in one sitting",
        blocks: [
          {
            type: "ol",
            items: [
              "Create a project named something like “Sports day roster”.",
              "Load the <strong>Sports teams</strong> preset when prompted (or use Load preset… later).",
              "Skim Entries — players have skill, role, availability, and teammate requests.",
              "Skim Slots — Team A / Team B with matching sizes and practice nights.",
              "Open Rules — keep Balance skill, teammate requests, availability, and the hard limits.",
              "Generate, open Results, and export the option you like."
            ]
          },
          {
            type: "callout",
            html: "After the first run, try raising or lowering a soft-rule priority and generate again to see how the roster shifts."
          }
        ]
      },
      {
        title: "Science Olympiad preferences",
        blocks: [
          {
            type: "ol",
            items: [
              "Create a project and load the <strong>Science Olympiad</strong> preset.",
              "Notice preference columns on entries and conflict groups by time block on slots.",
              "Review Cluster-style rules that honor ranked preferences.",
              "Generate and compare alternatives — preference satisfaction often differs across options.",
              "Export the layout you would defend to coaches and students."
            ]
          }
        ]
      },
      {
        title: "Volunteer shift coverage",
        blocks: [
          {
            type: "ol",
            items: [
              "Load the <strong>Volunteers</strong> preset into a new project.",
              "Check that strengths ↔ needs and availability ↔ time are set as Cluster rules.",
              "Add a Limit rule if a shift needs a minimum number of experienced volunteers.",
              "Generate, review By slot for thin coverage, then adjust and regenerate.",
              "Export CSV for your staffing sheet."
            ]
          }
        ]
      }
    ]
  },

  explanations: {
    title: "Explanations",
    lead: "How the building blocks work under the hood — without burying you in solver jargon.",
    articles: [
      {
        title: "The four rule types",
        blocks: [
          {
            type: "cards",
            items: [
              {
                title: "Cluster",
                body: "Keep matched people together, or place someone into a matching slot — teammate requests, preferences, overlapping availability."
              },
              {
                title: "Separate",
                body: "Spread similar participants apart — schools across teams, experienced players, people who should not share a slot."
              },
              {
                title: "Limit",
                body: "Cap or require counts per slot — maximum keepers, minimum coaches, or other filtered roles."
              },
              {
                title: "Balance",
                body: "Even out a number across slots — skill, age, or any numeric score you track on entries."
              }
            ]
          }
        ]
      },
      {
        title: "Hard vs soft, and priority",
        blocks: [
          {
            type: "ul",
            items: [
              "<strong>Hard</strong> rules reject illegal placements — they never break.",
              "<strong>Soft</strong> rules guide the score; partial success still counts.",
              "<strong>Priority 1–10</strong> tells the search what to protect first when tradeoffs appear."
            ]
          },
          {
            type: "callout",
            html: "Start soft for preferences and fairness. Promote a rule to hard only when a placement would be unacceptable."
          }
        ]
      },
      {
        title: "Conflict groups",
        blocks: [
          {
            type: "p",
            html: "Slots in the same conflict group cannot be held by the same entry at once — for example two events in the same time block."
          },
          {
            type: "p",
            html: "Set these under Rules → Global / Conflict groups. They act like hard schedule constraints."
          }
        ]
      },
      {
        title: "Where generation runs",
        blocks: [
          {
            type: "p",
            html: "For typical roster sizes, search runs <strong>in your browser</strong>. RapidRoster keeps the top unique layouts and stops early once a full set stops improving."
          },
          {
            type: "p",
            html: "You stay in control: the tool proposes, you review tradeoffs, then export."
          }
        ]
      }
    ]
  },

  tricks: {
    title: "Tricks",
    lead: "Small habits that keep rostering fast once you know the workflow.",
    articles: [
      {
        title: "Data hygiene",
        blocks: [
          {
            type: "ul",
            items: [
              "Name columns clearly before you write rules — <code>entries.skill</code> is easier than guessing.",
              "Use consistent tags (<code>Mon</code> vs <code>Monday</code>) so Cluster matches fire.",
              "Keep IDs stable if you re-import CSVs later."
            ]
          }
        ]
      },
      {
        title: "Rule writing",
        blocks: [
          {
            type: "ul",
            items: [
              "Begin with three to five rules; add more only when Results show a clear gap.",
              "Raise priority on the soft rule you care about most instead of making everything hard.",
              "After a change, generate again — do not assume the old options still apply."
            ]
          }
        ]
      },
      {
        title: "Presets as scaffolds",
        blocks: [
          {
            type: "p",
            html: "Load a preset, then replace sample names with your real roster. Keeping the column layout and rule shapes saves the most time."
          },
          {
            type: "actions",
            links: [
              { href: "/examples/", label: "Browse examples", primary: false },
              { href: "/app/", label: "Open App", primary: true }
            ]
          }
        ]
      },
      {
        title: "Reviewing options",
        blocks: [
          {
            type: "ul",
            items: [
              "Compare Option #1 against a lower-ranked option when a soft rule looks “almost” right.",
              "Flip By entry when one person looks misplaced — you will see their full assignment set.",
              "Export only after you would defend the roster to participants."
            ]
          }
        ]
      }
    ]
  }
};

function initDocsPage() {
  const tabsRoot = document.getElementById("docs-tabs");
  const sideRoot = document.getElementById("docs-side");
  const articleRoot = document.getElementById("docs-article");
  const layout = document.getElementById("docs-layout");

  if (tabsRoot === null || sideRoot === null || articleRoot === null || layout === null) {
    return;
  }

  const state = parseHash(window.location.hash);
  renderTabs(tabsRoot, state.tab);
  renderSide(sideRoot, layout, state);
  renderArticle(articleRoot, state);

  tabsRoot.addEventListener("click", function (event) {
    const btn = event.target.closest("[data-docs-tab]");
    if (btn === null) {
      return;
    }
    const tab = btn.getAttribute("data-docs-tab");
    setState({ tab: tab, step: defaultStepForTab(tab) });
  });

  sideRoot.addEventListener("click", function (event) {
    const btn = event.target.closest("[data-docs-step]");
    if (btn === null) {
      return;
    }
    setState({
      tab: "walkthroughs",
      step: btn.getAttribute("data-docs-step")
    });
  });

  window.addEventListener("hashchange", function () {
    const next = parseHash(window.location.hash);
    renderTabs(tabsRoot, next.tab);
    renderSide(sideRoot, layout, next);
    renderArticle(articleRoot, next);
  });
}

function setState(next) {
  const tab = normalizeTab(next.tab);
  let step = next.step;
  if (tab === "walkthroughs") {
    step = normalizeStep(step);
    window.location.hash = "walkthroughs/" + step;
  } else {
    window.location.hash = tab;
  }
}

function parseHash(hash) {
  const raw = String(hash || "").replace(/^#/, "");
  if (raw === "") {
    return { tab: "walkthroughs", step: "project" };
  }

  const parts = raw.split("/");
  const tab = normalizeTab(parts[0]);
  if (tab === "walkthroughs") {
    return { tab: tab, step: normalizeStep(parts[1]) };
  }
  return { tab: tab, step: null };
}

function normalizeTab(tab) {
  if (TAB_ORDER.indexOf(tab) !== -1) {
    return tab;
  }
  return "walkthroughs";
}

function normalizeStep(step) {
  for (let i = 0; i < WALKTHROUGH_STEPS.length; i = i + 1) {
    if (WALKTHROUGH_STEPS[i].id === step) {
      return step;
    }
  }
  return "project";
}

function defaultStepForTab(tab) {
  if (tab === "walkthroughs") {
    return "project";
  }
  return null;
}

function renderTabs(root, activeTab) {
  const labels = {
    walkthroughs: "Walkthroughs",
    tutorials: "Tutorials",
    explanations: "Explanations",
    tricks: "Tricks"
  };

  let html = "";
  for (let i = 0; i < TAB_ORDER.length; i = i + 1) {
    const id = TAB_ORDER[i];
    const selected = id === activeTab ? "true" : "false";
    html =
      html +
      '<li role="presentation">' +
      '<button class="docs-tab" type="button" role="tab" data-docs-tab="' +
      id +
      '" aria-selected="' +
      selected +
      '">' +
      labels[id] +
      "</button></li>";
  }
  root.innerHTML = html;
}

function renderSide(root, layout, state) {
  if (state.tab !== "walkthroughs") {
    root.hidden = true;
    layout.setAttribute("data-has-side", "false");
    root.innerHTML = "";
    return;
  }

  root.hidden = false;
  layout.setAttribute("data-has-side", "true");

  let html = '<p class="docs-side-label">Steps</p>';
  for (let i = 0; i < WALKTHROUGH_STEPS.length; i = i + 1) {
    const step = WALKTHROUGH_STEPS[i];
    const current = step.id === state.step ? ' aria-current="true"' : "";
    html =
      html +
      '<button class="docs-side-btn" type="button" data-docs-step="' +
      step.id +
      '"' +
      current +
      ">" +
      step.label +
      "</button>";
  }
  root.innerHTML = html;
}

function renderArticle(root, state) {
  if (state.tab === "walkthroughs") {
    const article = CONTENT.walkthroughs[state.step];
    root.innerHTML = renderSingleArticle(article);
    return;
  }

  const section = CONTENT[state.tab];
  let html =
    '<article class="docs-article">' +
    "<h2>" +
    escapeHtml(section.title) +
    "</h2>" +
    '<p>' +
    section.lead +
    "</p>";

  for (let i = 0; i < section.articles.length; i = i + 1) {
    const piece = section.articles[i];
    html = html + "<h3>" + escapeHtml(piece.title) + "</h3>";
    html = html + renderBlocks(piece.blocks);
  }

  html = html + "</article>";
  root.innerHTML = html;
}

function renderSingleArticle(article) {
  return (
    '<article class="docs-article">' +
    "<h2>" +
    escapeHtml(article.title) +
    "</h2>" +
    renderBlocks(article.blocks) +
    "</article>"
  );
}

function renderBlocks(blocks) {
  let html = "";
  for (let i = 0; i < blocks.length; i = i + 1) {
    const block = blocks[i];
    if (block.type === "p") {
      html = html + "<p>" + block.html + "</p>";
    } else if (block.type === "callout") {
      html = html + '<p class="docs-callout">' + block.html + "</p>";
    } else if (block.type === "ul" || block.type === "ol") {
      const tag = block.type;
      html = html + "<" + tag + ">";
      for (let j = 0; j < block.items.length; j = j + 1) {
        html = html + "<li>" + block.items[j] + "</li>";
      }
      html = html + "</" + tag + ">";
    } else if (block.type === "cards") {
      html = html + '<div class="docs-card-grid">';
      for (let j = 0; j < block.items.length; j = j + 1) {
        const card = block.items[j];
        html =
          html +
          '<article class="docs-card"><h3>' +
          escapeHtml(card.title) +
          "</h3><p>" +
          card.body +
          "</p></article>";
      }
      html = html + "</div>";
    } else if (block.type === "actions") {
      html = html + '<div class="docs-actions">';
      for (let j = 0; j < block.links.length; j = j + 1) {
        const link = block.links[j];
        const cls = link.primary
          ? "button button-primary"
          : "button button-secondary";
        html =
          html +
          '<a class="' +
          cls +
          '" href="' +
          link.href +
          '">' +
          escapeHtml(link.label) +
          "</a>";
      }
      html = html + "</div>";
    }
  }
  return html;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

initDocsPage();
