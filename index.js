const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// persistent db folder
const dbPath = path.join(__dirname, "data", "news.db");
const fs = require("fs");
if (!fs.existsSync(path.dirname(dbPath))) fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("DB error", err);
  else console.log("Connected to SQLite DB");
});

// create table if not exists
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// routes
app.get("/", (req, res) => {
  db.all("SELECT * FROM news ORDER BY created_at DESC", [], (err, rows) => {
    if (err) throw err;
    res.render("index", { news: rows });
  });
});

app.get("/new", (req, res) => res.render("new"));

app.post("/new", (req, res) => {
  const { title, content } = req.body;
  db.run("INSERT INTO news (title, content) VALUES (?, ?)", [title, content], (err) => {
    if (err) throw err;
    res.redirect("/");
  });
});

app.get("/edit/:id", (req, res) => {
  const id = req.params.id;
  db.get("SELECT * FROM news WHERE id = ?", [id], (err, row) => {
    if (err) throw err;
    res.render("edit", { article: row });
  });
});

app.post("/edit/:id", (req, res) => {
  const { title, content } = req.body;
  const id = req.params.id;
  db.run("UPDATE news SET title = ?, content = ? WHERE id = ?", [title, content, id], (err) => {
    if (err) throw err;
    res.redirect("/");
  });
});

app.get("/delete/:id", (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM news WHERE id = ?", [id], (err) => {
    if (err) throw err;
    res.redirect("/");
  });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
