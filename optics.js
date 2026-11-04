/** Camera / Fabry–Pérot image renderer. All coordinates are simulated CMOS pixels. */
import {splitRatio,circleFromThree,circleQuality,energyLevels} from './physics.js';

const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const rad=a=>a*Math.PI/180;

export function createOptics(canvas,getState,onMeasure=()=>{}){
  const ctx=canvas.getContext('2d',{alpha:false});
  let points=[],fit=null,lastRings=[],mode=null,lastSignature='',lastTime=0,frame=0;
  let view={w:1000,h:1000,scale:1,ox:0,oy:0,dpr:1};
  let lastGeometry={cx:500,cy:500,ellipticity:1,tilt:0,parallel:true,spot:false,ready:false};
  let resizeObserver,zoom=1,panX=0,panY=0,panDrag=null,suppressClick=false;
  canvas.style.touchAction='none';
  canvas.setAttribute('aria-label','CMOS 干涉图像。三点画圆模式下点击同一子环亮度峰中心，三点约相隔 120 度；左右边缘模式下点击左右亮度峰。');
  canvas.tabIndex=0;
  function resize(){
    const rect=canvas.getBoundingClientRect();
    if(rect.width<2||rect.height<2)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const scale=Math.min(rect.width,rect.height)/1000;
    view={w:rect.width,h:rect.height,scale,ox:(rect.width-1000*scale)/2,oy:(rect.height-1000*scale)/2,dpr};
  }
  function clearPoints(){points=[];fit=null;}
  function setMeasurementMode(next){mode=next;clearPoints();}
  function prepare(){
    resize();const v=view;
    ctx.setTransform(v.dpr,0,0,v.dpr,0,0);
    ctx.fillStyle='#020a07';ctx.fillRect(0,0,v.w,v.h);
    ctx.translate(v.ox,v.oy);ctx.scale(v.scale,v.scale);
  }
  function text(t,x,y,color='#6a9a89',size=19,align='left'){
    ctx.font=`${size}px ui-monospace, SFMono-Regular, Consolas, monospace`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(t,x,y);ctx.textAlign='left';
  }
  function rounded(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  function chip(t,x,y,color='#85ffc1'){
    ctx.font='17px ui-monospace,monospace';const w=ctx.measureText(t).width+24;
    rounded(x,y-24,w,34,8);ctx.fillStyle='rgba(2,15,10,.86)';ctx.fill();ctx.strokeStyle='#224837';ctx.lineWidth=1;ctx.stroke();text(t,x+12,y,color,17);
  }
  function label(){
    const s=getState(),dark=!lastGeometry.ready;
    text('CMOS  /  LIVE',36,43,'#6a9c85',18);
    text('546.1 nm',964,43,'#75e9a5',18,'right');
    ctx.strokeStyle='#153629';ctx.lineWidth=1;ctx.strokeRect(24,65,952,862);
    const ticks=[0,250,500,750,1000];
    ticks.forEach(n=>{const p=24+n*.952;ctx.beginPath();ctx.moveTo(p,927);ctx.lineTo(p,935);ctx.stroke();text(String(n),p,957,'#456c5b',15,'center');});
    text('Ctrl+滚轮放大 · Shift拖动平移 · 双击复位',36,985,'#547c67',16);
    if(zoom>1.01)text(`${zoom.toFixed(1)}×`,954,985,'#87c4a3',16,'right');
    if(dark){
      let title='光源未开启',sub='戴好紫外防护镜，检查连线后开启汞灯。';
      if(s.lamp){title='汞灯预热中';sub='等待绿线强度稳定后再进行测量。';}
      if(s.probeIn){title='霍尔探测笔占据磁极中心';sub='测完磁场后移出探测笔、放回汞灯。';}
      text(title,500,460,'#9fb9aa',27,'center');text(sub,500,500,'#597969',19,'center');
    }else if(lastGeometry.spot){
      chip(s.fpInserted?'先完成等高共轴布放':'尚未接入 F-P 标准具',44,102,'#e8c18b');
    }else if(!lastGeometry.parallel){
      chip('吞吐 / 椭圆：先校平行度再调相机',44,102,'#f1c48e');
    }else{
      const angle=Math.round(num(s.polAngle,90));
      let t='零磁场 · 单组等倾圆环';
      if(num(s.B)>0.001){
        if(s.config==='longitudinal')t=s.qwp?'纵向 · λ/4 + 偏振片鉴别 σ⁺ / σ⁻':'纵向 · 无 π · 旋转偏振片强度不变';
        else t=angle%180===90?'横向 · π 族通过（E ∥ B）':angle%180===0?'横向 · σ 族通过（E ⊥ B）':'横向 · π + σ';
      }
      chip(t,44,102);
    }
    const m=mode??s.measureMode??'none';
    if(m!=='none'&&lastGeometry.ready&&!lastGeometry.spot){
      const k=['K','K−1','K−2'][num(s.order)]??'K';
      text(`${m==='edges'?'左右峰位':'三点画圆'}  ${k} · ${num(s.B)>.001?(s.component??'a'):'零场'}  ${points.length}/${m==='edges'?2:3}`,954,905,'#a8e5c0',18,'right');
    }
  }
  function glowSpot(s,time){
    const cx=500+num(s.x)*5,cy=500+num(s.y)*5;
    const size=s.aligned===false?210:150;
    const grad=ctx.createRadialGradient(cx,cy,5,cx,cy,size);
    grad.addColorStop(0,'rgba(183,255,120,.7)');grad.addColorStop(.12,'rgba(119,250,74,.45)');grad.addColorStop(.5,'rgba(51,166,25,.13)');grad.addColorStop(1,'rgba(0,50,6,0)');
    ctx.fillStyle=grad;ctx.fillRect(0,0,1000,1000);
    ctx.strokeStyle='#366c3f';ctx.setLineDash([5,8]);ctx.beginPath();ctx.arc(cx,cy,size*.8,0,TAU);ctx.stroke();ctx.setLineDash([]);
  }
  function getComponents(s){
    const B=Math.abs(num(s.B)),theta=rad(num(s.polAngle,90));
    if(B<.001)return[{shift:0,weight:1,pol:'zero',name:'未分裂'}];
    let pi=Math.sin(theta)**2,sigma=Math.cos(theta)**2;
    if(s.config==='longitudinal'){pi=0;sigma=1;}
    // A circular field transmits half its incident power through a linear analyzer.
    // The quarter-wave plate redistributes the two equal input channels; it does
    // not halve their combined power a second time.
    let plus=s.config==='longitudinal'?.5:1,minus=plus;
    if(s.config==='longitudinal'&&s.qwp){
      const circular=Math.sin(2*(theta-rad(num(s.qwpAngle,45))));
      plus=(1+circular)/2;minus=(1-circular)/2;
    }
    // Generate every allowed transition from the same g values as the energy-level diagram.
    // The legacy comparison has coincident lines; their intensities add naturally.
    return energyLevels(B,{legacyGP1:s.model==='lecture'}).transitions.map(t=>({
      shift:t.shift,
      weight:t.deltaM===0?pi*(t.Mu===0?1:.72):sigma*(t.deltaM>0?plus:minus)*(t.Mu===0?1:.6),
      pol:t.deltaM===0?'pi':t.deltaM>0?'sigma+':'sigma-',
      name:t.label
    }));
  }
  function selectedShifts(s){
    if(num(s.B)<.001)return[0,0];
    const delta=num(s.delta,.5);
    if(s.model==='lecture')return[1,2];
    if(Math.abs(delta-.5)<1e-6)return[1,1.5];
    if(Math.abs(delta-1)<1e-6)return[1,2];
    return[-delta/2,delta/2];
  }
  function renderRings(s,time){
    const screw=s.screws??[0,0,0];
    const a=num(screw[0]),b=num(screw[1]),c=num(screw[2]);
    const tiltX=a-(b+c)/2,tiltY=(b-c)*.8660254;
    const err=Math.hypot(tiltX,tiltY);
    const parallel=err<.035;
    const breathing=parallel?0:Math.sin(time*.0014)*Math.min(err,1.5)*.25;
    const vo=num(s.viewOffset);
    const shift=parallel?0:Math.sin(vo*.7)*err*42;
    const cx=500+num(s.x)*5+shift*tiltX,cy=500+num(s.y)*5+shift*tiltY;
    const ellipse=1+Math.min(.5,err*.18);
    const rotation=Math.atan2(tiltY,tiltX);
    const cameraScale=clamp(1+(num(s.distance,50)-50)*.005,.6,1.5);
    const base2=14000*cameraScale**2;
    const step=23000*cameraScale**2;
    const drift=(a+b+c)*.055+breathing;
    const B=Math.abs(num(s.B));
    const rfactor=B>.001?splitRatio(B,num(s.d,.003),1):0;
    const cameraErr=Math.abs(num(s.focus,65)-65)/22+Math.abs(num(s.aperture,60)-60)/45+Math.abs(num(s.distance,50)-50)/55;
    const blur=.85+cameraErr*2.2+err*3;
    const components=getComponents(s),target=selectedShifts(s);
    lastGeometry={cx,cy,ellipticity:ellipse,tilt:rotation,parallel,spot:false,ready:true,blur};
    const back=ctx.createRadialGradient(cx,cy,20,cx,cy,500);
    back.addColorStop(0,'#03170c');back.addColorStop(.75,'#021009');back.addColorStop(1,'#020906');ctx.fillStyle=back;ctx.fillRect(25,66,950,860);
    ctx.save();ctx.beginPath();ctx.rect(25,66,950,860);ctx.clip();ctx.translate(cx,cy);ctx.rotate(rotation);ctx.scale(ellipse,1/ellipse);
    lastRings=[];
    const selectedOrder=clamp(num(s.order),0,2);
    for(let i=0;i<11;i++){
      for(const comp of components){
        const r2=base2+step*(i+drift+rfactor*comp.shift);
        if(r2<1)continue;
        const r=Math.sqrt(r2);if(r>610)continue;
        const taper=clamp(1-r/920,.25,1),w=comp.weight*taper;
        const ring={order:i,component:(B<.001||comp.pol==='sigma+')&&Math.abs(comp.shift-target[0])<1e-6?'a':comp.pol==='sigma+'&&Math.abs(comp.shift-target[1])<1e-6?'b':comp.pol,shift:comp.shift,pol:comp.pol,radius:r,r2,diameter:2*r,D2:4*r2,weight:comp.weight,cx,cy,freeD2:4*step,visible:comp.weight>.03};
        lastRings.push(ring);
        if(w<.003)continue;
        // An Airy peak has broad low-level wings and a narrow high-finesse centre.
        ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.strokeStyle=`rgba(25,110,8,${.12*w})`;ctx.lineWidth=blur*14;ctx.stroke();
        ctx.strokeStyle=`rgba(62,192,16,${.15*w})`;ctx.lineWidth=blur*6;ctx.stroke();
        ctx.strokeStyle=`rgba(97,248,41,${clamp(.6*w,0,1)})`;ctx.lineWidth=blur*2;ctx.stroke();
        ctx.strokeStyle=`rgba(182,255,115,${clamp(.68*w,0,1)})`;ctx.lineWidth=Math.max(.65,blur*.65);ctx.stroke();
      }
    }
    ctx.restore();
    // Fine detector grain is deterministic and deliberately does not move ring peaks.
    ctx.fillStyle='rgba(131,221,117,.06)';for(let i=0;i<1700;i++){const x=(i*761)%950+25,y=(i*577)%860+66;ctx.fillRect(x,y,1.25,1.25);}
    const vignette=ctx.createRadialGradient(cx,cy,180,cx,cy,650);vignette.addColorStop(0,'rgba(0,3,0,0)');vignette.addColorStop(1,'rgba(0,3,1,.78)');ctx.fillStyle=vignette;ctx.fillRect(25,66,950,860);
    ctx.strokeStyle='rgba(91,143,109,.28)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx-12,cy);ctx.lineTo(cx+12,cy);ctx.moveTo(cx,cy-12);ctx.lineTo(cx,cy+12);ctx.stroke();
    const measurement=mode??s.measureMode??'none';
    if(measurement!=='none'){
      const targetRing=lastRings.find(r=>r.order===selectedOrder&&r.component===(B>.001?(s.component??'a'):'a'));
      if(targetRing){
        // Only a small index marker is provided; points are never snapped to a ring.
        const targetRadius=targetRing.radius;
        const px=cx+targetRadius*ellipse*Math.cos(rotation),py=cy+targetRadius*ellipse*Math.sin(rotation);
        ctx.strokeStyle='#4c7160';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px+7,py);ctx.lineTo(px+35,py-18);ctx.lineTo(px+65,py-18);ctx.stroke();
        text(`${['K','K−1','K−2'][selectedOrder]} ${B>.001?s.component??'a':''}`,px+39,py-24,'#85bc98',17);
        if(points.length===0&&measurement==='three'){
          [0,120,240].forEach((deg,index)=>{const ang=rad(deg-90),p={x:cx+Math.cos(ang)*targetRadius,y:cy+Math.sin(ang)*targetRadius};ctx.beginPath();ctx.arc(p.x,p.y,7,0,TAU);ctx.strokeStyle='rgba(142,186,163,.4)';ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);});
          text('虚线点为 120° 取点方向提示；请点亮度峰',500,865,'#567d65',17,'center');
        }
      }
    }
    const maxWidth=4*rfactor;
    if(maxWidth>=1){chip('重级：减小电流重拍，不要硬看',44,146,'#f0ad8c');}
    else if(B>.001&&s.model!=='lecture'){text('精细结构：π 三线 + 两组 σ 三线',954,852,'#447c58',16,'right');}
  }
  function drawPoints(){
    if(fit){
      ctx.save();ctx.strokeStyle='#f1cc7b';ctx.lineWidth=2;ctx.setLineDash([9,7]);ctx.beginPath();ctx.arc(fit.x,fit.y,fit.radius,0,TAU);ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(fit.x-fit.radius,fit.y);ctx.lineTo(fit.x+fit.radius,fit.y);ctx.strokeStyle='rgba(241,204,123,.55)';ctx.stroke();
      text(`D = ${fit.diameter.toFixed(2)} px`,500,818,'#f1cc7b',21,'center');ctx.restore();
    }
    if(points.length===2&&(mode??getState().measureMode)==='edges'){
      ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);ctx.lineTo(points[1].x,points[1].y);ctx.strokeStyle='#e4bf74';ctx.lineWidth=2;ctx.stroke();
    }
    points.forEach((p,index)=>{ctx.beginPath();ctx.arc(p.x,p.y,8,0,TAU);ctx.fillStyle='#e8c77d';ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,3,0,TAU);ctx.fillStyle='#0c1c12';ctx.fill();text(String(index+1),p.x+13,p.y-12,'#f4dca7',23);});
  }
  function withImageView(drawImage){
    ctx.save();ctx.beginPath();ctx.rect(25,66,950,860);ctx.clip();
    ctx.translate(500+panX,500+panY);ctx.scale(zoom,zoom);ctx.translate(-500,-500);
    drawImage();ctx.restore();
  }
  function resetImageView(){zoom=1;panX=0;panY=0;clearPoints();draw();}
  function draw(time=performance.now()){
    const s=getState();
    const signature=JSON.stringify([s.current,s.B,s.config,s.model,s.polAngle,s.qwp,s.qwpAngle,s.d,s.delta,s.order,s.component,mode??s.measureMode,s.fpInserted,s.aligned,s.x,s.y,s.screws,s.focus,s.aperture,s.distance,s.viewOffset,s.lamp,s.warm,s.probeIn]);
    if(signature!==lastSignature){clearPoints();lastSignature=signature;}
    prepare();
    const warm=s.warm===true||num(s.warm)>=100;
    const ready=!!s.lamp&&warm&&!s.probeIn;
    lastRings=[];lastGeometry.ready=ready;
    if(ready){
      if(!s.fpInserted||s.aligned===false){lastGeometry.spot=true;withImageView(()=>glowSpot(s,time));}else withImageView(()=>renderRings(s,time));
    }else lastGeometry.spot=false;
    label();withImageView(drawPoints);
  }
  function logicalPoint(e){
    const r=canvas.getBoundingClientRect();return{x:500+((e.clientX-r.left-view.ox)/view.scale-500-panX)/zoom,y:500+((e.clientY-r.top-view.oy)/view.scale-500-panY)/zoom};
  }
  function pointPeakCheck(p){
    const g=lastGeometry,dx=p.x-g.cx,dy=p.y-g.cy,c=Math.cos(g.tilt),sn=Math.sin(g.tilt);
    const tx=(c*dx+sn*dy)/g.ellipticity,ty=(-sn*dx+c*dy)*g.ellipticity;
    const rr=Math.hypot(tx,ty);
    const rings=lastRings.filter(r=>r.visible);
    const nearest=rings.reduce((best,r)=>!best||Math.abs(rr-r.radius)<Math.abs(rr-best.radius)?r:best,null);
    return{distance:nearest?Math.abs(rr-nearest.radius):Infinity,nearest,radius:rr};
  }
  canvas.addEventListener('click',e=>{
    if(suppressClick){suppressClick=false;return;}
    if(e.shiftKey||e.detail>1)return;
    const s=getState(),m=mode??s.measureMode??'none';if(m==='none')return;
    if(!lastGeometry.ready||lastGeometry.spot){onMeasure({type:'invalid',warnings:['先开启并预热汞灯，接入标准具并完成共轴调整。']});return;}
    const rect=canvas.getBoundingClientRect(),displayX=(e.clientX-rect.left-view.ox)/view.scale,displayY=(e.clientY-rect.top-view.oy)/view.scale;
    if(displayX<25||displayX>975||displayY<66||displayY>927)return;
    const p=logicalPoint(e);if(p.x<25||p.x>975||p.y<66||p.y>927)return;
    if(points.length>=(m==='edges'?2:3))clearPoints();
    points.push(p);const peakChecks=points.map(pointPeakCheck);
    if(points.length<(m==='edges'?2:3)){draw();return;}
    let result={type:m,points:points.map(p=>({...p})),order:num(s.order),component:num(s.B)>.001?s.component??'a':'zero',current:num(s.current),B:num(s.B),config:s.config,polAngle:num(s.polAngle),d:num(s.d,.003),delta:num(s.delta,.5),warnings:[]};
    const warnings=result.warnings;
    if(!lastGeometry.parallel)warnings.push('先校平行度再调相机：当前圆环存在吞吐或椭圆。');
    if(Math.hypot(num(s.x),num(s.y))>2.5)warnings.push('圆环偏心：先微调 XY 使圆心居中。');
    if(peakChecks.some(p=>p.distance>Math.max(1.5,lastGeometry.blur*.8)))warnings.push('请取亮度峰中心，不要取环的内外边缘或暗纹。');
    const target=lastRings.find(r=>r.order===num(s.order)&&r.component===(num(s.B)>.001?s.component??'a':'a'));
    if(target&&peakChecks.some(p=>p.nearest&&Math.abs(p.nearest.radius-target.radius)>1.2))warnings.push('部分点不在所选级次/分量，请复核 K、K−1、K−2 与 a 内 b 外。');
    if(m==='three'){
      try{
        const circle=circleFromThree(points);fit={x:circle.x,y:circle.y,radius:circle.radius,diameter:circle.diameter??2*circle.radius};
        const quality=circleQuality(points);result={...result,diameter:fit.diameter,D2:fit.diameter**2,circle:{...fit},quality};
        if(quality.warnings)warnings.push(...quality.warnings);
        if(quality.ok===false&&!quality.warnings?.length)warnings.push('三点挤在窄弧：应在同一亮纹上均匀相隔约 120° 取点。');
      }catch{warnings.push('三点接近共线，无法稳定画圆：请重新均匀取点。');result.quality={ok:false};}
    }else{
      const [a,b]=points,left=a.x<b.x?a:b,right=a.x<b.x?b:a;
      const diameter=right.x-left.x;
      result={...result,left:left.x,right:right.x,diameter,D2:diameter**2,quality:{ok:true}};
      if(Math.abs(left.y-right.y)>5||Math.abs((left.y+right.y)/2-lastGeometry.cy)>8)warnings.push('左右峰位应通过圆心且位于同一水平直径，两点取在环上任意弦会低估 D。');
    }
    result.warnings=[...new Set(warnings)];result.valid=Number.isFinite(result.diameter)&&result.warnings.length===0;
    draw();result.image=canvas.toDataURL('image/png');onMeasure(result);
  });
  canvas.addEventListener('wheel',e=>{
    if(!e.ctrlKey)return;e.preventDefault();
    const p=logicalPoint(e),oldZoom=zoom;
    zoom=clamp(zoom*Math.exp(-e.deltaY*.0015),1,6);
    panX+=(oldZoom-zoom)*(p.x-500);panY+=(oldZoom-zoom)*(p.y-500);
    if(zoom===1){panX=0;panY=0;}draw();
  },{passive:false});
  canvas.addEventListener('pointerdown',e=>{
    if(!e.shiftKey)return;e.preventDefault();panDrag={x:e.clientX,y:e.clientY};suppressClick=true;
    canvas.setPointerCapture?.(e.pointerId);canvas.style.cursor='grabbing';
  });
  canvas.addEventListener('pointermove',e=>{
    if(!panDrag)return;
    panX+=(e.clientX-panDrag.x)/view.scale;panY+=(e.clientY-panDrag.y)/view.scale;
    panDrag={x:e.clientX,y:e.clientY};draw();
  });
  const endPan=()=>{panDrag=null;canvas.style.cursor='crosshair';};
  canvas.addEventListener('pointerup',endPan);canvas.addEventListener('pointercancel',endPan);
  canvas.addEventListener('dblclick',e=>{e.preventDefault();suppressClick=false;resetImageView();});
  if(typeof ResizeObserver!=='undefined'){resizeObserver=new ResizeObserver(()=>draw());resizeObserver.observe(canvas);}
  function animate(t){frame=requestAnimationFrame(animate);if(t-lastTime<40)return;lastTime=t;draw(t);}
  frame=requestAnimationFrame(animate);
  return{draw,clearPoints,snapshot:()=>{draw();return canvas.toDataURL('image/png');},getPoints:()=>points.map(p=>({...p})),getRingData:()=>lastRings.map(r=>({...r})),setMeasurementMode,resetImageView,getImageView:()=>({zoom,panX,panY}),resize:()=>{resize();draw();},destroy:()=>{cancelAnimationFrame(frame);resizeObserver?.disconnect();}};
}

