const { Pool, types } = require('pg');

// Return DATE columns as 'YYYY-MM-DD' strings instead of timezone-shifted JS Dates.
types.setTypeParser(1082, (value) => value);
// Return NUMERIC as a JS number (amounts are capped well within safe range).
types.setTypeParser(1700, (value) => parseFloat(value));

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

module.exports = { pool };
