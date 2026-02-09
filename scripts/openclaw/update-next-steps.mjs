/**
 * Updates the Next steps block in repo.md from notes/chat-latest.md.
 * Uses only Node built-in modules (fs, path).
 * Deterministic: same input produces same bullets.
 */

import fs from 'fs';
import path from 'path';

const START_MARKER = '<!-- OPENCLAW_NEXT_STEPS_START -->';
const END_MARKER = '<!-- OPENCLAW_NEXT_STEPS_END -->';

const repoRoot = process.cwd();
const notesPath = path.join(repoRoot, 'notes', 'chat-latest.md');
const repoPath = path.join(repoRoot, 'repo.md');

function readNotes() {
  try {
    return fs.readFileSync(notesPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Missing input file: ${notesPath}`);
    }
    throw err;
  }
}

function readRepo() {
  try {
    return fs.readFileSync(repoPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Missing repo.md: ${repoPath}`);
    }
    throw err;
  }
}

/**
 * Parse notes content and extract actionable bullets (5–12).
 * Uses only content after "---" as summary; never invents facts.
 * Order: (1) Risks / follow-ups in appearance order, (2) Commit highlights newest-first, (3) remaining (Key themes).
 * Deduplicate by first occurrence. Deterministic.
 */
function extractNextSteps(notesContent) {
  const summaryPart = notesContent.includes('---')
    ? notesContent.split('---').slice(1).join('---').trim()
    : notesContent.trim();

  const bullets = [];

  function addUnique(verb) {
    if (verb && !bullets.includes(verb)) bullets.push(verb);
  }

  // 1) Risks / follow-ups: order they appear
  const risksMatch = summaryPart.match(/##\s+Risks\s*\/\s*follow-ups\s*([\s\S]*?)(?=##\s|$)/i);
  if (risksMatch) {
    const section = risksMatch[1];
    const lines = section.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*-\s+(.+)$/);
      if (m) {
        const text = m[1].trim();
        if (!text) continue;
        addUnique(toVerbBullet(text));
      }
    }
  }

  // 2) Commit highlights: commit order (newest first = as listed)
  const commitsMatch = summaryPart.match(/##\s+Commit highlights\s*([\s\S]*?)(?=##\s|$)/i);
  if (commitsMatch) {
    const section = commitsMatch[1];
    const commitBlocks = parseCommitBlocks(section);
    for (const block of commitBlocks) {
      const lower = block.toLowerCase();
      if (lower.includes('expected to fail') || lower.includes('until step')) {
        addUnique('Add or extend tests until revenue drivers (volume + connections) pass for fixture 2023.');
      }
      if (lower.includes('p2002') || lower.includes('unique constraint')) {
        addUnique('Verify TalousarvioValisumma unique constraint and P2002 handling in production.');
      }
      if (lower.includes('ci') || lower.includes('local installs')) {
        addUnique('Confirm CI and local installs green after lockfile and web deps changes.');
      }
    }
  }

  // 3) Key themes: order they appear (remaining actionable)
  const themesMatch = summaryPart.match(/##\s+Key themes\s*([\s\S]*?)(?=##\s|$)/i);
  if (themesMatch) {
    const section = themesMatch[1];
    const lines = section.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*-\s+(.+)$/);
      if (m) {
        const theme = m[1].trim();
        if (!theme) continue;
        addUnique(themeToAction(theme));
      }
    }
  }

  return bullets.slice(0, 12);
}

/** Split Commit highlights section into per-commit blocks (newest first). */
function parseCommitBlocks(section) {
  const lines = section.split(/\r?\n/);
  const blocks = [];
  let current = [];
  const commitLineRe = /^\s*-\s+[0-9a-f]+\s+—/i;
  for (const line of lines) {
    if (commitLineRe.test(line)) {
      if (current.length) blocks.push(current.join('\n'));
      current = [line];
    } else if (current.length) {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join('\n'));
  return blocks;
}

function toVerbBullet(text) {
  const t = text.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower.includes('no leftover') || lower.includes('p2002 in production')) return 'Ensure no P2002 in production after TalousarvioValisumma constraint rename.';
  if (lower.includes('sheet layout') || (lower.includes('vatten kva') && lower.includes('anslutningar'))) return 'Document or guard revenue driver extraction sheet layout (Vatten KVA, Avlopp KVA, Anslutningar).';
  if (lower.includes('lockfile') || lower.includes('ci and local') || lower.includes('vitest')) return 'Confirm CI and local installs green after lockfile and web deps changes.';
  if (lower.startsWith('ensure')) return 'Ensure ' + t.slice(6).replace(/^\.\s*/, '').trim();
  if (lower.startsWith('confirm')) return 'Confirm ' + t.slice(7).replace(/^\.\s*/, '').trim();
  if (lower.startsWith('verify')) return 'Verify ' + t.slice(6).replace(/^\.\s*/, '').trim();
  if (lower.startsWith('document')) return 'Document ' + t.slice(8).replace(/^\.\s*/, '').trim();
  if (lower.startsWith('add')) return 'Add ' + t.slice(3).replace(/^\.\s*/, '').trim();
  if (lower.startsWith('investigate')) return 'Investigate ' + t.slice(11).replace(/^\.\s*/, '').trim();
  if (lower.startsWith('fix')) return 'Fix ' + t.slice(3).replace(/^\.\s*/, '').trim();
  return 'Follow up: ' + t;
}

function themeToAction(theme) {
  const lower = theme.toLowerCase();
  if (lower.includes('kva') && lower.includes('import')) return 'Verify KVA import pipeline (preview, confirm, drivers) end-to-end.';
  if (lower.includes('budget schema') || lower.includes('talousarvio')) return 'Verify budget profiles and TalousarvioValisumma in production.';
  if (lower.includes('frontend') && lower.includes('modal')) return 'Verify KVA import modal and RevenueDriversPanel in Tulot.';
  if (lower.includes('tests') && lower.includes('fixture')) return 'Keep fixture 2023 and persistence tests green; add coverage where needed.';
  return null;
}

function updateRepoMd(repoContent, newBullets) {
  const startIdx = repoContent.indexOf(START_MARKER);
  const endIdx = repoContent.indexOf(END_MARKER);

  if (startIdx === -1) throw new Error(`Missing marker in repo.md: ${START_MARKER}`);
  if (endIdx === -1) throw new Error(`Missing marker in repo.md: ${END_MARKER}`);
  if (endIdx <= startIdx) throw new Error('END marker must appear after START marker in repo.md.');

  const before = repoContent.slice(0, startIdx + START_MARKER.length);
  const after = repoContent.slice(endIdx);

  const blockContent =
    '\n\n' +
    newBullets.map((b) => '- ' + b).join('\n') +
    '\n\n';

  return before + blockContent + after;
}

function main() {
  const notesContent = readNotes();
  const repoContent = readRepo();

  const bullets = extractNextSteps(notesContent);
  const newRepo = updateRepoMd(repoContent, bullets);

  fs.writeFileSync(repoPath, newRepo, 'utf8');
}

main();
