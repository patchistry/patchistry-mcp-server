// Vercel serverless entry point — re-exports the Express app.
// Vercel auto-routes /api/* to functions; our vercel.json rewrites
// everything to /api/index, so this single function handles all routes.
import app from '../src/index.js';
export default app;
