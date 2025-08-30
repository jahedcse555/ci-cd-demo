const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads folder
const uploadsDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// SQLite DB
const dbPath = path.join(__dirname, "data/news.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("DB error:", err);
  else console.log("Connected to SQLite DB");
});

// Create table
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// Multer config for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Routes
app.get("/", (req, res) => {
  db.all("SELECT * FROM news ORDER BY created_at DESC", [], (err, rows) => {
    if (err) throw err;
    res.render("index", { news: rows });
  });
});

app.get("/new", (req, res) => res.render("new"));

app.post("/new", upload.single("image"), (req, res) => {
  const { title, content, author } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  db.run(
    "INSERT INTO news (title, content, author, image) VALUES (?, ?, ?, ?)",
    [title, content, author, image],
    (err) => {
      if (err) throw err;
      res.redirect("/");
    }
  );
});

app.get("/edit/:id", (req, res) => {
  const id = req.params.id;
  db.get("SELECT * FROM news WHERE id = ?", [id], (err, row) => {
    if (err) throw err;
    res.render("edit", { article: row });
  });
});

app.post("/edit/:id", upload.single("image"), (req, res) => {
  const { title, content, author } = req.body;
  const id = req.params.id;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  if (image) {
    db.run(
      "UPDATE news SET title = ?, content = ?, author = ?, image = ? WHERE id = ?",
      [title, content, author, image, id],
      (err) => {
        if (err) throw err;
        res.redirect("/");
      }
    );
  } else {
    db.run(
      "UPDATE news SET title = ?, content = ?, author = ? WHERE id = ?",
      [title, content, author, id],
      (err) => {
        if (err) throw err;
        res.redirect("/");
      }
    );
  }
});

app.get("/delete/:id", (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM news WHERE id = ?", [id], (err) => {
    if (err) throw err;
    res.redirect("/");
  });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
