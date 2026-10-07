// Append-only one-second sampling of the existing scenario model; no instrument transport.
(()=>{
 const layer=document.getElementById('eventLayer'),visual=document.getElementById('eventVisual');
 const live=eventNumber('reaction-live'),setup=eventNumber('reaction-setup'),result=eventNumber('reaction-result');
 const session={startedAt:0,completed:false,skipped:false,samples:[],crossedAt:null,pausedAt:0};
 const elapsed=()=>session.startedAt?Math.min(window.__AEROSENSE_RANKING_MODE__?100000:Infinity,Math.max(0,(session.pausedAt||Date.now())-session.startedAt)*(window.__AEROSENSE_RANKING_MODE__?200/37:1)):0;
 const active=()=>app.event===live;
 const channels=[['阳性对照','positive'],['阴性对照','negative'],['样本管','sample']];
 const originalRender=renderEventVisual;
 const x=t=>66+616*t/100,y=v=>322-v/1.1*284;
 // Preserve existing scenario values; do not add decorative random measurement noise.
 function sampleAt(second){
  const i=second/4,lo=Math.floor(i),hi=Math.min(25,lo+1),f=i-lo;
  const models=[n=>.055+.96/(1+Math.exp(-(n-14.2)/1.65))+(seededUnit(n,2,'pos')-.5)*.018,n=>.074+(seededUnit(n,3,'neg')-.5)*.012,n=>.035+(seededUnit(n,5,'sample')-.5)*.010];
  return {second,values:models.map(fn=>fn(lo)*(1-f)+fn(hi)*f)};
 }
 function collect(){
  if(!session.startedAt)return;
  const through=Math.min(100,Math.floor(elapsed()/1000));
  while(session.samples.length<=through){const point=sampleAt(session.samples.length);session.samples.push(point);if(session.crossedAt===null&&point.values[0]>=.45)session.crossedAt=point.second;}
 }
 function render(){
  return '<div class="reaction-composition instrument-reaction"><div class="reaction-graph"><svg viewBox="0 0 720 390" role="img" aria-label="三通道荧光强度采样曲线"><defs><clipPath id="reactionPlotClip"><rect x="66" y="28" width="616" height="294"/></clipPath></defs>'+
   [0,20,40,60,80,100].map(t=>'<path class="instrument-grid" d="M'+x(t)+' 28V322"/><text class="instrument-label" x="'+x(t)+'" y="350" text-anchor="middle">'+t+'</text>').join('')+
   [0,.25,.5,.75,1].map(v=>'<path class="instrument-grid" d="M66 '+y(v)+'H682"/><text class="instrument-label" x="56" y="'+(y(v)+4)+'" text-anchor="end">'+v.toFixed(2)+'</text>').join('')+
   '<path class="instrument-axis" d="M66 28V322H682"/><path class="instrument-threshold" d="M66 '+y(.45)+'H682"/><text class="instrument-label" x="682" y="'+(y(.45)-8)+'" text-anchor="end">阈值 0.45 RFU</text><g clip-path="url(#reactionPlotClip)"><path data-sampling-cursor class="instrument-cursor"/>'+channels.map(([,key],i)=>'<polyline data-channel="'+i+'" class="instrument-line '+key+'" points=""/><circle data-latest="'+i+'" class="instrument-point '+key+'" r="3" visibility="hidden"/>').join('')+'<circle data-threshold-crossing class="instrument-crossing" r="5" visibility="hidden"/></g><text class="instrument-label" x="374" y="382" text-anchor="middle">反应时间 (s)</text><text class="instrument-label" x="12" y="17">荧光强度 (RFU)</text></svg></div><aside>'+channels.map(([name,key],i)=>'<div class="concise-status instrument-reading '+key+'"><span>'+name+'</span><b data-rfu="'+i+'">— RFU</b></div>').join('')+'</aside></div>';
 }
 function paint(){
  if(!active())return;
  document.getElementById('eventTitle').textContent='CRISPR 反应检测';
  document.getElementById('eventSubtitle').textContent=(session.completed?'反应完成 · 对照有效 · 样本阴性':session.pausedAt?'三通道记录已暂停':'三通道同步记录')+(window.__AEROSENSE_RANKING_MODE__?' · 演示×5.4':'');
  layer.dataset.reactionState=session.completed?'complete':'running';
  const latest=session.samples.at(-1);if(!latest)return;
  channels.forEach((_,i)=>{
   visual.querySelector('[data-channel="'+i+'"]')?.setAttribute('points',session.samples.map(p=>x(p.second).toFixed(2)+','+y(p.values[i]).toFixed(2)).join(' '));
   const dot=visual.querySelector('[data-latest="'+i+'"]');if(dot){dot.setAttribute('cx',x(latest.second));dot.setAttribute('cy',y(latest.values[i]));dot.setAttribute('visibility','visible');}
   const reading=visual.querySelector('[data-rfu="'+i+'"]');if(reading)reading.textContent=latest.values[i].toFixed(3)+' RFU';
  });
  visual.querySelector('[data-sampling-cursor]')?.setAttribute('d',session.completed?'':'M'+x(latest.second)+' 28V322');
  const cross=visual.querySelector('[data-threshold-crossing]');if(cross&&session.crossedAt!==null){cross.setAttribute('cx',x(session.crossedAt));cross.setAttribute('cy',y(session.samples[session.crossedAt].values[0]));cross.setAttribute('visibility','visible');}
 }
 let paintedSample=-1;
 function update(){
  collect();let completedNow=false;
  if(session.startedAt&&!session.completed&&elapsed()>=100000){session.completed=true;completedNow=true;if(active())successChime();}
  if(active()&&(paintedSample!==session.samples.length||completedNow)){paint();paintedSample=session.samples.length;}
 }
 function start(){if(!active()||session.startedAt)return;session.startedAt=Date.now();app.crisprStartedAt=session.startedAt;update();}
 stopCrisprClock();startCrisprClock=()=>{};
 renderEventVisual=function(e){return ['reaction-live','reaction-result'].includes(e.key)?render():originalRender(e);};
 const previousSet=setEvent;
 setEvent=function(n,options={}){
  n=Number(n);
  if(n<=setup||n===live&&app.event>live){Object.assign(session,{startedAt:0,completed:false,skipped:false,samples:[],crossedAt:null,pausedAt:0});app.crisprStartedAt=0;}
  if(n===result)n=live;
  const r=previousSet(n,options);paintedSample=-1;if(active()&&layer.classList.contains('open'))start();update();return r;
 };
 const previousStep=stepEvent;
 stepEvent=function(d){if(active()&&d>0){update();if(!session.completed&&!session.skipped)return;return setEvent(result+1,{sound:true});}if(app.event===result+1&&d<0)return setEvent(live,{sound:true});return previousStep(d);};
 const previousFlow=handleFlowKey;
 handleFlowKey=function(d){if(active()&&d<0&&session.completed){Object.assign(session,{startedAt:0,completed:false,skipped:false,samples:[],crossedAt:null,pausedAt:0});app.crisprStartedAt=0;paintedSample=-1;visual.innerHTML=render();start();openLayer(layer);return;}if(active()&&d>0){update();if(!session.completed)session.skipped=true;}return previousFlow(d);};
 const previousOpen=openLayer;openLayer=function(el){const r=previousOpen(el);if(el===layer&&active()){start();update();visual.innerHTML=render();paint();}return r;};
 setInterval(update,100);document.addEventListener('visibilitychange',update);addEventListener('focus',update);
 window.__AEROSENSE_REACTION__={session,start,update,elapsed,
   busy:()=>active()&&!!session.startedAt&&!session.completed,
   pause(){if(!active()||!session.startedAt||session.completed)return false;session.pausedAt=Date.now();update();return true;},
   resume(){if(!session.pausedAt)return false;session.startedAt+=Date.now()-session.pausedAt;session.pausedAt=0;update();return true;},
   skip(){if(!active()||!session.startedAt||session.completed)return false;session.pausedAt=0;session.startedAt=Date.now()-100000/(window.__AEROSENSE_RANKING_MODE__?200/37:1);update();return true;},
   snapshot:()=>({...JSON.parse(JSON.stringify(session)),elapsedMs:elapsed()}),
   restore(s){if(!s)return;Object.assign(session,s);if(s.startedAt){session.startedAt=Date.now()-(s.elapsedMs||0)/(window.__AEROSENSE_RANKING_MODE__?200/37:1);session.pausedAt=s.pausedAt?Date.now():0;}paintedSample=-1;update();},
   reset(){Object.assign(session,{startedAt:0,completed:false,skipped:false,samples:[],crossedAt:null,pausedAt:0});app.crisprStartedAt=0;paintedSample=-1;}
  };
 if([live,result].includes(app.event))setEvent(live,{sound:false});
})();
