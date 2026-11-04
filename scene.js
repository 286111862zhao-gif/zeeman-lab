import * as THREE from './vendor/three.module.min.js';

// All apparatus dimensions are display-scale: the submillimetre FP air gap is
// deliberately expanded so that both reflecting faces can be inspected.
export function createScene(container, getState, onSelect) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a1421');
  scene.fog = new THREE.Fog('#0a1421', 23, 52);
  const camera = new THREE.PerspectiveCamera(38, 1, .08, 90);
  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;';
  container.style.position = 'relative';
  container.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xbbe9ff, 0x1b2534, 2.3));
  const sun = new THREE.DirectionalLight(0xeaf5ff, 4.5);
  sun.position.set(-3, 12, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left:-10,right:10,top:8,bottom:-8,near:1,far:30});
  sun.shadow.bias = -.0005; scene.add(sun);
  const rim = new THREE.DirectionalLight(0x57ead5, 2.1); rim.position.set(3,5,-7); scene.add(rim);
  const soft = new THREE.DirectionalLight(0xffbb8a, .9); soft.position.set(-7,2,1); scene.add(soft);
  const world = new THREE.Group(); scene.add(world);
  const pickables = [], targets = {}, labels = [], screwKnobs = [];
  const mat = {
    metal: new THREE.MeshStandardMaterial({color:0x9faeb7,metalness:.86,roughness:.28}),
    chrome: new THREE.MeshStandardMaterial({color:0xd3e3e7,metalness:.9,roughness:.18}),
    dark: new THREE.MeshStandardMaterial({color:0x1e303d,metalness:.68,roughness:.31}),
    black: new THREE.MeshStandardMaterial({color:0x0d161e,metalness:.4,roughness:.4}),
    rubber: new THREE.MeshStandardMaterial({color:0x131a20,roughness:.76}),
    white: new THREE.MeshStandardMaterial({color:0xc4d0d3,metalness:.25,roughness:.4}),
    mint: new THREE.MeshStandardMaterial({color:0x43cfb3,metalness:.45,roughness:.3}),
    copper: new THREE.MeshStandardMaterial({color:0xbe7547,metalness:.85,roughness:.25}),
    copperDark: new THREE.MeshStandardMaterial({color:0x593725,metalness:.65,roughness:.42}),
    glass: new THREE.MeshPhysicalMaterial({color:0x7ddac6,transparent:true,opacity:.28,roughness:.09,metalness:.2,side:THREE.DoubleSide}),
    filter: new THREE.MeshPhysicalMaterial({color:0x1aab51,transparent:true,opacity:.74,roughness:.1,side:THREE.DoubleSide}),
    purple: new THREE.MeshPhysicalMaterial({color:0xa6a3e8,transparent:true,opacity:.4,side:THREE.DoubleSide}),
    gold: new THREE.MeshStandardMaterial({color:0xcab788,metalness:.9,roughness:.3}),
  };
  function mesh(g,m,parent,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function box(parent,w,h,d,x,y,z,m=mat.metal){return mesh(new THREE.BoxGeometry(w,h,d),m,parent,x,y,z);}
  function cyl(parent,r,h,x,y,z,m=mat.metal,axis='y',r2=r){const o=mesh(new THREE.CylinderGeometry(r,r2,h,48),m,parent,x,y,z);if(axis==='x')o.rotation.z=Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;return o;}
  function torus(parent,r,t,x,y,z,m=mat.metal,axis='x'){const o=mesh(new THREE.TorusGeometry(r,t,12,64),m,parent,x,y,z);if(axis==='x')o.rotation.y=Math.PI/2;if(axis==='y')o.rotation.x=Math.PI/2;return o;}
  function disc(parent,r,x,y,z,m=mat.glass){const o=mesh(new THREE.CircleGeometry(r,64),m,parent,x,y,z);o.rotation.y=Math.PI/2;return o;}
  function tube(parent,points,r,m){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(new THREE.TubeGeometry(curve,40,r,8,false),m,parent);}
  function register(group,id,point){group.userData.id=id;group.traverse(o=>{if(o.isMesh){o.userData.id=id;pickables.push(o);}});targets[id]={group,point:new THREE.Vector3(...point)};return group;}
  function group(parent,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
  function textTexture(text,color='#a7bfc7',bg='transparent',size=28){const c=document.createElement('canvas');c.width=512;c.height=80;const ctx=c.getContext('2d');if(bg!=='transparent'){ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);}ctx.font=`500 ${size}px "Microsoft YaHei", sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,256,40);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
  function textPlane(parent,text,w,h,x,y,z,color='#a7bfc7',bg='transparent'){const o=mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:textTexture(text,color,bg),transparent:true,side:THREE.DoubleSide}),parent,x,y,z);return o;}
  function label(id,text,x,y,z){const e=document.createElement('button');e.type='button';e.textContent=text;e.style.cssText='position:absolute;border:1px solid #3b5d6b99;background:#0b1a27d9;color:#b9d0da;font:10px "Microsoft YaHei",sans-serif;padding:4px 7px;border-radius:4px;white-space:nowrap;pointer-events:auto;backdrop-filter:blur(5px);box-shadow:0 2px 8px #0003;transform:translate(-50%,-50%);';e.addEventListener('click',()=>onSelect(id));container.appendChild(e);labels.push({e,p:new THREE.Vector3(x,y,z),id});}
  function mount(parent,x,z=0){box(parent,.62,.13,.64,x,.76,z,mat.dark);box(parent,.5,.045,.53,x,.85,z,mat.metal);cyl(parent,.075,.69,x,1.21,z,mat.chrome);cyl(parent,.12,.12,x,1.46,z,mat.dark);for(const zz of [-.23,.23])cyl(parent,.03,.04,x+.19,.86,z+zz,mat.black);}
  // Pneumatically isolated optical table, ruled rail and sliding carriers.
  box(world,12.6,.36,5.5,0,.38,.2,mat.dark);
  box(world,12.6,.055,5.5,0,.59,.2,new THREE.MeshStandardMaterial({color:0x253542,metalness:.7,roughness:.5}));
  for(let x=-5.8;x<6;x+=.5)for(let z=-2.1;z<2.9;z+=.5)cyl(world,.021,.008,x,.625,z,mat.black);
  for(const x of [-5,5])for(const z of [-1.65,2]){box(world,.33,.5,.33,x,-.04,z,mat.black);cyl(world,.24,.07,x,-.29,z,mat.rubber);}
  for(const z of [-.35,.35]){box(world,11.3,.12,.08,-.15,.7,z,mat.chrome);box(world,11.3,.035,.035,-.15,.78,z,mat.black);}
  for(let i=0;i<=44;i++){const x=-5.6+i*.25;box(world,.008,.008,i%4===0?.12:.065,x,.8,.35,mat.white);}
  textPlane(world,'COC-OT-ZME  ·  ZEEMAN EFFECT',3.9,.26,-.2,.32,2.96,'#7a98ab');
  label('lens','光学导轨 · 等高共轴',-1.2,.5,-1.3);
  // Electromagnet: two real copper coil winding stacks and a removable core.
  const magnet=group(world,-4.55,0,0),rotor=group(magnet,0,1.72,0);
  box(magnet,2.3,.23,1.95,0,.78,0,mat.black);
  cyl(magnet,.72,.15,0,.96,0,mat.dark);cyl(magnet,.57,.07,0,1.07,0,mat.metal);
  for(let i=0;i<36;i++){const a=i*Math.PI/18;box(magnet,.025,.009,.08,.64*Math.sin(a),1.045,.64*Math.cos(a),mat.white);}
  for(const z of [-.71,.71]){
    cyl(rotor,.6,.65,0,.15,z,mat.copperDark,'z');
    for(let k=0;k<16;k++)torus(rotor,.55,.021,0,.15,z-.3+k*.04,mat.copper,'z');
    for(const end of [-.345,.345]){cyl(rotor,.65,.045,0,.15,z+end,mat.dark,'z');torus(rotor,.59,.026,0,.15,z+end,mat.chrome,'z');}
    box(rotor,.32,.58,.2,0,-.45,z,mat.dark);
    textPlane(rotor,z<0?'N':'S',.25,.17,.02,.18,z+(z<0?-.36:.36),'#e4eeeb');
  }
  const core=group(rotor);box(core,.39,.42,2.3,0,.15,0,mat.metal);
  // split core halves leave an accessible central magnetic gap
  core.children[0].visible=false;
  cyl(core,.23,.67,0,.15,-.61,mat.metal,'z');cyl(core,.23,.67,0,.15,.61,mat.metal,'z');
  cyl(core,.32,.06,0,.15,-.25,mat.chrome,'z');cyl(core,.32,.06,0,.15,.25,mat.chrome,'z');
  box(core,.23,.5,1.9,-.4,-.45,0,mat.metal);
  const lamp=group(rotor,0,.1,0);
  const lampGlow=new THREE.MeshStandardMaterial({color:0xd6f6ed,emissive:0x7affa1,emissiveIntensity:0,roughness:.2,transparent:true,opacity:.9});
  cyl(lamp,.046,.62,0,.11,0,lampGlow);cyl(lamp,.065,.17,0,-.29,0,mat.white);cyl(lamp,.052,.07,0,.45,0,mat.chrome);
  tube(rotor,[[0,-.35,0],[-.3,-.7,.3],[-1,-.7,.65],[-1.2,-.88,1.65]],.022,mat.rubber);
  const lampLight=new THREE.PointLight(0x78ffac,0,4);lampLight.position.set(0,.2,0);rotor.add(lampLight);
  const bArrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,1),new THREE.Vector3(.45,.95,-.64),1.3,0x54d7c1,.18,.11);rotor.add(bArrow);
  const bText=textPlane(rotor,'B',.25,.2,.45,1.16,0,'#70f4d7');
  register(magnet,'magnet',[-4.55,1.9,0]); label('magnet','01  汞灯 / 电磁铁',-4.55,3.3,0);
  // Separate low-voltage excitation supply, high-voltage lamp terminals.
  const supply=group(world,-4.6,0,2.02);
  box(supply,2.02,.85,1.12,0,1.08,0,mat.white);box(supply,1.9,.71,.055,0,1.1,.59,mat.dark);
  box(supply,1.06,.32,.028,-.28,1.21,.63,mat.black);
  const amp=textPlane(supply,'0.00 A',.99,.21,-.28,1.21,.65,'#84ffe2','#0a181b');
  textPlane(supply,'恒流励磁电源',1.2,.18,-.24,.97,.65,'#c7d7dc');
  cyl(supply,.12,.075,.66,1.19,.67,mat.black,'z');torus(supply,.091,.013,.66,1.19,.718,mat.chrome,'z');
  for(const [x,c] of [[-.67,0xc95852],[-.35,0x20232c],[.15,0xc95852],[.46,0x20232c]])cyl(supply,.052,.045,x,.91,.67,new THREE.MeshStandardMaterial({color:c}),'z');
  tube(world,[[-5.28,.93,2.7],[-5.75,.77,2.3],[-5.8,.7,.6],[-5.1,1.28,-.55]],.026,new THREE.MeshStandardMaterial({color:0x9b3a35}));
  tube(world,[[-4.95,.93,2.7],[-5.5,.7,2.2],[-5.5,.7,.85],[-4.25,1.25,.7]],.026,mat.rubber);
  register(supply,'power',[-4.6,1.2,2]);label('power','恒流电源 / 电流表',-4.6,1.87,2.35);
  const terminals=group(world,-5.8,1,1.45);cyl(terminals,.057,.09,0,0,0,new THREE.MeshStandardMaterial({color:0xc64c45}));cyl(terminals,.057,.09,.2,0,0,mat.black);register(terminals,'safety',[-5.8,1.1,1.45]);
  // Gaussmeter and axial Hall probe with movable tip at the pole centre.
  const gauss=group(world,-1.88,0,2.04);
  box(gauss,1.5,.67,.95,0,.97,0,mat.white);box(gauss,1.39,.55,.05,0,.99,.5,mat.dark);box(gauss,.95,.27,.03,-.12,1.08,.535,mat.black);
  const tesla=textPlane(gauss,'0.0 mT',.9,.18,-.12,1.08,.558,'#99e0ff','#0a181b');
  for(let i=0;i<3;i++)cyl(gauss,.047,.032,-.32+i*.3,.83,.55,i===0?mat.mint:mat.black,'z');textPlane(gauss,'毫特斯拉计',1.05,.15,0,1.4,.18,'#c7e3e9');
  const probe=group(world,-4.55,1.85,0);cyl(probe,.032,.68,0,0,.36,mat.chrome,'z');cyl(probe,.07,.42,0,0,.86,mat.dark,'z');cyl(probe,.05,.06,0,0,.015,mat.gold,'z');
  const probeWire=tube(world,[[-4.55,1.85,1.1],[-4,1.4,1.9],[-3,.74,2.3],[-2.4,.88,2.51]],.018,mat.black);
  register(gauss,'gauss',[-1.88,1.1,2.04]);register(probe,'gauss',[-4.55,1.85,0]);label('gauss','毫特斯拉计 / 轴向探测笔',-1.88,1.92,2.1);
  // Condenser and its height-adjustable holder.
  const condenser=group(world,-2.62,0,0);mount(condenser,0);cyl(condenser,.47,.24,0,1.86,0,mat.dark,'x');disc(condenser,.4,-.131,1.86,0,mat.glass);disc(condenser,.4,.131,1.86,0,mat.glass);
  for(const x of [-.15,.15])torus(condenser,.43,.04,x,1.86,0,mat.chrome);register(condenser,'lens',[-2.62,1.86,0]);label('lens','02  聚光透镜',-2.62,2.9,0);
  // Analyzer, with a full graduated 360-degree rim and live transmission axis.
  const polarizer=group(world,-1.1,0,0);mount(polarizer,0);torus(polarizer,.64,.065,0,1.86,0,mat.dark);torus(polarizer,.58,.018,.05,1.86,0,mat.chrome);
  for(let i=0;i<72;i++){const a=i*Math.PI/36;const p=new THREE.Vector3(.075,1.86+.63*Math.cos(a),.63*Math.sin(a));const p2=new THREE.Vector3(.075,1.86+(i%6===0?.55:.59)*Math.cos(a),(i%6===0?.55:.59)*Math.sin(a));const g=new THREE.BufferGeometry().setFromPoints([p,p2]);polarizer.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:0xa6c7cd})));}
  const polSpin=group(polarizer,0,1.86,0);disc(polSpin,.505,0,0,0,new THREE.MeshPhysicalMaterial({color:0x3e8193,transparent:true,opacity:.55,metalness:.1,roughness:.1,side:THREE.DoubleSide}));
  box(polSpin,.018,.93,.018,.03,0,0,mat.mint);box(polSpin,.08,.17,.08,0,.74,0,mat.chrome);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;const tx=textPlane(polarizer,String(i*60),.27,.1,.10,1.86+.77*Math.cos(a),.77*Math.sin(a),'#b2c4cb');tx.rotation.y=Math.PI/2;}
  register(polarizer,'polarizer',[-1.1,1.86,0]);label('polarizer','03  偏振器 · 360°',-1.1,3.05,0);
  // Insertion arm for the quarter-wave plate.
  const waveplate=group(world,-.04,0,0);mount(waveplate,0);const waveOptic=group(waveplate,0,1.86,0);torus(waveOptic,.34,.039,0,0,0,mat.gold);disc(waveOptic,.305,0,0,0,mat.purple);box(waveOptic,.014,.5,.014,.02,0,0,mat.gold);register(waveplate,'polarizer',[-.04,1.86,0]);
  // Filter and Fabry-Perot etalon on an XY translation stage.
  const fp=group(world,1.18,0,0);mount(fp,0);
  box(fp,.86,.13,.95,0,1.48,0,mat.black);box(fp,.74,.08,.84,0,1.58,0,mat.chrome);box(fp,.67,.07,.72,0,1.65,0,mat.dark);
  cyl(fp,.055,.37,.39,1.55,.34,mat.chrome,'x');cyl(fp,.10,.1,.62,1.55,.34,mat.dark,'x');
  cyl(fp,.055,.35,-.28,1.65,.48,mat.chrome,'z');cyl(fp,.10,.1,-.28,1.65,.7,mat.dark,'z');
  const fpOptic=group(fp,0,1.86,0);torus(fpOptic,.59,.085,-.15,0,0,mat.dark);torus(fpOptic,.59,.085,.19,0,0,mat.dark);
  const mirror1=disc(fpOptic,.52,-.105,0,0,new THREE.MeshPhysicalMaterial({color:0xb8e8dc,transparent:true,opacity:.45,metalness:.7,roughness:.1,side:THREE.DoubleSide}));
  const mirror2=disc(fpOptic,.52,.145,0,0,new THREE.MeshPhysicalMaterial({color:0xb8e8dc,transparent:true,opacity:.45,metalness:.7,roughness:.1,side:THREE.DoubleSide}));
  for(let i=0;i<3;i++){const a=Math.PI/2+i*Math.PI*2/3;const yy=.65*Math.sin(a),zz=.65*Math.cos(a);cyl(fpOptic,.041,.57,.12,yy,zz,mat.chrome,'x');const knob=cyl(fpOptic,.105,.16,.44,yy,zz,mat.gold,'x');for(let j=0;j<12;j++){const b=j*Math.PI/6;box(fpOptic,.16,.012,.012,.44,yy+.105*Math.sin(b),zz+.105*Math.cos(b),mat.black);}knob.userData.screwIndex=i;screwKnobs.push(knob);}
  for(const zz of [-.42,.42])cyl(fpOptic,.026,.4,0,-.34,zz,mat.chrome,'x');
  const filt=group(fpOptic,-.55,0,0);torus(filt,.49,.04,0,0,0,mat.black);disc(filt,.45,0,0,0,mat.filter);
  const gap=textPlane(fpOptic,'d · 空气间隔（示意放大）',1.8,.18,.1,1.05,0,'#91d5cc');
  register(fp,'fp',[1.18,1.86,0]);screwKnobs.forEach((k,i)=>{k.userData.screwIndex=i;});label('fp','04  滤光器 + F-P 标准具',1.18,3.2,0);
  // Imaging objective, an adjustable iris and CMOS sensor housing.
  const cam=group(world,3.36,0,0);mount(cam,0);
  for(let i=0;i<5;i++){cyl(cam,.33+i*.015,.145,-.6+i*.14,1.86,0,i%2?mat.black:mat.dark,'x');for(let j=0;j<28;j++){const a=j*Math.PI/14;box(cam,.065,.025,.025,-.55+i*.14,1.86+(.35+i*.014)*Math.sin(a),(.35+i*.014)*Math.cos(a),mat.black);}}
  disc(cam,.29,-.68,1.86,0,mat.glass);const iris=group(cam,-.71,1.86,0);const blades=[];
  for(let i=0;i<8;i++){const a=i*Math.PI/4;const b=box(iris,.025,.19,.18,0,.14*Math.sin(a),.14*Math.cos(a),mat.black);b.rotation.x=a;blades.push(b);}
  box(cam,.58,.77,.83,.17,1.86,0,mat.dark);box(cam,.055,.65,.69,.49,1.86,0,mat.black);box(cam,.01,.22,.26,-.14,1.86,0,new THREE.MeshStandardMaterial({color:0x345681,metalness:.7,roughness:.3}));
  for(const y of [-.26,.26])for(const z of [-.29,.29])cyl(cam,.024,.04,.51,1.86+y,z,mat.chrome,'x');
  textPlane(cam,'CMOS',.52,.17,.18,2.1,.43,'#b5ddd7');const camLed=cyl(cam,.027,.02,.39,1.62,.43,mat.mint,'z');
  tube(world,[[3.85,1.8,.3],[4.3,1,1.05],[4.9,.7,1.38],[5.21,.82,1.7]],.023,mat.black);
  register(cam,'camera',[3.36,1.86,0]);label('camera','05  镜头 / CMOS 相机',3.36,2.9,0);
  // Computer: live fringe preview on the instrument's three-point-circle UI.
  const pc=group(world,4.84,0,1.96);
  box(pc,1.36,.055,.65,0,.68,.16,mat.black);box(pc,.18,.52,.18,0,.94,-.12,mat.dark);box(pc,1.75,1.14,.10,0,1.52,-.12,mat.black);box(pc,1.6,.97,.015,0,1.53,-.055,new THREE.MeshBasicMaterial({color:0x122c32}));
  const monitorCanvas=document.createElement('canvas');monitorCanvas.width=640;monitorCanvas.height=360;const monitorCtx=monitorCanvas.getContext('2d');const monitorTex=new THREE.CanvasTexture(monitorCanvas);monitorTex.colorSpace=THREE.SRGBColorSpace;mesh(new THREE.PlaneGeometry(1.59,.93),new THREE.MeshBasicMaterial({map:monitorTex}),pc,0,1.53,-.037);
  box(pc,1.43,.045,.48,-.04,.69,.85,mat.dark);for(let i=0;i<12;i++)for(let j=0;j<4;j++)box(pc,.075,.015,.065,-.61+i*.105,.724,.69+j*.1,mat.black);box(pc,.22,.08,.3,1.01,.71,.73,mat.dark);
  register(pc,'computer',[4.84,1.53,1.96]);label('computer','三点画圆测量软件',4.84,2.43,2);
  // Eight weak internal reflections make the multiple-beam path explicit.
  const multi=group(fpOptic);const reflectedMaterial=new THREE.LineBasicMaterial({color:0x70ff9e,transparent:true,opacity:.44});
  for(let i=0;i<7;i++){const z=(i-3)*.045;const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.102,0,z),new THREE.Vector3(.142,0,z+.04),new THREE.Vector3(-.102,0,z+.08)]);multi.add(new THREE.Line(geo,reflectedMaterial));}
  const beamMat=new THREE.MeshBasicMaterial({color:0x5aff8f,transparent:true,opacity:.09,depthWrite:false});
  const beam=cyl(world,.034,7.46,-.82,1.86,0,beamMat,'x');beam.castShadow=false;
  const beamCore=cyl(world,.006,7.46,-.82,1.86,0,new THREE.MeshBasicMaterial({color:0xbaffb0,transparent:true,opacity:.65}),'x');beamCore.castShadow=false;
  const photons=[];for(let i=0;i<14;i++){const p=mesh(new THREE.SphereGeometry(.018,8,8),new THREE.MeshBasicMaterial({color:0xa9ffae,transparent:true,opacity:.8}),world);photons.push(p);}
  // A subdued floor grid grounds the apparatus without competing with optics.
  const grid=new THREE.GridHelper(36,36,0x263e50,0x142839);grid.position.y=-.37;scene.add(grid);
  const focusRing=torus(world,.72,.011,1.18,1.86,0,new THREE.MeshBasicMaterial({color:0x63e8ca,transparent:true,opacity:.7}),'y');focusRing.visible=false;
  let azimuth=.68,elevation=.49,radius=15.8,target=new THREE.Vector3(0,1.05,.45),drag=null,hover=null,selection='';
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function pick(event){const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(pickables,false)[0];}
  renderer.domElement.addEventListener('pointerdown',e=>{const h=pick(e);drag={x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY,moved:false,screw:h?.object.userData.screwIndex};renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.style.cursor=drag.screw===undefined?'grabbing':'ns-resize';});
  renderer.domElement.addEventListener('pointermove',e=>{if(!drag){const h=pick(e);renderer.domElement.style.cursor=h?.object.userData.screwIndex!==undefined?'ns-resize':h?'pointer':'grab';return;}const dx=e.clientX-drag.px,dy=e.clientY-drag.py;drag.px=e.clientX;drag.py=e.clientY;if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>4)drag.moved=true;if(drag.screw!==undefined){window.dispatchEvent(new CustomEvent('screwdrag',{detail:{index:drag.screw,delta:-dy*.004}}));}else{azimuth-=dx*.006;elevation=Math.max(.12,Math.min(1.43,elevation+dy*.005));window.dispatchEvent(new CustomEvent('viewmove'));}});
  renderer.domElement.addEventListener('pointerup',e=>{if(drag&&!drag.moved){const h=pick(e);if(h){selection=h.object.userData.id;onSelect(selection);}}drag=null;renderer.domElement.style.cursor='grab';});
  renderer.domElement.addEventListener('pointercancel',()=>drag=null);
  renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();radius=Math.max(4.7,Math.min(27,radius*Math.exp(e.deltaY*.001)));window.dispatchEvent(new CustomEvent('viewmove'));},{passive:false});
  renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
  function resize(){const w=Math.max(container.clientWidth,250),h=Math.max(container.clientHeight,250);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
  const ro=new ResizeObserver(resize);ro.observe(container);resize();
  let previousAmp='',previousB='',lastScreen=0,raf,disposed=false;
  function setDisplay(plane,value,color){const old=plane.material.map;plane.material.map=textTexture(value,color,'#09171b');old.dispose();plane.material.needsUpdate=true;}
  function loop(now){if(disposed)return;raf=requestAnimationFrame(loop);const s=getState()||{};const current=s.power?Number(s.current||0):0;
    camera.position.set(target.x+radius*Math.sin(azimuth)*Math.cos(elevation),target.y+radius*Math.sin(elevation),target.z+radius*Math.cos(azimuth)*Math.cos(elevation));camera.lookAt(target);
    rotor.rotation.y=THREE.MathUtils.lerp(rotor.rotation.y,s.config==='longitudinal'?Math.PI/2:0,.10);
    core.position.y=THREE.MathUtils.lerp(core.position.y,s.coreOut?1.65:0,.13);core.position.x=THREE.MathUtils.lerp(core.position.x,s.coreOut?-.8:0,.13);
    const ready=!!s.lamp&&(s.warm===true||Number(s.warm)>=1);lamp.visible=!s.probeIn;probe.visible=!!s.probeIn;probeWire.visible=!!s.probeIn;
    lampGlow.emissiveIntensity=s.lamp?(ready?2.8:.7+.15*Math.sin(now*.006)):0;lampLight.intensity=s.lamp?(ready?.75:.15):0;
    waveOptic.position.z=THREE.MathUtils.lerp(waveOptic.position.z,s.qwp?0:1.05,.15);waveOptic.rotation.x=Number(s.qwpAngle||45)*Math.PI/180;
    polSpin.rotation.x=-(Number(s.polAngle)||0)*Math.PI/180;
    fpOptic.position.z=THREE.MathUtils.lerp(fpOptic.position.z,s.fpInserted===false?1.3:Number(s.x||0)*.1,.15);fpOptic.position.y=1.86+Number(s.y||0)*.1;
    const screws=s.screws||[0,0,0];const tiltY=((Number(screws[1])||0)-(Number(screws[2])||0))*.03,tiltZ=((Number(screws[0])||0)-((Number(screws[1])||0)+(Number(screws[2])||0))/2)*.03;
    mirror2.rotation.y=Math.PI/2+tiltY;mirror2.rotation.z=tiltZ;
    screwKnobs.forEach((k,i)=>{k.rotation.x=Number(screws[i]||0)*5;k.position.x=.44+Number(screws[i]||0)*.025;});
    cam.position.x=3.36+(Number(s.distance||0)-50)*.004;
    const ap=Math.max(.1,Math.min(1,Number(s.aperture||5.6)/11));blades.forEach((b,i)=>{const a=i*Math.PI/4;b.position.y=(.07+.13*ap)*Math.sin(a);b.position.z=(.07+.13*ap)*Math.cos(a);});
    const lightOn=ready&&!s.probeIn;beam.visible=beamCore.visible=lightOn;multi.visible=lightOn&&s.fpInserted!==false;photons.forEach((p,i)=>{p.visible=lightOn;p.position.set(-4.55+((now*.0006+i/14)%1)*7.35,1.86,0);});
    bArrow.visible=current>.01;const a=`${current.toFixed(2)} A`;if(a!==previousAmp){setDisplay(amp,a,'#89ffe4');previousAmp=a;}
    const b=typeof s.B==='number'?s.B:typeof s.field==='number'?s.field:current*.16;const bstr=s.probeIn?`${(Math.abs(b)<2?b*1000:b).toFixed(1)} mT`:'探测笔未置中';if(bstr!==previousB){setDisplay(tesla,bstr,'#9be5ff');previousB=bstr;}
    const active=s.guideFocus||s.selected||selection;if(targets[active]){focusRing.visible=true;focusRing.position.copy(targets[active].point);focusRing.position.y=.91;focusRing.scale.setScalar(active==='magnet'?1.7:1);focusRing.material.opacity=.35+.2*Math.sin(now*.003);}else focusRing.visible=false;
    const r=container.getBoundingClientRect();labels.forEach(l=>{const p=l.p.clone().project(camera);l.e.style.left=`${(p.x+1)/2*r.width}px`;l.e.style.top=`${(-p.y+1)/2*r.height}px`;l.e.style.display=p.z>1||p.x<-1||p.x>1||p.y<-1||p.y>1?'none':'';l.e.style.borderColor=l.id===active?'#60dfbd':'#3b5d6b99';l.e.style.color=l.id===active?'#88ffe2':'#a3bac5';});
    if(now-lastScreen>250){lastScreen=now;const ctx=monitorCtx;ctx.fillStyle='#0a1920';ctx.fillRect(0,0,640,360);ctx.fillStyle='#28424c';ctx.fillRect(0,0,640,35);ctx.font='15px sans-serif';ctx.fillStyle='#a8d9d2';ctx.fillText('CMOS · 三点画圆 / 120°',18,24);ctx.strokeStyle=lightOn?'#70f599':'#325342';ctx.lineWidth=2;for(let i=0;i<5;i++){const rad=30+i*23;ctx.beginPath();ctx.arc(300,193,rad,0,Math.PI*2);ctx.stroke();if(current>0&&lightOn){ctx.beginPath();ctx.arc(300,193,rad+5,0,Math.PI*2);ctx.stroke();}}ctx.fillStyle='#5e8d9d';ctx.fillText('a 内分量      b 外分量',430,323);monitorTex.needsUpdate=true;}
    renderer.render(scene,camera);
  }
  raf=requestAnimationFrame(loop);
  return {
    resetView(){target.set(0,1.05,.45);azimuth=.68;elevation=.49;radius=15.8;},
    topView(){target.set(-.3,1.1,.5);elevation=1.40;azimuth=.05;radius=14;},
    focus(id){if(targets[id]){target.copy(targets[id].point);radius=id==='magnet'?6.1:4.7;azimuth=.76;elevation=.34;selection=id;}},
    snapshot(){return renderer.domElement.toDataURL('image/png');},
    resize,
    dispose(){disposed=true;cancelAnimationFrame(raf);ro.disconnect();labels.forEach(l=>l.e.remove());renderer.dispose();renderer.domElement.remove();}
  };
}
