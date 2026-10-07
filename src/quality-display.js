/* The original six-second spectral sequence owns the result timing. */
(()=>{
 if(!window.__AEROSENSE_RANKING_MODE__)return;
 const event=eventByKey('spectral'),layer=document.getElementById('eventLayer'),facts=document.getElementById('eventFacts'),visual=document.getElementById('eventVisual');
 Object.assign(event,{title:'采前品质校验',subtitle:'单薯光谱 · 400–1000 nm',facts:['光谱结果'],result:'采前品质校验完成'});
 const beforeRender=renderEventVisual;
 renderEventVisual=function(e){
  if(e.key==='spectral')return '<div class="spectral-evidence-model"><canvas data-twin-mirror data-spectral-closeup aria-label="单薯光谱伪色图"></canvas></div>';
  return beforeRender(e);
 };
 function sync(){
  if(currentEvent().key!=='spectral')return;
  const q=window.__AEROSENSE_SEQUENCE__.state(),done=q.event===eventNumber('spectral')&&q.elapsed>=6&&!q.active;
  layer.classList.add('has-card-results');layer.classList.remove('single-composition');
  if(!facts.querySelector('[data-spectral-results]'))facts.innerHTML='<section class="spectral-results" data-spectral-results><h3>光谱结果</h3><div class="spectral-estimate"><span>干物质估算值</span><strong data-spectral-dry>—</strong></div><dl><div><dt>分析模型</dt><dd>PLS 回归</dd></div><div><dt>采集波段</dt><dd>400–1000 nm</dd></div><div><dt>分析对象</dt><dd>单薯</dd></div></dl></section>';
  visual.querySelectorAll('.spectral-algorithm,.spectral-result-title').forEach(n=>n.remove());
  const evidence=visual.querySelector('.spectral-evidence-model');
  if(evidence&&!evidence.querySelector('[data-spectral-legend]'))evidence.insertAdjacentHTML('beforeend','<div class="spectral-map-legend" data-spectral-legend><span>伪色映射</span><i aria-hidden="true"></i><span data-spectral-phase></span></div>');
  const phase=visual.querySelector('[data-spectral-phase]');if(phase)phase.textContent=done?'采集完成':'采集中';
  const root=facts.querySelector('[data-spectral-results]');root.dataset.state=done?'complete':'analysing';root.setAttribute('aria-busy',String(!done));
  root.querySelector('[data-spectral-dry]').innerHTML=done?'22.5<small>%</small>':'—';
  document.getElementById('eventTitle').textContent='采前品质校验';document.getElementById('eventSubtitle').textContent=event.subtitle;
 }
 const previousSet=setEvent;setEvent=function(...args){const result=previousSet(...args);sync();return result;};
 window.__AEROSENSE_QUALITY_DISPLAY__={sync};setInterval(sync,100);sync();
})();
