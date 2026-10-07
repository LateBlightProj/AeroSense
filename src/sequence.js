// Main-model presentation precedes the evidence card. No device/network control.
(()=>{
 const durations={0:11,1:10,13:4,31:12,14:9,16:4,17:3,18:8,19:8,21:7,23:6,25:window.__AEROSENSE_RANKING_MODE__?36:37,24:16,28:5,29:5,30:window.__AEROSENSE_RANKING_MODE__?7:6};
 let awaiting='',segmentEnd=Infinity;
 // One deliberate input owns one transition; absorb key repeat and click bursts.
 let inputReadyAt=0;
 const protectTransition=()=>{inputReadyAt=Date.now()+300;};
 let active=false,elapsed=0,event=-1,pending=false,revision=0,last=0,pendingSound=false;
 let bootCompleted=false,pressureArmed=false;
 let bootSprayPending=false;
 function beginBootSpray(){const now=Date.now();Object.values(sprayRuntime).forEach(rt=>{rt.phaseStartedAt=now;});}
 const soundedSensors=new Set(),sensorTones=[660,740,831,988,1109];
 let lastLightSwitch=-1,lightSwitchRevision=-1;
 function syncReadout(){if(window.__AEROSENSE_RANKING_MODE__&&event===18)window.__AEROSENSE_RANKING__?.syncCoolingResponse?.();
  if(active&&event===19){const s=seriesByBay.B05,value=8+7.2*Math.min(1,elapsed/8);s.state.do=value;s.do[s.do.length-1]=value;}
  if(app.bay!=='B05')return;
  if(!active){const spray=sprayStatus('B05');document.querySelector('#sprayAgo').textContent=spray.label;document.querySelector('#sprayPhase').classList.toggle('misting',spray.misting);}
  if(active&&event===1){document.querySelector('#sprayAgo').textContent='保压自检 · 喷头关闭';document.querySelector('#sprayPhase').classList.remove('misting');}
  if(active&&[13,31].includes(event)){document.querySelector('#sprayAgo').textContent=event===13?'定殖位置确认 · 喷头关闭':elapsed<4?'母液整定 · 喷头关闭':elapsed<7?'UV-C 处理 · 喷头关闭':'6.0 bar · 喷雾整定';document.querySelector('#sprayPhase').classList.toggle('misting',event===31&&elapsed>=7);}
  if(active&&event===0){document.querySelector('#sprayAgo').textContent=elapsed>=7&&elapsed<9?'自检喷雾 · 短脉冲':'系统自检 · 喷头关闭';document.querySelector('#sprayPhase').classList.toggle('misting',elapsed>=7&&elapsed<9);if(window.__AEROSENSE_RANKING_MODE__?elapsed>=2&&elapsed<3:elapsed>=4&&elapsed<7)document.querySelector('#lightCycle').textContent=window.__AEROSENSE_RANKING_MODE__?'光源统一自检':'光源通道自检';}
 }
 const originalPlots=updatePlots;updatePlots=function(...args){const result=originalPlots(...args);syncReadout();return result;};
 const frames={
  25:[[0,'conveyor','采后高光谱筛查','破薯 · 烂薯'],[13,'conveyor','异常对象分流','红色剔除 · 合格通道'],[18,'post-treatment','超声波雾化杀菌',''],[27,'post-drying','冷风干燥',''],[window.__AEROSENSE_RANKING_MODE__?35:36,'post-drying','处理完成','合格个体确权入库']],
  24:[[0,'harvest','定位中间株','中间植株外围单薯'],[1.8,'harvest-close','扫描定位','张开夹爪接近单薯'],[3,'harvest-close','柔性夹持','夹爪包裹单薯'],[5,'harvest-close','微旋 15°','夹爪与单薯同步转动'],[6.5,'harvest-close','切离匍匐茎','末端刀片闭合'],[8,'harvest-close','退出根簇','切离后撤离'],[9,'harvest','移送','放入接收位'],[12,'harvest','松开','放入接收位'],[13,'harvest','归位','机械臂返回待机位']],
  23:[[0,'handheld','定位中间株单薯','采样区域与拟采收对象对应'],[1,'handheld','特征光谱采集','400–1000 nm · 扫描薯块表面'],[3,'handheld','伪色结果','干物质 22.5%']],
  0:window.__AEROSENSE_RANKING_MODE__?[[0,'overview','区位上线','B01—B09 依次建立采集关联'],[2,'overview','光源统一自检','同步点亮，随后恢复生产配方'],[3,'overview','传感器自检','环境、叶温、光谱、根像、根液依次响应'],[7,'overview','喷雾短脉冲','检查喷雾覆盖与回液响应'],[9,'overview','自检完成','设备回到当前生产状态']]:[[0,'overview','区位上线','B01—B09 依次建立采集关联'],[2,'overview','传感器自检','环境、叶温、光谱、根像、根液依次响应'],[4,'overview','发光通道自检','逐路点亮，随后恢复生产配方'],[7,'overview','喷雾短脉冲','检查喷雾覆盖与回液响应'],[9,'overview','自检完成','设备回到当前生产状态']],
  1:[[0,'pressure','建立回路压力','观察供液总管压力上升'],[3,'pressure','保压观察','喷头关闭 · 设定 4.0 bar'],[7,'pressure','核对保压结果','3.98 bar · 压降 0.02 bar']],
  13:[[0,'planting','定殖位置确认','海绵固定 · 根系垂直下放']],
  31:[[0,'fluid','母液整定','A、B、C基础供给 · D、E阶段调节'],[4,'uv','UV-C 消毒','混匀营养液进入管内处理'],[7,'mist','VPA 脉冲整定','6.0 bar · 幼根喷雾']],
  28:[[0,'light','远红光诱导','730 nm · 远红光15%'],[3,'light','远红光诱导','当前配方持续照射冠层']],
  29:[[0,'light','膨大期光配方','3000 K暖白 · 660 nm深红增强'],[3,'light','膨大期光配方','当前配方持续照射冠层']],
  30:[[0,'tuber','规格核对','识别块茎轮廓与尺寸'],[window.__AEROSENSE_RANKING_MODE__?4:3,'light','UVA 品质处理','385 nm · 每日补充2–4 h']],
  18:[[0,'cooling','营养液冷却','冷却支路运行'],[5,'fluid','循环回液','回液进入配液箱']],
  19:window.__AEROSENSE_RANKING_MODE__?[[0,'oxygen','氧合循环','处理腔气液传质'],[3,'uv','循环净化','自毒物质清除'],[6,'fluid','循环回流','处理后营养液回流']]:[[0,'oxygen','液体氧合','气液混合仅在处理腔内'],[5,'fluid','氧合循环','处理后营养液回到水箱']],
  21:[[0,'dose','母液 E 投加','自动调增脉冲 · 钾硼补偿'],[4,'uv','营养液处理','混匀后进入 UV-C 模块']],
  14:[[0,'mist','静电场加载','执行小组长已应用的电压设定'],[3,'mist','荷电喷雾运行','负电荷雾滴向接地根表沉积'],[7,'mist','观察根系覆盖','荷电回路运行']],
  16:[[0,'leaf','定位叶温采样点','传感器与实际采样叶片同框'],[1,'leaf','核对冠层越限','采样连线与局部色层显示检测位置'],[2.5,'leaf','关联环境变化','冠层 29.6°C · VPD 峰值 1.36 kPa']],
  17:[[0,'root','定位根系复测区域','中间植株根系进入观察范围'],[.8,'root','查看分割与分析范围','边界对应实际根系，不代表病害确诊'],[2,'root','关联根域记录','结合溶氧与营养液数据复核']]
 };
 function state(){const list=frames[event]||[];const row=list.filter(x=>x[0]<=elapsed).at(-1);return {active,event,elapsed,revision,focus:row?.[1]||'overview',phase:row?.[2]||'',detail:row?.[3]||''};}
 function finish(show=true){if(!active)return;if(event===0){bootCompleted=true;if(show&&elapsed>=durations[0]){beginBootSpray();bootSprayPending=true;}}active=false;document.body.removeAttribute('data-selfcheck');document.querySelectorAll('#deviceStatus [data-state]').forEach(e=>e.removeAttribute('data-startup-check'));document.querySelectorAll('.bay').forEach(e=>e.classList.remove('startup-online'));if(show&&pending&&app.event===event){openLayer(document.querySelector('#eventLayer'));requestAnimationFrame(drawAllHSI);if(pendingSound)playEventSound(event)}pending=false;pendingSound=false;updatePlots();}
 function start(n,show=true,sound=n===0,offset=0){if(n===17&&window.__AEROSENSE_OPERATOR__&&!window.__AEROSENSE_OPERATOR__.state.rootAuthorized)return;if(n===24&&window.__AEROSENSE_OPERATOR__&&!window.__AEROSENSE_OPERATOR__.canStartHarvest())return;finish(false);if(!(n in durations))return;event=n;elapsed=offset;last=window.__AEROSENSE_RANKING_MODE__&&[0,18,25].includes(n)&&startupFinished?performance.now():0;active=true;pending=show&&n!==14;pendingSound=sound&&pending;segmentEnd=n===30&&offset===0&&!window.__AEROSENSE_RANKING_MODE__?3:n===25&&offset===0&&!window.__AEROSENSE_RANKING_MODE__?18:durations[n];awaiting='';soundedSensors.clear();revision++;if(app.view!=='twin')setCenterView('twin');}
 const previous=setEvent;setEvent=function(n,options={}){pressureArmed=false;awaiting='';const number=Number(n),supported=number in durations&&!(number===17&&window.__AEROSENSE_OPERATOR__&&!window.__AEROSENSE_OPERATOR__.state.rootAuthorized)&&![1,14,18,19,24,31].includes(number)&&!(number===0&&bootCompleted);finish(false);const result=previous(n,supported?{...options,open:false,present:false}:options);if([1,18,19].includes(number))pressureArmed=document.querySelector('#eventLayer').classList.contains('open');if([24,31].includes(number))awaiting='animation';if(number===14){electrostaticState.confirmed=!!window.__AEROSENSE_OPERATOR__?.state.electro.applied;awaiting='';}if(supported)start(number,options.present!==false||!!options.open,options.sound!==false);return result;};
 const previousClose=closeLayer;closeLayer=function(layer){const wasOpen=layer.classList.contains('open');const run=pressureArmed&&[1,18,19].includes(app.event)&&layer===document.querySelector('#eventLayer')&&wasOpen;if(bootSprayPending&&app.event===0&&layer===document.querySelector('#eventLayer')&&wasOpen){beginBootSpray();bootSprayPending=false;}const result=previousClose(layer);if(wasOpen)protectTransition();if(run){pressureArmed=false;start(app.event,false,false)}return result;};
 const previousConfirm=confirmControl;confirmControl=function(button){const n=app.event;const result=previousConfirm(button);if(n===21&&app.event===21)start(21,false,false);return result;};
 addEventListener('keydown',e=>{if(e.repeat&&['ArrowRight','ArrowDown','PageDown','ArrowLeft','ArrowUp','PageUp','Escape'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();return;}if(active&&e.key==='Escape'){finish(false);protectTransition();window.__AEROSENSE_TWIN__?.resetCamera()}},true);
 function endSegment(){const qualityScan=event===30&&segmentEnd===3,postScan=event===25&&segmentEnd===18;elapsed=Math.min(elapsed,segmentEnd);finish(true);if(qualityScan)awaiting='quality-treatment';if(postScan)awaiting='post-treatment';if(window.__AEROSENSE_RANKING_MODE__&&(qualityScan||postScan)&&!document.querySelector('#eventLayer').classList.contains('open'))openLayer(document.querySelector('#eventLayer'));if(window.__AEROSENSE_RANKING_MODE__&&event===25&&elapsed>=durations[25])window.__AEROSENSE_RANKING__?.completePostharvest();if(window.__AEROSENSE_RANKING_MODE__&&event===18&&elapsed>=durations[18])window.__AEROSENSE_RANKING__?.completeCooling?.();}
 function skipAnimation(){elapsed=segmentEnd;syncReadout();endSegment();protectTransition();}
 const oldFlow=handleFlowKey;handleFlowKey=function(direction){if(Date.now()<inputReadyAt)return;protectTransition();if(app.event===25&&direction<0&&event===25&&elapsed>=18&&awaiting!=='post-treatment'){finish(false);elapsed=18;awaiting='post-treatment';openLayer(document.querySelector('#eventLayer'));return;}if(app.event===25&&direction>0&&awaiting==='post-treatment'){closeLayer(document.querySelector('#eventLayer'));start(25,false,false,18);return;}if(direction>0&&app.event===31&&!active&&awaiting==='animation'&&document.querySelector('#eventLayer').classList.contains('open')){closeLayer(document.querySelector('#eventLayer'));start(31,false,true);return;}if(active&&direction>0){skipAnimation();return;}if(direction>0&&!document.querySelector('.layer.open')&&awaiting){const op=window.__AEROSENSE_OPERATOR__;if(op&&(app.event===24&&!op.canStartHarvest()||app.event===14&&!op.state.electro.applied)){awaiting='';stepEvent(1);return;}const offset=awaiting==='quality-treatment'?3:0;start(app.event,app.event===13,true,offset);return;}return oldFlow(direction);};
 function startConfirmedElectro(){if(app.event!==14||!window.__AEROSENSE_OPERATOR__?.state.electro.applied)return;electrostaticState.confirmed=true;awaiting='';document.querySelectorAll('.layer.open').forEach(closeLayer);closeLayer(document.querySelector('#eventLayer'));start(14,true,true);protectTransition();}
 window.confirmElectrostatic=()=>{if(app.event!==14||electrostaticState.confirmed)return;electrostaticState.confirmed=true;awaiting='';closeLayer(document.querySelector('#eventLayer'));start(14,false,false);protectTransition();};
 const originalOpen=openLayer;openLayer=function(layer){const play=active&&pendingSound&&layer===document.querySelector('#eventLayer');if(active){pressureArmed=false;finish(false);}const result=originalOpen(layer);protectTransition();if(play)playEventSound(app.event);return result;};
 // Keep the original model timeline; map it to 7.3s scanning and 11s treatment.
 function advancePostharvest(delta){
  const seconds=elapsed<=18?elapsed*7.3/18:7.3+(elapsed-18)*11/18,next=seconds+delta;
  elapsed=next>=18.3-1e-9?36:next>=7.3-1e-9?18+Math.max(0,next-7.3)*18/11:next*18/7.3;
 }
 document.addEventListener('visibilitychange',()=>{if(active&&[18,25].includes(event)&&window.__AEROSENSE_RANKING_MODE__)last=document.hidden?0:performance.now();});
 function tick(now){requestAnimationFrame(tick);if(!active||document.hidden||!startupFinished||!window.__AEROSENSE_TWIN__){last=0;return;}const other=document.querySelector('.layer.open');if(other){finish(false);return;}if(last){const delta=Math.max(0,(now-last)/1000);if(window.__AEROSENSE_RANKING_MODE__&&event===25)advancePostharvest(delta);else elapsed+=Math.min(1,delta)*(window.__AEROSENSE_RANKING_MODE__?(event===0?11/3.6:event===1?10/3:event===18?1:event===19?.8:event===29?5/3:event===31?2:event===24?4/3:event===14?9/8:event===23?1/.7:1):1);if(window.__AEROSENSE_RANKING_MODE__&&event===18&&elapsed>=8-1e-9)elapsed=8;}last=now;
 if(event===0){document.body.dataset.selfcheck=String(Math.floor(elapsed));document.querySelectorAll('.bay').forEach((e,i)=>e.classList.toggle('startup-online',elapsed>=i*.2));const lamps=[...document.querySelectorAll('#deviceStatus [data-state]')];lamps.forEach((e,i)=>{const step=window.__AEROSENSE_RANKING_MODE__?4/lamps.length:.35,start=(window.__AEROSENSE_RANKING_MODE__?3:2)+i*step,online=elapsed>=start+step;e.setAttribute('data-startup-check',online?'online':elapsed>=start?'checking':'pending');if(elapsed>=start&&!soundedSensors.has(i)){soundedSensors.add(i);if(!online&&pendingSound&&i<sensorTones.length)soundSequence([[sensorTones[i],0,.065,.015,'sine']]);}});}
 syncReadout();
 if(event===0){
  if(lightSwitchRevision!==revision){lightSwitchRevision=revision;lastLightSwitch=-1;}
  const channel=window.__AEROSENSE_RANKING_MODE__?(elapsed<2?-1:elapsed<3?0:5):(elapsed<4?-1:elapsed<7?Math.min(4,Math.floor((elapsed-4)/.6)):5);
  if(channel!==lastLightSwitch){lastLightSwitch=channel;if(channel>=0&&pendingSound)soundSequence([[760,0,.075,.014,'triangle'],[380,.018,.065,.009,'sine']]);}
 }
 if(elapsed>=segmentEnd){endSegment();updatePlots();}}
 requestAnimationFrame(tick);
 window.__AEROSENSE_SEQUENCE__={state,start,finish,startConfirmedElectro,
   skip(){if(!active)return false;if(event===14&&!window.__AEROSENSE_OPERATOR__?.state.electro.applied||event===17&&!window.__AEROSENSE_OPERATOR__?.state.rootAuthorized||event===24&&!window.__AEROSENSE_OPERATOR__?.canStartHarvest())return false;elapsed=segmentEnd;syncReadout();endSegment();protectTransition();updatePlots();return true;},
   restore(snapshot){finish(false);event=snapshot.event;elapsed=snapshot.elapsed;awaiting=snapshot.awaiting||'';segmentEnd=snapshot.segmentEnd??(awaiting==='post-treatment'?18:awaiting==='quality-treatment'?3:durations[event]);active=false;pending=false;pendingSound=false;revision++;syncReadout();updatePlots();},
   reset(){finish(false);bootCompleted=false;pressureArmed=false;bootSprayPending=false;event=-1;elapsed=0;awaiting='';pending=false;pendingSound=false;last=0;inputReadyAt=0;},get inputReady(){return Date.now()>=inputReadyAt;},get awaiting(){return awaiting;}};
 // The original page initializes before its 3D bundle. Defer the first card too.
 if([1,18,19].includes(app.event)){openLayer(document.querySelector('#eventLayer'));pressureArmed=true;}
 else if(app.event===14){awaiting='';}
 else if([24,31].includes(app.event)){awaiting='animation';}
 else if(app.event===17&&window.__AEROSENSE_OPERATOR__&&!window.__AEROSENSE_OPERATOR__.state.rootAuthorized){openLayer(document.querySelector('#eventLayer'));}
 else if(app.event in durations){closeLayer(document.querySelector('#eventLayer'));start(app.event,!query.has('sceneOnly'));}
})();
