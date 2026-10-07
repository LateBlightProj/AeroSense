import * as T from 'three';
import {RectAreaLightUniformsLib} from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {installBenchReadabilityLights} from './bench-readability-lights.mjs';

// Finite emitting surfaces create metal highlights without a bright world
// environment. Positions follow equipment space, not the presentation camera.
function area(scene:T.Scene,name:string,rgb:number[],intensity:number,size:number[],position:number[],direction:number[]){
 if(!T.UniformsLib.LTC_FLOAT_1||!T.UniformsLib.LTC_HALF_1)RectAreaLightUniformsLib.init();
 const light=new T.RectAreaLight(new T.Color().setRGB(rgb[0],rgb[1],rgb[2]),intensity,size[0],size[1]);
 light.name=name;light.position.fromArray(position);
 light.lookAt(light.position.clone().add(new T.Vector3().fromArray(direction)));
 scene.add(light);return light;
}

export function installBenchLighting(scene:T.Scene,key:T.DirectionalLight,fill:T.DirectionalLight,ambient:T.HemisphereLight,model:T.Object3D){
 // Keep the reviewed Blender rig's coordinates/directions; Three strengths
 // are chosen separately. Blender watts/AgX values are not copied as intensity.
 key.name='bench-key';key.position.set(-3,3.2,4);key.target.position.copy(key.position).add(new T.Vector3(.5512015,-.3950276,-.7349354));
 key.color.setRGB(.93,.97,1);key.intensity=3.2;
 fill.name='bench-fill';fill.position.set(3,.95,2);fill.target.position.copy(fill.position).add(new T.Vector3(-.8317304,.0277244,-.5544869));
 fill.color.setRGB(.81,.90,.95);fill.intensity=.32;ambient.intensity=.18;
 const rig=installBenchReadabilityLights(T,{model,initRectAreaUniforms:()=>RectAreaLightUniformsLib.init(),values:{taskNits:20,rightFillNits:2.4,rimStrength:.85}});
 rig.set({task:true,rightFill:true,rim:true});
 return rig;
}

type MainLights={key:T.DirectionalLight;fill:T.DirectionalLight;rim:T.DirectionalLight;ambient:T.HemisphereLight;biology:T.DirectionalLight;upper:T.DirectionalLight};
export function installMainLighting(scene:T.Scene,lights:MainLights){
 const {key,fill,rim,ambient,biology,upper}=lights;
 key.name='equipment-key';key.intensity=3.0;
 fill.intensity=.32;fill.target.position.set(0,1.25,0);scene.add(fill.target);
 rim.intensity=1.05;rim.target.position.set(0,1.15,0);scene.add(rim.target);
 ambient.intensity=.20;biology.intensity=.22;upper.intensity=.26;
 const reflection=area(scene,'equipment-front-reflection',[.89,.94,1],1.8,[.65,2.2],[2.5,1.25,2.25],[-.8,0,-.6]);
 let post=false;
 return {reflection,update(postVisible:boolean){
  if(post===postVisible)return;post=postVisible;
  reflection.position.set(post?4.1:2.5,post?.8:1.25,2.25);
  reflection.lookAt(post?new T.Vector3(3.5,.45,-.1):reflection.position.clone().add(new T.Vector3(-.8,0,-.6)));
 },dispose(){scene.remove(reflection);}};
}
