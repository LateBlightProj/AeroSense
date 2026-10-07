/* A display-only closing sequence; production data stays in the original route. */
(()=>{
 if(!window.__AEROSENSE_RANKING_MODE__)return;
 const host=document.createElement('section');
 host.id='rankAuthorship';host.className='rank-authorship';host.hidden=true;host.tabIndex=-1;
 host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');
 host.setAttribute('aria-labelledby','rankAuthorshipTitle');host.setAttribute('aria-hidden','true');
 host.innerHTML=`<div class="rank-authorship-page">
  <header class="rank-authorship-head">
   <div class="rank-authorship-brand">
    <div class="rank-authorship-logo"><svg class="rank-authorship-wordmark" role="img" aria-label="AeroSense" viewBox="45 106 1995 403" width="1995" height="403" preserveAspectRatio="xMidYMid meet" hidden><image width="2109" height="746"></image></svg><strong class="rank-authorship-fallback">AeroSense</strong></div>
    <div class="rank-authorship-logo"><div class="rank-authorship-agent"><span class="rank-authorship-agent-icon"><canvas width="256" height="256" aria-hidden="true"></canvas></span><span class="rank-authorship-autonomy">Autonomy</span></div></div>
    <div class="rank-authorship-logo"><svg class="rank-authorship-emblem" role="img" aria-label="云雾工厂项目团队Logo" preserveAspectRatio="xMidYMid meet"><image></image></svg></div>
   </div>
   <span class="rank-authorship-version"></span>
  </header>
  <div class="rank-authorship-content">
   <h2 id="rankAuthorshipTitle">系统设计与构建声明</h2>
   <p class="rank-authorship-lead"><span>AeroSense由本参赛团队<strong>100%自主设计</strong>，</span><span>通过团队与AI协作完成系统构建。</span></p>
  </div>
  <footer class="rank-authorship-foot">
   <div>云雾工厂项目团队</div>
   <a class="rank-authorship-source" href="https://github.com/Yinsfleur/AeroSense" target="_blank" rel="noopener noreferrer">github.com/Yinsfleur/AeroSense</a>
   <div class="rank-authorship-rights">源码、Logo、图像与三维模型 · 使用及转载须授权</div>
  </footer>
 </div>`;
 document.body.append(host);
 host.querySelector('.rank-authorship-version').textContent='v'+window.__AEROSENSE_RELEASE__.version;
 const teamLogo=window.__AEROSENSE_CLOSING_LOGO__,emblem=host.querySelector('.rank-authorship-emblem');
 emblem.setAttribute('viewBox',teamLogo.viewBox.join(' '));
 emblem.setAttribute('width',teamLogo.viewBox[2]);emblem.setAttribute('height',teamLogo.viewBox[3]);
 const artwork=emblem.querySelector('image');artwork.setAttribute('width',teamLogo.width);artwork.setAttribute('height',teamLogo.height);artwork.setAttribute('href',teamLogo.uri);
 const wordmark=host.querySelector('.rank-authorship-wordmark'),image=wordmark.querySelector('image'),fallback=host.querySelector('.rank-authorship-fallback');
 const source=document.querySelector('.standby-logo-dark')?.getAttribute('src');
 if(source){image.setAttribute('href',source);wordmark.removeAttribute('hidden');fallback.hidden=true;image.onerror=()=>{wordmark.setAttribute('hidden','');fallback.hidden=false;};}
 const ctx=host.querySelector('canvas').getContext('2d');
 if(ctx)window.__AEROSENSE_AOM_MARK__?.draw(ctx,0,'idle');

 let phase='idle',elapsed=0,last=null,frame=0,generation=0,callbacks=null;
 const busy=()=>phase==='delivery'||phase==='statement';
 function hide(){host.hidden=true;host.setAttribute('aria-hidden','true');}
 function cancel(){generation++;cancelAnimationFrame(frame);frame=0;phase='idle';elapsed=0;last=null;callbacks=null;hide();}
 function finish(){
  if(!busy())return false;
  const done=callbacks;generation++;cancelAnimationFrame(frame);frame=0;phase='done';elapsed=10000;last=null;callbacks=null;hide();done?.finish();return true;
 }
 function showStatement(){
  if(phase!=='delivery')return false;
  const token=generation;
  callbacks.statement();
  if(token!==generation||phase!=='delivery')return false;
  phase='statement';elapsed=0;last=document.hidden?null:performance.now();
  host.hidden=false;host.setAttribute('aria-hidden','false');host.focus({preventScroll:true});return true;
 }
 function tick(now,token){
  frame=0;if(token!==generation||!busy())return;
  if(!callbacks.valid()){cancel();return;}
  if(document.hidden){last=null;}
  else{
   if(last!==null)elapsed+=Math.max(0,now-last);last=now;
   if(phase==='delivery'&&elapsed>=5000)showStatement();
   else if(phase==='statement'&&elapsed>=10000){finish();return;}
  }
  if(token===generation&&busy())frame=requestAnimationFrame(now=>tick(now,token));
 }
 function start(options){
  if(busy())return false;
  cancel();callbacks=options;phase='delivery';last=document.hidden?null:performance.now();
  const token=generation;frame=requestAnimationFrame(now=>tick(now,token));return true;
 }
 function skip(){if(phase==='delivery')return showStatement();if(phase==='statement')return finish();return false;}
 document.addEventListener('visibilitychange',()=>{
  if(!busy())return;
  const now=performance.now();if(document.hidden&&last!==null)elapsed+=Math.max(0,now-last);
  last=document.hidden?null:now;
 });
 document.addEventListener('keydown',e=>{
  if(!host.hidden&&e.key==='Tab'){e.preventDefault();const link=host.querySelector('.rank-authorship-source');if(document.activeElement===link||e.shiftKey)host.focus({preventScroll:true});else link.focus({preventScroll:true});}
 },true);
 window.__AEROSENSE_CLOSING__={start,cancel,skip,busy,state:()=>({phase,elapsed,visible:!host.hidden})};
})();
