/**
 * Copy canonical Customer UI design tokens from goldensoft-app into HR.
 *
 * Usage (from goldensoft-hr): npm run sync:design-tokens
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const hrRoot = path.resolve(__dirname, "..");
const suiteRoot = path.resolve(hrRoot, "..");
const src = path.join(suiteRoot, "goldensoft-app", "src", "app", "design-tokens.css");
const dest = path.join(hrRoot, "src", "app", "design-tokens.css");

if (!fs.existsSync(src)) {
  console.error(`[sync:design-tokens] Missing canonical file: ${src}`);
  process.exit(1);
}

const content = fs.readFileSync(src);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, content);

const hash = crypto.createHash("sha256").update(content).digest("hex");
console.log(`[sync:design-tokens] Copied app → HR (${content.length} bytes)`);
console.log(`[sync:design-tokens] sha256=${hash}`);
