#!/usr/bin/env node
// Checks every lesson before it goes online:  node tools/validate-lessons.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'lessons');
const errors = [];
const err = (where, msg) => errors.push(`✗ ${where}: ${msg}`);

const index = JSON.parse(readFileSync(join(root, 'index.json'), 'utf8'));
const levels = new Set(index.levels.map(l => l.id));
const ids = new Set();

for (const meta of index.lessons) {
  const where = meta.file || meta.id;
  if (ids.has(meta.id)) err(where, `duplicate id "${meta.id}"`);
  ids.add(meta.id);
  if (!levels.has(meta.level)) err(where, `unknown level "${meta.level}"`);
  const path = join(root, meta.file);
  if (!existsSync(path)) { err(where, 'file not found'); continue; }

  let L;
  try { L = JSON.parse(readFileSync(path, 'utf8')); } catch (e) { err(where, `invalid JSON — ${e.message}`); continue; }

  if (L.id !== meta.id) err(where, `id "${L.id}" does not match index id "${meta.id}"`);
  if (L.level !== meta.level) err(where, 'level does not match index');
  for (const k of ['title', 'goal']) if (typeof L[k] !== 'string' || !L[k]) err(where, `missing "${k}"`);
  if (!Array.isArray(L.keyPoints) || L.keyPoints.length < 2) err(where, 'needs at least 2 "keyPoints"');

  const g = L.grammar || {};
  if (!Array.isArray(g.explanation) || !g.explanation.length) err(where, 'grammar.explanation is empty');
  if (!Array.isArray(g.examples) || g.examples.length < 3) err(where, 'grammar.examples needs 3+ items');
  if (g.table && g.table.rows.some(r => r.length !== g.table.headers.length)) err(where, 'grammar.table row length ≠ headers');

  if (!Array.isArray(L.exercises) || L.exercises.length < 6) err(where, 'needs 6+ exercises');
  (L.exercises || []).forEach((x, i) => {
    const w = `${where} exercise ${i + 1}`;
    if (!['choice', 'fill', 'fix', 'order'].includes(x.type)) err(w, `bad type "${x.type}"`);
    if (!x.q) err(w, 'missing q');
    if (!Array.isArray(x.answer) || !x.answer.length) err(w, '"answer" must be a non-empty list');
    if (x.type === 'choice') {
      if (!Array.isArray(x.options) || x.options.length < 2) err(w, 'choice needs options');
      else if (!x.answer?.some(a => x.options.includes(a))) err(w, 'answer is not one of the options');
    }
  });

  const li = L.listening || {};
  if (!Array.isArray(li.script) || li.script.length < 6) err(where, 'listening.script needs 6+ lines');
  (li.script || []).forEach((l, i) => { if (!l.speaker || !l.text) err(`${where} script line ${i + 1}`, 'needs speaker and text'); });
  (li.questions || []).forEach((q, i) => {
    if (!q.options?.includes(q.answer)) err(`${where} listening question ${i + 1}`, 'answer is not one of the options');
  });

  if (!L.writing?.task) err(where, 'missing writing.task');
  for (const k of ['scenario', 'aiRole', 'goal', 'starter']) if (!L.speaking?.[k]) err(where, `missing speaking.${k}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}
console.log(`✓ ${index.lessons.length} lessons are valid.`);
