/**
 * Sync shared site header nav + footer into every marketing HTML page.
 * Run: node scripts/sync-site-chrome.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "frontend");

const NAV_ITEMS = [
  { href: "/how-it-works/", label: "How it works" },
  { href: "/examples/", label: "Examples" },
  { href: "/docs/", label: "Docs" },
  { href: "/faq/", label: "FAQ" }
];

const SOCIAL = `
          <div class="site-footer-social" aria-label="Contact and links">
            <a
              class="site-footer-social-btn"
              href="mailto:joshuacheng.dev@gmail.com"
              aria-label="Email Joshua"
              title="Email"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
            </a>
            <a
              class="site-footer-social-btn"
              href="https://github.com/3rdVoyager/rapid-roster"
              aria-label="RapidRoster on GitHub"
              title="GitHub"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 .3C5.37.3 0 5.67 0 12.3c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.4s2.04.13 3 .4c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.28 0 .32.21.7.82.58C20.56 22.1 24 17.6 24 12.3 24 5.67 18.63.3 12 .3z" />
              </svg>
            </a>
          </div>`;

function buildNav(currentPath) {
  const links = NAV_ITEMS.map(function (item) {
    const current =
      item.href === currentPath ? ' aria-current="page"' : "";
    return (
      '        <a class="button button-tertiary" href="' +
      item.href +
      '"' +
      current +
      ">" +
      item.label +
      "</a>"
    );
  });

  const ctaCurrent =
    currentPath === "/get-started/" ? ' aria-current="page"' : "";
  links.push(
    '        <a class="button button-primary" href="/get-started/"' +
      ctaCurrent +
      ">Get started</a>"
  );

  return links.join("\n");
}

function buildFooterInner() {
  return (
    `      <div class="site-footer-main">
        <div class="site-footer-brand">
          <a class="site-brand" href="/">
            <img
              src="/assets/rapid-roster-logo.png"
              alt=""
              width="36"
              height="36"
            />
            <span>Rapid<span class="brand-accent">Roster</span></span>
          </a>
          <p>
            Place people into teams, events, shifts, and classrooms with clear
            rules — instead of fighting a spreadsheet.
          </p>
` +
    SOCIAL +
    `
        </div>

        <nav class="site-footer-nav" aria-label="Footer">
          <div class="site-footer-col">
            <h2>Product</h2>
            <ul>
              <li><a href="/get-started/">Get started</a></li>
              <li><a href="/sign-in/">Sign in</a></li>
              <li><a href="/how-it-works/">How it works</a></li>
              <li><a href="/examples/">Examples</a></li>
            </ul>
          </div>
          <div class="site-footer-col">
            <h2>Resources</h2>
            <ul>
              <li><a href="/docs/">Docs</a></li>
              <li><a href="/faq/">FAQ</a></li>
              <li><a href="/contact/">Contact</a></li>
            </ul>
          </div>
          <div class="site-footer-col">
            <h2>Project</h2>
            <ul>
              <li><a href="/about/">About</a></li>
              <li><a href="/privacy/">Privacy</a></li>
              <li><a href="/license/">License</a></li>
            </ul>
          </div>
        </nav>
      </div>

      <div class="site-footer-bottom">
        <p>RapidRoster — open source under the MIT License.</p>
      </div>`
  );
}

/** @returns {string[]} */
function collectHtmlFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (let i = 0; i < entries.length; i = i + 1) {
    const entry = entries[i];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip app workspace chrome
      if (entry.name === "app") {
        continue;
      }
      out.push.apply(out, collectHtmlFiles(full));
    } else if (entry.name === "index.html") {
      out.push(full);
    }
  }
  return out;
}

function pathKeyForFile(filePath) {
  const rel = path.relative(root, filePath).replace(/\\/g, "/");
  if (rel === "index.html") {
    return "/";
  }
  const dir = path.posix.dirname(rel);
  return "/" + dir + "/";
}

function replaceNav(html, navInner) {
  const re =
    /(<nav class="site-nav"[^>]*>)([\s\S]*?)(<\/nav>)/;
  if (re.test(html) === false) {
    return null;
  }
  return html.replace(re, "$1\n" + navInner + "\n      $3");
}

function replaceFooter(html, footerInner) {
  const re =
    /(<footer class="site-footer">)([\s\S]*?)(<\/footer>)/;
  if (re.test(html) === false) {
    return null;
  }
  return html.replace(re, "$1\n" + footerInner + "\n    $3");
}

const files = collectHtmlFiles(root);
const footerInner = buildFooterInner();
let updated = 0;

for (let i = 0; i < files.length; i = i + 1) {
  const file = files[i];
  let html = fs.readFileSync(file, "utf8");
  if (html.indexOf('class="site-header"') === -1) {
    continue;
  }

  const key = pathKeyForFile(file);
  const navInner = buildNav(key);
  let next = replaceNav(html, navInner);
  if (next === null) {
    console.log("skip nav:", path.relative(root, file));
    continue;
  }
  next = replaceFooter(next, footerInner);
  if (next === null) {
    console.log("skip footer:", path.relative(root, file));
    continue;
  }

  if (next !== html) {
    fs.writeFileSync(file, next, "utf8");
    updated = updated + 1;
    console.log("updated", path.relative(root, file), "(" + key + ")");
  } else {
    console.log("unchanged", path.relative(root, file));
  }
}

console.log("Done. Updated", updated, "files.");
