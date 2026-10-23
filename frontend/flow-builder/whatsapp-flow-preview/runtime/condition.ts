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

// ── WhatsApp Flow Preview · safe condition evaluator ────────────────────────
//
// A tiny, self-contained expression evaluator for the boolean conditions Flow
// uses in `If`, `visible`, and `enabled`. It is a hand-written tokenizer +
// recursive-descent parser — there is deliberately NO `eval` and NO `Function`
// constructor, so untrusted flow JSON can never execute arbitrary code.
//
// Supported grammar (precedence low → high):
//   ||                                     logical or
//   &&                                     logical and
//   == != === !==                          equality
//   < <= > >=                              relational
//   ! -                                    unary not / negate
//   ${data.x} ${form.y} bareIdent          references
//   'str' "str" 123 1.5 true false null    literals
//   ( … )                                  grouping
//
// Anything it cannot parse resolves to the caller-supplied fallback rather than
// throwing — the renderer must never crash on a malformed condition.

import type { PreviewRenderContext } from '../types';
import { lookupReference } from './template';

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'null' }
  | { kind: 'ref'; expr: string }
  | { kind: 'op'; value: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

const TWO_CHAR_OPS = ['===', '!==', '==', '!=', '<=', '>=', '&&', '||'];

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1;
      continue;
    }

    // ${ … } reference
    if (ch === '$' && input[i + 1] === '{') {
      const end = input.indexOf('}', i + 2);
      if (end < 0) return null;
      tokens.push({ kind: 'ref', expr: input.slice(i + 2, end) });
      i = end + 1;
      continue;
    }

    // string literal
    if (ch === "'" || ch === '"') {
      const end = input.indexOf(ch, i + 1);
      if (end < 0) return null;
      tokens.push({ kind: 'str', value: input.slice(i + 1, end) });
      i = end + 1;
      continue;
    }

    // parentheses
    if (ch === '(') {
      tokens.push({ kind: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen' });
      i += 1;
      continue;
    }

    // multi-char / single-char operators
    const three = input.slice(i, i + 3);
    const two = input.slice(i, i + 2);
    const matched = TWO_CHAR_OPS.find((op) => op.length === 3 && three === op)
      ?? TWO_CHAR_OPS.find((op) => op.length === 2 && two === op);
    if (matched) {
      tokens.push({ kind: 'op', value: matched });
      i += matched.length;
      continue;
    }
    if (ch === '<' || ch === '>' || ch === '!' || ch === '-') {
      tokens.push({ kind: 'op', value: ch });
      i += 1;
      continue;
    }

    // number
    if (ch >= '0' && ch <= '9') {
      let j = i + 1;
      while (j < n && ((input[j] >= '0' && input[j] <= '9') || input[j] === '.')) j += 1;
      tokens.push({ kind: 'num', value: Number(input.slice(i, j)) });
      i = j;
      continue;
    }

    // identifier: keyword literals, or a bare dotted reference (data.x / form.y)
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_.[\]]/.test(input[j])) j += 1;
      const word = input.slice(i, j);
      i = j;
      if (word === 'true' || word === 'false') tokens.push({ kind: 'bool', value: word === 'true' });
      else if (word === 'null') tokens.push({ kind: 'null' });
      else tokens.push({ kind: 'ref', expr: word });
      continue;
    }

    return null; // unrecognized character
  }

  return tokens;
}

// ── Recursive-descent parser → evaluator ────────────────────────────────────

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[], private readonly ctx: PreviewRenderContext) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  parse(): unknown {
    const value = this.parseOr();
    if (this.pos !== this.tokens.length) throw new Error('trailing tokens');
    return value;
  }

  private parseOr(): unknown {
    let left = this.parseAnd();
    while (this.isOp('||')) {
      this.next();
      const right = this.parseAnd();
      left = toBool(left) || toBool(right);
    }
    return left;
  }

  private parseAnd(): unknown {
    let left = this.parseEquality();
    while (this.isOp('&&')) {
      this.next();
      const right = this.parseEquality();
      left = toBool(left) && toBool(right);
    }
    return left;
  }

  private parseEquality(): unknown {
    let left = this.parseRelational();
    while (this.isOp('==') || this.isOp('!=') || this.isOp('===') || this.isOp('!==')) {
      const op = (this.next() as { value: string }).value;
      const right = this.parseRelational();
      left = applyEquality(op, left, right);
    }
    return left;
  }

  private parseRelational(): unknown {
    let left = this.parseUnary();
    while (this.isOp('<') || this.isOp('<=') || this.isOp('>') || this.isOp('>=')) {
      const op = (this.next() as { value: string }).value;
      const right = this.parseUnary();
      left = applyRelational(op, left, right);
    }
    return left;
  }

  private parseUnary(): unknown {
    if (this.isOp('!')) {
      this.next();
      return !toBool(this.parseUnary());
    }
    if (this.isOp('-')) {
      this.next();
      return -toNumber(this.parseUnary());
    }
    return this.parsePrimary();
  }

  private parsePrimary(): unknown {
    const token = this.next();
    if (!token) throw new Error('unexpected end');
    switch (token.kind) {
      case 'num':
        return token.value;
      case 'str':
        return token.value;
      case 'bool':
        return token.value;
      case 'null':
        return null;
      case 'ref':
        return lookupReference(token.expr, this.ctx);
      case 'lparen': {
        const value = this.parseOr();
        const close = this.next();
        if (!close || close.kind !== 'rparen') throw new Error('missing )');
        return value;
      }
      default:
        throw new Error('unexpected token');
    }
  }

  private isOp(value: string): boolean {
    const token = this.peek();
    return token?.kind === 'op' && token.value === value;
  }
}

function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value == null) return false;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === '' || trimmed === 'false' || trimmed === '0' || trimmed === 'null' || trimmed === 'undefined') {
      return false;
    }
    return true;
  }
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

function looksNumeric(value: unknown): boolean {
  return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)));
}

function applyEquality(op: string, left: unknown, right: unknown): boolean {
  const strict = op === '===' || op === '!==';
  const negate = op === '!=' || op === '!==';
  let equal: boolean;
  if (strict) {
    equal = left === right;
  } else if (looksNumeric(left) && looksNumeric(right)) {
    equal = toNumber(left) === toNumber(right);
  } else if (typeof left === 'boolean' || typeof right === 'boolean') {
    equal = toBool(left) === toBool(right);
  } else {
    equal = String(left ?? '') === String(right ?? '');
  }
  return negate ? !equal : equal;
}

function applyRelational(op: string, left: unknown, right: unknown): boolean {
  let a: number | string;
  let b: number | string;
  if (looksNumeric(left) && looksNumeric(right)) {
    a = toNumber(left);
    b = toNumber(right);
  } else {
    a = String(left ?? '');
    b = String(right ?? '');
  }
  switch (op) {
    case '<':
      return a < b;
    case '<=':
      return a <= b;
    case '>':
      return a > b;
    case '>=':
      return a >= b;
    default:
      return false;
  }
}

/**
 * Evaluate a Flow condition string to a boolean. Malformed or empty
 * expressions resolve to `fallback` (never throw).
 */
export function evaluateCondition(
  condition: unknown,
  ctx: PreviewRenderContext,
  fallback = false,
): boolean {
  if (typeof condition === 'boolean') return condition;
  if (condition == null) return fallback;
  if (typeof condition !== 'string') return fallback;

  const trimmed = condition.trim();
  if (trimmed === '') return fallback;

  const tokens = tokenize(trimmed);
  if (!tokens || tokens.length === 0) return fallback;

  try {
    return toBool(new Parser(tokens, ctx).parse());
  } catch {
    return fallback;
  }
}

/**
 * Resolve a `visible` / `enabled` flag which may be a boolean or a condition
 * string. Defaults to `true` (components are visible/enabled unless told not).
 */
export function resolveFlag(flag: unknown, ctx: PreviewRenderContext): boolean {
  if (flag == null) return true;
  if (typeof flag === 'boolean') return flag;
  return evaluateCondition(flag, ctx, true);
}
