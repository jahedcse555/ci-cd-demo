const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// setup db
const db = new sqlite3.Database("./news.db", (err) => {
  if (err) console.error("DB error", err);
  else console.log("Connected to SQLite DB");
});

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

app.get("/new", (req, res) => {
  res.render("new");
});

app.post("/new", (req, res) => {
  const { title, content } = req.body;
  db.run("INSERT INTO news (title, content) VALUES (?, ?)", [title, content], (err) => {
    if (err) throw err;
    res.redirect("/");
  });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
