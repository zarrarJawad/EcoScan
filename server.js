const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// SQLite Database Setup (File-based)
const db = new sqlite3.Database('ecoscan.db', (err) => {
  if (err) {
    console.error('Database error:', err);
    throw err;
  }
  console.log('Connected to SQLite database.');
});

// Initialize Database Tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    username TEXT,
    timestamp TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS leaderboard (
    username TEXT PRIMARY KEY,
    points INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    points INTEGER NOT NULL,
    date TEXT NOT NULL,
    username TEXT,
    completed INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS classifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    type TEXT NOT NULL,
    action TEXT NOT NULL,
    disposal TEXT NOT NULL,
    points INTEGER NOT NULL,
    timestamp TEXT NOT NULL
  )`);
});

// Multer for File Uploads
const upload = multer({ dest: 'uploads/' });

// Middleware for Input Validation
const validateRequest = (req, res, next) => {
  if (req.method === 'POST') {
    const { username } = req.body;
    if (['/classify', '/challenges', '/user'].includes(req.path) && !username) {
      return res.status(400).json({ error: 'Username is required.' });
    }
  }
  next();
};

app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use(validateRequest);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// Waste Classification Endpoint
app.post('/classify', upload.single('image'), (req, res, next) => {
  const { username } = req.body;
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded.' });
  }
  const classifications = [
    { type: 'Plastic', action: 'Recycle', disposal: 'blue recycling bin', points: 10 },
    { type: 'Paper', action: 'Recycle', disposal: 'paper recycling bin', points: 8 },
    { type: 'Organic', action: 'Compost', disposal: 'green compost bin', points: 12 },
    { type: 'Glass', action: 'Recycle', disposal: 'glass recycling bin', points: 10 },
    { type: 'Metal', action: 'Recycle', disposal: 'metal recycling bin', points: 10 }
  ];
  const result = classifications[Math.floor(Math.random() * classifications.length)];
  db.run(
    `INSERT INTO classifications (username, type, action, disposal, points, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
    [username, result.type, result.action, result.disposal, result.points, new Date().toISOString()],
    function(err) {
      if (err) return next(err);
      db.get(`SELECT points FROM leaderboard WHERE username = ?`, [username], (err, row) => {
        if (err) return next(err);
        const newPoints = (row ? row.points : 0) + result.points;
        db.run(
          `INSERT OR REPLACE INTO leaderboard (username, points) VALUES (?, ?)`,
          [username, newPoints],
          (err) => {
            if (err) return next(err);
            res.json(result);
          }
        );
      });
    }
  );
});

// Feedback Endpoint
app.post('/feedback', (req, res, next) => {
  const { feedback, username } = req.body;
  if (!feedback) {
    return res.status(400).json({ error: 'Feedback is required.' });
  }
  db.run(
    `INSERT INTO feedback (content, username, timestamp) VALUES (?, ?, ?)`,
    [feedback, username || 'Anonymous', new Date().toISOString()],
    (err) => {
      if (err) return next(err);
      res.status(200).json({ message: 'Feedback saved.' });
    }
  );
});

// Leaderboard Endpoints
app.get('/leaderboard', (req, res, next) => {
  db.all(
    `SELECT username, points FROM leaderboard ORDER BY points DESC LIMIT 5`,
    (err, rows) => {
      if (err) return next(err);
      res.json(rows);
    }
  );
});

app.post('/leaderboard', (req, res, next) => {
  const { username, points } = req.body;
  if (!username || points == null) {
    return res.status(400).json({ error: 'Username and points are required.' });
  }
  db.run(
    `INSERT OR REPLACE INTO leaderboard (username, points) VALUES (?, ?)`,
    [username, points],
    (err) => {
      if (err) return next(err);
      res.status(200).json({ message: 'Leaderboard updated.' });
    }
  );
});

// Guide Endpoint
app.get('/guide', (req, res) => {
  const searchTerm = req.query.search ? req.query.search.toLowerCase() : '';
  const guides = [
    { type: 'Plastic', instructions: 'Recycle in blue bins.' },
    { type: 'Paper', instructions: 'Recycle if clean, compost if soiled.' },
    { type: 'Organic', instructions: 'Compost in green bins.' },
    { type: 'Glass', instructions: 'Recycle in designated glass bins.' },
    { type: 'Metal', instructions: 'Recycle aluminum and steel cans.' }
  ];
  const filteredGuides = searchTerm 
    ? guides.filter(g => g.type.toLowerCase().includes(searchTerm) || g.instructions.toLowerCase().includes(searchTerm))
    : guides;
  res.json(filteredGuides);
});

// Challenges Endpoint
app.get('/challenges', (req, res, next) => {
  const username = req.query.username || '';
  const today = new Date().toDateString();
  db.all(
    `SELECT id, description, points, completed, username FROM challenges WHERE date = ?`,
    [today],
    (err, rows) => {
      if (err) return next(err);
      if (rows.length === 0) {
        const challenges = [
          { description: 'Classify 3 waste items today', points: 20 },
          { description: 'Recycle a plastic bottle', points: 15 },
          { description: 'Compost food scraps', points: 15 }
        ];
        challenges.forEach(c => {
          db.run(
            `INSERT INTO challenges (description, points, date, completed) VALUES (?, ?, ?, ?)`,
            [c.description, c.points, today, 0]
          );
        });
        db.all(
          `SELECT id, description, points, completed, username FROM challenges WHERE date = ?`,
          [today],
          (err, newRows) => {
            if (err) return next(err);
            res.json(newRows.map(r => ({ ...r, completed: r.completed && r.username === username ? 1 : 0 })));
          }
        );
      } else {
        res.json(rows.map(r => ({ ...r, completed: r.completed && r.username === username ? 1 : 0 })));
      }
    }
  );
});

app.post('/challenges', (req, res, next) => {
  const { challengeId, username } = req.body;
  if (!challengeId || !username) {
    return res.status(400).json({ error: 'Challenge ID and username required.' });
  }
  db.get(
    `SELECT points, completed, username FROM challenges WHERE id = ?`,
    [challengeId],
    (err, row) => {
      if (err) return next(err);
      if (!row || (row.completed && row.username === username)) {
        return res.status(400).json({ error: 'Challenge not found or already completed.' });
      }
      db.run(
        `UPDATE challenges SET completed = 1, username = ? WHERE id = ?`,
        [username, challengeId],
        (err) => {
          if (err) return next(err);
          db.get(
            `SELECT points FROM leaderboard WHERE username = ?`,
            [username],
            (err, rowLeader) => {
              if (err) return next(err);
              const newPoints = (rowLeader ? rowLeader.points : 0) + row.points;
              db.run(
                `INSERT OR REPLACE INTO leaderboard (username, points) VALUES (?, ?)`,
                [username, newPoints],
                (err) => {
                  if (err) return next(err);
                  res.json({ points: row.points });
                }
              );
            }
          );
        }
      );
    }
  );
});

// History Endpoint
app.get('/history', (req, res, next) => {
  const username = req.query.username || '';
  if (!username) {
    return res.status(400).json({ error: 'Username required.' });
  }
  db.all(
    `SELECT type, action, disposal, points, timestamp FROM classifications WHERE username = ? ORDER BY timestamp DESC`,
    [username],
    (err, rows) => {
      if (err) return next(err);
      res.json(rows);
    }
  );
});

// User Endpoint
app.post('/user', (req, res, next) => {
  const { username, points } = req.body;
  if (!username || points == null) {
    return res.status(400).json({ error: 'Username and points are required.' });
  }
  db.run(
    `INSERT OR REPLACE INTO leaderboard (username, points) VALUES (?, ?)`,
    [username, points],
    (err) => {
      if (err) return next(err);
      res.status(200).json({ message: 'User updated.' });
    }
  );
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});