const fs = require("fs");
const path = require("path");

const COUNTRY = "JP"; // Change later for TH / KR

function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(full);
      return;
    }

    if (entry.name.endsWith(".html") || entry.name.endsWith(".js")) {
      let content = fs.readFileSync(full, "utf8");

      // Replace old GitHub pages references → new clean domain paths
      content = content.replace(/https:\/\/tw-japan\.github\.io\/[^\/]+/g, match => {
        const parts = match.split("/");
        const trip = parts[3]; // folder name
        return `/${COUNTRY}/${trip}`;
      });

      fs.writeFileSync(full, content, "utf8");
      console.log("Fixed:", full);
    }
  });
}

walk(path.join(__dirname, COUNTRY));
console.log("✅ Rewrite complete.");
