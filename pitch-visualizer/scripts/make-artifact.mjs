// Strips the document wrapper from the single-file build so it can be
// published as a self-contained page fragment.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist-single/index.html', 'utf8');
// The downloadable copy, committed so it can be shared without a build
mkdirSync('standalone', { recursive: true });
copyFileSync('dist-single/index.html', 'standalone/index.html');
const out = html
  .replace(/<!doctype html>/i, '')
  .replace(/<\/?(html|head|body)[^>]*>/gi, '')
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '');
writeFileSync('dist-single/artifact.html', out.trim() + '\n');
console.log('dist-single/artifact.html', (out.length / 1024).toFixed(0) + ' KB');
