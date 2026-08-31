import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const layout = await readFile(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8');
const adapter = await readFile(new URL('../src/utils/vlibrasAccessibility.ts', import.meta.url), 'utf8');

test('menu preserva modalidade, retorno de foco e saída ao mudar para desktop', () => {
  assert.match(layout, /dialog\.showModal/);
  assert.match(layout, /dialog\.setAttribute\('open', ''\)/);
  assert.match(layout, /aria-haspopup="dialog"/);
  assert.match(layout, /event\.key === 'Escape'/);
  assert.match(layout, /event\.key !== 'Tab'/);
  assert.match(layout, /trigger\.focus\(\{ preventScroll: true \}\)/);
  assert.match(layout, /matchMedia\('\(min-width: 1024px\)'\)/);
  assert.match(layout, /removeEventListener\('keydown', handleKeyDown\)/);
});

test('atalho de conteúdo não navega para uma rota de hash inválida', () => {
  assert.match(layout, /href="#main-content"[\s\S]{0,100}event\.preventDefault\(\)/);
  assert.match(layout, /mainContentRef\.current\?\.focus/);
  assert.match(layout, /<main ref=\{mainContentRef\} tabIndex=\{-1\}/);
  assert.match(layout, /aria-label="Entrar"/);
});

test('adaptação do VLibras é local, restrita ao widget e sem novos serviços', () => {
  assert.doesNotMatch(adapter, /\bfetch\(|XMLHttpRequest|localStorage|sessionStorage|setInterval\(|\.onclick\s*=/);
  assert.match(adapter, /new WeakMap<Document, \(\) => void>/);
  assert.match(adapter, /bodyObserver\.observe\(doc\.body, \{ childList: true \}\)/);
  assert.match(adapter, /observer\.disconnect\(\)/);
  assert.match(adapter, /'alt', ''/);
  assert.match(adapter, /'aria-pressed'/);
  assert.match(adapter, /currentLabel && currentLabel !== previousLabel/);
});
