/*
 * Copyright 2026 INFOBIP
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile } from 'tailwindcss';
import { BRANDS, BUTTON_SLOTS, BUTTON_VARIANTS } from './tokens.ts';
import { THEME_TOKEN_VARS, resolveThemeTokenStyle, themeTokensToStyle } from './themeTokens.ts';
import { BUTTON_VARIANT_CLASSES } from '../components/button/Button.tsx';
import { ROOT_SELECTOR, selectorList, styleRules } from './cssScope.ts';

// Tests run from a bundle in a temp dir, so sources are found from the repo
// root that `npm run test:frontend` runs in.
const FEATURE_DIR = join(process.cwd(), 'frontend', 'flow-builder');
const THEME_CSS = readFileSync(join(FEATURE_DIR, 'styles', 'theme.css'), 'utf8');
const APP_CSS = readFileSync(join(FEATURE_DIR, 'styles', 'app.css'), 'utf8');
const TAILWIND_THEME_CSS = readFileSync(join(FEATURE_DIR, 'styles', 'tailwind-theme.css'), 'utf8');
// Every brand but the default has a stylesheet; undefined when it's missing, so
// the brand tests below can say which one.
const BRAND_CSS = new Map(
  BRANDS.filter((brand) => brand !== 'default').map((brand) => {
    const path = join(FEATURE_DIR, 'styles', 'brands', `${brand}.css`);
    return [brand, existsSync(path) ? stripComments(readFileSync(path, 'utf8')) : undefined] as const;
  }),
);
const BRAND_SHEETS = Array.from(BRAND_CSS, ([brand, css]) => ({ file: `styles/brands/${brand}.css`, css: css ?? '' }));

// Anything a rebrander might paste: hex (3/4/6/8 digits, any case), CSS colour
// functions, a var() reference, transparent / currentColor, or a named colour.
const NAMED_COLOURS = new Set(
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'.split(' '),
);
function isColour(value: string): boolean {
  const v = value.trim();
  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return true;
  if (/^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(.+\)$/i.test(v)) return true;
  if (/^var\(--[\w-]+(,.+)?\)$/.test(v)) return true;
  return /^(transparent|currentcolor)$/i.test(v) || NAMED_COLOURS.has(v.toLowerCase());
}
const COLOUR_TOKEN = /^--fb-(color|text-color|border-color)-/;

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Body of the `{…}` block that starts at the first `{` at or after `from`. */
function blockAt(css: string, from: number): string {
  const open = css.indexOf('{', from);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error('unbalanced braces');
}

function declarations(block: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [, name, value] of block.matchAll(/(--[\w\\.-]+)\s*:\s*([^;{}]+);/g)) out.set(name, value.trim());
  return out;
}

const theme = stripComments(THEME_CSS);
// theme.css declares every token on the bare root, in three blocks: the light
// colours, the colours shared by both themes, and type/shape/motion.
const rootBlocks = Array.from(theme.matchAll(/(?<=(?:^|[{};])\s*)\[data-flowbuilder-root\]\s*\{/g), (match) => blockAt(theme, match.index));
const lightBlock = rootBlocks.find((block) => block.includes('--fb-color-canvas'));
const sharedBlock = rootBlocks.find((block) => block.includes('--fb-color-nav-surface'));
const LIGHT = lightBlock === undefined ? undefined : declarations(lightBlock);
const SHARED = sharedBlock === undefined ? undefined : declarations(sharedBlock);
const TOKENS = new Map(rootBlocks.flatMap((block) => Array.from(declarations(block))));
const darkAt = theme.search(/\[data-flowbuilder-root\]\[data-theme=['"]dark['"]\]\s*\{/);
const DARK = darkAt < 0 ? undefined : declarations(blockAt(theme, darkAt));

test('theme.css has a light, a both-themes and a dark colour block', () => {
  assert.ok(LIGHT, 'no [data-flowbuilder-root] block holds the light colours');
  assert.ok(SHARED, 'no [data-flowbuilder-root] block holds the theme-independent colours');
  assert.ok(DARK, 'no [data-flowbuilder-root][data-theme="dark"] block');
});

test('every button variant has all five colour slots in light and dark', () => {
  for (const [label, block] of [['light', LIGHT], ['dark', DARK]] as const) {
    for (const variant of BUTTON_VARIANTS) {
      for (const slot of BUTTON_SLOTS) {
        const name = `--fb-color-btn-${variant}-${slot}`;
        const value = block?.get(name);
        assert.ok(value, `${label} is missing ${name}`);
        assert.ok(isColour(value), `${label} ${name} is not a colour: ${value}`);
      }
    }
  }
});

test('every light colour has a dark value; only the both-themes block goes without', () => {
  const light = Array.from(LIGHT?.keys() ?? []).filter((name) => COLOUR_TOKEN.test(name));
  const shared = Array.from(SHARED?.keys() ?? []).filter((name) => COLOUR_TOKEN.test(name));
  const dark = new Set(DARK?.keys() ?? []);

  assert.deepEqual(light.filter((name) => !dark.has(name)), [], 'light colours without a dark value');
  assert.deepEqual(Array.from(dark).filter((name) => !light.includes(name)), [], 'dark values with no light colour');
  assert.deepEqual(shared.filter((name) => light.includes(name) || dark.has(name)), [], 'both-themes colours that are also themed');
  for (const name of [...light, ...shared]) {
    const value = LIGHT?.get(name) ?? SHARED?.get(name) ?? '';
    assert.ok(isColour(value), `light ${name} is not a colour: ${value}`);
  }
  for (const [name, value] of DARK ?? []) assert.ok(isColour(value), `dark ${name} is not a colour: ${value}`);
});

// ── Tailwind's mapping ────────────────────────────────────────────────────
// tailwind-theme.css points Tailwind's names at the tokens. A token with no
// mapping has no utility; a mapping with no token compiles to an undefined var().

const TAILWIND_MAP = declarations(blockAt(stripComments(TAILWIND_THEME_CSS), stripComments(TAILWIND_THEME_CSS).search(/@theme\b/)));

test('every token theme.css declares is mapped for Tailwind under its own name, and nothing else is', () => {
  const mappedTo = new Map<string, string>();
  for (const [name, value] of TAILWIND_MAP) {
    const target = /^var\((--fb-[\w-]+)\)$/.exec(value)?.[1];
    if (target) mappedTo.set(target, name);
  }
  const unmapped = Array.from(TOKENS.keys()).filter((token) => !mappedTo.has(token));
  const dangling = Array.from(mappedTo.keys()).filter((token) => !TOKENS.has(token));
  const renamed = Array.from(mappedTo).filter(([token, name]) => token !== `--fb-${name.slice(2)}`).map(([token, name]) => `${name} → ${token}`);
  assert.deepEqual(unmapped, [], 'tokens with no line in tailwind-theme.css');
  assert.deepEqual(dangling, [], 'tailwind-theme.css maps to tokens theme.css never declares');
  assert.deepEqual(renamed, [], 'a Tailwind name must map to the --fb- token of the same name');
});

test('the public tokens are all --fb- prefixed and declared on the builder root', () => {
  const sheets = [{ file: 'styles/theme.css', css: theme }, ...BRAND_SHEETS];
  for (const { file, css } of sheets) {
    for (const [, name] of css.matchAll(/(--[\w\\.-]+)\s*:/g)) {
      assert.match(name, /^--fb-/, `${file} declares ${name}; public tokens are --fb-*`);
    }
    assert.doesNotMatch(css, /@theme\b/, `${file} uses @theme, which declares variables on :root`);
  }
});

// ── Nothing escapes the builder root ──────────────────────────────────────
// The builder sits inside other people's pages. The compiled stylesheet may
// style only the builder: every rule's selector starts at the root (or :host,
// for a Shadow DOM embed). The exceptions are document-wide by nature and
// can't restyle anything: @font-face (prefixed families), @keyframes (fb-
// names) and @property registrations for Tailwind's internal --tw-* names,
// plus the `@layer properties` fallback that sets those --tw-* names on every
// element in browsers without @property (older Safari and Firefox).

async function compiledAppCss(candidates: string[]): Promise<string> {
  const stylesDir = join(FEATURE_DIR, 'styles');
  const tailwindDir = join(process.cwd(), 'node_modules', 'tailwindcss');
  const compiler = await compile(APP_CSS, {
    base: stylesDir,
    loadStylesheet: async (id, base) => {
      const path = id === 'tailwindcss' ? join(tailwindDir, 'index.css')
        : id.startsWith('tailwindcss/') ? join(tailwindDir, id.slice('tailwindcss/'.length))
          : join(base, id);
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
    },
  });
  return compiler.build(candidates);
}

test('every rule in the compiled stylesheet is scoped to the builder root', async () => {
  const usedIn = extractClassCandidates(await loadTypeScript(), CLASS_SOURCES);
  const css = await compiledAppCss(Array.from(usedIn.keys()));
  const escaped: string[] = [];
  for (const { selector, within } of styleRules(css)) {
    if (within.some((at) => /^@(keyframes|font-face|property)\b/.test(at))) continue;
    // Tailwind's --tw-* defaults for browsers without @property: custom properties only.
    if (within.includes('@layer properties')) continue;
    for (const part of selectorList(selector)) if (!ROOT_SELECTOR.test(part)) escaped.push(part);
  }
  assert.deepEqual(escaped, [], 'selectors that reach outside [data-flowbuilder-root]');
});

test('the compiled stylesheet declares no custom properties outside the builder', async () => {
  const css = stripComments(await compiledAppCss([]));
  assert.doesNotMatch(css, /:root/, 'the stylesheet mentions :root');
  const keyframes = Array.from(css.matchAll(/@keyframes\s+([\w-]+)/g), (match) => match[1]);
  assert.deepEqual(keyframes.filter((name) => !name.startsWith('fb-')), [], 'keyframes without the fb- prefix');
  const families = Array.from(css.matchAll(/@font-face\s*\{[^}]*font-family:\s*['"]([^'"]+)['"]/g), (match) => match[1]);
  assert.ok(families.length > 0, 'no @font-face found');
  assert.deepEqual(families.filter((family) => !family.startsWith('FB ')), [], 'font families without the FB prefix');
});

// `@source '..'` also scans `*.test.ts`; a fixture string such as
// `bg-[url(/logo-white.svg)]` then became a real rule in the shipped
// stylesheet, with an absolute URL no customer bundler can resolve.
test('app.css keeps test files out of the Tailwind class scan', () => {
  assert.match(APP_CSS, /@source not '[^']*\.test\.\{ts,tsx\}'/);
});

test('the scope check catches a rule that escapes the root', () => {
  const sample = '[data-flowbuilder-root] .a, :is([data-flowbuilder-root] .b > *) { x: 1 } html { x: 1 } .c\\,d { x: 1 } @keyframes fb-x { to { x: 1 } }';
  const escaped = styleRules(sample).filter(({ within }) => !within.some((at) => at.startsWith('@keyframes')))
    .flatMap(({ selector }) => selectorList(selector)).filter((part) => !ROOT_SELECTOR.test(part));
  assert.deepEqual(escaped, ['html', '.c\\,d']);
});

// ── Brands ────────────────────────────────────────────────────────────────
// A brand restyles the app for [data-brand="<name>"] by overriding theme.css's
// names. It sets every colour in its light block and again in its dark block:
// a colour it skipped would show the default look through, and a light value
// with no dark twin ties with theme.css's dark block (same specificity), so
// source order alone would decide which one dark mode gets.

/** A brand's light (`[data-brand=…]`) and dark (`[data-brand=…][data-theme=dark]`) declarations.
 *  Only rules whose whole selector is one of those count: `.x [data-flowbuilder-root]…` never matches the root. */
function brandBlocks(css: string, brand: string) {
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  const selector = new RegExp(String.raw`(?<=(?:^|[{};])\s*)\[data-flowbuilder-root\]\[data-brand=['"]${brand}['"]\](\[data-theme=['"]dark['"]\])?\s*\{`, 'g');
  for (const match of css.matchAll(selector)) {
    const target = match[1] ? dark : light;
    for (const [name, value] of declarations(blockAt(css, match.index))) target.set(name, value);
  }
  return { light, dark };
}

test('every brand has a stylesheet, imported by app.css after theme.css', () => {
  const app = stripComments(APP_CSS);
  const themeAt = app.search(/@import\s+['"]\.\/theme\.css['"]/);
  assert.ok(themeAt >= 0, 'app.css does not import ./theme.css');
  for (const [brand, css] of BRAND_CSS) {
    assert.ok(css !== undefined, `the ${brand} brand has no styles/brands/${brand}.css`);
    // A block inside a condition may never apply, and the checks below would still count it.
    assert.doesNotMatch(css, /@(media|supports|container)\b/, `styles/brands/${brand}.css nests its blocks in a conditional rule`);
    const at = app.search(new RegExp(String.raw`@import\s+['"]\./brands/${brand}\.css['"]`));
    assert.ok(at > themeAt, `app.css must import ./brands/${brand}.css after ./theme.css`);
  }
});

test('a brand sets every colour in light and in dark, and only names theme.css defines', () => {
  const colours = [...(LIGHT?.keys() ?? []), ...(SHARED?.keys() ?? [])].filter((name) => COLOUR_TOKEN.test(name)).sort();
  const defined = new Set(Array.from(theme.matchAll(/(--[\w\\.-]+)\s*:/g), (match) => match[1]));
  for (const [brand, css = ''] of BRAND_CSS) {
    const { light, dark } = brandBlocks(css, brand);
    for (const [label, block] of [['light', light], ['dark', dark]] as const) {
      const set = Array.from(block.keys()).filter((name) => COLOUR_TOKEN.test(name)).sort();
      assert.deepEqual(set, colours, `${brand}'s ${label} block must set exactly theme.css's colours`);
      for (const [name, value] of block) {
        assert.ok(defined.has(name), `${brand} ${label} sets ${name}, which theme.css doesn't define`);
        if (COLOUR_TOKEN.test(name)) assert.ok(isColour(value), `${brand} ${label} ${name} is not a colour: ${value}`);
      }
    }
  }
});

// The point of the per-variant tokens: a button's colour is decided in the
// theme and nowhere else. A variant reaching for the semantic ramp again
// would quietly reopen a second place to edit.
test("each button variant uses only its own colour tokens, and all five of them", () => {
  const slots = [...BUTTON_SLOTS].sort((a, b) => b.length - a.length).join('|');
  for (const variant of BUTTON_VARIANTS) {
    const utilities = BUTTON_VARIANT_CLASSES[variant].split(/\s+/).map((cls) => cls.split(':').pop() ?? cls);
    const used = new Set<string>();
    for (const utility of utilities) {
      const match = new RegExp(`^(bg|text|border)-btn-([a-z]+)-(${slots})$`).exec(utility);
      assert.ok(match, `${variant} uses a colour outside the button palette: ${utility}`);
      assert.equal(match[2], variant, `${variant} reads another variant's token: ${utility}`);
      used.add(match[3]);
    }
    assert.deepEqual(Array.from(used).sort(), [...BUTTON_SLOTS].sort(), `${variant} does not consume every colour slot`);
  }
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [full] : [];
  });
}

/** Custom properties the app measures and sets inline, with a CSS fallback where they're read. */
const RUNTIME_PROPERTIES = ['--fb-vh', '--fb-topbar-h'];

const SOURCES = sourceFiles(FEATURE_DIR).map((file) => ({ file: relative(FEATURE_DIR, file), text: readFileSync(file, 'utf8') }));

test('every var() in the stylesheets and components is defined', () => {
  const defined = new Set<string>();
  for (const css of [theme, stripComments(APP_CSS), stripComments(TAILWIND_THEME_CSS), ...BRAND_SHEETS.map(({ css }) => css)]) {
    for (const [, name] of css.matchAll(/(--[\w\\.-]+)\s*:/g)) defined.add(name);
  }
  // Measured at runtime and set inline on the root (FlowBuilderApp, EditorTopBar).
  for (const name of RUNTIME_PROPERTIES) defined.add(name);
  // Custom properties a component sets inline, e.g. the code editor's metrics.
  for (const { text } of SOURCES) {
    for (const [, name] of text.matchAll(/['"](--[\w-]+)['"]\s*:/g)) defined.add(name);
  }

  const missing: string[] = [];
  const check = (where: string, text: string) => {
    // `var(--x)` in CSS, inline styles and arbitrary values; `-(--x)` is Tailwind's shorthand for it.
    for (const [, name] of text.matchAll(/(?:var\(|-\()(--[\w\\.-]+)/g)) {
      if (!defined.has(name)) missing.push(`${where}: ${name}`);
    }
  };
  check('theme.css', theme);
  check('app.css', stripComments(APP_CSS));
  check('tailwind-theme.css', stripComments(TAILWIND_THEME_CSS));
  for (const { file, css } of BRAND_SHEETS) check(file, css);
  for (const { file, text } of SOURCES) check(file, text);

  assert.deepEqual(missing, []);
});

// Colours belong in theme.css so a rebrand is one file. The WhatsApp preview
// keeps its own fixed palette in whatsapp-flow-preview/styles.ts, by design.
test('no source or app.css rule hard-codes a colour', () => {
  const LITERAL = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/gi;
  const scanned = [
    ...SOURCES.filter(({ file }) => !file.startsWith('whatsapp-flow-preview')),
    { file: 'styles/app.css', text: stripComments(APP_CSS) },
  ];
  const offenders = scanned.flatMap(({ file, text }) => Array.from(text.matchAll(LITERAL), (match) => `${file}: ${match[0]}`));
  assert.deepEqual(offenders, []);
});

// ── Every class the app uses must compile ─────────────────────────────────
// A class naming a token theme.css no longer defines (or a typo) compiles to
// nothing and fails silently in the browser; this finds it at test time.

type Ts = typeof import('typescript');
type TsNode = import('typescript').Node;
type Expr = import('typescript').Expression;

/** Constants (`CARD`, `STATE_CLASSES`) and helpers (`underlineTabClassName`) that hold classes. */
const CLASS_NAME = /^[A-Z][A-Z0-9_]*$|Class(Name)?$/;
/** JSX props that take classes: `className`, `fieldClassName`, … */
const CLASS_PROP = /^className$|ClassName$/;

export type Source = { file: string; text: string };

/**
 * The class tokens the app's sources can put on an element, with the file each
 * first appears in. Starts from class contexts — class props, `cx()` arguments
 * and the constants / helpers those name — and follows only the positions a
 * class string can flow out of: `?:` branches, the right of `&&`, `||` / `??`,
 * template literal text, object-map values, and local bindings (resolved with
 * the type checker, so another function's `tone` isn't mistaken for this one).
 * Compared or lookup-key strings are never reached, so there's nothing to skip.
 */
export function extractClassCandidates(ts: Ts, sources: Source[]): Map<string, string> {
  const host = ts.createCompilerHost({});
  const byPath = new Map(sources.map((source) => [`/src/${source.file}`, source]));
  const files = new Map(Array.from(byPath, ([path, { file, text }]) => [
    path,
    ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS),
  ]));
  const program = ts.createProgram({
    rootNames: Array.from(files.keys()),
    options: { noLib: true, noResolve: true, jsx: ts.JsxEmit.Preserve, allowJs: false },
    host: { ...host, getSourceFile: (path) => files.get(path), fileExists: (path) => files.has(path), readFile: (path) => byPath.get(path)?.text },
  });
  const checker = program.getTypeChecker();

  const found = new Map<string, string>();
  const referenced = new Set<string>();
  const seen = new Set<TsNode>();
  let file = '';

  // Every `x = …` assignment in the file, per binding, for `let` bindings built up in branches.
  const assignments = new Map<import('typescript').Symbol, Expr[]>();
  for (const sourceFile of files.values()) {
    const walk = (node: TsNode): void => {
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left)) {
        const symbol = checker.getSymbolAtLocation(node.left);
        if (symbol) assignments.set(symbol, [...(assignments.get(symbol) ?? []), node.right]);
      }
      ts.forEachChild(node, walk);
    };
    walk(sourceFile);
  }

  const addTokens = (text: string, trimStart = false, trimEnd = false) => {
    const tokens = text.split(/\s+/);
    // A token touching a `${…}` is only part of a class; skip it.
    if (trimStart && !/^\s/.test(text)) tokens.shift();
    if (trimEnd && !/\s$/.test(text)) tokens.pop();
    for (const token of tokens) if (token && !found.has(token)) found.set(token, file);
  };
  const returns = (body: TsNode): void => {
    if (ts.isReturnStatement(body) && body.expression) value(body.expression);
    else if (!ts.isFunctionLike(body)) ts.forEachChild(body, returns);
  };
  const fn = (node: TsNode) => {
    if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) && node.body) {
      if (ts.isBlock(node.body)) returns(node.body);
      else value(node.body);
    }
  };
  const value = (node: TsNode): void => {
    if (seen.has(node)) return;
    seen.add(node);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return addTokens(node.text);
    if (ts.isTemplateExpression(node)) {
      addTokens(node.head.text, false, true);
      node.templateSpans.forEach((span, index) => {
        value(span.expression);
        addTokens(span.literal.text, true, index < node.templateSpans.length - 1);
      });
      return;
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) return value(node.expression);
    if (ts.isJsxExpression(node)) return node.expression && value(node.expression);
    if (ts.isConditionalExpression(node)) return (value(node.whenTrue), value(node.whenFalse));
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) return value(node.right);
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.PlusToken) return (value(node.left), value(node.right));
      return;
    }
    if (ts.isArrayLiteralExpression(node)) return node.elements.forEach(value);
    if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) if (ts.isPropertyAssignment(property)) value(property.initializer);
      return;
    }
    // `MAP[key]`, `MAP.key`: the map holds the classes, the key doesn't.
    if (ts.isElementAccessExpression(node) || ts.isPropertyAccessExpression(node)) return value(node.expression);
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && callee.text === 'cx') return node.arguments.forEach(value);
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'join') return value(callee.expression);
      return value(callee);
    }
    if (ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node);
      const declarations = symbol?.declarations ?? [];
      for (const decl of declarations) {
        if (ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name) && decl.initializer) {
          if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) fn(decl.initializer);
          else value(decl.initializer);
        } else if (ts.isFunctionDeclaration(decl)) fn(decl);
      }
      for (const assigned of (symbol && assignments.get(symbol)) ?? []) value(assigned);
      // Imported constants and helpers resolve by name across files, below.
      const imported = declarations.length === 0 || declarations.some((decl) => ts.isImportSpecifier(decl) || ts.isImportClause(decl));
      if (imported && CLASS_NAME.test(node.text)) referenced.add(node.text);
    }
  };

  const contexts = (node: TsNode): void => {
    if (ts.isJsxAttribute(node) && CLASS_PROP.test(node.name.getText()) && node.initializer) value(node.initializer);
    else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'cx') value(node);
    ts.forEachChild(node, contexts);
  };
  for (const [path, sourceFile] of files) {
    file = byPath.get(path)?.file ?? path;
    contexts(sourceFile);
  }

  // Exported class constants and helpers, followed until no new names turn up.
  const resolved = new Set<string>();
  while (referenced.size > resolved.size) {
    for (const name of Array.from(referenced)) {
      if (resolved.has(name)) continue;
      resolved.add(name);
      for (const [path, sourceFile] of files) {
        file = byPath.get(path)?.file ?? path;
        const visit = (node: TsNode): void => {
          if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) value(node.name);
          else if (ts.isFunctionDeclaration(node) && node.name?.text === name) fn(node);
          else ts.forEachChild(node, visit);
        };
        visit(sourceFile);
      }
    }
  }
  return found;
}

/** CSS.escape, as Tailwind escapes a candidate into its class selector. */
function cssEscape(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const digitStart = code >= 48 && code <= 57 && (i === 0 || (i === 1 && value.charCodeAt(0) === 45));
    if ((code >= 1 && code <= 31) || code === 127 || digitStart) out += `\\${code.toString(16)} `;
    else if (code >= 128 || code === 45 || code === 95 || (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) out += value[i];
    else out += `\\${value[i]}`;
  }
  return out;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `.cls` as a whole class in the compiled CSS — not the start of `.cls-active`. */
export function selectorPattern(cls: string): RegExp {
  return new RegExp(`(?<!\\\\)\\.${escapeRegExp(cssEscape(cls))}(?![\\w\\\\-])`);
}

// Classes that only mark an element for other utilities and emit no CSS themselves.
const MARKER_CLASSES = new Set(['group']);

// A colour pasted into an arbitrary value (`border-[white]`, `bg-[#fff]`) skips the theme.
// Quoted text and url() are content, not colours (`content-['white']`, a `logo-white.svg`
// background), and a colour name only counts as a whole value token, so an attribute
// selector like `data-[color=red]:` doesn't trip it.
function arbitraryColour(cls: string): string | undefined {
  for (const [, raw] of cls.matchAll(/\[([^\]]+)\]/g)) {
    const inner = raw.replace(/(['"]).*?\1/g, '').replace(/url\([^)]*\)/gi, '');
    const literal = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i.exec(inner)?.[0]
      ?? inner.split(/[\s_,()/]+/)
        .map((token) => token.slice(token.lastIndexOf(':') + 1))
        .find((word) => NAMED_COLOURS.has(word.toLowerCase()));
    if (literal) return literal;
  }
  return undefined;
}

async function loadTypeScript(): Promise<Ts> {
  return (await import(pathToFileURL(join(process.cwd(), 'node_modules', 'typescript', 'lib', 'typescript.js')).href)).default;
}
const CLASS_SOURCES = SOURCES.filter(({ file }) => !file.startsWith('whatsapp-flow-preview'));

test('every Tailwind class the app uses compiles against app.css + theme.css', async () => {
  const usedIn = extractClassCandidates(await loadTypeScript(), CLASS_SOURCES);
  for (const marker of MARKER_CLASSES) usedIn.delete(marker);

  const stylesDir = join(FEATURE_DIR, 'styles');
  const tailwindDir = join(process.cwd(), 'node_modules', 'tailwindcss');
  const compiler = await compile(APP_CSS, {
    base: stylesDir,
    loadStylesheet: async (id, base) => {
      const path = id === 'tailwindcss' ? join(tailwindDir, 'index.css')
        : id.startsWith('tailwindcss/') ? join(tailwindDir, id.slice('tailwindcss/'.length))
          : join(base, id);
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
    },
  });
  const css = compiler.build(Array.from(usedIn.keys()));

  const missing = Array.from(usedIn).filter(([cls]) => !selectorPattern(cls).test(css)).map(([cls, file]) => `${file}: ${cls}`);
  assert.ok(usedIn.size > 300, `only ${usedIn.size} classes found — the extraction is broken`);
  assert.deepEqual(missing, [], 'classes that compile to no CSS');
});

test('no class hard-codes a colour in an arbitrary value', async () => {
  const usedIn = extractClassCandidates(await loadTypeScript(), CLASS_SOURCES);
  const offenders = Array.from(usedIn).flatMap(([cls, file]) => {
    const literal = arbitraryColour(cls);
    return literal ? [`${file}: ${cls} (${literal})`] : [];
  });
  assert.deepEqual(offenders, []);
});

test('the arbitrary-value colour check ignores quoted content, url() and attribute selectors', () => {
  assert.equal(arbitraryColour('border-[white]'), 'white');
  assert.equal(arbitraryColour('shadow-[0_0_0_1px_white]'), 'white');
  assert.equal(arbitraryColour('bg-[color:red]'), 'red');
  assert.equal(arbitraryColour('bg-[#fff]'), '#fff');
  assert.equal(arbitraryColour("bg-[url('/logo-white.svg')]"), undefined);
  assert.equal(arbitraryColour('bg-[url(/logo-white.svg)]'), undefined);
  assert.equal(arbitraryColour("before:content-['white']"), undefined);
  assert.equal(arbitraryColour('data-[color=red]:bg-surface'), undefined);
});

// ── themeTokens.ts ↔ theme.css ─────────────────────────────────────────────

test('themeTokens.ts lists exactly the --fb-* tokens theme.css declares', () => {
  const declared = new Set(Array.from(TOKENS.keys()).filter((name) => name.startsWith('--fb-')));
  const listed = new Set<string>(Object.values(THEME_TOKEN_VARS));
  assert.deepEqual(
    [...declared].filter((name) => !listed.has(name)),
    [],
    'declared in theme.css but missing from THEME_TOKEN_VARS',
  );
  assert.deepEqual(
    [...listed].filter((name) => !declared.has(name)),
    [],
    'in THEME_TOKEN_VARS but not declared in theme.css',
  );
});

test('every THEME_TOKEN_VARS key is the camelCase of its custom property', () => {
  for (const [key, name] of Object.entries(THEME_TOKEN_VARS)) {
    const camel = name.replace(/^--fb-/, '').replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
    assert.equal(key, camel);
  }
});

test('themeTokensToStyle maps keys to custom properties and drops unknown or unsafe entries', () => {
  assert.deepEqual(
    themeTokensToStyle({ colorSurface: ' #fff ', textColorMuted: 'rgb(1, 2, 3)', radius: '4px' }),
    { '--fb-color-surface': '#fff', '--fb-text-color-muted': 'rgb(1, 2, 3)', '--fb-radius': '4px' },
  );
  const bad = {
    nope: 'red',
    colorPrimary: 'red; background: url(x)',
    colorDanger: 'red}</style><script>',
    colorAccent: '{x:y}',
    colorSuccess: 'url(https://evil.example/x)',
    colorWarning: 'red /* c */',
    radiusSm: 4,
    radiusMd: '',
    radiusLg: '8px',
  };
  assert.deepEqual(themeTokensToStyle(bad as never), { '--fb-radius-lg': '8px' });
  assert.deepEqual(themeTokensToStyle(undefined), {});
});

test('resolveThemeTokenStyle: light uses tokens; dark keeps non-colour tokens and layers darkTokens on top', () => {
  const tokens = { colorPrimary: '#111', radius: '2px', fontSans: 'Foo', shadowCard: '0 1px #000' };
  const darkTokens = { colorPrimary: '#eee', radius: '6px' };
  assert.deepEqual(resolveThemeTokenStyle('light', tokens, darkTokens), {
    '--fb-color-primary': '#111',
    '--fb-radius': '2px',
    '--fb-font-sans': 'Foo',
    '--fb-shadow-card': '0 1px #000',
  });
  assert.deepEqual(resolveThemeTokenStyle('dark', tokens, darkTokens), {
    '--fb-font-sans': 'Foo',
    '--fb-color-primary': '#eee',
    '--fb-radius': '6px',
  });
  assert.deepEqual(resolveThemeTokenStyle('dark', { colorSurface: '#fff' }, undefined), {});
  assert.deepEqual(resolveThemeTokenStyle('light', undefined, { colorSurface: '#000' }), {});
});

test('isolation.css is imported after preflight and every rule in it starts at the builder root', () => {
  const css = readFileSync(join(FEATURE_DIR, 'styles', 'isolation.css'), 'utf8');
  assert.ok(APP_CSS.indexOf("@import './preflight.css'") < APP_CSS.indexOf("@import './isolation.css'"), 'isolation.css must follow preflight.css');
  const rules = styleRules(css);
  assert.ok(rules.length > 0);
  for (const { selector } of rules) for (const part of selectorList(selector)) assert.match(part, ROOT_SELECTOR, `${part} escapes the root`);
  assert.ok(rules.some(({ selector }) => selector === '[data-flowbuilder-root] *'), 'missing the universal inherit rule');
  assert.doesNotMatch(stripComments(css), /!important|\ball\s*:/, 'isolation.css must not use !important or the all shorthand');
});
