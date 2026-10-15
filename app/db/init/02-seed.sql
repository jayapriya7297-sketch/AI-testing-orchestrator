-- bcrypt hashes via pgcrypto; bcryptjs in the API verifies them.
INSERT INTO users (email, password_hash, role) VALUES
  ('admin@test.com', crypt('Admin123!', gen_salt('bf', 10)), 'admin'),
  ('user@test.com',  crypt('User123!',  gen_salt('bf', 10)), 'user');

INSERT INTO expenses (title, amount, category, date, created_by)
SELECT e.title, e.amount, e.category, e.date::date, u.id
FROM (VALUES
  ('Team lunch',              84.50, 'Food',          '2026-09-01', 'admin@test.com'),
  ('Flight to Berlin',       412.00, 'Travel',        '2026-09-02', 'admin@test.com'),
  ('Printer paper',           23.99, 'Office',        '2026-09-03', 'user@test.com'),
  ('Electricity bill',       120.75, 'Utilities',     '2026-09-04', 'admin@test.com'),
  ('Concert tickets',         95.00, 'Entertainment', '2026-09-05', 'user@test.com'),
  ('Coffee beans',            18.40, 'Food',          '2026-09-06', 'user@test.com'),
  ('Taxi to airport',         45.20, 'Travel',        '2026-09-07', 'admin@test.com'),
  ('Desk lamp',               39.99, 'Office',        '2026-09-08', 'user@test.com'),
  ('Internet subscription',   59.00, 'Utilities',     '2026-09-09', 'admin@test.com'),
  ('Movie night',             28.00, 'Entertainment', '2026-09-10', 'user@test.com'),
  ('Client dinner',          156.30, 'Food',          '2026-09-11', 'admin@test.com'),
  ('Hotel Munich',           289.00, 'Travel',        '2026-09-12', 'admin@test.com'),
  ('Ink cartridges',          64.95, 'Office',        '2026-09-13', 'user@test.com'),
  ('Water bill',              42.10, 'Utilities',     '2026-09-14', 'user@test.com'),
  ('Streaming service',       15.99, 'Entertainment', '2026-09-15', 'admin@test.com'),
  ('Courier delivery',        22.00, 'Other',         '2026-09-16', 'user@test.com'),
  ('Train ticket',            67.80, 'Travel',        '2026-09-17', 'user@test.com'),
  ('Groceries for workshop',  73.25, 'Food',          '2026-09-18', 'admin@test.com'),
  ('Conference badge holder', 12.50, 'Other',         '2026-09-19', 'admin@test.com'),
  ('Mobile phone plan',       35.00, 'Utilities',     '2026-09-20', 'user@test.com')
) AS e(title, amount, category, date, email)
JOIN users u ON u.email = e.email;
