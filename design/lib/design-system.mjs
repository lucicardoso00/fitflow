/** Shared semantic tokens, typography and linked artwork — including native export metadata. */
export function upgradeDesignSystem({ graph, node, frame, text, componentsBoard, pTokens, fill, colors, C, bindings }) {
  const primitives = [...graph.variableCollections.values()].find(c => c.name === 'Forma / Foundations');
  primitives.name = 'Forma / Primitives';
  const semantic = graph.createCollection('Forma / Semantic tokens');
  const all = () => [...graph.getAllNodes()];
  const semanticNames = { base: 'surface/canvas', surface: 'surface/panel', raised: 'surface/control', line: 'border/default',
    accent: 'action/primary', hover: 'action/primary-hover', soft: 'surface/selected', text: 'text/primary',
    secondary: 'text/secondary', muted: 'text/muted', success: 'status/success', warning: 'status/warning', error: 'status/error' };
  const tokens = {};
  for (const [name, source] of Object.entries(colors)) {
    const variable = graph.createVariable(semanticNames[name], 'COLOR', semantic.id, { aliasId: source });
    variable.description = `Semantic role; aliases Color/${name}.`;
    tokens[name] = variable.id;
  }
  const token = (name, value) => {
    let v = [...graph.variables.values()].find(v => v.collectionId === primitives.id && v.name === name);
    if (!v) v = graph.createVariable(name, typeof value === 'string' ? 'STRING' : 'FLOAT', primitives.id, value);
    return v.id;
  };
  const closestColor = color => Object.entries(C).find(([, hex]) => {
    const n = parseInt(hex.slice(1), 16);
    return Math.abs(color.r - (n >> 16 & 255) / 255) < .002
      && Math.abs(color.g - (n >> 8 & 255) / 255) < .002 && Math.abs(color.b - (n & 255) / 255) < .002;
  })?.[0];
  // Collections are functional: fills, borders, corners, spacing and text use aliases.
  for (const n of all()) {
    for (const paint of ['fills', 'strokes']) for (const [index, p] of n[paint].entries()) {
      if (p.type !== 'SOLID') continue;
      const name = closestColor(p.color);
      if (name && !bindings.some(b => b.node.id === n.id && b.field === `${paint}/${index}/color`))
        graph.bindVariable(n.id, `${paint}/${index}/color`, tokens[name]);
    }
    if (n.cornerRadius > 0) graph.bindVariable(n.id, 'cornerRadius', token(`Radius/${({ 8: 'control', 12: 'card', 9999: 'pill' })[n.cornerRadius] ?? n.cornerRadius}`, n.cornerRadius));
    if (n.layoutMode !== 'NONE') for (const field of ['itemSpacing', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom']) {
      graph.bindVariable(n.id, field, token(`Space/${n[field]}`, n[field]));
    }
  }

  // A compact role-based scale replaces one-off typography on individual layers.
  const styles = new Map();
  for (const n of all().filter(n => n.type === 'TEXT' && !n.internalOnly)) {
    const scale = n.fontSize <= 11 ? ['Label', 11, 16, 600, 1.2]
      : n.fontSize <= 13 ? ['Caption', 12, 18, 400, 0]
      : n.fontSize <= 14 ? ['Body small', 14, 20, n.fontWeight >= 500 ? 500 : 400, 0]
      : n.fontSize === 15 && n.fontWeight >= 600 ? ['Control', 15, 22, 600, 0]
      : n.fontSize <= 18 ? ['Body', 16, 24, n.fontWeight >= 600 ? 600 : 400, 0]
      : n.fontSize <= 22 ? ['Title small', 20, 28, 600, 0]
      : n.fontSize <= 28 ? ['Title', 28, 36, 600, -.5]
      : n.fontSize <= 36 ? ['Heading small', 32, 40, 600, -1]
      : n.fontSize <= 48 ? ['Heading', 40, 48, 600, -1.2]
      : n.fontSize <= 68 ? ['Display', 56, 64, 600, -2]
      : n.fontSize <= 92 ? ['Display large', 72, 80, 600, -3]
      : ['Metric', 96, 112, 600, -4];
    const [role, size, leading, fontWeight, tracking] = scale;
    graph.updateNode(n.id, { fontFamily: size >= 28 ? 'Space Grotesk' : 'Inter', fontSize: size,
      fontWeight, lineHeight: leading, letterSpacing: tracking,
      height: Math.max(n.height, leading * n.text.split('\n').length) });
    const weight = { 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold' }[n.fontWeight];
    const key = `${n.fontFamily}/${n.fontSize}/${n.fontWeight}/${n.lineHeight}/${n.letterSpacing}`;
    let style = styles.get(key);
    if (!style) {
      const name = `${role}/${weight}`;
      style = node('TEXT', pTokens, name, 0, 0, 600, Math.max(80, n.lineHeight), 'text', {
        internalOnly: true, sharedStyleType: 'TEXT', text: 'Forma typography', fontFamily: n.fontFamily,
        fontSize: n.fontSize, fontWeight: n.fontWeight, lineHeight: n.lineHeight, letterSpacing: n.letterSpacing,
      });
      style.source.id = `82:${styles.size + 1}`;
      styles.set(key, style);
    }
    n.textStyleId = style.source.id;
    graph.bindVariable(n.id, 'fontSize', token(`Type/size/${n.fontSize}`, n.fontSize));
    graph.bindVariable(n.id, 'lineHeight', token(`Type/leading/${n.lineHeight}`, n.lineHeight));
    graph.bindVariable(n.id, 'letterSpacing', token(`Type/tracking/${n.letterSpacing}`, n.letterSpacing));
    graph.bindVariable(n.id, 'fontFamily', token(`Type/family/${n.fontFamily}`, n.fontFamily));
  }

  const page = graph.getNode(componentsBoard.parentId);
  const gallery = node('COMPONENT_SET', page, 'Illustration', 1520, 0, 3400, 8000, null, { clipsContent: false, isPublishable: true });
  const artProperty = { id: '84:1', name: 'Exercise', type: 'VARIANT', defaultValue: 'plank' };
  const sizeProperty = { id: '84:2', name: 'Size', type: 'VARIANT', defaultValue: 'Thumbnail' };
  gallery.componentPropertyDefinitions = [artProperty, sizeProperty];
  const masters = new Map();
  const artwork = all().filter(n => n.name.startsWith('Illustration /') && n.type === 'FRAME');
  for (const art of artwork) {
    const key = `${art.name}/${art.width}/${art.height}`;
    let master = masters.get(key);
    if (!master) {
      const index = masters.size;
      const exercise = art.name.split(' / ')[1];
      const size = art.width <= 80 ? 'Thumbnail' : art.width === 790 ? 'Desktop' : art.width === 342 ? 'Mobile' : 'Rest';
      master = graph.cloneTree(art.id, gallery.id, { name: `Exercise=${exercise}, Size=${size}`,
        x: index % 4 * 840, y: Math.floor(index / 4) * 650 });
      graph.updateNode(master.id, { type: 'COMPONENT', isSymbolPublishable: true, visible: true,
        variantPropSpecs: [{ propDefId: artProperty.id, value: exercise }, { propDefId: sizeProperty.id, value: size }] });
      graph.unbindVariable(master.id, 'visible');
      masters.set(key, master);
    }
    const instance = graph.createInstance(master.id, art.parentId, {
      name: art.name, x: art.x, y: art.y, width: art.width, height: art.height, visible: art.visible,
    });
    for (const binding of bindings.filter(b => b.node.id === art.id)) {
      binding.node = instance;
      graph.bindVariable(instance.id, binding.field, binding.variable.id);
    }
    const siblings = graph.getChildren(art.parentId);
    graph.reorderChild(instance.id, art.parentId, siblings.findIndex(n => n.id === art.id));
    graph.deleteNode(art.id);
  }
  // Exercise rows expose all content fields, instead of only the title.
  const rowSet = all().find(n => n.type === 'COMPONENT_SET' && n.name === 'Exercise row');
  let propertyId = 400;
  for (const [index, title] of ['Title', 'Prescription', 'Index'].entries()) {
    const property = { id: `80:${propertyId++}`, name: title, type: 'TEXT', defaultValue: title };
    rowSet.componentPropertyDefinitions.push(property);
    for (const master of graph.getChildren(rowSet.id)) {
      const child = graph.getChildren(master.id).filter(n => n.type === 'TEXT')[index];
      child.componentPropertyReferences = [{ propertyId: property.id, field: 'TEXT' }];
      for (const instance of graph.getInstances(master.id)) {
        const label = graph.getChildren(instance.id).filter(n => n.type === 'TEXT')[index];
        instance.componentPropertyAssignments[property.id] = label.text;
      }
    }
  }
  rowSet.componentPropertyDefinitions = rowSet.componentPropertyDefinitions.filter(p => p.name !== 'Label');
  // Metrics are reusable Auto layout components with Value and Label properties.
  const metricSet = node('COMPONENT_SET', page, 'Metric', 0, 1700, 1000, 260, null, { isPublishable: true });
  const metricSize = { id: '84:3', name: 'Size', type: 'VARIANT', defaultValue: 'Desktop' };
  const metricValue = { id: '84:4', name: 'Value', type: 'TEXT', defaultValue: '0' };
  const metricLabel = { id: '84:5', name: 'Label', type: 'TEXT', defaultValue: 'sets' };
  metricSet.componentPropertyDefinitions = [metricSize, metricValue, metricLabel];
  const metricMasters = new Map();
  for (const metric of all().filter(n => n.type === 'FRAME' && /^Metric \d+$/.test(n.name))) {
    const size = metric.width < 150 ? 'Mobile' : 'Desktop';
    let master = metricMasters.get(size);
    if (!master) {
      master = graph.cloneTree(metric.id, metricSet.id, { name: `Size=${size}`, x: size === 'Mobile' ? 400 : 0, y: 0 });
      graph.updateNode(master.id, { type: 'COMPONENT', isSymbolPublishable: true, variantPropSpecs: [{ propDefId: metricSize.id, value: size }] });
      const labels = graph.getChildren(master.id);
      labels[0].componentPropertyReferences = [{ propertyId: metricValue.id, field: 'TEXT' }];
      labels[1].componentPropertyReferences = [{ propertyId: metricLabel.id, field: 'TEXT' }];
      metricMasters.set(size, master);
    }
    const instance = graph.createInstance(master.id, metric.parentId, { name: metric.name, x: metric.x, y: metric.y });
    const original = graph.getChildren(metric.id), children = graph.getChildren(instance.id);
    for (let i = 0; i < children.length; i++) {
      graph.updateNode(children[i].id, { text: original[i].text, name: original[i].name });
      instance.overrides[`${children[i].id}:text`] = original[i].text;
      instance.componentPropertyAssignments[[metricValue, metricLabel][i].id] = original[i].text;
      for (const binding of bindings.filter(b => b.node.id === original[i].id)) binding.node = children[i];
    }
    graph.reorderChild(instance.id, metric.parentId, graph.getChildren(metric.parentId).findIndex(n => n.id === metric.id));
    graph.deleteNode(metric.id);
  }
  const marks = all().filter(n => n.type === 'FRAME' && n.name === 'Forma mark');
  const brand = graph.cloneTree(marks[0].id, page.id, { name: 'Brand / Forma mark', x: 0, y: 2100 });
  graph.updateNode(brand.id, { type: 'COMPONENT', isSymbolPublishable: true });
  for (const mark of marks) {
    const instance = graph.createInstance(brand.id, mark.parentId, { name: 'Brand / Forma mark', x: mark.x, y: mark.y,
      layoutPositioning: mark.layoutPositioning });
    graph.reorderChild(instance.id, mark.parentId, graph.getChildren(mark.parentId).findIndex(n => n.id === mark.id));
    graph.deleteNode(mark.id);
  }
  return { semanticTokens: tokens, sharedTextStyles: styles.size, illustrationMasters: masters.size };
}
