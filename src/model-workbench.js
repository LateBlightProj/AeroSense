/* Model workbench: retain AeroSense's instrument surface; inspect case evidence,
   run local arithmetic, and leave parameter application to the operator.
   RootPainter is a workflow reference, not an installed inference engine. */
(()=>{
 if(!window.__AEROSENSE_RANKING_MODE__)return;
 const op=window.__AEROSENSE_OPERATOR__,ui=window.__AEROSENSE_OPERATOR_UI__;
 const host=document.createElement('div');host.className='model-workbench';host.hidden=true;
 document.body.append(host);
 const panel=document.querySelector('.operator-console');host.append(panel);
 panel.setAttribute('tabindex','-1');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','wb-title');
 const data=window.__AEROSENSE_ROOT_CASE__;
 const number=(v,d=2)=>Number(v).toFixed(d);
 const safe=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const wb=()=>{
  const s=op.state.workbench||(op.state.workbench={rootView:1,markers:false,voltage:'',electroComputed:false,rootComputed:false,query:'',message:''});
  s.electroDraft??={humidity:'',area:''};s.electroRecord??={humidity:85,area:120};return s;
 };
 const electroInputs=()=>choice?.input==='loaded'?wb().electroRecord:wb().electroDraft;
 const inputSignature=v=>JSON.stringify([Number(v.humidity),Number(v.area)]);
 const electroReady=()=>wb().electroComputed&&op.state.electro.loaded&&op.state.electro.valid&&wb().electroResultInputs===inputSignature(electroInputs());
 function invalidateElectro(){
  cancel();const s=wb();s.electroComputed=false;s.electroResultInputs=null;s.voltage='';s.message='';
  Object.assign(op.state.electro,{loaded:false,valid:false,correction:null,reference:null,voltage:null,applied:false});
  const input=panel.querySelector('[data-op-input="voltage"]');if(input)input.value='';lastStamp='';
 }
 function changeSource(value){invalidateElectro();choice.input=value;}
 function canApplyElectro(){
  const input=panel.querySelector('[data-op-input="voltage"]');
  return !job&&electroReady()&&!op.state.electro.applied&&!!input&&input.value!==''&&input.checkValidity()&&currentEvent().key==='electrostatic';
 }
 const review=()=>window.__AEROSENSE_REVIEW__.state();
 let module=null,choice=null,environment=null,lastStamp='',returnFocus=null,job=null,frameId=0,lastDraw=0;
 const plotResize=new ResizeObserver(entries=>{
  if(host.hidden||module!=='electro')return;
  const plot=panel.querySelector('[data-wb-electro-chart]');
  if(entries.some(entry=>entry.target===plot)&&plot)plot.innerHTML=electroChart();
 });
 const rootStages=['图像读取','分割图层','分枝拓扑','根尖定位','指标计算'];
 const electroStages=['参数读取','参考计算','结果输出'];
 const field=(label,attrs,value)=>'<label><span>'+label+'</span><input '+attrs+' value="'+safe(value)+'"></label>';
 const options=(name,label,items,value)=>'<label><span>'+label+'</span><select '+name+'>'+items.map(([v,t])=>'<option value="'+v+'"'+(value===v?' selected':'')+'>'+t+'</option>').join('')+'</select></label>';
 const action=(name,text,extra='')=>'<button type="button" data-op="'+name+'" '+extra+'>'+text+'</button>';
 const task=name=>name==='electro'?'计算B05参考电压':'分析B05根系，结合环境数据给出调控建议';
 const header=name=>'<header class="wb-header"><h2 id="wb-title">'+(name==='root'?'根系表型分析':'静电耦合模型')+'</h2><span class="wb-bay">B05</span><div class="wb-identity"><span data-wb-alarm></span></div><details class="wb-source"><summary aria-label="查看数据来源">来源</summary><p>'+(name==='root'?'图层：项目根系分析资产<br>工作流参考：RootPainter<br>计算：根尖生长速率相对值变化与环境越限':'计算：当前批次静电参数关系式')+'</p></details>'+action('module-close','返回监控')+'</header>';
 const assistant=name=>'<aside class="wb-assistant"><header><h3>AeroSense Autonomy</h3></header><form data-wb-command><label class="wb-sr-only" for="wb-command">分析指令</label><textarea id="wb-command" rows="3" maxlength="160">'+safe(wb().query||task(name))+'</textarea><button type="submit">'+(name==='electro'?'计算参考电压':'执行分析')+'</button></form><dl class="wb-assistant-data" data-wb-log></dl><div class="wb-assistant-result" data-wb-advice role="status"></div></aside>';
 function rootImage(column,markers=false){
  const label=['根系图像','分割结果','分枝拓扑','根尖标记'][column];
  const dots=markers?data.tipMarkers.map((p,i)=>'<circle class="wb-tip-marker" cx="'+p.x+'" cy="'+p.y+'" r="6.5"><title>图层标记 '+(i+1)+'</title></circle>').join(''):'';
  return '<figure><figcaption>'+label+'</figcaption><svg class="wb-root-image" viewBox="0 0 '+data.columnWidth+' '+data.height+'" role="img" aria-label="'+label+'"><svg x="0" y="0" width="'+data.columnWidth+'" height="'+data.height+'" viewBox="'+(column*data.columnWidth)+' 0 '+data.columnWidth+' '+data.height+'"><image href="'+ASSETS.phenotype+'" width="'+data.width+'" height="'+data.height+'"/></svg>'+dots+'</svg></figure>';
 }
 function rootCenter(){
  const s=wb(),result=review().result;
  return '<main class="wb-evidence">'+progressMarkup('root')+'<div class="wb-view-tabs" role="group" aria-label="根系分析图层">'+['原图','分割','拓扑','根尖'].map((t,i)=>'<button type="button" data-wb-view="'+i+'" aria-pressed="'+(s.rootView===i)+'">'+t+'</button>').join('')+'</div><div class="wb-root-summary"><div><span>速率变化</span><strong data-wb-decline>'+((result?.valid&&review().computed)?'−'+number(result.decline,1)+'%':'—')+'</strong></div><button type="button" data-wb-markers aria-pressed="'+s.markers+'"><span>根尖标记</span><strong>'+data.tipMarkers.length+'<small>处</small></strong></button></div><div class="wb-root-pair" data-wb-root-images>'+rootImage(0)+rootImage(s.rootView,s.markers&&s.rootView===3)+'</div></main>';
 }
 function electroChart(){
  const s=op.state.electro,plot=panel.querySelector('[data-wb-electro-chart]');
  const cw=Math.max(280,plot?.clientWidth||600),ch=Math.max(100,plot?.clientHeight||320);
  const left=44,right=cw-18,top=34,bottom=ch-34,x=h=>left+h/100*(right-left);
  const draft=Number(wb().voltage),hasDraft=wb().voltage!==''&&draft>=.1&&draft<=5;
  const min=hasDraft?Math.min(2,Math.floor(draft*5)/5):2,max=hasDraft?Math.max(3.6,Math.ceil(draft*5)/5):3.6;
  const y=v=>bottom-(v-min)/(max-min)*(bottom-top);
  const ref=h=>3.4*(1-Math.min(.4,Math.max(0,.002*(h-60)+.09*Number(s.area)/120)));
  const count=ch<180?3:5;
  const grid=Array.from({length:count},(_,i)=>min+(max-min)*i/(count-1)).map(v=>'<path class="wb-grid" d="M'+left+' '+y(v)+'H'+right+'"/><text x="'+(left-9)+'" y="'+(y(v)+4)+'" text-anchor="end">'+v.toFixed(1)+'</text>').join('');
  const ticks=[0,20,40,60,80,100].map(v=>'<text x="'+x(v)+'" y="'+(bottom+17)+'" text-anchor="middle">'+v+'</text>').join('');
  const points=Array.from({length:51},(_,i)=>x(i*2).toFixed(1)+','+y(ref(i*2)).toFixed(1)).join(' ');
  const ready=electroReady();
  const current=ready?'<path class="wb-current-guide" d="M'+x(s.humidity)+' '+top+'V'+bottom+'"/><circle class="wb-current-point" cx="'+x(s.humidity)+'" cy="'+y(s.reference)+'" r="5"/><text class="wb-point-label" x="'+right+'" y="22" text-anchor="end">'+s.humidity+'%RH · −'+number(s.reference)+' kV</text>':'';
  const setting=Number(wb().voltage),work=ready&&wb().voltage!==''&&setting>=.1&&setting<=5?'<path class="wb-setting-guide" d="M'+left+' '+y(setting)+'H'+right+'"/><circle class="wb-setting-point" cx="'+x(s.humidity)+'" cy="'+y(setting)+'" r="5"/><text x="'+(left+8)+'" y="'+Math.max(top+13,Math.min(bottom-5,y(setting)+16))+'">工作设定 −'+number(setting,1)+' kV</text>':'';
  return '<svg viewBox="0 0 '+cw+' '+ch+'" role="img" aria-label="湿度与参考电压幅值关系">'+grid+'<path class="wb-axis" d="M'+left+' '+top+'V'+bottom+'H'+right+'"/>'+(ready?'<polyline class="wb-response-curve" points="'+points+'"/>':'<text x="'+((left+right)/2)+'" y="'+((top+bottom)/2)+'" text-anchor="middle">等待计算</text>')+current+work+ticks+'<text x="'+left+'" y="16">参考幅值（kV）</text><text x="'+((left+right)/2)+'" y="'+(ch-2)+'" text-anchor="middle">相对湿度（%RH）</text></svg>';
 }
 function electroCenter(){
  return '<main class="wb-evidence wb-electro-evidence">'+progressMarkup('electro')+'<header><h3>湿度—电压关系</h3><span data-wb-polarity>负极性'+(electroReady()?' · '+op.state.electro.area+' cm²':'')+'</span></header><div class="wb-electro-chart" data-wb-electro-chart>'+electroChart()+'</div><details class="wb-calculation"><summary>计算关系</summary><p>修正量＝0.002×(RH−60)＋0.09×A/120，限定0—40%</p><p>参考幅值＝3.4×(1−修正量)</p></details><section class="wb-result-strip"><div><span>修正量</span><strong data-electro-result>—</strong></div><div><span>参考电压</span><strong data-electro-reference>—</strong></div><div><span>工作设定</span><strong data-static-setting>—</strong></div></section></main>';
 }
 function electroControls(){
  const s=op.state.electro,v=electroInputs();
  return '<section class="wb-inputs" data-static-review><h3>电场设置</h3>'+options('data-choice="input"','参数来源',[['manual','手动输入'],['loaded','批次记录']],choice.input)+'<div class="wb-index-fields wb-electro-fields">'+field('湿度 %RH','data-electro="humidity" required type="number" min="0" max="100" step="0.1"',v.humidity)+field('根系面积 cm²','data-electro="area" required type="number" min="1" max="1000"',v.area)+'</div><div class="wb-input-divider"></div>'+field('工作电压幅值（kV）','data-op-input="voltage" type="number" min="0.1" max="5" step="0.1" inputmode="decimal"',s.applied?Math.abs(s.voltage).toFixed(1):wb().voltage)+'<output data-static-reference class="wb-sr-only"></output><p data-op-message class="wb-sr-only"></p></section>';
 }
 function rootControls(){
  const r=review();
  return '<section class="wb-inputs" data-root-review><h3>调控设置</h3><p>根尖生长速率</p><div class="wb-index-fields">'+field('基准相对值','data-review="referenceIndex" readonly type="number"',r.referenceIndex)+field('当前相对值','data-review="currentIndex" readonly type="number"',r.currentIndex)+'</div><div class="wb-input-divider"></div>'+options('data-review="rootPlan"','调控方案',[['','请选择'],['decoupled','根冠分区'],['whole','整区制冷']],r.rootPlan)+field('根区目标（°C）','data-review="rootTarget" type="number" min="10" max="25" step="0.1"',r.rootTarget)+'<div data-review-result class="wb-sr-only"></div><p data-review-message class="wb-sr-only"></p></section>';
 }
 function footer(name){
  return '<footer class="wb-footer"><p data-wb-footer>就绪</p><div>'+(name==='root'?'<button type="button" data-review-confirm>确认调控</button>':action('electro-apply','应用整定'))+'</div></footer>';
 }
 function renderConsole(target,name,choices,heatData){
  if(target!==panel)return;
  plotResize.disconnect();
  const justOpened=host.hidden,previousModule=module;
  module=name;choice=choices;environment=heatData;
  host.hidden=!name;panel.hidden=!name;document.body.classList.toggle('model-workbench-open',!!name);
  if(!name){cancel();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});lastStamp='';return;}
  if(job&&job.module!==name)cancel();
  if(justOpened)returnFocus=document.activeElement;
  if(justOpened||name!==previousModule){wb().query='';wb().message='';}
  panel.dataset.wbModule=name;
  panel.innerHTML=header(name)+'<div class="operator-console-body wb-body">'+assistant(name)+(name==='root'?rootCenter()+rootControls():electroCenter()+electroControls())+'</div>'+footer(name);
  if(name==='electro')panel.querySelectorAll('[data-electro]').forEach(n=>n.readOnly=choice.input!=='manual');
  lastStamp='';sync();if(justOpened)panel.focus({preventScroll:true});
  if(name==='electro')plotResize.observe(panel.querySelector('[data-wb-electro-chart]'));
 }
 function setText(selector,value){const n=panel.querySelector(selector);if(n&&n.textContent!==value)n.textContent=value;}
 function logSteps(items){const node=panel.querySelector('[data-wb-log]');if(!node)return;node.innerHTML=items.map(([label,value])=>'<div><dt>'+safe(label)+'</dt><dd'+(label==='参考偏差'?' data-electro-deviation':'')+'>'+safe(value)+'</dd></div>').join('');}
 function progressMarkup(name){
  const stages=name==='root'?rootStages:electroStages;
  return '<section class="wb-process" data-wb-progress aria-label="分析进度"><div><span data-wb-stage>就绪</span><span data-wb-percent></span></div><ol>'+stages.map((t,i)=>'<li data-wb-step="'+i+'">'+t+'</li>').join('')+'</ol><div class="wb-progress-track"><i data-wb-progress-bar></i></div></section><div class="wb-solver" data-wb-solver hidden><canvas width="128" height="128" aria-hidden="true"></canvas></div>';
 }
 function paintProgress(){
  const done=module==='root'?wb().rootComputed:wb().electroComputed;
  const stages=module==='root'?rootStages:electroStages;
  setText('[data-wb-stage]',job?stages[job.stage]+'…':done?(module==='electro'?'计算完成':'分析完成'):'就绪');
  setText('[data-wb-percent]',job?Math.floor(job.progress*100)+'%':'');
  panel.querySelectorAll('[data-wb-step]').forEach((n,i)=>{n.classList.toggle('is-done',done&&!job||!!job&&i<job.stage);n.classList.toggle('is-current',!!job&&i===job.stage);});
  const bar=panel.querySelector('[data-wb-progress-bar]');if(bar)bar.style.width=(job?job.progress*100:done?100:0)+'%';
  const solver=panel.querySelector('[data-wb-solver]');if(solver)solver.hidden=!job;
  panel.setAttribute('aria-busy',String(!!job));
 }
 function showRootLayer(column){
  wb().rootView=column;wb().markers=column===3;
  const images=panel.querySelector('[data-wb-root-images]');
  if(images)images.innerHTML=rootImage(0)+rootImage(column,column===3);
  panel.querySelectorAll('[data-wb-view]').forEach(n=>n.setAttribute('aria-pressed',String(Number(n.dataset.wbView)===column)));
  panel.querySelector('[data-wb-markers]')?.setAttribute('aria-pressed',String(column===3));
 }
 function finishAnalysis(){
  if(!job)return false;
  const done=job;job=null;cancelAnimationFrame(frameId);frameId=0;
  if(done.module==='root'){
   showRootLayer(3);
   window.__AEROSENSE_REVIEW__.calculateRoot({preserveConfirmation:done.preserveConfirmation});
   wb().rootComputed=!!review().computed;
   const q=window.__AEROSENSE_SEQUENCE__.state();
   if(currentEvent().key==='root-scan'&&q.active)window.__AEROSENSE_SEQUENCE__.skip();
  }else{
   const e=op.state.electro,applied=e.applied,voltage=e.voltage;
   op.loadElectro(done.humidity,done.area);
   if(applied){e.applied=true;e.voltage=voltage;}
   wb().electroComputed=e.loaded&&e.valid;wb().electroResultInputs=inputSignature(done);
  }
  wb().message='';lastStamp='';sync();void chime();return true;
 }
 function animateAnalysis(now){
  if(!job)return;
  if(document.hidden){job.last=now;frameId=requestAnimationFrame(animateAnalysis);return;}
  const elapsed=job.last?Math.max(0,now-job.last):0;job.last=now;job.elapsed+=elapsed;
  job.progress=Math.min(1,job.elapsed/job.duration);
  const stages=job.module==='root'?rootStages:electroStages;
  const stage=Math.min(stages.length-1,Math.floor(job.progress*stages.length));
  if(stage!==job.stage){job.stage=stage;if(job.module==='root')showRootLayer(Math.min(stage,3));lastStamp='';sync();}
  paintProgress();
  const canvas=panel.querySelector('[data-wb-solver] canvas');
  if(canvas&&now-lastDraw>32){
   lastDraw=now;const ctx=canvas.getContext('2d'),reduce=matchMedia('(prefers-reduced-motion:reduce)');window.__AEROSENSE_AOM_MARK__.draw(ctx,reduce.matches?.8:(now-job.started)/1000,'loading');
  }
  if(job.progress>=1){finishAnalysis();return;}frameId=requestAnimationFrame(animateAnalysis);
 }
 function runAnalysis(){
  if(!module||host.hidden||job)return false;
  const started=performance.now();
  const root=module==='root',e=op.state.electro;
  if(root){
   if(!op.state.rootAuthorized&&['heat','root-scan'].includes(currentEvent().key))ui.activateRoot();
   wb().rootComputed=false;
  }
  if(!root&&e.applied)return false;
  const humidity=panel.querySelector('[data-electro="humidity"]')?.value??e.humidity,area=panel.querySelector('[data-electro="area"]')?.value??e.area;
  if(!root&&(String(humidity).trim()===''||String(area).trim()===''||!(Number(humidity)>=0&&Number(humidity)<=100&&Number(area)>=1&&Number(area)<=1000))){wb().message='请输入有效的湿度和面积';lastStamp='';sync();return false;}
  if(!root)invalidateElectro();
  wb().message='';
  job={module,started,last:started,elapsed:0,duration:root?1800:750,progress:0,stage:0,preserveConfirmation:!!review().confirmed,humidity,area};
  if(root)showRootLayer(0);
  lastStamp='';sync();frameId=requestAnimationFrame(animateAnalysis);return true;
 }
 function cancel(){
  if(!job)return;job=null;cancelAnimationFrame(frameId);frameId=0;lastStamp='';
  if(!host.hidden)sync();
 }
 function sync(){
  if(host.hidden||!module)return;
  const e=op.state.electro,r=review(),s=wb(),a=window.__AEROSENSE_RANKING__.state().alarm.active;
  setText('[data-wb-alarm]',a?'热胁迫':'');panel.querySelector('[data-wb-alarm]').classList.toggle('is-alarm',a);
  const running=!!job,activeControl=module==='root'?['heat','root-scan'].includes(currentEvent().key):currentEvent().key==='electrostatic';
  panel.querySelectorAll('input').forEach(n=>{
   const record=['referenceIndex','currentIndex'].includes(n.dataset.review);
   const voltage=n.matches('[data-op-input="voltage"]'),target=n.dataset.review==='rootTarget';
   n.disabled=running||voltage&&!electroReady()||target&&!r.computed;
   n.readOnly=record||!activeControl||module==='electro'&&(e.applied||n.dataset.electro&&choice.input!=='manual');
  });
  panel.querySelectorAll('select').forEach(n=>n.disabled=running||!activeControl||(module==='electro'&&e.applied)||n.dataset.review==='rootPlan'&&!r.computed);
  panel.querySelectorAll('textarea,form button,[data-wb-view],[data-wb-markers]').forEach(n=>n.disabled=running);
  const submit=panel.querySelector('[data-wb-command] button');submit.textContent=running?'分析中…':module==='electro'?'计算参考电压':'执行分析';submit.disabled=running||module==='electro'&&e.applied;
  paintProgress();
  const stamp=JSON.stringify([module,e,r,s,currentEvent().key,a,job?.stage,running]);if(stamp===lastStamp)return;lastStamp=stamp;
  let readings=[],advice='',foot='';
  if(module==='electro'){
   const input=panel.querySelector('[data-op-input="voltage"]'),voltage=Number(input.value),valid=input.value!==''&&input.checkValidity()&&Number.isFinite(voltage),ready=electroReady();
   setText('[data-electro-result]',ready?number(e.correction*100,1)+'%':'—');
   setText('[data-electro-reference]',ready?'−'+number(e.reference)+' kV':'—');
   setText('[data-static-reference]',ready?'−'+number(e.reference)+' kV':'输入无效');
   setText('[data-static-setting]',valid?'−'+number(voltage,1)+' kV':'—');
   const deviation=ready&&valid?number(Math.abs(voltage-e.reference)/e.reference*100)+'%':'';
   setText('[data-electro-deviation]',deviation?'参考偏差 '+deviation:'');
   const apply=panel.querySelector('[data-op="electro-apply"]');apply.disabled=!canApplyElectro()||!activeControl;apply.textContent=e.applied?'已应用':'应用整定';
   setText('[data-wb-polarity]','负极性'+(ready?' · '+e.area+' cm²':''));
   setText('[data-op-message]',s.message);
   if(ready){readings=[['参数来源',choice.input==='loaded'?'批次记录':'手动输入']];advice=e.applied?'工作设定已应用':valid?'参考偏差 '+deviation:'请输入工作电压';}
   else advice='';
   panel.querySelector('[data-wb-electro-chart]').innerHTML=electroChart();
   foot=e.applied?'整定完成':ready?'计算完成':'就绪';
  }else{
   const result=r.computed&&r.result?.valid?r.result:null;
   setText('[data-wb-decline]',running?'—':result?(result.decline>=0?'−':'+')+number(Math.abs(result.decline),1)+'%':'—');
   setText('[data-review-result]',result?'速率变化 '+number(result.decline,1)+'%':'');
   const confirm=panel.querySelector('[data-review-confirm]');confirm.disabled=running||r.confirmed||!activeControl||!r.computed||!r.result?.valid;confirm.textContent=r.confirmed?'已确认':'确认调控';
   setText('[data-review-message]',s.message||(!r.result?.valid&&r.result?r.result.message:''));
   if(result&&!running){readings=[['叶温',number(result.leaf,1)+'°C / 上限25°C'],['VPD',number(result.vpd)+' kPa / 上限0.92 kPa']];advice=result.concordant?'根系变化与环境越限一致。建议根冠分区，根区18°C。':'请复核根系变化与环境记录。';}
   else advice=running?'':r.result&&!r.result.valid?r.result.message:'';
   if(result&&!running&&r.rootPlan==='whole')advice='整区制冷：冠层与根区同步降温。';
   foot='';
  }
  if(running){readings=[];advice='';foot='';}
  logSteps(readings);setText('[data-wb-advice]',s.message||advice);setText('[data-wb-footer]',foot);
 }
 function command(e){
  e.preventDefault();const text=panel.querySelector('#wb-command').value.trim();wb().query=text;wb().message='';
  const match=module==='root'?/根系|根尖|根冠|表型|分割/.test(text):/静电|电压|湿度|耦合/.test(text);
  if(!match){wb().message='指令未识别，请输入'+(module==='root'?'根系分析':'静电计算')+'任务';lastStamp='';sync();return;}
  if(module==='electro'){
   const clean=text.replace(/[０-９]/g,c=>String(c.charCodeAt(0)-0xff10)).replace(/％/g,'%');
   const humidity=clean.match(/(?:湿度|RH)[^\d+\-]{0,12}([+\-]?\d+(?:\.\d+)?)\s*(?:%|％|RH)?/i);
   const area=clean.match(/(?:根系面积|面积)[^\d+\-]{0,12}([+\-]?\d+(?:\.\d+)?)\s*(?:cm|厘米|平方)?/i);
   const requested={...(humidity?{humidity:humidity[1]}:{}),...(area?{area:area[1]}:{})};
   const entries=Object.entries(requested);
   if(choice.input==='loaded'&&entries.some(([key,value])=>Number(value)!==Number(wb().electroRecord[key]))){wb().message='当前使用批次记录；修改参数请切换手动输入。';lastStamp='';sync();return;}
   if(choice.input==='manual'&&entries.length){
    const next={...wb().electroDraft,...requested};
    if(!(Number(next.humidity)>=0&&Number(next.humidity)<=100&&Number(next.area)>=1&&Number(next.area)<=1000)){wb().message='湿度须在0—100%RH，面积须在1—1000 cm²。';lastStamp='';sync();return;}
    invalidateElectro();Object.assign(wb().electroDraft,next);
    for(const [key,value] of Object.entries(next)){const input=panel.querySelector('[data-electro="'+key+'"]');if(input)input.value=value;}
   }
   if(/(?:修改|设为|改为|调整为)/.test(clean)&&!entries.length){wb().message='请在右侧设置工作电压；分析指令仅接受湿度和面积。';lastStamp='';sync();return;}
  }else if(/(?:修改|设为|改为|调整为)/.test(text)){wb().message='根系相对值来自批次记录；调控目标请在右侧设置。';lastStamp='';sync();return;}
  runAnalysis();document.body.focus({preventScroll:true});
 }
 document.addEventListener('visibilitychange',()=>{if(job)job.last=performance.now();});
 panel.addEventListener('submit',command);
 panel.addEventListener('input',e=>{
  if(e.target.matches('[data-op-input="voltage"]')){wb().voltage=e.target.value;wb().message='';lastStamp='';sync();}
  if(e.target.dataset.electro){wb().electroDraft[e.target.dataset.electro]=e.target.value;invalidateElectro();sync();}
  if(e.target.dataset.review){wb().message='';lastStamp='';queueMicrotask(sync);}
 });
 panel.addEventListener('change',()=>{wb().message='';lastStamp='';queueMicrotask(sync);});
 panel.addEventListener('click',e=>{
  if(e.target.closest('[data-op],[data-review-calculate],[data-review-confirm]'))queueMicrotask(()=>document.body.focus({preventScroll:true}));
  const view=e.target.closest('[data-wb-view]');if(view){wb().rootView=Number(view.dataset.wbView);wb().markers=wb().rootView===3;renderConsole(panel,module,choice,environment);}
  if(e.target.closest('[data-wb-markers]')){wb().rootView=3;wb().markers=!wb().markers;renderConsole(panel,module,choice,environment);}
 });
 // Tab stays in the workbench. Navigation keys remain owned by the existing
 // competition sequence; Escape never clears an alarm.
 addEventListener('keydown',e=>{
  if(host.hidden||e.key!=='Tab'||panel.contains(document.activeElement))return;
  const nodes=[...panel.querySelectorAll('button,summary,input,select,textarea')].filter(n=>!n.disabled&&n.getClientRects().length);
  if(nodes.length){e.preventDefault();(e.shiftKey?nodes.at(-1):nodes[0]).focus();}
 },true);
 panel.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const nodes=[...panel.querySelectorAll('button,summary,input,select,textarea')].filter(n=>!n.disabled&&n.getClientRects().length);
  if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 });
 window.__AEROSENSE_WORKBENCH__={renderConsole,runAnalysis,changeSource,canApplyElectro,busy:()=>!!job,skip:finishAnalysis,cancel,sync,visible:()=>!host.hidden,rootCase:()=>({markerCount:data.tipMarkers.length,workflowReference:data.workflowReference}),message(text){wb().message=text;lastStamp='';sync();}};
 ui.refresh();
})();
