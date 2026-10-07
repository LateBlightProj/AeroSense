import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';

const here=path.dirname(fileURLToPath(import.meta.url));
const release=JSON.parse(await fs.readFile(path.join(here,'release.json'),'utf8'));
const version=release.version;
if(!/^\d+\.\d+(?:\.\d+)?$/.test(version))throw Error('系统版本号格式无效');
const root=path.resolve(here,'..');
const source=path.join(root,'templates/AeroSense_11.7.2.html');
const project=root;
const originalAssets=path.join(root,'assets/images');
const sourceSnapshots=path.join(root,'templates/controllers');
const draft=process.argv.includes('--draft');
const output=path.join(root,'dist');
const safe=s=>s.replace(/<\/script/gi,'<\\/script');
const changes=['静电改为同批次参数核对、一次计算与设定复核；85%湿度沿用60分钟原稿；原视觉与其他流程保持','排位赛样本绑定后直接进入荧光曲线，移除分子检测进场与反应体系构建两次独立弹窗；完整模式保留原流程'];
let html=await fs.readFile(source,'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const baseline=sha(html);
const provenance=JSON.parse(await fs.readFile(path.join(root,'source-provenance.json'),'utf8'));
if(baseline!==provenance.templateSha256)throw Error('模板完整性校验失败');
function replaceOnce(a,b,label){
 const count=html.split(a).length-1;
 if(count!==1)throw Error(`${label}: expected one boundary, found ${count}`);
 html=html.replace(a,()=>b);changes.push(label);
}
replaceOnce("note:'采前品质校验 → 采后高光谱筛查 → 合格确权入库。异常对象进入红色剔除出口，合格对象进入绿色出口并关联批次记录。'","note:window.__AEROSENSE_RANKING_MODE__?'':'采前品质校验 → 采后高光谱筛查 → 合格确权入库。异常对象进入红色剔除出口，合格对象进入绿色出口并关联批次记录。'",'删除交付凭证重复流程说明');
const markRenderer=await fs.readFile(path.join(here,'aom-mark.js'),'utf8');
const readiness=await fs.readFile(path.join(here,'runtime-readiness.js'),'utf8');
const prelude='<script>window.__AEROSENSE_RELEASE__='+JSON.stringify(release)+";window.__AEROSENSE_RANKING_MODE__=new URLSearchParams(location.search).get('mode')!=='full';</script>"+'<script>'+safe(markRenderer)+'</script>'+'<script>'+safe(readiness)+'</script>';
replaceOnce('<head>','<head>'+prelude,'排位赛/完整模式开关');
replaceOnce('<title>AeroSense OS ver11.7.2 · 动作预览版</title>',`<title>AeroSense 排位赛 v${version}</title>`,'页面标题版本号');
replaceOnce('CONTROL OS · ver11.7.2',`CONTROL OS · v${version}`,'待机页版本号');
replaceOnce('const isHeatAlarm=()=>','let isHeatAlarm=()=>','排位赛热报警按处置与反馈保留');
replaceOnce("const isPotassiumAlarm=()=>eventAmong('K⁺异常下降','补钾脉冲');",
 "const isPotassiumAlarm=()=>!window.__AEROSENSE_RANKING_MODE__&&eventAmong('K⁺异常下降','补钾脉冲');",
 '排位赛取消K⁺报警触发及全局报警联动');
replaceOnce('Math.max(0,a-27)*6/9','Math.max(0,a-27)*6/(window.__AEROSENSE_RANKING_MODE__?8:9)',
 '冷风干燥输送在8秒内完成，雾化段保持9秒');
replaceOnce("window.AeroSenseTwin3D.mount($('#twinVisual'),snapshot).then(runtime=>{window.__AEROSENSE_TWIN__=runtime;});",
 `try{Promise.resolve(window.AeroSenseTwin3D.mount($('#twinVisual'),snapshot)).then(runtime=>window.__AEROSENSE_READINESS__.accept(runtime)).catch(error=>window.__AEROSENSE_READINESS__.fail(error));}catch(error){window.__AEROSENSE_READINESS__.fail(error);}`,
 '捕获三维初始化拒绝与同步异常，保留原阶段视图和推进流程');
replaceOnce("$('#twinVisual .b05-three-root').append(uvaStatus);",
 "$('#twinVisual .b05-three-root')?.append(uvaStatus);",'初始化失败时不向不存在的三维容器插入状态');
const originalBootLights=`if(q?.active&&q.event===0&&q.elapsed<7){
   const channel=q.elapsed>=4?Math.min(4,Math.floor((q.elapsed-4)/.6)):-1;
   l.spectrum={w:channel===0?100:0,r:channel===1?100:0,b:channel===2?100:0,fr:channel===3?100:0};
   l.uva=channel===4;l.on=channel>=0;l.dimming=l.on?50:0;
   l.spectrumLabel=channel<0?'光源待检':['白光自检','红光自检','蓝光自检','远红光自检','UVA自检'][channel];
  }`;
replaceOnce(originalBootLights,`if(q?.active&&q.event===0&&q.elapsed<7){
   if(window.__AEROSENSE_RANKING_MODE__){
    if(q.elapsed<3){const checking=q.elapsed>=2;l.spectrum=checking?{w:40,r:25,b:20,fr:15}:{w:0,r:0,b:0,fr:0};l.uva=checking;l.on=checking;l.dimming=checking?50:0;l.spectrumLabel=checking?'光源统一自检':'光源待检';}
   }else{
    const channel=q.elapsed>=4?Math.min(4,Math.floor((q.elapsed-4)/.6)):-1;
    l.spectrum={w:channel===0?100:0,r:channel===1?100:0,b:channel===2?100:0,fr:channel===3?100:0};
    l.uva=channel===4;l.on=channel>=0;l.dimming=l.on?50:0;
    l.spectrumLabel=channel<0?'光源待检':['白光自检','红光自检','蓝光自检','远红光自检','UVA自检'][channel];
   }
  }`,'排位赛光源统一自检，随后恢复生产光配方；完整模式保持逐通道自检');
replaceOnce('drying:!t&&a>=27&&a<36','drying:!t&&a>=27&&a<(window.__AEROSENSE_RANKING_MODE__?35:36)',
 '冷风动画完成阈值提前1秒');
replaceOnce('const eventMistActive=()=>','let eventMistActive=()=>','修复11.7.2雾化状态回调被重写时的常量赋值错误');
replaceOnce('Y0=Zt.matches?3.98:G0<2.5?4*(1-Math.pow(1-G0/2.5,3)):G0<5?4:3.98;',
 'Y0=window.__AEROSENSE_RANKING_MODE__||Zt.matches?3.98:G0<2.5?4*(1-Math.pow(1-G0/2.5,3)):G0<5?4:3.98;',
 '排位赛压力核验卡片固定完成读数，主画面升压动画保持');
replaceOnce('voltage:null,humidity:75,area:120,correction:null,reference:null}};',
 'voltage:null,humidity:window.__AEROSENSE_RANKING_MODE__?85:75,area:120,correction:null,reference:null}};',
 '排位赛静电初始湿度沿用原稿85%');
replaceOnce('valid:false,voltage:null,humidity:75,area:120,correction:null,reference:null});},',
 'valid:false,voltage:null,humidity:window.__AEROSENSE_RANKING_MODE__?85:75,area:120,correction:null,reference:null});},',
 '静电重置恢复同一批次湿度');
replaceOnce('loadElectro(humidity=75,area=120)',
 'loadElectro(humidity=window.__AEROSENSE_RANKING_MODE__?85:75,area=120)',
 '静电默认计算输入与同批次湿度一致');
replaceOnce('canStartHarvest(){return state.harvest.approved;}',
 'canStartHarvest(){return window.__AEROSENSE_RANKING_MODE__||state.harvest.approved;}',
 '排位赛采收直接播放，完整模式保留原核准门槛');
// Ranking startup: a single clock keeps all six loading stages within 1.4 s.
// Full mode and the existing startupTest path retain their original timings.
replaceOnce('let startupRunning=false,startupFinished=app.qa;',
 `let startupRunning=false,startupFinished=app.qa;
let rankingBootStartedAt=0,rankingBootGeneration=0;
function loadRankingSystem(){
 const generation=++rankingBootGeneration,started=performance.now();rankingBootStartedAt=started;
 let offset=0,index=-1;
 const loading=1100,exit=20,total=1220,weight=startupStages.reduce((sum,stage)=>sum+stage[3],0);
 const nodes=startupStages.map((stage,i)=>{const hold=loading*stage[3]/weight,node={index:i,from:offset,hold,to:offset+hold+exit};offset=node.to;return node;});
 function frame(now){
  if(generation!==rankingBootGeneration||!startupRunning||startupFinished)return;
  const elapsed=Math.max(0,now-started),node=nodes.find(node=>elapsed<node.to)||nodes.at(-1);
  if(index!==node.index){index=node.index;setStartupStage(index);}
  const previous=index?startupStages[index-1][2]:0,progress=Math.min(1,Math.max(0,(elapsed-node.from)/node.hold));
  const ready=window.__AEROSENSE_READINESS__.ready(elapsed);
  setBootProgress(Math.min(ready?1:.99,(previous+(startupStages[index][2]-previous)*progress)/100));
  const holding=elapsed>=total&&!ready,current=$('#startupCurrent');current.classList.toggle('is-active',progress<1||holding);current.classList.toggle('is-leaving',progress>=1&&!holding);
  if(elapsed>=total&&ready){current.classList.remove('is-leaving');finishStartup();return;}
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}`,'六个加载节点改用统一时钟，加载与转场合计1.4秒');
replaceOnce("const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,test=query.has('startupTest');function loadNextNode(){",
 "const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,test=query.has('startupTest');if(window.__AEROSENSE_RANKING_MODE__&&!test){loadRankingSystem();return;}function loadNextNode(){",
 '仅排位赛启用快速加载，完整模式与测试快捷入口保持');
replaceOnce("startup.dataset.phase='leaving';setTimeout(()=>{startup.classList.add('is-complete');",
 "startup.dataset.phase='leaving';const generation=rankingBootGeneration;setTimeout(()=>{if(window.__AEROSENSE_RANKING_MODE__&&!query.has('startupTest')&&(generation!==rankingBootGeneration||!startupFinished))return;startup.classList.add('is-complete');",
 '快速加载回调检查当前启动轮次，避免重启后的旧回调');
replaceOnce("},query.has('startupTest')?50:260)}",
 "},query.has('startupTest')?50:window.__AEROSENSE_RANKING_MODE__?Math.max(0,rankingBootStartedAt+1400-performance.now()):260)}",
 '启动点击后1.4秒切入主画面自检，随后3.6秒进入首个弹窗；总计5秒');
replaceOnce("if(!direction||controlOwnsFlowKey(e.target)||!startupFinished)return;",
 "if(!direction||!startupFinished||controlOwnsFlowKey(e.target)&&!(window.__AEROSENSE_RANKING_MODE__&&['PageUp','PageDown'].includes(e.key)))return;",
 '排位赛PageUp/PageDown不受输入焦点拦截');
replaceOnce('function instantKeyboardFlow98(e){',
 "function instantKeyboardFlow98(e){if(window.__AEROSENSE_RANKING_MODE__&&window.__AEROSENSE_CLOSING__?.busy()&&e.repeat){e.preventDefault();e.stopImmediatePropagation();return;}",
 '尾段忽略长按重复事件，保留单次推进审查');
replaceOnce("if(!target.matches('input'))return false;return !['button','submit','reset','checkbox','radio']",
 "if(!target.matches('input'))return false;if(window.__AEROSENSE_RANKING_MODE__&&target.readOnly)return false;return !['button','submit','reset','checkbox','radio']",
 '排位赛只读输入不占用方向键');


const logBoundary=html.match(/function logEvent\(e,alertActive,direction='next'\)\{[^\n]+\}/)?.[0];
if(!logBoundary)throw Error('事件记录边界变化');
replaceOnce(logBoundary,await fs.readFile(path.join(here,'log-store.js'),'utf8'),'完整保存本轮事件记录');
replaceOnce("more.setAttribute('aria-expanded',String(on));", "more.setAttribute('aria-expanded',String(on));window.__AEROSENSE_EVENT_LOG__?.render();",'展开记录读取完整日志');
const {build:compileTwin}=await import('esbuild');
const modelManifest=JSON.parse(await fs.readFile(path.join(here,'three-src/models/manifest.json'),'utf8'));
for(const [name,record] of Object.entries(modelManifest)){
 const binary=await fs.readFile(path.join(here,'three-src/models',name));
 if(binary.length!==record.bytes||sha(binary)!==record.sha256)throw Error('云端GLB冻结校验失败: '+name);
}
const twinBuild=await compileTwin({entryPoints:[path.join(here,'three-src/runtime.ts')],nodePaths:[path.join(root,'node_modules')],bundle:true,write:false,minify:true,format:'iife',globalName:'AeroSenseTwin3D',target:'es2020',loader:{'.glb':'base64','.png':'base64'}});
const twinOriginal=html.match(/<script>var AeroSenseTwin3D=[\s\S]*?<\/script>/)?.[0];
if(!twinOriginal)throw Error('Missing embedded 3D runtime');
replaceOnce(twinOriginal,'<script>'+safe(twinBuild.outputFiles[0].text)+'</script>','原三维模型内氧合、气泡与循环净化动画；保留原模型和其他设备');

for(const name of ['sequence.js','operator-ui.js','reaction-unified.js','aiops-takeover.js','solving-loading.js']){
 await fs.mkdir(sourceSnapshots,{recursive:true});
 const snapshot=path.join(sourceSnapshots,name);
 const original=await fs.readFile(snapshot,'utf8');
 let patched=original;
 if(name==='sequence.js'){
  patched=patched.replace("0:[[0,'overview','区位上线','B01—B09 依次建立采集关联'],[2,'overview','传感器自检','环境、叶温、光谱、根像、根液依次响应'],[4,'overview','发光通道自检','逐路点亮，随后恢复生产配方'],[7,'overview','喷雾短脉冲','检查喷雾覆盖与回液响应'],[9,'overview','自检完成','设备回到当前生产状态']]", "0:window.__AEROSENSE_RANKING_MODE__?[[0,'overview','区位上线','B01—B09 依次建立采集关联'],[2,'overview','光源统一自检','同步点亮，随后恢复生产配方'],[3,'overview','传感器自检','环境、叶温、光谱、根像、根液依次响应'],[7,'overview','喷雾短脉冲','检查喷雾覆盖与回液响应'],[9,'overview','自检完成','设备回到当前生产状态']]:[[0,'overview','区位上线','B01—B09 依次建立采集关联'],[2,'overview','传感器自检','环境、叶温、光谱、根像、根液依次响应'],[4,'overview','发光通道自检','逐路点亮，随后恢复生产配方'],[7,'overview','喷雾短脉冲','检查喷雾覆盖与回液响应'],[9,'overview','自检完成','设备回到当前生产状态']]");
  patched=patched.replace("const start=2+i*.35,online=elapsed>=start+.35;", "const step=window.__AEROSENSE_RANKING_MODE__?4/lamps.length:.35,start=(window.__AEROSENSE_RANKING_MODE__?3:2)+i*step,online=elapsed>=start+step;");
  patched=patched.replace("if(elapsed>=4&&elapsed<7)document.querySelector('#lightCycle').textContent='光源通道自检';", "if(window.__AEROSENSE_RANKING_MODE__?elapsed>=2&&elapsed<3:elapsed>=4&&elapsed<7)document.querySelector('#lightCycle').textContent=window.__AEROSENSE_RANKING_MODE__?'光源统一自检':'光源通道自检';");
  patched=patched.replace("const channel=elapsed<4?-1:elapsed<7?Math.min(4,Math.floor((elapsed-4)/.6)):5;", "const channel=window.__AEROSENSE_RANKING_MODE__?(elapsed<2?-1:elapsed<3?0:5):(elapsed<4?-1:elapsed<7?Math.min(4,Math.floor((elapsed-4)/.6)):5);");
  if(patched.split('25:37').length!==2||patched.split("[36,'post-drying','处理完成'").length!==2)throw Error('采后时长边界变化');
  patched=patched.replace('25:37','25:window.__AEROSENSE_RANKING_MODE__?36:37');
  patched=patched.replace('29:5,30:6','29:5,30:window.__AEROSENSE_RANKING_MODE__?7:6');
  patched=patched.replace("[3,'light','UVA 品质处理'","[window.__AEROSENSE_RANKING_MODE__?4:3,'light','UVA 品质处理'");
  patched=patched.replace("[36,'post-drying','处理完成'","[window.__AEROSENSE_RANKING_MODE__?35:36,'post-drying','处理完成'");
  const oxygenSteps="19:[[0,'oxygen','液体氧合','气液混合仅在处理腔内'],[5,'fluid','氧合循环','处理后营养液回到水箱']]";
  if(!patched.includes(oxygenSteps))throw Error('Missing original oxygen schedule');
  patched=patched.replace(oxygenSteps,"19:window.__AEROSENSE_RANKING_MODE__?[[0,'oxygen','氧合循环','处理腔气液传质'],[3,'uv','循环净化','自毒物质清除'],[6,'fluid','循环回流','处理后营养液回流']]:[[0,'oxygen','液体氧合','气液混合仅在处理腔内'],[5,'fluid','氧合循环','处理后营养液回到水箱']]");
  patched=patched.replace('event=n;elapsed=offset;last=0;active=true;', 'event=n;elapsed=offset;last=window.__AEROSENSE_RANKING_MODE__&&[0,18,25].includes(n)&&startupFinished?performance.now():0;active=true;');
  patched=patched.replace('function syncReadout(){',"function syncReadout(){if(window.__AEROSENSE_RANKING_MODE__&&event===18)window.__AEROSENSE_RANKING__?.syncCoolingResponse?.();");
  patched=patched.replace('function tick(now){', `// Keep the original model timeline; map it to 7.3s scanning and 11s treatment.
 function advancePostharvest(delta){
  const seconds=elapsed<=18?elapsed*7.3/18:7.3+(elapsed-18)*11/18,next=seconds+delta;
  elapsed=next>=18.3-1e-9?36:next>=7.3-1e-9?18+Math.max(0,next-7.3)*18/11:next*18/7.3;
 }
 document.addEventListener('visibilitychange',()=>{if(active&&[18,25].includes(event)&&window.__AEROSENSE_RANKING_MODE__)last=document.hidden?0:performance.now();});
 function tick(now){`);
  patched=patched.replace('if(last)elapsed+=Math.min(1,(now-last)/1000);', 'if(last){const delta=Math.max(0,(now-last)/1000);if(window.__AEROSENSE_RANKING_MODE__&&event===25)advancePostharvest(delta);else elapsed+=Math.min(1,delta)*(window.__AEROSENSE_RANKING_MODE__?(event===0?11/3.6:event===1?10/3:event===18?1:event===19?.8:event===29?5/3:event===31?2:event===24?4/3:event===14?9/8:event===23?1/.7:1):1);if(window.__AEROSENSE_RANKING_MODE__&&event===18&&elapsed>=8-1e-9)elapsed=8;}');
  patched=patched.replace("segmentEnd=n===30&&offset===0?3:n===25&&offset===0?18:durations[n];","segmentEnd=n===30&&offset===0&&!window.__AEROSENSE_RANKING_MODE__?3:n===25&&offset===0&&!window.__AEROSENSE_RANKING_MODE__?18:durations[n];");
  
  patched=patched.replace("if(postScan)awaiting='post-treatment';}","if(postScan)awaiting='post-treatment';if(window.__AEROSENSE_RANKING_MODE__&&(qualityScan||postScan)&&!document.querySelector('#eventLayer').classList.contains('open'))openLayer(document.querySelector('#eventLayer'));if(window.__AEROSENSE_RANKING_MODE__&&event===25&&elapsed>=durations[25])window.__AEROSENSE_RANKING__?.completePostharvest();if(window.__AEROSENSE_RANKING_MODE__&&event===18&&elapsed>=durations[18])window.__AEROSENSE_RANKING__?.completeCooling?.();}");
  
  patched=patched.replace('window.__AEROSENSE_SEQUENCE__={state,start,finish,startConfirmedElectro,get awaiting(){return awaiting;}};',`window.__AEROSENSE_SEQUENCE__={state,start,finish,startConfirmedElectro,
   skip(){if(!active)return false;if(event===14&&!window.__AEROSENSE_OPERATOR__?.state.electro.applied||event===17&&!window.__AEROSENSE_OPERATOR__?.state.rootAuthorized||event===24&&!window.__AEROSENSE_OPERATOR__?.canStartHarvest())return false;elapsed=segmentEnd;syncReadout();endSegment();protectTransition();updatePlots();return true;},
   restore(snapshot){finish(false);event=snapshot.event;elapsed=snapshot.elapsed;awaiting=snapshot.awaiting||'';segmentEnd=snapshot.segmentEnd??(awaiting==='post-treatment'?18:awaiting==='quality-treatment'?3:durations[event]);active=false;pending=false;pendingSound=false;revision++;syncReadout();updatePlots();},
   reset(){finish(false);bootCompleted=false;pressureArmed=false;bootSprayPending=false;event=-1;elapsed=0;awaiting='';pending=false;pendingSound=false;last=0;inputReadyAt=0;},get inputReady(){return Date.now()>=inputReadyAt;},get awaiting(){return awaiting;}};`);
 }
 if(name==='operator-ui.js'){
  const omittedHarvest="const omittedCards=new Set(['electrostatic','root-scan']);";
  if(!patched.includes(omittedHarvest))throw Error('省略卡片边界变化');
  patched=patched.replace(omittedHarvest,"const omittedCards=new Set(['electrostatic','root-scan',...(window.__AEROSENSE_RANKING_MODE__?['harvest']:[])]);");
  patched=patched.replace("if(e.key==='harvest')e={...e,result:op.state.harvest.approved?'采收任务已核准':'采收任务待核准'};","if(e.key==='harvest'&&!window.__AEROSENSE_RANKING_MODE__)e={...e,result:op.state.harvest.approved?'采收任务已核准':'采收任务待核准'};");
  const harvestApproval="if(key==='harvest'&&action==='harvest-approve'&&op.approveHarvest()){record('小组长核准采收任务');refresh();closeLayer(layer);window.__AEROSENSE_TWIN__?.resetCamera();}";
  if(patched.split(harvestApproval).length!==2)throw Error('采收核准操作边界变化');
  patched=patched.replace(harvestApproval,harvestApproval.slice(0,-1)+"if(window.__AEROSENSE_RANKING_MODE__)window.__AEROSENSE_SEQUENCE__.start(eventNumber('harvest'),false,false);}");
  patched=patched.replace("&&e.key!=='Escape')e.stopImmediatePropagation();","&&e.key!=='Escape'&&e.key!=='Tab')e.stopImmediatePropagation();");
  patched=patched.replace('function renderConsole(){\n  syncModules();', `function renderConsole(){
  syncModules();
  if(window.__AEROSENSE_RANKING_MODE__&&window.__AEROSENSE_WORKBENCH__){consolePanel.hidden=!selectedModule;equipment.classList.remove('operator-replaced');window.__AEROSENSE_WORKBENCH__.renderConsole(consolePanel,selectedModule,choices,heatData);return;}`);
  patched=patched.replace("if(action==='electro-load'&&",`if(window.__AEROSENSE_RANKING_MODE__&&window.__AEROSENSE_WORKBENCH__&&['electro-load','heat-root'].includes(action)){
   window.__AEROSENSE_WORKBENCH__.runAnalysis();return;
  }
  if(action==='electro-load'&&`);
  patched=patched.replace("(h?.value??op.state.electro.humidity):75", "(h?.value??op.state.electro.humidity):(window.__AEROSENSE_RANKING_MODE__?85:75)");
  patched=patched.replace("b.disabled?'等待对应事件提示结束'","b.disabled?'当前工序尚未就绪'");
  patched=patched.replace("button('module-close','关闭')+'</header><div class=\"operator-console-body op-composition\">'+rootChoices()","button('module-close','返回监控')+'</header><div class=\"operator-console-body op-composition\">'+rootChoices()");
  patched=patched.replaceAll('反馈电流：微安级稳定',"模拟反馈：微安级稳定；实物电流另行核对");

  patched=patched.replace("  const name=selectedModule;if(!moduleAllowed(name))return;", `  const name=selectedModule;if(!moduleAllowed(name))return;
  if(window.__AEROSENSE_RANKING_MODE__&&window.__AEROSENSE_WORKBENCH__&&name==='electro'&&key==='input'){
   window.__AEROSENSE_WORKBENCH__.changeSource(e.target.value);choices[key]=e.target.value;renderConsole();return;
  }`);
  patched=patched.replace("  if(!op.state.electro.loaded)return;", "  if(window.__AEROSENSE_RANKING_MODE__&&window.__AEROSENSE_WORKBENCH__)return;\n  if(!op.state.electro.loaded)return;");
  patched=patched.replace("  const input=consolePanel.querySelector('[data-op-input=\"voltage\"]');", `  if(window.__AEROSENSE_RANKING_MODE__&&window.__AEROSENSE_WORKBENCH__&&!window.__AEROSENSE_WORKBENCH__.canApplyElectro())return false;
  const input=consolePanel.querySelector('[data-op-input="voltage"]');`);
  // Keep the original batch-record default; calculations remain manually triggered.
  patched=patched.replace("record('小组长启动根系表型分析')","record(window.__AEROSENSE_RANKING_MODE__?'小组长载入已有根系分析结果':'小组长启动根系表型分析')");
  patched=patched.replace("button('heat-root','开始分析')","button('heat-root',window.__AEROSENSE_RANKING_MODE__?'载入已有结果':'开始分析')");
  patched=patched.replace("select('rootModel','模型'","select('rootModel',window.__AEROSENSE_RANKING_MODE__?'已有结果视图':'模型'");
  patched=patched.replace("'Root-UNet 分割'","window.__AEROSENSE_RANKING_MODE__?'已有分割结果':'Root-UNet 分割'");
  patched=patched.replace("'Graph-GNN 拓扑'","window.__AEROSENSE_RANKING_MODE__?'已有拓扑结果':'Graph-GNN 拓扑'");
  patched=patched.replace(' refresh();\n})();',` window.__AEROSENSE_OPERATOR_UI__={
   snapshot:()=>({rootLoaded,heatData:heatData?JSON.parse(JSON.stringify(heatData)):null,promptClosed:{...promptClosed},choices:{...choices},selectedModule}),
   restore(s){if(!s)return;rootLoaded=!!s.rootLoaded;heatData=s.heatData?JSON.parse(JSON.stringify(s.heatData)):null;Object.assign(promptClosed,s.promptClosed);Object.assign(choices,s.choices);selectedModule=s.selectedModule||null;refresh();},
   closeModule(){selectedModule=null;renderConsole();},
   prepare(key){selectedModule=null;if(key==='electrostatic')promptClosed.electro=true;if(key==='heat')promptClosed.root=false;refresh();},
   activateRoot(){if(!['heat','root-scan'].includes(currentEvent().key))return false;if(op.state.rootAuthorized)return true;op.state.rootAuthorized=true;record('B05根系分析启动');setEvent(eventNumber('root-scan'),{sound:false,open:false,present:false});closeLayer(layer);selectedModule='root';rootLoaded=true;renderConsole();return true;},
   diagnoseHeat(){if(!['heat','root-scan'].includes(currentEvent().key)||window.__AEROSENSE_SEQUENCE__?.state().active||window.__AEROSENSE_LOADING__?.busy())return false;promptClosed.root=true;closeLayer(layer);loadModule('root');return true;},
   refresh};
 refresh();\n})();`);
 }
 if(name==='reaction-unified.js'){
  patched=patched.replaceAll('samples:[],crossedAt:null});','samples:[],crossedAt:null,pausedAt:0});');
  patched=patched.replace("samples:[],crossedAt:null", "samples:[],crossedAt:null,pausedAt:0");
  patched=patched.replace("Math.max(0,Date.now()-session.startedAt)","Math.min(window.__AEROSENSE_RANKING_MODE__?100000:Infinity,Math.max(0,(session.pausedAt||Date.now())-session.startedAt)*(window.__AEROSENSE_RANKING_MODE__?200/37:1))");
  patched=patched.replace("session.completed?'反应完成 · 对照有效 · 样本阴性':'三通道同步记录'", "(session.completed?'反应完成 · 对照有效 · 样本阴性':session.pausedAt?'三通道记录已暂停':'三通道同步记录')+(window.__AEROSENSE_RANKING_MODE__?' · 演示×5.4':'')");
  patched=patched.replace("window.__AEROSENSE_REACTION__={session,start,update,elapsed};", `window.__AEROSENSE_REACTION__={session,start,update,elapsed,
   busy:()=>active()&&!!session.startedAt&&!session.completed,
   pause(){if(!active()||!session.startedAt||session.completed)return false;session.pausedAt=Date.now();update();return true;},
   resume(){if(!session.pausedAt)return false;session.startedAt+=Date.now()-session.pausedAt;session.pausedAt=0;update();return true;},
   skip(){if(!active()||!session.startedAt||session.completed)return false;session.pausedAt=0;session.startedAt=Date.now()-100000/(window.__AEROSENSE_RANKING_MODE__?200/37:1);update();return true;},
   snapshot:()=>({...JSON.parse(JSON.stringify(session)),elapsedMs:elapsed()}),
   restore(s){if(!s)return;Object.assign(session,s);if(s.startedAt){session.startedAt=Date.now()-(s.elapsedMs||0)/(window.__AEROSENSE_RANKING_MODE__?200/37:1);session.pausedAt=s.pausedAt?Date.now():0;}paintedSample=-1;update();},
   reset(){Object.assign(session,{startedAt:0,completed:false,skipped:false,samples:[],crossedAt:null,pausedAt:0});app.crisprStartedAt=0;paintedSample=-1;}
  };`);
 }
 if(name==='aiops-takeover.js'){
  patched=patched.replace("title:'AIoT全自动运维接管'", "title:'AeroSense Autonomy'");
  const seal='<svg class="takeover-seal" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"/><path d="M11 20l6 6 12-13"/></svg>';
  if(!patched.includes(seal))throw Error('接管卡片Logo边界变化');
  patched=patched.replace(seal,'<canvas class="takeover-autonomy-mark" width="128" height="128" aria-hidden="true"></canvas>');
  patched=patched.replace(' function paint(){',` let lastMarkCanvas=null,lastMarkAt=-Infinity,lastMarkPhase=-1,markIdleStartedAt=0;
 function paintMark(phase){
  if(phase<3)return;
  const canvas=layer.querySelector('.takeover-autonomy-mark'),now=performance.now(),reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(!canvas||(canvas===lastMarkCanvas&&phase===lastMarkPhase&&(reduced||now-lastMarkAt<33)))return;
  if(phase===4&&(phase!==lastMarkPhase||canvas!==lastMarkCanvas))markIdleStartedAt=now;
  lastMarkCanvas=canvas;lastMarkAt=now;lastMarkPhase=phase;
  window.__AEROSENSE_AOM_MARK__.draw(canvas.getContext('2d'),reduced?.8:phase===4?(now-markIdleStartedAt)/1000:elapsed/3.5,phase===4?'idle':'loading');
 }
 function paint(){`);
  patched=patched.replace('layer.dataset.takeoverPhase=String(phase);', 'layer.dataset.takeoverPhase=String(phase);paintMark(phase);');
  patched=patched.replace('completionSoundPlayed=false;', 'completionSoundPlayed=false,paused=false;');
  // Resetting a new takeover clears pause; snapshot restoration keeps its own pause state.
  const takeoverReset='function reset(){elapsed=0;last=0;completionSoundPlayed=false;paint();}';
  if(!patched.includes(takeoverReset))throw Error('接管重置边界变化');
  patched=patched.replace(takeoverReset,'function reset(){elapsed=0;last=0;completionSoundPlayed=false;paused=false;wasOpen=false;paint();}');
  // The declaration replacement above also touches reset; restore its assignment syntax.
  patched=patched.replace('completionSoundPlayed=false,paused=false;paint();', 'completionSoundPlayed=false;paused=false;paint();');
  patched=patched.replace("if(!open||document.hidden)", "if(!open||document.hidden||paused)");
  patched=patched.replace("elapsed+(now-last)/1000", "elapsed+(now-last)/1000*(window.__AEROSENSE_RANKING_MODE__?3.5:1)");
  patched=patched.replace("window.__AEROSENSE_TAKEOVER__={phaseAt,modelState:", `window.__AEROSENSE_TAKEOVER__={phaseAt,
   busy:()=>currentEvent().key==='ai-ops'&&elapsed<21,
   snapshot:()=>({elapsed,completionSoundPlayed,paused}),
   restore(s){if(!s)return;elapsed=s.elapsed;completionSoundPlayed=!!s.completionSoundPlayed;paused=!!s.paused;last=0;wasOpen=false;paint();},
   pause(){paused=true;last=0;return true;},resume(){paused=false;last=0;return true;},
   skip(){if(elapsed>=21)return false;elapsed=21;paused=false;paint();return true;},reset,
   modelState:`);
 }
 if(name==='solving-loading.js'){
  if(!patched.includes('original.paintFrame(ctx,g,true);'))throw Error('原加载动效边界变化');
  patched=patched.replace('original.paintFrame(ctx,g,true);',"if(window.__AEROSENSE_RANKING_MODE__)window.__AEROSENSE_AOM_MARK__.draw(ctx,reduce.matches?.8:(now-origin)/1000,'loading');else original.paintFrame(ctx,g,true);");
  patched=patched.replace('if(job.elapsed>=3000)',"if(job.elapsed>=(window.__AEROSENSE_RANKING_MODE__&&events[job.event]?.key==='electrostatic'?1500:3000))");
  patched=patched.replace('  cancel,',"  cancel,\n  skip(){if(!job)return false;const done=job;job=null;hide();if(done.token===generation){done.complete();void soundSequence([[880,0,.10,.026,'sine'],[1320,.12,.22,.024,'sine']]);}return true;},");
  patched=patched.replace('Math.min(100,now-job.last)',"window.__AEROSENSE_RANKING_MODE__?Math.max(0,now-job.last):Math.min(100,now-job.last)");
 }
 if(patched===original)throw Error('No patch created for '+name);
 const needle='<script>'+safe(original)+'</script>';
 replaceOnce(needle,'<script>'+safe(patched)+'</script>',name+' 排位赛保护与恢复');
 await fs.writeFile(path.join(here,name),patched);
}
const css=(await fs.readFile(path.join(here,'ranking.css'),'utf8'))+'\n'+(await fs.readFile(path.join(here,'model-workbench.css'),'utf8'))+'\n'+(await fs.readFile(path.join(here,'selfcheck.css'),'utf8'))+'\n'+(await fs.readFile(path.join(here,'quality-display.css'),'utf8'))+'\n'+(await fs.readFile(path.join(here,'aom-status.css'),'utf8'))+'\n'+(await fs.readFile(path.join(here,'closing-statement.css'),'utf8'));
const rootCase=JSON.parse(await fs.readFile(path.join(here,'root-case.json'),'utf8'));
const closingLogo=JSON.parse(await fs.readFile(path.join(here,'closing-logo.json'),'utf8'));
const closingLogoBytes=await fs.readFile(path.join(here,closingLogo.file));
if(sha(closingLogoBytes)!==closingLogo.sha256)throw Error('声明Logo原图校验失败');
const closingLogoConfig={width:closingLogo.width,height:closingLogo.height,viewBox:closingLogo.viewBox,uri:'data:image/png;base64,'+closingLogoBytes.toString('base64')};
const js=(await fs.readFile(path.join(here,'review.js'),'utf8'))+'\nwindow.__AEROSENSE_CLOSING_LOGO__='+JSON.stringify(closingLogoConfig)+';\n'+(await fs.readFile(path.join(here,'closing-statement.js'),'utf8'))+'\n'+(await fs.readFile(path.join(here,'ranking.js'),'utf8'))+'\n'+(await fs.readFile(path.join(here,'selfcheck.js'),'utf8'))+'\n'+(await fs.readFile(path.join(here,'quality-display.js'),'utf8'))+'\n'+(await fs.readFile(path.join(here,'refinement.js'),'utf8'))+'\nwindow.__AEROSENSE_ROOT_CASE__='+JSON.stringify(rootCase)+';\n'+(await fs.readFile(path.join(here,'model-workbench.js'),'utf8'))+'\n'+(await fs.readFile(path.join(here,'aom-status.js'),'utf8'))+'\n'+(await fs.readFile(path.join(here,'aom-brand.js'),'utf8'));
const workbenchContract=`<!-- MODEL WORKBENCH
THESIS: 同窗核对输入、图层或曲线、计算依据及人工应用。
OWN-WORLD: 沿用黑色仪器台、生命绿和报警红；不替换原有系统美学。
STORY: 选手核对记录、分析、确认参数或处置；助手执行本地任务。
FIRST VIEWPORT: 左侧Agent、中间大图或曲线、右侧参数与调控、底部确认。
FORM: 已授权的独立大工作台弹窗；根像完整显示，返回监控保留状态。
-->`;
replaceOnce('</body>',workbenchContract+'<style>'+css+'</style><script>'+safe(js)+'</script></body>','七段专用路径与既有结果复核');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new Script(m[1]);
await fs.mkdir(path.join(output,'图片资产'),{recursive:true});
const images={};
for(const m of html.matchAll(/(["'])\.\/图片资产\/([^"']+)\1/g)){
 const name=m[2];if(images[name])continue;
 const local=path.join(output,'图片资产',name);
 let data;try{data=await fs.readFile(local);}catch{data=await fs.readFile(path.join(originalAssets,name));await fs.mkdir(path.dirname(local),{recursive:true});await fs.writeFile(local,data);}
 const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'}[path.extname(name).toLowerCase()];
 if(!mime)throw Error('Unknown asset '+name);
 images[name]='data:'+mime+';base64,'+data.toString('base64');
}
const offlineRaw=html.replace(/(["'])\.\/图片资产\/([^"']+)\1/g,(_,q,n)=>q+images[n]+q);
const {poolOfflineImages}=await import('./offline-images.mjs');
const imagePool=poolOfflineImages(offlineRaw),offline=imagePool.html;
for(const m of offline.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new Script(m[1]);
const targets=[
 [path.join(output,`AeroSense_排位赛_v${version}.html`),html],
 [path.join(output,`AeroSense_排位赛_v${version}_离线单文件.html`),offline]
];
// A published number identifies immutable content. Identical rebuilds are safe.
for(const [file,content] of targets){
 let existing;try{existing=await fs.readFile(file,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!draft&&existing!==undefined&&existing!==content)throw Error(`v${version}已存在；修改内容须递增release.json中的版本号，不能覆盖已发布版本。`);
}
for(const [file,content] of targets)await fs.writeFile(file,content);
const verification=path.join(root,'dist/metadata');
await fs.mkdir(verification,{recursive:true});
await fs.writeFile(path.join(verification,draft?'候选构建记录.json':'系统构建记录.json'),JSON.stringify({version,release,draft,base:source,baseSha256:baseline,changes,imageCount:Object.keys(images).length,imagePool:{unique:imagePool.unique,replacements:imagePool.replacements,savedBytes:imagePool.savedBytes},htmlSha256:sha(html),offlineSha256:sha(offline),fullMode:'?mode=full',rankingMode:'default'},null,2));
console.log(`Built v${version} ranking and full modes from verified 11.7.2; assets:`,Object.keys(images).length);
