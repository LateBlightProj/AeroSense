(()=>{
 if(!window.__AEROSENSE_RANKING_MODE__)return;
 const metrics=[...document.querySelectorAll('.metric')];
 const stages={oxygen:['doVal'],heat:['hVal','vpdVal','canopyTemp'],'root-scan':['vpdVal','canopyTemp'],cooling:['hVal','vpdVal','canopyTemp','rootTemp'],'vpa-setting':['vpdVal']};
 let previous='';
 function sync(){
  if(document.hidden)return;
  const key=currentEvent().key;if(key===previous)return;previous=key;
  const ids=stages[key]||[];
  metrics.forEach(n=>n.classList.toggle('is-active',ids.some(id=>n.querySelector('#'+id))));
 }
 setInterval(sync,100);sync();
})();
