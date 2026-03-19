import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function processFile(filepath) {
  let content = readFileSync(filepath, "utf-8");
  let modified = false;

  const newContent = content.replace(
    /from ['"](\.\.\/[^'"]+)['"]/g,
    (match, path) => {
      if (!path.endsWith(".js")) {
        modified = true;
        if (!path.includes("/")) {
          return `from '${path}/index.js'`;
        }
        return `from '${path}.js'`;
      }
      return match;
    },
  );

  if (modified) {
    writeFileSync(filepath, newContent);
    console.log(`Fixed: ${filepath}`);
  }
}

function walkDir(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory() && !entry.includes("node_modules")) {
      walkDir(fullPath);
    } else if (stat.isFile() && extname(fullPath) === ".js") {
      processFile(fullPath);
    }
  }
}

walkDir(join(__dirname, "..", "dist"));
console.log("Import fixes complete");
