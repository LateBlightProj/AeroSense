(()=>{
 const original=AeroSenseOrbOriginal,preset=original.resolvePreset('connecting',64);
 const geometry=time=>original.MODE_FRAMES[preset.mode](64,time*preset.speed,preset.opts);
 const host=document.getElementById('twinVisual'),overlay=document.createElement('div');
 overlay.className='central-solving';overlay.hidden=true;overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');
 overlay.innerHTML='<div class="central-solving-content"><canvas width="128" height="128" aria-hidden="true"></canvas></div>';host.append(overlay);
 const canvas=overlay.querySelector('canvas'),ctx=canvas.getContext('2d'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let job=null,generation=0,shown=false,origin=0,lastDraw=0;
 function show(){if(!shown){shown=true;origin=performance.now();overlay.hidden=false;host.setAttribute('aria-busy','true');overlay.setAttribute('aria-label','模型计算中');}}
 function hide(){shown=false;overlay.hidden=true;host.removeAttribute('aria-busy');}
 function cancel(){const previous=job;generation++;job=null;hide();previous?.onCancel?.();}
 window.__AEROSENSE_LOADING__={
  busy:()=>!!job,
  cancel,
  skip(){if(!job)return false;const done=job;job=null;hide();if(done.token===generation){done.complete();void soundSequence([[880,0,.10,.026,'sine'],[1320,.12,.22,.024,'sine']]);}return true;},
  // Three-second application feedback, explicitly requested for the presentation.
  run(text,complete,onCancel){if(job)return false;job={token:++generation,event:app.event,elapsed:0,last:0,complete,onCancel};show();return true;},
  frameDots:t=>geometry(t).dots,frameGeometry:geometry
 };
 const oldSet=setEvent;setEvent=function(...args){cancel();return oldSet(...args);};
 addEventListener('keydown',e=>{if(job&&e.key==='Escape'){cancel();e.preventDefault();e.stopImmediatePropagation();}},true);
 function frame(now){
  requestAnimationFrame(frame);
  if(document.hidden){if(job)job.last=0;return;}
  if(job){
   if(job.event!==app.event||document.querySelector('.layer.open')){cancel();return;}
   job.elapsed+=job.last?window.__AEROSENSE_RANKING_MODE__?Math.max(0,now-job.last):Math.min(100,now-job.last):0;job.last=now;
   if(job.elapsed>=(window.__AEROSENSE_RANKING_MODE__&&events[job.event]?.key==='electrostatic'?1500:3000)){const done=job;job=null;hide();if(done.token===generation){done.complete();void soundSequence([[880,0,.10,.026,'sine'],[1320,.12,.22,.024,'sine']]);}}
  }
  if(!job&&shown)hide();
  if(!shown||now-lastDraw<32)return;lastDraw=now;
  if(ctx){ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,64,64);const g=geometry(reduce.matches?.8:(now-origin)/1000);
   if(window.__AEROSENSE_RANKING_MODE__)window.__AEROSENSE_AOM_MARK__.draw(ctx,reduce.matches?.8:(now-origin)/1000,'loading');else original.paintFrame(ctx,g,true);}


 }
 requestAnimationFrame(frame);
})();
