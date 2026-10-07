// Parse real JS string literals, never substitute inside HTML/shader strings.
// Shared Blob URLs also prevent repeated native image decoding by URL identity.
import ts from 'typescript';
export function poolOfflineImages(html){
 const images=[],index=new Map();let replacements=0;
 let result=html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(_,open,source,close)=>{
  if(!source.includes('data:image/'))return open+source+close;
  const tree=ts.createSourceFile('offline.js',source,ts.ScriptTarget.ES2020,false,ts.ScriptKind.JS),edits=[];
  function visit(n){
   if([ts.SyntaxKind.TemplateHead,ts.SyntaxKind.TemplateMiddle,ts.SyntaxKind.TemplateTail].includes(n.kind)){
    const from=n.getStart(tree),raw=source.slice(from,n.end);
    if(/(?:src|href)=["']data:image\//.test(raw)){
     for(const m of raw.matchAll(/data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=]+/g)){
      const uri=m[0];let i=index.get(uri);if(i===undefined){i=images.length;index.set(uri,i);images.push(uri);}
      edits.push({from:from+m.index,to:from+m.index+uri.length,text:'${window.__AEROSENSE_IMAGE_URLS__['+i+']}'});replacements++;
     }
    }
   }
   if(ts.isStringLiteralLike(n)){
    const pure=/^data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=]+$/.test(n.text);
    const markup=/<(?:img|image|svg)\b/.test(n.text)&&/(?:src|href)=["']data:image\//.test(n.text);
    if(pure||markup){
     const chunks=[];let offset=0;
     for(const m of n.text.matchAll(/data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=]+/g)){
      const uri=m[0];let i=index.get(uri);if(i===undefined){i=images.length;index.set(uri,i);images.push(uri);}
      if(m.index>offset)chunks.push(JSON.stringify(n.text.slice(offset,m.index)));
      chunks.push('window.__AEROSENSE_IMAGE_URLS__['+i+']');offset=m.index+uri.length;replacements++;
     }
     if(offset<n.text.length)chunks.push(JSON.stringify(n.text.slice(offset)));
     if(chunks.length)edits.push({from:n.getStart(tree),to:n.end,text:'('+chunks.join('+')+')'});
    }
   }
   ts.forEachChild(n,visit);
  }
  visit(tree);for(const e of edits.sort((a,b)=>b.from-a.from))source=source.slice(0,e.from)+e.text+source.slice(e.to);
  return open+source+close;
 });
 const registry='<script>(()=>{const data='+JSON.stringify(images)+',urls=[],cache=[];data.forEach((_,i)=>Object.defineProperty(urls,i,{get(){if(cache[i])return cache[i];const s=data[i],comma=s.indexOf(","),mime=s.slice(5,s.indexOf(";")),raw=atob(s.slice(comma+1)),bytes=new Uint8Array(raw.length);for(let j=0;j<raw.length;j++)bytes[j]=raw.charCodeAt(j);cache[i]=URL.createObjectURL(new Blob([bytes],{type:mime}));data[i]="";return cache[i];}}));window.__AEROSENSE_IMAGE_URLS__=urls;})();</script>';
 result=result.replace('<head>','<head>'+registry);
 return {html:result,unique:images.length,replacements,savedBytes:Buffer.byteLength(html)-Buffer.byteLength(result)};
}
