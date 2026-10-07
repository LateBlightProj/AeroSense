import * as T from 'three';
import {createDepthPass} from './depth-view';
export function createVisionInset(root:HTMLElement,renderer:T.WebGLRenderer,scene:T.Scene){
 const panel=document.createElement('section');panel.className='vision-inset';panel.hidden=true;
 const title=document.createElement('div'),canvas=document.createElement('canvas'),note=document.createElement('div');
 title.className='vision-inset-title';note.className='vision-inset-note';panel.append(title,canvas,note);root.append(panel);
 const legend=document.createElement('div');legend.className='vision-segment-legend';legend.innerHTML='<span>0.08—0.70 m</span><span>对象边界</span><span>目标</span>';panel.insertBefore(legend,note);
 const spectralCamera=new T.OrthographicCamera(-1,1,.7,-.7,.01,30);spectralCamera.layers.enable(2);
 const wristCamera=new T.PerspectiveCamera(78,1.5,.005,2);wristCamera.layers.enable(1);wristCamera.layers.enable(2);
 const depth=createDepthPass();
 const extrema=new WeakMap<T.BufferGeometry,{left:T.Vector3;right:T.Vector3;cut:T.Vector3}>();
 // Transform only: target geometry supplies markers, but the entire scene supplies depth.
 const mask=new T.Mesh(new T.BufferGeometry());let initialGeometry=true;
 function update(mode:'arm'|'spectral'|null,target:T.Vector3,phase:string,result:boolean,radius=.04,specimen?:T.Mesh,sensor?:T.PerspectiveCamera){
  panel.hidden=!mode;if(!mode)return;
  legend.hidden=mode!=='arm';canvas.setAttribute('aria-label',mode==='arm'?'机械臂视角：深度明暗叠加根系、目标薯块与夹爪分割':'光谱伪色');
  title.hidden=false;title.textContent=mode==='spectral'?'光谱伪色':'深度 · 分割';
  note.textContent=mode==='arm'?phase:result?'干物质估算值：22.5% · 400–1000 nm → 特征提取 → PLS回归分析':'400–1000 nm → 特征提取 → 伪色合成';
  const rect=canvas.getBoundingClientRect(),a=rect.width/Math.max(rect.height,1);
  const camera=mode==='arm'?wristCamera:spectralCamera;
  if(mode==='arm'){
   if(!sensor){panel.hidden=true;return;}
   sensor.updateWorldMatrix(true,false);
   sensor.getWorldPosition(wristCamera.position);sensor.getWorldQuaternion(wristCamera.quaternion);
   wristCamera.aspect=a;wristCamera.fov=sensor.fov;wristCamera.updateProjectionMatrix();
  }else{
   spectralCamera.left=-.60*a;spectralCamera.right=.60*a;spectralCamera.top=.60;spectralCamera.bottom=-.60;
   spectralCamera.position.copy(target).add(new T.Vector3(.35,.18,4));spectralCamera.lookAt(target);spectralCamera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld(true);
  const size=renderer.getSize(new T.Vector2()),vw=Math.min(size.x,size.y*a),vh=vw/a,vx=(size.x-vw)/2,vy=(size.y-vh)/2;
  if(mode==='arm'&&specimen){
   if(initialGeometry){mask.geometry.dispose();initialGeometry=false;}
   mask.geometry=specimen.geometry;mask.position.copy(target);mask.quaternion.copy(specimen.quaternion);mask.scale.copy(specimen.scale);mask.updateMatrixWorld(true);
  }
  renderer.setViewport(vx,vy,vw,vh);if(mode==='arm')depth.render(renderer,scene,camera);else renderer.render(scene,camera);
  const pixelRatio=Math.min(devicePixelRatio,renderer.getPixelRatio()),w=Math.max(1,Math.round(rect.width*pixelRatio)),h=Math.max(1,Math.round(rect.height*pixelRatio));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const ctx=canvas.getContext('2d')!,ratio=renderer.getPixelRatio();ctx.drawImage(renderer.domElement,vx*ratio,vy*ratio,vw*ratio,vh*ratio,0,0,w,h);
  if(mode==='arm'){
   const screen=(p:T.Vector3)=>{p.applyMatrix4(mask.matrixWorld).project(camera);return [(p.x+1)*w/2,(1-p.y)*h/2];};
   const vertices=mask.geometry.getAttribute('position');
   if(vertices){
    // Surface extrema come from this specimen, rather than a generic circle.
    let bounds=extrema.get(mask.geometry);
    if(!bounds){const left=new T.Vector3(Infinity,0,0),right=new T.Vector3(-Infinity,0,0),cut=new T.Vector3(0,-Infinity,0),point=new T.Vector3();for(let i=0;i<vertices.count;i++){point.fromBufferAttribute(vertices,i);if(point.x<left.x)left.copy(point);if(point.x>right.x)right.copy(point);if(point.y>cut.y)cut.copy(point);}bounds={left,right,cut};extrema.set(mask.geometry,bounds);}
    // Instance contours now come from the depth-tested pixel IDs, never a full hull.
    const {left,right,cut}=bounds;
    const [cx,cy]=screen(new T.Vector3());ctx.strokeStyle='#c4e2d3';ctx.lineWidth=1.5*devicePixelRatio;ctx.beginPath();ctx.moveTo(cx-5,cy);ctx.lineTo(cx+5,cy);ctx.moveTo(cx,cy-5);ctx.lineTo(cx,cy+5);ctx.stroke();
    const gripping=phase.includes('夹持')||phase.includes('旋')||phase.includes('切离');
    if(gripping){const l=screen(left),r=screen(right);ctx.setLineDash([4*devicePixelRatio,4*devicePixelRatio]);ctx.beginPath();ctx.moveTo(...l as [number,number]);ctx.lineTo(...r as [number,number]);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#d3eee0';for(const [x,y] of [l,r])ctx.fillRect(x-3*devicePixelRatio,y-3*devicePixelRatio,6*devicePixelRatio,6*devicePixelRatio);}
    if(phase.includes('切离')){const [x,y]=screen(cut);ctx.strokeStyle='#e0c99b';ctx.beginPath();ctx.moveTo(x-8*devicePixelRatio,y);ctx.lineTo(x+8*devicePixelRatio,y);ctx.stroke();}
   }
  }else{
   const g=ctx.createLinearGradient(w*.12,0,w*.88,0);g.addColorStop(0,'#193d94');g.addColorStop(.33,'#0bb0ad');g.addColorStop(.72,'#d1e063');g.addColorStop(1,'#f77a30');ctx.fillStyle=g;ctx.fillRect(w*.12,h*.93,w*.76,3*devicePixelRatio);
  }
  renderer.setViewport(0,0,size.x,size.y);
 }
 return {update,dispose(){depth.dispose();if(initialGeometry)mask.geometry.dispose();(mask.material as T.Material).dispose();panel.remove();}};
}
