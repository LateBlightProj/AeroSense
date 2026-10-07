// Authored demonstration timing, not device commands or a live inference model.
export const HSI_DURATION={handheld:6,conveyor:14};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(v:number)=>{const t=clamp(v);return t*t*(3-2*t)};
export function handheldMotion(seconds:number){
 const t=Math.max(0,seconds),scanning=t>=1&&t<3;
 return {approach:ease(t),retreat:ease(t-5),scanning,
  sweep:scanning?Math.sin((t-1)/2*Math.PI*2)*.035:0,
  progress:clamp((t-1)/2),result:t>=3,
  phase:t<1?'定位单薯':t<3?'采集 400–1000 nm':t<6?'干物质 22.5%':'扫描完成'};
}
export function conveyorMotion(seconds:number){
 const t=Math.max(0,seconds);
 // One specimen crosses the fixed acquisition line once; no teleport at phase changes.
 const x=t<2?-.69:t<5?-.69+.61*ease((t-2)/3):t<8?-.08+.16*(t-5)/3:t<11?.08+.59*ease((t-8)/3):.67;
 return {x,scanning:t>=5&&t<8,progress:clamp((t-5)/3),result:t>=8,
  phase:t<2?'采后单薯接收':t<5?'采样区域定位':t<8?'单薯表面 · 逐线采集':t<11?'伪色合成':'关联分级记录'};
}
