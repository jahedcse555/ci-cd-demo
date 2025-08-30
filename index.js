const express = require("express");
const path = require("path");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true,
  })
);

// ===== Database =====
const db = new sqlite3.Database("./data/news.db");
db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'user')"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS news (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, body TEXT, author TEXT, image TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, deleted INTEGER DEFAULT 0)"
  );

  // Seed an admin if not exists
  db.get("SELECT * FROM users WHERE username='admin'", async (err, row) => {
    if (!row) {
      const hashed = await bcrypt.hash("admin123", 10);
      db.run(
        "INSERT INTO users (username, password, role) VALUES (?,?,?)",
        ["admin", hashed, "admin"]
      );
      console.log("✅ Admin user created (username: admin, password: admin123)");
    }
  });
});

// ===== File Upload =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// ===== Middleware =====
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/");
  }
  next();
}

// ===== Routes =====

// Home
app.get("/", (req, res) => {
  db.all("SELECT * FROM news WHERE deleted = 0 ORDER BY created_at DESC", [], (err, news) => {
    res.render("index", { news, user: req.session.user });
  });
});

// Register
app.get("/register", (req, res) => res.render("register", { error: null }));

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  db.run(
    "INSERT INTO users (username, password, role) VALUES (?,?,?)",
    [username, hashed, "user"],
    function (err) {
      if (err) return res.render("register", { error: "Username already exists" });
      res.redirect("/login");
    }
  );
});

// Login
app.get("/login", (req, res) => res.render("login", { error: null }));

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username=?", [username], async (err, user) => {
    if (!user) return res.render("login", { error: "Invalid username" });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render("login", { error: "Invalid password" });
    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.redirect("/");
  });
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// Write news
app.get("/news/new", requireLogin, (req, res) => {
  res.render("new-news", { user: req.session.user });
});

app.post("/news", requireLogin, upload.single("image"), (req, res) => {
  const { title, body } = req.body;
  const image = req.file ? "/uploads/" + req.file.filename : null;
  db.run(
    "INSERT INTO news (title, body, author, image) VALUES (?,?,?,?)",
    [title, body, req.session.user.username, image],
    () => res.redirect("/")
  );
});

// Read details
app.get("/news/:id", (req, res) => {
  db.get("SELECT * FROM news WHERE id=?", [req.params.id], (err, article) => {
    if (!article) return res.redirect("/");
    res.render("news-details", { article, user: req.session.user });
  });
});

// Edit
app.get("/news/:id/edit", requireLogin, (req, res) => {
  db.get("SELECT * FROM news WHERE id=?", [req.params.id], (err, article) => {
    if (
      !article ||
      (article.author !== req.session.user.username && req.session.user.role !== "admin")
    ) {
      return res.redirect("/");
    }
    res.render("edit-news", { article, user: req.session.user });
  });
});

app.post("/news/:id/edit", requireLogin, upload.single("image"), (req, res) => {
  const { title, body } = req.body;
  const image = req.file ? "/uploads/" + req.file.filename : null;
  db.get("SELECT * FROM news WHERE id=?", [req.params.id], (err, article) => {
    if (
      article.author !== req.session.user.username &&
      req.session.user.role !== "admin"
    )
      return res.redirect("/");
    db.run(
      "UPDATE news SET title=?, body=?, image=? WHERE id=?",
      [title, body, image || article.image, req.params.id],
      () => res.redirect("/news/" + req.params.id)
    );
  });
});

// Delete (soft delete)
app.post("/news/:id/delete", requireLogin, (req, res) => {
  db.get("SELECT * FROM news WHERE id=?", [req.params.id], (err, article) => {
    if (
      article.author !== req.session.user.username &&
      req.session.user.role !== "admin"
    )
      return res.redirect("/");
    db.run("UPDATE news SET deleted=1 WHERE id=?", [req.params.id], () =>
      res.redirect("/")
    );
  });
});

// ===== Admin Dashboard =====
app.get("/admin", requireAdmin, (req, res) => {
  db.all("SELECT * FROM users", [], (err, users) => {
    db.all("SELECT * FROM news ORDER BY created_at DESC", [], (err, news) => {
      res.render("admin-dashboard", { users, news, user: req.session.user });
    });
  });
});

// Promote user to admin
app.post("/admin/users/:id/promote", requireAdmin, (req, res) => {
  db.run("UPDATE users SET role='admin' WHERE id=?", [req.params.id], () =>
    res.redirect("/admin")
  );
});

// Demote admin to user
app.post("/admin/users/:id/demote", requireAdmin, (req, res) => {
  db.run("UPDATE users SET role='user' WHERE id=?", [req.params.id], () =>
    res.redirect("/admin")
  );
});

// Start
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
