#!/usr/bin/env node
// Serves the exported web app (static assets + API routes) on any Node host.
//   npm run build:web && npm run serve
// On a host, set JANUARY_API_KEY in its environment. Locally it also reads .env, like `npm run web` does.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseEnv } from 'node:util';

import express from 'express';

const root = process.cwd();

// Variables already set in the environment win over the .env file.
try {
  for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8')))) {
    process.env[key] ??= value;
  }
} catch {
  // No .env file: use the environment as is.
}

// expo-server's ESM build uses extensionless imports that Node can't resolve; its CommonJS build works.
const { createRequestHandler } = createRequire(import.meta.url)('expo-server/adapter/express');

const app = express();
app.disable('x-powered-by');
app.use(express.static(path.join(root, 'dist/client'), { maxAge: '1h', extensions: ['html'] }));
app.use(createRequestHandler({ build: path.join(root, 'dist/server') }));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Forkcast is running at http://localhost:${port}`));
