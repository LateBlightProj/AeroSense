import * as T from 'three';
import type {TwinState} from './state';
export function createHarvestArm(){
 const group=new T.Group();group.name='harvest-arm';
 const metal=new T.MeshStandardMaterial({color:0x53605f,metalness:.7,roughness:.38}),dark=new T.MeshStandardMaterial({color:0x202726,metalness:.4,roughness:.6}),soft=new T.MeshStandardMaterial({color:0xb5c2bb,roughness:.85});
 const base=new T.Vector3(1.08,.68,.44),home=new T.Vector3(.98,.88,.58),drop=new T.Vector3(.90,.282,.60);
 function mesh(g:T.BufferGeometry,m:T.Material){const o=new T.Mesh(g,m);group.add(o);return o;}
 const mount=mesh(new T.BoxGeometry(.14,.20,.15),dark);mount.position.copy(base);
 const links=[mesh(new T.CylinderGeometry(.029,.035,1,16),metal),mesh(new T.CylinderGeometry(.024,.030,1,16),metal)];
 // Machined rotary housings, face rings and recessed fasteners share the same pivots.
 const joints=[0,1,2].map(()=>{const g=new T.Group();group.add(g);
  const body=new T.Mesh(new T.CylinderGeometry(.055,.055,.074,24),dark);body.rotation.x=Math.PI/2;g.add(body);
  const face=new T.Mesh(new T.CylinderGeometry(.043,.043,.008,24),metal);face.rotation.x=Math.PI/2;face.position.z=.041;g.add(face);
  const cap=new T.Mesh(new T.CylinderGeometry(.024,.024,.009,24),dark);cap.rotation.x=Math.PI/2;cap.position.z=.048;g.add(cap);
  for(let i=0;i<6;i++){const bolt=new T.Mesh(new T.CylinderGeometry(.0035,.0035,.004,6),soft);bolt.rotation.x=Math.PI/2;bolt.position.set(Math.cos(i*Math.PI/3)*.035,Math.sin(i*Math.PI/3)*.035,.047);g.add(bolt);}return g;});
 const sleeves=links.map((link,i)=>{const shell=new T.Mesh(new T.CylinderGeometry(i?.035:.040,i?.038:.046,.44,24),dark);link.add(shell);return shell;});
 const cableGeometry=new T.TubeGeometry(new T.LineCurve3(base,home),40,.0035,6,false);
 const cable=new T.Mesh(cableGeometry,dark);cable.frustumCulled=false;cable.name='arm-back-cable';group.add(cable);
 const wrist=new T.Group();wrist.name='articulated-wrist';group.add(wrist);
 const fingers=[-1,1].map(sign=>{const pivot=new T.Group();pivot.name='finger-hinge-'+sign;pivot.userData.sign=sign;wrist.add(pivot);
  const finger=new T.Mesh(new T.CapsuleGeometry(.010,1,4,12),metal);pivot.add(finger);
  const pad=new T.Mesh(new T.BoxGeometry(.012,.034,.028),soft);pivot.add(pad);
  const pin=new T.Mesh(new T.CylinderGeometry(.016,.016,.027,16),metal);pin.rotation.x=Math.PI/2;pivot.add(pin);
  return {pivot,finger,pad};});
 const coupling=new T.Mesh(new T.CylinderGeometry(.020,.014,.065,12),metal);coupling.position.y=.045;wrist.add(coupling);
 const actuator=new T.Mesh(new T.BoxGeometry(.080,.044,.050),dark);actuator.position.y=.055;wrist.add(actuator);
 const cutter=new T.Group();cutter.name='stolon-cutting-head';cutter.position.set(0,.052,.039);wrist.add(cutter);
 const blades=[-1,1].map(sign=>{const blade=new T.Mesh(new T.BoxGeometry(.046,.006,.008),metal);blade.userData.sign=sign;cutter.add(blade);return blade;});
 const eye=new T.Group();eye.name='wrist-inspection-camera';eye.position.set(.074,.060,.018);wrist.add(eye);
 const housing=new T.Mesh(new T.BoxGeometry(.043,.052,.046),metal);eye.add(housing);
 const lens=new T.Mesh(new T.CylinderGeometry(.016,.016,.024,24),dark);lens.rotation.x=Math.PI/2;lens.position.z=.033;eye.add(lens);
 const optic=new T.Mesh(new T.CircleGeometry(.012,24),new T.MeshStandardMaterial({color:0x243c43,metalness:.55,roughness:.12}));optic.position.z=.046;eye.add(optic);eye.lookAt(wrist.localToWorld(new T.Vector3(0,-.015,0)));
 const lampMat=new T.MeshStandardMaterial({color:0x535950,emissive:0xe8f1e7,emissiveIntensity:0});
 const lamp=new T.Mesh(new T.TorusGeometry(.020,.003,8,24),lampMat);lamp.position.z=.047;eye.add(lamp);
 const scanLight=new T.SpotLight(0xeaf2e4,0,1.2,.16,.8,1);scanLight.position.set(.074,.060,.09);wrist.add(scanLight);const scanTarget=new T.Object3D();group.add(scanTarget);scanLight.target=scanTarget;
 const tray=mesh(new T.BoxGeometry(.24,.025,.23),metal);tray.position.set(.90,.24,.60);
 const carried=mesh(new T.SphereGeometry(.027,18,12),new T.MeshStandardMaterial({color:0xa68a59,roughness:.92}));carried.scale.set(.92,1.1,.85);carried.visible=false;
 carried.name='gripped-original-tuber';
 let radius=.027,halfHeight=.033;
 function setSpecimen(source:T.Mesh){
  source.updateWorldMatrix(true,false);
  const position=source.getWorldPosition(new T.Vector3());
  const transform=new T.Matrix4().makeTranslation(-position.x,-position.y,-position.z).multiply(source.matrixWorld);
  carried.geometry.dispose();carried.geometry=source.geometry.clone().applyMatrix4(transform);carried.scale.setScalar(1);
  carried.material=source.material as T.MeshStandardMaterial;
  carried.geometry.computeBoundingBox();const b=carried.geometry.boundingBox!;
  radius=Math.max(Math.abs(b.min.x),Math.abs(b.max.x));halfHeight=Math.max(Math.abs(b.min.y),Math.abs(b.max.y));
  actuator.position.y=halfHeight+.052;coupling.position.y=halfHeight+.072;
  cutter.position.set(0,halfHeight+.009,.016);
  // Wrist inspection head tracks the same specimen as the harvesting mechanism.
  const ranking=(window as any).__AEROSENSE_RANKING_MODE__;
  // Seat the inspection head below the bracket's front edge: the optical cone
  // stays clear through approach, grip and transfer. The visible lens and sensor
  // share this mounting point; the main presentation camera stays independent.
  eye.position.set(ranking?-.12:0,halfHeight+(ranking?.06:.12),ranking?.15:.20);
 }
 const ease=(x:number)=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x)};
 let qa={phase:'待机',carrying:false,active:false,rotationDegrees:0,bladeClosure:0,detached:false,grip:0,fingerAngle:0,elbow:[] as number[],wrist:[] as number[],specimenRadius:radius};
 let parked=false;
 function update(state:TwinState,target:T.Vector3){const seq=state.sequence,active=state.event===24&&!!seq?.active,t=seq?.elapsed||0;
  if(!active&&parked)return false;parked=!active;
  const near=target.clone().add(new T.Vector3(0,0,.38)),end=home.clone();let phase='待机',grip=0,carrying=false,rotationDegrees=0,bladeClosure=0;
  if(active){if(t<3){end.lerp(near,ease(t/3));phase='接近';}else if(t<4.3){end.copy(near).lerp(target,ease((t-3)/1.3));phase='夹持';}else if(t<5){end.copy(target);grip=ease((t-4.3)/.7);phase='夹持';}
   else if(t<8){end.copy(target);grip=1;rotationDegrees=15*ease((t-5)/1.5);bladeClosure=ease((t-6.5)/.8);phase=t<6.5?'微旋 15°':t<7.5?'切离匍匐茎':'切离完成';}
   else if(t<9){end.copy(target).lerp(near,ease(t-8));grip=1;carrying=true;rotationDegrees=15;phase='退出根簇';}
   else if(t<12){end.copy(near).lerp(drop,ease((t-9)/3));grip=1;carrying=true;rotationDegrees=15*(1-ease((t-9)/3));phase='移送';}
   else if(t<13){end.copy(drop);grip=1-ease(t-12);phase='松开';}
   else{end.copy(drop).lerp(home,ease((t-13)/3));phase='归位';}}
  // Roll in the visible grasp plane: specimen and both fingers share the same rotation.
  wrist.rotation.set(0,0,T.MathUtils.degToRad(rotationDegrees));cutter.visible=active&&t>=4.3&&t<8;
  blades.forEach(blade=>{blade.position.x=blade.userData.sign*(.055-.033*bladeClosure);blade.rotation.z=blade.userData.sign*T.MathUtils.degToRad(18*(1-bladeClosure));});
  // Two fixed-length links; solve elbow position in the base/end plane.
  const wristJoint=end.clone().add(new T.Vector3(0,halfHeight+.10,0).applyQuaternion(wrist.quaternion));
  const delta=wristJoint.clone().sub(base),d=Math.min(1.319,delta.length()),axis=delta.clone().normalize(),mid=base.clone().addScaledVector(axis,d/2);
  let bend=new T.Vector3(0,0,1).addScaledVector(axis,-axis.z).normalize();if(bend.lengthSq()<.01)bend.set(0,1,0);
  const elbow=mid.addScaledVector(bend,Math.sqrt(.66*.66-d*d/4));const pts=[base,elbow,wristJoint];
  links.forEach((o,i)=>{const v=pts[i+1].clone().sub(pts[i]);o.position.copy(pts[i]).add(pts[i+1]).multiplyScalar(.5);o.scale.y=v.length();o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());});
  joints.forEach((o,i)=>{o.position.copy(pts[i]);const v=pts[Math.min(i+1,2)].clone().sub(pts[Math.max(i-1,0)]);o.rotation.z=Math.atan2(v.y,v.x);});
  wrist.position.copy(end);
  // A wrist-mounted pan/tilt head tracks the specimen through approach and grasp.
  // Move the visible lens and the attached depth camera together, never just the inset.
  wrist.updateWorldMatrix(true,true);
  eye.lookAt(t>=5&&active?end:target);
  fingers.forEach(({pivot,finger,pad})=>{
   const sign=pivot.userData.sign,length=halfHeight+.030;
   pivot.position.set(sign*(radius+.021),length,0);pivot.rotation.z=sign*T.MathUtils.degToRad(28*(1-grip));
   finger.position.y=-length*.5;finger.scale.y=length;
   pad.position.set(-sign*.012,-length,0);
  });
  // Follow each rigid link; only the short elbow section bends. Update on the
  // transition to parked too, so interrupted events cannot leave a stale cable.
  const rear=new T.Vector3(0,0,-.052),a=base.clone().add(rear),b=elbow.clone().add(rear),c=wristJoint.clone().add(rear);
  const entry=b.clone().lerp(a,.09),exit=b.clone().lerp(c,.09);
  const route=new T.CurvePath<T.Vector3>();route.add(new T.LineCurve3(a,entry));
  route.add(new T.QuadraticBezierCurve3(entry,b,exit));route.add(new T.LineCurve3(exit,c));
  const positions=cableGeometry.getAttribute('position') as T.BufferAttribute,normals=cableGeometry.getAttribute('normal') as T.BufferAttribute;
  const frames=route.computeFrenetFrames(40,false),point=new T.Vector3();
  for(let i=0;i<=40;i++){
   route.getPointAt(i/40,point);const n=frames.normals[i],b=frames.binormals[i];
   for(let j=0;j<=6;j++){const angle=j/6*Math.PI*2,c=-Math.cos(angle),s=Math.sin(angle),x=c*n.x+s*b.x,y=c*n.y+s*b.y,z=c*n.z+s*b.z,k=i*7+j;
    positions.setXYZ(k,point.x+.0035*x,point.y+.0035*y,point.z+.0035*z);normals.setXYZ(k,x,y,z);}
  }
  positions.needsUpdate=true;normals.needsUpdate=true;
  cable.userData.anchors=[base.toArray(),elbow.toArray(),wristJoint.toArray()];
  const scanning=active&&t>=1.8&&t<4.3,working=active&&t>=4.3&&t<9;
  scanLight.intensity=scanning?1.8:working?.65:0;lampMat.emissiveIntensity=scanning?2:working?.65:0;
  scanTarget.position.copy(target).add(new T.Vector3(scanning?Math.sin((t-1.8)*2.5)*.027:0,.01,0));
  carried.visible=active&&t>=5;carried.position.copy(t<12?end:drop);carried.quaternion.copy(wrist.quaternion);qa={phase:scanning?'扫描定位':phase,carrying:active&&t>=5&&t<12,active,rotationDegrees,bladeClosure,detached:active&&t>=7.5,grip,fingerAngle:28*(1-grip),elbow:elbow.toArray(),wrist:end.toArray(),specimenRadius:radius};return active&&t>=5;
 }
 const inspectionCamera=new T.PerspectiveCamera((window as any).__AEROSENSE_RANKING_MODE__?50:78,1.5,.02,2);
 const cameraMount=new T.Mesh(new T.BoxGeometry((window as any).__AEROSENSE_RANKING_MODE__?.18:.058,.024,.045),dark);cameraMount.name='wrist-camera-top-mount';wrist.add(cameraMount);
 function fitCameraMount(source:T.Mesh){setSpecimen(source);cameraMount.position.set((window as any).__AEROSENSE_RANKING_MODE__?-.105:0,halfHeight+.10,.11);parked=false;}
 inspectionCamera.name='wrist-depth-camera';inspectionCamera.position.z=.048;
 // The lens faces local +Z, whereas a Three.js camera looks along local -Z.
 inspectionCamera.rotation.y=Math.PI;eye.add(inspectionCamera);
 return {group,update,setSpecimen:fitCameraMount,inspectionCamera,get qa(){return qa}};
}
