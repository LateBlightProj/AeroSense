(()=>{
 if(!window.__AEROSENSE_RANKING_MODE__)return;
 const startup=document.getElementById('startup'),reduce=matchMedia('(prefers-reduced-motion:reduce)'),marks=[];
 for(const [selector,phase] of [['.standby-logo-frame','standby'],['.boot-logo-frame','boot']]){
  const logo=startup.querySelector(selector);if(!logo)continue;
  const lockup=document.createElement('div');lockup.className='aom-brand-lockup';logo.before(lockup);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;canvas.className='aom-brand-mark';canvas.setAttribute('aria-hidden','true');
  lockup.append(canvas,logo);const ctx=canvas.getContext('2d');window.__AEROSENSE_AOM_MARK__.draw(ctx,0,'idle');marks.push({ctx,phase});
 }
 let last=0,lastDraw=0,time=0;
 function tick(now){
  requestAnimationFrame(tick);if(document.hidden||startup.classList.contains('is-complete')){last=0;return;}
  const dt=last?Math.min(.1,(now-last)/1000):0;last=now;const boot=['boot','leaving'].includes(startup.dataset.phase);
  const visible=marks.filter(mark=>mark.phase===(boot?'boot':'standby'));if(!reduce.matches)time+=dt;
  if(now-lastDraw<33||reduce.matches)return;lastDraw=now;visible.forEach(mark=>window.__AEROSENSE_AOM_MARK__.draw(mark.ctx,time,'idle'));
 }
 reduce.addEventListener('change',()=>marks.forEach(m=>window.__AEROSENSE_AOM_MARK__.draw(m.ctx,time,'idle')));
 document.addEventListener('visibilitychange',()=>{last=0;});requestAnimationFrame(tick);
})();
