import * as T from 'three';
export const SCAN_VIEW_FRACTION=.65;
const LINER_FIRST=44,LINER_TRIANGLES=108;
// The provided two assemblies share a frozen rear-liner topology. Only that
// rectangle gets a new finish; stainless fasteners and knife faces keep theirs.
export function finishRearLiner(asset:T.Group,name:'mist'|'dryer'){
 const dedicated=asset.getObjectByName('Rear_Liner_Cutaway');
 if(dedicated){
  dedicated.visible=true;const bounds=new T.Box3().setFromObject(dedicated),materials=new Set<T.Material>();let triangles=0;
  dedicated.traverse(o=>{if(o instanceof T.Mesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  if(triangles!==108)throw Error('Dedicated rear liner contract mismatch');
  asset.userData.rearLiner={source:'dedicated-embedded',triangles,min:bounds.min.toArray(),max:bounds.max.toArray(),materials:[...materials].map(m=>m.name)};return;
 }

 const root=asset.getObjectByName(name==='mist'?'AeroSense_MistModule':'AeroSense_ColdDryerModule')!;
 const batch=root.getObjectByName(root.name+'__satin_stainless') as T.Mesh;
 if(!batch?.geometry.index||Array.isArray(batch.material))throw Error('Rear-liner batch contract mismatch');
 asset.updateWorldMatrix(true,true);const relative=new T.Matrix4().copy(root.matrixWorld).invert().multiply(batch.matrixWorld),g=batch.geometry,index=g.index!,pos=g.attributes.position,bounds=new T.Box3();
 for(let i=LINER_FIRST*3;i<(LINER_FIRST+LINER_TRIANGLES)*3;i++)bounds.expandByPoint(new T.Vector3().fromBufferAttribute(pos,index.getX(i)).applyMatrix4(relative));
 const expected=new T.Box3(new T.Vector3(-.337,-.189,-.239),new T.Vector3(.337,.131,-.237));
 if(bounds.min.distanceTo(expected.min)>1e-5||bounds.max.distanceTo(expected.max)>1e-5)throw Error('Rear-liner triangle bounds mismatch');
 const original=batch.material as T.MeshStandardMaterial,liner=original.clone();liner.name='AS | inspection_rear_liner';liner.color.setHex(0x17272a);liner.metalness=.35;liner.roughness=.62;
 const first=LINER_FIRST*3,count=LINER_TRIANGLES*3;g.clearGroups();g.addGroup(0,first,0);g.addGroup(first,count,1);g.addGroup(first+count,index.count-first-count,0);batch.material=[original,liner];
 asset.userData.rearLiner={triangles:LINER_TRIANGLES,min:bounds.min.toArray(),max:bounds.max.toArray(),color:liner.color.getHexString(),groups:g.groups.map(v=>({...v}))};
}
export function visibleBounds(root:T.Object3D){
 const bounds=new T.Box3();root.updateWorldMatrix(true,true);
 root.traverse(o=>{if(!(o instanceof T.Mesh))return;for(let p:T.Object3D|null=o;p;p=p.parent){if(!p.visible)return;if(p===root)break;}
  if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld));
 });return bounds;
}
export function fitScanZoom(camera:T.OrthographicCamera,position:T.Vector3,target:T.Vector3,bounds:T.Box3){
 const probe=camera.clone();probe.position.copy(position);probe.lookAt(target);probe.zoom=1;probe.left*=SCAN_VIEW_FRACTION;probe.right*=SCAN_VIEW_FRACTION;probe.updateProjectionMatrix();probe.updateMatrixWorld(true);
 let x=0,y=0;
 for(const a of [bounds.min.x,bounds.max.x])for(const b of [bounds.min.y,bounds.max.y])for(const c of [bounds.min.z,bounds.max.z]){const p=new T.Vector3(a,b,c).project(probe);x=Math.max(x,Math.abs(p.x));y=Math.max(y,Math.abs(p.y));}
 return Math.min(.92/x,.86/y,1.65);
}
export function scanCoverage(camera:T.OrthographicCamera,box:T.Box3){
 const probe=camera.clone();probe.left*=SCAN_VIEW_FRACTION;probe.right*=SCAN_VIEW_FRACTION;probe.updateProjectionMatrix();probe.updateMatrixWorld(true);const points:T.Vector3[]=[];
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new T.Vector3(x,y,z).project(probe));
 return {left:Math.min(...points.map(p=>(p.x+1)/2*SCAN_VIEW_FRACTION)),right:Math.max(...points.map(p=>(p.x+1)/2*SCAN_VIEW_FRACTION)),top:Math.min(...points.map(p=>(1-p.y)/2)),bottom:Math.max(...points.map(p=>(1-p.y)/2)),fraction:SCAN_VIEW_FRACTION};
}
export function knifeVisibility(root:T.Group,camera:T.Camera){
 const knife=root.getObjectByName('Dryer_AirKnife');if(!knife)return null;root.updateWorldMatrix(true,true);camera.updateMatrixWorld(true);
 const meshes:T.Mesh[]=[];root.traverse(o=>{if(!(o instanceof T.Mesh))return;for(let p:T.Object3D|null=o;p;p=p.parent)if(!p.visible)return;meshes.push(o);});
 const origin=camera.getWorldPosition(new T.Vector3()),ray=new T.Raycaster(),samples:{visible:boolean;blocker:string|null}[]=[];
 knife.traverse(o=>{if(!(o instanceof T.Mesh))return;const g=o.geometry,ix=g.index,p=g.attributes.position,count=ix?.count||p.count;
 for(let i=0;i<count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i):i).applyMatrix4(o.matrixWorld),b=new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+1):i+1).applyMatrix4(o.matrixWorld),c=new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+2):i+2).applyMatrix4(o.matrixWorld),center=a.clone().add(b).add(c).multiplyScalar(1/3),normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize(),view=origin.clone().sub(center).normalize();
 if(normal.dot(view)<.6)continue;const direction=center.clone().sub(origin).normalize();ray.set(origin,direction);ray.far=origin.distanceTo(center)+.004;
 const hit=ray.intersectObjects(meshes,false).find(h=>{const m=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex||0]:h.object.material;return !m.transparent;});let visible=false;for(let n:T.Object3D|null=hit?.object||null;n;n=n.parent)if(n===knife)visible=true;
 samples.push({visible,blocker:visible?null:hit?.object.name||null});
 }});
 return {samples:samples.length,visible:samples.filter(s=>s.visible).length,ratio:samples.length?samples.filter(s=>s.visible).length/samples.length:0,blockers:[...new Set(samples.filter(s=>!s.visible).map(s=>s.blocker))]};
}
