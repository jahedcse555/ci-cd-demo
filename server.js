const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads folder exists
const uploadPath = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Middleware
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({ secret: "secret-key", resave: false, saveUninitialized: false }));

// In-memory DB
let users = [];
let newsArticles = [];

// Routes
app.get("/", (req, res) => {
  res.render("index", { user: req.session.user || null, articles: newsArticles || [] });
});

// Register
app.get("/register", (req, res) => res.render("register", { user: req.session.user || null }));
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (users.find(u => u.username === username)) return res.send("User already exists!");
  const hashed = await bcrypt.hash(password, 10);
  users.push({ id: uuidv4(), username, password: hashed });
  res.redirect("/login");
});

// Login
app.get("/login", (req, res) => res.render("login", { user: req.session.user || null }));
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const found = users.find(u => u.username === username);
  if (!found) return res.send("Invalid credentials");
  const match = await bcrypt.compare(password, found.password);
  if (!match) return res.send("Invalid credentials");
  req.session.user = found;
  res.redirect("/");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// Write News
app.get("/write", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("write", { user: req.session.user });
});
app.post("/write", upload.single("image"), (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const { title, content } = req.body;
  const article = {
    id: uuidv4(),
    title,
    content,
    author: req.session.user.username,
    image: req.file ? `/uploads/${req.file.filename}` : null,
    createdAt: new Date()
  };
  newsArticles.push(article);
  res.redirect("/");
});

// News detail
app.get("/news/:id", (req, res) => {
  const article = newsArticles.find(a => a.id === req.params.id);
  if (!article) return res.status(404).send("News not found");
  res.render("detail", { user: req.session.user || null, article });
});

// Edit News
app.get("/news/:id/edit", (req, res) => {
  const article = newsArticles.find(a => a.id === req.params.id);
  if (!article || !req.session.user || article.author !== req.session.user.username) {
    return res.status(403).send("Not allowed");
  }
  res.render("write", { user: req.session.user, article });
});
app.post("/news/:id/edit", upload.single("image"), (req, res) => {
  const article = newsArticles.find(a => a.id === req.params.id);
  if (!article || !req.session.user || article.author !== req.session.user.username) {
    return res.status(403).send("Not allowed");
  }
  article.title = req.body.title;
  article.content = req.body.content;
  if (req.file) article.image = `/uploads/${req.file.filename}`;
  res.redirect(`/news/${article.id}`);
});

// Delete News
app.post("/news/:id/delete", (req, res) => {
  const index = newsArticles.findIndex(a => a.id === req.params.id);
  if (index === -1) return res.status(404).send("Not found");
  const article = newsArticles[index];
  if (!req.session.user || article.author !== req.session.user.username) {
    return res.status(403).send("Not allowed");
  }
  newsArticles.splice(index, 1);
  res.redirect("/");
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Internal Server Error");
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
