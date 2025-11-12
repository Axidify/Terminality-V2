const fs = require('fs');
const path = require('path');

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (entry.isFile() && fullPath.endsWith('.css')) files.push(fullPath);
  }
  return files;
}

function checkFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  let balance = 0;
  let line = 1;
  let col = 0;
  let firstError = null;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '\n') { line++; col = 0; continue; }
    col++;
    if (ch === '{') balance++;
    if (ch === '}') {
      balance--;
      if (balance < 0 && !firstError) {
        firstError = { line, col };
      }
    }
  }
  return { balance, firstError };
}

function main() {
  const root = path.join(__dirname, '..', 'src');
  const files = walk(root);
  let hadIssue = false;
  for (const file of files) {
    const res = checkFile(file);
    if (res.firstError) {
      hadIssue = true;
      console.log(`[ERROR] ${file}: Unexpected '}' at ${res.firstError.line}:${res.firstError.col}`);
    }
    if (res.balance !== 0) {
      hadIssue = true;
      console.log(`[ERROR] ${file}: Unbalanced braces. Net balance: ${res.balance}`);
    }
  }
  if (!hadIssue) console.log('All CSS files have balanced braces.');
}

main();
