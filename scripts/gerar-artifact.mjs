// Transforma o build single-file em uma página pronta para o Artifact:
// sem doctype/html/head/body próprios, com as fontes do Google via <link>.
import { readFileSync, writeFileSync } from 'node:fs';

const ENTRADA = 'dist-demo/index.html';
const SAIDA = '/home/claude/riften-hold-demo.html';

const bruto = readFileSync(ENTRADA, 'utf8');

const cabeca = bruto.match(/<head>([\s\S]*?)<\/head>/)[1];
const corpo = bruto.match(/<body>([\s\S]*?)<\/body>/)[1];

// Do <head> aproveitamos só <title>, <style> e <script>.
const pedacos = [];
const titulo = cabeca.match(/<title>[\s\S]*?<\/title>/);
if (titulo) pedacos.push(titulo[0]);

pedacos.push(
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400..900&family=Inter:wght@300..800&display=swap" rel="stylesheet">',
);

for (const m of cabeca.matchAll(/<style[\s\S]*?<\/style>/g)) pedacos.push(m[0]);

// Os scripts vêm depois do #root: o bundle inline não é módulo diferido.
const scripts = [...cabeca.matchAll(/<script[\s\S]*?<\/script>/g)].map((m) => m[0]);

const saida = `${pedacos.join('\n')}\n${corpo.trim()}\n${scripts.join('\n')}\n`;
writeFileSync(SAIDA, saida);
console.log(`${SAIDA} — ${(saida.length / 1024).toFixed(1)} kB`);
