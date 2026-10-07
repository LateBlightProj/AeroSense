/** Reference-led illustrative calibration, not an automatic mechanism or lab SOP.
 * Existing __AEROSENSE_PREPARATION__.state().ise remains the only state/clock owner.
 */
const PHASES=['low','high','slope','save'];
const STAGE_SECONDS=[0,1.4,2.8,4,5];
const HOME={A:[-.212,0,.003],B:[-.132,0,.014],C:[.116,0,.038],D:[.197,0,.047]};
const TARGETS=[[-.041,.024,.003],[.041,.024,.003]];
const clamp01=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const ease=v=>{v=clamp01(v);return v*v*(3-2*v);};
export function phaseAtSeconds(seconds){
 const t=Math.max(0,Math.min(5,Number.isFinite(seconds)?seconds:0));
 let phase=STAGE_SECONDS.findIndex((end,i)=>i>0&&t<end)-1;if(phase<0)phase=3;
 return {phase,progress:(t-STAGE_SECONDS[phase])/(STAGE_SECONDS[phase+1]-STAGE_SECONDS[phase])};
}
export function visualPose(phase,progress,reducedMotion=false){
 const i=typeof phase==='number'?phase:PHASES.indexOf(phase);
 if(!Number.isInteger(i)||i<0||i>3)throw new RangeError('Unknown ISE phase');
 const p=clamp01(progress);const high=i>1||(i===1&&p>=.4);
 let lift=i===0?.11-.09*ease(p/.32):i===1?(p<.2?.02+.09*ease(p/.2):p<.55?.11:.11-.09*ease((p-.55)/.3)):.02;
 const collecting=(i===0&&p>=.32)||(i===1&&p>=.85);
 const overall=(STAGE_SECONDS[i]+p*(STAGE_SECONDS[i+1]-STAGE_SECONDS[i]))/5;
 const cups=Object.fromEntries(Object.entries(HOME).map(([k,v])=>[k,[...v]]));
 (high?['C','D']:['A','B']).forEach((key,j)=>cups[key]=[...TARGETS[j]]);
 let transitionOpacity=i===1&&p>.30&&p<.50?Math.abs(p-.4)/.1:1;
 if(reducedMotion){lift=.02;transitionOpacity=1;}
 return {phase:i,progress:p,lift,cups,collecting,transitionOpacity,
  yaw:reducedMotion?0:(-3+6*ease(overall))*Math.PI/180,
  ringY:collecting?.071:.252+lift,ringScale:reducedMotion?1.5:1.55+.25*Math.sin(p*Math.PI*4),
  ringVisible:collecting||i>=2,opacity:.75,emission:.45};
}
export function createISECalibrationMotion(root,{reducedMotion=false}={}){
 const find=name=>{const o=root.getObjectByName(name);if(!o)throw new Error('Missing ISE node: '+name);return o;};
 const pivot=find('ISE_Presentation_Pivot');
 const probes=['K','NO3'].map(s=>find('ISE_Probe_'+s));
 const cables=['K','NO3'].map(s=>find('ISE_Cable_'+s));
 const rings=['K','NO3'].map(s=>find('ISE_Focus_'+s));
 const cups=Object.fromEntries('ABCD'.split('').map(s=>[s,find('ISE_Beaker_'+s)]));
 const initialRotation=pivot.rotation.clone();
 const meshes=[];
 rings.forEach(r=>r.traverse(o=>{if(!o.isMesh)return;o.material=o.material.clone();o.material.transparent=true;o.material.depthWrite=false;o.renderOrder=30;meshes.push(o);}));
 let disposed=false;
 function setPhase(phase,progress=0){
  if(disposed)return;
  const p=visualPose(phase,progress,reducedMotion);
  pivot.rotation.set(initialRotation.x,p.yaw,initialRotation.z);
  probes.forEach(o=>o.position.y=p.lift);
  cables.forEach(o=>{const index=o.morphTargetDictionary?.ProbeLift;if(index!==undefined)o.morphTargetInfluences[index]=p.lift/.11;});
  Object.entries(cups).forEach(([name,o])=>o.position.set(...p.cups[name]));
  rings.forEach(o=>{o.position.y=p.ringY;o.scale.setScalar(p.ringScale);o.visible=p.ringVisible;});
  meshes.forEach(o=>{o.material.opacity=p.opacity;o.material.emissiveIntensity=p.emission;});
  return p;
 }
 function setState(state){if(!state||!Number.isFinite(state.elapsed))return;const p=phaseAtSeconds(state.complete?5:state.elapsed);return setPhase(p.phase,p.progress);}
 function reset(){if(disposed)return;setPhase(0,0);rings.forEach(o=>o.visible=false);}
 function dispose(){if(disposed)return;meshes.forEach(o=>o.material.dispose());disposed=true;}
 reset();return {setPhase,setState,reset,dispose};
}

/** Scene-local lighting for a dedicated modal canvas, no HDR dependency.
 * Do not install this into the shared whole-machine scene.
 */
export function installISELighting(THREE, scene) {
  const rig = new THREE.Group(); rig.name = 'ISE_Modal_Lighting';
  const ambient = new THREE.HemisphereLight(0xe6f2f5, 0x263331, .7);rig.add(ambient);
  for (const [name,position,color,intensity] of [
    ['ISE_Key',[-3,2.15,4],0xedf7ff,2.625],
    ['ISE_Fill',[3,-.1,2],0xcfe6f2,.425],
    ['ISE_Rim',[-2,1,-2],0xd9f0ff,1.9375],
  ]) {
    const light = new THREE.DirectionalLight(color,intensity);light.name=name;
    light.position.set(...position);light.target.position.set(.02,.15,0);
    rig.add(light,light.target);
  }
  scene.add(rig);
  return () => {scene.remove(rig);rig.traverse(o=>o.dispose?.());};
}

export function prepareISEMaterials(THREE, root) {
  root.traverse(o => {
    if(!o.isMesh)return;
    o.castShadow=false;o.receiveShadow=false;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    materials.forEach(m => {
      if(m.transparent || m.opacity < 1){m.depthWrite=false;m.side=THREE.DoubleSide;}
    });
    if(/Glass_Wall/.test(o.name))o.renderOrder=20;
    else if(/Liquid|Meniscus/.test(o.name))o.renderOrder=10;
    else if(/Rolled_Lip|Base_Edge|Etch/.test(o.name))o.renderOrder=25;
  });
}

export function createISECamera(THREE, aspect = 4/3) {
  const halfHeight=.255;
  const camera=new THREE.OrthographicCamera(-halfHeight*aspect,halfHeight*aspect,halfHeight,-halfHeight,.01,20);
  camera.position.set(.57,.54,.95);camera.lookAt(.025,.205,-.008);camera.updateProjectionMatrix();return camera;
}

export {PHASES,STAGE_SECONDS};
