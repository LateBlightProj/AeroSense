import * as T from 'three';
import {specimenField,featureRGB} from './sort-field';
import type {Specimen} from './cloud-models';
import {finishRearLiner,knifeVisibility,visibleBounds} from './postharvest-view';
import postprocessMapping from './models/postprocess_mapping.json';
// Offline scenario: two representative accepted tubers and one rejected object.
export function treatmentTravel(t:number){return Math.min(2.35,Math.max(0,t-18)*5/9*.235) * (t<27?1:0) + (t>=27?Math.min(2.35,(5+Math.max(0,t-27)*6/((window as any).__AEROSENSE_RANKING_MODE__?8:9))*.235):0);}
export function treatmentState(t:number,index:number){
 const rejected=index===2,offset=rejected?0:treatmentTravel(t);
 const x=(index===1?1.12:.82)+offset;
 return {offset,misting:!rejected&&t>=18&&t<27,drying:!rejected&&t>=27&&t<((window as any).__AEROSENSE_RANKING_MODE__?35:36),finished:!rejected&&x>2.98};
}
export function sortingState(t:number,index:number){const age=Math.max(0,t-index*4),scan=age>=3.54&&age<4.46,rejected=index===2,end=index===1?1.12:.82;return {age,scan,rejected,x:age<5?-1.05+Math.min(age,5)*.21:age<6.3?(age-5)*.31:.403+(end-.403)*Math.min(1,(age-6.3)/1.7)+treatmentState(t,index).offset,z:age<=6.3?0:(rejected?1:-1)*Math.min(.52,(age-6.3)/1.7*.52),decided:age>=5,arrived:age>=8};}
export function createPostharvest(){
 const group=new T.Group();group.position.set(2.43,.29,.28);
 let scanner:T.Group|null=null;
 const modules=new Map<string,T.Group>();
 let dryerFan:T.Object3D|null=null;
 function installScanner(asset:T.Group){
  if(scanner===asset)return;
  const names=['dark-chamber-back','dark-chamber-roof','inspection-cutaway-panel','light-trap-curtain'];
  const replaced:T.Object3D[]=[];
  for(const o of group.children){
   const p=o.position;
   const oldPost=o instanceof T.Mesh&&o.name===''&&Math.abs(p.y-.13)<1e-6&&[-.66,.24].some(x=>Math.abs(p.x-x)<1e-6)&&[-.29,.29].some(z=>Math.abs(p.z-z)<1e-6);
   if(names.includes(o.name)||oldPost){o.visible=false;replaced.push(o);}
  }
  scanner=asset;asset.name='cloud-spectral-scanner';asset.position.set(-.21,.13,0);group.add(asset);
  const cover=asset.getObjectByName('Cover_Detachable');if(cover)cover.visible=false;
  asset.userData.replacedNodes=replaced.length;
 }
 function installPostprocess(name:'mist'|'dryer',asset:T.Group){
  if(modules.get(name)===asset)return;
  const spec=postprocessMapping.modules[name],replaced:T.Object3D[]=[];
  treatment.traverse(o=>{if(spec.hide_all_legacy_matches.includes(o.name))replaced.push(o);});
  // Validate all names before replacing anything so a malformed asset keeps the
  // previous equipment visible. Dynamic fog, liquid and transport objects remain.
  for(const key of spec.hide_all_legacy_matches)if(!replaced.some(o=>o.name===key))throw Error('Missing postprocess replacement: '+key);
  if(asset.getObjectByName(spec.root_node)==null)throw Error('Missing postprocess root: '+name);
  asset.position.fromArray(spec.position_in_postharvest);asset.name='cloud-'+name;group.add(asset);
  const door=asset.getObjectByName(spec.door.node);if(door)door.rotation.y=spec.door.default_angle;
  finishRearLiner(asset,name);replaced.forEach(o=>o.visible=false);asset.userData.replacedNodes=replaced.map(o=>o.name);modules.set(name,asset);
  if(name==='dryer')dryerFan=asset.getObjectByName(postprocessMapping.modules.dryer.fan.node)||null;
 }
 const steel=new T.MeshStandardMaterial({color:0x74817e,metalness:.7,roughness:.4});
 function box(w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);group.add(m);return m;}
 box(2.45,.08,.55,0,-.18,0,new T.MeshStandardMaterial({color:0x252f30,roughness:.8}));
 for(const x of [-1.08,1.08])for(const z of [-.21,.21])box(.035,.40,.035,x,-.40,z,steel);
 const dark=new T.MeshStandardMaterial({color:0x101416,roughness:.96});
 box(.88,.64,.035,-.21,.13,-.32,dark).name='dark-chamber-back';
 box(.88,.045,.68,-.21,.46,0,dark).name='dark-chamber-roof';
 box(.88,.60,.022,-.21,.13,.32,new T.MeshStandardMaterial({color:0x20282b,transparent:true,opacity:.12,depthWrite:false})).name='inspection-cutaway-panel';
 for(const x of [-.66,.24])for(const z of [-.29,.29])box(.03,.64,.03,x,.13,z,steel);
 for(const x of [-.63,.21])for(let i=0;i<7;i++)box(.015,.13,.075,x,.34,-.26+i*.085,dark).name='light-trap-curtain';
 box(.14,.12,.14,-.21,.31,0,steel).name='line-scan-camera';
 const lens=new T.Mesh(new T.CylinderGeometry(.035,.045,.075,20),dark);lens.position.set(-.21,.22,0);group.add(lens);
 box(.055,.12,.055,-.21,.39,0,steel).name='camera-roof-mount';
 for(const z of [-.27,.27]){box(.93,.025,.025,-.21,.36,z,steel).name='lamp-frame-crossbar';for(const x of [-.39,-.03])box(.022,.125,.022,x,.285,z,steel).name='lamp-mount-bracket';}
 const lamp=new T.MeshBasicMaterial({color:0xffe7bc});
 for(const x of [-.39,-.03]){
  box(.075,.045,.56,x,.22,0,steel).name='line-light-housing';
  box(.055,.008,.48,x,.194,0,lamp).name='continuous-line-light';
  const light=new T.PointLight(0xffe6ba,.35,.6,2);light.position.set(x,.16,0);group.add(light);
 }
 const beam=box(.012,.004,.48,-.21,-.126,0,new T.MeshBasicMaterial({color:0xffe7bc}));beam.name='fixed-acquisition-line';
 const outletParts:T.Mesh[]=[];
 for(const [z,color] of [[-.52,0x56a578],[.52,0xd35954]]){outletParts.push(box(.60,.07,.43,.92,-.172,z,new T.MeshStandardMaterial({color,roughness:.55})),box(.60,.16,.025,.92,-.12,z+.22,steel));}
 const gate=box(.035,.10,.035,.40,-.06,0,steel);gate.name='diverter-actuator';
 const transferRollers=Array.from({length:9},(_,i)=>{const m=new T.Mesh(new T.CylinderGeometry(.012,.012,.64,12),steel);m.rotation.z=Math.PI/2;m.position.set(.28+i*.072,-.144,0);group.add(m);return m;});
 const beltMarks=Array.from({length:22},(_,i)=>box(.006,.002,.50,-1.18+i*.11,-.138,0,new T.MeshStandardMaterial({color:0x414b4b,roughness:.9})));
 // Wide transfer deck supports the sideways routing after the tunnel.
 box(.68,.045,1.25,.59,-.167,0,new T.MeshStandardMaterial({color:0x293536,roughness:.85}));
 // Qualified lane continues through two separate treatment enclosures.
 const treatment=new T.Group();treatment.name='post-scan-treatment-line';group.add(treatment);
 function part(w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material,name:string){const m=box(w,h,d,x,y,z,mat);group.remove(m);treatment.add(m);m.name=name;return m;}
 // Butt the treatment belt against the qualified outlet. Their former 0.07 m
 // overlap put green and dark top faces on the same depth plane.
 const treatmentStart=1.22,treatmentEnd=3.65;
 part(treatmentEnd-treatmentStart,.07,.43,(treatmentStart+treatmentEnd)/2,-.172,-.52,dark,'treatment-conveyor');
 for(const x of [1.4,2.4,3.4])for(const z of [-.7,-.34]){part(.045,.43,.045,x,-.42,z,steel,'treatment-leg');part(.10,.018,.10,x,-.644,z,steel,'treatment-foot');}
 for(const z of [-.7,-.34]){part(2.10,.045,.045,2.4,-.23,z,steel,'treatment-top-rail');part(2.10,.035,.035,2.4,-.49,z,steel,'treatment-bottom-rail');}
 for(const x of [1.4,2.4,3.4])part(.045,.04,.40,x,-.49,-.52,steel,'treatment-cross-brace');
 for(const z of [-.76,-.28])part(1.6,.05,.05,2.11,-.155,z,steel,'chamber-support-rail');
 for(const x of [1.4,2.4])part(.05,.09,.54,x,-.22,-.52,steel,'chamber-support-crossbar');
 part(.055,.055,.18,1.69,-.34,-.74,steel,'reservoir-duct-connector');
 const treatmentMarks=Array.from({length:25},(_,i)=>part(.009,.002,.40,1.18+i*.10,-.135,-.52,steel,'treatment-belt-mark'));
 const glass=new T.MeshStandardMaterial({color:0xa4c9c9,transparent:true,opacity:.10,depthWrite:false,roughness:.3});
 for(const [x,name] of [[1.69,'ultrasonic-mist'],[2.53,'cold-air']] as const){
  part(.73,.045,.51,x,.35,-.52,steel,name+'-roof');
  part(.73,.45,.016,x,.11,-.77,dark,name+'-back');
  part(.73,.45,.012,x,.11,-.27,glass,name+'-window');
  for(const side of [-1,1])for(const z of [-.76,-.28])part(.025,.47,.025,x+side*.36,.105,z,steel,name+'-frame');
 }
 // Ultrasonic transducer reservoir feeds a duct and distribution slot, without high-pressure spray jets.
 part(.30,.23,.29,1.69,-.37,-.52,glass,'ultrasonic-reservoir');part(.34,.025,.33,1.69,-.495,-.52,steel,'reservoir-tray');
 const transducer=new T.Mesh(new T.CylinderGeometry(.065,.065,.012,20),steel);transducer.position.set(1.69,-.474,-.52);treatment.add(transducer);transducer.name='ultrasonic-transducer';part(.27,.014,.26,1.69,-.33,-.52,new T.MeshStandardMaterial({color:0x74aeb6,transparent:true,opacity:.45,roughness:.15}),'reservoir-liquid-surface');
 part(.055,.70,.055,1.69,-.03,-.82,steel,'mist-supply-duct');part(.055,.055,.31,1.69,.29,-.67,steel,'mist-top-duct');
 part(.45,.035,.16,1.69,.255,-.52,steel,'mist-distribution-slot');
 // Layered advected density, not screen-sized point sprites.
 const fog=new T.Group();fog.name='ultrasonic-fine-mist';treatment.add(fog);
 const fogUniforms={time:{value:0},strength:{value:0}};
 const fogMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:fogUniforms,
 vertexShader:'varying vec2 uvFog;void main(){uvFog=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`varying vec2 uvFog;uniform float time;uniform float strength;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 void main(){vec2 p=uvFog;float down=1.-p.y;
 float width=mix(.26,.49,smoothstep(0.,.9,down));
 float sideways=abs(p.x-.5+.025*sin(down*8.-time*.65));
 float edge=1.-smoothstep(width*.45,width,sideways);
 float n=.58*noise(p*vec2(4.,6.)+vec2(time*.14,time*.45))+.28*noise(p*vec2(9.,12.)+vec2(-time*.1,time*.67))+.14*noise(p*22.+vec2(0,time));
 float envelope=edge*smoothstep(0.,.10,p.y)*(1.-smoothstep(.88,1.,p.y));
 gl_FragColor=vec4(.82,.88,.86,envelope*(.045+.14*n)*strength);}`});
 for(let i=0;i<5;i++){const sheet=new T.Mesh(new T.PlaneGeometry(.56,.37),fogMaterial);sheet.position.set(1.69,.055,-.68+i*.075);fog.add(sheet);}
 // Supported fan, filter and air knife. No heating elements or heat glow.
 part(.35,.25,.22,2.53,.49,-.52,steel,'cold-air-fan-housing');part(.28,.18,.018,2.53,.49,-.64,dark,'cold-air-filter');
 part(.13,.13,.13,2.53,.315,-.52,steel,'cold-air-duct');part(.48,.045,.12,2.53,.235,-.52,steel,'cold-air-knife');
 const fan=new T.Group();fan.position.set(2.53,.49,-.395);treatment.add(fan);fan.name='cold-air-impeller';
 const fanRing=new T.Mesh(new T.TorusGeometry(.105,.008,8,32),steel);fanRing.position.copy(fan.position);treatment.add(fanRing);fanRing.name='cold-air-fan-guard';
 for(let i=0;i<3;i++){const angle=i*Math.PI*2/3,blade=new T.Mesh(new T.BoxGeometry(.042,.09,.014),new T.MeshStandardMaterial({color:0xb0c7ca,metalness:.4,roughness:.4}));blade.position.set(Math.sin(angle)*.048,Math.cos(angle)*.048,0);blade.rotation.z=-angle;fan.add(blade);}
 const skinData=new Uint8Array(256*128*4);
 for(let y=0;y<128;y++)for(let x=0;x<256;x++){const u=x/256*Math.PI*2,v=y/128*Math.PI,grain=(Math.sin(x*12.9898+y*78.233)*43758.5453)%1,mottle=8*Math.sin(u*5+Math.sin(v*3))+5*Math.cos(u*11-v*7),spot=grain>.975?22:0,k=(y*256+x)*4;skinData[k]=181+mottle-spot;skinData[k+1]=146+mottle-spot;skinData[k+2]=94+mottle-spot;skinData[k+3]=255;}
 const skin=new T.DataTexture(skinData,256,128,T.RGBAFormat);skin.colorSpace=T.SRGBColorSpace;skin.wrapS=T.RepeatWrapping;skin.magFilter=T.LinearFilter;skin.minFilter=T.LinearMipmapLinearFilter;skin.generateMipmaps=true;skin.needsUpdate=true;
 const tubers=Array.from({length:3},(_,i)=>{
  const geometry=new T.SphereGeometry(1,64,40),pos=geometry.attributes.position;
  const eyes=Array.from({length:7},(_,k)=>new T.Vector3(Math.sin(k*2.4+i),Math.cos(k*1.7),Math.sin(k*1.3+.4)).normalize());
  for(let j=0;j<pos.count;j++){const v=new T.Vector3().fromBufferAttribute(pos,j),eye=eyes.reduce((a,e)=>a+Math.exp(-v.distanceToSquared(e)/.0025)*.018,0),shape=1+.025*Math.sin(v.x*3+v.y*2+i)-eye;v.multiplyScalar(shape);const taper=1-.10*v.x;v.x*=.091+i*.002;v.y*=.051*taper;v.z*=.059*taper;pos.setXYZ(j,v.x,v.y,v.z);}
  geometry.computeVertexNormals();geometry.computeBoundingBox();
  const m=new T.Mesh(geometry,new T.MeshStandardMaterial({map:skin,roughness:.9}));m.name='transport-tuber-'+i;m.userData.bottom=-geometry.boundingBox!.min.y;group.add(m);return m;
 });
 // Surface-attached droplets: drying is shown on the specimen, not as visible air.
 const dropletMaterial=new T.MeshPhysicalMaterial({color:0xcce8e7,roughness:.09,metalness:.08,transparent:true,opacity:.72,clearcoat:1,clearcoatRoughness:.03});
 const droplets=tubers.slice(0,2).map((tuber,i)=>{
  const mesh=new T.InstancedMesh(new T.SphereGeometry(1,8,6),dropletMaterial,36);mesh.name='surface-water-'+i;mesh.frustumCulled=false;group.add(mesh);return mesh;
 });
 function makeDropletAnchors(){return tubers.slice(0,2).map(m=>{const p=m.geometry.attributes.position,n=m.geometry.attributes.normal,valid=[];for(let i=0;i<p.count;i++)if(p.getY(i)>.012&&p.getY(i)<.045&&p.getZ(i)>-.015)valid.push(i);return Array.from({length:36},(_,i)=>{const j=valid[Math.floor(((i*.6180339)%1)*valid.length)];return new T.Vector3().fromBufferAttribute(p,j).addScaledVector(new T.Vector3().fromBufferAttribute(n,j),.001);});});}
 let dropletAnchors=makeDropletAnchors();
 const dropletTransform=new T.Object3D();
 const W=480,H=288;
 // The optical field is frozen once; only the silhouette follows a new specimen mesh.
 const fields=tubers.map((m,object)=>{
  const raster=document.createElement('canvas');raster.width=W;raster.height=H;const context=raster.getContext('2d')!;
  const pixels=context.createImageData(W,H),mask=new Uint8Array(W*H);let anomalyRight=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const field=specimenField(object,x/W,y/H),rgb=featureRGB(field.texture,field.anomaly),k=(y*W+x)*4;
   pixels.data[k]=rgb[0];pixels.data[k+1]=rgb[1];pixels.data[k+2]=rgb[2];pixels.data[k+3]=255;if(field.anomaly>.35){mask[y*W+x]=1;anomalyRight=Math.max(anomalyRight,x);}
  }
  context.putImageData(pixels,0,0);
  const outline=document.createElement('canvas');outline.width=W;outline.height=H;const oc=outline.getContext('2d')!,overlay=oc.createImageData(W,H);
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
   const k=y*W+x;if(!mask[k])continue;const boundary=!mask[k-1]||!mask[k+1]||!mask[k-W]||!mask[k+W];
   overlay.data[k*4]=255;overlay.data[k*4+1]=boundary?209:75;overlay.data[k*4+2]=boundary?131:41;overlay.data[k*4+3]=boundary?255:85;
  }oc.putImageData(overlay,0,0);return {raster,outline,anomalyRight};
 });
 function makeImages(){return tubers.map((m,object)=>{
  const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d')!,g=m.geometry,bounds=g.boundingBox!;
  const vertex=g.attributes.position,points:Array<[number,number]>=[];
  for(let j=0;j<vertex.count;j++)points.push([(vertex.getX(j)-bounds.min.x)/(bounds.max.x-bounds.min.x)*429+24,(vertex.getZ(j)-bounds.min.z)/(bounds.max.z-bounds.min.z)*234+27]);
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a:number[],b:number[],c:number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const lower:Array<[number,number]>=[],upper:Array<[number,number]>=[];
  for(const pt of points){while(lower.length>1&&cross(lower.at(-2)!,lower.at(-1)!,pt)<=0)lower.pop();lower.push(pt);}
  for(const pt of [...points].reverse()){while(upper.length>1&&cross(upper.at(-2)!,upper.at(-1)!,pt)<=0)upper.pop();upper.push(pt);}
  const hull=lower.slice(0,-1).concat(upper.slice(0,-1));
  function clip(context:CanvasRenderingContext2D){context.beginPath();hull.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));context.closePath();context.clip();}
  ctx.save();clip(ctx);ctx.drawImage(fields[object].raster,0,0);ctx.restore();
  const finished=document.createElement('canvas');finished.width=W;finished.height=H;const fc=finished.getContext('2d')!;
  fc.drawImage(c,0,0);fc.save();clip(fc);fc.drawImage(fields[object].outline,0,0);fc.restore();
  return {base:c,finished,anomalyRight:fields[object].anomalyRight};
 });}
 let images=makeImages(),installedGeometry:T.BufferGeometry|null=null;
 function getScanBounds(mode:'scan'|'sort',seconds:number){
  group.updateWorldMatrix(true,true);const bounds=scanner?visibleBounds(scanner):new T.Box3(new T.Vector3(-.67,-.19,-.34).add(group.position),new T.Vector3(.25,.49,.34).add(group.position));
  if(mode==='sort'){outletParts.forEach(m=>bounds.union(visibleBounds(m)));bounds.union(visibleBounds(gate));}
  else{
   const specimen=tubers.map((_,i)=>({i,s:sortingState(seconds,i)})).find(v=>seconds>=v.i*4&&v.s.scan);
   if(specimen){const m=tubers[specimen.i],s=specimen.s,position=new T.Vector3(s.x,-.137+m.userData.bottom,s.z);bounds.union(m.geometry.boundingBox!.clone().translate(position).applyMatrix4(group.matrixWorld));}
  }
  return bounds;
 }
 function setSpecimenAsset(asset:Specimen){
  if(installedGeometry===asset.geometry)return;installedGeometry=asset.geometry;
  tubers.forEach((m,i)=>{
   const original=m.geometry.boundingBox!,oldSize=original.getSize(new T.Vector3()),center=original.getCenter(new T.Vector3());
   const shape=asset.geometry.clone(),size=shape.boundingBox!.getSize(new T.Vector3());
   shape.scale(oldSize.x/size.x,oldSize.y/size.y,oldSize.z/size.z);shape.translate(center.x,center.y,center.z);shape.computeBoundingBox();shape.computeBoundingSphere();
   m.geometry.dispose();m.geometry=shape;(m.material as T.Material).dispose();m.material=asset.material.clone();m.name='transport-tuber-'+i;m.userData.cloudAsset=asset.level;m.userData.bottom=-shape.boundingBox!.min.y;
  });dropletAnchors=makeDropletAnchors();images=makeImages();painted=new WeakMap<HTMLCanvasElement,string>();
 }

 let qa={object:0,row:0,anomalyVisible:false,complete:false,status:'采集中'};
 let painted=new WeakMap<HTMLCanvasElement,string>();
 function setText(n:Element,text:string){if(n.textContent!==text)n.textContent=text;}

 function update(event:number,seconds:number){group.visible=event===25;if(!group.visible)return;let scanning=-1;
  tubers.forEach((m,i)=>{const s=sortingState(seconds,i);m.visible=seconds>=i*4;m.position.set(s.x,-.137+m.userData.bottom,s.z);m.material.emissive.setHex(s.decided?(s.rejected?0x501510:0x142719):0);m.material.emissiveIntensity=.18;const wet=i===2||seconds<18||m.position.x<1.36?0:m.position.x<2.18?Math.min(1,(m.position.x-1.36)/.35):Math.max(0,1-(m.position.x-2.18)/.70);m.material.roughness=.9-.32*wet;const b=m.geometry.boundingBox!;if(m.visible&&m.position.x+b.max.x>=beam.position.x&&m.position.x+b.min.x<beam.position.x)scanning=i;});
  const stages=[treatmentState(seconds,0),treatmentState(seconds,1)];
  fog.visible=stages.some(s=>s.misting);fogUniforms.time.value=seconds;fogUniforms.strength.value=fog.visible?1:0;fan.rotation.z=Math.min(9,Math.max(0,seconds-27))*12;if(dryerFan)dryerFan.rotation.z=fan.rotation.z;
  droplets.forEach((mesh,index)=>{
   const m=tubers[index],x=m.position.x;
   const wet=seconds<18||x<1.36?0:x<2.18?Math.min(1,(x-1.36)/.30):Math.max(0,1-(x-2.18)/.70);
   mesh.visible=wet>.01;
   for(let i=0;i<36;i++){
    const anchor=dropletAnchors[index][i];
    const remaining=Math.max(0,Math.min(1,(wet-(i%6)*.085)*1.6));
    const size=(.0018+(i%4)*.00045)*remaining;
    dropletTransform.position.copy(m.position).add(anchor);
    dropletTransform.scale.set(size,size*.55,size);dropletTransform.updateMatrix();mesh.setMatrixAt(i,dropletTransform.matrix);
   }
   mesh.instanceMatrix.needsUpdate=true;
  });
  treatmentMarks.forEach((m,i)=>m.position.x=1.18+((i*.10+treatmentTravel(seconds))%2.5));
  const abnormal=sortingState(seconds,2);
  beltMarks.forEach((m,i)=>m.position.x=-1.18+((i*.11+seconds*.21)%2.42));
  beam.visible=true;gate.position.z=abnormal.age>6.3&&abnormal.age<8?abnormal.z-.09:-.24;transferRollers.forEach(m=>m.rotation.x=seconds*2);
  // Cached canvases also populate cards opened while the timeline is paused.
  let object=0;
  for(let i=1;i<tubers.length;i++){
   const start=(.84-tubers[i].geometry.boundingBox!.max.x)/.21+i*4;
   if(seconds>=start)object=i;
  }
  const age=seconds-object*4;
  const g=tubers[object].geometry,bounds=g.boundingBox!,scanStart=(.84-bounds.max.x)/.21,scanEnd=(.84-bounds.min.x)/.21;
  const row=Math.min(96,Math.max(0,Math.floor((age-scanStart)/(scanEnd-scanStart)*96)));
  const left=row===96?0:Math.floor(24+(1-row/96)*429);
  const anomalyVisible=object===2&&row>0&&left<=images[object].anomalyRight;
  const complete=row===96;
  const status=complete?(object===2?'光谱异常 → 不合格剔除':'采集完成 · 合格'):anomalyVisible?'异常区域已采集':row>0?'采集中':'等待采集';
  qa={object,row,anomalyVisible,complete,status};
  document.querySelectorAll('[data-sort-status]').forEach(n=>setText(n,status));
  document.querySelectorAll('[data-internal-note]').forEach(n=>setText(n,complete?'OBJ-0'+(537+object)+' · '+(object===2?'不合格剔除':'合格入库'):'光谱特征筛查'));
  document.querySelectorAll('[data-scan-values]').forEach(n=>setText(n,'OBJ-0'+(537+object)+' · '+row+' / 96 行'));
  document.querySelectorAll<HTMLCanvasElement>('[data-sort-falsecolor]').forEach(c=>{
   const baseOnly=c.hasAttribute?.('data-sort-base');const cacheKey=object+':'+row+':'+baseOnly;if(painted.get(c)===cacheKey)return;painted.set(c,cacheKey);
   const ctx=c.getContext('2d');if(!ctx)return;
   if(c.width!==W)c.width=W;if(c.height!==H)c.height=H;
   ctx.clearRect(0,0,W,H);ctx.fillStyle='#0b1012';ctx.fillRect(0,0,W,H);
   // Motion is +X: the max-X nose (right edge of the projection) is acquired first.
   // Match the 24..453 silhouette bounds, excluding the canvas padding from progress.

   const acquired=W-left;
   if(row>0)ctx.drawImage(baseOnly?images[object].base:images[object].finished,left,0,acquired,H,left,0,acquired,H);
  });


 }
 return {group,update,setSpecimenAsset,installScanner,installPostprocess,getScanBounds,getScannerBounds:()=>scanner?visibleBounds(scanner):getScanBounds('scan',0),getKnifeVisibility:(camera:T.Camera)=>knifeVisibility(group,camera),get qa(){return {...qa,postprocess:Object.fromEntries([...modules].map(([name,asset])=>{const spec=postprocessMapping.modules[name as 'mist'|'dryer'];asset.updateWorldMatrix(true,true);return [name,{position:asset.position.toArray(),rearLiner:asset.userData.rearLiner,replacedNodes:asset.userData.replacedNodes,doorAngle:asset.getObjectByName(spec.door.node)?.rotation.y,anchors:Object.fromEntries(Object.keys(spec.anchors).map(n=>{const node=asset.getObjectByName(n);return [n,node?group.worldToLocal(node.getWorldPosition(new T.Vector3())).toArray():null];}))}];})),dynamic:{fog: fog.visible,fogStrength:fogUniforms.strength.value,fogPlanes:fog.children.length,liquidVisible:treatment.getObjectByName('reservoir-liquid-surface')?.visible,fanAngle:fan.rotation.z,assetFanAngle:dryerFan?.rotation.z,water: droplets.map(mesh=>({visible:mesh.visible,count:mesh.visible?Array.from({length:mesh.count},(_,i)=>Math.hypot(mesh.instanceMatrix.array[i*16],mesh.instanceMatrix.array[i*16+1],mesh.instanceMatrix.array[i*16+2])).filter(s=>s>.00005).length:0})),specimens:tubers.map(m=>({visible:m.visible,position:m.position.toArray(),roughness:m.material.roughness}))},scanner:scanner?{position:scanner.position.toArray(),coverVisible:scanner.getObjectByName('Cover_Detachable')?.visible,replacedNodes:scanner.userData.replacedNodes}:null,asset:tubers[0].userData.cloudAsset||'legacy',specimenBounds:tubers.map(m=>({min:m.geometry.boundingBox!.min.toArray(),max:m.geometry.boundingBox!.max.toArray(),bottom:m.userData.bottom})),dropletAnchors:dropletAnchors.map(a=>a.length)};}};
}
