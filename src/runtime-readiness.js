/* Startup readiness must not hold the operation sequence indefinitely. */
(()=>{
 const state={status:'waiting',reason:'',warmupDeferred:false};
 function normalize(runtime){
  const value=runtime||{error:'模型初始化未完成'};
  if(typeof value.getState!=='function')value.getState=()=>null;
  if(typeof value.resetCamera!=='function')value.resetCamera=()=>{};
  return value;
 }
 function fail(error){
  state.status='fallback';state.reason=String(error);
  window.__AEROSENSE_TWIN__=normalize({error:state.reason});
  const root=document.querySelector('#twinVisual .b05-three-root');
  root?.classList.add('is-fallback');
  const message=root?.querySelector('.b05-three-loading');
  if(message)message.textContent='3D不可用，已保留阶段图片';
  return window.__AEROSENSE_TWIN__;
 }
 function accept(runtime){
  const value=normalize(runtime);
  if(value.error)return fail(value.error);
  window.__AEROSENSE_TWIN__=value;state.status='mounted';state.reason='';
  document.querySelector('#twinVisual .b05-three-root')?.classList.remove('is-fallback');
  return value;
 }
 function ready(elapsed){
  const runtime=window.__AEROSENSE_TWIN__,canvas=document.querySelector('.b05-three-canvas');
  if(runtime?.error){normalize(runtime);return true;}
  if(runtime&&['ready','deferred'].includes(canvas?.dataset.scenePrepared))return true;
  // The mounted scene already renders; finish expensive prewarming in the background.
  if(runtime&&elapsed>=15000){if(canvas)canvas.dataset.scenePrepared='deferred';state.warmupDeferred=true;state.status='deferred';return true;}
  // Rejected or stalled initialization falls back to the existing stage images.
  if(!runtime&&elapsed>=30000){fail('模型初始化超时');return true;}
  return false;
 }
 window.__AEROSENSE_READINESS__={state,accept,fail,ready};
})();
