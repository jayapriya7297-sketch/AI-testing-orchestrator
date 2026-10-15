const express = require('express');
const cors = require('cors');
const { pool } = require('./db');
const { requireAuth } = require('./auth');
const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');

const app = express();

app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'OK', db: 'up' });
  } catch {
    res.status(503).json({ status: 'ERROR', db: 'down' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/expenses', requireAuth, expenseRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(400).json({ error: 'Request body is too large' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
