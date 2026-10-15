const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { signToken } = require('../auth');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const details = [];
    if (typeof email !== 'string' || email.trim() === '') {
      details.push({ field: 'email', message: 'Email is required' });
    }
    if (typeof password !== 'string' || password === '') {
      details.push({ field: 'password', message: 'Password is required' });
    }
    if (details.length) {
      return res.status(400).json({ error: 'Validation failed', details });
    }

    const { rows } = await pool.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
      [email.trim().toLowerCase()],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const publicUser = { id: user.id, email: user.email, role: user.role };
    return res.json({ token: signToken(publicUser), user: publicUser });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
