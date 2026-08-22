#!/usr/bin/env node
/**
 * Checks every rule a reviewer would otherwise apply by hand: that the JSON
 * parses, that catalog entries and lesson files agree, and that a deck will
 * still study correctly once the app has it.
 *
 * Zero dependencies on purpose - the workflow runs `node scripts/validate.mjs`
 * with no install step, and a contributor can run the same line locally.
 *
 *   node scripts/validate.mjs            errors fail, warnings are printed
 *   node scripts/validate.mjs --strict   warnings fail too
 *
 * Deliberately stricter than the app in two places. Card `id` is required here
 * although `parseLesson` would invent one, because an invented id changes when
 * cards are reordered and takes every learner's review history with it. And
 * `media` links must be https, because the app is served over https and a
 * mixed-content image is a broken image.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const LESSON_DIR = join(ROOT, 'lessons');
const CATALOG = 'catalog.json';
const STRICT = process.argv.includes('--strict');

/** The app rejects an imported file above this size; a raw URL is not checked. */
const MAX_BYTES = 8_000_000;
/** A question that does not fit on a phone screen is really two cards. */
const LONG_FRONT = 160;

const problems = [];
const note = (level, file, message) => problems.push({ level, file, message });
const error = (file, message) => note('error', file, message);
const warn = (file, message) => note('warning', file, message);

const isText = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * JSON.parse reports a character offset; a line number is what you can act on.
 * Newer V8 already names the line, and some messages quote the text instead of
 * giving an offset at all, so this only fills the gap.
 */
function readJson(file) {
  const path = join(ROOT, file);
  const raw = readFileSync(path, 'utf8');

  if (!raw.endsWith('\n')) warn(file, 'No trailing newline.');
  if (raw.charCodeAt(0) === 0xfeff) error(file, 'Starts with a UTF-8 BOM - save it as plain UTF-8.');

  const bytes = statSync(path).size;
  if (bytes > MAX_BYTES) error(file, `${(bytes / 1e6).toFixed(1)} MB - the app refuses anything over 8 MB.`);

  try {
    return { raw, data: JSON.parse(raw) };
  } catch (err) {
    const at = Number(/position (\d+)/.exec(err.message)?.[1]);
    const where =
      Number.isFinite(at) && !err.message.includes('line ')
        ? ` (line ${raw.slice(0, at).split('\n').length})`
        : '';
    error(file, `Not valid JSON${where}: ${err.message}`);
    return { raw, data: null };
  }
}

/**
 * Tags drive the filter chips on Explore, where "Board Exam" and "board exam"
 * show up as two chips that each hide half the decks.
 */
function checkTagCollisions(entries) {
  const byFolded = new Map();
  for (const entry of entries) {
    for (const tag of entry.tags ?? []) {
      if (typeof tag !== 'string') continue;
      const folded = tag.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
      if (!byFolded.has(folded)) byFolded.set(folded, new Set());
      byFolded.get(folded).add(tag);
    }
  }
  for (const spellings of byFolded.values()) {
    if (spellings.size > 1) {
      const list = [...spellings].map((t) => `"${t}"`).join(', ');
      warn(CATALOG, `Tags differ only in case or spacing: ${list} - pick one.`);
    }
  }
}

function checkLesson(file, entry) {
  const { data } = readJson(`lessons/${file}`);
  if (!data) return;
  const where = `lessons/${file}`;

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return error(where, 'The top level must be a lesson object.');
  }

  const expectedId = file.replace(/\.json$/, '');
  if (!isText(data.lessonId)) error(where, 'Missing "lessonId".');
  else if (data.lessonId !== expectedId) {
    error(where, `lessonId "${data.lessonId}" does not match the filename - rename one so they agree ("${expectedId}").`);
  }

  if (!isText(data.title)) error(where, 'Missing "title".');
  for (const field of ['subject', 'author']) {
    if (data[field] !== undefined && !isText(data[field])) {
      error(where, `"${field}" must be non-empty text, or absent.`);
    }
  }

  if (!Array.isArray(data.cards) || data.cards.length === 0) {
    return error(where, 'The lesson has no "cards".');
  }

  const ids = new Set();
  const fronts = new Map();

  data.cards.forEach((card, i) => {
    const at = `cards[${i}]`;
    if (typeof card !== 'object' || card === null || Array.isArray(card)) {
      return error(where, `${at} is not an object.`);
    }

    if (!isText(card.id)) error(where, `${at} has no "id". Ids must be written by hand and never change.`);
    else if (ids.has(card.id)) error(where, `Two cards share the id "${card.id}".`);
    else ids.add(card.id);

    for (const field of ['front', 'back']) {
      if (!isText(card[field])) error(where, `${at}.${field} is missing or empty.`);
    }
    for (const field of ['hint', 'note']) {
      if (card[field] !== undefined && !isText(card[field])) {
        error(where, `${at}.${field} must be non-empty text, or absent.`);
      }
    }

    if (card.tags !== undefined) {
      if (!Array.isArray(card.tags)) error(where, `${at}.tags must be an array.`);
      else if (!card.tags.every(isText)) error(where, `${at}.tags must contain non-empty strings.`);
    }

    if (card.media !== undefined) {
      if (typeof card.media !== 'object' || card.media === null || Array.isArray(card.media)) {
        error(where, `${at}.media must be an object.`);
      } else {
        for (const [key, value] of Object.entries(card.media)) {
          if (!['image', 'audio', 'video'].includes(key)) {
            warn(where, `${at}.media.${key} is not a field the app reads (image, audio, video).`);
            continue;
          }
          if (!isText(value)) error(where, `${at}.media.${key} is empty.`);
          else if (!value.startsWith('https://')) error(where, `${at}.media.${key} must be an https:// link.`);
        }
      }
    }

    if (isText(card.front)) {
      if (card.front.length > LONG_FRONT) {
        warn(where, `${at}.front is ${card.front.length} characters - long fronts usually hide two cards.`);
      }
      const seen = fronts.get(card.front);
      if (seen !== undefined) warn(where, `${at}.front repeats cards[${seen}].front.`);
      else fronts.set(card.front, i);
    }

    if (isText(card.hint) && isText(card.back) && card.hint.trim() === card.back.trim()) {
      warn(where, `${at}.hint is the answer - a hint should point at it, not give it.`);
    }
  });

  // The catalog is what learners browse, so a mismatch shows the wrong deck.
  if (!entry) return;
  if (entry.cardCount !== data.cards.length) {
    error(CATALOG, `${entry.lessonId}: cardCount is ${entry.cardCount}, but the lesson has ${data.cards.length} cards.`);
  }
  for (const field of ['title', 'subject', 'author']) {
    if (data[field] !== undefined && entry[field] !== undefined && data[field] !== entry[field]) {
      error(CATALOG, `${entry.lessonId}: ${field} is "${entry[field]}" here and "${data[field]}" in the lesson file.`);
    }
  }
}

function checkCatalog() {
  const { data } = readJson(CATALOG);
  if (!data) return [];

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    error(CATALOG, 'The top level must be an object with a "lessons" array.');
    return [];
  }
  if (data.version !== 1) warn(CATALOG, `"version" is ${JSON.stringify(data.version)}; the app reads version 1.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.updatedAt ?? '')) {
    warn(CATALOG, '"updatedAt" should be a YYYY-MM-DD date - bump it when you add a deck.');
  }
  if (!Array.isArray(data.lessons) || data.lessons.length === 0) {
    error(CATALOG, 'No "lessons" array.');
    return [];
  }

  const entries = [];
  const ids = new Set();

  data.lessons.forEach((entry, i) => {
    const at = `lessons[${i}]`;
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return error(CATALOG, `${at} is not an object.`);
    }
    entries.push(entry);

    if (!isText(entry.lessonId)) error(CATALOG, `${at}.lessonId is missing.`);
    else {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.lessonId)) {
        error(CATALOG, `${at}.lessonId "${entry.lessonId}" must be lower-case words joined by hyphens.`);
      }
      if (ids.has(entry.lessonId)) error(CATALOG, `Two entries share the lessonId "${entry.lessonId}".`);
      ids.add(entry.lessonId);
    }

    if (!isText(entry.title)) error(CATALOG, `${at}.title is missing.`);
    for (const field of ['subject', 'author', 'description']) {
      if (entry[field] !== undefined && !isText(entry[field])) {
        error(CATALOG, `${at}.${field} must be non-empty text, or absent.`);
      }
    }
    if (!Number.isInteger(entry.cardCount) || entry.cardCount <= 0) {
      error(CATALOG, `${at}.cardCount must be a whole number above zero.`);
    }
    if (entry.tags !== undefined && (!Array.isArray(entry.tags) || !entry.tags.every(isText))) {
      error(CATALOG, `${at}.tags must be an array of non-empty strings.`);
    } else if (!entry.tags?.length) {
      warn(CATALOG, `${at} has no tags, so it will not appear under any filter chip.`);
    }

    // A relative url resolves against the app's own origin, not this repo.
    const url = entry.url;
    if (!isText(url)) return error(CATALOG, `${at}.url is missing.`);
    const match = /^https:\/\/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\/main\/lessons\/([^/]+\.json)$/.exec(url);
    if (!match) {
      return error(
        CATALOG,
        `${at}.url must be an absolute raw link on the main branch: ` +
          'https://raw.githubusercontent.com/<owner>/<repo>/main/lessons/<file>.json',
      );
    }
    const [, repo, file] = match;
    if (process.env.GITHUB_REPOSITORY && repo !== process.env.GITHUB_REPOSITORY) {
      warn(CATALOG, `${at}.url points at ${repo}, not ${process.env.GITHUB_REPOSITORY}.`);
    }
    if (!existsSync(join(LESSON_DIR, file))) {
      error(CATALOG, `${at}.url points at lessons/${file}, which is not in this repo.`);
    }
  });

  // Sorted by lessonId so two PRs adding decks land in different hunks.
  const order = entries.map((e) => e.lessonId).filter(isText);
  const sorted = [...order].sort();
  if (order.join(' ') !== sorted.join(' ')) {
    error(CATALOG, `Entries must be sorted by lessonId. Expected order: ${sorted.join(', ')}`);
  }

  checkTagCollisions(entries);
  return entries;
}

const entries = checkCatalog();
const byFile = new Map(
  entries.filter((e) => isText(e.url)).map((e) => [e.url.split('/').pop(), e]),
);

let files = [];
if (existsSync(LESSON_DIR)) {
  files = readdirSync(LESSON_DIR).filter((f) => !f.startsWith('.')).sort();
} else {
  error('lessons/', 'The lessons/ directory is missing.');
}

for (const file of files) {
  if (!file.endsWith('.json')) {
    warn(`lessons/${file}`, 'Only .json files belong in lessons/.');
    continue;
  }
  // An unlisted lesson is invisible in Explore, which is almost never intended.
  if (!byFile.has(file)) error(`lessons/${file}`, 'No catalog.json entry points at this file.');
  checkLesson(file, byFile.get(file));
}

const errors = problems.filter((p) => p.level === 'error');
const warnings = problems.filter((p) => p.level === 'warning');

for (const { level, file, message } of problems) {
  // GitHub renders these inline on the pull request diff.
  if (process.env.GITHUB_ACTIONS) console.log(`::${level} file=${file}::${message}`);
  else console.log(`${level === 'error' ? 'ERROR' : 'warn '} ${file}: ${message}`);
}

const decks = files.filter((f) => f.endsWith('.json')).length;
const cards = entries.reduce((sum, e) => sum + (Number.isInteger(e.cardCount) ? e.cardCount : 0), 0);
console.log(
  `\n${decks} lesson files, ${entries.length} catalog entries, ${cards} cards - ` +
    `${errors.length} error(s), ${warnings.length} warning(s).`,
);

process.exit(errors.length || (STRICT && warnings.length) ? 1 : 0);
