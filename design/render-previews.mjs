/** Render the exported .fig itself, then save PNGs for visual review. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const modules = process.env.OPENPENCIL_MODULES ??
  '/home/jplr/.local/lib/node_modules/@open-pencil/cli/node_modules';
const lib = (p) => import(pathToFileURL(path.join(modules, p)).href);
const { parseFigFile } = await lib('@open-pencil/core/dist/io/formats/fig/index.js');
const { headlessRenderNodes } = await lib('@open-pencil/core/dist/io/formats/raster/index.js');
const { fontManager } = await lib('@open-pencil/core/dist/text/index.js');
for (const [family, filename] of [['Inter', 'Inter.ttf'], ['Space Grotesk', 'SpaceGrotesk.ttf']]) {
  const b = await fs.readFile(path.join(here, 'fonts', filename));
  const data = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  for (const style of ['Regular', 'Medium', 'SemiBold', 'Semibold', 'Bold'])
    fontManager.markLoaded(family, style, data);
}
const data = await fs.readFile(path.join(here, 'Forma.fig'));
const graph = await parseFigFile(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), { populate: 'all' });
const report = JSON.parse(await fs.readFile(path.join(here, 'validation.json'), 'utf8'));
for (const spec of report.previews) {
  // GUIDs can be remapped by the native codec, so resolve by unique frame name.
  const node = [...graph.getAllNodes()].find(n => n.name === spec.name && n.type === 'FRAME');
  if (!node) throw new Error(`Missing exported frame ${spec.name}`);
  let page = graph.getNode(node.parentId);
  while (page.type !== 'CANVAS') page = graph.getNode(page.parentId);
  const png = await headlessRenderNodes(graph, page.id, [node.id], { scale: 1, format: 'PNG' });
  if (!png) throw new Error(`Cannot render ${spec.slug}`);
  await fs.writeFile(path.join(here, 'previews', `${spec.slug}.png`), png);
  console.log(`Rendered ${spec.slug}`);
}
