// Root `npm start` entry point.
//
// Locally this brings up the Postgres container and runs the api + web dev
// servers. In a *deployed* environment (Railway, or anything with
// NODE_ENV=production) it must NOT touch Docker or the dev servers — it just
// starts the built API. Railway normally uses the `startCommand` from
// railway.json, but if it ever falls back to autodetecting this root `start`
// script, this guard keeps it from running `docker compose up` (which fails
// with "docker not found" in a container that has no Docker daemon).

import { spawn } from 'node:child_process';

// Treat anything with a Railway marker or a production NODE_ENV as "deployed".
const isDeployed =
  Boolean(process.env.RAILWAY_ENVIRONMENT) ||
  Boolean(process.env.RAILWAY_SERVICE_ID) ||
  Boolean(process.env.RAILWAY_PROJECT_ID) ||
  process.env.NODE_ENV === 'production';

// START_DRY_RUN=1 prints the decision and exits without spawning anything —
// used to verify the guard without side effects.
const dryRun = process.env.START_DRY_RUN === '1';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`\`${cmd} ${args.join(' ')}\` exited with code ${code}`)),
    );
  });
}

if (isDeployed) {
  console.log(
    '[start] Deployed environment detected — starting the built API (no Docker, no dev servers).',
  );
  if (dryRun) {
    console.log('[start] would run: npm --workspace apps/api run start');
  } else {
    await run('npm', ['--workspace', 'apps/api', 'run', 'start']);
  }
} else {
  console.log('[start] Local environment — bringing up Postgres, then api + web dev servers.');
  if (dryRun) {
    console.log('[start] would run: npm run db:up && concurrently npm:dev:api npm:dev:web');
  } else {
    await run('npm', ['run', 'db:up']);
    await run('concurrently', [
      '-k',
      '-n',
      'api,web',
      '-c',
      'blue.bold,green.bold',
      'npm:dev:api',
      'npm:dev:web',
    ]);
  }
}
