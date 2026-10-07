(()=>{
 const lerp=(a,b,t)=>a+(b-a)*t;
 function draw(ctx,time,variant='idle'){
  const working=variant==='loading',t=time,cycle=3.6;
  const progress=t%cycle/cycle,s=progress<.4?progress/.4:1-(progress-.4)/.6,smooth=s*s*s*(s*(s*6-15)+10),scale=working?1:1+.06*(smooth*2-1),rotation=working?0:-t*.12;
  ctx.save();ctx.setTransform(ctx.canvas.width/128,0,0,ctx.canvas.height/128,0,0);ctx.clearRect(0,0,128,128);
  for(let i=0;i<8;i++){
   const phase=i*Math.PI/4,theta=phase+rotation,flow=(Math.cos(phase-t*1.1)+1)/2;
   const local=((t-(i%4)*.14)%1.85+1.85)%1.85/1.85,breath=(1-Math.cos(local*Math.PI*2))/2,pulse=breath*breath*(3-2*breath);
   const r=(32-(working?pulse*1.2:0))*scale,x=64+r*Math.cos(theta),y=64+r*Math.sin(theta);
   ctx.beginPath();ctx.ellipse(x,y,(14.5+(working?pulse*.45:0))*scale,working?7.4-pulse*.18:7.4,theta+.18,0,Math.PI*2);
   if(working){
    const core=[109,171,141].map((c,j)=>lerp(c,[229,243,227][j],.10+pulse*.78));
    const edge=core.map((c,j)=>lerp(c,[137,202,202][j],.12+pulse*.14));
    const gradient=ctx.createLinearGradient(x-13*Math.cos(theta),y-13*Math.sin(theta),x+13*Math.cos(theta),y+13*Math.sin(theta));
    gradient.addColorStop(0,`rgb(${core.map(Math.round).join(',')})`);gradient.addColorStop(1,`rgb(${edge.map(Math.round).join(',')})`);ctx.fillStyle=gradient;
   }else ctx.fillStyle=`rgb(${[126,181,153].map((c,j)=>Math.round(lerp(c,[232,243,223][j],flow*.9))).join(',')})`;
   ctx.fill();
  }
  ctx.beginPath();ctx.arc(64,64,working?8.3:8.3+.45*smooth,0,Math.PI*2);ctx.fillStyle=working?'#c6e6d3':'#b8dfc8';ctx.fill();ctx.restore();
 }
 window.__AEROSENSE_AOM_MARK__={draw};
})();
