// Store every event for this browser session; the monitor shows four at rest.
window.__AEROSENSE_EVENT_LOG__=(()=>{
 const entries=[];
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function render(){
  const table=document.querySelector('#logTable tbody');if(!table)return;
  const expanded=table.closest('.log-body')?.classList.contains('is-expanded');
  const rows=(expanded?entries:entries.slice(-4)).slice().reverse();
  table.innerHTML=rows.map(r=>'<tr data-event-index="'+r.index+'"'+(r.alert?' class="alarm-row"':'')+'><td>'+escape(r.time)+'</td><td>'+escape(r.category)+'</td><td>'+escape((r.direction==='prev'?'返回 · ':'')+r.title+' · '+r.result)+'</td></tr>').join('');
 }
 return {
  append(e,alert,direction){const now=new Date();entries.push({id:entries.length+1,at:now.toISOString(),time:now.toLocaleTimeString('zh-CN',{hour12:false}),category:LOG_CATEGORY[e.type]||'系统',key:e.key||currentEvent()?.key,index:app.event,title:e.title,result:e.result,alert:!!alert,direction});render();},
  render,
  reset(){entries.length=0;render();},
  records:()=>entries.map(r=>({...r})),
  async export(){const record={version:window.__AEROSENSE_RELEASE__.version,batch:'AS-2609-017',events:entries.map(r=>({...r}))};const payload=JSON.stringify(record);if(!globalThis.crypto?.subtle)return {record,payload,sha256:null};const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload));return {record,payload,sha256:[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('')};}
 };
})();
function logEvent(e,alertActive,direction='next'){
 if(window.__AEROSENSE_RANKING_MODE__)return window.__AEROSENSE_EVENT_LOG__.append(e,alertActive,direction);
 const t=new Date().toLocaleTimeString('zh-CN',{hour12:false}),category=LOG_CATEGORY[e.type]||'系统',prefix=direction==='prev'?'返回 · ':'',row=`<tr data-event-index="${app.event}"${alertActive?' class="alarm-row"':''}><td>${t}</td><td>${category}</td><td>${prefix}${e.title} · ${e.result}</td></tr>`;
 $('#logTable tbody').insertAdjacentHTML('afterbegin',row);while($('#logTable tbody').children.length>4)$('#logTable tbody').lastElementChild.remove();
}
