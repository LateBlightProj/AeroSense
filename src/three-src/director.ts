import * as T from 'three';
import type {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {fitScanZoom} from './postharvest-view';
import type {TwinState} from './state';
export function lightCaption(recipe:TwinState['lightRecipe']):string{
 const channels=[recipe.spectrum.w>0?`${recipe.kelvin} K 白光`:null,recipe.spectrum.r>0?`660 nm 红光 ${recipe.spectrum.r}%`:null,recipe.spectrum.b>0?`蓝光 ${recipe.spectrum.b}%`:null,recipe.spectrum.fr>0?`730 nm 远红 ${recipe.spectrum.fr}%`:null].filter(Boolean);
 if(recipe.uva)return `UVA 品质处理 · 385 nm\n${recipe.uvaRecipe.label}`;
 return `${recipe.profile}\n${channels.join(' · ')}\nPPFD ${recipe.ppfd} μmol/m²/s`;
}
export type Focus='overview'|'light'|'leaf'|'spectrum'|'root'|'mist'|'tuber'|'pressure'|'planting'|'fluid'|'uv'|'cooling'|'oxygen'|'dose'|'harvest'|'harvest-close'|'handheld'|'conveyor'|'post-treatment'|'post-drying';
// Explicit event mapping; equipment effects remain driven by the existing event state.
export function focusForEvent(event:number,uvaActive=false):Focus{
 if(event===15||event===16)return 'leaf';
 if(event===17)return 'root';
 // VPD recovery is not a lamp inspection. Lamp inspection is explicitly requested.
 return 'overview';
}
export function createDirector(camera:T.OrthographicCamera,controls:OrbitControls,scanBounds:(mode:'scan'|'sort',seconds:number)=>T.Box3){
 let automatic=true,focus:Focus='overview',key='',moving=false,progress=1;
 let phase:'idle'|'approach'|'hold'|'return'='idle',hold=0;
 let lightInspection=false,inspectionEvent=-1;
 let sequenceKey='',sequenceWasActive=false;
 let startPosition=camera.position.clone(),startTarget=controls.target.clone(),startZoom=camera.zoom;
 let endPosition=startPosition.clone(),endTarget=startTarget.clone(),endZoom=startZoom;
 function pause(){automatic=false;moving=false;controls.enableDamping=true;}
 controls.addEventListener('start',pause);
 function resume(){automatic=true;key='';}
 function inspectLight(){automatic=true;lightInspection=true;inspectionEvent=-1;key='';}
 function update(event:number,stage:number,leaf:T.Vector3,tuber:T.Vector3,dt:number,reduced:boolean,presentation:'open'|'ended'|'preview'='preview',uvaActive=false,sequence?:{active:boolean;focus:string;revision:number;elapsed:number}){
  const incoming=sequence?.active?event+':'+sequence.revision:'';
  if(incoming&&incoming!==sequenceKey){automatic=true;key='';sequenceKey=incoming;lightInspection=false;}
  if(sequenceWasActive&&!sequence?.active){automatic=true;key='';}
  sequenceWasActive=!!sequence?.active;
  if(!automatic)return;
  if(lightInspection){if(inspectionEvent===-1)inspectionEvent=event;else if(inspectionEvent!==event)lightInspection=false;}
  // Opening a card again is a new inspection even when its event number is unchanged.
  const framing=sequence?.active&&sequence.focus==='conveyor'?(sequence.elapsed>=13?'sort':'scan'):'';
  const nextKey=(framing?camera.right+':'+camera.top+':'+framing+':':'')+event+':'+stage+':'+uvaActive+':'+presentation+':'+(sequence?.active?sequence.revision+':'+sequence.focus:'');
  function begin(next:Focus,returning=false){
   focus=next;phase=returning?'return':'approach';hold=0;startPosition.copy(camera.position);startTarget.copy(controls.target);startZoom=camera.zoom;
   endTarget.set(0,1.05,0);endZoom=1;let offset=new T.Vector3(0,0,7);
   // Keep emitters and the illuminated canopy together, without an underside inspection.
   if(next==='light'){endTarget.set(0,2.12,0);endZoom=1.12;offset.set(0,-.35,7);}
   if(next==='leaf'){endTarget.copy(leaf);if(event!==15)endTarget.lerp(new T.Vector3(1.17,2.30,.10),.28);endZoom=event===15?2.8:2.0;offset.set(.25,event===15?.40:.75,7);}
   if(next==='spectrum'){endTarget.set(0,1.99,0);endZoom=1.20;offset.set(.30,1.85,7);}
   if(next==='root'){endTarget.set(0,1.04,0);endZoom=1.40;offset.set(.25,.35,7);}
   if(next==='mist'){endTarget.set(0,.96,0);endZoom=1.20;offset.set(.30,.35,7);}
   if(next==='pressure'){endTarget.set(-.48,.52,.08);endZoom=1.55;offset.set(1.2,.65,7);}
   if(next==='fluid'||next==='dose'){endTarget.set(0,-.24,.12);endZoom=1.65;offset.set(.45,2.0,7);}
   if(next==='dose'&&event===15){endTarget.set(.63,-.32,.27);endZoom=3.0;offset.set(.08,.65,7);}
   if(next==='uv'){endTarget.set(.40,-.12,.12);endZoom=2.05;offset.set(.30,1.4,7);}
   if(next==='cooling'){endTarget.set(-.75,-.30,.3);endZoom=2.05;offset.set(.30,1.5,7);}
   if(next==='oxygen'){endTarget.set(-.48,-.32,.38);endZoom=2.05;offset.set(.3,1.5,7);
    if((window as any).__AEROSENSE_RANKING_MODE__&&event===19){endTarget.set(-.48,-.39,.5);endZoom=2.6;offset.set(.25,.20,7);}}
   if((window as any).__AEROSENSE_RANKING_MODE__&&event===19){
    if(next==='uv'){endTarget.set(.40,-.10,.12);endZoom=2.5;offset.set(.15,.25,7);}
    if(next==='fluid'){endTarget.set(-.12,-.27,.16);endZoom=2.2;offset.set(.3,.65,7);}
   }
   if(next==='planting'){endTarget.set(0,1.74,0);endZoom=1.15;offset.set(.45,1.2,7);}
   if(next==='tuber'){endTarget.copy(tuber);endZoom=1.85;offset.set(.25,.45,7);}
   if(next==='harvest'){endTarget.set(.5,.70,.35);endZoom=1.45;offset.set(.7,.6,7);}
   if(next==='harvest-close'){endTarget.copy(tuber).add(new T.Vector3(.08,.06,.10));endZoom=(window as any).__AEROSENSE_RANKING_MODE__?3.2:2.7;offset.set(1.35,.30,7);}
   if(next==='handheld'){endTarget.copy(tuber).add(new T.Vector3(.08,.01,.06));endZoom=2.15;offset.set(1.0,.45,7);}
   const inspectionBounds=next==='conveyor'?scanBounds(framing==='sort'?'sort':'scan',sequence?.elapsed||0):null;
   if(inspectionBounds){inspectionBounds.getCenter(endTarget);offset.set(.30,framing==='sort'?2.2:.65,7);}
   if(next==='post-treatment'){endTarget.set(4.12,.29,-.24);endZoom=2.25;offset.set(.40,2.80,7);}
   if(next==='post-drying'){endTarget.set(4.96,.29,-.24);endZoom=2.25;offset.set(.40,2.80,7);}
   endPosition.copy(endTarget).add(offset);if(inspectionBounds)endZoom=fitScanZoom(camera,endPosition,endTarget,inspectionBounds);progress=0;moving=true;
   if(camera.position.distanceToSquared(endPosition)<1e-12&&controls.target.distanceToSquared(endTarget)<1e-12&&Math.abs(camera.zoom-endZoom)<1e-10){moving=false;phase=returning?'idle':'hold';return;}
   // Flush any manual orbit inertia before the authored transition.
   controls.enableDamping=false;controls.update();
  }
  if(key!==nextKey){
   key=nextKey;const next=lightInspection?'light':sequence?.active?sequence.focus as Focus:presentation==='ended'?'overview':focusForEvent(event,uvaActive);
   if(next===focus&&phase==='hold'&&next!=='conveyor'){hold=0;}else begin(next,next==='overview');
  }
  if(!sequence?.active&&!lightInspection&&presentation==='ended'&&phase!=='return'&&phase!=='idle')begin('overview',true);
  if(!sequence?.active&&phase==='hold'&&(presentation==='preview'||lightInspection)){hold+=dt;if(hold>=4){lightInspection=false;begin('overview',true);}}
  if(moving){
   progress=reduced?1:Math.min(1,progress+dt/((window as any).__AEROSENSE_RANKING_MODE__&&event===1&&sequence?.active?.6:1));
   const t=progress*progress*(3-2*progress);
   camera.position.lerpVectors(startPosition,endPosition,t);controls.target.lerpVectors(startTarget,endTarget,t);
   camera.zoom=T.MathUtils.lerp(startZoom,endZoom,t);camera.updateProjectionMatrix();controls.update();
   if(progress===1){moving=false;controls.enableDamping=true;phase=phase==='return'?'idle':'hold';}
  }
 }
 return {update,pause,resume,inspectLight,get automatic(){return automatic},get focus(){return focus},get phase(){return phase},get moving(){return moving},dispose(){controls.removeEventListener('start',pause)}};
}
