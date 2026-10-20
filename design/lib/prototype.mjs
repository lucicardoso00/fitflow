import { functionalPrototype } from './functional-prototype.mjs';
/** Native prototype states and component properties, separate from screen drawing. */
export async function buildPrototype({ graph, node, frame, text, button, illustration, masters,
  componentsBoard, pDesktop, pMobile, builder, workout, rest, done,
  mobileBuild, mobilePlan, mobileWorkout, mobileRest, mobileDone, plan, fill, exerciseRow }) {
  const connections = [];
  const starts = [];
  const link = (from, to, extra = {}) => connections.push({ from, to, ...extra });
  const descendants = root => graph.getChildren(root.id).flatMap(child => [child, ...descendants(child)]);
  const find = (root, name) => {
    const result = descendants(root).find(n => n.name === name);
    if (!result) throw new Error(`Missing ${name} in ${root.name}`);
    return result;
  };
  function replaceText(root, before, after, props = {}) {
    const target = descendants(root).find(n => n.type === 'TEXT' && n.text === before);
    if (!target) throw new Error(`Missing text ${before} in ${root.name}`);
    graph.updateNode(target.id, { text: after, ...props });
    const parent = graph.getNode(target.parentId);
    if (parent.type === 'INSTANCE') parent.overrides[`${target.id}:text`] = after;
    return target;
  }
  function action(root, caption) { return find(root, `Button / ${caption}`); }
  function clone(root, parent, name, x, y) {
    return graph.cloneTree(root.id, parent.id, { name, x, y });
  }

  // Component sets expose native dropdowns and editable text properties in Figma.
  let propertyId = 100;
  function componentSet(name, property, variants, x, y, width, height) {
    const set = node('COMPONENT_SET', componentsBoard, name, x, y, width, height, null,
      { clipsContent: false, isPublishable: true });
    const definition = { id: `80:${propertyId++}`, name: property, type: 'VARIANT',
      defaultValue: variants[0][0], variantOptions: variants.map(([value]) => value) };
    const label = { id: `80:${propertyId++}`, name: 'Label', type: 'TEXT', defaultValue: 'Label' };
    set.componentPropertyDefinitions = [definition, label];
    for (const [index, [value, master]] of variants.entries()) {
      graph.reparentNode(master.id, set.id);
      graph.updateNode(master.id, { name: `${property}=${value}`, x: (index % 4) * 292,
        y: Math.floor(index / 4) * 110, isSymbolPublishable: true,
        variantPropSpecs: [{ propDefId: definition.id, value }] });
      const texts = graph.getChildren(master.id).filter(n => n.type === 'TEXT');
      for (const child of [texts.find(n => n.name === 'Label') ?? texts[0]]) {
        child.componentPropertyReferences = [{ propertyId: label.id, field: 'TEXT' }];
        for (const instance of graph.getInstances(master.id)) {
          const texts = graph.getChildren(instance.id).filter(n => n.type === 'TEXT');
          const childText = texts.find(n => n.name === 'Label') ?? texts[0];
          if (childText) instance.componentPropertyAssignments[label.id] = childText.text;
        }
      }
    }
    return set;
  }
  const buttons = componentSet('Button', 'State', ['Primary', 'Hover', 'Focus', 'Disabled', 'Secondary', 'Complete', 'Loading', 'Saved']
    .map(key => [key, masters[key]]), 64, 304, 1136, 162);
  const stateProperty = buttons.componentPropertyDefinitions[0];
  stateProperty.defaultValue = 'Default';
  stateProperty.variantOptions = ['Default', 'Hover', 'Focus', 'Disabled', 'Loading', 'Success'];
  const intentProperty = { id: '80:110', name: 'Intent', type: 'VARIANT', defaultValue: 'Primary',
    variantOptions: ['Primary', 'Secondary', 'Positive'] };
  buttons.componentPropertyDefinitions.push(intentProperty);
  for (const [key, intent, state] of [
    ['Primary', 'Primary', 'Default'], ['Hover', 'Primary', 'Hover'], ['Focus', 'Primary', 'Focus'],
    ['Disabled', 'Primary', 'Disabled'], ['Secondary', 'Secondary', 'Default'],
    ['Complete', 'Positive', 'Default'], ['Loading', 'Primary', 'Loading'], ['Saved', 'Secondary', 'Success'],
  ]) graph.updateNode(masters[key].id, { name: `Intent=${intent}, State=${state}`, variantPropSpecs: [
    { propDefId: intentProperty.id, value: intent }, { propDefId: stateProperty.id, value: state },
  ] });
  componentSet('Choice', 'Selected', [['False', masters.chipOff], ['True', masters.chipOn]], 64, 592, 492, 48);
  componentSet('Exercise row', 'Size', [['Desktop', masters.row], ['Mobile', masters.rowCompact]], 64, 828, 1216, 84);
  graph.updateNode(masters.rowCompact.id, { x: 640, y: 0 });
  graph.updateNode(find(componentsBoard, 'Exercise / 2 / Squat').id, { y: 932 });
  graph.updateNode(find(componentsBoard, 'Default → active → completed').id, { y: 1040 });
  link(masters.Primary, masters.Hover, { variant: true, trigger: 'ON_HOVER' });
  link(masters.Hover, masters.Primary, { variant: true, trigger: 'MOUSE_OUT' });
  link(masters.chipOff, masters.chipOn, { variant: true });
  link(masters.chipOn, masters.chipOff, { variant: true });

  // Auto layout also structures content stacks and the summary, beyond controls.
  for (const name of ['Session results', 'Results']) {
    const owner = name === 'Results' ? mobileDone : done;
    const stats = find(owner, name);
    const children = graph.getChildren(stats.id);
    const width = name === 'Results' ? 94 : 230;
    for (let i = 0; i < 3; i++) {
      const stack = frame(stats, `Metric ${i + 1}`, 0, 0, width, name === 'Results' ? 80 : 126, null,
        { layoutMode: 'VERTICAL', itemSpacing: name === 'Results' ? 8 : 12,
          primaryAxisSizing: 'AUTO', counterAxisSizing: 'FIXED', clipsContent: false });
      for (const child of children.slice(i * 2, i * 2 + 2)) graph.reparentNode(child.id, stack.id);
    }
    graph.updateNode(stats.id, { layoutMode: 'HORIZONTAL', paddingLeft: name === 'Results' ? 16 : 32,
      paddingTop: name === 'Results' ? 16 : 20, itemSpacing: name === 'Results' ? 16 : 34,
      primaryAxisSizing: 'FIXED', counterAxisSizing: 'FIXED' });
  }

  const functional = await functionalPrototype({ graph, node, frame, text, button, illustration, exerciseRow, masters,
    componentsBoard, pDesktop, pMobile, builder, workout, rest, done,
    mobileBuild, mobilePlan, mobileWorkout, mobileRest, mobileDone, plan, fill });
  return { ...functional, connections };
}
