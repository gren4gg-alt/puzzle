import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../games/cozy-fit-game/game.js',import.meta.url),'utf8');
const source=code.slice(code.indexOf('const LEVELS = '),code.indexOf('const messages = '));
const levels=vm.runInNewContext(source+'; LEVELS;');
const errors=[];
if(levels.length!==50)errors.push(`Expected 50 levels, got ${levels.length}`);
for(const [i,level] of levels.entries()){
 const active=new Set(),filled=new Set();
 level.board.mask.forEach((row,y)=>[...row].forEach((cell,x)=>{if(cell==='#')active.add(`${x},${y}`)}));
 for(const [name,cells,col,row] of level.pieces)for(const [x,y] of cells){const key=`${col+x},${row+y}`;if(!active.has(key)||filled.has(key))errors.push(`Level ${i+1}: invalid stored placement for ${name} at ${key}`);filled.add(key)}
 if(filled.size!==active.size)errors.push(`Level ${i+1}: ${filled.size} piece cells for ${active.size} board cells`);
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}else console.log('PASS: all 50 Cozy Fit levels have complete, non-overlapping stored solutions.');
