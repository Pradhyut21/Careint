const fs = require("fs");
const path = require("path");
const http = require("http");

// Load env variables from .env.local manually to avoid extra dependencies
const envPath = path.resolve(__dirname, "../.env.local");
let seedSecret = "careloop_seed_secret";
let port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const secretMatch = envContent.match(/^SEED_SECRET\s*=\s*(.*)$/m);
  if (secretMatch && secretMatch[1]) {
    seedSecret = secretMatch[1].trim().replace(/['"]/g, "");
  }
  const portMatch = envContent.match(/^PORT\s*=\s*(.*)$/m);
  if (portMatch && portMatch[1]) {
    port = parseInt(portMatch[1].trim());
  }
}

console.log(`Connecting to CareLoop server on port ${port} to seed database (with reset)...`);
const url = `http://localhost:${port}/api/seed?secret=${seedSecret}&reset=true`;

http.get(url, (res) => {
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    if (res.statusCode === 200) {
      console.log("✅ Database seeded successfully!");
      try {
        console.log(JSON.parse(data));
      } catch (e) {
        console.log(data);
      }
    } else {
      console.error(`❌ Seeding failed with status ${res.statusCode}:`, data);
    }
  });
}).on("error", (err) => {
  console.error("❌ Error connecting to CareLoop server. Is the server running? Run 'npm run dev' first.");
  console.error(err.message);
});
