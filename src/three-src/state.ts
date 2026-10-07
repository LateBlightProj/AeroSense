export interface TwinState {
 event:number;type:string;stage:number;stageLabel:string;
 eventKey?:string;oxygenated?:boolean;electrostatic?:boolean;pressure?:number;
 presentation:'open'|'ended'|'preview';
 sequence?:{active:boolean;event:number;elapsed:number;revision:number;focus:string;phase:string;detail:string};
 mist:boolean;mistVerified:boolean;mistLabel:string;light:boolean;dimming:number;
 heat:boolean;rootAnalysis:boolean;spectrum:boolean;hsiView:string;
 lightRecipe:{ppfd:number;targetPpfd:number;kelvin:number;frPfd:number;profile:string;spectrum:{w:number;r:number;b:number;fr:number};dli:number;photoperiod:string;uva:boolean;uvaRecipe:{label:string;irradiance:number;dailyDose:number}};
 leafTemp:number;theme:string;visible:boolean;
}
// Display-stage variants derived from one source plant, not measured growth models.
export const STAGE_SHAPES=[
 {scale:.58,tubers:0,radius:0},
 {scale:.68,tubers:0,radius:0},
 {scale:.82,tubers:7,radius:.017},
 {scale:.94,tubers:13,radius:.023},
 {scale:1,tubers:18,radius:.027}
];
export const PLANT_X=[-.72,0,.72];
export const DECK_Y=1.65;
export const DECK_UNDERSIDE=1.59;
export const DECK_THICKNESS=.032;
export const DECK_TOP=1.71;
// Independent spatial samples with separation; no fixed angular or height progression.
export function tuberPositions(plant:number){
 const points:{x:number;y:number;z:number}[]=[];
 for(let attempt=0;attempt<600&&points.length<18;attempt++){
  const seed=plant*1709+attempt*17+419,angle=unit(seed+5)*Math.PI*2;
  const depth=.15+unit(seed+19)*1.04,r=.052+Math.sqrt(unit(seed+31))*.095;
  const p={x:Math.cos(angle)*r,y:-depth,z:Math.sin(angle)*r*.86};
  if(points.every(q=>Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)>.087))points.push(p);
 }
 return points;
}
// Same nine outlet layout as the preceding formal page, now in 3D.
export const NOZZLE_X=Array.from({length:9},(_,i)=>-1.04+i*.26);
export function unit(seed:number){const n=Math.sin(seed*127.1+311.7)*43758.5453123;return n-Math.floor(n);}
export function mistPoint(index:number,seconds:number){
 const u=unit(index+1),v=unit(index+4103),life=1.18+unit(index+73)*.52;
 const age=(seconds*.83+unit(index+930)*life)%life;
 const t=age/life,height=1.32*t;
 const angle=unit(index+551)*Math.PI*2,spread=(.009+.18*t)*Math.sqrt(v);
 return {x:NOZZLE_X[index%9]+Math.cos(angle)*spread+Math.sin(age*5+u*9)*.012*t,
  y:.205+height,z:Math.sin(angle)*spread,
  alpha:Math.sin(Math.PI*t)*Math.min(1,(1.57-(.205+height))/.14)*(.82+.18*Math.sin(seconds*4.5-index%9*.71)),
  size:index%7===0?10+u*12:1.2+u*1.4};
}
