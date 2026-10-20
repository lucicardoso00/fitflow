/** Package exactly the current export, fonts and previews; no stale prototype frames. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const modules = process.env.OPENPENCIL_MODULES ?? '/home/jplr/.local/lib/node_modules/@open-pencil/cli/node_modules';
const { zipSync, unzipSync } = await import(pathToFileURL(path.join(modules, 'fflate/esm/index.mjs')));
const report = JSON.parse(await fs.readFile(path.join(here, 'validation.json'), 'utf8'));
const previewNames = report.previews.flatMap(p => [`${p.slug}.svg`, `${p.slug}.png`]);
for (const filename of await fs.readdir(path.join(here, 'previews'))) {
  if (/\.(png|svg)$/.test(filename) && !previewNames.includes(filename)) await fs.unlink(path.join(here, 'previews', filename));
}
const names = ['Forma.fig', 'OPEN-IN-FIGMA.txt', 'validation.json', 'prototype-validation.json',
  ...(await fs.readdir(path.join(here, 'fonts'))).map(name => `fonts/${name}`),
  ...previewNames.map(name => `previews/${name}`)];
const entries = Object.fromEntries(await Promise.all(names.map(async name => [name, new Uint8Array(await fs.readFile(path.join(here, name)))])));
const archive = zipSync(entries, { level: 6 });
const verified = unzipSync(archive);
if (Buffer.compare(Buffer.from(verified['Forma.fig']), Buffer.from(entries['Forma.fig']))) throw new Error('Bundle differs from exported file');
await fs.writeFile(path.join(here, 'Forma-design-kit.zip'), archive);
console.log(`Packaged ${names.length} files (${archive.length} bytes).`);
