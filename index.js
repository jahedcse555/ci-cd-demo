const express = require("express");
const multer = require("multer");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: false
}));

// Multer for image upload
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ===== In-memory database =====
let users = [
  { id: 1, username: "admin", password: bcrypt.hashSync("admin", 10), role: "admin" }
];
let newsList = [];

// Make user available in views
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

// ===== Routes =====

// Home
app.get("/", (req, res) => res.render("index", { newsList }));

// News details
app.get("/news/:id", (req, res) => {
  const news = newsList.find(n => n.id == req.params.id);
  if (!news) return res.send("News not found");
  res.render("news-details", { news });
});

// Write news
app.get("/news/write", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("write-news");
});

app.post("/news", upload.single("image"), (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const { title, body, author } = req.body;
  newsList.push({
    id: Date.now(),
    title,
    body,
    author,
    image: req.file ? req.file.filename : null,
    user_id: req.session.user.id,
    created_at: new Date(),
    deleted: false
  });
  res.redirect("/");
});

// Edit news
app.get("/news/:id/edit", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const news = newsList.find(n => n.id == req.params.id);
  if (!news) return res.send("News not found");
  if (req.session.user.role !== "admin" && req.session.user.id !== news.user_id) return res.send("Unauthorized");
  res.render("edit-news", { news });
});

app.post("/news/:id/edit", upload.single("image"), (req, res) => {
  const news = newsList.find(n => n.id == req.params.id);
  if (!news) return res.send("News not found");
  if (req.session.user.role !== "admin" && req.session.user.id !== news.user_id) return res.send("Unauthorized");

  news.title = req.body.title;
  news.body = req.body.body;
  news.author = req.body.author;
  if (req.file) news.image = req.file.filename;
  res.redirect("/news/" + news.id);
});

// Delete news (soft delete)
app.post("/news/:id/delete", (req, res) => {
  const news = newsList.find(n => n.id == req.params.id);
  if (!news) return res.send("News not found");
  if (req.session.user.role !== "admin" && req.session.user.id !== news.user_id) return res.send("Unauthorized");
  news.deleted = true;
  res.redirect("/");
});

// ===== Login/Register =====
app.get("/register", (req, res) => res.render("register"));
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  users.push({ id: Date.now(), username, password: hashed, role: "user" });
  res.redirect("/login");
});

app.get("/login", (req, res) => res.render("login"));
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.user = user;
    res.redirect("/");
  } else {
    res.send("Invalid credentials");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
