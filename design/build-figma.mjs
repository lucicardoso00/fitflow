/**
 * Rebuild the editable Forma design from the repository and Stitch reference.
 * Uses the installed OpenPencil codec; the app itself has no new dependency.
 * Run: node design/build-figma.mjs
 * Override OPENPENCIL_MODULES if the CLI was installed somewhere else.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildPlan } from '../js/lib/planner.js';
import { finishFigmaExport } from './lib/figma-export.mjs';
import { buildPrototype } from './lib/prototype.mjs';
import { upgradeDesignSystem } from './lib/design-system.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const modules = process.env.OPENPENCIL_MODULES ??
  '/home/jplr/.local/lib/node_modules/@open-pencil/cli/node_modules';
const lib = (p) => import(pathToFileURL(path.join(modules, p)).href);
const { SceneGraph } = await lib('@open-pencil/scene-graph/dist/index.js');
const { exportFigFile, parseFigFile } = await lib('@open-pencil/core/dist/io/formats/fig/index.js');
const { createSVGNodes, renderNodesToSVG } = await lib('@open-pencil/core/dist/io/formats/svg/index.js');
const { computeAllLayouts } = await lib('@open-pencil/core/dist/layout.js');
const { fontManager } = await lib('@open-pencil/core/dist/text/index.js');
for (const [family, filename] of [['Inter', 'Inter.ttf'], ['Space Grotesk', 'SpaceGrotesk.ttf']]) {
  const bytes = await fs.readFile(path.join(here, 'fonts', filename));
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  for (const style of ['Regular', 'Medium', 'SemiBold', 'Semibold', 'Bold'])
    fontManager.markLoaded(family, style, data);
}

const graph = new SceneGraph();
for (const p of graph.getPages()) graph.deleteNode(p.id);
const C = {
  base: '#171A19', surface: '#212523', raised: '#292E2B', line: '#444A45',
  accent: '#C5F467', hover: '#B0DE50', soft: '#313C25',
  text: '#F5F6F2', secondary: '#AEB5AF', muted: '#727B74',
  success: '#4DAD72', warning: '#E5B842', error: '#FF5A5F',
};
const rgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255, a: 1 };
};
const fill = (hex) => ({ type: 'SOLID', color: rgb(C[hex] ?? hex), opacity: 1, visible: true });
const stroke = (hex, width = 1) => ({ ...fill(hex), weight: width, align: 'INSIDE' });
const collection = graph.createCollection('Forma / Foundations');
const colors = {};
for (const [key, hex] of Object.entries(C)) colors[key] =
  graph.createVariable(`Color/${key}`, 'COLOR', collection.id, rgb(hex)).id;
for (const value of [4, 8, 12, 16, 20, 24, 32, 40, 48, 64])
  graph.createVariable(`Space/${value}`, 'FLOAT', collection.id, value);
for (const [name, value] of Object.entries({ control: 8, card: 12, pill: 9999 }))
  graph.createVariable(`Radius/${name}`, 'FLOAT', collection.id, value);
const previews = [];
function node(type, parent, name, x, y, w, h, color = null, extra = {}) {
  const n = graph.createNode(type, parent.id, {
    name, x, y, width: w, height: h, fills: color ? [fill(color)] : [], ...extra,
  });
  if (colors[color]) graph.bindVariable(n.id, 'fills/0/color', colors[color]);
  return n;
}
const rect = (p, name, x, y, w, h, c, radius = 0, extra = {}) =>
  node('RECTANGLE', p, name, x, y, w, h, c, { cornerRadius: radius, ...extra });
const ellipse = (p, name, x, y, w, h, c, extra = {}) =>
  node('ELLIPSE', p, name, x, y, w, h, c, extra);
const frame = (p, name, x, y, w, h, c = 'base', extra = {}) =>
  node('FRAME', p, name, x, y, w, h, c, { clipsContent: true, ...extra });
function text(p, content, x, y, w, size = 16, color = 'text', weight = 400, extra = {}) {
  const lines = content.split('\n').length;
  return node('TEXT', p, content.replace(/\n/g, ' / '), x, y, w,
    (extra.lineHeight ?? Math.ceil(size * 1.4)) * lines, color, {
      text: content, fontFamily: size >= 28 ? 'Space Grotesk' : 'Inter',
      fontSize: size, fontWeight: weight, textAutoResize: 'HEIGHT',
      lineHeight: Math.ceil(size * 1.4), ...extra,
    });
}
function label(p, s, x, y, w = 400, c = 'secondary') {
  return text(p, s.toUpperCase(), x, y, w, 11, c, 600, { letterSpacing: 1.4 });
}
const line = (p, x, y, w) => rect(p, 'Divider', x, y, w, 1, 'line');
function page(name) {
  const p = graph.addPage(name);
  graph.updateNode(p.id, { fills: [fill('#0F1211')] });
  return p;
}
function board(p, name, w, h, x = 0, y = 0, slug = '') {
  const b = frame(p, name, x, y, w, h);
  if (slug) previews.push({ id: b.id, pageId: p.id, slug, name, width: w, height: h });
  return b;
}
function brand(p, x = 64, y = 28, compact = false) {
  const icon = frame(p, 'Forma mark', x, y + 4, 30, 30, 'accent', { cornerRadius: 6 });
  rect(icon, 'F / stem', 8, 7, 4, 17, 'base');
  rect(icon, 'F / top', 8, 7, 15, 4, 'base');
  rect(icon, 'F / middle', 8, 14, 11, 4, 'base');
  text(p, 'forma', x + 40, y - 2, 130, 28, 'text', 700, { letterSpacing: -1 });
  if (!compact) label(p, 'Make room for movement.', x + 196, y + 12, 360);
}
function header(p, active = 'Build', mobile = false) {
  const w = p.width;
  brand(p, mobile ? 24 : 64, mobile ? 24 : 24, mobile);
  const nav = active === 'Train' ? 'End workout' : mobile ? (active === 'Build' ? 'History' : 'Build again') : 'Build     /     History';
  text(p, nav,
    mobile ? w - 132 : w - 260, mobile ? 37 : 37, mobile ? 108 : 196, 14, 'secondary', 500,
    { textAlignHorizontal: 'RIGHT' });
  line(p, mobile ? 24 : 64, 88, w - (mobile ? 48 : 128));
}
function title(p, eyebrow, heading, sub, x = 64, y = 120, w = 1200, size = 44) {
  label(p, eyebrow, x, y, w, 'accent');
  text(p, heading, x, y + 28, w, size, 'text', 600, { letterSpacing: -1.6, lineHeight: size + 8 });
  if (sub) text(p, sub, x, y + 40 + size, w, 16, 'secondary');
}
function pill(p, s, x, y, w, selected = false) {
  const b = frame(p, s, x, y, w, 32, selected ? 'soft' : 'raised', { cornerRadius: 16 });
  text(b, s, 12, 7, w - 24, 12, selected ? 'accent' : 'secondary', 500);
  return b;
}

const pCover = page('00 / Start here');
const pTokens = page('01 / Foundations');
const pComponents = page('02 / Components');
const pDesktop = page('03 / Desktop');
const pMobile = page('04 / Mobile');
const pStates = page('05 / States');
const pFlow = page('06 / Flow & handoff');

// Actual master components. Screens below use instances of these masters.
const componentsBoard = board(pComponents, 'Forma / Component library', 1440, 1550, 0, 0, 'components');
title(componentsBoard, '02 / Reusable components', 'Small parts. One system.',
  'Edit a master to update its instances. Layout frames keep labels centered.');
const masters = {};
function buttonMaster(key, caption, bg, fg, x, y, outline = null) {
  const n = node('COMPONENT', componentsBoard, `Button/${key}`, x, y, 260, 52, bg, {
    cornerRadius: 8, layoutMode: 'HORIZONTAL', primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER', primaryAxisSizing: 'FIXED', counterAxisSizing: 'FIXED',
    paddingLeft: 20, paddingRight: 20, itemSpacing: 8,
    strokes: outline ? [stroke(outline, 2)] : [],
  });
  text(n, caption, 0, 0, 220, 15, fg, 600, { textAlignHorizontal: 'CENTER', layoutGrow: 1 });
  masters[key] = n;
  return n;
}
label(componentsBoard, 'Buttons / 52 px high', 64, 268);
buttonMaster('Primary', 'Start workout   →', 'accent', 'base', 64, 304);
buttonMaster('Hover', 'Start workout   →', 'hover', 'base', 356, 304);
buttonMaster('Focus', 'Start workout   →', 'accent', 'base', 648, 304, 'text');
buttonMaster('Disabled', 'Choose body areas', 'raised', 'secondary', 940, 304);
buttonMaster('Secondary', 'Save this plan', 'raised', 'text', 64, 414, 'line');
buttonMaster('Complete', 'Complete set   ✓', 'accent', 'base', 356, 414);
buttonMaster('Loading', 'Building your plan…', 'raised', 'secondary', 648, 414);
buttonMaster('Saved', 'Plan saved   ✓', 'soft', 'accent', 940, 414);
['Default', 'Hover', 'Focus / 2 px ring', 'Disabled'].forEach((s, i) =>
  text(componentsBoard, s, 64 + i * 292, 366, 260, 12, 'secondary'));
['Secondary', 'Set action', 'Loading', 'Saved / disabled'].forEach((s, i) =>
  text(componentsBoard, s, 64 + i * 292, 476, 260, 12, 'secondary'));
function button(p, caption, x, y, w = 260, key = 'Primary') {
  const master = masters[key];
  const n = graph.createInstance(master.id, p.id, { name: `Button / ${caption}`, x, y, width: w });
  const t = graph.getChildren(n.id)[0];
  graph.updateNode(t.id, { name: caption, text: caption, width: w - 40 });
  n.overrides[`${t.id}:text`] = caption;
  return n;
}
label(componentsBoard, 'Selection / always paired with a text label', 64, 552);
for (const [i, selected] of [false, true].entries()) {
  const m = node('COMPONENT', componentsBoard, `Chip/${selected ? 'Selected' : 'Default'}`,
    64 + i * 224, 592, 200, 48, selected ? 'soft' : 'raised', {
      cornerRadius: 8, strokes: [stroke(selected ? 'accent' : 'line')],
      layoutMode: 'HORIZONTAL', primaryAxisAlign: 'CENTER', counterAxisAlign: 'CENTER',
      primaryAxisSizing: 'FIXED', counterAxisSizing: 'FIXED',
      paddingLeft: 12, paddingRight: 12,
    });
  text(m, selected ? '✓' : '+', 0, 0, 16, 14, selected ? 'accent' : 'secondary', 500,
    { name: 'Indicator', textAlignHorizontal: 'CENTER' });
  text(m, selected ? 'Legs' : 'Shoulders', 0, 0, 152, 14,
    selected ? 'accent' : 'secondary', 500, { name: 'Label', textAlignHorizontal: 'CENTER', layoutGrow: 1 });
  masters[selected ? 'chipOn' : 'chipOff'] = m;
}
function chip(p, caption, x, y, w, selected = false) {
  const m = masters[selected ? 'chipOn' : 'chipOff'];
  const n = graph.createInstance(m.id, p.id, { name: `Area / ${caption}${selected ? ' / selected' : ''}`, x, y, width: w });
  const t = graph.getChildren(n.id).find(child => child.name === 'Label');
  graph.updateNode(t.id, { text: caption, name: 'Label', width: w - 40 });
  n.overrides[`${t.id}:text`] = t.text;
  return n;
}
for (const [i, s] of ['15 min · 4 moves', '30 min · 6 moves', '45 min · 8 moves'].entries())
  chip(componentsBoard, s, 64 + i * 224, 672, 200, i === 1);

const illustrationCache = {};
async function illustration(p, id, x, y, w, h) {
  let source = illustrationCache[id];
  if (!source) {
    source = await fs.readFile(path.join(root, `assets/images/exercises/${id}.svg`), 'utf8');
    for (const [a, b] of Object.entries({
      '#FFE3D6': '#292E2B', '#DFE5FF': '#292E2B', '#F1F3F7': '#292E2B',
      '#E2F0E8': '#292E2B',
      '#3D5AFE': '#C5F467', '#2C43C9': '#91AE53', '#FF6B3D': '#C5F467',
      '#131A2E': '#171A19', '#121A30': '#171A19', '#1B2440': '#353F34',
      '#FFFFFF': '#444A45',
    })) source = source.replaceAll(a, b);
    illustrationCache[id] = source;
  }
  source = source.replace('width="400"', `width="${w}"`).replace('height="300"', `height="${h}"`);
  const art = createSVGNodes(graph, p.id, source, { name: `Illustration / ${id} / editable vector`, x, y });
  graph.updateNode(art.id, { clipsContent: true, cornerRadius: 8 });
  return art;
}
const plan = buildPlan({ parts: ['core', 'legs'], minutes: 30, equipment: 'none' });
const target = (ex) => ex.seconds ? `3 × ${ex.seconds} sec` : `3 × ${ex.reps} ${ex.unit}`;
const rowMaster = node('COMPONENT', componentsBoard, 'Exercise row/Default', 64, 828, 576, 84, 'surface', {
  cornerRadius: 12, strokes: [stroke('line')],
});
rect(rowMaster, 'Thumbnail / background', 12, 12, 80, 60, 'raised', 8);
text(rowMaster, 'Plank', 112, 18, 292, 17, 'text', 600);
text(rowMaster, 'Core · 3 × 40 sec', 112, 47, 292, 13, 'secondary');
text(rowMaster, '01', 516, 29, 36, 17, 'secondary', 500, { textAlignHorizontal: 'RIGHT' });
graph.getChildren(rowMaster.id)[3].horizontalConstraint = 'MAX';
masters.row = rowMaster;
const rowCompact = graph.cloneTree(rowMaster.id, componentsBoard.id, {
  name: 'Exercise row/Compact', x: 704, y: 992, width: 342,
});
masters.rowCompact = rowCompact;
const [, compactHeading, compactDetail, compactIndex] = graph.getChildren(rowCompact.id);
graph.updateNode(compactHeading.id, { width: 170, fontSize: 15 });
graph.updateNode(compactDetail.id, { width: 202, fontSize: 11 });
graph.updateNode(compactIndex.id, { x: 294, width: 24 });
label(componentsBoard, 'Exercise list / source artwork is editable vector geometry', 64, 780);
async function exerciseRow(p, item, index, x, y, w, compact = false, state = '') {
  const wrapper = frame(p, `Exercise / ${index + 1} / ${item.exercise.name}`, x, y, w, 84, null);
  const n = graph.createInstance((compact ? rowCompact : rowMaster).id, wrapper.id, {
    name: `Exercise row / ${item.exercise.name}`, x: 0, y: 0, width: w,
    fills: [fill(state === 'active' ? 'soft' : 'surface')],
    strokes: state === 'active' ? [stroke('accent')] : [],
  });
  const [thumb, heading, detail, number] = graph.getChildren(n.id);
  graph.updateNode(heading.id, { text: item.exercise.name, width: w - 172, fontSize: compact ? 15 : 17 });
  graph.updateNode(detail.id, {
    text: `${item.partId === 'full-body' ? 'Full body' : item.partId[0].toUpperCase() + item.partId.slice(1)} · ${target(item.exercise)}`,
    width: w - 140, fontSize: compact ? 11 : 13,
  });
  graph.updateNode(number.id, { text: state === 'done' ? '✓' : String(index + 1).padStart(2, '0'), x: w - 48, width: 24 });
  for (const t of [heading, detail, number]) n.overrides[`${t.id}:text`] = t.text;
  if (state === 'active') graph.bindVariable(n.id, 'fills/0/color', colors.soft);
  await illustration(wrapper, item.exercise.id, thumb.x, thumb.y, thumb.width, thumb.height);
  return wrapper;
}
await exerciseRow(componentsBoard, plan[0], 0, 64, 932, 576, false, 'active');
await exerciseRow(componentsBoard, plan[1], 1, 704, 828, 576, false, 'done');
text(componentsBoard, 'Default → active → completed', 704, 934, 576, 17, 'secondary');
label(componentsBoard, 'Progress / exercise position', 64, 1060);
function progress(p, x, y, w, current = 0, done = false) {
  for (let i = 0; i < 6; i++) rect(p, `Progress / Exercise ${i + 1}`, x + i * (w + 8) / 6, y,
    (w - 40) / 6, 5, done || i < current ? 'accent' : i === current ? 'text' : 'line', 2);
}
progress(componentsBoard, 64, 1100, 576, 2);
text(componentsBoard, 'Exercise 3 of 6', 64, 1120, 576, 14, 'secondary');
label(componentsBoard, 'Status / meaning in words, not color alone', 64, 1200);
pill(componentsBoard, '✓  Plan saved', 64, 1244, 154, true);
pill(componentsBoard, 'No equipment', 242, 1244, 154);
text(componentsBoard, 'Could not save. Allow site storage and try again.', 64, 1330, 600, 15, 'error', 500);
text(componentsBoard, 'Minimum control target: 44 px. Body text: 16 px.\nMuted color is reserved for decorative or nonessential marks.',
  64, 1420, 1100, 15, 'secondary');

// Use the same front/back body regions as js/components/body-map.js.
const bodySource = await fs.readFile(path.join(root, 'js/components/body-map.js'), 'utf8');
const front = bodySource.match(/const FRONT = `([\s\S]*?)`;/)[1];
const back = bodySource.match(/const BACK = `([\s\S]*?)`;/)[1];
function bodyMap(p, x, y, w, selected = ['core', 'legs']) {
  const root = frame(p, 'Body map / front and back / editable vectors', x, y, w, w, null);
  const source = (front + back).replace(/<text[\s\S]*?<\/text>/g, '');
  const regions = [front, back].flatMap((side, index) => [...side.matchAll(/<g class="body-map__area" data-part="([^"]+)">([\s\S]*?)<\/g>/g)]
    .map(match => [match[0], match[1], index ? `<g transform="translate(140 0)">${match[2]}</g>` : match[2]]));
  const background = source.replace(/<g class="body-map__area" data-part="([^"]+)">[\s\S]*?<\/g>/g, '')
    .replaceAll('class="body-map__skin"', `fill="${C.raised}"`)
    .replaceAll('class="body-map__lines"', `fill="none" stroke="${C.base}" stroke-width="1.5"`);
  const svg = content => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" viewBox="0 0 260 260">${content}</svg>`;
  createSVGNodes(graph, root.id, svg(background), { name: 'Anatomy / background', x: 0, y: 0 });
  for (const id of new Set(regions.map(match => match[1]))) {
    const content = regions.filter(match => match[1] === id).map(match => match[2]).join('');
    createSVGNodes(graph, root.id, svg(`<g fill="${selected.includes(id) ? C.accent : C.line}">${content}</g>`),
      { name: `focus-${id}`, x: 0, y: 0 });
  }
  return root;
}

// Foundations and reference.
const foundations = board(pTokens, 'Forma / Foundations', 1440, 1230, 0, 0, 'foundations');
title(foundations, '01 / Design foundations', 'A focused visual language.',
  'Adapted from the supplied KINETIX Stitch reference. Product name and behavior come from Forma.');
label(foundations, 'Color / named variables', 64, 276);
const swatches = ['base', 'surface', 'raised', 'line', 'accent', 'text', 'secondary', 'success', 'warning', 'error'];
for (const [i, k] of swatches.entries()) {
  const x = 64 + i % 5 * 260, y = 316 + Math.floor(i / 5) * 156;
  rect(foundations, `Swatch / ${k}`, x, y, 228, 80, k, 8, { strokes: [stroke('line')] });
  text(foundations, k, x, y + 92, 140, 14, 'text', 600);
  text(foundations, C[k], x + 126, y + 92, 102, 12, 'secondary', 400, { textAlignHorizontal: 'RIGHT' });
}
line(foundations, 64, 636, 1312);
label(foundations, 'Typography', 64, 674);
text(foundations, 'Train with intention.', 64, 710, 860, 56, 'text', 600, { letterSpacing: -2 });
text(foundations, 'Space Grotesk / Semibold / Display 56 · Heading 44 · Title 28', 64, 796, 1100, 14, 'secondary');
text(foundations, 'A little time. A plan that fits.', 64, 844, 1000, 20, 'text', 500);
text(foundations, 'Inter / Regular 16 · Medium 14 · Semibold 15 · Label 11', 64, 884, 1100, 14, 'secondary');
line(foundations, 64, 936, 1312);
label(foundations, 'Spacing / 4 px base', 64, 970);
[4, 8, 12, 16, 24, 32, 48, 64].forEach((n, i) => {
  rect(foundations, `Space / ${n}`, 64 + i * 124, 1034 - n / 2, n, n, 'accent', 1);
  text(foundations, String(n), 64 + i * 124, 1084, 80, 13, 'secondary');
});
text(foundations, 'Control radius 8   /   Card radius 12   /   Pill radius 9999\nDesktop: 1440 px, 64 px margins. Mobile: 390 px, 24 px margins. Content adapts in one column.',
  64, 1144, 1312, 14, 'secondary');

// Desktop builder.
const builder = board(pDesktop, '01 / Build your workout', 1440, 1080, 0, 0, 'desktop-builder');
header(builder);
title(builder, 'Your session, your way', 'Build your workout.',
  'Choose your focus, set your time, and make the next move.');
const selection = frame(builder, 'Workout choices', 64, 270, 638, 648, 'surface', { cornerRadius: 12 });
label(selection, '01 / What are we training?', 24, 24);
text(selection, 'Choose your focus', 24, 56, 560, 26, 'text', 600);
bodyMap(selection, 20, 110, 264);
label(selection, 'Front', 68, 384, 90);
label(selection, 'Back', 204, 384, 90);
for (const [i, area] of ['Shoulders', 'Chest', 'Arms', 'Core', 'Back', 'Glutes', 'Legs'].entries())
  chip(selection, area, 314 + i % 2 * 148, 112 + Math.floor(i / 2) * 60, 136, ['Core', 'Legs'].includes(area));
chip(selection, 'Full body', 462, 292, 136);
text(selection, '2 body areas selected', 314, 366, 280, 13, 'secondary');
line(selection, 24, 428, 590);
label(selection, '02 / Time', 24, 452);
for (const [i, min] of [15, 30, 45].entries())
  chip(selection, `${min} min`, 24 + i * 196, 484, 184, min === 30);
label(selection, '03 / Equipment', 24, 556);
chip(selection, 'None', 24, 584, 282, true);
chip(selection, 'Dumbbells', 322, 584, 282);
label(builder, 'Your plan / 6 exercises', 734, 274);
text(builder, 'Core & legs', 734, 302, 500, 28, 'text', 600);
pill(builder, '30 min', 734, 350, 88);
pill(builder, 'No equipment', 834, 350, 148);
for (const [i, item] of plan.entries()) await exerciseRow(builder, item, i, 734, 406 + i * 88, 642);
const dock = frame(builder, 'Workout summary dock', 64, 962, 1312, 88, 'raised', { cornerRadius: 12 });
text(dock, 'Your next 30 minutes', 24, 16, 560, 20, 'text', 600);
text(dock, '6 exercises   ·   3 sets each   ·   45 sec rest', 24, 49, 630, 14, 'secondary');
button(dock, 'Start workout   →', 1000, 18, 288);

function desktopWorkout(name, slug, x, rest = false) {
  const b = board(pDesktop, name, 1440, 1000, x, 0, slug);
  header(b, 'Train');
  label(b, 'Core & legs / 30 min', 64, 120, 1000, 'accent');
  text(b, rest ? 'A moment to reset.' : 'Make this set count.', 64, 148, 1100, 44, 'text', 600, { letterSpacing: -1.6 });
  text(b, 'Exercise 2 of 6', 64, 220, 400, 14, 'secondary');
  progress(b, 64, 256, 1312, 1);
  return b;
}
const workout = desktopWorkout('02 / Workout / active set', 'desktop-workout', 1520);
const visual = frame(workout, 'Movement demonstration', 64, 296, 790, 590, 'raised', { cornerRadius: 12 });
await illustration(visual, 'squat', 0, 0, 790, 590);
pill(visual, 'BODYWEIGHT', 24, 24, 144, true);
const workoutInfo = frame(workout, 'Current set', 902, 296, 474, 590, null);
label(workoutInfo, 'Set 1 of 3', 0, 8, 400, 'accent');
text(workoutInfo, 'Squat', 0, 42, 474, 48, 'text', 600, { letterSpacing: -1 });
text(workoutInfo, 'Legs · Glutes', 0, 116, 474, 16, 'secondary');
text(workoutInfo, '12', 0, 166, 280, 112, 'text', 600, { lineHeight: 124, letterSpacing: -6 });
text(workoutInfo, 'reps', 172, 250, 180, 24, 'secondary', 400);
line(workoutInfo, 0, 330, 474);
label(workoutInfo, 'Up next', 0, 356);
text(workoutInfo, 'Squat · set 2', 0, 388, 474, 22, 'text', 500);
button(workoutInfo, 'Complete set   ✓', 0, 472, 474, 'Complete');
text(workout, 'Take your time. Complete the set when you are ready.', 64, 930, 900, 15, 'secondary');
const rest = desktopWorkout('03 / Workout / rest', 'desktop-rest', 3040, true);
label(rest, 'Rest between sets', 64, 310, 1312, 'accent');
text(rest, 'Breathe. You’re doing well.', 64, 350, 950, 32, 'text', 500);
text(rest, '00:45', 64, 424, 1000, 160, 'accent', 600, { letterSpacing: -8, lineHeight: 180 });
text(rest, 'NEXT UP', 72, 658, 600, 12, 'secondary', 600, { letterSpacing: 1.5 });
text(rest, 'Squat · set 2', 72, 694, 900, 28, 'text', 600);
const restCard = frame(rest, 'Next movement', 1000, 366, 376, 282, 'raised', { cornerRadius: 12 });
await illustration(restCard, 'squat', 0, 0, 376, 282);
button(rest, '+ 15 sec', 64, 830, 240, 'Secondary');
button(rest, 'Skip rest   →', 328, 830, 320);
text(rest, 'The next set starts when the timer ends.', 64, 916, 1000, 15, 'secondary');
const done = board(pDesktop, '04 / Workout complete', 1440, 1000, 4560, 0, 'desktop-done');
header(done, 'Done');
pill(done, '✓  WORKOUT COMPLETE', 64, 136, 232, true);
text(done, 'You showed up.\nThat’s what counts.', 64, 208, 900, 68, 'text', 600, { lineHeight: 76, letterSpacing: -2.5 });
text(done, 'Tuesday · Core & legs', 64, 394, 850, 18, 'secondary');
const stats = frame(done, 'Session results', 64, 480, 810, 166, 'surface', { cornerRadius: 12 });
for (const [i, [v, l]] of [['28', 'minutes'], ['6', 'exercises'], ['18', 'sets completed']].entries()) {
  text(stats, v, 32 + i * 264, 20, 230, 56, 'accent', 600, { letterSpacing: -2 });
  text(stats, l, 32 + i * 264, 108, 230, 14, 'secondary');
}
bodyMap(done, 950, 250, 350);
label(done, 'Today’s focus', 950, 644, 350);
pill(done, 'Core', 950, 682, 88, true);
pill(done, 'Legs', 1050, 682, 88, true);
text(done, 'Keep this plan for another day.', 64, 714, 800, 20, 'secondary');
button(done, 'Save this plan', 64, 776, 280, 'Secondary');
button(done, 'Build another workout   →', 368, 776, 360);
text(done, 'Saved on this device.', 64, 856, 800, 13, 'secondary');

// Mobile screens. Builder scrolls; workout controls remain in thumb reach.
const mobileBuild = board(pMobile, '01 / Build / scrollable content', 390, 1940, 0, 0, 'mobile-builder');
header(mobileBuild, 'Build', true);
title(mobileBuild, 'Your session, your way', 'Build your\nworkout.', 'A little time. A plan that fits.', 24, 116, 342, 40);
// Two-line heading uses explicit room for the supporting copy.
const sub = graph.getChildren(mobileBuild.id).find(n => n.text === 'A little time. A plan that fits.');
graph.updateNode(sub.id, { y: 250 });
label(mobileBuild, '01 / Focus', 24, 310, 342);
bodyMap(mobileBuild, 65, 350, 260);
for (const [i, area] of ['Shoulders', 'Chest', 'Arms', 'Core', 'Back', 'Glutes', 'Legs', 'Full body'].entries())
  chip(mobileBuild, area, 24 + i % 2 * 177, 630 + Math.floor(i / 2) * 56, 165, ['Core', 'Legs'].includes(area));
label(mobileBuild, '02 / Time', 24, 886, 342);
[15, 30, 45].forEach((min, i) => chip(mobileBuild, `${min} min`, 24 + i * 118, 922, 106, min === 30));
label(mobileBuild, '03 / Equipment', 24, 1002, 342);
chip(mobileBuild, 'None', 24, 1038, 165, true);
chip(mobileBuild, 'Dumbbells', 201, 1038, 165);
line(mobileBuild, 24, 1120, 342);
text(mobileBuild, 'Core & legs', 24, 1150, 342, 28, 'text', 600);
text(mobileBuild, '6 exercises · 3 sets · 45 sec rest', 24, 1200, 342, 14, 'secondary');
for (const [i, item] of plan.entries()) await exerciseRow(mobileBuild, item, i, 24, 1248 + i * 88, 342, true);
text(mobileBuild, 'Your next 30 minutes, ready to go.', 24, 1810, 342, 13, 'secondary');
button(mobileBuild, 'Start workout   →', 24, 1858, 342);

// Full-plan view is the continuation of the same mobile builder page.
const mobilePlan = board(pMobile, '02 / Build / plan continuation', 390, 900, 470, 0, 'mobile-plan');
header(mobilePlan, 'Build', true);
title(mobilePlan, 'Your plan', 'Core & legs', '30 min · No equipment', 24, 116, 342, 32);
for (const [i, item] of plan.entries()) await exerciseRow(mobilePlan, item, i, 24, 266 + i * 88, 342, true);
button(mobilePlan, 'Start workout   →', 24, 824, 342);
const mobileWorkout = board(pMobile, '03 / Workout / active set', 390, 844, 940, 0, 'mobile-workout');
header(mobileWorkout, 'Train', true);
label(mobileWorkout, 'Core & legs', 24, 112, 342, 'accent');
text(mobileWorkout, 'Exercise 2 of 6', 24, 144, 342, 14, 'secondary');
progress(mobileWorkout, 24, 182, 342, 1);
const mobileVisual = frame(mobileWorkout, 'Movement demonstration', 24, 214, 342, 256, 'raised', { cornerRadius: 12 });
await illustration(mobileVisual, 'squat', 0, 0, 342, 256);
label(mobileWorkout, 'Set 1 of 3', 24, 500, 342, 'accent');
text(mobileWorkout, 'Squat', 24, 530, 342, 36, 'text', 600);
text(mobileWorkout, '12', 24, 586, 140, 72, 'text', 600, { letterSpacing: -3, lineHeight: 84 });
text(mobileWorkout, 'reps', 134, 628, 140, 20, 'secondary');
text(mobileWorkout, 'Up next: Squat · set 2', 24, 704, 342, 14, 'secondary');
button(mobileWorkout, 'Complete set   ✓', 24, 760, 342, 'Complete');
const mobileRest = board(pMobile, '04 / Workout / rest', 390, 844, 1410, 0, 'mobile-rest');
header(mobileRest, 'Train', true);
label(mobileRest, 'Rest between sets', 24, 116, 342, 'accent');
text(mobileRest, 'A moment\nto reset.', 24, 156, 342, 44, 'text', 600, { lineHeight: 50, letterSpacing: -1.5 });
text(mobileRest, '00:45', 24, 316, 342, 96, 'accent', 600, { lineHeight: 116, letterSpacing: -5 });
label(mobileRest, 'Next up', 24, 498, 342);
text(mobileRest, 'Squat · set 2', 24, 530, 342, 28, 'text', 500);
text(mobileRest, 'The next set starts when\nthe timer ends.', 24, 594, 342, 16, 'secondary');
button(mobileRest, '+ 15 sec', 24, 686, 342, 'Secondary');
button(mobileRest, 'Skip rest   →', 24, 760, 342);
const mobileDone = board(pMobile, '05 / Workout complete', 390, 960, 1880, 0, 'mobile-done');
header(mobileDone, 'Done', true);
pill(mobileDone, '✓  WORKOUT COMPLETE', 24, 120, 232, true);
text(mobileDone, 'You showed up.\nThat counts.', 24, 182, 342, 36, 'text', 600, { lineHeight: 44, letterSpacing: -1.2 });
text(mobileDone, 'Tuesday · Core & legs', 24, 294, 342, 14, 'secondary');
const mobileStats = frame(mobileDone, 'Results', 24, 350, 342, 112, 'surface', { cornerRadius: 12 });
for (const [i, [v, l]] of [['28', 'min'], ['6', 'exercises'], ['18', 'sets']].entries()) {
  text(mobileStats, v, 16 + i * 110, 16, 94, 36, 'accent', 600);
  text(mobileStats, l, 16 + i * 110, 72, 94, 12, 'secondary');
}
bodyMap(mobileDone, 85, 492, 220);
text(mobileDone, 'Core & legs trained', 24, 728, 342, 14, 'secondary', 500, { textAlignHorizontal: 'CENTER' });
button(mobileDone, 'Save this plan', 24, 786, 342, 'Secondary');
button(mobileDone, 'Build another workout   →', 24, 856, 342);

// Explicit states help a student implement the complete interaction.
const states = board(pStates, 'Forma / Interaction states', 1440, 960, 0, 0, 'states');
title(states, '05 / State reference', 'Make every outcome clear.',
  'These are proposed UI states for the same three-page app, with implementation notes in the flow guide.');
for (const [i, [heading, body, caption, key]] of [
  ['Choose your focus', 'Select at least one body area\nto build your workout.', 'Choose body areas', 'Disabled'],
  ['Ready when you are', 'Your routine updates instantly\nas you choose your focus.', 'Start workout   →', 'Primary'],
  ['Keep your progress', 'Allow site storage to keep\nyour progress between pages.', 'Try again', 'Primary'],
].entries()) {
  const f = frame(states, ['Empty selection', 'Plan ready', 'Storage unavailable'][i], 64 + i * 440, 300, 416, 356, 'surface', { cornerRadius: 12 });
  label(f, ['Empty selection', 'Plan ready', 'Storage unavailable'][i], 24, 28, 368, i === 2 ? 'error' : 'accent');
  text(f, heading, 24, 84, 368, 24, 'text', 600);
  text(f, body, 24, 140, 368, 16, 'secondary');
  button(f, caption, 24, 264, 368, key);
}
label(states, 'Success / save once', 64, 730, 800, 'accent');
button(states, 'Plan saved   ✓', 64, 774, 368, 'Saved');
text(states, 'After saving, keep the confirmation visible and disable repeated saves.\nIf workout or summary data is missing, return to the builder.',
  488, 768, 860, 16, 'secondary');

// Cover: an editable overview, never a flattened mockup.
const cover = board(pCover, 'Forma / Design file', 1440, 960, 0, 0, 'cover');
brand(cover, 64, 48);
label(cover, 'Product design / Edition 01', 64, 168, 1000, 'accent');
text(cover, 'A little time.\nA stronger day.', 64, 224, 1000, 92, 'text', 600, { lineHeight: 98, letterSpacing: -4 });
text(cover, 'Forma’s workout flow, shaped by the supplied\nStitch design system.', 64, 458, 900, 24, 'secondary');
bodyMap(cover, 1080, 228, 280);
line(cover, 64, 602, 1312);
for (const [i, [n, a, b]] of [
  ['01', 'Foundations & components', 'Named variables, reusable masters, vector art'],
  ['02', 'Desktop & mobile', 'Build, train, rest, and finish'],
  ['03', 'Flow & handoff', 'Simple implementation map to the existing repo'],
].entries()) {
  const y = 646 + i * 86;
  text(cover, n, 64, y, 64, 24, 'accent', 500);
  text(cover, a, 148, y, 560, 22, 'text', 500);
  text(cover, b, 762, y + 4, 614, 15, 'secondary');
}
text(cover, 'FORMA × STITCH REFERENCE     /     20 OCT 2026', 64, 918, 1200, 11, 'secondary', 500, { letterSpacing: 1.3 });

const flow = board(pFlow, 'Forma / Flow and implementation guide', 1440, 1390, 0, 0, 'flow-handoff');
title(flow, '06 / Flow & handoff', 'Three pages. One clear loop.',
  'Plain HTML, CSS and browser JavaScript, hosted directly on GitHub Pages.');
const steps = [
  ['01 / Build', 'index.html', 'Select areas, time, equipment.\nReview 4, 6, or 8 exercises.\nStart saves the active workout.'],
  ['02 / Train + rest', 'workout.html', '3 sets per exercise.\n45 sec rest; add 15 sec or skip.\nFinish the last set to complete.'],
  ['03 / Complete', 'done.html', 'Show elapsed time and totals.\nSave a plan on this device.\nBuild another workout.'],
];
for (const [i, [a, b, c]] of steps.entries()) {
  const f = frame(flow, a, 64 + i * 448, 290, 416, 256, 'surface', { cornerRadius: 12 });
  label(f, a, 24, 24, 368, 'accent');
  text(f, b, 24, 66, 368, 24, 'text', 600);
  text(f, c, 24, 124, 368, 16, 'secondary', 400, { lineHeight: 28 });
  if (i < 2) text(flow, '→', 486 + i * 448, 390, 24, 24, 'accent');
}
label(flow, 'Component → implementation', 64, 598, 900);
const mapping = [
  ['Design variables', 'css/tokens.css', 'Translate the visual theme into CSS variables.'],
  ['Area chips + body map', 'js/components/body-map.js', 'Same seven areas. Text controls accompany the map.'],
  ['Plan preview', 'js/pages/builder.js', 'Build a plan locally from areas, minutes and equipment.'],
  ['Set + rest states', 'js/pages/workout.js', 'Complete set → rest → next set; finish on the last set.'],
  ['Summary + save', 'js/pages/done.js', 'Elapsed minutes, exercise count, total sets, save once.'],
];
for (const [i, [a, b, c]] of mapping.entries()) {
  const y = 646 + i * 64;
  text(flow, a, 64, y, 280, 15, 'text', 600);
  text(flow, b, 370, y, 420, 14, 'accent');
  text(flow, c, 810, y, 566, 14, 'secondary');
  line(flow, 64, y + 44, 1312);
}
label(flow, 'Implementation / Runtime and local data', 64, 1012, 1200);
for (const [i, [a, b]] of [
  ['Browser', 'HTML · CSS · JavaScript\nSession storage + local storage'],
  ['GitHub Pages', 'Static HTML · CSS · JavaScript\nNo server or build step'],
  ['Exercise catalogue', 'Local JavaScript data\njs/data/exercises.js'],
].entries()) {
  const f = frame(flow, a, 64 + i * 448, 1056, 416, 142, 'surface', { cornerRadius: 12 });
  text(f, a, 24, 20, 368, 20, 'text', 600);
  text(f, b, 24, 62, 368, 14, 'secondary');
  if (i < 2) text(flow, '→', 486 + i * 448, 1110, 24, 24, 'accent');
}
text(flow, 'SCOPE', 64, 1250, 150, 11, 'accent', 600, { letterSpacing: 1.5 });
text(flow, 'Use Present on the Desktop workout or Mobile workout starting point.\nChoose all areas, durations and equipment; complete sets, extend or skip rest, finish and save.\nNative variables and conditionals drive the complete prototype. Savings last for the session.',
  220, 1246, 1156, 15, 'secondary', 400, { lineHeight: 26 });

const prototype = await buildPrototype({ graph, node, frame, text, button, illustration, masters,
  componentsBoard, pDesktop, pMobile, builder, workout, rest, done,
  mobileBuild, mobilePlan, mobileWorkout, mobileRest, mobileDone, plan, fill, exerciseRow });
const system = upgradeDesignSystem({ graph, node, frame, text, componentsBoard, pTokens, fill, colors, C, bindings: prototype.bindings });
graph.deleteNode(mobilePlan.id);
previews.splice(previews.findIndex(p => p.id === mobilePlan.id), 1);
for (const viewport of ['Desktop', 'Mobile']) {
  const content = graph.getChildren(prototype.screens[viewport].builder.id).find(n => n.name.endsWith('Builder content'));
  previews.push({ id: content.id, pageId: content.parentId, name: content.name, slug: `${viewport.toLowerCase()}-builder-content`, width: content.width, height: content.height });
}

for (const preview of previews) {
  const target = graph.getNode(preview.id);
  preview.width = target.width; preview.height = target.height;
}

await fs.mkdir(path.join(here, 'previews'), { recursive: true });
computeAllLayouts(graph);
for (const preview of previews) {
  const target = graph.getNode(preview.id);
  preview.width = target.width; preview.height = target.height;
}
// Persist resized label geometry alongside native text overrides. Instance
// descendants are reconstructed from their masters when a .fig is imported.
for (const instance of [...graph.getAllNodes()].filter(n => n.type === 'INSTANCE')) {
  for (const child of graph.getChildren(instance.id).filter(n => n.type === 'TEXT')) {
    const master = graph.getNode(child.componentId);
    if (!master) continue;
    master.overrideKey = master.id;
    const [sessionID, localID] = master.id.split(':').map(Number);
    instance.source.fig.symbolOverrides.push({
      guidPath: { guids: [{ sessionID, localID }] },
      size: { x: child.width, y: child.height },
      fontSize: child.fontSize,
    });
  }
}
for (const p of previews) {
  const svg = renderNodesToSVG(graph, p.pageId, [p.id]);
  if (!svg) throw new Error(`Failed to render ${p.slug}`);
  await fs.writeFile(path.join(here, 'previews', `${p.slug}.svg`), svg);
}
const out = path.join(here, 'Forma.fig');
const exported = await exportFigFile(graph, undefined, undefined, pCover.id, true);
const finished = await finishFigmaExport(exported, { graph, lib, fontDirectory: path.join(here, 'fonts'), ...prototype });
await fs.writeFile(out, finished.bytes);
const data = await fs.readFile(out);
const reloaded = await parseFigFile(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), { populate: 'all' });
const all = [...reloaded.getAllNodes()];
const expectedOverrides = [...graph.getAllNodes()].filter(n => n.type === 'INSTANCE').map(n => ({
  name: n.name,
  text: graph.getChildren(n.id).filter(c => c.type === 'TEXT').map(c => c.text),
}));
for (const expected of expectedOverrides) {
  const candidates = all.filter(n => n.type === 'INSTANCE' && n.name === expected.name);
  if (!candidates.some(n => JSON.stringify(reloaded.getChildren(n.id).filter(c => c.type === 'TEXT').map(c => c.text)) === JSON.stringify(expected.text)))
    throw new Error(`Export lost instance content: ${expected.name}`);
}
const validation = {
  file: 'Forma.fig', format: 'Native Figma / OpenPencil', bytes: data.length,
  pages: reloaded.getPages().map(p => p.name),
  counts: Object.fromEntries(['TEXT', 'VECTOR', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'FRAME'].map(k => [k, all.filter(n => n.type === k).length])),
  variables: reloaded.variables.size, variableCollections: reloaded.variableCollections.size,
  autoLayoutNodes: all.filter(n => n.layoutMode !== 'NONE').length,
  boundNodes: all.filter(n => Object.keys(n.boundVariables ?? {}).length).length,
  previews, plan: plan.map(p => p.exercise.id),
  roundTrip: 'Exported and read back with the OpenPencil native .fig codec; every instance text override, nonempty glyph payload, and prototype destination verified',
  ...finished.report, ...system,
  prototypeScope: prototype.note,
  limitations: ['Native Figma import and Present mode not available in this session; binary text and prototype payloads validated after round trip.'],
};
if (validation.pages.length !== 7 || validation.counts.COMPONENT < 10 ||
    validation.counts.INSTANCE < 40 || validation.counts.TEXT < 100 || validation.variables < 20)
  throw new Error(`Round-trip validation failed: ${JSON.stringify(validation.counts)}`);
await fs.writeFile(path.join(here, 'validation.json'), JSON.stringify(validation, null, 2) + '\n');
console.log(JSON.stringify({ file: out, ...validation, previews: previews.length }, null, 2));
