/**
 * One-time / maintenance: inserts Vercel Web Analytics snippets before </head> in root *.html.
 * Run: node scripts/inject-vercel-analytics-html.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const insert = `    <!-- Vercel Web Analytics: enable in Vercel Project Settings > Analytics -->
    <script src="js/vercel-analytics-init.js"></script>
    <script defer src="/_vercel/insights/script.js"></script>
`;

const files = fs.readdirSync(root).filter((f) => f.endsWith(".html"));
let updated = 0;
for (const f of files) {
  const fp = path.join(root, f);
  let s = fs.readFileSync(fp, "utf8");
  if (s.includes("vercel-analytics-init")) {
    console.log("skip (already present):", f);
    continue;
  }
  if (!s.includes("</head>")) {
    console.log("skip (no </head>):", f);
    continue;
  }
  if (!s.includes("\n  </head>")) {
    console.log("skip (unexpected </head> format):", f);
    continue;
  }
  s = s.replace(/\n  <\/head>/, "\n" + insert + "  </head>");
  fs.writeFileSync(fp, s, "utf8");
  updated++;
  console.log("updated:", f);
}
console.log("done, updated:", updated);
