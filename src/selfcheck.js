/* Preparation cards follow the existing sequence and the recorded calibration points. */
(()=>{
 if(!window.__AEROSENSE_RANKING_MODE__)return;
 const op=window.__AEROSENSE_OPERATOR__,sequence=window.__AEROSENSE_SEQUENCE__;
 const layer=document.getElementById('eventLayer'),visual=document.getElementById('eventVisual'),facts=document.getElementById('eventFacts');
 const duration=5,asepticDuration=6,jobDuration=kind=>kind==='aseptic'?asepticDuration:duration,lowAt=duration*.28,highAt=duration*.56,saveAt=duration*.8,stages=['低点采集','高点采集','斜率计算','标定保存'];
 const channels=[{name:'K⁺',low:-6,high:108},{name:'NO₃⁻',low:112,high:2}];
 const state=()=>{const s=op.state.preparation||(op.state.preparation={});s.pressure||={complete:false};s.ise||={elapsed:0,complete:false,result:null};s.aseptic||={elapsed:0,complete:false};return s;};
 state();let job=null,frame=0,lastPaint='';
 let iseView=null,iseAttemptedImage=null;
 function disposeISE(){const view=iseView;iseView=null;iseAttemptedImage=null;view?.dispose();}
 function mountISE(root){
  if(layer.getAttribute('aria-hidden')==='true'||!layer.classList.contains('open'))return;
  const image=root.querySelector('.calibration > img');
  if(!image||image===iseAttemptedImage||typeof window.AeroSenseTwin3D?.mountISEEquipmentView!=='function')return;
  iseAttemptedImage=image;
  try{iseView=window.AeroSenseTwin3D.mountISEEquipmentView(image);}catch(error){console.warn('ISE equipment view unavailable; original image retained',error);}
 }
 const beforeCloseLayer=closeLayer;
 closeLayer=function(target){if(target===layer)disposeISE();return beforeCloseLayer(target);};
 const aseptic=eventByKey('aseptic');Object.assign(aseptic,{title:'无菌工位自检',subtitle:'激光粒子监测 · 中心 / 边缘',facts:['粒子监测'],result:'无菌工位自检完成'});
 const calibration=eventByKey('calibration');calibration.facts=[];calibration.result='两点标定已保存';calibration.subtitle='K⁺ / NO₃⁻ · 两点校准';calibration.lead='两点校准';calibration.desc='依次采集低点与高点，计算斜率后保存标定参数。';
 const beforeRender=renderEventVisual;
 renderEventVisual=function(e){
  // Dispose before the caller replaces eventVisual, including same-card replay.
  disposeISE();
  const html=beforeRender(e);
  if(e.key==='aseptic')return '<div class="aseptic-station"><div class="aseptic-fallback">'+html+'</div><canvas data-clean-bench role="img" aria-label="超净工作台三维视图，拖动旋转，滚轮缩放；中心与边缘采样位置"></canvas><div class="bench-view-hint" aria-hidden="true"><svg viewBox="0 0 24 32"><path class="bench-hint-track" d="M3 9H20M3 9l3-3M3 9l3 3M20 9l-3-3M20 9l-3 3"/><path class="bench-hint-cursor" d="M9 6v13l3-3 3 5 2-1-3-5h4Z"/><rect x="8" y="22" width="9" height="8" rx="4"/><path class="bench-hint-wheel" d="M12.5 24v3"/></svg><span>拖动旋转<br>滚轮缩放</span></div><span class="aseptic-sample-point" data-aseptic-location="center"><i></i>中心点</span><span class="aseptic-sample-point" data-aseptic-location="edge"><i></i>边缘点</span></div>';
  if(e.key!=='calibration')return html;
  const t=document.createElement('template');t.innerHTML=html;
  for(const [i,plot] of [...t.content.querySelectorAll('.cal-plot')].entries()){
   plot.dataset.iseChannel=String(i);const value=plot.querySelector('h4 span');value.dataset.iseResult='';value.textContent='— mV/dec';
   const svg=plot.querySelector('svg'),points=[...svg.querySelectorAll('.cal-point')],labels=[...svg.querySelectorAll('.chart-label')];
   points.forEach((n,j)=>{n.dataset.isePoint=String(j);n.style.opacity='0';});
   labels.filter(n=>n.getAttribute('y')==='350').forEach((n,j)=>{n.dataset.iseReading=String(j);n.dataset.value=n.textContent;n.textContent='— mV';});
   const fit=svg.querySelector('.cal-fit');fit.dataset.iseFit='';fit.setAttribute('pathLength','1');fit.style.strokeDasharray='1';fit.style.strokeDashoffset='1';
   const plumb=svg.querySelector('.cal-plumb');if(plumb)plumb.style.opacity='0';
   const probe=document.createElementNS('http://www.w3.org/2000/svg','circle');probe.setAttribute('r','11');probe.setAttribute('class','ise-acquisition-ring');probe.dataset.iseProbe='';svg.append(probe);
  }
  return '<div class="ise-workflow" data-ise-calibration><header><ol>'+stages.map((text,i)=>'<li data-ise-stage="'+i+'">'+text+'</li>').join('')+'</ol><progress data-ise-progress max="'+duration+'" value="0" aria-label="ISE校准进度"></progress></header>'+t.innerHTML+'</div>';
 };
 function calculate(){
  const result=channels.map(c=>{const slope=(c.high-c.low)/2;return {channel:c.name,low:{logConcentration:-4,millivolts:c.low},high:{logConcentration:-2,millivolts:c.high},slope,intercept:c.low+4*slope};});
  state().ise.result=result;return result;
 }
 function paintPressure(){
  if(currentEvent().key!=='pressure')return;
  const q=sequence.state(),done=q.event===eventNumber('pressure')&&q.elapsed>=10&&!q.active;
  state().pressure.complete=done;
  const stamp='pressure|'+done;if(lastPaint===stamp&&facts.querySelector('[data-pressure-result]'))return;lastPaint=stamp;
  facts.innerHTML=[['管路压力',done?'3.98 bar':'—'],['压力下降',done?'0.02 bar':'—']].map(([label,value])=>'<div data-pressure-result><span>'+label+'</span><b>'+value+'</b></div>').join('');
  document.getElementById('eventSubtitle').textContent=done?'设定压力4.0 bar · 保压核验完成':'设定压力4.0 bar · 保压核验';
 }
 function paintISE(){
  if(currentEvent().key!=='calibration')return;
  const root=visual.querySelector('[data-ise-calibration]');if(!root)return;
  mountISE(root);
  const s=state().ise,t=s.elapsed,stage=t<lowAt?0:t<highAt?1:t<saveAt?2:3;
  root.dataset.state=s.complete?'complete':stages[stage];root.setAttribute('aria-busy',String(!s.complete));
  root.querySelector('[data-ise-progress]').value=t;
  root.querySelectorAll('[data-ise-stage]').forEach((n,i)=>{n.classList.toggle('is-current',!s.complete&&i===stage);n.classList.toggle('is-complete',s.complete||i<stage);});
  for(const plot of root.querySelectorAll('[data-ise-channel]')){
   const i=Number(plot.dataset.iseChannel),points=[...plot.querySelectorAll('[data-ise-point]')],readings=[...plot.querySelectorAll('[data-ise-reading]')];
   points.forEach((n,j)=>n.style.opacity=String(t>=(j===0?lowAt:highAt)?1:0));
   readings.forEach((n,j)=>n.textContent=t>=(j===0?lowAt:highAt)?n.dataset.value:'— mV');
   const fitProgress=Math.min(1,Math.max(0,(t-highAt)/(saveAt-highAt)));plot.querySelector('[data-ise-fit]').style.strokeDashoffset=String(1-fitProgress);
   const plumb=plot.querySelector('.cal-plumb');if(plumb)plumb.style.opacity=t>=highAt?'1':'0';
   const probe=plot.querySelector('[data-ise-probe]'),point=points[stage===0?0:1];probe.style.display=t<highAt?'':'none';probe.setAttribute('cx',point.getAttribute('cx'));probe.setAttribute('cy',point.getAttribute('cy'));
   const result=s.result?.[i];plot.querySelector('[data-ise-result]').textContent=result?(result.slope>0?'+':'−')+Math.abs(result.slope).toFixed(1)+' mV/dec'+(s.complete?' · 已保存':' · 保存中'):'— mV/dec';
  }
  document.getElementById('eventSubtitle').textContent=s.complete?'K⁺ / NO₃⁻ · 标定已保存':'K⁺ / NO₃⁻ · '+stages[stage];
 }
 function paintAseptic(){
  if(currentEvent().key!=='aseptic')return;
  const s=state().aseptic,t=s.elapsed,duration=asepticDuration,slot=Math.min(5,Math.floor(t/duration*6)),location=slot%2?'edge':'center';
  layer.classList.add('has-card-results');layer.classList.remove('single-composition');
  if(!facts.querySelector('[data-particle-monitor]'))facts.innerHTML='<section class="particle-monitor" data-particle-monitor><header><h3>粒子监测</h3><span>≥0.5 µm</span></header><div class="particle-acquisition"><span data-particle-phase></span><span data-particle-total></span></div><svg viewBox="0 0 360 170" role="img" aria-label="粒子采样信号"><defs><clipPath id="particle-signal-clip"><rect data-particle-clip x="0" y="0" width="0" height="170"/></clipPath></defs><path class="particle-grid" d="M0 38H360 M0 86H360 M0 134H360"/><text class="particle-signal-label" x="0" y="20">采样信号</text><g clip-path="url(#particle-signal-clip)"><path class="particle-signal" d="M0 133H15L18 116L21 133H43L46 86L49 133H71L74 106L77 133H95L98 118L101 133H123L126 73L129 133H151L154 111L157 133H174L177 95L180 133H201L204 118L207 133H232L235 64L238 133H254L257 109L260 133H280L283 116L286 133H306L309 90L312 133H335L338 108L341 133H360"/></g><line class="particle-scan-line" data-particle-cursor y1="28" y2="148" x1="0" x2="0"/></svg><progress data-particle-progress max="'+duration+'" value="0" aria-label="粒子采样进度"></progress><div class="particle-samples">'+['中心点','边缘点'].map((name,row)=>'<div><span>'+name+'</span>'+[0,1,2].map(col=>'<span data-particle-sample="'+(col*2+row)+'">'+(col+1)+'</span>').join('')+'</div>').join('')+'</div><div class="aseptic-checks"><div><span>洁净度</span><b data-aseptic-check="0">核验中</b></div><div><span>器材</span><b data-aseptic-check="1">—</b></div><div><span>样品路径</span><b data-aseptic-check="2">—</b></div></div></section>';
  const monitor=facts.querySelector('[data-particle-monitor]');monitor.dataset.state=s.complete?'complete':'sampling';monitor.setAttribute('aria-busy',String(!s.complete));
  monitor.querySelector('[data-particle-phase]').textContent=s.complete?'采样完成':(location==='center'?'中心点':'边缘点')+' · 第'+(Math.floor(slot/2)+1)+'次';
  const completed=Math.min(6,Math.floor(t/duration*6));monitor.querySelector('[data-particle-total]').textContent=completed+' / 6';
  monitor.querySelector('[data-particle-progress]').value=t;
  const x=t/duration*360;monitor.querySelector('[data-particle-clip]').setAttribute('width',String(x));const cursor=monitor.querySelector('[data-particle-cursor]');cursor.setAttribute('x1',String(x));cursor.setAttribute('x2',String(x));cursor.style.opacity=s.complete?'0':'1';
  monitor.querySelectorAll('[data-particle-sample]').forEach(n=>{const i=Number(n.dataset.particleSample);n.classList.toggle('is-complete',i<completed);n.classList.toggle('is-current',!s.complete&&i===slot);n.textContent=i<completed?'✓':String(Math.floor(i/2)+1);});
  monitor.querySelectorAll('[data-aseptic-check]').forEach((n,i)=>{n.textContent=s.complete?['通过','就绪','已确认'][i]:i===0?'核验中':'—';});
  visual.querySelectorAll('[data-aseptic-location]').forEach(n=>n.classList.toggle('is-active',!s.complete&&n.dataset.asepticLocation===location));
  document.getElementById('eventTitle').textContent=s.complete?'无菌工位自检通过':'无菌工位自检';
  document.getElementById('eventSubtitle').textContent='激光粒子监测 · 中心 / 边缘';
 }
 function paintJob(){if(currentEvent().key==='aseptic')paintAseptic();else paintISE();}
 function tick(now){
  if(!job)return;
  if(currentEvent().key!==job.key){cancel();return;}
  const s=state()[job.kind],duration=jobDuration(job.kind);
  if(document.hidden){job.started=now-s.elapsed*1000;frame=requestAnimationFrame(tick);return;}
  s.elapsed=Math.min(duration,(now-job.started)/1000);
  if(job.kind==='ise'&&s.elapsed>=saveAt&&!s.result)calculate();
  if(s.elapsed>=duration){finish();return;}paintJob();frame=requestAnimationFrame(tick);
 }
 function start(){
  const key=currentEvent().key,kind=key==='calibration'?'ise':key==='aseptic'?'aseptic':null;
  if(!kind||job||state()[kind].complete)return;
  job={key,kind,started:performance.now()-state()[kind].elapsed*1000};paintJob();frame=requestAnimationFrame(tick);
 }
 function finish(){
  if(!job)return false;const kind=job.kind,s=state()[kind];s.elapsed=jobDuration(kind);if(kind==='ise'&&!s.result)calculate();s.complete=true;job=null;cancelAnimationFrame(frame);frame=0;paintJob();
  logEvent({...currentEvent(),title:kind==='aseptic'?'无菌工位自检通过':currentEvent().title,result:kind==='ise'?'ISE两点标定已保存：K⁺ +57.0 mV/dec；NO₃⁻ −55.0 mV/dec':'中心与边缘采样完成；洁净度通过、器材就绪、样品路径确认'},false);
  if(kind==='aseptic')closeLayer(layer);return true;
 }
 function cancel(){job=null;cancelAnimationFrame(frame);frame=0;lastPaint='';}
 function sync(){
  paintPressure();if(['calibration','aseptic'].includes(currentEvent().key)){if(job&&job.key!==currentEvent().key)cancel();paintJob();start();}else if(job)cancel();
 }
 const beforeSet=setEvent;setEvent=function(...args){const result=beforeSet(...args);lastPaint='';sync();return result;};
 window.__AEROSENSE_PREPARATION__={state,busy:()=>!!job,cancel,skip:finish,sync};
 setInterval(sync,100);sync();
})();
