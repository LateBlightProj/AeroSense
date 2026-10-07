// Deterministic offline specimen fields. These are not measured spectra or model probabilities.
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{v=clamp(v);return v*v*(3-2*v);};
function noise(x:number,y:number,seed:number){
 const hash=(a:number,b:number)=>{const v=Math.sin(a*127.1+b*311.7+seed*74.7)*43758.5453;return v-Math.floor(v);};
 const a=Math.floor(x),b=Math.floor(y),u=smooth(x-a),v=smooth(y-b);
 return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v;
}
export function specimenField(object:number,u:number,v:number){
 // Correlated surface variation: broad mottling, finer skin texture and small eye depressions.
 const broad=noise(u*7,v*6,object+3),fine=noise(u*38,v*30,object+11),detail=noise(u*95,v*76,object+21);
 let eyes=0;for(let i=0;i<5;i++){const x=.18+((i*.173+object*.071)%.66),y=.26+((i*.237+object*.13)%.48);eyes+=Math.exp(-((u-x)**2/.00016+(v-y)**2/.00045));}
 const dx=(u-.59)/.18,dy=(v-.44)/.22,angle=Math.atan2(dy,dx);
 const edge=1+.30*(noise(u*18,v*16,37)-.5)+.14*Math.cos(angle+1);
 const anomaly=object===2?smooth((edge-Math.hypot(dx,dy))/.38):0;
 const texture=clamp(.43+.27*(broad-.5)+.15*(fine-.5)+.055*(detail-.5)-.09*eyes);
 return {texture,anomaly};
}
export function featureRGB(texture:number,anomaly:number){
 const healthy=[28+texture*40,91+texture*137,133+texture*108];
 const warm=[190+texture*85,85+texture*110,28+texture*36];
 const a=anomaly*.88;
 return healthy.map((v,i)=>Math.round(v*(1-a)+warm[i]*a));
}
