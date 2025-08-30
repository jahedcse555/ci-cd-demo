const express = require("express");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(session({
  secret: "news_secret",
  resave: false,
  saveUninitialized: false
}));

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// In-memory database (replace with real DB in production)
let users = [];
let newsList = [];

// Middleware to check login
function checkAuth(req, res, next){
  if(req.session.user) next();
  else res.redirect("/login");
}

// ===== Routes =====

// Home
app.get("/", (req, res) => {
  res.render("index", { newsList, user: req.session.user });
});

// Login
app.get("/login", (req, res) => res.render("login"));
app.post("/login", async (req, res) => {
  const user = users.find(u => u.username === req.body.username);
  if(!user) return res.send("User not found");
  const match = await bcrypt.compare(req.body.password, user.password);
  if(match){
    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.redirect("/");
  } else res.send("Wrong password");
});

// Register
app.get("/register", (req, res) => res.render("register"));
app.post("/register", async (req, res) => {
  const hashed = await bcrypt.hash(req.body.password, 10);
  const newUser = { id: Date.now(), username: req.body.username, password: hashed, role: "user" };
  users.push(newUser);
  req.session.user = { id: newUser.id, username: newUser.username, role: newUser.role };
  res.redirect("/");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// Write news
app.get("/news/write", checkAuth, (req, res) => {
  res.render("write-news", { user: req.session.user });
});

app.post("/news", checkAuth, upload.single("image"), (req, res) => {
  const { title, body } = req.body;
  const author = req.session.user.username;
  const image = req.file ? req.file.filename : "default.jpg";
  newsList.push({
    id: Date.now(),
    title,
    body,
    author,
    user_id: req.session.user.id,
    image,
    created_at: new Date()
  });
  res.redirect("/");
});

// Edit news
app.get("/news/:id/edit", checkAuth, (req,res)=>{
  const news = newsList.find(n=>n.id==req.params.id);
  if(!news) return res.send("News not found");
  if(req.session.user.role!=="admin" && req.session.user.id!==news.user_id) return res.send("Not authorized");
  res.render("edit-news",{ news, user: req.session.user });
});

app.post("/news/:id/edit", checkAuth, upload.single("image"), (req,res)=>{
  const news = newsList.find(n=>n.id==req.params.id);
  if(!news) return res.send("News not found");
  if(req.session.user.role!=="admin" && req.session.user.id!==news.user_id) return res.send("Not authorized");
  news.title = req.body.title;
  news.body = req.body.body;
  if(req.file) news.image = req.file.filename;
  res.redirect(`/news/${news.id}`);
});

// Delete news
app.post("/news/:id/delete", checkAuth, (req,res)=>{
  const news = newsList.find(n=>n.id==req.params.id);
  if(!news) return res.send("News not found");
  if(req.session.user.role!=="admin" && req.session.user.id!==news.user_id) return res.send("Not authorized");
  newsList = newsList.filter(n=>n.id!=req.params.id);
  res.redirect("/");
});

// News details
app.get("/news/:id", (req,res)=>{
  const news = newsList.find(n=>n.id==req.params.id);
  if(!news) return res.send("News not found");
  res.render("news-details",{ news, user: req.session.user });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Server running on http://localhost:${PORT}`));
