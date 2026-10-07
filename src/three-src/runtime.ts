import * as T from 'three';
import {createPostharvest} from './postharvest';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import sourceOne from './imported-assets/potato01-web.glb';
import sourceTwo from './imported-assets/potato02-web.glb';
import {SCAN_VIEW_FRACTION,scanCoverage} from './postharvest-view';
import {createHardware} from './hardware';
import {createMist} from './mist';
import {createFluid} from './fluid';
import {createDirector,lightCaption} from './director';
import {TwinState,STAGE_SHAPES,PLANT_X,DECK_Y,DECK_THICKNESS,tuberPositions,unit} from './state';
import {createHarvestArm} from './arm';
import {createSpectralEquipment} from './spectral';
import {createVisionInset} from './vision-inset';
import {createHarvestConfirmation,specimenSpan} from './harvest-confirmation';
import {createCloudModels} from './cloud-models';
import {enableEquipmentShadows,equipmentShadowBounds,fitEquipmentShadow,limitSmallShadowCasters} from './equipment-shadows';
import {installMainLighting} from './equipment-lighting';
import {decodeGLBBase64} from './glb-bytes';
export {mountISEEquipmentView} from './ise-view';

export async function mount(host:HTMLElement,getState:()=>TwinState){
 const root=document.createElement('div');root.className='b05-three-root';host.append(root);
 const message=document.createElement('div');message.className='b05-three-loading';message.setAttribute('role','status');message.textContent='正在载入苗箱模型';root.append(message);
 let renderer:T.WebGLRenderer;
 try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});}catch(e){message.textContent='3D不可用，已保留阶段图片';root.classList.add('is-fallback');return {error:String(e)};}
 const canvas=renderer.domElement;canvas.className='b05-three-canvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','B05三株马铃薯苗箱三维视图，可拖动改变观察角度');root.append(canvas);
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 if((window as any).__AEROSENSE_RANKING_MODE__)renderer.shadowMap.autoUpdate=false;
 const lowPower=(navigator.hardwareConcurrency||8)<=4||(Number((navigator as any).deviceMemory)||8)<=4||new URLSearchParams(location.search).has('lowPower');
 const cloudModels=createCloudModels(renderer);
 const scene=new T.Scene();
 const backdrop=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{surfaceColor:{value:new T.Vector3(0,0,0)}},
  vertexShader:'varying vec2 uvScreen;void main(){uvScreen=uv;gl_Position=vec4(position.xy,1.,1.);}',
  fragmentShader:'uniform vec3 surfaceColor;void main(){gl_FragColor=vec4(surfaceColor,1.);}'}));
 backdrop.name='continuous-dark-depth-background';backdrop.frustumCulled=false;backdrop.renderOrder=-1000;scene.add(backdrop);
 const camera=new T.OrthographicCamera(-1.7,1.7,1.5,-1.5,.1,50);
 const pressureCamera=new T.OrthographicCamera(-1.5,1.5,.8,-.8,.1,50);
 const spectralCamera=new T.OrthographicCamera(-1,1,.7,-.7,.1,50);spectralCamera.layers.enable(2);
 pressureCamera.position.set(.18,.48,5);pressureCamera.lookAt(0,.05,0);
 let pressureCard:HTMLCanvasElement|null=null,pressureCardStart=0;
 const controls=new OrbitControls(camera,canvas);controls.target.set(0,1.38,0);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.09;controls.minAzimuthAngle=-.58;controls.maxAzimuthAngle=.58;controls.minPolarAngle=1.18;controls.maxPolarAngle=1.65;controls.minZoom=.85;controls.maxZoom=1.7;
 function resetCamera(){controls.enableDamping=false;camera.position.set(0,1.05,7);camera.zoom=1;camera.updateProjectionMatrix();controls.target.set(0,1.05,0);controls.update();controls.enableDamping=true;}
 resetCamera();controls.maxZoom=(window as any).__AEROSENSE_RANKING_MODE__?12:2.2;controls.maxPolarAngle=2.06;

 const inspectLight=()=>director.inspectLight();window.addEventListener('aerosense:inspect-light',inspectLight);
 const toolbar=document.createElement('div');toolbar.className='b05-three-tools';toolbar.innerHTML='<button type="button">复位视角</button>';root.append(toolbar);
 toolbar.querySelector('button')!.onclick=()=>{director.pause();resetCamera();};
 const overlay=document.createElement('div');overlay.className='b05-three-labels';overlay.setAttribute('aria-hidden','true');root.append(overlay);
 function label(name:string,className=''){const el=document.createElement('span');el.className='b05-three-label '+className;el.textContent=name;overlay.append(el);return el;}
 const labels={spectrum:label('冠层光谱'),leaf:label('叶温采样','sample-label'),root:label('根系成像','align-left'),fluid:label('回液探头','align-right')};
 const pressureReadout=label('','pressure-readout');pressureReadout.hidden=true;
 const qualityReadout=label('直径 31 mm · 规格确认','quality-dimension');qualityReadout.hidden=true;
 const actionCaption=label('','action-caption');actionCaption.hidden=true;
 const chargeCaption=label('荷电喷雾','action-caption');chargeCaption.hidden=true;
 const chargePairs=Array.from({length:6},(_,i)=>({plant:Math.floor(i/2),side:i%2?1:-1,anchor:new T.Vector3(),positive:label('＋','charge-sign charge-positive'),negative:label('−','charge-sign charge-negative')}));
 chargePairs.forEach(p=>{p.positive.hidden=true;p.negative.hidden=true;});
 const actionPointer=new T.ArrowHelper(new T.Vector3(0,1,0),new T.Vector3(),.14,0xaacbbc,.025,.015);scene.add(actionPointer);actionPointer.visible=false;
 const depthLabels=[['冠层',2.0],['定植板',1.65],['根域',1.07]] as [string,number][];
 const depths=depthLabels.map(([name,y])=>({el:label(name,'depth-label'),at:new T.Vector3(-1.37,y,0)}));
 const hardware=createHardware();scene.add(hardware.group);
 const fluid=createFluid();scene.add(fluid.group);
 const serviceLight=new T.PointLight(0xe4ebee,0,2.2,2);serviceLight.position.set(-.16,.10,1.4);serviceLight.name='service-inspection-fill';scene.add(serviceLight);
 const arm=createHarvestArm();scene.add(arm.group);
 const spectral=createSpectralEquipment();scene.add(spectral.group);
 const sorting=createPostharvest();scene.add(sorting.group);
 const director=createDirector(camera,controls,(mode,seconds)=>sorting.getScanBounds(mode,seconds));
 const visionInset=createVisionInset(root,renderer,scene);
 const harvestConfirmation=createHarvestConfirmation(renderer,scene);
 const spectralCaption=label('','spectral-caption');spectralCaption.hidden=true;
 const algorithmCaption=label('400–1000 nm → 特征光谱 → PLS 回归分析','algorithm-caption');algorithmCaption.hidden=true;
 const fluidLabels=fluid.annotations.map(a=>({...a,el:label(a.name,'fluid-label')}));
 const deposition=new T.Group();deposition.name='deposition-direction-guides';scene.add(deposition);
 const chargeMat=new T.MeshStandardMaterial({color:0x788681,metalness:.65,roughness:.4,emissive:0x4c8066,emissiveIntensity:0});
 for(let i=0;i<9;i++){const ring=new T.Mesh(new T.TorusGeometry(.022,.004,8,20),chargeMat);ring.rotation.x=Math.PI/2;ring.position.set(-1.04+i*.26,.235,0);scene.add(ring);}
 const chargedDrops=new T.InstancedMesh(new T.SphereGeometry(.0035,6,4),new T.MeshBasicMaterial({color:0xb8d3c3,transparent:true,opacity:.65}),72);scene.add(chargedDrops);const chargeDummy=new T.Object3D();
 for(const x of [-.72,0,.72])for(const side of [-1,1]){const from=new T.Vector3(x+side*.20,.88,.06),dir=new T.Vector3(-side*.14,.13,0).normalize();deposition.add(new T.ArrowHelper(dir,from,.15,0xa8c6b1,.030,.018));}deposition.visible=false;
 const rayGeometry=new T.BufferGeometry();rayGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(6),3));
 const sampleRay=new T.Line(rayGeometry,new T.LineDashedMaterial({color:0xc4d4b8,dashSize:.02,gapSize:.013,transparent:true,opacity:.8}));sampleRay.visible=false;scene.add(sampleRay);
 const plantingRings=new T.Group();scene.add(plantingRings);for(const x of PLANT_X){const ring=new T.Mesh(new T.TorusGeometry(.064,.002,6,32),new T.MeshBasicMaterial({color:0xa8c6b1}));ring.rotation.x=Math.PI/2;ring.position.set(x,1.716,0);plantingRings.add(ring);}plantingRings.visible=false;
 // Restrained display-only light envelope. Soft edges end in the canopy, never in the roots.
 const beamGeometry=new T.BufferGeometry();
 beamGeometry.setAttribute('position',new T.Float32BufferAttribute([-1.07,2.36,0,1.07,2.36,0,-1.15,1.78,.12,1.15,1.78,.12],3));
 beamGeometry.setAttribute('uv',new T.Float32BufferAttribute([0,1,1,1,0,0,1,0],2));beamGeometry.setIndex([0,2,1,2,3,1]);
 const beamMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
  uniforms:{level:{value:0},tint:{value:new T.Color(0xe9f1ff)}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec2 vUv;uniform float level;uniform vec3 tint;void main(){float edge=smoothstep(0.,.18,vUv.x)*smoothstep(0.,.18,1.-vUv.x);float falloff=smoothstep(0.,.9,vUv.y);gl_FragColor=vec4(tint,edge*falloff*level*.24);}'});
 const lightEnvelope=new T.Mesh(beamGeometry,beamMaterial);lightEnvelope.name='canopy-light-envelope-illustration';scene.add(lightEnvelope);
 const uvaEnvelopeMat=beamMaterial.clone();uvaEnvelopeMat.uniforms.tint.value=new T.Color(0x9165dd);uvaEnvelopeMat.uniforms.level.value=0;
 const uvaEnvelope=new T.Mesh(beamGeometry,uvaEnvelopeMat);uvaEnvelope.name='uva-visible-channel-envelope';uvaEnvelope.position.z=.025;scene.add(uvaEnvelope);
 const uvaFill=[-.72,0,.72].map(x=>{const l=new T.SpotLight(0xa47ce5,0,1.1,.8,.9,2);l.position.set(x,2.35,.14);l.target.position.set(x,1.85,0);l.layers.set(1);scene.add(l,l.target);return l;});
 let uvaLevel=0;
 const mist=createMist();scene.add(mist.points);
 // Weak inspection illumination keeps a cutaway readable without simulating a bright room.
 const ambient=new T.HemisphereLight(0xe9ebeb,0x25282b,.32);scene.add(ambient);
 const key=new T.DirectionalLight(0xf0f3f5,.90);key.position.set(-3,3.5,4);scene.add(key);
 key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-1.8;key.shadow.camera.right=1.8;key.shadow.camera.top=1.9;key.shadow.camera.bottom=-1.9;key.shadow.camera.near=.5;key.shadow.camera.far=10;key.target.position.set(0,1.35,0);scene.add(key.target);key.shadow.bias=-.00015;key.shadow.normalBias=.003;key.shadow.radius=2;
 const fill=new T.DirectionalLight(0xe3e6e7,(window as any).__AEROSENSE_RANKING_MODE__?.24:.10);fill.position.set(3,.9,2);scene.add(fill);
 const rim=new T.DirectionalLight(0xe0e5e6,(window as any).__AEROSENSE_RANKING_MODE__?.85:.65);rim.position.set(-2,2,-2);scene.add(rim);
 // Keep biological detail readable without flattening the graphite hardware.
 const biologyFill=new T.DirectionalLight(0xe4e9ed,.50);biologyFill.position.set(1,1.5,4);biologyFill.layers.set(2);scene.add(biologyFill);camera.layers.enable(2);
 // A display-only upper inspection fill does not illuminate the sealed root compartment.
 const upper=new T.DirectionalLight(0xf2f4f5,.65);upper.position.set(-1,3,3);upper.layers.set(1);scene.add(upper);camera.layers.enable(1);
 const top=new T.SpotLight(0xf4f7ff,0,3.2,1.18,.65,2);top.position.set(0,2.36,.12);top.target.position.set(0,1.65,0);top.name='white-grow-channel';
 top.castShadow=true;top.shadow.mapSize.set(1024,1024);top.shadow.bias=-.0002;top.shadow.normalBias=.004;
 top.layers.set(1);scene.add(top,top.target);
 const equipmentLighting=(window as any).__AEROSENSE_RANKING_MODE__?installMainLighting(scene,{key,fill,rim,ambient,biology:biologyFill,upper}):null;
 // Fit the single main shadow to physical equipment; low-power devices omit
 // tiny casters while retaining receivers and a 512-pixel main map.
 function refreshEquipmentShadows(){
  if(!(window as any).__AEROSENSE_RANKING_MODE__)return;
  const equipment=[hardware.group,fluid.group,arm.group,sorting.group];
  equipment.forEach(enableEquipmentShadows);
  if(lowPower)limitSmallShadowCasters(equipment);
  fitEquipmentShadow(key,equipmentShadowBounds(equipment));
 }
 refreshEquipmentShadows();
 const sideWhite=[-.72,.72].map(x=>{const l=new T.SpotLight(0xe9f1ff,0,1.3,1.10,.85,2);l.position.set(x,2.36,.12);l.target.position.set(x,1.75,0);l.layers.set(1);scene.add(l,l.target);return l;});
 const allPlants=new T.Group();allPlants.name='source-derived-plants';scene.add(allPlants);
 const plants:T.Group[]=[],rootMeshes:T.Mesh[]=[],shootMeshes:T.Mesh[]=[];
 const scanUniforms={root:{value:0},spectrum:{value:0},y:{value:0},heat:{value:0},sample:{value:new T.Vector3()}};
 function analyticalMaterial(source:T.MeshStandardMaterial,isRoot:boolean){
  const mat=source.clone();mat.roughness=isRoot?.9:.82;mat.metalness=0;
  mat.color.set(isRoot?0xb7a789:0x567b39);
  mat.onBeforeCompile=shader=>{shader.uniforms.uAnalysis=isRoot?scanUniforms.root:scanUniforms.spectrum;shader.uniforms.uScanY=scanUniforms.y;
   shader.uniforms.uHeat=scanUniforms.heat;shader.uniforms.uSample=scanUniforms.sample;
   shader.vertexShader='varying vec3 vScenePoint;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvScenePoint=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader='varying vec3 vScenePoint;uniform float uAnalysis;uniform float uScanY;uniform float uHeat;uniform vec3 uSample;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat scanBand=exp(-pow((vScenePoint.y-uScanY)/.035,2.));float region='+ (isRoot?'(1.-smoothstep(.20,.40,abs(vScenePoint.x)))':'(1.-smoothstep(.08,.18,distance(vScenePoint,uSample)))')+';diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.18,.66,.46),uAnalysis*region*(.10+.60*scanBand));'+(isRoot?'':'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.85,.33,.12),uHeat*region*.55);'));
  };mat.customProgramCacheKey=()=>isRoot?'b05-root-analysis':'b05-canopy-analysis';return mat;
 }
 let rootMat:T.MeshStandardMaterial,shootMat:T.MeshStandardMaterial;
 let sourceScenes:T.Group[];
 try{
  sourceScenes=await Promise.all([sourceOne,sourceTwo].map(async data=>(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(decodeGLBBase64(data),'')).scene));
 }catch(e){message.textContent='模型载入失败，已保留阶段图片';root.classList.add('is-fallback');renderer.dispose();return {error:String(e)};}
 const tuberMat=new T.MeshStandardMaterial({color:0xa68a59,roughness:.92});
 const stolonMat=new T.MeshStandardMaterial({color:0xa39476,roughness:.91});
 const tuberSets:{group:T.Group;tubers:T.Mesh[];stolons:T.Mesh[]}[]=[];
 for(let n=0;n<3;n++){
  const plant=new T.Group();plant.name='potato-'+(n+1);plant.position.set(PLANT_X[n],DECK_Y+.062,0);plant.rotation.y=[-.12,.12,-.23][n];allPlants.add(plant);plants.push(plant);
  const asset=sourceScenes[n===1?1:0].clone(true);plant.add(asset);
  asset.traverse(o=>{if(!(o instanceof T.Mesh))return;const isRoot=o.name!=='shoot';
   o.receiveShadow=true;o.castShadow=!isRoot;o.layers.enable(2);
   if(!isRoot){o.scale.multiplyScalar(1.45);o.layers.enable(1);}
   if(isRoot){o.userData.depthClass='root';rootMat||=(analyticalMaterial(o.material as T.MeshStandardMaterial,true));o.material=rootMat;rootMeshes.push(o);}
   else{shootMat||=(analyticalMaterial(o.material as T.MeshStandardMaterial,false));o.material=shootMat;shootMeshes.push(o);}
  });
  // Separate stage-illustration tubers: attached to stolons from the stem base,
  // never hung on the fine root tips. Source root geometry is unchanged here.
  const tGroup=new T.Group();tGroup.name='illustrative-stolons-and-tubers';plant.add(tGroup);const tubers:T.Mesh[]=[],stolons:T.Mesh[]=[];
  const positions=tuberPositions(n);
  for(let j=0;j<positions.length;j++){
   const position=positions[j],depth=-position.y,angle=unit(j*23+n*991)*Math.PI*2;
   const at=new T.Vector3(position.x,position.y,position.z);
   const curve=new T.CatmullRomCurve3([new T.Vector3(.004,-.045,0),new T.Vector3(at.x*.25,-.08-depth*.12,at.z*.30),new T.Vector3(at.x*.60,-depth*.58,at.z*.8),new T.Vector3(at.x*.9,at.y+.055,at.z*.97),at]);
   const stolon=new T.Mesh(new T.TubeGeometry(curve,24,.00135,5,false),stolonMat);stolon.name='illustrative-stolon-'+j;tGroup.add(stolon);stolons.push(stolon);
   const shape=new T.SphereGeometry(1,22,16),pos=shape.getAttribute('position');
   for(let k=0;k<pos.count;k++){const x=pos.getX(k),y=pos.getY(k),z=pos.getZ(k),s=1+.042*Math.sin(x*4+j)*Math.cos(y*5+n)+.025*Math.sin(z*7+y*3);pos.setXYZ(k,x*s*(.94+.04*y),y*s,z*s*(.88+.03*y));}shape.computeVertexNormals();
   const tuber=new T.Mesh(shape,tuberMat);tuber.position.copy(at);tuber.rotation.set(unit(j)*.5,angle,.15);tuber.name='illustrative-stage-tuber-'+j;tGroup.add(tuber);tubers.push(tuber);
  }tGroup.traverse(o=>{if(o instanceof T.Mesh)o.layers.enable(2);});tuberSets.push({group:tGroup,tubers,stolons});
 }
 // Quantify the model's green texture pixels, not measured chlorophyll or leaf nitrogen.
 {const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d')!;
 const image=shootMat.map?.image;let rr=0,gg=0,bb=0,count=0;
 if(image){ctx.drawImage(image,0,0,128,128);const pixels=ctx.getImageData(0,0,128,128).data;for(let i=0;i<pixels.length;i+=4){const r=pixels[i],g=pixels[i+1],b=pixels[i+2];if(pixels[i+3]>128&&g>25&&g>r*1.08&&g>b*1.05){rr+=r;gg+=g;bb+=b;count++;}}}
 if(!count){const color=shootMat.color.clone().convertLinearToSRGB();rr=color.r*255;gg=color.g*255;bb=color.b*255;count=1;}
 if(count>0){const value={gcc:gg/(rr+gg+bb),rgb:[Math.round(rr/count),Math.round(gg/count),Math.round(bb/count)]};(window as any).__AEROSENSE_LEAF_COLOR__=value;window.dispatchEvent(new CustomEvent('aerosense:leaf-color',{detail:value}));}
 }
 const sample=new T.Mesh(new T.SphereGeometry(.008,12,8),new T.MeshBasicMaterial({color:0xcbe0c4}));sample.name='leaf-temperature-sample';scene.add(sample);
 let samplePosition=new T.Vector3(.72,2.02,0),sampleVerified=false;
 function aimLeafSensor(){
  scene.updateMatrixWorld(true);const mesh=shootMeshes[2],pos=mesh.geometry.getAttribute('position');
  const origin=hardware.labels.leaf.getWorldPosition(new T.Vector3());const desired=new T.Vector3(.77,DECK_Y+.062+.40*plants[2].scale.x,.10);
  const candidates:T.Vector3[]=[];
  for(let i=0;i<pos.count;i+=Math.max(1,Math.floor(pos.count/240))){const p=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);if(p.y>DECK_Y+.18*plants[2].scale.x)candidates.push(p);}
  candidates.sort((a,b)=>a.distanceToSquared(desired)-b.distanceToSquared(desired));const ray=new T.Raycaster();sampleVerified=false;
  for(const p of candidates){ray.set(origin,p.clone().sub(origin).normalize());const hit=ray.intersectObject(mesh,false)[0];if(hit){samplePosition.copy(hit.point);sampleVerified=true;break;}}
  hardware.labels.leaf.lookAt(samplePosition);sample.position.copy(samplePosition);sample.visible=sampleVerified;
 }
 let currentStage=-1;
 const tuberMarker=new T.Box3Helper(new T.Box3(),0xc5d5c9);tuberMarker.visible=false;scene.add(tuberMarker);
 const rootMeasure=new T.Box3Helper(new T.Box3(),0x89ad99);rootMeasure.visible=false;scene.add(rootMeasure);
 const tuberTarget=new T.Vector3(0,.85,0);const harvestPlant=1;let harvestIndex=0;
 const preferredSpecimen=()=>cloudModels.getSpecimen(lowPower?'medium':'hero')||cloudModels.getSpecimen('medium')||cloudModels.getSpecimen('distant');
 let appliedSpecimen:ReturnType<typeof preferredSpecimen>=null;
 function applyStage(index:number){
  currentStage=index;const profile=STAGE_SHAPES[index]||STAGE_SHAPES[4];
  plants.forEach((p,n)=>{p.scale.setScalar(profile.scale);tuberSets[n].tubers.forEach((m,j)=>{m.visible=j<profile.tubers;const r=profile.radius*(.92+unit(j+22)*.12);m.scale.set(r*.92,r*1.10,r*.85);tuberSets[n].stolons[j].visible=m.visible;});});
  aimLeafSensor();
  scanUniforms.sample.value.copy(samplePosition);
  const choices=tuberSets[harvestPlant].tubers.map((m,i)=>({m,i})).filter(({m})=>m.visible&&m.position.y<-.40&&m.position.y>-.90).sort((a,b)=>(b.m.position.z+b.m.position.x*.3)-(a.m.position.z+a.m.position.x*.3));
  harvestIndex=choices[0]?.i||0;const picked=tuberSets[harvestPlant].tubers[harvestIndex];
  const focused=preferredSpecimen();appliedSpecimen=focused;
  const distant=cloudModels.getSpecimen('distant');
  tuberSets.forEach((set,n)=>set.tubers.forEach((m,j)=>{
   m.userData.originalGeometry||=m.geometry;const asset=m===picked?focused:distant;
   m.geometry=asset?.geometry||m.userData.originalGeometry;m.material=asset?.material||tuberMat;m.userData.cloudAsset=asset?.level||'legacy';
   if(asset&&m.visible){
    m.updateMatrix();const at=m.position.clone(),end=asset.attachment.clone().applyMatrix4(m.matrix),depth=-at.y;
    const curve=new T.CatmullRomCurve3([new T.Vector3(.004,-.045,0),new T.Vector3(at.x*.25,-.08-depth*.12,at.z*.30),new T.Vector3(at.x*.60,-depth*.58,at.z*.8),end.clone().add(new T.Vector3(0,.035,0)),end]);
    set.stolons[j].geometry.dispose();set.stolons[j].geometry=new T.TubeGeometry(curve,24,.00135,5,false);
   }
  }));
  tuberSets.forEach(set=>set.tubers.forEach(m=>m.userData.depthTarget=m===picked));
  scene.updateMatrixWorld(true);picked.getWorldPosition(tuberTarget);tuberMarker.box.setFromObject(picked).expandByScalar(.008);spectral.setSpecimen(picked);arm.setSpecimen(picked);
  // Attach positive markers to actual root vertices, not fixed world-space columns.
  for(const pair of chargePairs){
   const desired=new T.Vector3(PLANT_X[pair.plant]+pair.side*.055,DECK_Y-(pair.side>0?.48:.70)*profile.scale,.08);
   let distance=Infinity;plants[pair.plant].traverse(o=>{if(!rootMeshes.includes(o as T.Mesh))return;const mesh=o as T.Mesh,pos=mesh.geometry.getAttribute('position');
    for(let i=0;i<pos.count;i+=Math.max(1,Math.floor(pos.count/320))){const v=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld),d=v.distanceToSquared(desired);if(d<distance){distance=d;pair.anchor.copy(v);}}
   });
  }
  rootMeasure.box.makeEmpty();plants[1].traverse(o=>{if(o instanceof T.Mesh&&rootMeshes.includes(o))rootMeasure.box.union(new T.Box3().setFromObject(o));});
 }
 let width=0,height=0,dpr=1,safeInset=16;
 const labelSizes=new WeakMap<HTMLElement,{text:string;width:number;height:number}>();
 canvas.dataset.renderProfile=lowPower?'low-power':'standard';
 if((window as any).__AEROSENSE_RANKING_MODE__&&lowPower){key.shadow.mapSize.set(512,512);top.castShadow=false;}
 function resize(){
  width=Math.max(1,host.clientWidth);height=Math.max(1,host.clientHeight);
  const rect=host.getBoundingClientRect(),fit=rect.width/width;safeInset=16/Math.max(.3,fit);
  overlay.querySelectorAll<HTMLElement>('.b05-three-label').forEach(el=>labelSizes.delete(el));
  root.style.setProperty('--scan-ui-size',String(1/Math.max(.3,fit)));
  overlay.style.setProperty('--fluid-font-size',(16/Math.max(.3,fit))+'px');
  overlay.style.setProperty('--fluid-focus-size',(20/Math.max(.3,fit))+'px');
  overlay.style.setProperty('--device-font-size',(17/Math.max(.3,fit))+'px');
  overlay.style.setProperty('--action-font-size',(22/Math.max(.3,fit))+'px');
  dpr=Math.min((window as any).__AEROSENSE_RANKING_MODE__?(lowPower?1:1.25):1.75,Math.max(.65,devicePixelRatio*fit));renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);
  const aspect=width/height,halfHeight=Math.max(1.70,1.46/aspect);camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
 }
 new ResizeObserver(resize).observe(host);window.addEventListener('resize',resize);resize();
 const project=(el:HTMLElement,p:T.Vector3,dy=0)=>{
  const v=p.clone().project(camera);let x=(v.x*.5+.5)*width,y=(-v.y*.5+.5)*height+dy;
  if((window as any).__AEROSENSE_RANKING_MODE__&&!el.hidden&&!el.classList.contains('light-effect-caption')&&(el.classList.contains('action-caption')||el.classList.contains('fluid-label')||el.classList.contains('quality-dimension')||el.classList.contains('pressure-readout'))){
   const text=el.textContent||'';let size=labelSizes.get(el);
   if(!size||size.text!==text){size={text,width:el.offsetWidth,height:el.offsetHeight};if(size.width&&size.height)labelSizes.set(el,size);}
   x=T.MathUtils.clamp(x,safeInset+size.width/2,Math.max(safeInset+size.width/2,width-safeInset-size.width/2));
   y=T.MathUtils.clamp(y,safeInset+size.height/2,Math.max(safeInset+size.height/2,height-safeInset-size.height/2));
  }
  el.style.left=x+'px';el.style.top=y+'px';
 };
 function updateLabels(){
  project(labels.spectrum,hardware.labels.spectrum.getWorldPosition(new T.Vector3()).add(new T.Vector3(.28,0,0)),0);
  labels.spectrum.classList.add('sensor-side-label');
  project(labels.leaf,samplePosition,18);
  project(labels.root,rootMeasure.visible?rootMeasure.box.getCenter(new T.Vector3()):hardware.labels.root.getWorldPosition(new T.Vector3()),-16);
  project(labels.fluid,hardware.labels.fluid.getWorldPosition(new T.Vector3()),15);
  depths.forEach(({el,at})=>project(el,at));
  const focus=director.automatic?director.focus:'overview';
  const focused:Record<string,string[]>={fluid:['营养液','A','B','C','D','E','UV-C'],uv:['UV-C','过滤'],cooling:['冷却'],oxygen:['氧合'],dose:['营养液','D','E']};
  const names=focus==='overview'?['营养液','UV-C','A','B','C','D','E']:focused[focus]||[];
  for(const {el,at,name} of fluidLabels){const v=at.clone().project(camera);el.hidden=/^[A-E]$/.test(name)||(!actionCaption.hidden&&focus!=='overview'&&focus!=='fluid')||!names.includes(name)||v.z < -1||v.z>1||Math.abs(v.x)>.95||Math.abs(v.y)>.93;el.classList.toggle('is-focus',focus!=='overview');el.classList.toggle('is-stock',/^[A-E]$/.test(name));project(el,at);}
 }
 host.classList.add('has-3d');message.remove();
 const clockStart=performance.now()/1000;let last=0,lightLevel=0,frames=0,alive=true,lastState:TwinState;
 const resetFrameDelta=()=>{last=performance.now();};
 document.addEventListener('visibilitychange',resetFrameDelta);
 let suspended=false;
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();suspended=true;host.classList.remove('has-3d');root.classList.add('is-fallback');message.textContent='3D已暂停，显示阶段图片';root.append(message);});
 canvas.addEventListener('webglcontextrestored',()=>{resetFrameDelta();suspended=false;host.classList.add('has-3d');root.classList.remove('is-fallback');message.remove();});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function frame(now:number){
  if(!alive)return;requestAnimationFrame(frame);if(document.hidden||suspended||now-last<32)return;
  const motionDt=Math.min(1,(now-last)/1000||.033),dt=Math.min(.1,motionDt);last=now;
  const state=getState();lastState=state;
  if(currentStage!==state.stage)applyStage(state.stage);
  const mirrors=Array.from(document.querySelectorAll<HTMLCanvasElement>('.layer.open canvas[data-twin-mirror]'));
  // Complete camera return even behind a static evidence card.
  director.update(state.event,state.stage,samplePosition,tuberTarget,motionDt,reduced.matches,state.presentation,state.lightRecipe.uva,state.sequence);controls.update();
  if(!state.visible&&!mirrors.length){cloudModels.renderBench(motionDt);if(state.event===25)sorting.update(25,state.sequence?.event===25?state.sequence.elapsed:18);return;}
  const t=now/1000-clockStart;
  serviceLight.intensity=(window as any).__AEROSENSE_RANKING_MODE__&&state.event===19&&state.sequence?.active?1.65:0;
  fluid.update(t,dt,state,reduced.matches);canvas.dataset.fluid=JSON.stringify(fluid.qa);
  const spectralMirror=mirrors.find(dest=>dest.hasAttribute('data-spectral-closeup')||dest.hasAttribute('data-sort-closeup'));
  let scanPanel=document.querySelector<HTMLElement>('.live-scan-panel');
  if(!scanPanel){scanPanel=document.createElement('div');scanPanel.className='live-scan-panel';scanPanel.innerHTML='<b>光谱特征图</b><canvas data-sort-falsecolor aria-label="逐行光谱特征及异常区域"></canvas><div class="sort-legend"><i></i>异常区域</div><span data-scan-values></span><strong data-sort-status></strong>';canvas.parentElement?.append(scanPanel);}
  scanPanel.hidden=state.event!==25||!state.sequence?.active||state.sequence.elapsed>=18;
  sorting.update(state.event,state.event===25?(state.sequence?.event===25?state.sequence.elapsed:18):(state.sequence?.elapsed||0));
  equipmentLighting?.update(state.event===25);
  spectral.update(state,tuberTarget,!!spectralMirror);canvas.dataset.spectral=JSON.stringify(spectral.qa);
  spectralCaption.hidden=!spectral.qa.active||director.moving||!!spectralMirror;
  algorithmCaption.hidden=true;
  if(!spectralCaption.hidden){spectralCaption.textContent=spectral.qa.phase;spectralCaption.dataset.result=String(spectral.qa.dryMatter!==null);}
  if(state.event===25&&state.sequence?.active&&state.sequence.elapsed<18){spectralCaption.hidden=false;spectralCaption.textContent=sorting.qa.object===2&&sorting.qa.complete?'光谱异常 · OBJ-0539 不合格 → 红色剔除出口':'破薯 · 烂薯';}
  const moved=arm.update(state,tuberTarget);canvas.dataset.arm=JSON.stringify(arm.qa);
  const postHarvest=['grading','archive','complete'].includes(state.eventKey||'');
  tuberSets[harvestPlant].tubers[harvestIndex].visible=!moved&&!postHarvest&&harvestIndex<STAGE_SHAPES[state.stage].tubers;tuberSets[harvestPlant].stolons[harvestIndex].visible=!arm.qa.detached&&!postHarvest&&harvestIndex<STAGE_SHAPES[state.stage].tubers;
  const mistOn=state.mist&&state.mistVerified;mist.update(t,dt,mistOn,reduced.matches,dpr);
  const selfCheck=state.sequence?.active&&state.event===0;
  const target=state.light?state.dimming/100:0;lightLevel=selfCheck?target:lightLevel+(target-lightLevel)*(1-Math.exp(-dt/.18));
  const recipe=state.lightRecipe,mix=recipe.spectrum;
  const warm=recipe.kelvin===3000;const whiteColor=new T.Color(warm?0xffd6a3:0xe9f1ff);
  const visibleMix=whiteColor.clone().multiplyScalar(mix.w/100);
  visibleMix.add(new T.Color(0xff3636).multiplyScalar(mix.r/100)).add(new T.Color(0x416aff).multiplyScalar(mix.b/100)).add(new T.Color(0x963747).multiplyScalar(mix.fr/100));
  beamMaterial.uniforms.level.value=lightLevel*(mix.w+mix.r+mix.b+mix.fr>0?1:0);beamMaterial.uniforms.tint.value.copy(selfCheck?visibleMix:whiteColor);
  uvaLevel=selfCheck?Number(recipe.uva):uvaLevel+(Number(recipe.uva)-uvaLevel)*(1-Math.exp(-dt/.18));uvaEnvelopeMat.uniforms.level.value=uvaLevel*.85;uvaEnvelope.visible=uvaLevel>.005;uvaFill.forEach(l=>l.intensity=uvaLevel*.7);
  hardware.ledMats[3].emissive.copy(whiteColor);top.color.copy(whiteColor);
  // Visible emitter exposure is separate from canopy illuminance and PPFD settings.
  hardware.ledMats.forEach((m,i)=>{
   m.emissiveIntensity=i===4?uvaLevel*2.0:lightLevel*[mix.r/100*9,mix.b/100*9,mix.fr/100*.8,mix.w/100*6][i];
   m.color.setHex(m.emissiveIntensity>0?0x222222:0x101213);
  });
  hardware.lamps.forEach((l,i)=>l.intensity=lightLevel*(i===1?mix.b/100*.65:mix.r/100*.35));
  top.intensity=lightLevel*mix.w/100*3.2;
  sideWhite.forEach(l=>{l.color.copy(whiteColor);l.intensity=lightLevel*mix.w/100*2.2;});
  const settled=!director.moving;const analysisActive=settled&&director.phase==='hold'&&state.presentation!=='ended';
  const seq=state.sequence,seqActive=!!seq?.active;
  const explaining=settled&&director.phase==='hold'&&(seqActive||director.focus==='light');
  const focusAnchor:Record<string,T.Vector3>={oxygen:fluid.anchors.oxygen,fluid:fluid.anchors.tank,uv:fluid.anchors.uv,cooling:fluid.anchors.cooling,dose:fluid.anchors.tank,pressure:hardware.labels.pressure.getWorldPosition(new T.Vector3()),leaf:samplePosition,root:new T.Vector3(0,1.04,.1),mist:new T.Vector3(0,.65,.1),planting:new T.Vector3(0,1.72,.1),harvest:new T.Vector3(.90,.36,.60),light:new T.Vector3(0,2.5,.1)};
  const textByFocus:Record<string,string>={oxygen:'气液混合 · 气泡为放大示意',fluid:'营养液循环回流',uv:'UV-C 管内处理',cooling:'冷却支路换热',dose:state.event===15?'母液D · 补偿待命':'母液计量加入',pressure:seq&&seq.elapsed<3?'建立回路压力':'喷头关闭 · 保压观察',leaf:'叶温采样点',root:'根系复测范围',mist:'喷雾向上覆盖根系',planting:'定植位置确认',harvest:'夹爪'+arm.qa.phase,light:lightCaption(recipe)};
  actionCaption.classList.toggle('light-effect-caption',director.focus==='light');
  const anchor=focusAnchor[director.focus];actionCaption.hidden=!explaining||!anchor;actionPointer.visible=!actionCaption.hidden;
  if(director.focus==='harvest-close'&&explaining){actionCaption.hidden=false;actionCaption.textContent='中间株 · '+arm.qa.phase;project(actionCaption,tuberTarget,72);actionPointer.visible=false;}
  if(anchor&&explaining){actionCaption.textContent=(window as any).__AEROSENSE_RANKING_MODE__&&state.event===19?(director.focus==='oxygen'?'氧合 · 气液传质':director.focus==='uv'?'循环净化 · 自毒物质清除':'氧合循环 · 净化回流'):director.focus==='oxygen'?'氧合 · 气液混合':state.event===14?'静电辅助 · 根表附着':textByFocus[director.focus];project(actionCaption,anchor,director.focus==='pressure'?82:58);actionPointer.position.copy(anchor).add(new T.Vector3(0,-.18,.04));}
  if(director.focus==='light')actionPointer.visible=false;
  deposition.visible=seqActive&&state.event===14&&seq!.elapsed>=3&&seq!.elapsed<7;
  const electrostatic=!!state.electrostatic&&state.mist;chargeMat.emissiveIntensity=electrostatic?.65:0;chargedDrops.visible=electrostatic&&seqActive&&state.event===14;
  const showingCharges=seqActive&&state.event===14&&settled&&electrostatic&&seq!.elapsed>=3&&seq!.elapsed<8;
  chargeCaption.hidden=!showingCharges;
  if(showingCharges){chargeCaption.textContent='− 雾滴 · ＋ 根表感应 · 根系接地';project(chargeCaption,new T.Vector3(0,.24,.12),32);}
  for(let i=0;i<chargePairs.length;i++){
   const p=chargePairs[i];p.positive.hidden=!showingCharges;p.negative.hidden=!showingCharges;
   if(!showingCharges)continue;
   const u=reduced.matches?.68:((seq!.elapsed-3)/1.8+i*.19)%1,bend=u*u*(3-2*u);
   const drop=p.anchor.clone().add(new T.Vector3(p.side*.25*(1-bend),-.24*(1-u),.04));
   project(p.positive,p.anchor.clone().add(new T.Vector3(p.side*.025,0,.03)),-7);project(p.negative,drop,0);
   p.negative.style.opacity=String(reduced.matches?.9:Math.min(1,u/.15,(1-u)/.18));
  }
  if(chargedDrops.visible){for(let i=0;i<72;i++){const u=(t*.32+i/72)%1,x=PLANT_X[i%3],side=i%2?1:-1;const bend=u*u*(3-2*u);chargeDummy.position.set(x+side*(.26*(1-bend)+.055),.25+u*1.15,Math.sin(i*2.4)*.055);chargeDummy.scale.setScalar(Math.sin(Math.PI*u)*1.65);chargeDummy.updateMatrix();chargedDrops.setMatrixAt(i,chargeDummy.matrix);}chargedDrops.instanceMatrix.needsUpdate=true;}
  plantingRings.visible=seqActive&&state.event===13&&seq!.elapsed<4;
  const pressure=seqActive&&state.event===1?(seq!.elapsed<3?Math.min(1,seq!.elapsed/3)*4:seq!.elapsed<7?4:3.98):(state.pressure||4);
  hardware.pressureNeedle.rotation.z=-pressure/4*Math.PI*.65;
  pressureReadout.hidden=!(seqActive&&state.event===1&&settled);
  if(!pressureReadout.hidden){pressureReadout.textContent=pressure.toFixed(2)+' bar';project(pressureReadout,hardware.labels.pressure.getWorldPosition(new T.Vector3()),40);}
  sampleRay.visible=seqActive&&state.event===16&&seq!.elapsed>=1&&settled;
  if(sampleRay.visible){const origin=hardware.labels.leaf.getWorldPosition(new T.Vector3()),positions=rayGeometry.getAttribute('position') as T.BufferAttribute;positions.setXYZ(0,origin.x,origin.y,origin.z);positions.setXYZ(1,samplePosition.x,samplePosition.y,samplePosition.z);positions.needsUpdate=true;sampleRay.computeLineDistances();}
  scanUniforms.root.value=state.rootAnalysis&&analysisActive?1:0;scanUniforms.spectrum.value=state.spectrum&&analysisActive?1:0;
  scanUniforms.heat.value=state.heat&&analysisActive&&(!director.automatic||director.focus==='leaf')?1:0;
  const qualityMeasuring=state.eventKey==='quality'&&seqActive&&seq!.elapsed<((window as any).__AEROSENSE_RANKING_MODE__?4:3);
  rootMeasure.visible=state.rootAnalysis&&analysisActive;tuberMarker.visible=qualityMeasuring||state.event===23&&analysisActive&&!!state.sequence?.active&&spectral.qa.scanning;
  qualityReadout.hidden=!qualityMeasuring||!settled;if(!qualityReadout.hidden)project(qualityReadout,tuberTarget,55);
  mist.material.uniforms.uLevel.value*=state.rootAnalysis?.55:1;
  scanUniforms.y.value=state.rootAnalysis?(reduced.matches?1.02:1.48-Math.min(1,Math.max(0,((seq?.elapsed||0)-.6)/1.8))*1.14):(reduced.matches?1.96:1.73+(t%2.8)/2.8*.40);
  labels.leaf.textContent=state.heat?'叶温越限':'叶温采样';labels.leaf.classList.toggle('is-alert',state.heat);
  labels.root.classList.toggle('is-active',state.rootAnalysis);labels.spectrum.classList.toggle('is-active',state.spectrum);
  const focus=director.automatic?director.focus:'overview';
  labels.leaf.hidden=!settled||!['overview','leaf'].includes(focus);labels.root.hidden=!settled||!['overview','root'].includes(focus);
  labels.spectrum.hidden=!settled||!['overview','spectrum'].includes(focus);labels.fluid.hidden=!settled||focus!=='overview';
  depths.forEach(({el})=>el.hidden=focus!=='overview');sample.visible=sampleVerified&&settled&&['overview','leaf','spectrum'].includes(focus);
  updateLabels();
  // Scene/light updates above happen once. All colour and depth views below
  // reuse this frame's physical shadows; next frame refreshes moving shadows.
  if((window as any).__AEROSENSE_RANKING_MODE__)renderer.shadowMap.needsUpdate=true;
  if(state.event===25&&state.sequence?.active&&state.sequence.elapsed<18){
   const l=camera.left,r=camera.right,mid=(l+r)/2;
   camera.left=mid+(l-mid)*SCAN_VIEW_FRACTION;camera.right=mid+(r-mid)*SCAN_VIEW_FRACTION;camera.updateProjectionMatrix();
   renderer.setViewport(0,0,width*SCAN_VIEW_FRACTION,height);renderer.render(scene,camera);
   renderer.setViewport(0,0,width,height);camera.left=l;camera.right=r;camera.updateProjectionMatrix();
  }else renderer.render(scene,camera);
  const pressureMirror=mirrors.find(dest=>dest.hasAttribute('data-pressure-closeup'));
  if(pressureMirror){
   if(pressureCard!==pressureMirror){pressureCard=pressureMirror;pressureCardStart=now;}
   const elapsed=(now-pressureCardStart)/1000,value=(window as any).__AEROSENSE_RANKING_MODE__||reduced.matches?3.98:elapsed<2.5?4*(1-Math.pow(1-elapsed/2.5,3)):elapsed<5?4:3.98;
   hardware.pressureNeedle.rotation.z=-value/4*Math.PI*.65;
   const readout=pressureMirror.parentElement?.querySelector('.pressure-model-reading');if(readout)readout.textContent=value.toFixed(2)+' bar';
   const a=canvas.width/canvas.height,hh=Math.max(.72,1.38/a);
   pressureCamera.left=-hh*a;pressureCamera.right=hh*a;pressureCamera.top=hh;pressureCamera.bottom=-hh;pressureCamera.updateProjectionMatrix();
   const exposure=renderer.toneMappingExposure;renderer.toneMappingExposure=1.25;renderer.render(scene,pressureCamera);renderer.toneMappingExposure=exposure;
  }else{pressureCard=null;}
  if(spectralMirror){
   spectral.setResultVisible(state.event!==25);
   const destRect=spectralMirror.getBoundingClientRect(),a=Math.max(.1,destRect.width/Math.max(1,destRect.height));
   const point=spectral.anchors.conveyor;
   const hh=state.event===25?Math.max(.95,1.5/a):Math.max(.57,.62/a);
   spectralCamera.left=-hh*a;spectralCamera.right=hh*a;spectralCamera.top=hh;spectralCamera.bottom=-hh;
   spectralCamera.position.copy(point).add(new T.Vector3(state.event===25?.42:1,state.event===25?1.15:.45,7));spectralCamera.lookAt(point);spectralCamera.updateProjectionMatrix();
   // Match the evidence aspect without stretching the live B05 viewport.
   const size=renderer.getSize(new T.Vector2()),vw=Math.min(size.x,size.y*a),vh=vw/a,vx=(size.x-vw)/2,vy=(size.y-vh)/2;
   renderer.setViewport(vx,vy,vw,vh);renderer.render(scene,spectralCamera);
   const ctx=spectralMirror.getContext('2d')!,w=Math.max(1,Math.round(destRect.width*Math.min(devicePixelRatio,dpr))),h=Math.max(1,Math.round(destRect.height*Math.min(devicePixelRatio,dpr)));
   if(spectralMirror.width!==w||spectralMirror.height!==h){spectralMirror.width=w;spectralMirror.height=h;}
   const ratio=renderer.getPixelRatio();ctx.drawImage(canvas,vx*ratio,vy*ratio,vw*ratio,vh*ratio,0,0,w,h);
   spectral.setResultVisible(false);renderer.setViewport(0,0,size.x,size.y);renderer.render(scene,camera);
  }
  mirrors.filter(dest=>dest!==spectralMirror&&!dest.hasAttribute('data-harvest-confirmation')).forEach(dest=>{
   const rect=dest.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width*Math.min(devicePixelRatio,dpr))),h=Math.max(1,Math.round(rect.height*Math.min(devicePixelRatio,dpr)));
   if(dest.width!==w||dest.height!==h){dest.width=w;dest.height=h;}
   const ctx=dest.getContext('2d')!,blendWithCard=!!dest.closest('#eventLayer[data-card-key="ai-ops"] .ops-canopy');
   const sheet=dest.closest<HTMLElement>('.event-sheet');
   const background=blendWithCard&&sheet?getComputedStyle(sheet).backgroundColor:'#080b0b';
   const surface=backdrop.material.uniforms.surfaceColor.value,saved=surface.clone();
   try{
    if(blendWithCard){
     // The backdrop shader writes display RGB directly, without a tone-mapping transform.
     const color=new T.Color(background).convertLinearToSRGB();surface.set(color.r,color.g,color.b);renderer.render(scene,camera);
    }
    ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
    const scale=Math.min(w/canvas.width,h/canvas.height);
    ctx.drawImage(canvas,(w-canvas.width*scale)/2,(h-canvas.height*scale)/2,canvas.width*scale,canvas.height*scale);
    if(state.event===15&&state.sequence?.focus==='leaf'&&sampleVerified){
     const p=samplePosition.clone().project(camera),ox=(w-canvas.width*scale)/2,oy=(h-canvas.height*scale)/2;
     const x=ox+(p.x*.5+.5)*canvas.width*scale,y=oy+(-p.y*.5+.5)*canvas.height*scale;
     const unit=Math.max(1,w/850),radius=34*unit;
     ctx.save();ctx.strokeStyle='#9bc7ab';ctx.lineWidth=2*unit;ctx.beginPath();ctx.ellipse(x,y,radius,radius*.65,0,0,Math.PI*2);ctx.stroke();
     const lx=Math.min(w-190*unit,x+radius+26*unit),ly=Math.max(34*unit,y-50*unit);
     ctx.beginPath();ctx.moveTo(x+radius*.6,y-radius*.5);ctx.lineTo(lx,ly+8*unit);ctx.stroke();ctx.font=`600 ${22*unit}px "Microsoft YaHei", sans-serif`;
     ctx.fillStyle='#d7e7dc';ctx.fillText('第4展开叶',lx,ly);ctx.restore();
    }

   }finally{
    if(blendWithCard){surface.copy(saved);renderer.render(scene,camera);}
   }
  });
  for(const dest of mirrors.filter(dest=>dest.hasAttribute('data-harvest-confirmation'))){harvestConfirmation.render(dest,arm.inspectionCamera,tuberSets[harvestPlant].tubers[harvestIndex]);renderer.render(scene,camera);}
  if(cloudModels.renderBench(motionDt))renderer.render(scene,camera);
  const insetMode=state.sequence?.active?(state.event===24&&state.sequence.elapsed<12?'arm':state.event===23?'spectral':null):null;
  spectral.setResultVisible(insetMode==='spectral');
  const insetTarget=insetMode==='arm'&&arm.qa.carrying?new T.Vector3().fromArray(arm.qa.wrist):tuberTarget;
  visionInset.update(insetMode,insetMode==='spectral'?spectral.anchors.conveyor:insetTarget,arm.qa.phase,spectral.qa.falseColour,arm.qa.specimenRadius,arm.group.getObjectByName('gripped-original-tuber') as T.Mesh,arm.inspectionCamera);
  spectral.setResultVisible(false);
  if(insetMode)renderer.render(scene,camera);
  if(selfCheck)window.dispatchEvent(new CustomEvent('aerosense:equipment-frame'));
  if(++frames%15===0){
   const bounds=new T.Box3();rootMeshes.forEach(m=>bounds.union(new T.Box3().setFromObject(m)));
   canvas.dataset.qa=JSON.stringify({version:'10.7.9',event:state.event,stage:state.stageLabel,plants:3,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,mist:mistOn,mistMaxY:1.525,deckUnderside:1.59,rootMinY:bounds.min.y,rootMaxY:bounds.max.y,leafHit:sampleVerified,leafTarget:samplePosition.toArray(),light:state.light,uva:recipe.uva,ledIntensities:hardware.ledMats.map(m=>m.emissiveIntensity),rootAnalysis:state.rootAnalysis,spectrum:state.spectrum,mirrorCount:mirrors.length});
  }
 }
 let legacyPrepared=false,embeddedPrepared=false;
 const sceneWarmTarget=new T.WebGLRenderTarget(1,1);
 function preparePostharvest(){
  if(!alive||suspended||!(window as any).__AEROSENSE_RANKING_MODE__)return;
  const embedded=['potato','scanner','mist','dryer','cabinet','lamp','uvdetail','stockdetail'].every(name=>(cloudModels.qa as any)[name]!=='pending');
  if(embedded?embeddedPrepared:legacyPrepared)return;
  if(embedded)embeddedPrepared=true;else legacyPrepared=true;
  const previous=sorting.group.visible;sorting.group.visible=true;
  canvas.dataset.postharvestReady='preparing';
  try{
   // Match the sorting lights now, before the workflow reaches this equipment.
   // Compilation and texture upload do not advance the production timeline.
   const textures=new Set<T.Texture>();const collectTextures=(o:T.Object3D)=>{if(o instanceof T.Mesh){for(const material of Array.isArray(o.material)?o.material:[o.material])for(const value of Object.values(material))if(value instanceof T.Texture)textures.add(value);}};
   scene.traverseVisible(collectTextures);sorting.group.traverse(collectTextures);
   textures.forEach(texture=>renderer.initTexture(texture));
   // Compile one representative per shared material and mesh feature set.
   // Repeated root segments share these programs; compiling every segment stalls startup.
   const warm=new T.Group(),seen=new Set<string>();
   function addRepresentative(o:T.Object3D){
    const drawable=o as T.Mesh;if(!(drawable as any).isMesh&&!(drawable as any).isPoints&&!(drawable as any).isLine&&!(drawable as any).isSprite)return;
    const materials=Array.isArray(drawable.material)?drawable.material:[drawable.material],geometry=drawable.geometry;
    const key=o.type+'|'+materials.map(m=>m.uuid).join(',')+'|'+Object.keys(geometry?.attributes||{}).sort().join(',')+'|'+Object.entries(geometry?.morphAttributes||{}).map(([k,v])=>k+v.length).join(',');
    if(seen.has(key))return;seen.add(key);warm.add(o.clone(false));
   }
   scene.traverseVisible(addRepresentative);sorting.group.traverse(addRepresentative);
   canvas.dataset.postharvestPrograms=String(seen.size);
   renderer.compileAsync(warm,camera,scene).then(()=>{
    if(!alive)return;
    const target=renderer.getRenderTarget(),viewport=renderer.getViewport(new T.Vector4()),visible=sorting.group.visible;
    try{
     sorting.group.visible=true;renderer.setRenderTarget(sceneWarmTarget);renderer.setViewport(0,0,1,1);
     renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);
    }finally{sorting.group.visible=visible;renderer.setRenderTarget(target);renderer.setViewport(viewport);}
    canvas.dataset.postharvestReady='ready';if(embedded)canvas.dataset.scenePrepared='ready';
   }).catch(()=>{if(embedded)embeddedPrepared=false;else legacyPrepared=false;if(alive){canvas.dataset.postharvestReady='deferred';if(embedded)canvas.dataset.scenePrepared='deferred';}});
  }catch{if(embedded)embeddedPrepared=false;else legacyPrepared=false;canvas.dataset.postharvestReady='deferred';if(embedded)canvas.dataset.scenePrepared='deferred';}
  finally{sorting.group.visible=previous;}
 }
 requestAnimationFrame(frame);
 cloudModels.prepare(()=>{if(alive&&currentStage>=0&&preferredSpecimen()!==appliedSpecimen)applyStage(currentStage);const asset=cloudModels.getSpecimen('distant');if(asset)sorting.setSpecimenAsset(asset);const scanner=cloudModels.getIndustrial('scanner');if(scanner)sorting.installScanner(scanner);for(const name of ['mist','dryer'] as const){const module=cloudModels.getIndustrial(name);if(module)sorting.installPostprocess(name,module);}const cabinet=cloudModels.getIndustrial('cabinet');if(cabinet)hardware.installStatic(cabinet);const lamp=cloudModels.getIndustrial('lamp');if(lamp)hardware.installLamp(lamp);for(const name of ['uvdetail','stockdetail'] as const){const detail=cloudModels.getIndustrial(name);if(detail)fluid.installStaticDetail(name,detail);}refreshEquipmentShadows();preparePostharvest();});
 if((window as any).__AEROSENSE_RANKING_MODE__){if('requestIdleCallback' in window)(window as any).requestIdleCallback(preparePostharvest,{timeout:2000});else setTimeout(preparePostharvest,120);}
 function getDetectionRegion(){
  const box=rootMeasure.box.clone().expandByScalar(.035),points=[] as T.Vector3[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new T.Vector3(x,y,z).project(camera));
  const x=Math.max(0,Math.min(...points.map(p=>(p.x+1)/2))),y=Math.max(0,Math.min(...points.map(p=>(1-p.y)/2)));
  return {x,y,w:Math.min(1,Math.max(...points.map(p=>(p.x+1)/2)))-x,h:Math.min(1,Math.max(...points.map(p=>(1-p.y)/2)))-y};
 }
 return {version:'10.7.9',getDetectionRegion,getState:()=>lastState,getPostharvestState:()=>sorting.qa,getPostharvestPresentationState:()=>({coverage:scanCoverage(camera,sorting.getScanBounds((lastState.sequence?.elapsed||0)>=13?'sort':'scan',lastState.sequence?.elapsed||0)),scanner:scanCoverage(camera,sorting.getScannerBounds()),knife:sorting.getKnifeVisibility(camera)}),getHardwareState:()=>hardware.qa,getCloudModelState:()=>({...cloudModels.qa,rootAssets:{visible:tuberSets.flatMap(s=>s.tubers).filter(m=>m.visible).length,uniqueGeometry:new Set(tuberSets.flatMap(s=>s.tubers).filter(m=>m.visible).map(m=>m.geometry.uuid)).size,uniqueMaterial:new Set(tuberSets.flatMap(s=>s.tubers).filter(m=>m.visible).map(m=>(m.material as T.Material).uuid)).size,levels:tuberSets.flatMap(s=>s.tubers).filter(m=>m.visible).reduce((a,m)=>{const k=m.userData.cloudAsset||'legacy';a[k]=(a[k]||0)+1;return a;},{} as Record<string,number>)},selected:tuberSets[harvestPlant].tubers[harvestIndex]?.userData.cloudAsset||'legacy',memory:{...renderer.info.memory}}),getSpectralState:()=>spectral.qa,getInspectionState:()=>{const sensor=arm.inspectionCamera;sensor.updateWorldMatrix(true,false);const origin=sensor.getWorldPosition(new T.Vector3()),direction=sensor.getWorldDirection(new T.Vector3()),ray=new T.Raycaster(origin,direction,.02,2);ray.layers.mask=sensor.layers.mask;ray.camera=sensor;const objects:T.Mesh[]=[];scene.traverse(o=>{if(o instanceof T.Mesh)objects.push(o);});const specimen=arm.qa.carrying?arm.group.getObjectByName('gripped-original-tuber') as T.Mesh:tuberSets[harvestPlant].tubers[harvestIndex],span=specimenSpan(specimen,camera);return {targetWidthPixels:span?(span.right.x-span.left.x)*host.getBoundingClientRect().width/2:null,origin:origin.toArray(),direction:direction.toArray(),hits:ray.intersectObjects(objects,false).filter(h=>{for(let o:T.Object3D|null=h.object;o;o=o.parent)if(!o.visible)return false;return true;}).slice(0,5).map(h=>({name:h.object.name||h.object.parent?.name,geometry:(h.object as T.Mesh).geometry?.type,distance:h.distance,point:h.point.toArray()}))};},getCameraState:()=>({automatic:director.automatic,focus:director.focus,phase:director.phase,moving:director.moving,position:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom,leafTarget:samplePosition.toArray(),tuberTarget:tuberTarget.toArray(),rootMeasure:rootMeasure.visible,tuberMarker:tuberMarker.visible}),resetCamera,dispose(){alive=false;document.removeEventListener('visibilitychange',resetFrameDelta);cloudModels.dispose();visionInset.dispose();harvestConfirmation.dispose();spectral.dispose();director.dispose();controls.dispose();equipmentLighting?.dispose();sceneWarmTarget.dispose();key.shadow.dispose();top.shadow.dispose();renderer.dispose();root.remove();host.classList.remove('has-3d');}};
}
