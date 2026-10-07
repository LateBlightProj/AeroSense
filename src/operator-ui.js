// Main-page operations and result-only evidence. Local competition simulation.
(()=>{
 const op=window.__AEROSENSE_OPERATOR__,layer=document.getElementById('eventLayer'),visual=document.getElementById('eventVisual');
 const omittedCards=new Set(['electrostatic','root-scan',...(window.__AEROSENSE_RANKING_MODE__?['harvest']:[])]);
 const keys=new Set(['electrostatic','heat','root-scan','potassium-dose','vpd-return','harvest']);
 const status=(label,value)=>'<div class="op-reading"><span>'+label+'</span><b>'+value+'</b></div>';
 const button=(action,label,extra='')=>'<button type="button" data-op="'+action+'" '+extra+'>'+label+'</button>';
 const choices={input:'loaded',goal:'voltage',rootModel:'joint',project:'all'};
 const select=(key,label,items)=>'<label class="model-choice"><span>'+label+'</span><select data-choice="'+key+'">'+items.map(([value,text])=>'<option value="'+value+'"'+(choices[key]===value?' selected':'')+'>'+text+'</option>').join('')+'</select></label>';
 const electroChoices=()=>'<div class="model-choices"><div class="model-choice"><span>模型</span><b>静电沉积耦合模型</b></div>'+select('input','输入参数',[['loaded','已载入参数'],['manual','手动输入']])+select('goal','计算目标',[['voltage','工作电压建议'],['correction','临界点修正量']])+'</div>';
 const rootChoices=()=>'<div class="model-choices">'+select('rootModel',window.__AEROSENSE_RANKING_MODE__?'已有结果视图':'模型',[['joint','联合分析'],['segmentation',window.__AEROSENSE_RANKING_MODE__?'已有分割结果':'Root-UNet 分割'],['topology',window.__AEROSENSE_RANKING_MODE__?'已有拓扑结果':'Graph-GNN 拓扑']])+'<div class="model-choice"><span>分析区域</span><b>B05 根系</b></div>'+select('project','分析项目',choices.rootModel==='segmentation'?[['all','全部'],['activity','根尖活性']]:choices.rootModel==='topology'?[['branch','分枝密度']]:[['all','全部'],['activity','根尖活性'],['branch','分枝密度']])+'</div>';
 function rootColumns(){return choices.rootModel==='topology'?[0,2]:choices.rootModel==='segmentation'?(choices.project==='activity'?[0,1,3]:[0,1]):choices.project==='activity'?[0,1,3]:choices.project==='branch'?[0,1,2]:[0,1,2,3];}
 function rootResult(){
  const template=document.createElement('template');template.innerHTML=oldRender(currentEvent());
  const panel=template.content.querySelector('.phenotype-analysis-image');
  if(panel){const labels=['RGB 原图','像素级分割','分枝拓扑','根尖活性'];const columns=rootColumns();panel.classList.add('root-selected-panels');panel.style.setProperty('--root-panel-count',columns.length);panel.innerHTML=columns.map(i=>'<figure><figcaption>'+labels[i]+'</figcaption><svg viewBox="'+(i*418)+' 0 418 941" role="img" aria-label="'+labels[i]+'"><image href="'+ASSETS.phenotype+'" width="1672" height="941"/></svg></figure>').join('');}
  return template.innerHTML;
 }
 const person='<div class="operator-confirm"><img src="'+PERSONNEL.小组长+'" alt=""><div><h3>AIoT小组长</h3><span>静电场整定</span></div></div>';
 const right=document.querySelector('aside.right'),equipment=right.querySelector('.equipment-monitor');
 const consolePanel=document.createElement('section');consolePanel.className='section operator-console';consolePanel.hidden=true;
 right.insertBefore(consolePanel,equipment);
 let heatData=null,selectedModule=null,rootLoaded=false,changingEvent=false;
 const promptClosed={electro:false,root:false};
 function moduleAllowed(name){return (name==='electro'||name==='root')&&!window.__AEROSENSE_LOADING__?.busy()&&promptClosed[name]&&reached(name==='electro'?'electrostatic':'heat')&&!document.querySelector('.layer.open')&&!window.__AEROSENSE_SEQUENCE__?.state().active;}
 const moduleBar=document.createElement('nav');moduleBar.className='model-modules';moduleBar.setAttribute('aria-label','辅助模型');
 const icon=path=>'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';
 moduleBar.innerHTML='<button type="button" data-module="electro" aria-label="静电耦合模型（辅助模块）">'+icon('<path d="M13 2 5 13h6l-1 9 9-13h-6z"/>')+'</button><button type="button" data-module="root" aria-label="根系表型分析模型">'+icon('<path d="M12 12C7 12 4 9 4 5c5 0 8 3 8 7Zm0 0c5 0 8-3 8-7-5 0-8 3-8 7ZM12 12v8" stroke-width="1.8"/>')+'</button>';
 document.querySelector('.system').insertBefore(moduleBar,document.getElementById('clock'));
 function syncModules(){
  for(const b of moduleBar.querySelectorAll('[data-module]')){
   const electro=b.dataset.module==='electro',loaded=electro?op.state.electro.loaded:rootLoaded;
   b.disabled=!moduleAllowed(b.dataset.module);
   b.classList.toggle('is-active',loaded);b.setAttribute('aria-pressed',String(loaded));
   b.title=(electro?'静电耦合模型（辅助模块）':'根系表型分析模型')+' · '+(b.disabled?'当前工序尚未就绪':loaded?'已激活':'可调取')+(electro&&op.state.electro.applied?' · 模拟反馈：微安级稳定；实物电流另行核对':'');
  }
 }
 const oldRender=renderEventVisual;
 function chart(values,label,min,max,target,unit){return instrumentResponseChart({values,min,max,target,eventAt:0,current:values.at(-1).toFixed(2),unit,label,duration:60,eventLabel:'窗口起点'});}
 function renderConsole(){
  syncModules();
  if(window.__AEROSENSE_RANKING_MODE__&&window.__AEROSENSE_WORKBENCH__){consolePanel.hidden=!selectedModule;equipment.classList.remove('operator-replaced');window.__AEROSENSE_WORKBENCH__.renderConsole(consolePanel,selectedModule,choices,heatData);return;}const active=selectedModule!==null;consolePanel.hidden=!active;equipment.classList.toggle('operator-replaced',active);if(!active)return;
  if(selectedModule==='root'){consolePanel.innerHTML='<header class="section-head"><h2>根系表型分析</h2>'+button('module-close','返回监控')+'</header><div class="operator-console-body op-composition">'+rootChoices()+(['heat','root-scan'].includes(currentEvent().key)?button('heat-root',window.__AEROSENSE_RANKING_MODE__?'载入已有结果':'开始分析'):'')+'</div>';return;}

  const s=op.state.electro;
  consolePanel.innerHTML='<header class="section-head"><h2>静电整定</h2>'+button('module-close','关闭')+'</header><div class="operator-console-body op-composition">'+electroChoices()+
   button('electro-load',s.loaded?'重新计算':'开始计算')+
   (s.loaded?'<div class="op-inline-fields"><label>湿度（%RH）<input data-electro="humidity" required type="number" min="0" max="100" step="0.1" value="'+s.humidity+'"></label><label>根系面积（cm²）<input data-electro="area" required type="number" min="1" max="1000" value="'+s.area+'"></label></div>'+
    '<details><summary>模型参数与计算</summary><p>14天苗龄 · 本地仿真</p><p>修正量＝0.002×(湿度−60)＋0.09×面积/120，限定0–40%；参考幅值＝3.4×(1−修正量) kV。</p></details>'+
    '<div class="op-inline-fields">'+status('修正量','<output data-electro-result>'+(s.correction*100).toFixed(1)+'%</output>')+status('参考电压','<output data-electro-reference>−'+s.reference.toFixed(2)+' kV</output>')+'</div>'+
    '<label>工作电压幅值（kV）<input data-op-input="voltage" type="number" min="0.1" max="5" step="0.1" value="'+(s.applied?Math.abs(s.voltage).toFixed(1):'')+'" inputmode="decimal"></label><p>极性：负</p>'+
    button('electro-apply',s.applied?'整定已应用':'应用整定',s.applied?'disabled':'')+
    '<p role="status" data-op-message>'+(s.applied?'工作电压 '+s.voltage.toFixed(1)+' kV · 模拟反馈：微安级稳定；实物电流另行核对':'计算完成，输入工作电压后应用。')+'</p>'+(s.applied?button('electro-replay','查看静电运行'):''):
    (choices.input==='manual'?'<div class="op-inline-fields"><label>湿度（%RH）<input data-electro="humidity" required type="number" min="0" max="100" value="'+s.humidity+'"></label><label>根系面积（cm²）<input data-electro="area" required type="number" min="1" max="1000" value="'+s.area+'"></label></div>':''))+'</div>';
  consolePanel.querySelectorAll('[data-electro]').forEach(input=>input.readOnly=choices.input!=='manual');
  if(choices.goal==='correction')consolePanel.querySelector('[data-electro-reference]')?.closest('.op-reading')?.remove();
  if(currentEvent().key!=='electrostatic')consolePanel.querySelectorAll('input,[data-op="electro-load"],[data-op="electro-apply"],[data-op="electro-replay"]').forEach(x=>x.disabled=true);
 }
 function heatPanel(){
  const s=heatData||seriesByBay.B05;
  const plot=(values,label,unit,range,precision)=>{
   const min=Math.floor((Math.min(...values,range[0])-.2)*10)/10,max=Math.ceil((Math.max(...values,range[1])+.2)*10)/10;
   const x=i=>64+i/Math.max(1,values.length-1)*352,y=v=>304-(v-min)/(max-min)*272;
   const points=values.map((v,i)=>x(i).toFixed(1)+','+y(v).toFixed(1)).join(' ');
   const ticks=[min,(min+max)/2,max].map(v=>'<path d="M64 '+y(v)+' H416" class="heat-grid"/><text x="52" y="'+(y(v)+6)+'" text-anchor="end">'+v.toFixed(precision)+'</text>').join('');
   const times=[0,15,30,45,60].map(v=>'<text x="'+(64+v/60*352)+'" y="338" text-anchor="middle">'+(v===60?'当前':v-60)+'</text>').join('');
   return '<section class="heat-trend"><header><h3>'+label+'</h3><strong>'+values.at(-1).toFixed(precision)+' <small>'+unit+'</small></strong><p>目标 '+range[0].toFixed(precision)+'–'+range[1].toFixed(precision)+' '+unit+'</p></header><svg viewBox="0 0 440 376" role="img" aria-label="'+label+'最近60分钟趋势"><rect x="64" y="'+y(range[1])+'" width="352" height="'+(y(range[0])-y(range[1]))+'" class="heat-target"/>'+ticks+'<path d="M64 32 V304 H416" class="heat-axis"/><polyline points="'+points+'" class="heat-curve"/><circle cx="416" cy="'+y(values.at(-1))+'" r="5" class="heat-end"/>'+times+'<text x="240" y="370" text-anchor="middle">时间（min）</text></svg></section>';
  };
  return '<div class="heat-analysis"><div class="heat-context"><span>B05 · 同一时间窗口</span><span><i></i>目标范围</span></div><div class="heat-trends">'+plot(s.h,'空气焓值','kJ/kg',[51.8,52.9],1)+plot(s.canopy,'叶面温度','℃',[23,25],1)+plot(s.vpd,'VPD','kPa',[.78,.92],2)+'</div></div>';
 }
 renderEventVisual=function(e){
  if(!keys.has(e.key))return oldRender(e);
  if(e.key==='heat')return heatPanel();
  if(e.key==='root-scan')return op.state.rootAuthorized?rootResult():'';
  if(omittedCards.has(e.key))return '';
  if(e.key==='vpd-return'||e.key==='potassium-dose'){const vpd=e.key==='vpd-return';return '<div class="vpd-composition op-composition"><div class="vpd-plot" data-auto-chart></div><aside>'+status('控制方式','自动闭环')+status(vpd?'VPD目标':'投加支路',vpd?'0.80 kPa':'母液 E · 钾 / 硼')+status(vpd?'当前VPD':'当前K⁺','<output data-auto-value></output>')+status('运行状态',vpd?'环境调节中':'脉冲自动调增')+'</aside></div>';}
  return '<div class="recipe-composition op-composition"><div class="confirmation-visual"><div class="confirmation-title">深度 · 实例分割</div><canvas data-twin-mirror data-harvest-confirmation aria-label="采收目标深度与分割"></canvas><div class="confirmation-legend"><span>近亮远暗</span><span>逐薯轮廓</span><span class="target-key">目标薯块</span></div></div><aside>'+status('目标尺寸','31 mm')+'<details><summary>查看检测结果</summary>'+status('干物质','22.5%')+'</details>'+button('harvest-approve',op.state.harvest.approved?'任务已核准':'核准采收任务',op.state.harvest.approved?'disabled':'')+'</aside></div>';
 };
 function updateAuto(){
  const key=currentEvent().key;if(!['vpd-return','potassium-dose'].includes(key))return;
  const vpd=key==='vpd-return',s=seriesByBay.B05[vpd?'vpd':'k'],plot=visual.querySelector('[data-auto-chart]'),value=visual.querySelector('[data-auto-value]');
  if(plot)plot.innerHTML=chart(s,vpd?'VPD自动回调':'K⁺闭环响应',vpd?.5:200,vpd?1.6:270,vpd?[.78,.82]:[220,260],vpd?'kPa':'mg/L');
  if(value)value.textContent=s.at(-1).toFixed(vpd?2:0)+(vpd?' kPa':' mg/L');
 }
 function refresh(){
  const key=currentEvent().key;layer.classList.toggle('operator-card',keys.has(key));
  if(keys.has(key)){visual.innerHTML=renderEventVisual(currentEvent());layer.classList.toggle('single-composition',key!=='root-scan'||!op.state.rootAuthorized);layer.dataset.cardSize='analysis';updateAuto();}
  layer.querySelectorAll('.root-result-model').forEach(node=>node.remove());
  if(key==='root-scan'&&op.state.rootAuthorized){
   const model=visual.querySelector('.event-focus-model');
   if(model){model.classList.add('root-result-model');layer.querySelector('.event-copy').append(model);}
   layer.querySelectorAll('.facts>div').forEach(item=>{const text=item.textContent;item.hidden=choices.rootModel==='topology'? !text.includes('分枝'):choices.project==='activity'?text.includes('分枝'):choices.project==='branch'? !text.includes('分枝'):choices.rootModel==='segmentation'?text.includes('分枝'):false;});
  }
  renderConsole();
 }
 const oldTargets=eventTargets;eventTargets=function(id){const t=oldTargets(id);if(id==='B05'){if(reached('vpd-return'))t.vpd=.8;if(currentEvent().key==='potassium-dose'){t.k=239;t.ec=1.5;}}return t;};
 const oldLog=logEvent;logEvent=function(e,...args){if(e.key==='harvest'&&!window.__AEROSENSE_RANKING_MODE__)e={...e,result:op.state.harvest.approved?'采收任务已核准':'采收任务待核准'};if(e.key==='electrostatic')e={...e,result:op.state.electro.applied?'静电整定已应用':'等待主页整定'};return oldLog(e,...args);};
 const record=result=>oldLog({...currentEvent(),result},false);
 const oldSet=setEvent;setEvent=function(n,options={}){
  const key=events[Number(n)]?.key;
  // Rewinding across the root-analysis prompt starts a fresh manual cycle.
  // Clear before oldSet: sequence startup also reads rootAuthorized.
  const targetRank=EVENT_ORDER.indexOf(key);
  const rewinding=targetRank>=0&&targetRank<eventRank();
  if(rewinding&&targetRank<=EVENT_ORDER.indexOf('harvest'))op.state.harvest.approved=false;
  // Closing/reopening the current reaction resumes it; rewinding before it starts a new run.
  if(rewinding&&targetRank<EVENT_ORDER.indexOf('reaction-live')){
   stopCrisprClock();app.crisprStartedAt=0;
  }
  if(targetRank>=0&&targetRank<eventRank()&&targetRank<=EVENT_ORDER.indexOf('electrostatic')){
   op.resetElectro();promptClosed.electro=false;electrostaticState.confirmed=false;
  }
  if(targetRank>=0&&targetRank<eventRank()&&targetRank<=EVENT_ORDER.indexOf('heat')){
   rootLoaded=false;promptClosed.root=false;op.state.rootAuthorized=false;heatData=null;
  }
  if(key==='heat')heatData=null;
  selectedModule=null;
  changingEvent=true;let result;try{result=oldSet(n,options);}finally{changingEvent=false;}
  if(key==='heat')heatData=Object.fromEntries(['h','canopy','vpd'].map(k=>[k,[...seriesByBay.B05[k]]]));
  if(key==='electrostatic')promptClosed.electro=true;
  if(key==='root-scan')promptClosed.root=true;
  refresh();return result;
 };
 const oldClose=closeLayer;closeLayer=function(el){const wasOpen=el===layer&&layer.classList.contains('open');const r=oldClose(el);if(wasOpen&&!changingEvent){if(currentEvent().key==='electrostatic')promptClosed.electro=true;if(['heat','root-scan'].includes(currentEvent().key))promptClosed.root=true;}syncModules();return r;};
 const oldOpen=openLayer;openLayer=function(el){if(el===layer&&(omittedCards.has(currentEvent().key)&&(currentEvent().key!=='root-scan'||!op.state.rootAuthorized||window.__AEROSENSE_SEQUENCE__?.state().active))){if(currentEvent().key==='electrostatic')promptClosed.electro=true;else promptClosed.root=true;syncModules();return;}const r=oldOpen(el);syncModules();return r;};
 const oldPlots=updatePlots;updatePlots=function(...args){const r=oldPlots(...args);if(layer.classList.contains('open'))updateAuto();syncModules();return r;};
 function loadModule(name,reload=false){
  const activate=()=>{selectedModule=name;if(name==='electro'&&reload){const h=consolePanel.querySelector('[data-electro="humidity"]'),a=consolePanel.querySelector('[data-electro="area"]');if(choices.input==='manual'&&[h,a].some(input=>input&&!input.reportValidity()))return;op.loadElectro(choices.input==='manual'?(h?.value??op.state.electro.humidity):(window.__AEROSENSE_RANKING_MODE__?85:75),choices.input==='manual'?(a?.value??op.state.electro.area):120);}if(name==='root')rootLoaded=true;renderConsole();};
  activate();
 }
 function solveAfterApply(complete,onCancel=()=>{}){
  selectedModule=null;renderConsole();
  if(app.view!=='twin')setCenterView('twin');
  if(window.__AEROSENSE_LOADING__){window.__AEROSENSE_LOADING__.run('Solving....',complete,()=>{onCancel();renderConsole();});syncModules();}
  else complete();
 }
 function act(e){
  const control=e.target.closest('[data-op]');if(!control||control.disabled)return;e.stopPropagation();
  const action=control.dataset.op,key=currentEvent().key;
  if(action==='module-close'){selectedModule=null;renderConsole();}
  if(window.__AEROSENSE_RANKING_MODE__&&window.__AEROSENSE_WORKBENCH__&&['electro-load','heat-root'].includes(action)){
   window.__AEROSENSE_WORKBENCH__.runAnalysis();return;
  }
  if(action==='electro-load'&&key==='electrostatic'&&moduleAllowed('electro'))loadModule('electro',true);
  if(action==='electro-apply')window.confirmElectrostatic();
  if(action==='electro-replay'&&key==='electrostatic'&&moduleAllowed('electro')&&op.state.electro.applied){selectedModule=null;renderConsole();window.__AEROSENSE_SEQUENCE__.startConfirmedElectro();}
  if(action==='heat-root'&&['heat','root-scan'].includes(key)&&rootLoaded&&moduleAllowed('root')){control.disabled=true;solveAfterApply(()=>{op.state.rootAuthorized=true;record(window.__AEROSENSE_RANKING_MODE__?'小组长载入已有根系分析结果':'小组长启动根系表型分析');setEvent(eventNumber('root-scan'),{sound:false});},()=>{op.state.rootAuthorized=false;});}
  if(key==='harvest'&&action==='harvest-approve'&&op.approveHarvest()){record('小组长核准采收任务');refresh();closeLayer(layer);window.__AEROSENSE_TWIN__?.resetCamera();if(window.__AEROSENSE_RANKING_MODE__)window.__AEROSENSE_SEQUENCE__.start(eventNumber('harvest'),false,false);}
 }
 visual.addEventListener('click',act);consolePanel.addEventListener('click',act);
 moduleBar.addEventListener('click',e=>{
  const b=e.target.closest('[data-module]');if(!b||!moduleAllowed(b.dataset.module))return;e.stopPropagation();
  loadModule(b.dataset.module);
 });
 addEventListener('keydown',e=>{if((visual.contains(e.target)||consolePanel.contains(e.target)||moduleBar.contains(e.target))&&e.target.closest?.('input,button,summary,select,textarea')&&e.key!=='Escape'&&e.key!=='Tab')e.stopImmediatePropagation();},true);
 consolePanel.addEventListener('change',e=>{
  const key=e.target.dataset.choice;if(!key||!Object.hasOwn(choices,key))return;
  const name=selectedModule;if(!moduleAllowed(name))return;
  if(window.__AEROSENSE_RANKING_MODE__&&window.__AEROSENSE_WORKBENCH__&&name==='electro'&&key==='input'){
   window.__AEROSENSE_WORKBENCH__.changeSource(e.target.value);choices[key]=e.target.value;renderConsole();return;
  }
  if(name==='electro'&&choices.input==='manual')for(const input of consolePanel.querySelectorAll('[data-electro]'))if(input.value!==''&&input.checkValidity())op.state.electro[input.dataset.electro]=Number(input.value);
  choices[key]=e.target.value;
  if(name==='electro'){op.state.electro.loaded=false;op.state.electro.applied=false;}
  if(key==='rootModel'){choices.project=choices.rootModel==='topology'?'branch':'all';}
  renderConsole();
 });
 consolePanel.addEventListener('input',e=>{
  if(currentEvent().key!=='electrostatic'||!moduleAllowed('electro')||!e.target.matches('[data-electro]'))return;
  if(window.__AEROSENSE_RANKING_MODE__&&window.__AEROSENSE_WORKBENCH__)return;
  if(!op.state.electro.loaded)return;
  const h=consolePanel.querySelector('[data-electro="humidity"]'),a=consolePanel.querySelector('[data-electro="area"]'),valid=op.loadElectro(h.value,a.value);
  const apply=consolePanel.querySelector('[data-op="electro-apply"]');apply.disabled=!valid;apply.textContent='应用整定';
  consolePanel.querySelector('[data-electro-result]').textContent=valid?(op.state.electro.correction*100).toFixed(1)+'%':'—';
  const reference=consolePanel.querySelector('[data-electro-reference]');if(reference)reference.textContent=valid?'−'+op.state.electro.reference.toFixed(2)+' kV':'—';
  consolePanel.querySelector('[data-op-message]').textContent=valid?'参数已重算，等待应用。':'请检查湿度与根系面积。';
 });
 window.confirmElectrostatic=()=>{
  if(currentEvent().key!=='electrostatic'||!moduleAllowed('electro'))return false;
  if(window.__AEROSENSE_RANKING_MODE__&&window.__AEROSENSE_WORKBENCH__&&!window.__AEROSENSE_WORKBENCH__.canApplyElectro())return false;
  const input=consolePanel.querySelector('[data-op-input="voltage"]');
  if(!input||!input.checkValidity()||!op.applyElectro(input.value)){const msg=consolePanel.querySelector('[data-op-message]');if(msg)msg.textContent='请输入0.1–5.0 kV的工作电压幅值。';return false;}
  record('小组长应用静电整定：'+op.state.electro.voltage.toFixed(1)+' kV');
  solveAfterApply(()=>{refresh();window.__AEROSENSE_SEQUENCE__.startConfirmedElectro();},()=>{op.state.electro.applied=false;op.state.electro.voltage=null;});return true;
 };
 if((omittedCards.has(currentEvent().key)&&(currentEvent().key!=='root-scan'||!op.state.rootAuthorized||window.__AEROSENSE_SEQUENCE__?.state().active))){closeLayer(layer);if(currentEvent().key==='electrostatic')promptClosed.electro=true;else promptClosed.root=true;}
 window.__AEROSENSE_OPERATOR_UI__={
   snapshot:()=>({rootLoaded,heatData:heatData?JSON.parse(JSON.stringify(heatData)):null,promptClosed:{...promptClosed},choices:{...choices},selectedModule}),
   restore(s){if(!s)return;rootLoaded=!!s.rootLoaded;heatData=s.heatData?JSON.parse(JSON.stringify(s.heatData)):null;Object.assign(promptClosed,s.promptClosed);Object.assign(choices,s.choices);selectedModule=s.selectedModule||null;refresh();},
   closeModule(){selectedModule=null;renderConsole();},
   prepare(key){selectedModule=null;if(key==='electrostatic')promptClosed.electro=true;if(key==='heat')promptClosed.root=false;refresh();},
   activateRoot(){if(!['heat','root-scan'].includes(currentEvent().key))return false;if(op.state.rootAuthorized)return true;op.state.rootAuthorized=true;record('B05根系分析启动');setEvent(eventNumber('root-scan'),{sound:false,open:false,present:false});closeLayer(layer);selectedModule='root';rootLoaded=true;renderConsole();return true;},
   diagnoseHeat(){if(!['heat','root-scan'].includes(currentEvent().key)||window.__AEROSENSE_SEQUENCE__?.state().active||window.__AEROSENSE_LOADING__?.busy())return false;promptClosed.root=true;closeLayer(layer);loadModule('root');return true;},
   refresh};
 refresh();
})();
