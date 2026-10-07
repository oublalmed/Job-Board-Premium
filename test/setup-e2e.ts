// Route e2e tests to a dedicated database so they never pollute the dev/demo DB
// (`jobboard_dev`). Runs as a Jest `setupFiles` entry — i.e. before the app's
// ConfigModule / dotenv loads — and dotenv does not override an already-set
// process.env var, so this wins.
//
// Prerequisite (one-time): the database must exist and be migrated, e.g.
//   createdb jobboard_e2e   (or: CREATE DATABASE jobboard_e2e;)
//   DB_DATABASE=jobboard_e2e npm run migration:run
process.env['DB_DATABASE'] = process.env['E2E_DB_DATABASE'] || 'jobboard_e2e';
