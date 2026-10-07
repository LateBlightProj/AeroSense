import * as T from 'three';
import trajectory from './models/bench_camera_trajectory_6s.json';

export function benchEquipmentBounds(asset:T.Object3D,bounds=new T.Box3()){
 bounds.makeEmpty();asset.updateWorldMatrix(true,true);
 asset.traverse(o=>{
  if(!(o instanceof T.Mesh))return;
  for(let parent:T.Object3D|null=o;parent;parent=parent.parent){if(parent.name.startsWith('Airflow_'))return;if(parent===asset)break;}
  if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
  bounds.union(o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld));
 });
 return bounds;
}

// The reviewed 6-second camera pass is retimed against the existing 5-second
// preparation clock. Sampling and Airflow_Loop remain independent and unchanged.
export function benchViewPose(elapsed:number,reduced=false){
 const progress=reduced?1:T.MathUtils.clamp(elapsed/5,0,1),time=progress*trajectory.duration_seconds;
 const samples=trajectory.samples;
 let low=0,high=samples.length-1;
 while(low<high){const middle=Math.floor((low+high)/2);if(samples[middle].time<time)low=middle+1;else high=middle;}
 const b=samples[low],a=samples[Math.max(0,low-1)],blend=b.time>a.time?(time-a.time)/(b.time-a.time):0;
 const vector=(key:'position'|'target'|'up')=>new T.Vector3().fromArray(a[key]).lerp(new T.Vector3().fromArray(b[key]),blend);
 return {progress,time,position:vector('position'),target:vector('target'),up:vector('up'),phase:time<.4125?'establishing':time<2.55?'arc':time<5.175?'push':'hold'};
}

export function fitBenchView(camera:T.PerspectiveCamera,aspect:number){
 // Preserve the reviewed vertical view on wide screens; expand it once for a
// narrower canvas. It never measures through last-frame zoom or moves the rig.
 camera.aspect=aspect;camera.fov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(trajectory.vertical_fov_degrees/2))*Math.max(1,trajectory.aspect_ratio/aspect)));
 camera.updateProjectionMatrix();
}

export function applyBenchView(camera:T.PerspectiveCamera,asset:T.Object3D,target:T.Vector3,elapsed:number,reduced=false){
 const pose=benchViewPose(elapsed,reduced);asset.updateWorldMatrix(true,false);
 camera.position.copy(pose.position).applyMatrix4(asset.matrixWorld);
 target.copy(pose.target).applyMatrix4(asset.matrixWorld);
 camera.up.copy(pose.up).transformDirection(asset.matrixWorld);camera.lookAt(target);camera.updateMatrixWorld(true);
 return pose;
}

export function createBenchMotion(){
 let manual=false;
 return {
  begin(){manual=false;},
  interrupt(){manual=true;},
  update(camera:T.PerspectiveCamera,asset:T.Object3D,target:T.Vector3,elapsed:number,reduced=false){
   if(manual)return {automatic:false,progress:T.MathUtils.clamp(elapsed/5,0,1),phase:'manual'};
   const pose=applyBenchView(camera,asset,target,elapsed,reduced);
   return {automatic:!reduced&&pose.phase!=='hold',progress:pose.progress,phase:reduced?'hold':pose.phase};
  }
 };
}
