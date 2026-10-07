/* System progression shares the 9:30 script's operation and narration windows. */
(()=>{
 if(!window.__AEROSENSE_RANKING_MODE__)return;
 document.body.classList.add('rank-mode');
 const layer=document.getElementById('eventLayer'),visual=document.getElementById('eventVisual');
 const sequence=window.__AEROSENSE_SEQUENCE__,op=window.__AEROSENSE_OPERATOR__,ui=window.__AEROSENSE_OPERATOR_UI__;
 const closing=window.__AEROSENSE_CLOSING__;
 const alarm={active:false,recovered:false};
 isHeatAlarm=()=>alarm.active;
 const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
 const phases=[
  {title:'自检与准备',section:0,start:'boot',seconds:20},
  {title:'显微与检测',section:0,start:'trace-start',seconds:105},
  {title:'定植与整定',section:1,start:'planting',seconds:70},
  {title:'接管与热胁迫',section:1,start:'ai-ops',seconds:105},
  {title:'膨大与采前评估',section:1,start:'light-bulking',seconds:45},
  {title:'采收与采后处理',section:2,start:'harvest',seconds:75},
  {title:'批次交付',section:2,start:'archive',seconds:25}
 ];
 // The script hands over an already prepared sample; enter the curve directly.
 const route=['boot','pressure','calibration','aseptic','trace-start','reaction-live','trace-review','planting','bay-link','vpa-setting','electrostatic','ai-ops','heat','root-scan','cooling','light-induction','oxygen','light-bulking','quality','spectral','harvest','grading','archive','complete'];
 const boot=eventByKey('boot');boot.title='系统自检';boot.facts=boot.facts.filter(text=>text!=='时间已校准');boot.desc=boot.desc.replace('，采集时间已完成校准','');
 if(currentEvent().key==='boot'){
  document.getElementById('eventTitle').textContent=boot.title;document.getElementById('eventDesc').textContent=boot.desc;
  document.getElementById('eventFacts').innerHTML=boot.facts.map(text=>'<div><b>'+text+'</b></div>').join('');
 }
 // ISE and aseptic verification keep their own original cards.
 const prepKeys=['vpd-auto','preheat'];
 const prepRecords=prepKeys.map(key=>({key,title:eventByKey(key).title,facts:clone(eventByKey(key).facts)}));
 const pressure=eventByKey('pressure');
 pressure.subtitle='设定压力4.0 bar · 阀组保压核验';
 pressure.lead='保压核验';pressure.desc='观察回路升压与保压，完成后核对压力与压降。';
 pressure.facts=['管路压力：待核验','压力下降：待核验'];
 Object.assign(eventByKey('reaction-live'),{subtitle:'三通道同步记录 · 演示×5.4',desc:'沿原仿真反应时间轴展示三通道信号；阳性越阈、阴性与样本基线同步复核。',facts:['原仿真时间轴0—100s','展示倍率×5.4','阈值0.45 RFU','三通道同步']});
 Object.assign(eventByKey('root-scan'),{title:'根系表型分析',subtitle:'RootPainter · 工作流参考',lead:'根系图层与环境记录联合复核',desc:'载入对应区位根像及分析图层，计算记录变化并核对同期环境越限，由操作员确认处置。',facts:['分割图层复核','分枝拓扑查看','根尖标记定位','记录变化与环境越限计算'],result:'根系记录对比与处置方案复核'});
 Object.assign(eventByKey('cooling'),{desc:'执行冠层通风与根区换热，分别核对两路响应；调控完成后复核焓值、叶温与VPD，满足复位判据后继续恢复观察。',facts:['根区目标18°C','VPD复位阈值'+STAGE_RECIPE.vpd.resetHigh.toFixed(2)+' kPa','冠层通风 / 根区换热','执行后复核反馈'],result:'根冠分区调控与回稳复核完成'});
 eventByKey('grading').facts=eventByKey('grading').facts.filter(t=>!t.includes('539'));
 eventByKey('grading').result='采后筛查与处理状态复核';
 eventByKey('harvest').result='柔性采收完成';
 for(const key of ['trace-start','bay-link','archive']){
  const e=eventByKey(key);e.desc=e.desc.replaceAll('系统生成SHA-256摘要并保存扫码记录','查看已有摘要与扫码记录');
 }
 const renderBefore=renderEventVisual;
 renderEventVisual=function(e){const markup=renderBefore(e);if(e.key==='pressure')return markup.replace('<span class="pressure-model-reading"></span>','');return e.key==='grading'?markup.replace('539 粒合格 · 1 粒剔除','<span data-rank-sort-count>采后筛查待启动</span>'):markup;};
 const reaction=window.__AEROSENSE_REACTION__,takeover=window.__AEROSENSE_TAKEOVER__;
 const motionBusy=()=>reaction.busy()||takeover.busy()||!!window.__AEROSENSE_PREPARATION__?.busy()||!!window.__AEROSENSE_WORKBENCH__?.busy();
 const toastNode=document.createElement('div');toastNode.className='ranking-toast';toastNode.hidden=true;toastNode.setAttribute('role','status');document.body.append(toastNode);let toastTimer;
 function toast(message){toastNode.textContent=message;toastNode.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastNode.hidden=true,2200);}
 function phaseOf(key=currentEvent().key){const pos=route.indexOf(key);let found=0;for(let i=0;i<phases.length;i++)if(pos>=route.indexOf(phases[i].start))found=i;return found;}
 let started=false,starting=false,entry=0;const soundMarks=new Set();
 const autoPreparation={active:false,cardElapsed:0,last:0,cardVisible:false};
 const autoOxygen={active:false,cardElapsed:0,last:0};
 const autoBulking={active:false,phase:'card',cardElapsed:0,last:0};
 function stopAutoBulking(){autoBulking.active=false;autoBulking.phase='card';autoBulking.cardElapsed=0;autoBulking.last=0;}
 function stopAutoOxygen(){autoOxygen.active=false;autoOxygen.cardElapsed=0;autoOxygen.last=0;}
 function stopAutoPreparation(){stopAutoOxygen();stopAutoBulking();autoPreparation.active=false;autoPreparation.cardElapsed=0;autoPreparation.last=0;autoPreparation.cardVisible=false;}
 function armAutoPreparation(){stopAutoPreparation();autoPreparation.active=true;}
 const snapshots=new Map(),latest=new Map(),completed=new Set(),played=new Set();let internal=false,restoring=false,lastStable='';
 const originalSet=setEvent,originalFlow=handleFlowKey,originalLog=logEvent,originalSound=playEventSound;
 const originalOpen=openLayer;
 openLayer=function(target){if(target===layer&&['oxygen','cooling','quality','vpa-setting','harvest','grading'].includes(currentEvent().key))return;const value=originalOpen(target);if(target===layer&&currentEvent().key==='boot'&&autoPreparation.active&&performed()){autoPreparation.cardVisible=true;autoPreparation.cardElapsed=0;autoPreparation.last=performance.now();}return value;};
 function capture(){return {key:currentEvent().key,operator:clone(op.state),alarm:clone(alarm),ui:ui.snapshot(),sequence:clone(sequence.state()),awaiting:sequence.awaiting,series:clone(seriesByBay.B05),reaction:reaction.snapshot(),takeover:takeover.snapshot()};}
 function save(){if(sequence.state().active||window.__AEROSENSE_LOADING__?.busy()||motionBusy())return;const s=capture();s.sequence.awaiting=s.awaiting;snapshots.set(s.key,s);latest.set(phaseOf(s.key),s);}
 function readPhase(){document.body.dataset.rankPhase=String(phaseOf());layer.classList.toggle('rank-prep-summary',currentEvent().key==='pressure');}
 function pendingMessage(key=currentEvent().key){
  if(window.__AEROSENSE_LOADING__?.busy())return '模型分析进行中，请等待结果或取消分析';
  if(motionBusy())return '展示过程进行中，请完成播放和人工判读';
  if(sequence.state().active)return '当前动作正在执行，请待完成后推进';
  if(key==='electrostatic'&&!op.state.electro.applied)return '请核对参数并应用静电整定';
  if(key==='heat'&&!op.state.rootAuthorized)return ui.snapshot().selectedModule==='root'?'请载入根系结果，复核B05异常':'B05热胁迫报警待处置，请进入根系诊断';
  if(key==='cooling'&&alarm.active)return 'B05调控执行后继续监测，达到回稳判据后报警复位';
  if(key==='root-scan'&&!window.__AEROSENSE_REVIEW__.state().confirmed)return '请计算变化、比较方案并确认根冠分区目标';
  if(key==='grading'&&sequence.state().elapsed<36)return '采后筛查与处理尚未完成';
  if(!performed())return '当前运行尚未结束，请完成该步骤后推进';
  return '';
 }
 const timings={boot:11,pressure:10,planting:4,'vpa-setting':12,electrostatic:9,heat:4,'root-scan':3,cooling:8,'light-induction':5,oxygen:8,'light-bulking':5,quality:7,spectral:6,harvest:16,grading:36};
 function performed(){const q=sequence.state(),key=currentEvent().key;if(key==='cooling'&&alarm.active)return false;if(q.active||motionBusy())return false;if(key==='electrostatic'&&!op.state.electro.applied||key==='root-scan'&&(!op.state.rootAuthorized||!window.__AEROSENSE_REVIEW__.state().confirmed))return false;if(key==='reaction-live')return reaction.session.completed;if(key==='ai-ops')return takeover.snapshot().elapsed>=21;return !(key in timings)||q.event===eventNumber(key)&&q.elapsed>=timings[key];}
 function writeCompleted(){if(!started||restoring)return;const key=currentEvent().key;if(!performed()||completed.has(key))return;completed.add(key);if(['electrostatic','root-scan','cooling','oxygen','harvest','grading'].includes(key)){const mark=entry+':complete:'+key;if(started&&!restoring&&!soundMarks.has(mark)){soundMarks.add(mark);originalSound(eventNumber(key));}}if(['electrostatic','root-scan','cooling','oxygen','harvest','grading'].includes(key))originalLog({...currentEvent(),result:key==='grading'?'扫描分流及后处理展示完成':currentEvent().result},false);}
 function setSummary(){
  const key=currentEvent().key,pos=route.indexOf(key),q=sequence.state(),at=k=>route.indexOf(k),delivered=['archive','complete'].includes(key);
  const harvested=pos>at('harvest')||key==='harvest'&&q.event===eventNumber('harvest')&&!q.active&&q.elapsed>=16;
  const screened=pos>at('grading')||key==='grading'&&q.event===eventNumber('grading')&&q.elapsed>=18;
  document.getElementById('yieldLabel').textContent=delivered?'交付数量':screened?'合格数量':harvested?'采收数量':'预测薯量';
  document.getElementById('yieldSummary').innerHTML='<em>'+(screened||delivered?539:540)+'</em> 粒';
  const carbon=document.getElementById('carbonSummary');carbon.textContent=FINAL_CARBON_FOOTPRINT;
  const carbonLabel=carbon.parentElement;for(const n of carbonLabel.childNodes)if(n.nodeType===Node.TEXT_NODE)n.textContent='碳足迹测算';
  document.getElementById('releaseLabel').textContent='质控状态';
  let status='待源头检测';
  if(key==='reaction-live')status=reaction.session.completed?'源头检测通过':'源头检测中';
  else if(pos>at('reaction-live'))status='源头检测通过';
  if(key==='spectral')status=q.event===eventNumber('spectral')&&!q.active&&q.elapsed>=6?'采前校验通过':'采前校验中';
  else if(pos>at('spectral'))status='待采后筛查';
  if(key==='grading')status=screened?'采后筛查通过':'采后筛查中';
  if(key==='archive')status='批次已入库';if(key==='complete')status='交付完成';
  document.getElementById('releaseSummary').textContent=status;
  const sortCount=visual.querySelector('[data-rank-sort-count]');if(sortCount)sortCount.textContent=screened?'539 粒合格 · 1 粒剔除':key==='grading'&&q.active?'采后筛查中':'采后筛查待启动';
 }

 setEvent=function(n,options={}){
  const key=events[Number(n)]?.key,previousKey=currentEvent().key;
  if(!restoring&&!internal&&!route.includes(key)){toast('此事件属于完整流程，请使用完整模式');return;}
  if(!restoring&&key==='root-scan'&&!op.state.rootAuthorized){toast('根系分析需人工启动');return;}
  if(!restoring&&!internal&&key!=='root-scan'&&route.includes(key)&&key!==currentEvent().key){const wait=pendingMessage();if(wait){toast(wait);return;}}
  if(!restoring&&closing.busy()&&!['archive','complete'].includes(key))closing.cancel();
  // Root activation sets its authorization before setEvent. Keep the stable
  // heat snapshot, which precedes that transition, rather than overwriting it.
  if(!restoring&&!(key==='root-scan'&&currentEvent().key==='heat'&&op.state.rootAuthorized))save();
  if(!restoring&&key!==currentEvent().key){const cached=snapshots.get(key);if(key==='pressure'&&cached?.sequence.event===eventNumber('pressure')&&cached.sequence.elapsed>=10||key==='calibration'&&cached?.operator.preparation?.ise?.complete||key==='aseptic'&&cached?.operator.preparation?.aseptic?.complete)return restore(cached,{present:true});}
  if(!restoring&&key!==currentEvent().key)entry++;
  if(!restoring){if(key==='heat'||key==='root-scan'){alarm.active=true;alarm.recovered=false;}else if(route.indexOf(key)<route.indexOf('heat')){alarm.active=false;alarm.recovered=false;}}
  if(!restoring&&key==='cooling'&&previousKey!=='cooling')delete op.state.coolingResponse;
  const value=originalSet(n,{...options,...(['complete','oxygen','cooling','pressure','planting','light-induction','light-bulking','quality','vpa-setting','harvest','grading'].includes(key)?{open:false,present:false}:{}),log:false,sound:!restoring&&!!options.sound});
  if(!restoring&&key==='oxygen')startOxygen();
  if(!restoring&&key==='cooling'){sequence.start(n,false,false);syncCoolingResponse();syncHeatAlarm();}
  if(!restoring&&key==='light-induction'){showInductionCard();if(options.sound)playEventSound(n);}
  if(!restoring&&key==='light-bulking'){showBulkingCard();if(options.sound)playEventSound(n);}
  if(!restoring&&key==='pressure')sequence.start(n,!autoPreparation.active,false);
  if(!restoring&&key==='vpa-setting')sequence.start(n,false,false);
  if(!restoring&&key==='harvest')startHarvest();
  readPhase();setSummary();
  if(!restoring&&!sequence.state().active&&!['electrostatic','root-scan','harvest','grading','quality','reaction-live','ai-ops'].includes(key))save();
  if(!restoring&&key==='archive'&&previousKey!=='archive')startClosing();
  return value;
 };
 logEvent=function(e,...args){if(restoring)return;if(completed.has(e.key)&&!e.result?.includes('启动')&&!e.result?.includes('核准'))return;return originalLog(e,...args);};
 playEventSound=function(n){const mark=entry+':event:'+events[n]?.key;if(restoring||!started||completed.has(events[n]?.key)||soundMarks.has(mark))return;soundMarks.add(mark);return originalSound(n);};
 const oldAlarm=alarmSound;alarmSound=function(){const mark=entry+':alarm';if(restoring||!started||soundMarks.has(mark))return;soundMarks.add(mark);return oldAlarm();};
 function visit(key,options={}){internal=true;try{return setEvent(eventNumber(key),options);}finally{internal=false;}}
 function startHarvest(){
  if(currentEvent().key!=='harvest'||sequence.state().active)return false;
  closeLayer(layer);closeLayer(document.getElementById('bayLayer'));
  sequence.start(eventNumber('harvest'),false,false);
  window.__AEROSENSE_TWIN__?.resetCamera?.();
  return sequence.state().active;
 }
 function startPostharvest(){
  if(currentEvent().key!=='grading'||sequence.state().active)return false;
  closeLayer(layer);closeLayer(document.getElementById('bayLayer'));
  sequence.start(eventNumber('grading'),false,false);
  return sequence.state().active;
 }
 function completePostharvest(){
  const q=sequence.state();
  if(!started||restoring||currentEvent().key!=='grading'||q.active||q.event!==eventNumber('grading')||q.elapsed<36)return false;
  writeCompleted();save();closeLayer(layer);closeLayer(document.getElementById('bayLayer'));
  visit('archive',{sound:true});return true;
 }
 function startClosing(){
  if(!started||currentEvent().key!=='archive')return false;
  openLayer(layer);
  return closing.start({
   valid:()=>started&&['archive','complete'].includes(currentEvent().key),
   statement(){writeCompleted();save();closeLayer(layer);closeLayer(document.getElementById('bayLayer'));visit('complete',{open:false,sound:false,present:false});},
   finish(){document.body.focus({preventScroll:true});}
  });
 }
 function showBulkingCard(){
  sequence.restore({event:eventNumber('light-bulking'),elapsed:0,awaiting:''});openLayer(layer);
  autoBulking.active=true;autoBulking.phase='card';autoBulking.cardElapsed=0;autoBulking.last=performance.now();
 }
 function startBulkingParameters(){
  closeLayer(layer);autoBulking.active=true;autoBulking.phase='parameters';autoBulking.last=0;
  sequence.start(eventNumber('light-bulking'),false,false);updatePlots();
 }
 function continueBulking(){
  if(!autoBulking.active||!started||restoring)return;
  if(currentEvent().key!=='light-bulking'){stopAutoBulking();return;}
  const now=performance.now();if(document.hidden){autoBulking.last=0;return;}
  if(autoBulking.phase==='card'){
   if(!layer.classList.contains('open')){stopAutoBulking();return;}
   if(autoBulking.last)autoBulking.cardElapsed+=(now-autoBulking.last)/1000;autoBulking.last=now;
   if(autoBulking.cardElapsed>=3)startBulkingParameters();return;
  }
  if(!performed())return;
  writeCompleted();save();stopAutoBulking();visit('quality',{open:false,sound:false,present:false});
 }
 function showInductionCard(){
  sequence.restore({event:eventNumber('light-induction'),elapsed:5,awaiting:''});
  openLayer(layer);autoOxygen.active=true;autoOxygen.cardElapsed=0;autoOxygen.last=performance.now();
 }
 function startOxygen(){
  stopAutoOxygen();closeLayer(layer);closeLayer(document.getElementById('bayLayer'));
  const s=seriesByBay.B05;s.state.do=8;s.do[s.do.length-1]=8;
  sequence.start(eventNumber('oxygen'),false,false);syncOxygenState();updatePlots();
 }
 function continueOxygen(){
  if(!autoOxygen.active||!started||restoring)return;
  if(currentEvent().key!=='light-induction'||!layer.classList.contains('open')){stopAutoOxygen();return;}
  const now=performance.now();if(document.hidden){autoOxygen.last=0;return;}
  if(autoOxygen.last)autoOxygen.cardElapsed+=(now-autoOxygen.last)/1000;autoOxygen.last=now;
  if(autoOxygen.cardElapsed<2)return;
  stopAutoOxygen();writeCompleted();save();closeLayer(layer);visit('oxygen',{open:false,sound:false,present:false});
 }
 function restore(s,{present=false,replay=true}={}){
  closing.cancel();
  restoring=true;try{
   window.__AEROSENSE_PREPARATION__?.cancel();window.__AEROSENSE_WORKBENCH__?.cancel();window.__AEROSENSE_LOADING__?.cancel();sequence.finish(false);reaction.pause();takeover.pause();Object.assign(alarm,s.alarm||{active:['heat','root-scan'].includes(s.key),recovered:false});Object.assign(op.state,clone(s.operator));
   for(const key of Object.keys(seriesByBay.B05))delete seriesByBay.B05[key];Object.assign(seriesByBay.B05,clone(s.series));
   originalSet(eventNumber(s.key),{log:false,sound:false,present:false});
   if(s.key==='oxygen')Object.assign(seriesByBay.B05,clone(s.series));
   Object.assign(op.state,clone(s.operator));electrostaticState.confirmed=!!op.state.electro.applied;sequence.restore({...s.sequence,awaiting:s.awaiting});reaction.restore(s.reaction);const restoredUI=clone(s.ui);if(present){restoredUI.selectedModule=s.key==='root-scan'?'root':s.key==='electrostatic'?'electro':null;}ui.restore(restoredUI);
   reaction.update();closeLayer(layer);closeLayer(document.getElementById('bayLayer'));if(present&&!ui.snapshot().selectedModule&&!['complete','oxygen','cooling','quality','harvest','grading'].includes(s.key))openLayer(layer);takeover.restore(s.takeover);readPhase();setSummary();updatePlots();syncHeatAlarm();syncOxygenState();window.__AEROSENSE_PREPARATION__?.sync();window.__AEROSENSE_QUALITY_DISPLAY__?.sync();if(!alarm.active)stopAlarm();
  }finally{restoring=false;}
  if(replay&&s.key==='vpa-setting')sequence.start(eventNumber('vpa-setting'),false,false);
  if(replay&&s.key==='oxygen')startOxygen();
  if(replay&&s.key==='harvest')startHarvest();
  if(replay&&s.key==='grading')startPostharvest();
  if(replay&&s.key==='cooling'){alarm.active=true;alarm.recovered=false;sequence.start(eventNumber('cooling'),false,false);syncCoolingResponse();syncHeatAlarm();updatePlots();}
  if(replay&&s.key==='light-induction')showInductionCard();
  if(replay&&s.key==='light-bulking')showBulkingCard();
  if(layer.classList.contains('open')||present&&ui.snapshot().selectedModule)originalSound(eventNumber(s.key));
 }
 function goPhase(index){
  closing.cancel();
  stopAutoPreparation();
  if(sequence.state().active||window.__AEROSENSE_LOADING__?.busy()||motionBusy()){toast('当前动作进行中，完成后可切换环节');return false;}
  if(!started)return false;save();const cached=latest.get(index);if(!cached){toast('此环节尚未展示，请沿主线推进');return false;}
  restore(cached);
  return true;
 }
 function backOne(){
  closing.cancel();
  stopAutoPreparation();
  if(!started)return false;
  const pos=route.indexOf(currentEvent().key);if(pos<=0)return false;
  save();const key=route[pos-1],cached=snapshots.get(key);
  window.__AEROSENSE_PREPARATION__?.cancel();window.__AEROSENSE_WORKBENCH__?.cancel();window.__AEROSENSE_LOADING__?.cancel();sequence.finish(false);reaction.pause();takeover.pause();
  closeLayer(layer);closeLayer(document.getElementById('bayLayer'));
  if(cached)restore(cached,{present:true});else visit(key,{sound:true,present:true});
  originalLog({...currentEvent(),result:'查看既有状态'},false,'prev');
  document.body.focus({preventScroll:true});return true;
 }
 stepEvent=function(direction){
  if(!internal)stopAutoPreparation();
  if(direction<0)return backOne();
  if(direction>0&&closing.busy())return closing.skip();
  if(direction>0&&currentEvent().key==='archive'){startClosing();return;}
  if(sequence.state().active||window.__AEROSENSE_LOADING__?.busy()||motionBusy()){toast(pendingMessage());return;}
  const pos=route.indexOf(currentEvent().key);
  if(direction>0){const wait=pendingMessage();if(wait){toast(wait);return;}writeCompleted();const next=route[Math.min(route.length-1,pos+1)];if(next!==currentEvent().key)visit(next,{sound:true});}
 };
 handleFlowKey=function(direction){
  stopAutoPreparation();
  if(!started)return;if(direction<0)return backOne();if(!sequence.inputReady)return;
  if(direction>0&&closing.busy()){closing.skip();return;}
  if(direction>0&&currentEvent().key==='archive'){startClosing();return;}
  if(direction>0&&currentEvent().key==='reaction-live'&&reaction.session.pausedAt){openLayer(layer);reaction.resume();return;}
  if(direction>0&&currentEvent().key==='ai-ops'&&takeover.snapshot().paused){const saved=takeover.snapshot();openLayer(layer);takeover.restore(saved);takeover.resume();return;}
  if(sequence.state().active||window.__AEROSENSE_LOADING__?.busy()||motionBusy()){if(direction>0)skipCurrent();return;}
  const key=currentEvent().key;
  if(direction>0&&key==='cooling'&&alarm.active&&sequence.state().elapsed>=8){skipCurrent();return;}
  if(direction>0&&layer.classList.contains('open')&&['heat','root-scan','cooling'].includes(key)){processAlarm();return;}
  if(direction>0&&key==='vpa-setting'&&sequence.awaiting==='animation'){originalFlow(1);return;}
  if(direction>0&&key==='harvest'&&sequence.awaiting==='animation'){startHarvest();return;}
  if(direction>0&&key in timings&&!sequence.awaiting&&!performed()){
   const q=sequence.state(),allowed=key!=='electrostatic'||op.state.electro.applied;
   if(allowed&&q.elapsed<timings[key]&&q.event===eventNumber(key)&&(key!=='root-scan'||op.state.rootAuthorized)){
    closeLayer(layer);sequence.start(q.event,false,false,q.elapsed);return;
   }
  }
  if(direction>0&&key==='light-bulking'&&layer.classList.contains('open')&&sequence.state().elapsed<5){startBulkingParameters();return;}
  if(direction>0&&key==='light-induction'){writeCompleted();save();closeLayer(layer);visit('oxygen',{open:false,sound:false,present:false});return;}
  if(direction>0&&key==='planting'&&performed()){if(layer.classList.contains('open'))closeLayer(layer);stepEvent(1);return;}
  if(layer.classList.contains('open')){closeLayer(layer);document.body.focus({preventScroll:true});return;}
  const bay=document.getElementById('bayLayer');if(bay.classList.contains('open')){closeLayer(bay);return;}
  stepEvent(direction);
 };
 function skipCurrent(){
  if(!started)return false;
  if(closing.busy())return closing.skip();
  if(window.__AEROSENSE_PREPARATION__?.busy())return window.__AEROSENSE_PREPARATION__.skip();
  if(window.__AEROSENSE_WORKBENCH__?.busy())return window.__AEROSENSE_WORKBENCH__.skip();
  if(window.__AEROSENSE_LOADING__?.busy())return window.__AEROSENSE_LOADING__.skip();
  if(reaction.busy())return reaction.skip();
  if(takeover.busy())return takeover.skip();
  const completed=sequence.skip(),q=sequence.state();
  // Finish the local response along with a fast-forwarded cooling segment.
  if(currentEvent().key==='cooling'&&q.event===eventNumber('cooling')&&q.elapsed>=8&&window.__AEROSENSE_REVIEW__.state().confirmed){
   primeEventState();updatePlots();syncHeatAlarm();return true;
  }
  return completed;
 }
 function continuePreparation(){
  if(!autoPreparation.active||!started||restoring)return;
  const now=performance.now();
  if(document.hidden){autoPreparation.last=0;return;}
  const key=currentEvent().key;
  if(key==='boot'){
   if(!performed()||!layer.classList.contains('open')){autoPreparation.last=0;autoPreparation.cardVisible=false;autoPreparation.cardElapsed=0;return;}
   if(!autoPreparation.cardVisible){autoPreparation.cardVisible=true;autoPreparation.last=now;return;}
   if(autoPreparation.last)autoPreparation.cardElapsed+=(now-autoPreparation.last)/1000;
   autoPreparation.last=now;if(autoPreparation.cardElapsed<1)return;
   closeLayer(layer);writeCompleted();save();visit('pressure',{open:false,sound:true,present:false});return;
  }
  if(key==='pressure'){
   if(!performed())return;
   window.__AEROSENSE_PREPARATION__?.sync();closeLayer(layer);writeCompleted();save();visit('calibration',{open:true,sound:true});return;
  }
  if(key==='calibration'){
   if(!window.__AEROSENSE_PREPARATION__?.state().ise.complete||motionBusy())return;
   closeLayer(layer);writeCompleted();save();visit('aseptic',{open:true,sound:true});return;
  }
  if(key==='aseptic'){
   if(!window.__AEROSENSE_PREPARATION__?.state().aseptic.complete||motionBusy())return;
   closeLayer(layer);writeCompleted();save();stopAutoPreparation();return;
  }
  stopAutoPreparation();
 }
 function paint(){
  const key=currentEvent().key,q=sequence.state();
  syncHeatAlarm();syncOxygenState();paintAlarmAction();
  if(!q.active&&!window.__AEROSENSE_LOADING__?.busy()&&!motionBusy()){
   const stamp=key+'|'+q.elapsed+'|'+sequence.awaiting+'|'+op.state.electro.applied+'|'+!!op.state.rootAuthorized+'|'+!!window.__AEROSENSE_REVIEW__.state().confirmed+'|'+op.state.harvest.approved+'|'+layer.classList.contains('open')+'|'+reaction.session.completed+'|'+takeover.snapshot().elapsed;
   if(stamp!==lastStable){lastStable=stamp;writeCompleted();save();}
  }
  readPhase();setSummary();continuePreparation();continueOxygen();continueBulking();
 }
 const alarmKeys=new Set(['heat','root-scan','cooling']);
 const eventClose=document.getElementById('eventClose'),normalClose=eventClose.onclick;
 eventClose.addEventListener('click',()=>{stopAutoPreparation();closing.cancel();},true);layer.addEventListener('click',e=>{if(e.target===layer){stopAutoPreparation();closing.cancel();}},true);
 addEventListener('keydown',e=>{if(e.key==='Escape'){stopAutoPreparation();closing.cancel();}},true);
 document.addEventListener('visibilitychange',()=>{autoPreparation.last=0;autoOxygen.last=0;autoBulking.last=0;});
 const normalCloseLabel=eventClose.getAttribute('aria-label'),normalCloseTitle=eventClose.getAttribute('title');
 function processAlarm(){
  const key=currentEvent().key;
  if(sequence.state().active||window.__AEROSENSE_LOADING__?.busy())return false;
  if(key==='heat'||key==='root-scan')return ui.diagnoseHeat();
  if(key==='cooling'){closeLayer(layer);document.body.focus({preventScroll:true});return true;}
  return false;
 }
 function paintAlarmAction(){
  const key=currentEvent().key,process=alarmKeys.has(key);
  eventClose.classList.toggle('process-action',process);
  if(process){
   layer.dataset.alarmWorkflow=key;
   const q=sequence.state();
   const label=key==='heat'?'根系诊断':key==='root-scan'?'处置方案':key==='cooling'?(q.event===eventNumber('cooling')&&q.elapsed>=8?'回稳监测':'执行调控'):'回稳监测';
   eventClose.textContent=label;eventClose.setAttribute('aria-label',label);eventClose.removeAttribute('title');
   eventClose.disabled=q.active||!!window.__AEROSENSE_LOADING__?.busy();
  }else if(layer.hasAttribute('data-alarm-workflow')){
   delete layer.dataset.alarmWorkflow;eventClose.textContent='×';eventClose.disabled=false;
   if(normalCloseLabel)eventClose.setAttribute('aria-label',normalCloseLabel);else eventClose.removeAttribute('aria-label');
   if(normalCloseTitle)eventClose.setAttribute('title',normalCloseTitle);
  }
 }
 eventClose.onclick=()=>alarmKeys.has(currentEvent().key)?processAlarm():normalClose();
 const normalBackdrop=layer.onclick;
 layer.onclick=e=>{if(e.target===layer&&alarmKeys.has(currentEvent().key))return;normalBackdrop?.(e);};
 addEventListener('keydown',e=>{
  if(e.key==='Escape'&&alarmKeys.has(currentEvent().key)){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 const previousTargets=eventTargets;
 eventTargets=function(id){
  const target=previousTargets(id),q=sequence.state();
  if(id==='B05'&&currentEvent().key==='cooling'&&!(q.event===eventNumber('cooling')&&(q.active||q.elapsed>0))){
   target.h=55.6;target.vpd=1.36;target.canopy=29.6;
  }
  else if(id==='B05'&&currentEvent().key==='cooling'&&op.state.coolingResponse){for(const field of Object.keys(op.state.coolingResponse.to))target[field]=seriesByBay.B05.state[field];}
  return target;
 };
 function syncCoolingResponse(){
  if(restoring||currentEvent().key!=='cooling')return;
  const q=sequence.state();if(q.event!==eventNumber('cooling')||!q.active&&q.elapsed<=0)return;
  const s=seriesByBay.B05;
  if(!op.state.coolingResponse){
   const target=previousTargets('B05'),from={},to={};
   for(const field of ['h','vpd','canopy','temp','do']){
    if(!Array.isArray(s[field])||!Number.isFinite(target[field]))continue;
    from[field]=Number.isFinite(s.state[field])?s.state[field]:s[field].at(-1);to[field]=target[field];
   }
   op.state.coolingResponse={from,to};
  }
  const response=op.state.coolingResponse,u=Math.min(1,Math.max(0,q.elapsed/8)),blend=u*u*(3-2*u);
  for(const field of Object.keys(response.to)){
   const value=response.from[field]+(response.to[field]-response.from[field])*blend;
   s.state[field]=value;s[field][s[field].length-1]=value;if(s.noise)s.noise[field]=0;
  }
 }
 function completeCooling(){
  const q=sequence.state();if(restoring||currentEvent().key!=='cooling'||q.event!==eventNumber('cooling')||q.active||q.elapsed<8)return false;
  syncHeatAlarm();updatePlots();return !alarm.active;
 }
 function syncHeatAlarm(){
  syncCoolingResponse();
  const key=currentEvent().key,q=sequence.state(),s=seriesByBay.B05;
  const readings={h:s.h.at(-1),canopy:s.canopy.at(-1),vpd:s.vpd.at(-1)};
  // The original recipe supplies a hysteresis reset at 1.00 kPa. Reset never follows navigation.
  const resetReady=readings.h>=51.8&&readings.h<=52.9&&readings.canopy>=23&&readings.canopy<=25&&readings.vpd>=STAGE_RECIPE.vpd.normal[0]&&readings.vpd<=STAGE_RECIPE.vpd.resetHigh;
  if(alarm.active&&key==='cooling'&&q.event===eventNumber('cooling')&&!q.active&&q.elapsed>=8&&window.__AEROSENSE_REVIEW__.state().confirmed&&resetReady){
   alarm.active=false;alarm.recovered=true;stopAlarm();
   originalLog({...currentEvent(),result:'B05热报警复位：调控执行完成，焓值、叶温及VPD达到回稳判据'},false);
  }
  const heat=alarm.active,k=isPotassiumAlarm(),any=heat||k;
  document.getElementById('app').classList.toggle('alarm-active',any);document.body.classList.toggle('alarm-active',any);
  document.getElementById('globalAlarm').setAttribute('aria-hidden',String(!any));
  if(heat)document.getElementById('globalAlarmText').textContent=key==='cooling'?'B05 · 调控执行与回稳监测':'B05 · 热胁迫待处置';
  if(heat)document.getElementById('systemState').textContent=key==='cooling'?'调控回稳中':'系统报警';
  else if(key==='cooling'&&alarm.recovered)document.getElementById('systemState').textContent='报警复位 · 恢复观察';
  const bay=document.querySelector('.bay[data-id="B05"]');bay.classList.toggle('alert',any);
  if(heat)bay.querySelector('.state').textContent=key==='cooling'?'调控回稳中':'需要处置';
  else if(key==='cooling'&&alarm.recovered)bay.querySelector('.state').textContent='恢复观察';
  syncAlarmPanels(heat,k);updateTwinUI();
  if(key==='cooling'){const fields=visual.querySelectorAll('.thermal-readout b'),values=[readings.canopy.toFixed(1)+' °C',s.temp.at(-1).toFixed(1)+' °C',readings.vpd.toFixed(2)+' kPa',q.event===eventNumber('cooling')&&(q.active||q.elapsed>0)?'分区响应':'待执行'];fields.forEach((node,i)=>{if(values[i])node.textContent=values[i];});}
 }
 function syncOxygenState(){
  const key=currentEvent().key,q=sequence.state(),oxygenPosition=route.indexOf('oxygen'),position=route.indexOf(key);
  const running=key==='oxygen'&&q.event===eventNumber('oxygen')&&q.elapsed>0;
  document.body.dataset.oxygenState=position>oxygenPosition||running&&q.elapsed>=8?'complete':running?'rising':'idle';
 }
 op.state.workbench={rootView:1,markers:false,voltage:'',electroComputed:false,rootComputed:false,query:'',message:''};
 const initialSnapshot=capture(),initialLog=document.querySelector('#logTable tbody').innerHTML;
 addEventListener('aerosense:ready',()=>{started=true;starting=false;armAutoPreparation();if(!sequence.state().active)visit('boot',{open:true,sound:true});readPhase();});
 addEventListener('keydown',e=>{if(!started||e.key!=='Escape')return;if(reaction.busy())reaction.pause();if(takeover.busy())takeover.pause();},true);
 function restart(){stopAutoPreparation();window.__AEROSENSE_PREPARATION__?.cancel();window.__AEROSENSE_WORKBENCH__?.cancel();window.__AEROSENSE_LOADING__?.cancel();sequence.finish(false);stopCrisprClock();stopAlarm();started=false;starting=false;restore(initialSnapshot,{replay:false});sequence.reset();reaction.reset();takeover.reset();snapshots.clear();latest.clear();completed.clear();played.clear();soundMarks.clear();lastStable='';entry=0;document.querySelector('#logTable tbody').innerHTML=initialLog;window.__AEROSENSE_EVENT_LOG__?.reset();startup.classList.remove('is-complete');startup.dataset.phase='standby';startup.setAttribute('aria-hidden','false');document.querySelector('#standbyView').setAttribute('aria-hidden','false');document.querySelector('#bootView').setAttribute('aria-hidden','true');startupFinished=false;startupRunning=false;setBootProgress(0);window.addEventListener('keydown',startupKeyGuard,true);return true;}
 window.__AEROSENSE_RANKING__={phases,route,prepRecords,isStarted:()=>started,isRestoring:()=>restoring,state:()=>({started,starting,autoPreparation:clone(autoPreparation),autoOxygen:clone(autoOxygen),autoBulking:clone(autoBulking),closing:closing.state(),key:currentEvent().key,phase:phaseOf(),pending:pendingMessage(),completed:[...completed],sequence:clone(sequence.state()),reaction:reaction.snapshot(),takeover:takeover.snapshot(),awaiting:sequence.awaiting,operator:clone(op.state),alarm:clone(alarm)}),goPhase,restart,completePostharvest,syncCoolingResponse,completeCooling,skip:skipCurrent,start:()=>window.__START_SYSTEM__(),advance:()=>handleFlowKey(1),back:()=>handleFlowKey(-1),snapshots};
 setInterval(paint,100);paint();
})();
