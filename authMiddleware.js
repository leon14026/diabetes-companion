export function requireAuth(req, res, next) {
  // For hackathon demo, allow everything.
  // Later you can add real auth here.
  next();
}
