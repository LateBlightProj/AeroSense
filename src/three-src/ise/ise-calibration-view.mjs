import {createISECalibrationMotion,installISELighting,prepareISEMaterials,createISECamera} from './ise-calibration-motion.mjs';

/** Call with the existing first-column image after renderEventVisual runs.
 * Does not call preparation cancel/skip/sync, does not own or pause its clock.
 * The original renderer must call returned dispose() when replacing this card.
 */
export function mountISECalibrationView({THREE,GLTFLoader,image,modelUrl,
  readState=()=>window.__AEROSENSE_PREPARATION__?.state().ise,
  isVisible=()=>document.getElementById('eventLayer')?.getAttribute('aria-hidden')!=='true',
  reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  maxPixelRatio=2,
}) {
  if(!image?.parentElement)throw new Error('ISE equipment image is not mounted');
  const originalStyle=image.getAttribute('style');
  const host=document.createElement('div');host.className='ise-three-equipment';
  host.style.cssText='position:relative;min-width:0;min-height:0;width:100%;height:100%;overflow:hidden';
  image.replaceWith(host);host.append(image);
  image.style.cssText='width:100%;height:100%;object-fit:contain;display:block';
  let renderer,scene,camera,motion,unlight,observer,removalObserver,raf=0,dead=false,loaded=false;
  const disposeResources=()=>{
    motion?.dispose();unlight?.();
    scene?.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});
    renderer?.dispose();renderer?.forceContextLoss?.();renderer?.domElement.remove();
  };
  const dispose=()=>{if(dead)return;dead=true;cancelAnimationFrame(raf);observer?.disconnect();removalObserver?.disconnect();disposeResources();if(originalStyle===null)image.removeAttribute('style');else image.setAttribute('style',originalStyle);if(host.isConnected){host.replaceWith(image);}};
  const removalRoot=document.getElementById('eventVisual')||document.documentElement;
  if(typeof MutationObserver!=='undefined'&&removalRoot){removalObserver=new MutationObserver(()=>{if(!host.isConnected)dispose();});removalObserver.observe(removalRoot,{childList:true,subtree:true});}
  const ready=(async()=>{try {
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,maxPixelRatio));
    renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
    renderer.domElement.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;pointer-events:none';
    renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','ISE双电极浸入标准液的三维校准示意');
    host.append(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost',()=>{loaded=false;dispose();},{once:true});
    scene=new THREE.Scene();camera=createISECamera(THREE,1);unlight=installISELighting(THREE,scene);
    function resize(){
      if(dead)return;const box=host.getBoundingClientRect();if(box.width<1||box.height<1)return;
      renderer.setSize(box.width,box.height,false);
      // Preserve full equipment width in the original narrow first column.
      const aspect=box.width/box.height,halfHeight=Math.max(.255,.34/aspect);
      camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
    }
    observer=new ResizeObserver(()=>{try{resize();}catch(error){dispose();console.warn('ISE resize failed; original image retained',error);}});observer.observe(host);resize();
    const gltf=await new GLTFLoader().loadAsync(modelUrl);
    if(dead||!host.isConnected){gltf.scene.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});dispose();return {dispose,ready:false};}
    scene.add(gltf.scene);prepareISEMaterials(THREE,gltf.scene);
    motion=createISECalibrationMotion(gltf.scene,{reducedMotion});loaded=true;
    function draw(){
      if(dead)return;if(!host.isConnected){dispose();return;}
      try {if(loaded&&isVisible()&&!document.hidden){
        const state=readState();const pose=motion.setState(state);
        if(pose){renderer.domElement.style.opacity=String(pose.transitionOpacity);image.style.visibility='hidden';host.dataset.iseVisualPhase=String(pose.phase);renderer.render(scene,camera);}
      }
      raf=requestAnimationFrame(draw);
      } catch(error) {dispose();console.warn('ISE rendering failed; original image retained',error);}
    }
    draw();return {dispose,ready:!dead&&loaded,host};
  } catch(error) {
    dispose();console.warn('ISE model unavailable; original image retained',error);
    return {dispose,ready:false,error};
  }})();
  return {dispose,ready,host};
}
