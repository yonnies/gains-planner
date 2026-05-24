import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

const STATE_FILE    = path.join(__dirname, "storage", "app_state.json");
const GYM_DATA_FILE = path.join(__dirname, "storage", "gym_data.json");

app.use(express.json({ limit: "10mb" }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

// Atomic write: write to a .tmp file first, then rename.
// This means a crash mid-write can NEVER corrupt your actual data file.
function writeJSONAtomic(filePath, data) {
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/gymdata — read the static exercise library seed
app.get("/api/gymdata", (_req, res) => {
  const data = readJSON(GYM_DATA_FILE);
  if (!data) return res.status(404).json({ error: "gym_data.json not found" });
  res.json(data);
});

// GET /api/state — read the mutable app state
app.get("/api/state", (_req, res) => {
  const data = readJSON(STATE_FILE);
  if (!data) return res.json(null); // null = "no saved state yet, use defaults"
  res.json(data);
});

// PUT /api/state — atomically write the mutable app state
app.put("/api/state", (req, res) => {
  try {
    writeJSONAtomic(STATE_FILE, req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to write state:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n✅ Gains Planner server running on http://localhost:${PORT}`);
  console.log(`   State file : storage/app_state.json`);
  console.log(`   Gym data   : storage/gym_data.json\n`);
});
