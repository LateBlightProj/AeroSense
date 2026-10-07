(()=>{
 if(!window.__AEROSENSE_RANKING_MODE__)return;
 const rank=window.__AEROSENSE_RANKING__,clock=document.getElementById('clock');
 if(!rank||!clock)return;
 const mark=document.createElement('span');mark.className='aom-status';mark.hidden=true;
 mark.setAttribute('aria-label','AeroSense Autonomy 智能体运维');mark.title='AeroSense Autonomy';
 mark.innerHTML='<canvas width="128" height="128" aria-hidden="true"></canvas><span>Autonomy</span>';
 clock.before(mark);
 const ctx=mark.querySelector('canvas').getContext('2d'),reduced=matchMedia('(prefers-reduced-motion:reduce)'),ops=rank.route.indexOf('ai-ops');
 let active=false,time=0,last=0,lastPaint=-1,lastSync=-1;
 const draw=t=>window.__AEROSENSE_AOM_MARK__.draw(ctx,t,'idle');
 function sync(){
  const pos=rank.route.indexOf(currentEvent().key),next=rank.isStarted()&&(pos>ops||pos===ops&&window.__AEROSENSE_TAKEOVER__.snapshot().elapsed>=21);
  if(next!==active){active=next;mark.hidden=!active;last=0;if(active){time=0;draw(0);}}
 }
 function tick(now){
  requestAnimationFrame(tick);if(document.hidden){last=0;return;}
  if(now-lastSync>=100){sync();lastSync=now;}
  if(!active||reduced.matches){last=0;return;}
  const delta=last?Math.min(.1,(now-last)/1000):0;last=now;time+=delta;
  if(now-lastPaint<33)return;lastPaint=now;draw(time);
 }
 reduced.addEventListener('change',()=>draw(time));document.addEventListener('visibilitychange',()=>{last=0;});
 function positionAlarm(){const rect=document.getElementById('twinVisual').getBoundingClientRect(),alarm=document.getElementById('globalAlarm');alarm.style.setProperty('--aom-alarm-top',rect.top+12+'px');alarm.style.setProperty('--aom-alarm-right',innerWidth-rect.right+12+'px');}
 addEventListener('resize',()=>requestAnimationFrame(positionAlarm));requestAnimationFrame(positionAlarm);
 draw(0);sync();requestAnimationFrame(tick);
})();
