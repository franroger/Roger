// Gera dist-pagina/gestao-obras.html: o app inteiro em um único arquivo HTML
// (usado para publicar a versão online). Rode: npm run build:pagina
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';

const dir = 'dist-pagina/assets';
const arquivos = readdirSync(dir);
const js = arquivos.filter((f) => f.endsWith('.js')).map((f) => readFileSync(`${dir}/${f}`, 'utf8')).join('\n');
const css = arquivos.filter((f) => f.endsWith('.css')).map((f) => readFileSync(`${dir}/${f}`, 'utf8')).join('\n');
const html = `<title>Gestão de Obras</title>
<style>${css}</style>
<div id="root"></div>
<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>
`;
mkdirSync('dist-pagina', { recursive: true });
writeFileSync('dist-pagina/gestao-obras.html', html);
console.log(`dist-pagina/gestao-obras.html (${Math.round(html.length / 1024)} KB)`);
