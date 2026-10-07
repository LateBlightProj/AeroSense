import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {finishEquipment,preserveEmbeddedEquipment,restoreCabinetGraphite} from './equipment-finish';
import {createBenchMotion,fitBenchView,benchEquipmentBounds} from './bench-view';
import {attachBenchAirflow} from './bench-airflow.mjs';
import {installBenchShadows} from './bench-shadow-fix.mjs';
import {enableEquipmentShadows} from './equipment-shadows';
import {installBenchLighting} from './equipment-lighting';
import {decodeGLBBase64} from './glb-bytes';
import cleanBench from './models/aerosense_clean_bench.glb';
import potatoHero from './models/aeroponic_potato.glb';
import potatoMedium from './models/aeroponic_potato_lod_medium.glb';
import potatoDistant from './models/aeroponic_potato_lod_distant.glb';
import spectralScanner from './models/aerosense_spectral_scanner.glb';
import mistModule from './models/mist_module.glb';
import dryerModule from './models/dryer_module.glb';
import cabinetStatic from './models/aerosense_cabinet_static.glb';
import cabinetLamp from './models/aerosense_cabinet_optional_lamp.glb';
import uvDetail from './models/aerosense_uvc_static_detail_dark_v1.glb';
import stockDetail from './models/aerosense_stock_static_detail_dark_v1.glb';

export type Specimen={geometry:T.BufferGeometry;material:T.MeshPhysicalMaterial;attachment:T.Vector3;level:string};

// Assets are embedded in the offline build. This module owns visuals only;
// the existing preparation clock, measurements and operation gates own state.
export function createCloudModels(renderer:T.WebGLRenderer){
 const benchScene=new T.Scene(),camera=new T.PerspectiveCamera(33.4,4/3,.02,50);
 const key=new T.DirectionalLight(0xf0f3f5,.90);key.position.set(-3,3.5,4);key.target.position.set(0,1.35,0);benchScene.add(key,key.target);
 const fill=new T.DirectionalLight(0xe3e6e7,.24);fill.position.set(3,.9,2);fill.target.position.set(0,1.05,0);benchScene.add(fill,fill.target);
 const ambient=new T.HemisphereLight(0xe9ebeb,0x25282b,.32);benchScene.add(ambient);
 let benchLighting:ReturnType<typeof installBenchLighting>|null=null;
 const qa={bench:'pending',potato:'pending',scanner:'pending',mist:'pending',dryer:'pending',cabinet:'pending',lamp:'pending',uvdetail:'pending',stockdetail:'pending',errors:[] as string[],benchBounds:[] as number[],heroTriangles:0,textureSizes:[] as number[][],levels:{} as Record<string,number>,benchVisible:false,airflow:false,benchCalls:0,benchTriangles:0,benchCamera:{position:[] as number[],zoom:1},benchInteractive:false,benchMotion:{automatic:false,progress:0,phase:'hold'},materialFinishes:{} as Record<string,ReturnType<typeof finishEquipment>>};
 let alive=true,bench:T.Group|null=null,benchAirflow:ReturnType<typeof attachBenchAirflow>|null=null;
 let benchShadows:ReturnType<typeof installBenchShadows>|null=null;
 let environment:T.WebGLRenderTarget|null=null;
 const uploadTarget=new T.WebGLRenderTarget(1,1),uploadMaterial=new T.MeshBasicMaterial({color:0x000000});
 const specimens=new Map<string,Specimen>();
 const industrial=new Map<string,T.Group>();
 const preferLite=(navigator.hardwareConcurrency||8)<=4||(Number((navigator as any).deviceMemory)||8)<=4||new URLSearchParams(location.search).has('lowPower');
 const workSurface=new T.Vector3(0,.905,.01),benchTarget=new T.Vector3(0,1.045,0);
 let lastCanvas:HTMLCanvasElement|null=null;
 let benchControls:OrbitControls|null=null,fitWidth=0,fitHeight=0,hintDismissed=false;
 const benchMotion=createBenchMotion(),reducedMotion=matchMedia('(prefers-reduced-motion:reduce)');
 const benchBox=new T.Box3();
 const textures=new Set<T.Texture>(),materials=new Set<T.Material>(),geometries=new Set<T.BufferGeometry>();
 const idle=()=>new Promise<void>(resolve=>{if('requestIdleCallback' in window)(window as any).requestIdleCallback(()=>resolve(),{timeout:1200});else setTimeout(resolve,0);});
 const parse=async(data:string)=>new GLTFLoader().parseAsync(decodeGLBBase64(data),'');
 function keep(root:T.Object3D){root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}}});}
 function uploadTextures(root:T.Object3D){
  const maps=new Set<T.Texture>();root.traverse(o=>{if(o instanceof T.Mesh)for(const material of Array.isArray(o.material)?o.material:[o.material])for(const value of Object.values(material))if(value instanceof T.Texture)maps.add(value);});
  maps.forEach(texture=>renderer.initTexture(texture));
 }
 function makeEnvironment(){
  if(environment)return;
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();
  environment=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();benchScene.environment=null;
 }
 async function prepare(onSpecimenReady:()=>void){
  await idle();if(!alive)return;
  try{
   const gltf=await parse(cleanBench);if(!alive)return;
   bench=gltf.scene;bench.name='cloud-clean-bench';qa.materialFinishes.bench=preserveEmbeddedEquipment(bench);benchScene.add(bench);keep(bench);
   if((window as any).__AEROSENSE_RANKING_MODE__)benchLighting=installBenchLighting(benchScene,key,fill,ambient,bench);
   benchAirflow=attachBenchAirflow(T,bench,gltf.animations);benchAirflow.setEnabled(false);
   const anchor=bench.getObjectByName('Anchor_Work_Surface');bench.updateMatrixWorld(true);if(anchor)anchor.getWorldPosition(workSurface);
   const bounds=benchEquipmentBounds(bench,benchBox),size=bounds.getSize(new T.Vector3());bounds.getCenter(benchTarget);
   qa.benchBounds=size.toArray();
   if((window as any).__AEROSENSE_RANKING_MODE__)benchShadows=installBenchShadows(T,{renderer,model:bench,key,quality:preferLite?'low':'standard'});
   await idle();if(!alive)return;uploadTextures(bench);await renderer.compileAsync(benchScene,camera);qa.bench='ready';
  }catch(e){qa.bench='fallback';qa.errors.push('clean-bench: '+String(e));}
  await idle();if(!alive)return;
  try{
   makeEnvironment();
   for(const [level,data] of (preferLite?[['distant',potatoDistant],['medium',potatoMedium]]:[['distant',potatoDistant],['medium',potatoMedium],['hero',potatoHero]])){
   await idle();if(!alive)return;
   const gltf=await parse(data);if(!alive)return;keep(gltf.scene);gltf.scene.updateMatrixWorld(true);
   let mesh:T.Mesh|null=null;gltf.scene.traverse(o=>{if(o instanceof T.Mesh&&!mesh)mesh=o;});
   if(!mesh)throw Error('Missing potato mesh');
   const source=mesh as T.Mesh,geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);geometry.computeBoundingBox();
   const bounds=geometry.boundingBox!,size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
   const factor=2/Math.max(size.x,size.y,size.z);
   geometry.translate(-center.x,-center.y,-center.z);geometry.scale(factor,factor,factor);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries.add(geometry);
   const attachment=new T.Vector3(-.02048925,.00254208,.00428792).sub(center).multiplyScalar(factor);
   const material=source.material as T.MeshPhysicalMaterial;material.envMap=environment?.texture||null;material.envMapIntensity=.55;
   const maps=[material.map,material.normalMap,material.roughnessMap].filter(Boolean) as T.Texture[];
   qa.textureSizes.push(...maps.map(t=>[t.image.width,t.image.height]));qa.levels[level]=(geometry.index?.count||geometry.attributes.position.count)/3;if(level==='hero')qa.heroTriangles=qa.levels[level];
   await idle();if(!alive)return;maps.forEach(t=>renderer.initTexture(t));
   const warm=new T.Scene(),representative=new T.Mesh(geometry,material);warm.add(representative,key.clone(),fill.clone());warm.environment=environment?.texture||null;
   await renderer.compileAsync(warm,camera);specimens.set(level,{geometry,material,attachment,level});onSpecimenReady();
   }qa.potato='ready';
  }catch(e){qa.potato='fallback';qa.errors.push('potato: '+String(e));}
  for(const [name,data] of [['scanner',spectralScanner],['mist',mistModule],['dryer',dryerModule],['cabinet',cabinetStatic],['lamp',cabinetLamp],['uvdetail',uvDetail],['stockdetail',stockDetail]] as const){
   await idle();if(!alive)return;
   try{
    const gltf=await parse(data);if(!alive)return;
    if(name==='uvdetail'||name==='stockdetail'){
     let unsupported=false;gltf.scene.traverse(o=>{if(o instanceof T.Light||o instanceof T.Camera)unsupported=true;});
     if(unsupported||gltf.animations.length)throw Error('Fluid static detail contains active objects: '+name);
    }
    // The optional lamp uses the cabinet's material definitions. Share instances
    // without changing the existing LED materials, channels or light controls.
    if(name==='lamp'){
     const shared=new Map<string,T.Material>();industrial.get('cabinet')?.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])shared.set(m.name,m);});
     const darkNames:Record<string,string>={'B05 | deep_teal_panel':'B05_Dark | source_dark_base','B05 | graphite_frame':'B05_Dark | source_graphite_frame','B05 | satin_stainless':'B05_Dark | source_fastener_metal'};
     const old=new Set<T.Material>();gltf.scene.traverse(o=>{if(o instanceof T.Mesh){const replace=(m:T.Material)=>{const next=shared.get(darkNames[m.name]||m.name);if(next){old.add(m);return next;}return m;};o.material=Array.isArray(o.material)?o.material.map(replace):replace(o.material);}});old.forEach(m=>m.dispose());
    }
    keep(gltf.scene);
    gltf.scene.traverse(o=>{if(o instanceof T.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial)m.envMap=environment?.texture||null;}});
    if((window as any).__AEROSENSE_RANKING_MODE__&&(name==='cabinet'||name==='lamp'))restoreCabinetGraphite(gltf.scene);
    qa.materialFinishes[name]=name==='scanner'?finishEquipment(gltf.scene):preserveEmbeddedEquipment(gltf.scene);
    if((window as any).__AEROSENSE_RANKING_MODE__)enableEquipmentShadows(gltf.scene);
    // Upload every static geometry during preparation. A 1-pixel pass on the
    // same renderer avoids first-use buffer allocation when the belt appears.
    // It never advances the production clock or changes the displayed scene.
    await idle();if(!alive)return;
    uploadTextures(gltf.scene);
    const uploadScene=new T.Scene();gltf.scene.traverse(o=>{if(o instanceof T.Mesh){const m=new T.Mesh(o.geometry,uploadMaterial);m.frustumCulled=false;uploadScene.add(m);}});
    const previousTarget=renderer.getRenderTarget();renderer.setRenderTarget(uploadTarget);renderer.render(uploadScene,camera);renderer.setRenderTarget(previousTarget);
    industrial.set(name,gltf.scene);qa[name]='ready';onSpecimenReady();keep(gltf.scene);
   }catch(e){qa[name]='fallback';qa.errors.push(name+': '+String(e));}
  }
 }
 function renderBench(deltaSeconds=0){
  const dest=document.querySelector<HTMLCanvasElement>('.layer.open canvas[data-clean-bench]');
  qa.benchVisible=!!dest&&qa.bench==='ready';qa.airflow=false;
  if(!dest||!bench||qa.bench!=='ready'){
   benchAirflow?.setEnabled(false);
   if(benchControls){benchControls.dispose();benchControls=null;lastCanvas=null;fitWidth=fitHeight=0;qa.benchInteractive=false;}
   return false;
  }
  const preparation=(window as any).__AEROSENSE_PREPARATION__?.state().aseptic;
  // Sampling completion does not stop equipment ventilation. This mixer is
  // advanced exactly once by the existing frame loop, independently of elapsed.
  qa.airflow=!!preparation&&!document.hidden;
  benchAirflow?.setEnabled(qa.airflow);
  benchAirflow?.update(reducedMotion.matches?0:Math.min(.1,deltaSeconds));
  const station=dest.closest<HTMLElement>('.aseptic-station')!,rect=dest.getBoundingClientRect();
  if(rect.width<1||rect.height<1)return false;
  const aspect=rect.width/rect.height;
  if(lastCanvas!==dest){
   benchControls?.dispose();lastCanvas=dest;fitWidth=fitHeight=0;
   benchMotion.begin();benchMotion.update(camera,bench,benchTarget,preparation?.elapsed||0,reducedMotion.matches);
   benchControls=new OrbitControls(camera,dest);benchControls.target.copy(benchTarget);benchControls.enablePan=false;
   benchControls.enableDamping=true;benchControls.dampingFactor=.12;benchControls.rotateSpeed=.65;benchControls.zoomSpeed=.65;
   benchControls.minDistance=1.65;benchControls.maxDistance=6.5;benchControls.minAzimuthAngle=-.70;benchControls.maxAzimuthAngle=.85;benchControls.minPolarAngle=1.02;benchControls.maxPolarAngle=1.78;
   benchControls.update();
   benchControls.addEventListener('start',()=>{benchMotion.interrupt();hintDismissed=true;station.classList.add('is-inspected');});
   station.classList.toggle('is-inspected',hintDismissed);qa.benchInteractive=true;
  }
  // Projection is derived from the immutable reviewed FOV, once per viewport.
  // OrbitControls uses physical camera distance for user zoom.
  if(fitWidth!==rect.width||fitHeight!==rect.height){
   fitBenchView(camera,aspect);fitWidth=rect.width;fitHeight=rect.height;
  }
  qa.benchMotion=benchMotion.update(camera,bench,benchControls!.target,preparation?.elapsed||0,reducedMotion.matches);
  benchControls!.update();qa.benchCamera={position:camera.position.toArray(),zoom:camera.zoom};
  const size=renderer.getSize(new T.Vector2()),ratio=renderer.getPixelRatio(),vw=Math.min(size.x,size.y*aspect),vh=vw/aspect,vx=(size.x-vw)/2,vy=(size.y-vh)/2;
  const w=Math.max(1,Math.round(rect.width*Math.min(devicePixelRatio,ratio))),h=Math.max(1,Math.round(rect.height*Math.min(devicePixelRatio,ratio)));
  if(dest.width!==w||dest.height!==h){dest.width=w;dest.height=h;}
  const sheet=station.closest<HTMLElement>('.event-sheet');benchScene.background=new T.Color(sheet?getComputedStyle(sheet).backgroundColor:'#0e1113');
  const exposure=renderer.toneMappingExposure;renderer.toneMappingExposure=.95;
  renderer.setViewport(vx,vy,vw,vh);
  if(benchShadows)benchShadows.render(()=>renderer.render(benchScene,camera));else renderer.render(benchScene,camera);
  qa.benchCalls=renderer.info.render.calls;qa.benchTriangles=renderer.info.render.triangles;
  dest.getContext('2d')!.drawImage(renderer.domElement,vx*ratio,vy*ratio,vw*ratio,vh*ratio,0,0,w,h);
  renderer.toneMappingExposure=exposure;renderer.setViewport(0,0,size.x,size.y);
  station.classList.add('has-clean-bench');dest.dataset.modelState='ready';dest.dataset.airflow=String(qa.airflow);dest.dataset.sampleElapsed=String(preparation?.elapsed||0);
  for(const name of ['center','edge']){
   const tag=station.querySelector<HTMLElement>('[data-aseptic-location="'+name+'"]');if(!tag)continue;
   const at=workSurface.clone().add(new T.Vector3(name==='center'?0:.48,.025,name==='center'?.08:.18)).project(camera);
   tag.style.left=((at.x*.5+.5)*dest.clientWidth)+'px';tag.style.top=((-at.y*.5+.5)*dest.clientHeight)+'px';
  }
  lastCanvas=dest;return true;
 }
 return {qa,prepare,renderBench,getIndustrial:(name:string)=>industrial.get(name)||null,getSpecimen:(level:string)=>specimens.get(level)||null,dispose(){alive=false;benchControls?.dispose();if(lastCanvas)lastCanvas.dataset.modelState='disposed';benchShadows?.dispose();benchLighting?.dispose();benchAirflow?.dispose();textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());environment?.dispose();uploadTarget.dispose();uploadMaterial.dispose();}};
}
