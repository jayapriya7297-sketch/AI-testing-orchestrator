CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user'))
);

CREATE TABLE expenses (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(200) NOT NULL,
  amount     NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category   TEXT NOT NULL,
  date       DATE NOT NULL,
  created_by INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX expenses_category_idx ON expenses (category);
