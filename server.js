import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

const DATA_FILE = path.join(__dirname, "storage", "data.json");

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

// GET /api/state — read the mutable app state
app.get("/api/state", (_req, res) => {
  const data = readJSON(DATA_FILE);
  if (!data) return res.json(null); // null = "no saved state yet"
  res.json(data);
});

// PUT /api/state — atomically write the mutable app state
app.put("/api/state", (req, res) => {
  try {
    writeJSONAtomic(DATA_FILE, req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to write state:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notes/:filename — read a markdown file
app.get("/api/notes/:filename", (req, res) => {
  const filePath = path.join(__dirname, "storage", "notes", req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
  try {
    const content = fs.readFileSync(filePath, "utf8");
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notes/:filename — write a markdown file
app.put("/api/notes/:filename", (req, res) => {
  const filePath = path.join(__dirname, "storage", "notes", req.params.filename);
  try {
    const tmp = filePath + ".tmp";
    fs.writeFileSync(tmp, req.body.content || "", "utf8");
    fs.renameSync(tmp, filePath);
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to write note:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n✅ Gains Planner server running on http://localhost:${PORT}`);
  console.log(`   State file : storage/app_state.json`);
  console.log(`   Gym data   : storage/gym_data.json\n`);
});
