#!/usr/bin/env node
// Serves the exported web app (static assets + API routes) on any Node host.
//   npm run build:web && JANUARY_API_KEY=sk-... npm run serve
import { createRequire } from 'node:module';
import path from 'node:path';

import express from 'express';

// expo-server's ESM build uses extensionless imports that Node can't resolve; its CommonJS build works.
const { createRequestHandler } = createRequire(import.meta.url)('expo-server/adapter/express');

const root = process.cwd();
const app = express();
app.disable('x-powered-by');
app.use(express.static(path.join(root, 'dist/client'), { maxAge: '1h', extensions: ['html'] }));
app.use(createRequestHandler({ build: path.join(root, 'dist/server') }));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Forkcast is running at http://localhost:${port}`));
