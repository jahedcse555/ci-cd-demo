const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure persistent data folder
const dbFolder = path.join(__dirname, "data");
if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true });

// SQLite database
const dbPath = path.join(dbFolder, "news.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("DB error:", err);
  else console.log("Connected to SQLite DB");
});

// Create news table if not exists (with author)
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// Routes

// Home - list all news
app.get("/", (req, res) => {
  db.all("SELECT * FROM news ORDER BY created_at DESC", [], (err, rows) => {
    if (err) throw err;
    res.render("index", { news: rows });
  });
});

// New news form
app.get("/new", (req, res) => res.render("new"));

// Add new article
app.post("/new", (req, res) => {
  const { title, content, author } = req.body;
  db.run(
    "INSERT INTO news (title, content, author) VALUES (?, ?, ?)",
    [title, content, author],
    (err) => {
      if (err) throw err;
      res.redirect("/");
    }
  );
});

// Edit news form
app.get("/edit/:id", (req, res) => {
  const id = req.params.id;
  db.get("SELECT * FROM news WHERE id = ?", [id], (err, row) => {
    if (err) throw err;
    res.render("edit", { article: row });
  });
});

// Update news
app.post("/edit/:id", (req, res) => {
  const { title, content, author } = req.body;
  const id = req.params.id;
  db.run(
    "UPDATE news SET title = ?, content = ?, author = ? WHERE id = ?",
    [title, content, author, id],
    (err) => {
      if (err) throw err;
      res.redirect("/");
    }
  );
});

// Delete news
app.get("/delete/:id", (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM news WHERE id = ?", [id], (err) => {
    if (err) throw err;
    res.redirect("/");
  });
});

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
