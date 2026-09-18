import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'..');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name.startsWith('.')?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
const files=walk(root).filter(f=>f.endsWith('.html'));
const failures=[],docs=new Map();let scriptCount=0,linkCount=0;
for(const file of walk(path.join(root,'games')).filter(f=>f.endsWith('.js'))){try{new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});scriptCount++}catch(e){failures.push(`External script syntax: ${e.message}`)}}
const removeCode=s=>s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
for(const file of files){const s=fs.readFileSync(file,'utf8'),html=removeCode(s),name=path.relative(root,file);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 for(const id of new Set(ids))if(ids.filter(v=>v===id).length>1)failures.push(`${name}: duplicate id ${id}`);
 for(const tag of ['title'])if(!new RegExp(`<${tag}>[^<]+</${tag}>`).test(s))failures.push(`${name}: missing ${tag}`);
 if(!/rel="canonical"/.test(s))failures.push(`${name}: missing canonical`);
 if(!/name="description"/.test(s))failures.push(`${name}: missing description`);
 docs.set(file,{html,ids,name});
 for(const match of s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  const attrs=match[1],code=match[2];if(!code.trim()||/src=|application\/ld\+json|importmap/.test(attrs))continue;
  scriptCount++;
  try{if(/type="module"/.test(attrs))new vm.SourceTextModule(code,{identifier:name});else new vm.Script(code,{filename:name})}catch(e){failures.push(`${name}: script syntax ${e.message}`)}
 }
}
for(const [file,doc] of docs){
 for(const m of doc.html.matchAll(/\b(?:href|src)="([^"\s]+)"/g)){
  const value=m[1];if(/^(https?:|mailto:|data:|blob:|\/\/)/.test(value)||value.includes('${'))continue;
  const url=new URL(value,'https://broshere.com/'+doc.name.replaceAll('\\','/'));
  let target=path.join(root,decodeURIComponent(url.pathname));if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
  linkCount++;if(!fs.existsSync(target))failures.push(`${doc.name}: missing target ${value}`);
  else if(url.hash&&docs.has(target)&&!docs.get(target).ids.includes(decodeURIComponent(url.hash.slice(1))))failures.push(`${doc.name}: missing anchor ${value}`);
 }
}
const urls=[...fs.readFileSync(path.join(root,'sitemap.xml'),'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
for(const url of urls){let p=path.join(root,new URL(url).pathname);if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');if(!fs.existsSync(p))failures.push(`Sitemap missing: ${url}`)}
for(const [file,{html,name}] of docs){if(name.startsWith('guides')||['puzzle-exchange.html','exam-photo-resizer.html','media-compressor.html','model-workbench.html'].includes(name)){const text=html.replace(/<[^>]+>/g,' ').replace(/&(?:#\d+|#x[a-f0-9]+|[a-z]+);/gi,' ');console.log(`${name}: ${text.trim().split(/\s+/).length} approximate text words`)} }
console.log(`${files.length} HTML pages, ${scriptCount} scripts, ${linkCount} local references, ${urls.length} sitemap URLs checked.`);
if(failures.length){console.error(failures.join('\n'));process.exitCode=1}else console.log('PASS: local links, anchors, metadata, IDs, sitemap targets, and script syntax.');
