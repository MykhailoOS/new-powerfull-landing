#!/usr/bin/env node
/**
 * JustSite — Bootstrap 5 HTML → Handlebars generator (MVP)
 *
 * Features:
 * - Parses Bootstrap 5 HTML fragment and converts to Handlebars with variables for text, attributes, and classes
 * - Produces index.hbs, fields.json, meta.json in a library folder structure
 * - No external dependencies; best-effort HTML parser for common component markup
 *
 * Input JSON shape:
 * {
 *   "componentName": "Hero Basic",
 *   "category": "marketing/hero",
 *   "tags": ["hero", "landing", "marketing"],
 *   "sourceHtml": "<section class=\"py-5 bg-light\">...",
 *   "options": {
 *     "classesMode": "single|multiple|fixed",
 *     "textEditable": true,
 *     "attrEditable": ["href","src","alt","title"]
 *   },
 *   "description": "optional description"
 * }
 *
 * Usage:
 *   node tools/html-to-hbs.js --input ./examples/hero-basic.json
 *   OR echo '{...json...}' | node tools/html-to-hbs.js
 */

const fs = require('fs');
const path = require('path');

// ---------- Helpers ----------
const VOID_ELEMENTS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);

function slugify(str) {
  return String(str || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function readStdinSync() {
  const BUFSIZE = 8192; const buf = Buffer.alloc(BUFSIZE);
  let bytesRead = 0, chunks = [];
  try {
    while ((bytesRead = fs.readSync(0, buf, 0, BUFSIZE, null)) > 0) {
      chunks.push(buf.slice(0, bytesRead));
    }
  } catch (e) { /* ignore */ }
  if (!chunks.length) return '';
  return Buffer.concat(chunks).toString('utf8');
}

// Parse attributes from tag source
function parseAttributes(src) {
  const attrs = {};
  const re = /([:@A-Za-z0-9_-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    const v = m[3] ?? m[4] ?? m[5];
    attrs[name] = v === undefined ? true : v;
  }
  return attrs;
}

// Basic tokenizer and tree builder
function parseHTML(html) {
  const root = { type: 'root', children: [] };
  const stack = [root];
  let i = 0, len = html.length;

  while (i < len) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      const text = html.slice(i);
      if (text) stack[stack.length-1].children.push({ type: 'text', content: text });
      break;
    }
    if (lt > i) {
      const text = html.slice(i, lt);
      if (text) stack[stack.length-1].children.push({ type: 'text', content: text });
      i = lt;
    }
    const gt = html.indexOf('>', i+1);
    if (gt === -1) break;
    const tagSrc = html.slice(i+1, gt).trim();

    if (tagSrc.startsWith('!--')) { // comment
      const end = html.indexOf('-->', i+4);
      i = end === -1 ? gt + 1 : end + 3;
      continue;
    }

    if (tagSrc[0] === '/') {
      const name = tagSrc.slice(1).trim().toLowerCase();
      // pop until name matches or root
      for (let s = stack.length - 1; s > 0; s--) {
        if (stack[s].name === name) { stack.splice(s); break; }
      }
      i = gt + 1; continue;
    }

    // start tag
    const selfClosing = tagSrc.endsWith('/') || VOID_ELEMENTS.has(tagSrc.split(/\s+/)[0].toLowerCase());
    const name = tagSrc.split(/\s+/)[0].replace(/\/$/, '').toLowerCase();
    const attrSrc = tagSrc.slice(name.length).trim().replace(/\/$/, '');
    const attrs = parseAttributes(attrSrc);

    const node = { type: 'element', name, attrs, children: [] };
    stack[stack.length-1].children.push(node);

    if (!selfClosing && !VOID_ELEMENTS.has(name)) {
      stack.push(node);
    }
    i = gt + 1;
  }
  return root;
}

function escapeAttr(v) {
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// Core transform: HTML AST -> HBS string + fields
function transformToHbs(ast, opts = {}) {
  const fields = [];
  const state = {
    titleDone: false,
    subtitleDone: false,
    btnCount: 0,
    linkCount: 0,
    textCount: 0,
    classSlots: 0,
    sectionHandled: false,
    containerHandled: false,
  };

  const classesMode = opts.classesMode || 'single';
  const textEditable = opts.textEditable !== false; // default true
  const attrEditable = new Set(opts.attrEditable || ['href', 'src', 'alt', 'title']);

  function attrKV(key, val) { return ` ${key}="${escapeAttr(val)}"`; }
  function addField(key, type, label, def) {
    if (fields.find(f => f.key === key)) return; // unique keys
    fields.push({ key, type, label, default: def });
  }

  function chooseClassKey(node) {
    const tag = node.name;
    const cls = (node.attrs.class || '').split(/\s+/).filter(Boolean);
    if (classesMode === 'fixed') return null;
    if (!opts.strictBootstrap || true) {
      if (!state.sectionHandled && tag === 'section') { state.sectionHandled = true; return 'section_classes'; }
      if (!state.containerHandled && (tag === 'div' && cls.includes('container'))) { state.containerHandled = true; return 'container_classes'; }
      if (tag === 'a' && (cls.includes('btn') || cls.some(c => c.startsWith('btn-')))) { return 'btn_classes' + (state.btnCount ? `_${state.btnCount+1}`: ''); }
    }
    // fallback generic
    state.classSlots += 1;
    return `${tag}_classes${state.classSlots > 1 ? '_' + state.classSlots : ''}`;
  }

  function chooseTextKey(node, content) {
    const tag = node.name;
    const parentCls = (node.attrs.class || '').split(/\s+/).filter(Boolean);
    if (tag === 'a' && (parentCls.includes('btn') || parentCls.some(c => c.startsWith('btn-')))) {
      state.btnCount += 1; return state.btnCount === 1 ? 'btn_label' : `btn_label_${state.btnCount}`;
    }
    if (/^h[1-6]$/.test(tag)) {
      if (!state.titleDone) { state.titleDone = true; return 'title'; }
      return `heading_${tag}`;
    }
    if (tag === 'p') {
      if (!state.subtitleDone && state.titleDone) { state.subtitleDone = true; return 'subtitle'; }
      state.textCount += 1; return state.textCount === 1 ? 'text' : `text_${state.textCount}`;
    }
    state.textCount += 1; return state.textCount === 1 ? 'text' : `text_${state.textCount}`;
  }

  function chooseAttrKey(node, attr) {
    const tag = node.name; const cls = (node.attrs.class || '').split(/\s+/).filter(Boolean);
    if (tag === 'a' && attr === 'href') {
      const idx = (++state.linkCount);
      if (cls.includes('btn') || cls.some(c => c.startsWith('btn-'))) return idx === 1 ? 'btn_url' : `btn_url_${idx}`;
      return idx === 1 ? 'link_url' : `link_url_${idx}`;
    }
    if (tag === 'img') {
      if (attr === 'src') return 'img_src';
      if (attr === 'alt') return 'img_alt';
      if (attr === 'title') return 'img_title';
    }
    return `${tag}_${attr}`;
  }

  function render(node, parent = null) {
    if (node.type === 'text') {
      const trimmed = node.content.replace(/\s+/g, ' ');
      if (!textEditable) return trimmed;
      // detect if text is significant
      if (!trimmed.trim()) return trimmed;
      if (parent && parent.type === 'element') {
        const key = chooseTextKey(parent, trimmed);
        addField(key, 'text', 'Текст', trimmed.trim());
        return `{{${key}}}`;
      }
      return trimmed;
    }
    if (node.type === 'element') {
      const tag = node.name;
      let out = `<${tag}`;
      // classes
      let wroteClass = false;
      if (node.attrs.class) {
        const classKey = chooseClassKey(node);
        if (classKey) {
          out += attrKV('class', `{{${classKey}}}`);
          addField(classKey, 'classes', `Классы ${tag}`, node.attrs.class);
          wroteClass = true;
        }
      }
      // other attributes
      for (const [k, v] of Object.entries(node.attrs)) {
        if (k === 'class') continue;
        if (attrEditable.has(k)) {
          const key = chooseAttrKey(node, k);
          out += attrKV(k, `{{${key}}}`);
          const type = k === 'href' || k === 'src' ? 'url' : 'text';
          addField(key, type, `${k.toUpperCase()}`, String(v));
        } else if (v === true) {
          out += ` ${k}`; // boolean attr
        } else {
          out += attrKV(k, String(v));
        }
      }
      const isVoid = VOID_ELEMENTS.has(tag);
      if (isVoid) { out += ' />'; return out; }
      out += '>';
      // children
      for (const ch of node.children) out += render(ch, node);
      out += `</${tag}>`;
      return out;
    }
    // root
    return node.children.map(ch => render(ch, null)).join('');
  }

  const hbs = ast.children.map(ch => render(ch, null)).join('');
  return { hbs, fields };
}

function buildFieldsJson(fields) {
  return JSON.stringify({
    $schema: 'https://justsite.dev/schemas/fields.schema.json',
    version: '1.0.0',
    fields: fields
  }, null, 2);
}

function buildMetaJson(input, slug) {
  return JSON.stringify({
    name: input.componentName,
    slug,
    category: input.category,
    tags: Array.isArray(input.tags) ? input.tags : [],
    description: input.description || 'Компонент Bootstrap 5, совместимый с библиотекой JustSite. ',
    bootstrap: '5',
    accessibility: { ariaReady: true },
    version: '1.0.0'
  }, null, 2);
}

function main() {
  const args = process.argv.slice(2);
  let inputStr = '';
  const iFlag = args.indexOf('--input');
  if (iFlag !== -1 && args[iFlag + 1]) {
    inputStr = fs.readFileSync(path.resolve(args[iFlag + 1]), 'utf8');
  } else {
    const piped = readStdinSync();
    if (piped && piped.trim()) inputStr = piped;
  }

  if (!inputStr) {
    console.error('Usage: node tools/html-to-hbs.js --input ./path/to/input.json OR pipe JSON to stdin');
    process.exit(1);
  }

  let input;
  try { input = JSON.parse(inputStr); } catch (e) {
    console.error('Invalid JSON input:', e.message); process.exit(1);
  }

  const slug = slugify(input.componentName || 'component');
  const ast = parseHTML(String(input.sourceHtml || ''));
  const { hbs, fields } = transformToHbs(ast, input.options || {});

  // Build library target
  const base = path.resolve(__dirname, '..');
  const libDir = path.join(base, 'library');
  const catDirs = String(input.category || 'components').split('/').filter(Boolean);
  const targetDir = path.join(libDir, ...catDirs, slug);
  ensureDir(targetDir);

  // Write files
  fs.writeFileSync(path.join(targetDir, 'index.hbs'), hbs, 'utf8');
  fs.writeFileSync(path.join(targetDir, 'fields.json'), buildFieldsJson(fields), 'utf8');
  fs.writeFileSync(path.join(targetDir, 'meta.json'), buildMetaJson(input, slug), 'utf8');

  console.log('Generated component at:', path.relative(base, targetDir));
  console.log('Files: index.hbs, fields.json, meta.json');
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e); process.exit(1); }
}
