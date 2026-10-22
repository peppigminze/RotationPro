// Erzeugt die Precache-Liste des Service Workers aus allen App-Dateien und erhöht die Cache-Version.
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const root = new URL('..', import.meta.url).pathname;
const files = ['index.html', 'manifest.json'];
const walk = (d) => readdirSync(join(root, d)).forEach((f) => { const p = join(d, f); statSync(join(root, p)).isDirectory() ? walk(p) : files.push(p); });
['css', 'js', 'icons'].forEach(walk);
const hash = createHash('sha1');
files.forEach((f) => hash.update(readFileSync(join(root, f))));
const version = hash.digest('hex').slice(0, 10);
const sw = readFileSync(join(root, 'sw.js'), 'utf8')
  .replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`)
  .replace(/const ASSETS = \[[\s\S]*?\];/, `const ASSETS = [\n${files.map((f) => `  './${f}',`).join('\n')}\n];`);
writeFileSync(join(root, 'sw.js'), sw);
console.log('sw.js:', files.length, 'Dateien, Version', version);
