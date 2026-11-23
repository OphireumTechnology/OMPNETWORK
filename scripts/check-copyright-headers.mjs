/*
Copyright (c) 2026 Ophireum Multimedia Production. All rights reserved.
Developer and claimed rights holder: Ophireum Multimedia Production
DTI-registered business, Philippines | Registration No. 7567003
SPDX-FileCopyrightText: 2026 Ophireum Multimedia Production
SPDX-License-Identifier: LicenseRef-Ophireum-Proprietary
Third-party materials, dependencies, and separately licensed components remain subject to their respective rights and licenses.
*/

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const sourceExtensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.scss', '.sql', '.html',
]);
const excludedDirectories = new Set([
  '.git', 'node_modules', 'dist', 'coverage', '.next', '.turbo', 'vendor', 'third_party',
]);
const requiredHeader = 'SPDX-FileCopyrightText: 2026 Ophireum Multimedia Production';
const failures = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) walk(join(directory, entry.name));
      continue;
    }
    if (!entry.isFile()) continue;
    const path = join(directory, entry.name);
    const extension = entry.name.slice(entry.name.lastIndexOf('.'));
    if (!sourceExtensions.has(extension)) continue;
    const source = readFileSync(path, 'utf8');
    if (!source.includes(requiredHeader)) failures.push(relative(root, path));
  }
}

walk(root);
if (failures.length) {
  console.error('Missing Ophireum Multimedia Production copyright header:');
  for (const path of failures) console.error(` - ${path}`);
  process.exitCode = 1;
} else {
  console.log('Copyright header check passed for all first-party source files.');
}
