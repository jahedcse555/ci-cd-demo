const express = require("express");
const path = require("path");
const multer = require("multer");
const session = require("express-session");
const fs = require("fs");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads folder exists
const uploadPath = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Configure storage for uploaded images
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

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

app.set("view engine", "ejs");

// In-memory storage
let newsArticles = [];
let users = [];
let currentId = 1;

// Routes
app.get("/", (req, res) => {
  res.render("index", { articles: newsArticles, user: req.session.user });
});

app.get("/write", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("write", { user: req.session.user });
});

app.post("/write", upload.single("image"), (req, res) => {
  try {
    const { title, content } = req.body;
    const author = req.session.user ? req.session.user.username : "Anonymous";

    const newArticle = {
      id: currentId++,
      title,
      content,
      author,
      createdAt: new Date(),
      image: req.file ? `/uploads/${req.file.filename}` : null,
    };

    newsArticles.unshift(newArticle);
    res.redirect("/");
  } catch (err) {
    console.error("Error publishing news:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/news/:id", (req, res) => {
  const article = newsArticles.find((n) => n.id == req.params.id);
  if (!article) return res.status(404).send("News not found");
  res.render("details", { article, user: req.session.user });
});

app.get("/edit/:id", (req, res) => {
  const article = newsArticles.find((n) => n.id == req.params.id);
  if (!article) return res.status(404).send("News not found");
  if (!req.session.user || req.session.user.username !== article.author)
    return res.status(403).send("Not authorized");
  res.render("edit", { article, user: req.session.user });
});

app.post("/edit/:id", upload.single("image"), (req, res) => {
  const article = newsArticles.find((n) => n.id == req.params.id);
  if (!article) return res.status(404).send("News not found");
  if (!req.session.user || req.session.user.username !== article.author)
    return res.status(403).send("Not authorized");

  article.title = req.body.title;
  article.content = req.body.content;
  if (req.file) article.image = `/uploads/${req.file.filename}`;
  res.redirect("/news/" + article.id);
});

app.post("/delete/:id", (req, res) => {
  const article = newsArticles.find((n) => n.id == req.params.id);
  if (!article) return res.status(404).send("News not found");
  if (!req.session.user || req.session.user.username !== article.author)
    return res.status(403).send("Not authorized");

  newsArticles = newsArticles.filter((n) => n.id != req.params.id);
  res.redirect("/");
});

// Auth routes
app.get("/login", (req, res) => {
  res.render("login", { user: req.session.user, error: null });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);
  if (!user) {
    return res.render("login", { user: null, error: "Invalid credentials" });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.render("login", { user: null, error: "Invalid credentials" });
  }

  req.session.user = user;
  res.redirect("/");
});

app.get("/register", (req, res) => {
  res.render("register", { user: req.session.user, error: null });
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (users.find((u) => u.username === username)) {
    return res.render("register", { user: null, error: "Username already taken" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { username, password: hashedPassword };
  users.push(user);
  req.session.user = user;
  res.redirect("/");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
