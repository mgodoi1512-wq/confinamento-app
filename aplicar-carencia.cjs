// Executar no terminal aberto na raiz do projeto. Usa apenas módulos nativos do Node.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.cwd();
const normalize = text => text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const hash = text => crypto.createHash('sha256').update(normalize(text)).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifesto.json'), 'utf8'));
const documentation = fs.readFileSync(path.join(__dirname, 'documentacao.txt'), 'utf8');
const docsPath = 'CodeGuideline.md';
const heading = '## Ajuda da carência no protocolo (21/10/2026)';

function main() {
  if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'src/pages/health/protocols.tsx'))) {
    throw new Error('Abra o terminal na pasta do projeto que contém package.json e a pasta src. Depois execute novamente.');
  }
  if (process.argv.length > 2) throw new Error('Este instalador não recebe argumentos. Execute no terminal da raiz do projeto.');

  // Valida todos os arquivos antes de fazer qualquer alteração.
  for (const file of manifest.files) {
    const source = path.join(__dirname, '.', file.path);
    if (!file.remove && hash(fs.readFileSync(source, 'utf8')) !== file.after) throw new Error(`Arquivo do pacote inválido: ${file.path}`);
    const dest = path.join(root, file.path);
    const current = fs.existsSync(dest) ? hash(fs.readFileSync(dest, 'utf8')) : null;
    if (!file.before.includes(current) && current !== file.after) {
      throw new Error(`O arquivo ${file.path} difere da versão usada como base. Nenhum arquivo foi alterado. Envie a versão atual para adaptar este ajuste sem apagar mudanças da outra conversa.`);
    }
  }
  const filesDone = manifest.files.every(file => file.remove ? !fs.existsSync(path.join(root,file.path)) : fs.existsSync(path.join(root,file.path)) && hash(fs.readFileSync(path.join(root,file.path),'utf8')) === file.after);
  const docs = fs.existsSync(path.join(root, docsPath)) ? fs.readFileSync(path.join(root, docsPath), 'utf8') : '';
  if (filesDone && (!fs.existsSync(path.join(root, docsPath)) || docs.includes(heading))) {
    console.log('A ajuda da carência já está atualizada. Nenhum arquivo foi alterado.');
    return;
  }

  const backup = path.join(root, 'backups-carencia', new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid);
  fs.mkdirSync(backup, {recursive:true});
  const targets = [...manifest.files.map(file => file.path), ...(fs.existsSync(path.join(root, docsPath)) ? [docsPath] : [])];
  const snapshots = targets.map(relative => {
    const dest = path.join(root, relative);
    const existed = fs.existsSync(dest);
    const backupName = relative.replace(/\//g, '__') + '.bak';
    if (existed) fs.copyFileSync(dest, path.join(backup, backupName));
    return {path:relative, existed, backupName};
  });
  fs.writeFileSync(path.join(backup, 'restauracao.json'), JSON.stringify(snapshots, null, 2));

  try {
    for (const file of manifest.files) {
      const dest = path.join(root, file.path);
      fs.mkdirSync(path.dirname(dest), {recursive:true});
      if (file.remove) { if (fs.existsSync(dest)) fs.unlinkSync(dest); }
      else fs.copyFileSync(path.join(__dirname, '.', file.path), dest);
    }
    if (fs.existsSync(path.join(root, docsPath)) && !docs.includes(heading)) {
      fs.appendFileSync(path.join(root, docsPath), '\n\n' + documentation);
    }
    for (const file of manifest.files) {
      if (file.remove ? fs.existsSync(path.join(root,file.path)) : hash(fs.readFileSync(path.join(root,file.path),'utf8')) !== file.after) throw new Error(`Falha ao verificar ${file.path}`);
    }
  } catch (error) {
    for (const item of snapshots) {
      const dest = path.join(root, item.path);
      if (item.existed) fs.copyFileSync(path.join(backup, item.backupName), dest);
      else if (fs.existsSync(dest)) fs.unlinkSync(dest);
    }
    throw error;
  }
  console.log('Ajuda da carência atualizada para computador e celular.');
  console.log('Backup: ' + backup);
  console.log('Agora execute: npm run build');
  console.log('Para conferir a tela localmente, execute: npm run dev');
}
try { main(); } catch (error) { console.error('\n' + error.message); process.exitCode = 1; }
