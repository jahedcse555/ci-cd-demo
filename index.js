const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// SQLite DB
const dbPath = path.join(__dirname, "data/news.db");
if (!fs.existsSync(path.dirname(dbPath))) fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error(err);
  else console.log("Connected to SQLite DB");
});

// Create news table
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

// Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
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

app.get("/delete/:id", (req, res) => {
  db.run("DELETE FROM news WHERE id = ?", [req.params.id], (err) => {
    if (err) throw err;
    res.redirect("/");
  });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
