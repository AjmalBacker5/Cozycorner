// Minimal flat-file order store. Good enough for low volume; if orders pick
// up, swap this for a real database (Postgres, SQLite, etc.) — every other
// file only talks to this module's save/get/update functions, so that's the
// only place you'd need to change.

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "orders.json");

function readAll() {
  try {
    if (!fs.existsSync(DB_PATH)) return {};
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("[orderStore] read error:", err);
    return {};
  }
}

function writeAll(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function save(orderId, record) {
  const all = readAll();
  all[orderId] = { ...record, createdAt: new Date().toISOString() };
  writeAll(all);
}

function get(orderId) {
  return readAll()[orderId];
}

function update(orderId, patch) {
  const all = readAll();
  if (all[orderId]) {
    all[orderId] = { ...all[orderId], ...patch, updatedAt: new Date().toISOString() };
    writeAll(all);
  }
}

module.exports = { save, get, update };
