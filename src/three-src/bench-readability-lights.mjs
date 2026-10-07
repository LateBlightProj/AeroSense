// Finite-light INTENT bridge, not a numerical Blender-power conversion.
// Three.js r180 RectAreaLight supports PBR reflections, but casts NO shadows.
const installed = new WeakMap();
export const INITIAL_READABILITY_VALUES = Object.freeze({taskNits:8, rightFillNits:2.2, rimStrength:.45});
export function installBenchReadabilityLights(THREE, {model, initRectAreaUniforms, values={}}) {
  if (installed.has(model)) return installed.get(model);
  if (!THREE.UniformsLib.LTC_FLOAT_1 || !THREE.UniformsLib.LTC_HALF_1) {
    if (typeof initRectAreaUniforms !== 'function') throw new Error('Provide RectAreaLightUniformsLib.init callback');
    initRectAreaUniforms(); // Guarded; globally shared LUTs are not disposed here.
  }
  const group=new THREE.Group(); group.name='Bench_Readability_Rig'; model.add(group);
  const color=rgb=>new THREE.Color().setRGB(...rgb,THREE.LinearSRGBColorSpace);
  function area(name,rgb,width,height,position,target) {
    const light=new THREE.RectAreaLight(color(rgb),0,width,height); light.name=name;
    light.position.fromArray(position); group.add(light); group.updateWorldMatrix(true,true);
    light.lookAt(group.localToWorld(new THREE.Vector3().fromArray(target))); light.visible=false; return light;
  }
  const task=area('Bench_Local_Worklight',[.90,.96,1],1.10,.035,[0,1.515,.26],[0,.96,-.18]);
  const right=area('Bench_Finite_Right_Fill',[.87,.94,1],.70,2.20,[2.4,1.05,1.8],[0,1.05,0]);
  const rim=new THREE.DirectionalLight(color([.85,.94,1]),0); rim.name='Bench_Controlled_Rim';
  rim.position.set(-2,2.05,-2); rim.target.position.set(0,1.05,0); rim.castShadow=false; rim.visible=false; group.add(rim,rim.target);
  let state={task:false,rightFill:false,rim:false,...INITIAL_READABILITY_VALUES,...values},disposed=false;
  function set(next={}) {
    if(disposed)throw new Error('Readability rig disposed');
    const candidate={...state,...next};
    for(const k of ['taskNits','rightFillNits','rimStrength'])if(!Number.isFinite(candidate[k])||candidate[k]<0)throw new Error('Invalid light strength: '+k);
    state=candidate; task.intensity=state.taskNits;right.intensity=state.rightFillNits;rim.intensity=state.rimStrength;
    task.visible=Boolean(state.task);right.visible=Boolean(state.rightFill);rim.visible=Boolean(state.rim);
  }
  const api={
    set,
    inspect(){return{...state,areaShadows:false,changesMaterials:false,changesRenderer:false,localUnits:'metres; asset root scale 1',gpuCalibrated:false};},
    dispose(){if(disposed)return;group.removeFromParent();group.clear();installed.delete(model);disposed=true;}
  };
  try{set();installed.set(model,api);return api;}catch(error){api.dispose();throw error;}
}
