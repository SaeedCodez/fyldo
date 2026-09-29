/**
 * Runs INSIDE Figma (figma-console MCP → figma_execute). READ-ONLY: it never writes to the document.
 *
 * Installs `globalThis.fyldoPack(params)` in the plugin sandbox. Call it once per batch; results are plain JSON that
 * `tools/figma/pack.mjs decode` turns into files under design/figma/. Nothing else is needed from Figma.
 * `node tools/figma/pack.mjs code ...` prints this file plus a ready-made call, so a refresh is one command.
 *
 * Modes (params.mode):
 *   list    → every COMPONENT_SET of the Components page (id, name, variant count), the "· Usage" / template frames,
 *             and the variable count. No tree walk.
 *   json    → { set, variants } for params.setId, starting at params.start. Stops after params.budgetMs and reports
 *             `next` so the caller can continue (figma_execute is capped at 30 s).
 *   png     → every variant of params.setId as a base64 PNG (params.scale, default 2), batched by params.maxChars.
 *   frames  → params.ids (frame node ids) as base64 PNGs at params.scale (default 1), named by kebab(frame name).
 *
 * Variable ids are always resolved to variable NAMES ("border/input"); ids never reach the output. Iconsax icon
 * instances (main component on the Icons page) are recorded as { name, size, colour token } and not walked.
 */
globalThis.fyldoPack = async function fyldoPack(P) {
  const t0 = Date.now();
  const budget = P.budgetMs ?? 21000;
  const over = () => Date.now() - t0 > budget;

  const kebab = (s) =>
    String(s)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const r2 = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : n);
  const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  const isMixed = (v) => typeof v === 'symbol';

  // ── name resolution caches ───────────────────────────────────────────────────────────────────────────────────────
  const varName = new Map();
  for (const v of await figma.variables.getLocalVariablesAsync()) varName.set(v.id, v.name);
  const vname = async (id) => {
    if (!varName.has(id)) {
      const v = await figma.variables.getVariableByIdAsync(id);
      varName.set(id, v ? v.name : `(unresolved ${id})`);
    }
    return varName.get(id);
  };
  const styleNames = new Map();
  const sname = async (id) => {
    if (!id || isMixed(id)) return isMixed(id) ? 'mixed' : undefined;
    if (!styleNames.has(id)) {
      const s = await figma.getStyleByIdAsync(id);
      styleNames.set(id, s ? s.name : `(unresolved ${id})`);
    }
    return styleNames.get(id);
  };
  const nodeNames = new Map();
  const nname = async (id) => {
    if (!nodeNames.has(id)) {
      const n = await figma.getNodeByIdAsync(id);
      nodeNames.set(id, n ? (n.parent && n.parent.type === 'COMPONENT_SET' ? n.parent.name + ' / ' + n.name : n.name) : `(unresolved ${id})`);
    }
    return nodeNames.get(id);
  };
  const pageOf = (n) => {
    let p = n;
    while (p && p.type !== 'PAGE') p = p.parent;
    return p;
  };

  // ── serializers ──────────────────────────────────────────────────────────────────────────────────────────────────
  const boundNames = async (bv) => {
    const out = {};
    for (const [k, v] of Object.entries(bv || {})) {
      if (['fills', 'strokes', 'effects', 'componentProperties', 'textRangeFills'].includes(k)) continue;
      const one = Array.isArray(v) ? v[0] : v;
      if (one && one.id) out[k] = await vname(one.id);
    }
    return out;
  };

  const paint = async (p) => {
    const o = { type: p.type };
    if (p.visible === false) o.visible = false;
    if (p.blendMode && p.blendMode !== 'NORMAL') o.blendMode = p.blendMode;
    if (p.type === 'SOLID') {
      o.hex = hex(p.color);
      if ((p.opacity ?? 1) < 1) o.opacity = r2(p.opacity);
      if (p.boundVariables && p.boundVariables.color) o.token = await vname(p.boundVariables.color.id);
    } else if (p.type.startsWith('GRADIENT')) {
      if ((p.opacity ?? 1) < 1) o.opacity = r2(p.opacity);
      o.stops = [];
      for (const s of p.gradientStops) {
        const st = { position: r2(s.position), hex: hex(s.color) };
        if (s.color.a < 1) st.opacity = r2(s.color.a);
        if (s.boundVariables && s.boundVariables.color) st.token = await vname(s.boundVariables.color.id);
        o.stops.push(st);
      }
    } else if (p.type === 'IMAGE') o.scaleMode = p.scaleMode;
    return o;
  };
  const paints = async (list) => (isMixed(list) ? 'mixed' : list && list.length ? Promise.all(list.map(paint)) : undefined);

  const effect = async (e) => {
    const o = { type: e.type, visible: e.visible };
    if (e.color) {
      o.hex = hex(e.color);
      o.opacity = r2(e.color.a);
    }
    if (e.offset) o.offset = { x: r2(e.offset.x), y: r2(e.offset.y) };
    if (e.radius !== undefined) o.radius = r2(e.radius);
    if (e.spread !== undefined) o.spread = r2(e.spread);
    if (e.blendMode && e.blendMode !== 'NORMAL') o.blendMode = e.blendMode;
    if (e.boundVariables) {
      const b = await boundNames(e.boundVariables);
      if (Object.keys(b).length) o.bound = b;
    }
    return o;
  };

  const lineHeight = (v) => (isMixed(v) ? 'mixed' : v.unit === 'AUTO' ? { unit: 'AUTO' } : { unit: v.unit, value: r2(v.value) });
  const letterSpacing = (v) => (isMixed(v) ? 'mixed' : { unit: v.unit, value: r2(v.value) });

  const swapValue = async (prop) => (prop.type === 'INSTANCE_SWAP' && prop.value ? { ...prop, valueName: await nname(prop.value) } : { ...prop });

  const iconColour = (node) => {
    const hit = node.findAll(
      (n) =>
        ((n.strokes && n.strokes.length && n.strokes.some((p) => p.boundVariables && p.boundVariables.color)) ||
          (n.fills && !isMixed(n.fills) && n.fills.length && n.fills.some((p) => p.boundVariables && p.boundVariables.color))),
    )[0];
    if (!hit) return undefined;
    const p = [...(hit.strokes || []), ...(!isMixed(hit.fills) ? hit.fills || [] : [])].find((x) => x.boundVariables && x.boundVariables.color);
    return p ? vname(p.boundVariables.color.id) : undefined;
  };

  const ser = async (node, root, parent, depth) => {
    const o = { name: node.name, type: node.type, visible: node.visible, opacity: r2(node.opacity ?? 1) };
    o.x = r2(node.absoluteTransform[0][2] - root.absoluteTransform[0][2]);
    o.y = r2(node.absoluteTransform[1][2] - root.absoluteTransform[1][2]);
    o.width = r2(node.width);
    o.height = r2(node.height);
    if (node.rotation) o.rotation = r2(node.rotation);
    if (node.blendMode && node.blendMode !== 'PASS_THROUGH' && node.blendMode !== 'NORMAL') o.blendMode = node.blendMode;
    if (node.isMask) o.isMask = true;

    // auto-layout (container) and layout-in-parent (child)
    const lay = {};
    if ('layoutMode' in node && node.layoutMode !== 'NONE') {
      Object.assign(lay, {
        layoutMode: node.layoutMode,
        paddingTop: node.paddingTop,
        paddingRight: node.paddingRight,
        paddingBottom: node.paddingBottom,
        paddingLeft: node.paddingLeft,
        itemSpacing: node.itemSpacing,
        primaryAxisAlignItems: node.primaryAxisAlignItems,
        counterAxisAlignItems: node.counterAxisAlignItems,
        primaryAxisSizingMode: node.primaryAxisSizingMode,
        counterAxisSizingMode: node.counterAxisSizingMode,
      });
      if (node.layoutWrap && node.layoutWrap !== 'NO_WRAP') {
        lay.layoutWrap = node.layoutWrap;
        lay.counterAxisSpacing = node.counterAxisSpacing;
      }
      if (node.itemReverseZIndex) lay.itemReverseZIndex = true;
    }
    if (parent && 'layoutMode' in parent && parent.layoutMode !== 'NONE') {
      lay.layoutSizingHorizontal = node.layoutSizingHorizontal;
      lay.layoutSizingVertical = node.layoutSizingVertical;
      lay.layoutGrow = node.layoutGrow;
      lay.layoutAlign = node.layoutAlign;
      if (node.layoutPositioning && node.layoutPositioning !== 'AUTO') lay.layoutPositioning = node.layoutPositioning;
    }
    for (const k of ['minWidth', 'maxWidth', 'minHeight', 'maxHeight']) if (node[k] != null) lay[k] = node[k];
    if ('clipsContent' in node) lay.clipsContent = node.clipsContent;
    if (Object.keys(lay).length) o.layout = lay;

    // corner radius (bound variable names per corner live in `bound`)
    if ('cornerRadius' in node) {
      const cr = node.cornerRadius;
      if (isMixed(cr)) o.cornerRadius = { topLeft: node.topLeftRadius, topRight: node.topRightRadius, bottomRight: node.bottomRightRadius, bottomLeft: node.bottomLeftRadius };
      else if (cr) o.cornerRadius = cr;
      if (node.cornerSmoothing) o.cornerSmoothing = node.cornerSmoothing;
    }

    const fills = await paints(node.fills);
    if (fills) o.fills = fills;
    const fillStyle = 'fillStyleId' in node ? await sname(node.fillStyleId) : undefined;
    if (fillStyle) o.fillStyle = fillStyle;

    const strokes = await paints(node.strokes);
    if (strokes) {
      const w = node.strokeWeight;
      o.strokes = {
        paints: strokes,
        weight: isMixed(w) ? { top: node.strokeTopWeight, right: node.strokeRightWeight, bottom: node.strokeBottomWeight, left: node.strokeLeftWeight } : w,
        align: node.strokeAlign,
      };
      if (node.dashPattern && node.dashPattern.length) o.strokes.dashPattern = node.dashPattern;
      const ss = 'strokeStyleId' in node ? await sname(node.strokeStyleId) : undefined;
      if (ss) o.strokes.style = ss;
    }

    if (node.effects && node.effects.length) {
      o.effects = { style: await sname(node.effectStyleId), values: await Promise.all(node.effects.map(effect)) };
    } else if ('effectStyleId' in node && node.effectStyleId) o.effects = { style: await sname(node.effectStyleId), values: [] };

    const bound = await boundNames(node.boundVariables);
    if (Object.keys(bound).length) o.bound = bound;
    if (node.componentPropertyReferences && Object.keys(node.componentPropertyReferences).length) o.propertyReferences = node.componentPropertyReferences;

    if (node.type === 'TEXT') {
      const t = {
        characters: node.characters,
        textStyle: await sname(node.textStyleId),
        fontFamily: isMixed(node.fontName) ? 'mixed' : node.fontName.family,
        fontStyle: isMixed(node.fontName) ? 'mixed' : node.fontName.style,
        fontSize: isMixed(node.fontSize) ? 'mixed' : node.fontSize,
        lineHeight: lineHeight(node.lineHeight),
        letterSpacing: letterSpacing(node.letterSpacing),
        textAlignHorizontal: node.textAlignHorizontal,
        textAlignVertical: node.textAlignVertical,
        textAutoResize: node.textAutoResize,
      };
      if (!isMixed(node.textCase) && node.textCase !== 'ORIGINAL') t.textCase = node.textCase;
      if (!isMixed(node.textDecoration) && node.textDecoration !== 'NONE') t.textDecoration = node.textDecoration;
      if (node.textTruncation !== 'DISABLED') t.textTruncation = node.textTruncation;
      if (node.maxLines) t.maxLines = node.maxLines;
      if (Array.isArray(o.fills) && o.fills[0]) t.fillToken = o.fills[0].token;
      o.text = t;
    }

    if (node.type === 'INSTANCE') {
      const mc = await node.getMainComponentAsync();
      const set = mc && mc.parent && mc.parent.type === 'COMPONENT_SET' ? mc.parent : null;
      const page = mc ? pageOf(mc) : null;
      const isIcon = !!(page && page.name === 'Icons');
      if (isIcon) {
        o.icon = { name: set ? set.name : mc.name, size: r2(node.width) };
        if (set) o.icon.variant = mc.name;
        const c = iconColour(node);
        if (c) o.icon.colour = await c;
      } else {
        o.instance = { component: set ? set.name : mc ? mc.name : null };
        if (set) o.instance.variant = mc.name;
        if (mc && mc.remote) o.instance.remote = true;
        const cp = {};
        for (const [k, v] of Object.entries(node.componentProperties || {})) cp[k] = await swapValue(v);
        o.instance.componentProperties = cp;
      }
    }

    // Instances are not walked: their internals live in the instantiated set's own JSON. Visible text layers are kept
    // as { layer name: characters } because text overrides are the one thing the set JSON cannot tell you.
    if (node.type === 'INSTANCE' && !o.icon) {
      const texts = {};
      for (const t of node.findAll((n) => n.type === 'TEXT' && n.visible)) texts[t.name] = t.characters;
      if (Object.keys(texts).length) o.instance.texts = texts;
    } else if (!o.icon && 'children' in node && node.children.length && depth < 14) {
      o.children = [];
      for (const c of node.children) o.children.push(await ser(c, root, node, depth + 1));
    }
    return o;
  };

  // ── helpers over a component set ─────────────────────────────────────────────────────────────────────────────────
  const propsOf = (variant) => {
    if (variant.variantProperties) return { ...variant.variantProperties };
    const o = {};
    for (const part of variant.name.split(',')) {
      const [k, ...v] = part.split('=');
      o[k.trim()] = v.join('=').trim();
    }
    return o;
  };
  const fileOf = (variant) =>
    Object.entries(propsOf(variant))
      .map(([k, v]) => `${kebab(k)}-${kebab(v)}`)
      .join('--');

  const componentsPage = () => figma.root.children.find((p) => p.name === 'Components');
  const getSet = async (id) => {
    const set = await figma.getNodeByIdAsync(id);
    if (!set || set.type !== 'COMPONENT_SET') throw new Error('not a COMPONENT_SET: ' + id);
    return set;
  };

  // ── modes ────────────────────────────────────────────────────────────────────────────────────────────────────────
  if (P.mode === 'list') {
    const page = componentsPage();
    await page.loadAsync();
    const sets = page.findAllWithCriteria({ types: ['COMPONENT_SET'] }).map((s) => ({ id: s.id, name: s.name, kebab: kebab(s.name), variantCount: s.children.length }));
    const frames = page
      .findAll((n) => n.type === 'FRAME' && (/ · Usage$/.test(n.name) || (n.parent && n.parent.name === 'Settings Page' && /^Settings page · /.test(n.name))))
      .map((n) => ({ id: n.id, name: n.name, kebab: kebab(n.name), width: r2(n.width), height: r2(n.height) }));
    return { mode: 'list', variableCount: (await figma.variables.getLocalVariablesAsync()).length, fileName: figma.root.name, sets, frames };
  }

  if (P.mode === 'json') {
    const set = await getSet(P.setId);
    const variants = [];
    const defs = {};
    for (const [k, d] of Object.entries(set.componentPropertyDefinitions)) {
      const e = { type: d.type, defaultValue: d.defaultValue };
      if (d.variantOptions) e.variantOptions = d.variantOptions;
      if (d.type === 'INSTANCE_SWAP') {
        e.defaultValueName = await nname(d.defaultValue);
        if (d.preferredValues && d.preferredValues.length) e.preferredValueCount = d.preferredValues.length;
      }
      defs[k] = e;
    }
    const total = set.children.length;
    let i = P.start ?? 0;
    for (; i < total; i++) {
      const v = set.children[i];
      variants.push({ id: v.id, name: v.name, file: fileOf(v), variantProperties: propsOf(v), node: await ser(v, v, null, 0) });
      if (over()) {
        i++;
        break;
      }
    }
    return {
      mode: 'json',
      set: { id: set.id, name: set.name, kebab: kebab(set.name), description: set.description || undefined, width: r2(set.width), height: r2(set.height), variantCount: total, componentPropertyDefinitions: defs },
      variants,
      start: P.start ?? 0,
      next: i,
      total,
      done: i >= total,
    };
  }

  if (P.mode === 'png') {
    const set = await getSet(P.setId);
    const scale = P.scale ?? 2;
    const maxChars = P.maxChars ?? 900000;
    const files = [];
    let chars = 0;
    const total = set.children.length;
    let i = P.start ?? 0;
    for (; i < total; i++) {
      const v = set.children[i];
      const bytes = await v.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale } });
      const b64 = figma.base64Encode(bytes);
      files.push({ path: `png/${kebab(set.name)}/${fileOf(v)}.png`, id: v.id, bytes: bytes.length, b64 });
      chars += b64.length;
      if (over() || chars > maxChars) {
        i++;
        break;
      }
    }
    return { mode: 'png', setId: set.id, start: P.start ?? 0, next: i, total, done: i >= total, files };
  }

  if (P.mode === 'frames') {
    const scale = P.scale ?? 1;
    const maxChars = P.maxChars ?? 900000;
    const files = [];
    let chars = 0;
    let i = P.start ?? 0;
    for (; i < P.ids.length; i++) {
      const n = await figma.getNodeByIdAsync(P.ids[i]);
      const bytes = await n.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale } });
      const b64 = figma.base64Encode(bytes);
      files.push({ path: `png/usage/${kebab(n.name)}.png`, id: n.id, bytes: bytes.length, b64 });
      chars += b64.length;
      if (over() || chars > maxChars) {
        i++;
        break;
      }
    }
    return { mode: 'frames', start: P.start ?? 0, next: i, total: P.ids.length, done: i >= P.ids.length, files };
  }

  throw new Error('unknown mode ' + P.mode);
};

/**
 * Runs several small calls in one figma_execute (e.g. every tiny set). Stops before the 30 s cap and reports which
 * entries were skipped (`pending`), which the caller re-issues. Pads the result so the harness always writes it to a
 * file (small results are only returned inline, and then cannot be decoded from disk).
 */
globalThis.fp = async function fp(list) {
  const t0 = Date.now();
  const batch = [];
  const pending = [];
  for (const p of Array.isArray(list) ? list : [list]) {
    if (Date.now() - t0 > 18000) pending.push(p);
    else batch.push(await globalThis.fyldoPack({ ...p, budgetMs: Math.max(2000, 24000 - (Date.now() - t0)) }));
  }
  return { batch, pending, pad: 'x'.repeat(200000) };
};
return 'fyldoPack installed';
