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
  port: process.env.PORT,
});


db.connect((err) => {
    if (err) throw err;
    console.log("MySQL Connected!");
});

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

  // Fetch the user_id for the given username
  const getUserSql = "SELECT id FROM users WHERE username = ?";
  db.query(getUserSql, [username], (err, userResult) => {
      if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ success: false, message: "Database error" });
      }

      if (userResult.length === 0) {
          return res.status(400).json({ success: false, message: "User not found." });
      }

      const user_id = userResult[0].id;

      // Insert the order with the user_id
      const sql = "INSERT INTO orders (user_id, username, item_name, quantity) VALUES ?";
      const values = items.map((item) => [user_id, username, item.itemName, item.itemQuantity]);

      db.query(sql, [values], (err) => {
          if (err) throw err;
          res.json({ success: true, message: "Order submitted successfully!" });
      });
  });
});

app.get("/today-requests", (req, res) => {
  const sql = `
      SELECT o.id, o.item_name, o.quantity, o.timestamp, u.username 
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE DATE(o.timestamp) = CURDATE()
  `;
  db.query(sql, (err, result) => {
      if (err) throw err;
      res.json(result);
  });
});

app.get("/archives", (req, res) => {
  const sql = "SELECT DISTINCT DATE(timestamp) AS archive_date FROM archives ORDER BY archive_date DESC";
  db.query(sql, (err, result) => {
      if (err) throw err;

      // Format dates as day/month/year
      const formattedResult = result.map((row) => {
          const date = new Date(row.archive_date);
          const day = String(date.getDate()).padStart(2, '0'); // Ensure 2 digits
          const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
          const year = date.getFullYear();
          return { archive_date: `${day}/${month}/${year}` };
      });

      res.json(formattedResult);
  });
});

app.get("/archive-details", (req, res) => {
  const { date } = req.query;
  const sql = `
      SELECT a.item_name, a.quantity, a.timestamp, u.username 
      FROM archives a
      JOIN users u ON a.user_id = u.id
      WHERE DATE(a.timestamp) = ?
  `;
  db.query(sql, [date], (err, result) => {
      if (err) throw err;

      // Format the timestamp as day/month/year
      const formattedResult = result.map((row) => {
          const date = new Date(row.timestamp);
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          return {
              ...row,
              timestamp: `${day}/${month}/${year}`, // Format the timestamp
          };
      });

      res.json(formattedResult);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});