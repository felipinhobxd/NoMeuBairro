import assert from 'node:assert/strict';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const assetsDir = new URL('../dist/assets/', import.meta.url);
const files = (await readdir(assetsDir)).filter(file => file.endsWith('.js'));
assert.ok(files.length > 0, 'Nenhum bundle JavaScript foi gerado.');

const sizes = await Promise.all(files.map(async file => ({ file, bytes: (await stat(join(assetsDir.pathname, file))).size })));
const largest = sizes.sort((a, b) => b.bytes - a.bytes)[0];
const limit = 500 * 1024;
assert.ok(largest.bytes <= limit, `${largest.file} tem ${largest.bytes} bytes e ultrapassa o limite de ${limit} bytes.`);
console.log(`Maior bundle: ${largest.file} (${largest.bytes} bytes).`);
