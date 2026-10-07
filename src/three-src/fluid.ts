import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {TwinState} from './state';
import retainedMaterialPresets from './models/retained_material_presets.json';
import {applyRetainedMaterialPresets} from './retained-materials.mjs';

// Ver8: ABC base stocks; D nitrogen compensation; E potassium/boron in bulking.
// Selection is not a continuous dosing command. Flow markers remain event-controlled.
export function stageStocks(label:string):number[]{
 if(label==='种苗准备期')return [];
 if(label==='营养生长期')return [0,1,2,3];
 if(label==='块茎膨大期')return [0,1,2,4];
 return ['定植成活期','块茎形成期','块茎成熟期','采前品质期'].includes(label)?[0,1,2]:[];
}

// Display plumbing, derived from the Ver8 process; coordinates are not fabrication drawings.
export function createFluid(){
 const ranking=!!(window as any).__AEROSENSE_RANKING_MODE__;
 const group=new T.Group();group.name='nutrient-service-base';
 const graphite=new T.MeshStandardMaterial({color:0x303638,roughness:.64,metalness:.35});
 const steel=new T.MeshStandardMaterial({color:0x849197,roughness:.31,metalness:.78});
 const polymer=new T.MeshStandardMaterial({color:0x171f22,roughness:.68});
 const glass=new T.MeshStandardMaterial({color:0xb3c8cc,transparent:true,opacity:.12,roughness:.17,depthWrite:false});
 const water=new T.MeshStandardMaterial({color:0x608e91,transparent:true,opacity:.58,roughness:.20,metalness:.15,emissive:0x416b60,emissiveIntensity:.18,depthWrite:false});
 const V=(p:number[])=>new T.Vector3(...p as [number,number,number]);
 function box(name:string,p:number[],s:number[],m:T.Material=graphite){const o=new T.Mesh(new RoundedBoxGeometry(...s as [number,number,number],2,.009),m);o.name=name;o.position.fromArray(p);group.add(o);return o;}
 function cylinder(name:string,p:number[],r:number,h:number,m:T.Material=steel,axis='y'){const o=new T.Mesh(new T.CylinderGeometry(r,r,h,24),m);o.name=name;o.position.fromArray(p);if(axis==='x')o.rotation.z=Math.PI/2;group.add(o);return o;}
 const annotations:{name:string;at:T.Vector3}[]=[];
 function text(name:string,p:number[],_w=.22){annotations.push({name,at:V(p)});
  if(/^[A-E]$/.test(name)){const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d')!;ctx.font='600 88px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#bdc9c1';ctx.fillText(name,64,66);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const label=new T.Mesh(new T.PlaneGeometry(.072,.072),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));label.position.fromArray(p);label.position.z+=.008;label.name='stock-letter-'+name;group.add(label);}
 }
 box('base-floor',[0,-.59,0],[2.58,.045,.98]);box('base-back',[0,-.26,-.45],[2.56,.65,.026]);
 for(const x of [-1.26,1.26]){box('base-side',[x,-.26,0],[.035,.65,.98]);for(const z of [-.40,.40])box('base-foot',[x,-.64,z],[.12,.07,.12],polymer);}
 box('tank-floor',[-.72,-.54,.0],[.94,.035,.77],polymer);box('tank-back',[-.72,-.27,-.37],[.94,.54,.025],polymer);
 for(const x of [-1.18,-.26])box('tank-side',[x,-.27,0],[.025,.54,.77],polymer);
 box('tank-lid',[-.72,-.015,0],[.94,.027,.77]);box('tank-window',[-.72,-.27,.39],[.89,.49,.008],glass);
 box('nutrient-liquid',[-.72,-.385,0],[.88,.29,.70],water);
 const surfaceGeo=new T.PlaneGeometry(.88,.70,24,16);surfaceGeo.rotateX(-Math.PI/2);
 const surface=new T.Mesh(surfaceGeo,water);surface.position.set(-.72,-.24,0);surface.name='nutrient-liquid-surface';group.add(surface);text('营养液',[-.94,-.10,.42],.33);
 const tray=new T.Mesh(new T.PlaneGeometry(2.40,.59,30,8),water.clone());tray.rotation.x=-Math.PI/2;tray.position.set(0,.125,0);tray.name='return-water-film';group.add(tray);
 const cans:T.Mesh[]=[];
 for(let i=0;i<5;i++){const x=.03+i*.20;const can=cylinder('stock-'+String.fromCharCode(65+i),[x,-.40,.25],.072,.26,polymer);cans.push(can);cylinder('stock-cap',[x,-.255,.25],.052,.035);text(String.fromCharCode(65+i),[x,-.40,.327],.10);}
 cylinder('filter',[-.10,-.11,.13],.055,.16);text('过滤',[-.10,-.03,.25],.15);
 const uvShell=cylinder('uv-c-reactor',[.40,-.10,.12],.065,.70,steel.clone(),'x');
 const windowMat=new T.MeshStandardMaterial({color:0x181023,emissive:0xa076e6,emissiveIntensity:0,roughness:.16,metalness:.12});
 const rim=new T.Mesh(new T.TorusGeometry(.026,.005,8,32),steel);rim.position.set(.40,-.10,.185);group.add(rim);
 const pane=new T.Mesh(new T.CircleGeometry(.024,32),windowMat);pane.position.set(.40,-.10,.188);pane.name='uv-status-window';group.add(pane);
 const core=new T.Mesh(new T.CircleGeometry(.009,24),new T.MeshBasicMaterial({color:0xc5a3ff}));core.position.set(.40,-.10,.189);group.add(core);
 for(const x of [.05,.75])cylinder('uv-flange',[x,-.10,.12],.08,.028,steel,'x');
 const quartz=cylinder('quartz-sleeve',[.40,-.10,.12],.027,.64,glass,'x');
 const uvMat=new T.MeshBasicMaterial({color:0xc3b6e7,transparent:true,opacity:0});cylinder('uv-c-lamp-cutaway',[.40,-.10,.12],.008,.61,uvMat,'x');
 text('UV-C',[.40,.005,.22],.19);
 const pump=cylinder('feed-pump',[1.06,-.24,.12],.09,.19,graphite);cylinder('pump-head',[1.06,-.11,.12],.072,.075);text('供液',[1.06,-.40,.25],.18);
 // The cooler and gas-liquid mixer are separate tank side loops, not root-room emitters.
 box('chiller',[-.93,-.40,.49],[.28,.22,.16]);for(let i=0;i<5;i++)box('chiller-fin',[-1.025+i*.047,-.40,.578],[.018,.15,.005],steel);
 text('冷却',[-.93,-.55,.58],.17);
 const oxygen=cylinder('oxygen-flow-cell',[-.48,-.40,.50],.062,.23,glass);cylinder('oxygen-cell-top',[-.48,-.27,.50],.070,.026);cylinder('oxygen-cell-base',[-.48,-.53,.50],.070,.026);text('氧合',[-.48,-.57,.58],.17);
 cylinder('oxygen-diffuser',[-.48,-.493,.50],.019,.042,steel);
 const bubbleMaterial=ranking?new T.ShaderMaterial({transparent:true,depthWrite:false,
  vertexShader:'varying vec3 n;varying vec3 eye;void main(){vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);n=normalize(normalMatrix*mat3(instanceMatrix)*normal);eye=-mv.xyz;gl_Position=projectionMatrix*mv;}',
  fragmentShader:'varying vec3 n;varying vec3 eye;void main(){vec3 norm=normalize(n);float rim=pow(1.-abs(dot(norm,normalize(eye))),2.);float glint=pow(max(0.,dot(norm,normalize(vec3(-.5,.7,.65)))),28.);gl_FragColor=vec4(vec3(.64,.81,.76)+glint*.24,.15+rim*.52+glint*.28);}'
 }):new T.MeshBasicMaterial({color:0xc7e0dd,transparent:true,opacity:.65});
 const bubbleCount=ranking?64:36;
 const bubbles=new T.InstancedMesh(new T.SphereGeometry(ranking?.0034:.003,ranking?12:6,ranking?8:4),bubbleMaterial,bubbleCount);bubbles.name='liquid-only-oxygen-markers';group.add(bubbles);
 type Line={name:string;curve:T.CurvePath<T.Vector3>;markers:T.InstancedMesh;kind:string};const lines:Line[]=[];
 function pipe(name:string,points:number[][],kind:string,r=.016){const curve=new T.CurvePath<T.Vector3>();for(let i=1;i<points.length;i++)curve.add(new T.LineCurve3(V(points[i-1]),V(points[i])));const material=new T.MeshStandardMaterial({color:0x4b6267,roughness:.30,metalness:.38,transparent:true,opacity:.55});const tube=new T.Mesh(new T.TubeGeometry(curve,Math.max(16,points.length*8),r,10,false),material);tube.name=name;group.add(tube);for(const p of [points[0],points.at(-1)!]){const fitting=new T.Mesh(new T.SphereGeometry(r*1.4,10,8),steel);fitting.position.fromArray(p);group.add(fitting);}
  const markers=new T.InstancedMesh(new T.SphereGeometry(r*.46,6,4),new T.MeshBasicMaterial({color:kind==='cool'?0x7daab9:0xa4c5bb}),8);markers.name=name+'-flow';group.add(markers);lines.push({name,curve,markers,kind});}
 pipe('tank-to-filter',[[-.26,-.11,.13],[-.155,-.11,.13]],'feed');
 pipe('filter-to-uv',[[-.045,-.11,.13],[.05,-.10,.12]],'feed');
 pipe('uv-to-pump',[[.75,-.10,.12],[1.06,-.10,.12]],'feed');
 pipe('pump-to-manifold',[[1.06,-.10,.12],[1.20,-.10,.12],[1.20,.18,.12],[1.13,.18,0]],'spray');
 pipe('circulation-bypass',[[1.06,-.10,.12],[1.13,-.18,.04],[-.35,-.18,.04],[-.35,-.24,.04]],'bypass',.010);
 pipe('tray-to-tank',[[.96,.12,.26],[.96,-.04,.32],[-.55,-.04,.32],[-.55,-.24,.32]],'return');
 // Distinct depth lanes keep an illuminated stock branch from covering its neighbours.
 for(let i=0;i<5;i++){const x=.03+i*.20,z=.25+i*.022;pipe('dose-'+String.fromCharCode(65+i),[[x,-.24,.25],[x,-.205,z],[-.32,-.205,z],[-.32,-.24,z]],'dose'+i,.007);}
 // A separate front status light communicates operation; all vessels retain identical finishes.
 const stockMaterials=cans.map((can,i)=>{
  const m=new T.MeshStandardMaterial({color:0x26352e,emissive:0x79bd96,emissiveIntensity:0,roughness:.4});
  box('stock-status-'+String.fromCharCode(65+i),[can.position.x,-.305,.325],[.064,.014,.008],m);
  return m;
 });
 // A local soft halo around D's indicator, not an emissive vessel.
 const haloCanvas=document.createElement('canvas');haloCanvas.width=128;haloCanvas.height=128;
 const haloCtx=haloCanvas.getContext('2d')!,gradient=haloCtx.createRadialGradient(64,64,4,64,64,64);
 gradient.addColorStop(0,'rgba(169,242,195,.95)');gradient.addColorStop(.28,'rgba(122,218,165,.5)');gradient.addColorStop(1,'rgba(93,181,132,0)');haloCtx.fillStyle=gradient;haloCtx.fillRect(0,0,128,128);
 const haloTexture=new T.CanvasTexture(haloCanvas);haloTexture.colorSpace=T.SRGBColorSpace;
 const haloMaterial=new T.SpriteMaterial({map:haloTexture,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
 const dHalo=new T.Sprite(haloMaterial);dHalo.name='stock-D-indicator-halo';dHalo.position.set(.63,-.305,.342);group.add(dHalo);
 pipe('cooler-in',[[-1.07,-.36,.35],[-1.07,-.40,.49]],'cool',.010);pipe('cooler-out',[[-.79,-.40,.49],[-.79,-.19,.49],[-.79,-.19,.32]],'cool',.010);
 pipe('oxygen-in',[[-.57,-.45,.35],[-.48,-.53,.50]],'oxygen',.010);pipe('oxygen-out',[[-.48,-.27,.50],[-.48,-.18,.50],[-.48,-.18,.32]],'oxygen',.010);
 cylinder('gas-inlet',[-.34,-.40,.50],.022,.09,steel,'x');
 pipe('gas-to-mixer',[[-.30,-.40,.50],[-.38,-.40,.50],[-.42,-.40,.50]],'oxygen',.006);
 const dispersed=new T.InstancedMesh(new T.SphereGeometry(.0018,ranking?10:6,ranking?6:4),ranking?bubbleMaterial:new T.MeshBasicMaterial({color:0xb9d7d1,transparent:true,opacity:.48}),120);dispersed.name='nanobubbles-magnified-in-liquid';group.add(dispersed);
 const solutes=ranking?new T.InstancedMesh(new T.SphereGeometry(.0021,8,6),new T.MeshBasicMaterial({color:0xd1ac70,transparent:true,opacity:.78,depthWrite:false}),48):null;
 const treatmentSolutes=ranking?new T.InstancedMesh(new T.SphereGeometry(.003,8,6),new T.MeshBasicMaterial({color:0xd1ac70,transparent:true,opacity:.85,depthWrite:false}),28):null;
 if(solutes){solutes.name='root-exudate-in-nutrient-liquid';group.add(solutes);}
 if(treatmentSolutes){treatmentSolutes.name='solute-treatment-in-existing-uv-loop';group.add(treatmentSolutes);}
 const dummy=new T.Object3D(),point=new T.Vector3();let returnLevel=0;
 // Preserve the original UV material used by update(); isolate only the ten
 // exact stock bodies/caps that otherwise share materials with tank fittings.
 if(ranking)applyRetainedMaterialPresets(group,retainedMaterialPresets);
 const staticDetails=new Map<string,T.Group>();
 function installStaticDetail(kind:'uvdetail'|'stockdetail',asset:T.Group){
  if(staticDetails.get(kind)===asset)return;
  const rootName=kind==='uvdetail'?'AeroSense_UVC_StaticDetail':'AeroSense_Stock_StaticDetail';
  if(!asset.getObjectByName(rootName))throw Error('Missing fluid detail root: '+rootName);
  const flanges=kind==='uvdetail'?group.children.filter(o=>o.name==='uv-flange'&&Math.abs(o.position.y+.10)<1e-6&&Math.abs(o.position.z-.12)<1e-6&&[.05,.75].some(x=>Math.abs(o.position.x-x)<1e-6)):[];
  if(kind==='uvdetail'&&flanges.length!==2)throw Error('Expected two original UV-C flanges');
  asset.position.set(0,0,0);asset.rotation.set(0,0,0);asset.scale.set(1,1,1);asset.name='cloud-'+kind;
  group.add(asset);flanges.forEach(o=>o.visible=false);asset.userData.replacedNodes=flanges.map(o=>({name:o.name,position:o.position.toArray()}));staticDetails.set(kind,asset);
 }
 let qa={uv:false,cooling:false,oxygen:false,dose:[] as number[],selectedStocks:[] as number[],stockGlow:[] as number[],waterTop:-.24,waterBottom:-.53,cutaway:false,flowLines:lines.map(l=>l.name)};
 function update(t:number,dt:number,state:TwinState,reduced:boolean){
  const seq=state.sequence,active=!!seq?.active,elapsed=seq?.elapsed||0;
  const cooling=state.event===18,oxy=!!state.oxygenated;
  const inspection=ranking&&state.event===19&&active,processTime=state.event===19&&seq?.event===19?elapsed:t;
  const dose=active&&state.event===13&&elapsed>=4&&elapsed<8?[0,1,2]:active&&state.event===21?[4]:[];
  const selectedStocks=state.event===15?[3]:stageStocks(state.stageLabel);
  stockMaterials.forEach((m,i)=>{
   const pulse=reduced?.8:.8+.25*Math.sin(elapsed*Math.PI);
   const selected=selectedStocks.includes(i),dosing=dose.includes(i);
   const standbyAge=elapsed-8;
   const standbyPulse=state.event===15&&i===3&&seq?.focus==='dose'&&!reduced&&standbyAge>=1&&standbyAge<7;
   const standbyLevel=standbyPulse?1.05+.85*Math.pow(Math.sin((standbyAge-1)*Math.PI/2),2):1.05;
   const target=dosing?1.35+pulse*.3:selected?standbyLevel:0;
   m.emissiveIntensity=reduced?target:T.MathUtils.lerp(m.emissiveIntensity,target,1-Math.exp(-Math.max(0,dt)/.12));
  });
  dHalo.visible=state.event===15&&seq?.focus==='dose';
  const haloAge=Math.max(0,elapsed-8),haloPhase=(haloAge%2)/2;
  const haloSize=reduced?.13:.10+.09*haloPhase;
  dHalo.scale.set(haloSize,haloSize*.6,1);haloMaterial.opacity=reduced?.45:.65*(1-haloPhase)+.15;
  const checking=active&&state.event===0;const circulating=checking?elapsed>=4:state.event!==1;
  const uv=circulating,cutaway=active&&['fluid','uv','cooling','oxygen','dose'].includes(seq!.focus);
  windowMat.emissiveIntensity=uv?1.4:0;core.visible=uv;
  (uvShell.material as T.MeshStandardMaterial).transparent=false;(uvShell.material as T.MeshStandardMaterial).opacity=1;(uvShell.material as T.MeshStandardMaterial).depthWrite=true;quartz.visible=false;uvMat.opacity=0;
  if(inspection){
   const shell=uvShell.material as T.MeshStandardMaterial;shell.transparent=true;shell.opacity=.12;shell.depthWrite=false;quartz.visible=true;uvMat.opacity=.6;
  }
  if(ranking){uvShell.castShadow=!inspection;uvShell.receiveShadow=!inspection;}
  if(solutes&&treatmentSolutes){
   solutes.visible=inspection;treatmentSolutes.visible=inspection;
   for(let i=0;i<48;i++){
    const u=(processTime*.1+i*.618)%1,a=i*2.399;
    dummy.position.set(-.72+Math.sin(a+u*.4)*.37,-.505+u*.24,Math.cos(i*1.618+u*.4)*.30);
    dummy.scale.setScalar(.65+(i%4)*.12);dummy.updateMatrix();solutes.setMatrixAt(i,dummy.matrix);
   }
   solutes.instanceMatrix.needsUpdate=true;
   for(let i=0;i<28;i++){
    const u=(processTime*.28+i/28)%1,fade=1-T.MathUtils.smoothstep(u,.22,.91);
    dummy.position.set(.08+u*.63,-.10+Math.sin(i*2.399)*.038,.12+Math.cos(i*2.399)*.038);
    dummy.scale.setScalar(fade*(.55+(i%3)*.18));dummy.updateMatrix();treatmentSolutes.setMatrixAt(i,dummy.matrix);
   }
   treatmentSolutes.instanceMatrix.needsUpdate=true;
  }
  const waveTime=reduced?0:t;const pos=surfaceGeo.getAttribute('position') as T.BufferAttribute;
  for(let i=0;i<pos.count;i++)pos.setY(i,Math.sin(pos.getX(i)*24+waveTime*1.4)*Math.cos(pos.getZ(i)*18-waveTime)*.002);pos.needsUpdate=true;
  returnLevel+=(Number(state.mist)-returnLevel)*(1-Math.exp(-dt/1.5));(tray.material as T.MeshStandardMaterial).opacity=.12+returnLevel*.35;
  const flowClock=reduced?0:inspection?processTime:t;
  for(const l of lines){const on=l.kind==='feed'?circulating:l.kind==='bypass'?circulating&&!state.mist:l.kind==='spray'?state.mist:l.kind==='return'?returnLevel>.08:l.kind==='cool'?cooling:l.kind==='oxygen'?oxy:dose.includes(Number(l.kind.slice(4)));l.markers.visible=on;
   for(let i=0;i<8;i++){l.curve.getPoint((flowClock*.19+i/8)%1,point);dummy.position.copy(point);dummy.scale.setScalar(1);dummy.updateMatrix();l.markers.setMatrixAt(i,dummy.matrix);}l.markers.instanceMatrix.needsUpdate=true;}
  bubbles.visible=oxy;for(let i=0;i<bubbleCount;i++){const age=(flowClock*.39+i*.618)%1,a=i*2.399+Math.sin(age*3+i)*.25,r=(.006+age*.034)*Math.sqrt((i%9+1)/9);dummy.position.set(-.48+Math.cos(a)*r,-.49+age*.18,.50+Math.sin(a)*r);dummy.scale.setScalar((ranking?.65:.45)+Math.sin(Math.PI*age)*(ranking?.55:.45));dummy.updateMatrix();bubbles.setMatrixAt(i,dummy.matrix);}bubbles.instanceMatrix.needsUpdate=true;
  dispersed.visible=oxy;for(let i=0;i<120;i++){const a=i*2.399;dummy.position.set(-.72+Math.sin(a)*.39,-.515+((i*.017+flowClock*.007)%.24),Math.cos(i*1.618)*.31);dummy.scale.setScalar(.7+(i%5)*.1);dummy.updateMatrix();dispersed.setMatrixAt(i,dummy.matrix);}dispersed.instanceMatrix.needsUpdate=true;
  qa={...qa,uv,cooling,oxygen:oxy,dose,selectedStocks,stockGlow:stockMaterials.map(m=>m.emissiveIntensity),cutaway,...(ranking?{oxygenInspection:inspection,oxygenProcessTime:processTime,bubbleCount,soluteTreatment:inspection}: {})};
 }
 return {group,annotations,update,installStaticDetail,get qa(){return {...qa,staticDetails:Object.fromEntries([...staticDetails].map(([kind,asset])=>[kind,{position:asset.position.toArray(),scale:asset.scale.toArray(),replacedNodes:asset.userData.replacedNodes}])),retained:{uvShell:uvShell.parent===group&&uvShell.visible,uvShellOpacity:(uvShell.material as T.MeshStandardMaterial).opacity,quartz:quartz.parent===group,quartzVisible:quartz.visible,window:pane.parent===group,windowGlow:windowMat.emissiveIntensity,stocks:cans.map(o=>({name:o.name,position:o.position.toArray(),visible:o.visible,parentRetained:o.parent===group})),stockCaps:group.children.filter(o=>o.name==='stock-cap'&&o.visible).length,stockLetters:group.children.filter(o=>o.name.startsWith('stock-letter-')&&o.visible).length,stockIndicators:group.children.filter(o=>o.name.startsWith('stock-status-')&&o.visible).length,halo:dHalo.parent===group}};},anchors:{tank:new T.Vector3(-.72,-.26,.42),uv:new T.Vector3(.4,-.10,.25),cooling:new T.Vector3(-.93,-.40,.58),oxygen:new T.Vector3(-.48,-.40,.58)}};
}
