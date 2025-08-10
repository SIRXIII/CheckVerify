-- Development-only policy to allow open inserts on reservations
-- Do NOT deploy to production

CREATE POLICY "dev-open-insert"
  ON reservations
  FOR INSERT
  TO public
  WITH CHECK (true);
