/**
 * Injects the Styld Analytics tracker into all root-level *.html pages.
 * Run: node scripts/inject-styld-analytics.cjs
 */
const fs   = require('fs');
const path = require('path');

const root   = path.join(__dirname, '..');
const marker = 'styld-analytics.js';
const insert = `    <!-- Styld Analytics tracker -->\n    <script src="js/styld-tenant-config.js"></script>\n    <script defer src="js/styld-analytics.js"></script>\n`;

const files = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
let updated = 0;

for (const f of files) {
  const fp = path.join(root, f);
  let s = fs.readFileSync(fp, 'utf8');

  if (s.includes(marker)) {
    console.log('skip (already present):', f);
    continue;
  }

  // Insert just before </head>
  if (!s.includes('</head>')) {
    console.log('skip (no </head>):', f);
    continue;
  }

  s = s.replace(/(\n\s*<\/head>)/, '\n' + insert + '$1');
  fs.writeFileSync(fp, s, 'utf8');
  updated++;
  console.log('updated:', f);
}

console.log('done, updated:', updated);
