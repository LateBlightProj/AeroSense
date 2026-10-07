import * as T from 'three';
import type {TwinState} from './state';
import {handheldMotion,conveyorMotion} from './spectral-motion';

// Qualitative false-colour presentation, not measured spectral inversion.
// The dry-matter result is the fixed 22.5% value in the supplied Ver8 script.
export function createSpectralEquipment(){
 const group=new T.Group();group.name='single-tuber-spectral-presentation';
 const assay=new T.Group();assay.name='postharvest-spectral-view';assay.position.set(2.43,.29,.28);group.add(assay);
 const rootSample=new T.Group();rootSample.name='in-situ-sampling';group.add(rootSample);
 const anchors={handheld:new T.Vector3(),conveyor:assay.position.clone()};
 const uniforms={scan:{value:0},falseColour:{value:0}};
 const material=new T.ShaderMaterial({uniforms,side:T.FrontSide,
  vertexShader:`varying vec3 p;varying vec3 n;void main(){p=position;n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec3 p;varying vec3 n;uniform float scan;uniform float falseColour;
   vec3 lut(float x){vec3 a=vec3(.10,.24,.58),b=vec3(.05,.69,.68),c=vec3(.82,.88,.39),d=vec3(.97,.48,.19);return x<.33?mix(a,b,x/.33):x<.72?mix(b,c,(x-.33)/.39):mix(c,d,(x-.72)/.28);}
   void main(){float value=clamp(.48+.23*sin(p.x*2.8+p.y*1.4)+.13*cos(p.z*3.5-p.y*2.),0.,1.);
   float shade=.58+.42*max(0.,dot(normalize(n),normalize(vec3(-.4,.7,1.))));
   vec3 base=mix(vec3(.62,.48,.28),lut(value),falseColour)*shade;
   float band=1.-smoothstep(.018,.060,abs(p.y-(scan*2.-1.)));
   gl_FragColor=vec4(base+vec3(.45,.8,.70)*band*(1.-falseColour)*.65,1.);}`});
 const sphere=new T.SphereGeometry(1,28,18);
 const isolated=new T.Mesh(sphere,material);assay.add(isolated);
 const scanMaterial=material.clone();scanMaterial.uniforms={scan:uniforms.scan,falseColour:{value:0}};
 const sampled=new T.Mesh(sphere.clone(),scanMaterial);rootSample.add(sampled);
 const readoutAnchor=new T.Vector3();
 function setSpecimen(source:T.Mesh){
  isolated.geometry.dispose();sampled.geometry.dispose();isolated.geometry=source.geometry.clone();sampled.geometry=source.geometry.clone();
  source.getWorldQuaternion(isolated.quaternion);sampled.quaternion.copy(isolated.quaternion);
  source.getWorldScale(sampled.scale);sampled.scale.multiplyScalar(1.015);
  isolated.scale.copy(sampled.scale);
  isolated.geometry.computeBoundingBox();
  const extent=isolated.geometry.boundingBox!.getSize(new T.Vector3()).multiply(isolated.scale);
  isolated.scale.multiplyScalar(.90/Math.max(extent.x,extent.y,extent.z,.001));
 }
 let qa={event:-1,active:false,phase:'',progress:0,dryMatter:null as number|null,standoff:0,scanning:false,sampleX:0,falseColour:false};
 function update(state:TwinState,target:T.Vector3,evidence=false){
  const active=!!state.sequence?.active&&state.event===23;
  const enabled=state.event===23&&(active||evidence);
  const t=active?state.sequence!.elapsed:12;
  const m=state.event===23?handheldMotion(t):conveyorMotion(t);
  const result=m.result;
  assay.visible=false; // Only the secondary view renders the false-colour specimen.
  rootSample.visible=enabled&&state.event===23&&!result&&m.scanning;
  sampled.position.copy(target);anchors.handheld.copy(target);readoutAnchor.copy(target);
  uniforms.scan.value=m.progress;uniforms.falseColour.value=result?1:m.progress;
  // The sample is a dedicated inspection view, not a second physical potato in the box.
  isolated.position.set(0,0,0);isolated.rotation.y=.2;
  qa={event:state.event,active,phase:enabled?(result?(state.event===23?'伪色合成 · 干物质 22.5%':'伪色合成 · 采后光谱复核'):m.phase):'',progress:m.progress,dryMatter:enabled&&state.event===23&&result?22.5:null,standoff:0,scanning:enabled&&m.scanning,sampleX:0,falseColour:enabled&&result};
 }
 function dispose(){isolated.geometry.dispose();sampled.geometry.dispose();material.dispose();scanMaterial.dispose();group.removeFromParent();}
 assay.visible=false;rootSample.visible=false;
 return {group,anchors,update,setSpecimen,dispose,setResultVisible(value:boolean){assay.visible=value},get qa(){return qa}};
}
