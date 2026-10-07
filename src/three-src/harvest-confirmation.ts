import * as T from 'three';
import {createDepthPass} from './depth-view';
// Share the harvesting scene and target; retain the existing scenario's 31 mm.
export function specimenSpan(specimen:T.Mesh,camera:T.Camera){
 const positions=specimen.geometry.getAttribute('position');if(!positions?.count)return null;
 specimen.updateWorldMatrix(true,false);camera.updateMatrixWorld(true);
 let left=new T.Vector3(Infinity,0,0),right=new T.Vector3(-Infinity,0,0);
 for(let i=0;i<positions.count;i++){
  const p=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(specimen.matrixWorld).project(camera);
  if(p.z < -1||p.z>1)continue;
  if(p.x<left.x)left=p.clone();if(p.x>right.x)right=p.clone();
 }
 return Number.isFinite(left.x)&&right.x>left.x?{left,right}:null;
}
export function createHarvestConfirmation(renderer:T.WebGLRenderer,scene:T.Scene){
 const depth=createDepthPass(),camera=new T.PerspectiveCamera();
 function render(destination:HTMLCanvasElement,sensor:T.PerspectiveCamera,specimen:T.Mesh){
  const rect=destination.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
  const ratio=Math.min(devicePixelRatio,2),w=Math.round(rect.width*ratio),h=Math.round(rect.height*ratio);
  if(destination.width!==w||destination.height!==h){destination.width=w;destination.height=h;}
  sensor.updateWorldMatrix(true,false);sensor.getWorldPosition(camera.position);sensor.getWorldQuaternion(camera.quaternion);
  camera.near=sensor.near;camera.far=sensor.far;camera.fov=sensor.fov;camera.aspect=rect.width/rect.height;camera.layers.mask=sensor.layers.mask;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const size=renderer.getSize(new T.Vector2()),previous=renderer.getViewport(new T.Vector4()),a=camera.aspect;
  const vw=Math.min(size.x,size.y*a),vh=vw/a,vx=(size.x-vw)/2,vy=(size.y-vh)/2,ctx=destination.getContext('2d')!;
  try{
   renderer.setViewport(vx,vy,vw,vh);depth.render(renderer,scene,camera);
   const dpr=renderer.getPixelRatio();ctx.drawImage(renderer.domElement,vx*dpr,vy*dpr,vw*dpr,vh*dpr,0,0,w,h);
  }finally{renderer.setViewport(previous);}
  const span=specimenSpan(specimen,camera);if(!span)return;
  const screen=(p:T.Vector3)=>({x:(p.x+1)*w/2,y:(1-p.y)*h/2}),l=screen(span.left),r=screen(span.right);
  const font=20*ratio,lineY=Math.min(h-font*2,Math.max(l.y,r.y)+28*ratio);
  ctx.strokeStyle='#9bd6b7';ctx.fillStyle='#dcece3';ctx.lineWidth=1.5*ratio;
  ctx.beginPath();for(const p of [l,r]){ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,lineY+6*ratio);}ctx.moveTo(l.x,lineY);ctx.lineTo(r.x,lineY);ctx.stroke();
  for(const p of [l,r]){ctx.beginPath();ctx.arc(p.x,p.y,3*ratio,0,Math.PI*2);ctx.fill();}
  const text='直径 31 mm';ctx.font=`600 ${font}px -apple-system, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  const tw=ctx.measureText(text).width,x=Math.max(tw/2+12*ratio,Math.min(w-tw/2-12*ratio,(l.x+r.x)/2)),y=lineY+22*ratio;
  ctx.fillStyle='#080d0b';ctx.fillRect(x-tw/2-8*ratio,y-font*.7,tw+16*ratio,font*1.4);ctx.fillStyle='#dcece3';ctx.fillText(text,x,y);
 }
 return {render,dispose(){depth.dispose();}};
}
