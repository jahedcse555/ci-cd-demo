const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure folders exist
const uploadPath = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
if (!fs.existsSync("data")) fs.mkdirSync("data");
const NEWS_FILE = path.join(__dirname, "data/news.json");
const USERS_FILE = path.join(__dirname, "data/users.json");
if (!fs.existsSync(NEWS_FILE)) fs.writeFileSync(NEWS_FILE, "[]");
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");

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

// Load/save helpers
function loadNews() { return JSON.parse(fs.readFileSync(NEWS_FILE)); }
function saveNews(news) { fs.writeFileSync(NEWS_FILE, JSON.stringify(news, null, 2)); }
function loadUsers() { return JSON.parse(fs.readFileSync(USERS_FILE)); }
function saveUsers(users) { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }

// Routes
app.get("/", (req, res) => {
  res.render("index", { user: req.session.user || null, articles: loadNews() });
});

// Register
app.get("/register", (req, res) => res.render("register", { user: req.session.user || null }));
app.post("/register", async (req, res) => {
  const users = loadUsers();
  const { username, password } = req.body;
  if (users.find(u => u.username === username)) return res.send("User already exists!");
  const hashed = await bcrypt.hash(password, 10);
  users.push({ id: uuidv4(), username, password: hashed });
  saveUsers(users);
  res.redirect("/login");
});

// Login
app.get("/login", (req, res) => res.render("login", { user: req.session.user || null }));
app.post("/login", async (req, res) => {
  const users = loadUsers();
  const { username, password } = req.body;
  const found = users.find(u => u.username === username);
  if (!found) return res.send("Invalid credentials");
  const match = await bcrypt.compare(password, found.password);
  if (!match) return res.send("Invalid credentials");
  req.session.user = found;
  res.redirect("/");
});

// Logout
app.get("/logout", (req, res) => { req.session.destroy(() => res.redirect("/")); });

// Write News
app.get("/write", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("write", { user: req.session.user });
});
app.post("/write", upload.single("image"), (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const newsArticles = loadNews();
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
  saveNews(newsArticles);
  res.redirect("/");
});

// News detail
app.get("/news/:id", (req, res) => {
  const article = loadNews().find(a => a.id === req.params.id);
  if (!article) return res.status(404).send("News not found");
  res.render("detail", { user: req.session.user || null, article });
});

// Edit News
app.get("/news/:id/edit", (req, res) => {
  const article = loadNews().find(a => a.id === req.params.id);
  if (!article || !req.session.user || article.author !== req.session.user.username) return res.status(403).send("Not allowed");
  res.render("write", { user: req.session.user, article });
});
app.post("/news/:id/edit", upload.single("image"), (req, res) => {
  const newsArticles = loadNews();
  const article = newsArticles.find(a => a.id === req.params.id);
  if (!article || !req.session.user || article.author !== req.session.user.username) return res.status(403).send("Not allowed");
  article.title = req.body.title;
  article.content = req.body.content;
  if (req.file) article.image = `/uploads/${req.file.filename}`;
  saveNews(newsArticles);
  res.redirect(`/news/${article.id}`);
});

// Delete News
app.post("/news/:id/delete", (req, res) => {
  let newsArticles = loadNews();
  const index = newsArticles.findIndex(a => a.id === req.params.id);
  if (index === -1) return res.status(404).send("Not found");
  if (!req.session.user || newsArticles[index].author !== req.session.user.username) return res.status(403).send("Not allowed");
  newsArticles.splice(index, 1);
  saveNews(newsArticles);
  res.redirect("/");
});

// Global error handler
app.use((err, req, res, next) => { console.error(err); res.status(500).send("Internal Server Error"); });

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
