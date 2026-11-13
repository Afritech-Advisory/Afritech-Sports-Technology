// Strips the document wrapper from the single-file build so it can be
// published as a self-contained page fragment.
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist-single/index.html', 'utf8');
const out = html
  .replace(/<!doctype html>/i, '')
  .replace(/<\/?(html|head|body)[^>]*>/gi, '')
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '');
writeFileSync('dist-single/artifact.html', out.trim() + '\n');
console.log('dist-single/artifact.html', (out.length / 1024).toFixed(0) + ' KB');
