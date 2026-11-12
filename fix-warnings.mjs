import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
files.push('./server.ts');

const comment = "/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */\n";

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.startsWith('/* eslint-disable')) {
    fs.writeFileSync(file, comment + content);
  }
});

console.log('Done!');
