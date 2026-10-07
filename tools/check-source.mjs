import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {Script} from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const manifest=JSON.parse(await fs.readFile(path.join(root,'src/three-src/models/manifest.json'),'utf8'));
let models=0;
for(const [name,record] of Object.entries(manifest)){
 const data=await fs.readFile(path.join(root,'src/three-src/models',name));
 if(data.length!==record.bytes||hash(data)!==record.sha256)throw Error('模型完整性校验失败: '+name);models++;
}
const template=await fs.readFile(path.join(root,'templates/AeroSense_11.7.2.html'),'utf8');
const provenance=JSON.parse(await fs.readFile(path.join(root,'source-provenance.json'),'utf8'));
if(hash(template)!==provenance.templateSha256)throw Error('模板完整性校验失败');
let scripts=0;for(const m of template.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){new Script(m[1]);scripts++;}
for(const m of template.matchAll(/["']\.\/图片资产\/([^"']+)["']/g))await fs.access(path.join(root,'assets/images',m[1]));
for(const asset of provenance.importedAssets){const data=await fs.readFile(path.join(root,'src/three-src/imported-assets',asset.asset));if(hash(data)!==asset.sha256)throw Error('资源完整性校验失败: '+asset.asset);}
console.log(JSON.stringify({status:'pass',models,templateScripts:scripts,importedAssets:provenance.importedAssets.length}));
