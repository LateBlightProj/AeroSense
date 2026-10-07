/* Existing images are records; only the displayed arithmetic and rules run locally. */
(()=>{
 if(!window.__AEROSENSE_RANKING_MODE__)return;
 const op=window.__AEROSENSE_OPERATOR__,ui=window.__AEROSENSE_OPERATOR_UI__;
 const state=()=>op.state.review||(op.state.review={referenceIndex:100,currentIndex:85,rootPlan:'',rootTarget:'',computed:false,confirmed:false,result:null});
 state();
 const fmt=(n,d=2)=>Number(n).toFixed(d);
 function calculateRoot({preserveConfirmation=false}={}){
  const s=state(),baseline=Number(s.referenceIndex),current=Number(s.currentIndex);
  if([s.referenceIndex,s.currentIndex].some(v=>String(v).trim()==='')||!(baseline>0&&baseline<=200&&current>=0&&current<=200)){s.result={valid:false,message:'核对基准相对值与当前相对值'};s.computed=false;s.confirmed=false;return s.result;}
  const data=ui.snapshot().heatData||seriesByBay.B05;
  const leaf=Math.max(...data.canopy),vpd=Math.max(...data.vpd),decline=(baseline-current)/baseline*100;
  const environment=leaf>25||vpd>.92;
  s.result={valid:true,leaf,vpd,decline,environment,concordant:environment&&decline>0};
  s.computed=true;if(!preserveConfirmation)s.confirmed=false;return s.result;
 }
 function confirmRoot(){
  const s=state();
  const panel=document.querySelector('.operator-console');
  const plan=panel?.querySelector('[data-review="rootPlan"]'),target=panel?.querySelector('[data-review="rootTarget"]');
  if(plan&&target){s.rootPlan=plan.value;s.rootTarget=target.value;}
  if(!s.computed||!s.result?.valid)return '请先完成分析';
  if(!Number.isFinite(Number(s.rootTarget))||String(s.rootTarget).trim()===''||Number(s.rootTarget)<10||Number(s.rootTarget)>25)return '请输入10—25°C的根区目标';
  if(target&&!target.checkValidity())return '根区目标步长为0.1°C';
  s.confirmed=true;return '';
 }
 function staticBlock(){
  const s=op.state.electro;
  return '<section class="rank-review" data-static-review><p class="review-source">案例参数 · 本地计算</p><div class="review-comparison"><span>模型参考幅值<br><b data-static-reference>−'+fmt(s.reference)+' kV</b></span><span>本次工作设定<br><b data-static-setting>待输入</b></span></div><p data-electro-deviation>输入工作幅值，核对与参考值的偏差</p></section>';
 }
 function rootBlock(){
  const s=state(),v=s.result;
  return '<section class="rank-review" data-root-review><p class="review-source">案例复核 · 已有根像结果</p><div class="review-inputs"><label>基准相对值<input data-review="referenceIndex" readonly type="number" min="1" max="200" value="'+s.referenceIndex+'"></label><label>当前相对值<input data-review="currentIndex" readonly type="number" min="0" max="200" value="'+s.currentIndex+'"></label></div><button type="button" data-review-calculate>计算变化与越限</button><div data-review-result>'+(!v?'核对参数后计算变化与越限':!v.valid?v.message:'根尖生长速率相对值下降 <b>'+fmt(v.decline,1)+'%</b><br>同窗叶温峰值 '+fmt(v.leaf,1)+'°C / 上限25°C<br>VPD峰值 '+fmt(v.vpd)+'kPa / 上限0.92kPa<br>'+ (v.concordant?'环境越限与根系变化方向一致':'请复核根系变化与环境记录'))+'</div><div class="review-plan-comparison"><p><b>整区制冷</b>：冠层与根区一起降温</p><p><b>根冠分区</b>：冠层降负荷，根区局部控温</p><small>项目制冷能耗指数：100→40</small></div><label>处置方案<select data-review="rootPlan"><option value="">请选择</option><option value="whole"'+(s.rootPlan==='whole'?' selected':'')+'>整区制冷</option><option value="decoupled"'+(s.rootPlan==='decoupled'?' selected':'')+'>根冠分区</option></select></label><label>根区目标（°C）<input data-review="rootTarget" type="number" min="10" max="25" step="0.1" value="'+s.rootTarget+'" placeholder="核对工艺目标"></label><button type="button" data-review-confirm '+(s.confirmed?'disabled':'')+'>'+(s.confirmed?'处置方案已确认':'确认处置方案')+'</button><p role="status" data-review-message>'+(s.confirmed?'目标18°C；执行后复核根温、DO与VPD':'计算后选择方案、核对目标并确认')+'</p></section>';
 }
 function paint(){
  if(window.__AEROSENSE_WORKBENCH__){window.__AEROSENSE_WORKBENCH__.sync();return;}
  const panel=document.querySelector('.operator-console-body');if(!panel)return;
  const key=currentEvent().key;
  if(key==='electrostatic'&&op.state.electro.loaded&&!panel.querySelector('[data-static-review]')){
   panel.querySelector('[data-op="electro-apply"]')?.before(document.createRange().createContextualFragment(staticBlock()));
  }
  if(['heat','root-scan'].includes(key)&&op.state.rootAuthorized&&!panel.querySelector('[data-root-review]')){
   panel.querySelector('[data-op="heat-root"]')?.remove();panel.insertAdjacentHTML('beforeend',rootBlock());
  }
  const block=panel.querySelector('[data-static-review]');
  const settingInput=panel.querySelector('[data-op-input="voltage"]');
  const setting=Number(settingInput?.value);
  const settingValid=!!settingInput&&settingInput.value.trim()!==''&&settingInput.checkValidity()&&Number.isFinite(setting);
  if(block){
   const current=op.state.electro;
   block.querySelector('[data-static-reference]').textContent=current.valid?'−'+fmt(current.reference)+' kV':'输入无效';
   block.querySelector('[data-static-setting]').textContent=settingValid?'−'+fmt(setting,1)+' kV':'待输入';
  }
  const root=panel.querySelector('[data-root-review]');if(root){const confirm=root.querySelector('[data-review-confirm]');confirm.disabled=state().confirmed;confirm.textContent=state().confirmed?'处置方案已确认':'确认处置方案';if(!state().computed&&!state().result)root.querySelector('[data-review-result]').textContent='核对参数后计算变化与越限';}
  const deviation=panel.querySelector('[data-electro-deviation]');
  if(deviation)deviation.textContent=!op.state.electro.valid?'请先核对湿度与根系面积':!settingValid?'输入工作幅值，核对与参考值的偏差':'与模型参考幅值偏差 '+fmt(Math.abs(setting-op.state.electro.reference)/op.state.electro.reference*100)+'%；极性为负';
 }
 document.addEventListener('input',e=>{
  if(e.target.dataset?.electro)queueMicrotask(paint);const k=e.target.dataset?.review;if(!k||['referenceIndex','currentIndex'].includes(k))return;const s=state();s[k]=e.target.value;
  s.confirmed=false;if(['referenceIndex','currentIndex'].includes(k)){s.computed=false;s.result=null;}
 });
 document.addEventListener('change',e=>{const k=e.target.dataset?.review;if(k&&!['referenceIndex','currentIndex'].includes(k)){state()[k]=e.target.value;state().confirmed=false;}});
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-review-calculate]')){
   if(window.__AEROSENSE_WORKBENCH__?.visible()){window.__AEROSENSE_WORKBENCH__.runAnalysis();return;}
   const result=calculateRoot(),node=document.querySelector('[data-root-review]');if(window.__AEROSENSE_WORKBENCH__?.visible())window.__AEROSENSE_WORKBENCH__.message('');else if(node)node.outerHTML=rootBlock();void chime();
  }
  if(e.target.closest('[data-review-confirm]')){
   if(window.__AEROSENSE_WORKBENCH__?.busy())return;
   const message=confirmRoot(),node=document.querySelector('[data-review-message]');if(node)node.textContent=message;if(window.__AEROSENSE_WORKBENCH__?.visible())window.__AEROSENSE_WORKBENCH__.message(message);
   if(!message){const s=state();e.target.closest('[data-review-confirm]').disabled=true;e.target.closest('[data-review-confirm]').textContent='已确认';logEvent({...currentEvent(),result:(s.rootPlan==='whole'?'整区制冷':s.rootPlan==='decoupled'?'根冠分区':'调控设置已确认')+'，根区目标：'+fmt(s.rootTarget,1)+'°C'},false);void chime();ui.closeModule();}
  }
 });
 const beforeRender=renderEventVisual;renderEventVisual=function(e){
  const html=beforeRender(e);
  if(e.key!=='root-scan')return html;
  return html;
 };
 const previousTargets=eventTargets;eventTargets=function(id){const t=previousTargets(id);if(id==='B05'&&reached('light-bulking'))t.ec=2.2;return t;};
 window.__AEROSENSE_REVIEW__={state,calculateRoot,confirmRoot,paint,reset(){op.state.review=null;state();}};
 setInterval(paint,100);
})();
