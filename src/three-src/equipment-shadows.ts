import * as T from 'three';

// Physical housings receive/cast shadows; transparent media and UI/VFX do not.
function opaqueEquipment(mesh:T.Mesh){
 for(let o:T.Object3D|null=mesh;o;o=o.parent){
  if(/^(Airflow_|Anchor_|stock-letter-|stock-status-|stock-D-indicator-|uv-status-window|uv-c-lamp|liquid-only-|nanobubbles|root-exudate|solute-treatment|surface-water)/.test(o.name))return false;
 }
 const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
 return materials.length>0&&materials.every(m=>m instanceof T.MeshStandardMaterial&&!m.transparent&&m.opacity>=.98&&m.depthWrite&&(!(m instanceof T.MeshPhysicalMaterial)||m.transmission===0));
}

export function enableEquipmentShadows(root:T.Object3D){
 let count=0;
 root.traverse(o=>{if(o instanceof T.Mesh){const eligible=opaqueEquipment(o);o.castShadow=eligible;o.receiveShadow=eligible;if(eligible)count++;}});
 return count;
}

export function limitSmallShadowCasters(roots:T.Object3D[],minimumExtent=.045){
 const size=new T.Vector3();let removed=0;
 for(const root of roots){root.updateWorldMatrix(true,true);root.traverse(o=>{
  if(!(o instanceof T.Mesh)||!o.castShadow)return;
  if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
  o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld).getSize(size);
  if(Math.max(size.x,size.y,size.z)<minimumExtent){o.castShadow=false;removed++;}
 });}
 return removed;
}

// Include physical parts even when a process temporarily hides them. This
// keeps the directional shadow volume steady throughout the existing motion.
export function equipmentShadowBounds(roots:T.Object3D[],target=new T.Box3()){
 target.makeEmpty();
 for(const root of roots){root.updateWorldMatrix(true,true);root.traverse(o=>{
  if(!(o instanceof T.Mesh)||!opaqueEquipment(o))return;
  if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
  target.union(o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld));
 });}
 return target;
}

export function fitEquipmentShadow(key:T.DirectionalLight,bounds:T.Box3){
 if(bounds.isEmpty())return false;
 key.updateWorldMatrix(true,false);key.target.updateWorldMatrix(true,false);
 key.shadow.updateMatrices(key);
 const lightBounds=new T.Box3(),view=key.shadow.camera.matrixWorldInverse;
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  lightBounds.expandByPoint(new T.Vector3(x,y,z).applyMatrix4(view));
 }
 const c=key.shadow.camera,pad=.25;
 c.left=lightBounds.min.x-pad;c.right=lightBounds.max.x+pad;
 c.bottom=lightBounds.min.y-pad;c.top=lightBounds.max.y+pad;
 c.near=Math.max(.02,-lightBounds.max.z-pad);c.far=Math.max(c.near+.5,-lightBounds.min.z+pad);
 c.updateProjectionMatrix();key.shadow.updateMatrices(key);key.shadow.needsUpdate=true;
 return true;
}
