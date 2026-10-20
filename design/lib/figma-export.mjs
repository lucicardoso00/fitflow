/** Complete Figma's native text/prototype payload, then validate the archive. */
import fs from 'node:fs/promises';
import path from 'node:path';

export async function finishFigmaExport(bytes, { graph, lib, fontDirectory, connections, starts, reactions = [], bindings = [], screens = {} }) {
  const { parseFigBuffer, writeFigArchive } = await lib('@open-pencil/fig/dist/index.js');
  const { getCompiledSchema } = await lib('@open-pencil/kiwi/dist/fig/codec.js');
  const { encodePathCommandsBlob } = await lib('@open-pencil/fig/dist/node-change.js');
  // The codec's CommonJS import of OpenType exposes no parse() in this Node runtime.
  // Import the ESM entry explicitly and bake glyphs without flattening text nodes.
  const { parse } = await lib('opentype.js/dist/opentype.mjs');
  const fonts = new Map();
  for (const [family, filename] of [['Inter', 'Inter.ttf'], ['Space Grotesk', 'SpaceGrotesk.ttf']]) {
    const data = await fs.readFile(path.join(fontDirectory, filename));
    fonts.set(family, parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)));
  }
  const data = parseFigBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const guid = (id) => `${id.sessionID}:${id.localID}`;
  const byId = new Map(data.nodeChanges.map(n => [guid(n.guid), n]));
  const byOverride = new Map(data.nodeChanges.filter(n => n.overrideKey).map(n => [guid(n.overrideKey), n]));
  const glyphCache = new Map();
  let textCount = 0;
  let overrideCount = 0;

  function textLayout(node) {
    const content = node.textData.characters;
    const font = fonts.get(node.fontName.family);
    if (!font) throw new Error(`No font loaded for ${node.fontName.family}`);
    const style = node.fontName.style.replaceAll(' ', '').toLowerCase();
    const weight = { regular: 400, medium: 500, semibold: 600, bold: 700 }[style] ?? 400;
    const size = node.fontSize;
    const lineHeight = node.lineHeight?.value ?? Math.ceil(size * 1.4);
    const tracking = node.letterSpacing?.value ?? 0;
    const options = { kerning: true, letterSpacing: tracking / size, variation: { wght: weight } };
    // These screens use Latin text. Direct glyph mapping avoids the parser's
    // unsupported contextual-substitution table while keeping kerning.
    function measure(value) {
      let advance = 0;
      let previous;
      for (const character of value) {
        const glyph = font.charToGlyph(character);
        if (previous) advance += font.getKerningValue(previous, glyph) / font.unitsPerEm * size;
        advance += (glyph.advanceWidth ?? 0) / font.unitsPerEm * size + tracking;
        previous = glyph;
      }
      return Math.max(0, advance - tracking);
    }
    const lines = [];
    let offset = 0;
    for (const paragraph of content.split('\n')) {
      let line = '';
      let start = offset;
      for (const token of paragraph.match(/\S+\s*|\s+/g) ?? []) {
        if (line && measure((line + token).trimEnd()) > node.size.x) {
          lines.push({ text: line.trimEnd(), start });
          start += line.length;
          line = '';
        }
        line += token;
      }
      lines.push({ text: line.trimEnd(), start });
      offset += paragraph.length + 1;
    }
    const glyphs = [];
    const baselines = [];
    const offsets = Array(content.length + 1).fill(0);
    const ascent = font.ascender / font.unitsPerEm * size;
    const descent = -font.descender / font.unitsPerEm * size;
    const firstBaseline = (lineHeight - ascent - descent) / 2 + ascent;
    for (const [index, line] of lines.entries()) {
      const width = measure(line.text);
      const x = node.textAlignHorizontal === 'CENTER' ? (node.size.x - width) / 2
        : node.textAlignHorizontal === 'RIGHT' ? node.size.x - width : 0;
      const y = firstBaseline + index * lineHeight;
      let character = line.start;
      let gx = x;
      let previous;
      for (const letter of line.text) {
        const glyph = font.charToGlyph(letter);
        if (previous) gx += font.getKerningValue(previous, glyph) / font.unitsPerEm * size;
        const gy = y;
        const fontSize = size;
        const renderOptions = options;
        const cacheKey = `${node.fontName.family}:${weight}:${glyph.index}`;
        let commandsBlob = glyphCache.get(cacheKey);
        if (commandsBlob === undefined) {
          const commands = glyph.getPath(0, 0, fontSize, renderOptions, font).commands;
          commandsBlob = data.blobs.push(encodePathCommandsBlob(commands, fontSize)) - 1;
          glyphCache.set(cacheKey, commandsBlob);
        }
        glyphs.push({ commandsBlob, position: { x: gx, y: gy }, fontSize,
          firstCharacter: character, advance: (glyph.advanceWidth ?? 0) / font.unitsPerEm * size, rotation: 0 });
        offsets[character] = gx;
        character += letter.length;
        gx += (glyph.advanceWidth ?? 0) / font.unitsPerEm * size + tracking;
        previous = glyph;
      }
      offsets[line.start + line.text.length] = x + width;
      baselines.push({ position: { x, y }, width, lineHeight, lineAscent: ascent,
        firstCharacter: line.start, endCharacter: line.start + line.text.length });
    }
    if (content.trim() && !glyphs.length) throw new Error(`Missing glyphs: ${content}`);
    return {
      layoutSize: { x: node.size.x, y: Math.max(node.size.y, lineHeight * lines.length) },
      baselines, glyphs,
      fontMetaData: [{ key: node.fontName, fontLineHeight: lineHeight / size,
        fontStyle: 'NORMAL', fontWeight: weight }],
      logicalIndexToCharacterOffsetMap: offsets,
      derivedLines: lines.map(() => ({ directionality: 'LTR' })),
      truncationStartIndex: -1, truncatedHeight: -1,
    };
  }

  for (const node of data.nodeChanges) {
    if (node.type === 'TEXT' && node.textData?.characters) {
      node.derivedTextData = textLayout(node);
      textCount++;
    }
    for (const override of node.symbolData?.symbolOverrides ?? []) {
      if (!override.textData?.characters) continue;
      const key = guid(override.guidPath.guids.at(-1));
      const master = byOverride.get(key) ?? byId.get(key);
      if (!master || master.type !== 'TEXT') throw new Error(`Missing text master for ${node.name}`);
      override.derivedTextData = textLayout({ ...master, ...override });
      overrideCount++;
    }
  }

  function sourcePath(node) {
    const names = [];
    while (node && node.type !== 'DOCUMENT') {
      names.unshift(node.name);
      if (node.type === 'CANVAS') break;
      node = graph.getNode(node.parentId);
    }
    return JSON.stringify(names);
  }
  function exportedPath(node) {
    const names = [];
    while (node && node.type !== 'DOCUMENT') {
      names.unshift(node.name);
      if (node.type === 'CANVAS') break;
      node = node.parentIndex ? byId.get(guid(node.parentIndex.guid)) : null;
    }
    return JSON.stringify(names);
  }
  const byPath = new Map(data.nodeChanges.map(n => [exportedPath(n), n]));
  const exported = node => {
    const result = byPath.get(sourcePath(node));
    if (!result) throw new Error(`Export lost node ${sourcePath(node)}`);
    return result;
  };
  const nativeVariables = new Map(data.nodeChanges.filter(n => n.type === 'VARIABLE').map(n => [n.name, n]));
  const variable = name => {
    const found = nativeVariables.get(name);
    if (!found) throw new Error(`Missing exported variable ${name}`);
    return found;
  };
  function value(input) {
    if (input.type === 'VARIABLE_ALIAS') {
      const v = variable(input.name);
      return { dataType: 'ALIAS', resolvedDataType: v.variableResolvedType,
        value: { alias: { guid: v.guid } } };
    }
    if (input.type === 'EXPRESSION') return { dataType: 'EXPRESSION',
      resolvedDataType: ['EQUALS', 'LESS_THAN_OR_EQUAL', 'GREATER_THAN', 'NOT'].includes(input.operator) ? 'BOOLEAN'
        : input.operator === 'ADDITION' && input.args.some(arg => value(arg).resolvedDataType === 'STRING') ? 'STRING' : 'FLOAT',
      value: { expressionValue: { expressionFunction: input.operator, expressionArguments: input.args.map(value) } } };
    return { dataType: input.type, resolvedDataType: input.type,
      value: { [{ STRING: 'textValue', FLOAT: 'floatValue', BOOLEAN: 'boolValue', COLOR: 'colorValue' }[input.type]]: input.value } };
  }
  function actions(source, viewport) {
    return source.map(action => {
      if (action.type === 'NODE') return { connectionType: 'INTERNAL_NODE', navigationType: 'NAVIGATE',
        transitionNodeID: exported(screens[viewport][action.destination]).guid,
        transitionType: 'INSTANT_TRANSITION', transitionDuration: 0, transitionResetScrollPosition: action.destination !== 'builder' };
      if (action.type === 'SET_VARIABLE') return { connectionType: 'SET_VARIABLE',
        targetVariable: { id: { guid: variable(action.name).guid } }, targetVariableData: value(action.value) };
      return { connectionType: 'CONDITIONAL', conditionalActions: action.blocks.map(block => ({
        ...(block.condition ? { condition: value(block.condition) } : {}), actions: actions(block.actions, viewport),
      })) };
    });
  }
  function bindingTarget(node) {
    const parent = graph.getNode(node.parentId);
    if (parent.type !== 'INSTANCE') return exported(node);
    const instance = exported(parent);
    const master = graph.getNode(node.componentId);
    if (!master) throw new Error(`Missing bound master ${node.name}`);
    const key = master.overrideKey || master.id;
    const [sessionID, localID] = key.split(':').map(Number);
    let override = instance.symbolData.symbolOverrides.find(o => guid(o.guidPath.guids.at(-1)) === key);
    if (!override) {
      override = { guidPath: { guids: [{ sessionID, localID }] } };
      instance.symbolData.symbolOverrides.push(override);
    }
    return override;
  }
  for (const binding of bindings) {
    if (binding.field !== 'text') continue;
    const target = bindingTarget(binding.node);
    const alias = value({ type: 'VARIABLE_ALIAS', name: binding.variable.name });
    target.variableConsumptionMap ??= { entries: [] };
    target.variableConsumptionMap.entries.push({ variableField: 'TEXT_DATA', variableData: alias });
    const parent = graph.getNode(binding.node.parentId);
    if (parent.type === 'INSTANCE') {
      const master = graph.getNode(binding.node.componentId);
      const property = master.componentPropertyReferences.find(r => r.field === 'TEXT');
      if (property) {
        const instance = exported(parent);
        const assignment = instance.componentPropAssignments?.find(a => guid(a.defID) === property.propertyId);
        if (assignment) assignment.varValue = alias;
      }
    }
  }
  for (const [index, link] of connections.entries()) {
    const from = exported(link.from);
    const to = exported(link.to);
    from.prototypeInteractions ??= [];
    from.prototypeInteractions.push({
      id: { sessionID: 90, localID: index + 1 },
      event: { interactionType: link.trigger ?? 'ON_CLICK',
        ...(link.delay ? { transitionTimeout: link.delay } : {}) },
      actions: [{ connectionType: 'INTERNAL_NODE', navigationType: link.variant ? 'SWAP_STATE' : 'NAVIGATE',
        transitionNodeID: to.guid, transitionType: 'INSTANT_TRANSITION', transitionDuration: 0,
        transitionResetScrollPosition: true }],
      isDeleted: false, stateManagementVersion: 1,
    });
  }
  for (const [index, reaction] of reactions.entries()) {
    const target = exported(reaction.node);
    target.prototypeInteractions = [{ id: { sessionID: 91, localID: index + 1 },
      event: { interactionType: reaction.trigger, ...(reaction.delay !== undefined ? { transitionTimeout: reaction.delay } : {}) },
      actions: actions(reaction.actions, reaction.viewport), isDeleted: false, stateManagementVersion: 1 }];
  }
  for (const { node, name, description } of starts) {
    const target = exported(node);
    target.prototypeStartingPoint = { name, description, position: 'a' };
    target.scrollDirection = 'VERTICAL';
    const canvas = byId.get(guid(target.parentIndex.guid));
    canvas.prototypeStartNodeID = target.guid;
    canvas.prototypeDevice = { type: 'CUSTOM', size: { x: node.width, y: node.width < 500 ? 844 : 1000 } };
  }
  for (const viewport of Object.values(screens)) for (const screen of [viewport.builder, viewport.done]) exported(screen).scrollDirection = 'VERTICAL';
  // Export native component sets; the codec otherwise only writes its plugin tag.
  for (const node of graph.getAllNodes()) {
    if (node.type === 'COMPONENT_SET') exported(node).isStateGroup = true;
  }
  const kiwiData = getCompiledSchema().encodeMessage({ type: 'NODE_CHANGES', sessionID: 0, ackID: 0,
    nodeChanges: data.nodeChanges, blobs: data.blobs.map(bytes => ({ bytes })) });
  const archive = writeFigArchive({ schemaDeflated: data.figSchemaDeflated, kiwiData,
    figKiwiVersion: data.figKiwiVersion, thumbnailPNG: data.thumbnailPNG,
    metaJSON: data.metaJSON, images: data.images.map(([name, data]) => ({ name, data })) });
  const checked = parseFigBuffer(archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength));
  const ids = new Set(checked.nodeChanges.map(n => guid(n.guid)));
  const interactions = checked.nodeChanges.flatMap(n => n.prototypeInteractions ?? []);
  let actionCount = 0;
  function validateActions(list) {
    for (const action of list) {
      actionCount++;
      if (action.transitionNodeID && !ids.has(guid(action.transitionNodeID))) throw new Error('Broken prototype destination');
      if (action.targetVariable && !ids.has(guid(action.targetVariable.id.guid))) throw new Error('Broken prototype variable');
      for (const block of action.conditionalActions ?? []) validateActions(block.actions);
    }
  }
  for (const interaction of interactions) validateActions(interaction.actions);
  if (interactions.length !== connections.length + reactions.length) throw new Error('Prototype reactions lost during export');
  if (checked.nodeChanges.some(n => n.type === 'TEXT' && n.textData?.characters.trim() && !n.derivedTextData?.glyphs.length)) {
    throw new Error('Exported text has no glyph data.');
  }
  return { bytes: archive, report: { textNodesWithGlyphs: textCount, textOverridesWithGlyphs: overrideCount,
    prototypeConnections: interactions.length, prototypeActions: actionCount,
    dynamicTextBindings: bindings.filter(b => b.field === 'text').length,
    prototypeStartingPoints: starts.map(s => s.name),
    componentSets: checked.nodeChanges.filter(n => n.isStateGroup).length,
    textStyles: checked.nodeChanges.filter(n => n.styleType === 'TEXT').length } };
}
