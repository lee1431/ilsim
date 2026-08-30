const ForkliftGame=(()=>{
  let THREE=null,game=null;
  const RACKS=50,BAYS=50,LEVELS=4;
  const RACK_D=1.15,AISLE_W=3.6,BACK_GAP=.28,BAY=2.2,RACK_Z0=-42,RACK_LEN=BAYS*BAY;
  const FLOOR_H=10.5,DOCK_X=82,DOCK_Z=[-137.5,-122.5,-107.5,-92.5,-77.5,-62.5];
  const ELEVATORS=[
    {id:'E01',x:74,z:-130,docks:'1 / 2'},
    {id:'E02',x:74,z:-70,docks:'5 / 6'},
    {id:'E03',x:-74,z:-130,docks:'7 / 8'},
    {id:'E04',x:-74,z:-70,docks:'11 / 12'}
  ];
  const PRODUCTS=['AX-2143','AX-2148','AX-2183','BX-2208','CX-2126','DX-2237','FX-2172','GX-2127'];
  const LOTS=['L260830-A','L260830-B','L260829-C','L260828-D','L260901-A','L260901-B'];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const pad=n=>String(n).padStart(2,'0');
  const slotKey=d=>`${d.floor}-A${pad(d.row)}-${pad(d.col)}-L${d.level}`;
  function rowX(r){let x=-72;for(let i=1;i<r;i++)x+=RACK_D+(i%2===1?AISLE_W:BACK_GAP);return x}
  const bayZ=c=>RACK_Z0+(c-.5)*BAY;
  const aisleOf=r=>Math.ceil(r/2);
  const faceOf=r=>r%2===1?'+X':'-X';
  function approach(d){return {x:rowX(d.row)+(d.row%2===1?1:-1)*(RACK_D/2+AISLE_W*.48),z:bayZ(d.col)}}
  function freeDestination(floor,row,col,level,reserved){
    RackViewer.ensureSeed?.();const inv=RackViewer.inventory;
    const test=(r,c,l)=>{const d={floor,row:r,col:c,level:l};return !inv.has(slotKey(d))&&!reserved.has(slotKey(d))?d:null};
    let d=test(row,col,level);if(d)return d;
    for(let l=1;l<=4;l++){d=test(row,col,l);if(d)return d}
    for(let rr=1;rr<=RACKS;rr++)for(let cc=1;cc<=BAYS;cc++)for(let l=1;l<=LEVELS;l++){d=test(rr,cc,l);if(d)return d}
    return {floor,row,col,level};
  }
  function makeTasks(){
    const floors=['1F','2F','2F','1F','2F','1F','2F','1F'],rows=[3,14,21,32,41,48,7,26],cols=[12,18,7,31,44,25,37,5],levels=[2,3,1,4,2,1,3,4],reserved=new Set;
    return floors.map((floor,i)=>{const d=freeDestination(floor,rows[i],cols[i],levels[i],reserved);reserved.add(slotKey(d));return {id:i+1,code:PRODUCTS[i],lot:LOTS[i%LOTS.length],...d,aisle:aisleOf(d.row),done:false}})
  }
  async function mount(root,onExit){
    if(game)game.destroy();
    THREE=THREE||await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
    game=new Game(root,onExit);return game;
  }
  class Game{
    constructor(root,onExit){
      this.root=root;this.onExit=onExit;this.tasks=makeTasks();this.idx=0;this.floor='1F';this.keys={};this.speed=0;this.steer=0;this.forkLevel=1;this.carrying=false;this.palletWaiting=true;this.transition=false;this.destroyed=false;this.msg='검수 완료 파렛트를 픽업하십시오.';this.last=performance.now();
      this.renderShell();this.init3D();this.bind();this.newTask(true);this.loop=this.loop.bind(this);this.raf=requestAnimationFrame(this.loop);
    }
    task(){return this.tasks[this.idx]}
    renderShell(){this.root.innerHTML=`<main class="fg fg3d"><div id="fgWorld"></div><div class="fgTop"><div class="fgBrand"><b>일</b>sim · 3D 지게차</div><div class="fgFloor"><strong id="fgFloor">1F</strong><span>WAREHOUSE FLOOR</span></div><div class="fgTopBtns"><button class="primary" id="fgMap">▦ 랙 맵 M</button><button id="fgReset">↻ 재시작</button><button id="fgExit">← 직무 선택</button></div></div><section class="fgMission"><small>CURRENT PALLET</small><h2 id="fgCode"></h2><div class="lot" id="fgLot"></div><div class="fgDest"><small>격납 목적지</small><strong id="fgDest"></strong><span id="fgAisle"></span></div><div class="fgProgress"><span id="fgProgress"></span><b id="fgRemain"></b></div></section><aside class="fgFork"><div class="fgForkHead"><span>FORK HEIGHT</span><strong id="fgLevel">L1</strong></div><div class="fgLevelTrack" id="fgLevelTrack"></div><div class="fgCarry" id="fgCarry"></div></aside><aside class="fgElev"><small>FREIGHT ELEVATORS · MAX 8 PLT</small><div class="fgElevList" id="fgElevList"></div></aside><div class="fgCompass" id="fgCompass"></div><div class="fgStatus" id="fgStatus"></div><div class="fgControls"><span class="fgKey"><b>W/S</b>전후진</span><span class="fgKey"><b>A/D</b>조향</span><span class="fgKey"><b>Q/E</b>포크</span><span class="fgKey"><b>SPACE</b>작업</span><span class="fgKey"><b>M</b>랙 맵</span></div><div class="fgMiniHelp">1층·2층 10,000 SLOT · 실제 랙 통로 충돌 적용 · E01~E04 컨베이어 연동</div><div class="fgDone hidden" id="fgDone"><div class="fgDoneCard"><small>SHIFT COMPLETE</small><h2>격납 작업 완료</h2><p id="fgDoneText"></p><button id="fgAgain">다시 작업하기</button></div></div><div class="fgFade hidden" id="fgFade"><strong>2F</strong><span>2층 지게차 작업자로 전환 중...</span></div></main>`;
      this.world=this.root.querySelector('#fgWorld');['fgFloor','fgCode','fgLot','fgDest','fgAisle','fgProgress','fgRemain','fgLevel','fgLevelTrack','fgCarry','fgElevList','fgCompass','fgStatus','fgDone','fgDoneText','fgFade'].forEach(id=>this[id]=this.root.querySelector('#'+id));
      this.root.querySelector('#fgExit').onclick=()=>{this.destroy();this.onExit?.()};this.root.querySelector('#fgReset').onclick=()=>this.reset();this.root.querySelector('#fgMap').onclick=()=>this.openMap();this.root.querySelector('#fgAgain').onclick=()=>this.reset();
    }
    init3D(){
      const T=THREE;this.scene=new T.Scene();this.scene.background=new T.Color(0x9aa7aa);this.scene.fog=new T.Fog(0x9aa7aa,75,235);
      this.camera=new T.PerspectiveCamera(68,innerWidth/innerHeight,.1,320);this.renderer=new T.WebGLRenderer({antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=true;this.world.appendChild(this.renderer.domElement);
      this.scene.add(new T.HemisphereLight(0xeaf6ff,0x4e554f,2.0));const sun=new T.DirectionalLight(0xffffff,2.3);sun.position.set(-35,45,-30);sun.castShadow=true;this.scene.add(sun);
      this.floorGroups={};this.buildFloor('1F',0);this.buildFloor('2F',FLOOR_H);this.buildDockZone();this.buildElevators();this.buildForklift();this.buildPallet();this.buildTarget();
      this.camera.position.set(0,6,-145);this.setFloor('1F');
    }
    mat(color,rough=.7){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:.08})}
    box(w,h,d,color){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),this.mat(color));m.castShadow=true;m.receiveShadow=true;return m}
    label(text,bg='#14201d',fg='#f1b34e',w=256,h=96){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,w,h);g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';g.font='bold 38px Arial';g.fillText(text,w/2,h/2);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true}));s.scale.set(4.2,1.55,1);return s}
    buildFloor(name,y0){
      const T=THREE,g=new T.Group();g.name=name;g.position.y=y0;this.scene.add(g);this.floorGroups[name]=g;
      const floor=new T.Mesh(new T.PlaneGeometry(180,250),this.mat(name==='1F'?0x848f8d:0x8e9996,.9));floor.rotation.x=-Math.PI/2;floor.position.z=-32;floor.receiveShadow=true;g.add(floor);
      const posts=[],beams=[];for(let r=1;r<=RACKS;r++){const x=rowX(r);for(let c=0;c<=BAYS;c++){const z=RACK_Z0+c*BAY;posts.push([x-RACK_D/2,z],[x+RACK_D/2,z])}for(let l=1;l<=LEVELS;l++)beams.push([x,l*1.55-.65])}
      const pg=new T.BoxGeometry(.09,6.6,.09),pm=this.mat(0x304f66,.45),pi=new T.InstancedMesh(pg,pm,posts.length),dummy=new T.Object3D();posts.forEach((p,i)=>{dummy.position.set(p[0],3.3,p[1]);dummy.updateMatrix();pi.setMatrixAt(i,dummy.matrix)});pi.castShadow=true;g.add(pi);
      const bg=new T.BoxGeometry(RACK_D,.12,RACK_LEN),bi=new T.InstancedMesh(bg,this.mat(0xc0883f,.5),beams.length);beams.forEach((p,i)=>{dummy.position.set(p[0],p[1],RACK_Z0+RACK_LEN/2);dummy.updateMatrix();bi.setMatrixAt(i,dummy.matrix)});bi.castShadow=true;g.add(bi);
      for(let r=1;r<=RACKS;r+=2){const a=aisleOf(r),x=(rowX(r)+rowX(r+1))/2,s=this.label(`통로 ${pad(a)}`,'#22302b','#d9e1dd');s.position.set(x,7,RACK_Z0-4);g.add(s)}
      for(let r=1;r<=RACKS;r++){const s=this.label(`A${pad(r)}`,'#17221f','#efb34e');s.scale.set(2.4,.9,1);s.position.set(rowX(r),5.8,RACK_Z0-1.7);g.add(s)}
    }
    buildDockZone(){
      const T=THREE;for(const floorName of['1F','2F']){const g=this.floorGroups[floorName];for(let i=0;i<6;i++){const z=DOCK_Z[i];for(const side of[1,-1]){const n=side===1?i+1:i+7,door=this.box(.22,6.4,8, n===12?0x30526a:0x435255);door.position.set(side*DOCK_X,3.2,z);g.add(door);const s=this.label(String(n));s.position.set(side*(DOCK_X-1.1),7.2,z);g.add(s)}}const guide=new T.GridHelper(180,60,0xaab5b2,0x929e9b);guide.position.set(0,.02,-96);g.add(guide)}
    }
    buildElevators(){
      this.elevatorMeshes=[];for(const floorName of['1F','2F']){const g=this.floorGroups[floorName];ELEVATORS.forEach((e,i)=>{const eg=new THREE.Group();eg.position.set(e.x,0,e.z);const pad=this.box(5.4,.18,5.8,0x293b36);pad.position.y=.09;eg.add(pad);for(const sx of[-2.5,2.5])for(const sz of[-2.7,2.7]){const p=this.box(.12,6,.12,0xd8a33f);p.position.set(sx,3,sz);eg.add(p)}const top=this.box(5.4,.18,5.8,0x33443f);top.position.y=6;eg.add(top);const sign=this.label(`${e.id}\n${e.docks}`);sign.position.set(0,7,0);eg.add(sign);g.add(eg);if(floorName==='1F')this.elevatorMeshes.push({group:eg,...e,index:i})})}
    buildForklift(){
      const g=new THREE.Group(),body=this.box(2.2,1,3.1,0xd79c2f);body.position.y=.75;g.add(body);const cabin=this.box(1.7,1.9,1.5,0x34433e);cabin.position.set(0,2,0.45);g.add(cabin);const mast=this.box(.18,4,.18,0x202927);mast.position.set(.65,2,-1.7);g.add(mast);const mast2=mast.clone();mast2.position.x=-.65;g.add(mast2);this.forks=new THREE.Group();for(const x of[-.48,.48]){const f=this.box(.12,.1,1.9,0x252d2b);f.position.set(x,0,-2.15);this.forks.add(f)}g.add(this.forks);for(const x of[-.9,.9])for(const z of[-.9,.9]){const w=this.box(.42,.42,.25,0x121716);w.position.set(x,.42,z);g.add(w)}this.scene.add(g);this.forklift=g;this.forklift.position.set(0,0,-132);this.yaw=0;
    }
    buildPallet(){const g=new THREE.Group(),base=this.box(2.1,.18,1.7,0x7f5835);base.position.y=.1;g.add(base);const load=this.box(1.95,1.25,1.55,0xd69b44);load.position.y=.82;g.add(load);this.scene.add(g);this.pallet=g;this.pallet.position.set(0,0,-116)}
    buildTarget(){const g=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(1.1,.08,10,32),new THREE.MeshBasicMaterial({color:0xffbd52}));ring.rotation.x=Math.PI/2;g.add(ring);const beam=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,5,8),new THREE.MeshBasicMaterial({color:0xffbd52,transparent:true,opacity:.8}));beam.position.y=2.5;g.add(beam);this.scene.add(g);this.target=g}
    bind(){this.kd=e=>{if(['KeyW','KeyA','KeyS','KeyD','Space','KeyQ','KeyE','KeyM'].includes(e.code))e.preventDefault();this.keys[e.code]=true;if(e.repeat)return;if(e.code==='Space')this.interact();if(e.code==='KeyQ')this.setFork(this.forkLevel-1);if(e.code==='KeyE')this.setFork(this.forkLevel+1);if(e.code==='KeyM')this.openMap()};this.ku=e=>this.keys[e.code]=false;this.rs=()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight)};addEventListener('keydown',this.kd);addEventListener('keyup',this.ku);addEventListener('resize',this.rs)}
    setFloor(f){this.floor=f;this.floorGroups['1F'].visible=f==='1F';this.floorGroups['2F'].visible=f==='2F';this.forklift.position.y=f==='1F'?0:FLOOR_H;this.pallet.position.y=f==='1F'?0:FLOOR_H;this.target.position.y=f==='1F'?.08:FLOOR_H+.08;this.refreshHud()}
    setFork(n){this.forkLevel=clamp(n,1,4);this.forks.position.y=(this.forkLevel-1)*1.55;this.msg=`포크 높이 L${this.forkLevel}`;this.refreshHud()}
    newTask(first=false){const t=this.task();this.setFloor('1F');this.forklift.position.x=0;this.forklift.position.z=-132;this.yaw=0;this.speed=0;this.carrying=false;this.palletWaiting=true;this.pallet.visible=true;this.pallet.position.set(0,0,-116);const ap=approach(t);this.target.position.set(ap.x,.08,ap.z);this.target.visible=t.floor==='1F';this.setFork(1);this.msg=first?'검수 완료 파렛트를 픽업하십시오.':'다음 파렛트가 도착했습니다.';this.refreshHud()}
    reset(){this.tasks=makeTasks();this.idx=0;this.fgDone.classList.add('hidden');this.newTask(true)}
    openMap(){const t=this.task();RackViewer.open({floor:t.floor,row:t.row,col:t.col})}
    collides(x,z){if(Math.abs(x)>78||z<-148||z>76)return true;if(z>=RACK_Z0-1&&z<=RACK_Z0+RACK_LEN+1){for(let r=1;r<=RACKS;r++)if(Math.abs(x-rowX(r))<RACK_D*.72)return true}return false}
    near(obj,d=4){return Math.hypot(this.forklift.position.x-obj.x,this.forklift.position.z-obj.z)<d}
    nearestElevator(){return ELEVATORS.map((e,i)=>({...e,index:i,d:Math.hypot(this.forklift.position.x-e.x,this.forklift.position.z-e.z)})).sort((a,b)=>a.d-b.d)[0]}
    interact(){
      if(this.transition||document.getElementById('rackViewerRoot'))return;const t=this.task();
      if(!this.carrying){if(this.pallet.visible&&this.near({x:this.pallet.position.x,z:this.pallet.position.z},4.2)){this.carrying=true;this.palletWaiting=false;this.msg=`${t.code} 픽업 완료 · ${t.floor}-A${pad(t.row)}-${pad(t.col)}-L${t.level}`;this.refreshHud();return}this.msg='파렛트 가까이 이동하십시오.';this.refreshHud();return}
      if(t.floor==='2F'&&this.floor==='1F'){
        const e=this.nearestElevator();if(e.d<5){const q=RackViewer.elevators[e.index];if(q.count>=8){this.msg=`${e.id} FULL 8/8 · 다른 엘리베이터를 이용하십시오.`;this.refreshHud();return}q.count++;this.carrying=false;this.pallet.visible=false;this.transition=true;this.msg=`${e.id} 컨베이어 투입 · 2층 상승 중`;this.refreshHud();this.fgFade.classList.remove('hidden');setTimeout(()=>{q.count=Math.max(0,q.count-1);this.setFloor('2F');this.forklift.position.set(e.x+(e.x>0?-7:7),FLOOR_H,e.z);this.yaw=e.x>0?Math.PI:0;this.pallet.position.set(e.x+(e.x>0?-3:3),FLOOR_H,e.z);this.pallet.visible=true;this.palletWaiting=true;this.target.visible=true;const ap=approach(t);this.target.position.set(ap.x,FLOOR_H+.08,ap.z);this.transition=false;this.msg=`2층 ${e.id} 반출 완료 · 파렛트를 다시 픽업하십시오.`;this.fgFade.classList.add('hidden');this.refreshHud()},1100);return}
        this.msg='2층 목적지입니다. E01~E04 컨베이어 안으로 이동해 SPACE를 누르십시오.';this.refreshHud();return
      }
      if(this.floor!==t.floor){this.msg=`목적지는 ${t.floor}입니다.`;this.refreshHud();return}
      const ap=approach(t);if(!this.near(ap,3.4)){this.msg=`통로 ${pad(t.aisle)} · A${pad(t.row)} · ${pad(t.col)}번 BAY로 이동하십시오.`;this.refreshHud();return}if(this.forkLevel!==t.level){this.msg=`위치는 맞습니다. 포크를 L${t.level}로 맞추십시오.`;this.refreshHud();return}this.store(t)
    }
    store(t){RackViewer.inventory.set(slotKey(t),{code:t.code,lot:t.lot});this.carrying=false;this.pallet.visible=false;t.done=true;this.idx++;this.msg=`격납 완료 · ${slotKey(t)}`;if(this.idx>=this.tasks.length){this.fgDoneText.textContent=`총 ${this.tasks.length}개 파렛트를 1층·2층 지정 랙에 정상 격납했습니다.`;this.fgDone.classList.remove('hidden');this.refreshHud();return}this.transition=true;this.refreshHud();setTimeout(()=>{this.transition=false;this.newTask()},750)}
    update(dt){if(this.transition||document.getElementById('rackViewerRoot'))return;const f=(this.keys.KeyW?1:0)-(this.keys.KeyS?1:0),st=(this.keys.KeyD?1:0)-(this.keys.KeyA?1:0);this.speed+=f*10*dt;if(!f)this.speed*=Math.pow(.07,dt);this.speed=clamp(this.speed,-4.3,7.2);if(Math.abs(this.speed)>.15)this.yaw-=st*1.65*dt*(this.speed>=0?1:-1)*(Math.abs(this.speed)/7.2+.25);const nx=this.forklift.position.x+Math.sin(this.yaw)*this.speed*dt,nz=this.forklift.position.z+Math.cos(this.yaw)*this.speed*dt;if(!this.collides(nx,nz)){this.forklift.position.x=nx;this.forklift.position.z=nz}else this.speed*=-.16;this.forklift.rotation.y=this.yaw;if(this.carrying){const fy=this.floor==='1F'?0:FLOOR_H;this.pallet.position.set(this.forklift.position.x+Math.sin(this.yaw)*-2.8,fy+.1+(this.forkLevel-1)*1.55,this.forklift.position.z+Math.cos(this.yaw)*-2.8);this.pallet.rotation.y=this.yaw}this.updateCamera(dt);this.refreshCompass()}
    updateCamera(dt){const p=this.forklift.position,back=10,tx=p.x-Math.sin(this.yaw)*back,tz=p.z-Math.cos(this.yaw)*back,ty=p.y+6.1;this.camera.position.lerp(new THREE.Vector3(tx,ty,tz),1-Math.pow(.001,dt));this.camera.lookAt(p.x,p.y+1.3,p.z)}
    refreshCompass(){const t=this.task();if(!t)return;let d;if(!this.carrying)d=Math.hypot(this.forklift.position.x-this.pallet.position.x,this.forklift.position.z-this.pallet.position.z);else if(t.floor==='2F'&&this.floor==='1F')d=this.nearestElevator().d;else{const ap=approach(t);d=Math.hypot(this.forklift.position.x-ap.x,this.forklift.position.z-ap.z)}this.fgCompass.textContent=`${t.floor} · 통로 ${pad(t.aisle)} · A${pad(t.row)}-${pad(t.col)} · 약 ${Math.round(d)}m`}
    refreshHud(){const t=this.task()||this.tasks[this.tasks.length-1];this.fgFloor.textContent=this.floor;this.fgCode.textContent=t.code;this.fgLot.textContent=t.lot;this.fgDest.textContent=`${t.floor}-A${pad(t.row)}-${pad(t.col)}-L${t.level}`;this.fgAisle.textContent=`통로 ${pad(t.aisle)} · ${faceOf(t.row)} 방향 · BAY ${pad(t.col)} · ${t.level}단`;this.fgProgress.textContent=`작업 ${Math.min(this.idx+1,this.tasks.length)} / ${this.tasks.length}`;this.fgRemain.textContent=`완료 ${this.idx}`;this.fgLevel.textContent=`L${this.forkLevel}`;this.fgLevelTrack.innerHTML=[1,2,3,4].map(l=>`<i class="${l===this.forkLevel?'on':''}">L${l}</i>`).join('');this.fgCarry.innerHTML=this.carrying?`적재 상태 · <b>${t.code}</b><br>${t.lot}`:(this.pallet.visible?'포크 비어 있음 · 파렛트 픽업 대기':'파렛트 이동 중');this.fgElevList.innerHTML=ELEVATORS.map((e,i)=>`<div class="${RackViewer.elevators[i].count>=8?'full':''}"><b>${e.id}</b><span>${RackViewer.elevators[i].count}/8</span><small>${e.docks}번 사이</small></div>`).join('');this.fgStatus.textContent=this.msg;this.refreshCompass()}
    loop(now){const dt=Math.min(.04,(now-this.last)/1000);this.last=now;this.update(dt);this.renderer.render(this.scene,this.camera);if(!this.destroyed)this.raf=requestAnimationFrame(this.loop)}
    destroy(){this.destroyed=true;cancelAnimationFrame(this.raf);removeEventListener('keydown',this.kd);removeEventListener('keyup',this.ku);removeEventListener('resize',this.rs);this.renderer?.dispose();this.root.innerHTML='';if(game===this)game=null}
  }
  return {mount,get active(){return game}};
})();
window.ForkliftGame=ForkliftGame;
