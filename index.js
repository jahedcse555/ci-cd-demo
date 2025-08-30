const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(session({
  secret: "newsportal_secret_key",
  resave: false,
  saveUninitialized: true
}));

// DB and uploads folder
const uploadsDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const dbPath = path.join(__dirname, "data/news.db");
if (!fs.existsSync(path.dirname(dbPath))) fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new sqlite3.Database(dbPath);

// Tables
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user'
)`);

db.run(`CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  image TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted INTEGER DEFAULT 0
)`);

// Multer for images
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Auth middleware
function checkAuth(req, res, next){
  if(!req.session.user) return res.redirect("/login");
  next();
}

// Routes
app.get("/register", (req,res)=>res.render("register"));
app.post("/register", async (req,res)=>{
  const {username,password}=req.body;
  const hash = await bcrypt.hash(password,10);
  db.run("INSERT INTO users (username,password) VALUES (?,?)",[username,hash], err=>{
    if(err) return res.send("User exists");
    res.redirect("/login");
  });
});

app.get("/login",(req,res)=>res.render("login"));
app.post("/login",(req,res)=>{
  const {username,password}=req.body;
  db.get("SELECT * FROM users WHERE username=?",[username], async (err,user)=>{
    if(!user) return res.send("Invalid credentials");
    const match = await bcrypt.compare(password,user.password);
    if(!match) return res.send("Invalid credentials");
    req.session.user={username:user.username, role:user.role};
    res.redirect("/");
  });
});

app.get("/logout",(req,res)=>{
  req.session.destroy();
  res.redirect("/");
});

app.get("/",(req,res)=>{
  db.all("SELECT * FROM news WHERE deleted=0 ORDER BY created_at DESC",[],(err,rows)=>{
    if(err) throw err;
    rows = rows.map(row=>({...row, summary: row.content.length>200 ? row.content.slice(0,200)+"..." : row.content}));
    res.render("index",{news:rows,user:req.session.user});
  });
});

app.get("/new", checkAuth, (req,res)=>res.render("new",{user:req.session.user}));
app.post("/new", checkAuth, upload.single("image"), (req,res)=>{
  const {title,content} = req.body;
  const author = req.session.user.username;
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  db.run("INSERT INTO news (title,content,author,image) VALUES (?,?,?,?)",[title,content,author,image], err=>{
    if(err) throw err;
    res.redirect("/");
  });
});

app.get("/edit/:id", checkAuth, (req,res)=>{
  db.get("SELECT * FROM news WHERE id=? AND deleted=0",[req.params.id],(err,row)=>{
    if(!row) return res.send("News not found");
    if(row.author!==req.session.user.username && req.session.user.role!=="admin") return res.send("Not allowed");
    res.render("edit",{news:row,user:req.session.user});
  });
});

app.post("/edit/:id", checkAuth, upload.single("image"), (req,res)=>{
  const {title,content}=req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  const params = [title,content];
  let query = "UPDATE news SET title=?, content=?";
  if(image){ query+=", image=?"; params.push(image); }
  query+=" WHERE id=?";
  params.push(req.params.id);
  db.run(query, params, err=>{
    if(err) throw err;
    res.redirect("/");
  });
});

app.get("/delete/:id", checkAuth, (req,res)=>{
  db.get("SELECT * FROM news WHERE id=?",[req.params.id],(err,row)=>{
    if(!row) return res.send("News not found");
    if(row.author!==req.session.user.username && req.session.user.role!=="admin") return res.send("Not allowed");
    db.run("UPDATE news SET deleted=1 WHERE id=?",[req.params.id], err=>{
      if(err) throw err;
      res.redirect("/");
    });
  });
});

app.get("/news/:id",(req,res)=>{
  db.get("SELECT * FROM news WHERE id=? AND deleted=0",[req.params.id],(err,row)=>{
    if(!row) return res.send("News not found");
    res.render("details",{news:row,user:req.session.user});
  });
});

app.listen(PORT, ()=>console.log(`Server running on http://localhost:${PORT}`));
