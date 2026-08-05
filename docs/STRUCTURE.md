rapid-roster/
├── frontend/
│   ├── index.html                     # Landing page
│   ├── about/index.html
│   ├── how-it-works/index.html
│   ├── ...marketing pages...
│   ├── app/
│   │   ├── index.html                 # Dashboard (roster list)
│   │   └── roster/index.html          # Main workspace (editor + generator)
│   ├── css/
│   │   ├── variables.css              # Design tokens (KEEP from existing)
│   │   ├── base.css                   # Reset + defaults
│   │   └── app/
│   │       ├── editors.css                # Editor styling (shared)
│   │       ├── app.css                # App shell
│   │       ├── dashboard.css
│   │       └── workspace.css          # Main workspace
│   ├── js/
│   │   ├── data/
│   │   │   ├── storage.js             # localStorage wrapper
│   │   │   ├── csv.js                 # CSV parse/serialize
│   │   │   └── download.js            # File download utility
│   │   ├── app/
│   │   │   ├── dashboard.js           # Dashboard page logic
│   │   │   └── workspace.js           # Workspace page (wires everything together)
│   │   ├── editors/
│   │   │   ├── editor.js              # Shared editor logic
│   │   │   ├── entries-editor.js
│   │   │   ├── slots-editor.js
│   │   │   └── rules-editor.js
│   │   ├── results-view.js
│   │   └── generator/                 # ENTIRELY inside web worker
│   │       ├── web-worker.js          # Worker bootstrap (postMessage handler)
│   │       ├── selector.js            # Data filtering
│   │       ├── rules.js               # Rule predicates + validation
│   │       ├── scorer.js              # Score calculation
│   │       ├── search.js              # Improvement exploration
│   │       └── engine.js              # Run orchestration
│   ├── presets/
│   │   ├── blank/
│   │   ├── sports/
│   │   ├── science-olympiad/
│   │   └── volunteers/
│   └── testdata/
│       └── sports-league-500/
└── docs/