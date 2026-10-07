import * as T from 'three';

// Pixel-visible depth + instance IDs: no whole-object convex hulls or x-ray masks.
export function depthGray(distance:number){return .96-.90*Math.min(1,Math.max(0,(distance-.02)/1.18));}
export function depthClass(o:T.Object3D){
 if(o.userData.depthTarget||o.name==='gripped-original-tuber')return 4;
 if(o.userData.depthClass==='root'||o.name.startsWith('illustrative-stolon-'))return 2;
 if(o.name.startsWith('illustrative-stage-tuber-'))return 3;
 for(let p:T.Object3D|null=o;p;p=p.parent)if(p.name.startsWith('finger-hinge-')||p.name==='stolon-cutting-head')return 5;
 return 1;
}
export function createDepthPass(){
 const ids=new WeakMap<T.Object3D,number>();let nextID=1;
 const cache=new Map<T.Material,Map<number,T.ShaderMaterial>>();
 const buffer=new T.WebGLRenderTarget(1,1,{minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:true});
 buffer.texture.colorSpace=T.NoColorSpace;
 const output=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
  uniforms:{data:{value:buffer.texture},stepUV:{value:new T.Vector2(1,1)}},
  vertexShader:`varying vec2 texcoord;void main(){texcoord=uv;gl_Position=vec4(position.xy,0.,1.);}`,
  fragmentShader:`varying vec2 texcoord;uniform sampler2D data;uniform vec2 stepUV;
  float ident(vec4 p){return floor(p.g*255.+.5)+256.*floor(p.b*255.+.5);}
  vec3 palette(float id){return .55+.40*cos(6.2831853*(id*.381966+vec3(0.,.33,.67)));}
  void main(){vec4 p=texture2D(data,texcoord);float k=floor(p.a*255.+.5);if(k<.5){gl_FragColor=vec4(vec3(.025),1.);return;}
   float id=ident(p),edge=0.,jump=0.;vec4 q;
   q=texture2D(data,texcoord+vec2(stepUV.x,0.));edge=max(edge,step(.5,abs(id-ident(q))));jump=max(jump,abs(p.r-q.r));
   q=texture2D(data,texcoord-vec2(stepUV.x,0.));edge=max(edge,step(.5,abs(id-ident(q))));jump=max(jump,abs(p.r-q.r));
   q=texture2D(data,texcoord+vec2(0.,stepUV.y));edge=max(edge,step(.5,abs(id-ident(q))));jump=max(jump,abs(p.r-q.r));
   q=texture2D(data,texcoord-vec2(0.,stepUV.y));edge=max(edge,step(.5,abs(id-ident(q))));jump=max(jump,abs(p.r-q.r));
   float g=.86-.76*p.r;vec3 color=vec3(g);
   if(k==2.)color=mix(color,vec3(.68,.84,1.)*g,.10);
   if(k==3.||k==4.){vec3 ink=k==4.?vec3(.37,1.,.64):palette(id);color=mix(color,ink*g,.10);color=mix(color,ink*(.45+.55*g),edge*.86);}
   if(k==5.)color=mix(color,vec3(1.,.78,.45)*g,.18);
   if(k<3.)color*=1.-.16*smoothstep(.018,.08,jump);
   gl_FragColor=vec4(color,1.);
  }`});
 const quad=new T.Mesh(new T.PlaneGeometry(2,2),output),screen=new T.Scene(),screenCamera=new T.Camera();screen.add(quad);
 function mapped(source:T.Material,o:T.Mesh){
  let id=ids.get(o);if(!id){id=nextID++;ids.set(o,id);}
  let variants=cache.get(source);if(!variants){variants=new Map();cache.set(source,variants);}
  let m=variants.get(id);const src=source as T.MeshStandardMaterial;
  if(!m){m=new T.ShaderMaterial({side:source.side,toneMapped:false,
   uniforms:{identity:{value:new T.Vector2((id%256)/255,Math.floor(id/256)/255)},kind:{value:0},image:{value:src.map},alphaImage:{value:src.alphaMap},hasImage:{value:!!src.map},hasAlpha:{value:!!src.alphaMap},cutoff:{value:Math.max(.05,source.alphaTest)}},
   vertexShader:`varying float viewDepth;varying vec2 texcoord;void main(){texcoord=uv;vec4 p=vec4(position,1.);
   #ifdef USE_INSTANCING
   p=instanceMatrix*p;
   #endif
   vec4 v=modelViewMatrix*p;viewDepth=-v.z;gl_Position=projectionMatrix*v;}`,
   fragmentShader:`varying float viewDepth;varying vec2 texcoord;uniform sampler2D image;uniform sampler2D alphaImage;uniform bool hasImage;uniform bool hasAlpha;uniform float cutoff;uniform vec2 identity;uniform float kind;
   void main(){float a=1.;if(hasImage)a*=texture2D(image,texcoord).a;if(hasAlpha)a*=texture2D(alphaImage,texcoord).g;if(a<cutoff)discard;
   gl_FragColor=vec4(clamp((viewDepth-.08)/.62,0.,1.),identity,kind/255.);}`});variants.set(id,m);}
  m.uniforms.kind.value=depthClass(o);return m;
 }
 function render(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera){
  const previous=scene.overrideMaterial,background=scene.background,destination=renderer.getRenderTarget(),viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),scissorTest=renderer.getScissorTest(),autoClear=renderer.autoClear,clear=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha();
  const hidden:T.Object3D[]=[],changed:{mesh:T.Mesh;material:T.Material|T.Material[]}[]=[];
  const width=Math.min(720,Math.max(1,Math.round(viewport.z))),height=Math.max(1,Math.round(width*viewport.w/viewport.z));
  if(buffer.width!==width||buffer.height!==height)buffer.setSize(width,height);output.uniforms.stepUV.value.set(1/width,1/height);
  try{
   scene.traverse(o=>{if(!o.visible)return;if(o.name==='continuous-dark-depth-background'||o instanceof T.Line||o instanceof T.Points||o instanceof T.ArrowHelper){hidden.push(o);o.visible=false;return;}
    if(o instanceof T.Mesh){const ms=Array.isArray(o.material)?o.material:[o.material];if(ms.every(m=>!m.depthWrite||m.opacity===0)){hidden.push(o);o.visible=false;return;}
     changed.push({mesh:o,material:o.material});o.material=Array.isArray(o.material)?ms.map(m=>mapped(m,o)):mapped(o.material,o);}
   });
   scene.overrideMaterial=null;scene.background=null;renderer.setRenderTarget(buffer);renderer.setViewport(0,0,width,height);renderer.setScissorTest(false);renderer.setClearColor(0,0);renderer.autoClear=true;renderer.render(scene,camera);
   renderer.setRenderTarget(destination);renderer.setViewport(viewport);renderer.autoClear=false;renderer.render(screen,screenCamera);
  }finally{
   scene.overrideMaterial=previous;scene.background=background;changed.forEach(({mesh,material})=>mesh.material=material);hidden.forEach(o=>o.visible=true);
   renderer.setRenderTarget(destination);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setClearColor(clear,alpha);renderer.autoClear=autoClear;
  }
 }
 return {render,dispose(){cache.forEach(ms=>ms.forEach(m=>m.dispose()));cache.clear();buffer.dispose();output.dispose();quad.geometry.dispose();}};
}
