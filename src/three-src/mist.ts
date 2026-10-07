import * as T from 'three';
import {mistPoint,unit} from './state';
export function createMist(){
 const count=3456,positions=new Float32Array(count*3),sizes=new Float32Array(count),alpha=new Float32Array(count);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));g.setAttribute('aSize',new T.BufferAttribute(sizes,1));g.setAttribute('aAlpha',new T.BufferAttribute(alpha,1).setUsage(T.DynamicDrawUsage));
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:T.NormalBlending,
  uniforms:{uLevel:{value:0},uDpr:{value:1}},
  vertexShader:`attribute float aSize;attribute float aAlpha;uniform float uDpr;varying float vAlpha;varying float vWorldY;void main(){vAlpha=aAlpha;vec4 world=modelMatrix*vec4(position,1.);vWorldY=world.y;vec4 mv=viewMatrix*world;gl_Position=projectionMatrix*mv;gl_PointSize=aSize*uDpr;}`,
  fragmentShader:`uniform float uLevel;varying float vAlpha;varying float vWorldY;void main(){float r=length(gl_PointCoord-.5)*2.;float soft=exp(-r*r*4.)*(1.-smoothstep(.55,1.,r));float ceiling=1.-smoothstep(1.42,1.57,vWorldY);float a=soft*vAlpha*uLevel*ceiling;if(a<.002)discard;gl_FragColor=vec4(.91,.93,.94,a);}`});
 const points=new T.Points(g,material);points.name='upward-root-mist';points.frustumCulled=false;
 let level=0;
 function update(time:number,dt:number,active:boolean,reduced:boolean,dpr:number){
  const target=active?1:0;level+=(target-level)*(1-Math.exp(-dt/(active?.16:.46)));material.uniforms.uLevel.value=level;material.uniforms.uDpr.value=dpr;
  points.visible=level>.002;
  if(!points.visible)return;
  for(let i=0;i<count;i++){const p=mistPoint(i,reduced?4.72:time);positions.set([p.x,p.y,p.z],i*3);sizes[i]=p.size;alpha[i]=p.alpha*(i%7===0?.09:.48+unit(i+85)*.17);}
  g.attributes.position.needsUpdate=true;g.attributes.aSize.needsUpdate=true;g.attributes.aAlpha.needsUpdate=true;
 }
 return {points,update,material};
}
