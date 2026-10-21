// 把 vite.artifact.config.ts 的构建产物组装成单个 HTML 页面（Artifact 发布格式：无 doctype/head/body）
import { readFileSync, writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'dist-artifact/student-os.html';
const css = readFileSync('dist-artifact/app.css', 'utf8');
const js = readFileSync('dist-artifact/app.js', 'utf8').replace(/<\/script/gi, '<\\/script');

const html = `<title>Student OS</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${css}
</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
${js}
</script>
`;

writeFileSync(out, html);
console.log(`artifact page → ${out} (${(html.length / 1024).toFixed(1)} KB)`);
