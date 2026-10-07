import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {NOZZLE_X,DECK_THICKNESS,DECK_TOP} from './state';
import clothNormal from './imported-assets/cloth_normal.png';
import deckNormal from './imported-assets/deck_normal.png';
import replacementManifest from './models/replacement_manifest.json';
import lampManifest from './models/optional_lamp_manifest.json';
import frameNormal from './imported-assets/frame_normal.png';

export function createHardware(){
 const group=new T.Group();group.name='B05-hardware';
 function normal(data:string,x:number,y:number){const t=new T.TextureLoader().load('data:image/png;base64,'+data);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(x,y);return t;}
 const polymer=new T.MeshStandardMaterial({color:0x303334,roughness:.83,normalMap:normal(deckNormal,5,2),normalScale:new T.Vector2(.12,.12)});
 const metal=new T.MeshStandardMaterial({color:0xaeb6bc,roughness:.28,metalness:.72});
 const darkMetal=new T.MeshStandardMaterial({color:0x323739,roughness:.61,metalness:.12,normalMap:normal(frameNormal,2,8),normalScale:new T.Vector2(.055,.055)});
 const housing=new T.MeshStandardMaterial({color:0x242829,roughness:.74,metalness:.05});
 const cloth=new T.MeshStandardMaterial({color:0x101010,roughness:1,side:T.DoubleSide,normalMap:normal(clothNormal,7,6),normalScale:new T.Vector2(.24,.24)});
 const grooveMat=new T.MeshStandardMaterial({color:0x191919,roughness:.62});
 const optic=new T.MeshStandardMaterial({color:0x243337,metalness:.45,roughness:.15});
 const labels:Record<string,T.Object3D>={};
 function box(name:string,size:number[],at:number[],mat:T.Material=polymer,r=.009){
  const m=new T.Mesh(new RoundedBoxGeometry(...size as [number,number,number],2,r),mat);m.name=name;m.position.fromArray(at);m.receiveShadow=true;m.castShadow=/^(frame-|planting-deck|deck-front-edge|corner-plate|curtain-clamp|lamp-housing)/.test(name);group.add(m);return m;
 }
 function rod(name:string,a:T.Vector3,b:T.Vector3,r:number,mat:T.Material=metal){
  const m=new T.Mesh(new T.CylinderGeometry(r,r,a.distanceTo(b),12),mat);m.name=name;m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());group.add(m);return m;
 }
 const V=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
 for(const x of [-1.25,1.25])for(const z of [-.34,.34]){
  box('frame-upright',[.036,2.51,.036],[x,1.345,z],darkMetal,.005);
  box('frame-foot',[.11,.065,.11],[x,.075,z],polymer);
 }
 for(const y of [.14,1.66,2.55])for(const z of [-.34,.34])box('frame-crossmember',[2.54,.035,.035],[0,y,z],darkMetal,.004);
 // Recesses, corner plates and fasteners belong to the frame, not a drawn outline.
 for(const x of [-1.25,1.25]){
  box('extrusion-front-channel',[.007,2.42,.002],[x,1.345,.359],grooveMat,.001);
  for(const y of [.19,1.56,2.51]){
   box('corner-plate',[.082,.082,.008],[x*.986,y,.367],darkMetal,.003);
   for(const dy of [-.023,.023]){
    const screw=new T.Mesh(new T.CylinderGeometry(.006,.006,.005,12),metal);screw.rotation.x=Math.PI/2;screw.position.set(x*.986,y+dy,.374);group.add(screw);
    box('screw-slot',[.006,.0015,.001],[x*.986,y+dy,.378],grooveMat,.0003);
   }
  }
 }
 box('planting-deck',[2.52,DECK_THICKNESS,.74],[0,DECK_TOP-DECK_THICKNESS/2,0],polymer,.006);
 box('deck-front-edge',[2.53,.034,.018],[0,DECK_TOP-.016,.37],polymer,.005);
 box('deck-sealing-lip',[2.47,.006,.008],[0,DECK_TOP-.002,.383],grooveMat,.002);
 box('return-tray',[2.50,.04,.70],[0,.10,0],polymer);
 for(const z of [-.34,.34])box('tray-lip',[2.50,.055,.025],[0,.145,z],darkMetal);
 // Fitted, taut side curtains stop exactly at the planting deck.
 for(const x of [-1.245,1.245]){
  box('fitted-side-curtain',[.009,1.44,.64],[x,.86,0],cloth,.003);
  for(const y of [.19,1.52])box('curtain-clamp',[.026,.04,.67],[x,y,0],darkMetal,.003);
 }
 // Cutaway view omits the rear face; real fitted side blackout curtains remain.
 // The front is shown open for inspection; the side panels are not hanging drapes.
 for(const x of [-.72,0,.72]){
  const collar=new T.Mesh(new T.TorusGeometry(.044,.011,8,32),polymer);collar.rotation.x=Math.PI/2;collar.position.set(x,1.713,0);group.add(collar);
 }
 rod('spray-manifold',V(-1.13,.18,0),V(1.13,.18,0),.017,darkMetal);
 // Pressure branch is attached to the existing manifold; placement is a display layout.
 rod('pressure-branch',V(-.98,.18,0),V(-.98,.39,.18),.014,metal);
 const gauge=new T.Group();gauge.name='manifold-pressure-gauge';gauge.position.set(-.98,.43,.18);group.add(gauge);labels.pressure=gauge;
 const rim=new T.Mesh(new T.CylinderGeometry(.072,.072,.032,32),metal);rim.rotation.x=Math.PI/2;gauge.add(rim);
 const dial=new T.Mesh(new T.CircleGeometry(.062,32),new T.MeshStandardMaterial({color:0xd0d5cf,roughness:.82}));dial.position.z=.018;gauge.add(dial);
 for(let i=0;i<=8;i++){const angle=(-.75+i*1.5/8)*Math.PI;const tick=new T.Mesh(new T.BoxGeometry(.002,.010,.002),housing);tick.position.set(Math.sin(angle)*.049,Math.cos(angle)*.049,.020);tick.rotation.z=-angle;gauge.add(tick);}
 const pressureNeedle=new T.Group();pressureNeedle.position.z=.023;gauge.add(pressureNeedle);
 const pointer=new T.Mesh(new T.BoxGeometry(.003,.043,.002),new T.MeshBasicMaterial({color:0x334f45}));pointer.position.y=.018;pressureNeedle.add(pointer);
 NOZZLE_X.forEach((x,i)=>{
  const tip=new T.Mesh(new T.CylinderGeometry(.012,.019,.026,12),metal);tip.position.set(x,.205,0);tip.name='upward-nozzle-'+(i+1);group.add(tip);
  const aperture=new T.Mesh(new T.CylinderGeometry(.005,.005,.002,12),polymer);aperture.position.set(x,.219,0);group.add(aperture);
 });
 // Return-line probe physically seated in a short flow cell, not floating in the root volume.
 rod('return-line',V(.96,.12,.26),V(1.20,.12,.26),.018,darkMetal);
 rod('probe-cell',V(1.16,.12,.26),V(1.16,.30,.26),.035,metal);
  labels.fluid=box('root-fluid-probe',[.10,.11,.075],[1.16,.33,.26],housing);
 // Camera housings use beveled bodies, recessed optics and connected supports.
 function sensor(name:string,at:T.Vector3,target:T.Vector3,wide=false){
  const assembly=new T.Group();assembly.name=name;assembly.position.copy(at);assembly.lookAt(target);group.add(assembly);
  const body=new T.Mesh(new RoundedBoxGeometry(wide?.15:.095,.075,.095,2,.008),housing);body.castShadow=true;body.receiveShadow=true;assembly.add(body);
  const ring=new T.Mesh(new T.CylinderGeometry(.029,.031,.036,24),metal);ring.rotation.x=Math.PI/2;ring.position.z=.061;assembly.add(ring);
  const lens=new T.Mesh(new T.CylinderGeometry(.022,.022,.004,24),optic);lens.rotation.x=Math.PI/2;lens.position.z=.080;assembly.add(lens);
  const led=new T.Mesh(new T.SphereGeometry(.003,8,6),new T.MeshBasicMaterial({color:0x73998a}));led.position.set(.038,.019,.049);assembly.add(led);
  return assembly;
 }
 rod('canopy-camera-boom',V(0,2.55,-.34),V(0,2.65,.86),.014,darkMetal);
 labels.spectrum=sensor('canopy-spectrum-camera',V(0,2.61,.86),V(0,2.0,0),true);
 for(const side of [-1,1]){
  rod('root-camera-support',V(side*1.25,1.04,.34),V(side*1.16,1.04,.46),.012,darkMetal);
  labels[side===-1?'root':'root-right']=sensor('root-image-camera',V(side*1.16,1.04,.46),V(0,.94,0));
 }
 const irBase=V(1.25,2.17,.34),irElbow=V(1.11,2.28,.37),irTip=V(.98,2.23,.40);
 rod('ir-arm-a',irBase,irElbow,.012,darkMetal);rod('ir-arm-b',irElbow,irTip,.010,darkMetal);
 [irBase,irElbow].forEach(p=>{const joint=new T.Mesh(new T.SphereGeometry(.022,12,8),metal);joint.position.copy(p);group.add(joint);});
 labels.leaf=sensor('leaf-temperature-sensor',irTip,V(.75,2.02,0));
 labels.environment=box('environment-probe',[.065,.09,.05],[-1.22,2.16,.35],polymer);
 for(let i=0;i<4;i++)box('environment-vent',[.038,.002,.003],[-1.22,2.13+i*.015,.378],metal,.001);
 box('lamp-housing',[2.24,.035,.30],[0,2.40,0],darkMetal,.008);
 for(const z of [-.065,-.032,0,.032,.065])box('lamp-cooling-fin',[2.17,.016,.006],[0,2.432,z],darkMetal,.001);
 for(const x of [-1.02,1.02])rod('lamp-hanger',V(x,2.55,0),V(x,2.433,0),.006,metal);
 const ledMats=[new T.MeshStandardMaterial({color:0x982c32,emissive:0xff2639,emissiveIntensity:0}),new T.MeshStandardMaterial({color:0x304d94,emissive:0x365dff,emissiveIntensity:0}),new T.MeshStandardMaterial({color:0x391b24,emissive:0x66101d,emissiveIntensity:0}),new T.MeshStandardMaterial({color:0xd8dedf,emissive:0xf4f7ff,emissiveIntensity:0})];
 const dummy=new T.Object3D();
 // UVA's faint visible LED proxy is not a representation of UV irradiance.
 ledMats.push(new T.MeshStandardMaterial({color:0x272331,emissive:0x76628d,emissiveIntensity:0}));
 ledMats.forEach((mat,row)=>{const instances=new T.InstancedMesh(new T.BoxGeometry(.030,.009,.034),mat,55);instances.name=['red-channel','blue-channel','far-red-channel','white-channel','uva-channel'][row];for(let i=0;i<55;i++){dummy.position.set(-1.06+i*.0393,2.374,[1,-1,2,0,-2][row]*.055);dummy.updateMatrix();instances.setMatrixAt(i,dummy.matrix);}group.add(instances);});
 box('lamp-front-rim',[2.16,.006,.006],[0,2.382,.147],darkMetal,.002);
 // Presentation-only 25-degree tilt: expose separated rows toward +Z.
 // Keep plant illumination aimed at the canopy, independent of this display angle.
 const lampAssembly=new T.Group();lampAssembly.name='lamp-display-assembly';lampAssembly.position.set(0,2.40,0);group.add(lampAssembly);
 const lampParts=group.children.filter(o=>['lamp-housing','lamp-cooling-fin','red-channel','blue-channel','far-red-channel','white-channel','uva-channel','lamp-front-rim'].includes(o.name));
 group.updateMatrixWorld(true);lampParts.forEach(o=>lampAssembly.attach(o));
 lampAssembly.rotation.x=-25*Math.PI/180;lampAssembly.updateMatrixWorld(true);
 group.children.filter(o=>o.name==='lamp-hanger').forEach(o=>{group.remove(o);(o as T.Mesh).geometry.dispose();});
 for(const x of [-1.02,1.02])rod('lamp-hanger',V(x,2.55,0),lampAssembly.localToWorld(V(x,.033,0)),.006,metal);
 const lamps=[new T.PointLight(0xff3449,0,2.5,2),new T.PointLight(0x406aff,0,2.5,2),new T.PointLight(0xff3449,0,2.5,2)];
 lamps.forEach((l,i)=>{l.position.set((i-1)*.70,2.29,.16);l.layers.set(1);group.add(l);});
 let cabinet:T.Group|null=null,lamp:T.Group|null=null;
 const originalDeck=group.getObjectByName('planting-deck')!,originalScrews=group.children.filter((o,i)=>[16,18,21,23,26,28,32,34,37,39,42,44].includes(i));
 function installStatic(asset:T.Group){
  if(cabinet===asset)return;
  const matches=replacementManifest.exactSourcePathsToReplace.map(path=>{const match=path.match(/\/([^/]+)\[(\d+)\]$/)!;const o=group.children[Number(match[2])];if(!o||o.name!==match[1])throw Error('Cabinet replacement mismatch: '+path);return o;});
  if(asset.getObjectByName(replacementManifest.root)==null)throw Error('Cabinet root missing');
  asset.name='cloud-b05-static';group.add(asset);matches.forEach(o=>o.visible=false);asset.userData.replacedNodes=matches.map(o=>o.name);cabinet=asset;
 }
 function installLamp(asset:T.Group){
  if(lamp===asset)return;
  const matches:T.Object3D[]=[];group.traverse(o=>{if(lampManifest.replaceOnly.includes(o.name))matches.push(o);});
  if(matches.length!==9||!asset.getObjectByName('Lamp_Housing_Tilted'))throw Error('Lamp replacement mismatch');
  // Its imported pose already contains the original location and tilt. Attach
  // only to the unit hardware parent, preserving all five LED control references.
  asset.name='cloud-b05-lamp';group.add(asset);matches.forEach(o=>o.visible=false);asset.userData.replacedNodes=matches.map(o=>o.name);lamp=asset;
 }
 return {group,labels,ledMats,lamps,pressureNeedle,installStatic,installLamp,get qa(){return {cabinet:cabinet?{replacedNodes:cabinet.userData.replacedNodes,position:cabinet.position.toArray(),rotation:cabinet.rotation.toArray().slice(0,3),scale:cabinet.scale.toArray()}:null,lamp:lamp?{replacedNodes:lamp.userData.replacedNodes,pose:lamp.getObjectByName('Lamp_Housing_Tilted')?.position.toArray(),tilt:lamp.getObjectByName('Lamp_Housing_Tilted')?.rotation.x}:null,retained:{deck:group.getObjectByName('planting-deck')===originalDeck,deckCenter:originalDeck.position.toArray(),screwHeads:originalScrews.filter(o=>o.parent===group&&o.visible).length,nozzles:group.children.filter(o=>o.name.startsWith('upward-nozzle-')&&o.visible).length,ledChannels:group.getObjectByName('lamp-display-assembly')?.children.filter(o=>o.name.endsWith('-channel')&&o.visible).length,labels:Object.fromEntries(Object.entries(labels).map(([k,v])=>[k,v.visible])),pressureNeedle:pressureNeedle.visible},ledIntensities:ledMats.map(m=>m.emissiveIntensity),pressureAngle:pressureNeedle.rotation.z};}};

}
