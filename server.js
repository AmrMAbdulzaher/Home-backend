const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// MySQL Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) throw err;
  console.log("MySQL Connected!");
});

// CORS Configuration
const corsOptions = {
  origin: "https://homeforamr.vercel.app",
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Routes
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password are required." });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const checkUserSql = "SELECT * FROM users WHERE username = ?";
  db.query(checkUserSql, [username], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }
    if (result.length > 0) {
      return res.status(400).json({ success: false, message: "Username already exists." });
    }
    const insertUserSql = "INSERT INTO users (username, password) VALUES (?, ?)";
    db.query(insertUserSql, [username, hashedPassword], (err) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ success: false, message: "Database error" });
      }
      res.json({ success: true, message: "User registered successfully!" });
    });
  });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const sql = "SELECT * FROM users WHERE username = ?";
  db.query(sql, [username], async (err, result) => {
    if (err) throw err;
    if (result.length > 0) {
      const isValidPassword = await bcrypt.compare(password, result[0].password);
      if (isValidPassword) {
        res.json({ success: true, username });
      } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
      }
    } else {
      res.status(401).json({ success: false, message: "User not found" });
    }
  });
});

app.post("/submit-order", (req, res) => {
  const { username, items } = req.body;
  const sql = "INSERT INTO orders (username, item_name, quantity) VALUES ?";
  const values = items.map((item) => [username, item.itemName, item.itemQuantity]);
  db.query(sql, [values], (err) => {
    if (err) throw err;
    res.json({ success: true, message: "Order submitted successfully!" });
  });
});

app.get("/today-requests", (req, res) => {
  const sql = "SELECT * FROM orders WHERE DATE(timestamp) = CURDATE()";
  db.query(sql, (err, result) => {
    if (err) throw err;
    res.json(result);
  });
});

app.get("/archives", (req, res) => {
  const sql = "SELECT * FROM archives";
  db.query(sql, (err, result) => {
    if (err) throw err;
    res.json(result);
  });
});

// Export the app for Vercel
module.exports = app;
