// One presentation clock; no automatic advance or compensation command.
(()=>{
 const layer=document.getElementById('eventLayer'),entry=events.find(e=>e.key==='ai-ops');
 Object.assign(entry,{title:'AeroSense Autonomy',subtitle:'第4展开叶监测 · 氮素补偿待命',lead:'叶色处于标准区间',desc:'持续监测展开叶的硝态氮估算与单叶面积；出现氮素波动时执行母液D在线补偿。',facts:[],state:'全自动运维接管'});
 const priorRender=renderEventVisual;
 renderEventVisual=function(e){if(e.key!=='ai-ops')return priorRender(e);return `<div class="takeover-composition"><div class="takeover-scene"><canvas data-twin-mirror aria-label="第4展开叶监测三维视图"></canvas><footer><img src="${PERSONNEL.小组长}" alt="AIoT小组长"><div><b>AIoT小组长</b><span>24小时自动运维</span></div></footer></div><aside aria-live="polite"><div class="takeover-observe"><span>第4展开叶同步监测</span><h3>根液硝态氮</h3><div class="takeover-reading"><strong data-takeover-n></strong><span>mg N/L</span></div><div class="takeover-range"><i data-n-marker></i></div><p class="takeover-range-label"><span>171.6</span><span>控制范围</span><span>189.7</span></p></div><div class="takeover-color" data-takeover-step="1"><span>模型叶色 GCC</span><strong data-leaf-gcc>读取中</strong><p data-leaf-rgb></p></div><div class="takeover-dose"><div class="takeover-dose-head"><strong>母液D</strong><span>补偿待命</span></div><p>本次补偿量 <b>0 <small>mL</small></b></p></div><div class="takeover-result" data-takeover-step="3"><canvas class="takeover-autonomy-mark" width="128" height="128" aria-hidden="true"></canvas><strong data-takeover-result>正在接管</strong></div></aside></div>`;};
 let elapsed=0,last=0,wasOpen=false,completionSoundPlayed=false,paused=false;
 function completionTone(){
  // A rounded two-part confirmation, distinct from the trace/delivery three-tone sound.
  if(typeof soundSequence==='function')soundSequence([[587.33,0,.12,.022,'sine'],[880,.15,.25,.019,'sine'],[587.33,.15,.23,.009,'sine']]);
 }
 function phaseAt(seconds){return seconds<2?0:seconds<8?1:seconds<18?2:seconds<21?3:4;}
 let lastMarkCanvas=null,lastMarkAt=-Infinity,lastMarkPhase=-1,markIdleStartedAt=0;
 function paintMark(phase){
  if(phase<3)return;
  const canvas=layer.querySelector('.takeover-autonomy-mark'),now=performance.now(),reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(!canvas||(canvas===lastMarkCanvas&&phase===lastMarkPhase&&(reduced||now-lastMarkAt<33)))return;
  if(phase===4&&(phase!==lastMarkPhase||canvas!==lastMarkCanvas))markIdleStartedAt=now;
  lastMarkCanvas=canvas;lastMarkAt=now;lastMarkPhase=phase;
  window.__AEROSENSE_AOM_MARK__.draw(canvas.getContext('2d'),reduced?.8:phase===4?(now-markIdleStartedAt)/1000:elapsed/3.5,phase===4?'idle':'loading');
 }
 function paint(){const phase=phaseAt(elapsed);const color=window.__AEROSENSE_LEAF_COLOR__;const gcc=layer.querySelector("[data-leaf-gcc]"),rgb=layer.querySelector("[data-leaf-rgb]");if(color&&gcc){gcc.textContent=color.gcc.toFixed(3);if(rgb)rgb.textContent="RGB "+color.rgb.join(" / ");}const n=layer.querySelector("[data-takeover-n]");if(n){const value=seriesByBay.B05.n.at(-1)*14/62;n.textContent=value.toFixed(1);const marker=layer.querySelector("[data-n-marker]");if(marker)marker.style.left=(Math.max(0,Math.min(1,(value-171.6)/18.1))*100)+"%";}layer.dataset.takeoverPhase=String(phase);paintMark(phase);layer.querySelectorAll('[data-takeover-step]').forEach(n=>{n.hidden=Number(n.dataset.takeoverStep)>phase;});const result=layer.querySelector('[data-takeover-result]');if(result)result.textContent=phase===4?'全自动运维已接管':'正在接管';if(phase===4&&!completionSoundPlayed){completionSoundPlayed=true;completionTone();}}
 function reset(){elapsed=0;last=0;completionSoundPlayed=false;paused=false;wasOpen=false;paint();}
 const priorSet=setEvent;setEvent=function(...args){const value=priorSet(...args);if(currentEvent().key==='ai-ops'){layer.classList.add('single-composition');layer.classList.remove('has-card-results');reset();}return value;};
 const priorOpen=openLayer;openLayer=function(target){const value=priorOpen(target);if(target===layer&&currentEvent().key==='ai-ops')reset();return value;};
 const priorFlow=handleFlowKey;handleFlowKey=function(direction){if(currentEvent().key==='ai-ops'){if(layer.classList.contains('open')){closeLayer(layer);if(direction<0)stepEvent(direction);return;}if(direction>0){stepEvent(direction);return;}}return priorFlow(direction);};
 function tick(now){requestAnimationFrame(tick);const open=currentEvent().key==='ai-ops'&&layer.classList.contains('open');if(!open||document.hidden||paused){last=0;wasOpen=false;return;}if(!wasOpen){last=now;wasOpen=true;}if(last)elapsed=Math.min(21,elapsed+(now-last)/1000*(window.__AEROSENSE_RANKING_MODE__?3.5:1));last=now;paint();}
 if(currentEvent().key==='ai-ops'){document.getElementById('eventVisual').innerHTML=renderEventVisual(entry);document.getElementById('eventFacts').innerHTML='';document.getElementById('eventSubtitle').textContent=entry.subtitle;layer.classList.add('single-composition');layer.classList.remove('has-card-results');reset();}
 window.__AEROSENSE_TAKEOVER__={phaseAt,
   busy:()=>currentEvent().key==='ai-ops'&&elapsed<21,
   snapshot:()=>({elapsed,completionSoundPlayed,paused}),
   restore(s){if(!s)return;elapsed=s.elapsed;completionSoundPlayed=!!s.completionSoundPlayed;paused=!!s.paused;last=0;wasOpen=false;paint();},
   pause(){paused=true;last=0;return true;},resume(){paused=false;last=0;return true;},
   skip(){if(elapsed>=21)return false;elapsed=21;paused=false;paint();return true;},reset,
   modelState:()=>({active:currentEvent().key==='ai-ops'&&layer.classList.contains('open'),elapsed,focus:elapsed>=18?'overview':elapsed<8?'leaf':'dose',phase:phaseAt(elapsed)})};requestAnimationFrame(tick);
})();
