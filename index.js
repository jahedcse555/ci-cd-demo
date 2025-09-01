const express = require("express");
const path = require("path");
const multer = require("multer");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

// Configure storage for uploaded images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
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

// Temporary in-memory storage
let newsArticles = [];
let users = [];
let currentId = 1;

// Routes
app.get("/", (req, res) => {
  res.render("index", {
    articles: newsArticles,
    user: req.session.user,
  });
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

    newsArticles.push(newArticle);
    res.redirect("/");
  } catch (err) {
    console.error("Error publishing news:", err);
    res.status(500).send("Internal Server Error");
  }
});

// View single article
app.get("/news/:id", (req, res) => {
  const article = newsArticles.find((n) => n.id == req.params.id);
  if (!article) return res.status(404).send("News not found");
  res.render("details", { article, user: req.session.user });
});

// Edit article
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

// Delete article
app.post("/delete/:id", (req, res) => {
  const article = newsArticles.find((n) => n.id == req.params.id);
  if (!article) return res.status(404).send("News not found");
  if (!req.session.user || req.session.user.username !== article.author)
    return res.status(403).send("Not authorized");

  newsArticles = newsArticles.filter((n) => n.id != req.params.id);
  res.redirect("/");
});

// Login
app.get("/login", (req, res) => {
  res.render("login", { user: req.session.user });
});

app.post("/login", (req, res) => {
  const { username } = req.body;
  let user = users.find((u) => u.username === username);
  if (!user) {
    user = { username };
    users.push(user);
  }
  req.session.user = user;
  res.redirect("/");
});

// Register
app.get("/register", (req, res) => {
  res.render("register", { user: req.session.user });
});

app.post("/register", (req, res) => {
  const { username } = req.body;
  let user = users.find((u) => u.username === username);
  if (!user) {
    user = { username };
    users.push(user);
  }
  req.session.user = user;
  res.redirect("/");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
