const ForkliftGame=(()=>{
  const RACKS=50,BAYS=50,LEVELS=4,BAY_W=44,RACK_D=34,AISLE_W=100,STRIDE=RACK_D*2+AISLE_W;
  const X0=220,Y0=90,RACK_W=BAYS*BAY_W,WORLD_W=X0+RACK_W+420;
  const rackY=r=>r%2===1?Y0+((r-1)/2)*STRIDE:Y0+RACK_D+AISLE_W+((r/2)-1)*STRIDE;
  const RACK_BOTTOM=rackY(RACKS)+RACK_D,STAGE_Y=RACK_BOTTOM+150,WORLD_H=STAGE_Y+430;
  const PRODUCTS=['AX-2143','AX-2148','AX-2183','BX-2208','CX-2126','DX-2237','FX-2172','GX-2127'];
  const LOTS=['L260830-A','L260830-B','L260829-C','L260828-D','L260901-A','L260901-B'];
  let game=null;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const pad=n=>String(n).padStart(2,'0');
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const slotKey=d=>`${d.floor}-A${pad(d.row)}-${pad(d.col)}-L${d.level}`;
  const aisleOf=r=>Math.ceil(r/2);
  const faceOf=r=>r%2===1?'↓':'↑';
  function approachPoint(d){const y=rackY(d.row);return {x:X0+(d.col-.5)*BAY_W,y:d.row%2===1?y+RACK_D+AISLE_W/2:y-AISLE_W/2};}
  function elevatorPads(){const baseX=X0+RACK_W-520;return [0,1,2,3].map(i=>({x:baseX+i*125,y:STAGE_Y+195,w:92,h:92,index:i}));}
  function freeDestination(floor,row,col,level,reserved){
    const inv=RackViewer.inventory;
    const tryOne=(r,c,l)=>{const d={floor,row:r,col:c,level:l};const k=slotKey(d);return !inv.has(k)&&!reserved.has(k)?d:null};
    let d=tryOne(row,col,level);if(d)return d;
    for(let l=1;l<=LEVELS;l++){d=tryOne(row,col,l);if(d)return d}
    for(let ro=0;ro<RACKS;ro++)for(let co=0;co<BAYS;co++)for(let l=1;l<=LEVELS;l++){const r=((row-1+ro)%RACKS)+1,c=((col-1+co)%BAYS)+1;d=tryOne(r,c,l);if(d)return d}
    return {floor,row,col,level};
  }
  function makeTasks(){
    RackViewer.ensureSeed?.();
    const floors=['1F','2F','2F','1F','2F','1F','2F','1F'];
    const rows=[3,14,21,32,41,48,7,26],cols=[12,18,7,31,44,25,37,5],levels=[2,3,1,4,2,1,3,4],reserved=new Set;
    return floors.map((floor,i)=>{const d=freeDestination(floor,rows[i],cols[i],levels[i],reserved);reserved.add(slotKey(d));return {id:i+1,code:PRODUCTS[i%PRODUCTS.length],lot:LOTS[i%LOTS.length],...d,aisle:aisleOf(d.row),face:faceOf(d.row),done:false}});
  }
  function mount(root,onExit){if(game)game.destroy();game=new Game(root,onExit);return game}
  class Game{
    constructor(root,onExit){
      this.root=root;this.onExit=onExit;this.tasks=makeTasks();this.idx=0;this.keys={};this.carrying=false;this.floor='1F';this.forkLevel=1;this.speed=0;this.msg='검수 완료 파렛트로 이동해 SPACE로 들어 올리십시오.';this.transition=false;this.done=false;this.last=performance.now();this.raf=0;
      this.spawn={x:360,y:STAGE_Y+325};this.pallet={x:520,y:STAGE_Y+230};this.fork={x:this.spawn.x,y:this.spawn.y,a:-Math.PI/2};
      this.rackRects=Array.from({length:RACKS},(_,i)=>({x:X0,y:rackY(i+1),w:RACK_W,h:RACK_D,row:i+1}));
      this.renderShell();this.bind();this.resize();this.refreshHud();this.loop=this.loop.bind(this);this.raf=requestAnimationFrame(this.loop);
    }
    task(){return this.tasks[this.idx]}
    renderShell(){
      this.root.innerHTML=`<main class="fg"><canvas id="fgCanvas"></canvas><div class="fgTop"><div class="fgBrand"><b>일</b>sim · 지게차 격납</div><div class="fgFloor"><strong id="fgFloor">1F</strong><span>WAREHOUSE FLOOR</span></div><div class="fgTopBtns"><button class="primary" id="fgMap">▦ 랙 맵 M</button><button id="fgReset">↻ 재시작</button><button id="fgExit">← 직무 선택</button></div></div><section class="fgMission"><small>CURRENT PALLET</small><h2 id="fgCode"></h2><div class="lot" id="fgLot"></div><div class="fgDest"><small>격납 목적지</small><strong id="fgDest"></strong><span id="fgAisle"></span></div><div class="fgProgress"><span id="fgProgress"></span><b id="fgRemain"></b></div></section><aside class="fgFork"><div class="fgForkHead"><span>FORK HEIGHT</span><strong id="fgLevel">L1</strong></div><div class="fgLevelTrack" id="fgLevelTrack"></div><div class="fgCarry" id="fgCarry"></div></aside><aside class="fgElev"><small>FREIGHT ELEVATORS · MAX 8 PLT</small><div class="fgElevList" id="fgElevList"></div></aside><div class="fgCompass" id="fgCompass"></div><div class="fgStatus" id="fgStatus"></div><div class="fgControls"><span class="fgKey"><b>W/S</b>전후진</span><span class="fgKey"><b>A/D</b>조향</span><span class="fgKey"><b>Q/E</b>포크</span><span class="fgKey"><b>SPACE</b>작업</span><span class="fgKey"><b>M</b>랙 맵</span></div><div class="fgMiniHelp">랙을 통과할 수 없습니다 · 측면 통로로 이동한 뒤 목적 통로로 진입하세요</div><div class="fgDone hidden" id="fgDone"><div class="fgDoneCard"><small>SHIFT COMPLETE</small><h2>격납 작업 완료</h2><p id="fgDoneText"></p><button id="fgAgain">다시 작업하기</button></div></div></main>`;
      this.canvas=this.root.querySelector('#fgCanvas');this.ctx=this.canvas.getContext('2d');
      ['fgFloor','fgCode','fgLot','fgDest','fgAisle','fgProgress','fgRemain','fgLevel','fgLevelTrack','fgCarry','fgElevList','fgCompass','fgStatus','fgDone','fgDoneText'].forEach(id=>this[id]=this.root.querySelector('#'+id));
      this.root.querySelector('#fgExit').onclick=()=>{this.destroy();this.onExit?.()};
      this.root.querySelector('#fgReset').onclick=()=>this.resetAll();
      this.root.querySelector('#fgMap').onclick=()=>this.openMap();
      this.root.querySelector('#fgAgain').onclick=()=>this.resetAll();
    }
    bind(){
      this.kd=e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyQ','KeyE','KeyM'].includes(e.code))e.preventDefault();this.keys[e.code]=true;if(e.repeat)return;if(e.code==='Space')this.interact();if(e.code==='KeyQ')this.setFork(this.forkLevel-1);if(e.code==='KeyE')this.setFork(this.forkLevel+1);if(e.code==='KeyM')this.openMap()};
      this.ku=e=>this.keys[e.code]=false;this.rs=()=>this.resize();
      addEventListener('keydown',this.kd);addEventListener('keyup',this.ku);addEventListener('resize',this.rs);
    }
    resize(){const r=this.canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);this.vw=Math.max(1,r.width);this.vh=Math.max(1,r.height);this.canvas.width=Math.round(this.vw*d);this.canvas.height=Math.round(this.vh*d);this.ctx.setTransform(d,0,0,d,0,0);this.dpr=d}
    setFork(n){this.forkLevel=clamp(n,1,4);this.msg=`포크 높이 L${this.forkLevel}`;this.refreshHud()}
    openMap(){const t=this.task();RackViewer.open({floor:t.floor,row:t.row,col:t.col})}
    resetPosition(){this.floor='1F';this.fork.x=this.spawn.x;this.fork.y=this.spawn.y;this.fork.a=-Math.PI/2;this.speed=0;this.forkLevel=1;this.carrying=false}
    resetAll(){this.tasks=makeTasks();this.idx=0;this.done=false;this.transition=false;this.resetPosition();this.msg='검수 완료 파렛트로 이동해 SPACE로 들어 올리십시오.';this.fgDone.classList.add('hidden');this.refreshHud()}
    collision(x,y){const rad=18;if(x<rad||y<rad||x>WORLD_W-rad||y>WORLD_H-rad)return true;for(const r of this.rackRects){const cx=clamp(x,r.x,r.x+r.w),cy=clamp(y,r.y,r.y+r.h);if((x-cx)**2+(y-cy)**2<rad*rad)return true}return false}
    update(dt){
      if(this.done||this.transition||document.getElementById('rackViewerRoot'))return;
      const fwd=this.keys.KeyW||this.keys.ArrowUp,back=this.keys.KeyS||this.keys.ArrowDown,left=this.keys.KeyA||this.keys.ArrowLeft,right=this.keys.KeyD||this.keys.ArrowRight;
      const accel=(fwd?1:0)-(back?1:0);this.speed+=accel*150*dt;if(!accel)this.speed*=Math.pow(.12,dt);this.speed=clamp(this.speed,-72,115);
      const steer=(right?1:0)-(left?1:0);if(Math.abs(this.speed)>3)this.fork.a+=steer*1.75*dt*(Math.abs(this.speed)/115)*(this.speed>=0?1:-1);
      const nx=this.fork.x+Math.cos(this.fork.a)*this.speed*dt,ny=this.fork.y+Math.sin(this.fork.a)*this.speed*dt;
      if(!this.collision(nx,ny)){this.fork.x=nx;this.fork.y=ny}else this.speed*=-.12;
      this.refreshCompass();
    }
    interact(){
      if(this.done||this.transition||document.getElementById('rackViewerRoot'))return;
      const t=this.task();
      if(!this.carrying){
        if(this.floor==='1F'&&dist(this.fork,this.pallet)<70){this.carrying=true;this.msg=`${t.code} 파렛트 픽업 완료. 목적지 ${t.floor}-A${pad(t.row)}-${pad(t.col)}-L${t.level}`;this.refreshHud();return}
        this.msg='파렛트 가까이 이동한 뒤 SPACE를 누르십시오.';this.refreshHud();return;
      }
      if(t.floor==='2F'&&this.floor==='1F'){
        const pads=elevatorPads(),p=pads.find(x=>Math.hypot(this.fork.x-x.x,this.fork.y-x.y)<72);
        if(p){const e=RackViewer.elevators[p.index];if(e.count>=8){this.msg=`${e.id} FULL 8/8 · 다른 화물 엘리베이터를 이용하십시오.`;this.refreshHud();return}e.count++;this.transition=true;this.msg=`${e.id} 탑승 · 2층 이동 중...`;this.refreshHud();setTimeout(()=>{e.count=Math.max(0,e.count-1);this.floor='2F';this.fork.x=p.x;this.fork.y=p.y-115;this.fork.a=-Math.PI/2;this.speed=0;this.transition=false;this.msg=`2층 도착 · 통로 ${pad(t.aisle)}로 이동하십시오.`;this.refreshHud()},800);return}
        this.msg='2층 목적지입니다. E01~E04 화물 엘리베이터 표시 구역으로 이동하십시오.';this.refreshHud();return;
      }
      if(this.floor!==t.floor){this.msg=`목적지는 ${t.floor}입니다.`;this.refreshHud();return}
      const ap=approachPoint(t),d=Math.hypot(this.fork.x-ap.x,this.fork.y-ap.y);
      if(d>72){this.msg=`통로 ${pad(t.aisle)} · A${pad(t.row)} · BAY ${pad(t.col)} 위치까지 이동하십시오.`;this.refreshHud();return}
      if(this.forkLevel!==t.level){this.msg=`위치는 맞습니다. 포크 높이를 L${t.level}로 맞추십시오. (현재 L${this.forkLevel})`;this.refreshHud();return}
      this.storeTask(t);
    }
    storeTask(t){
      RackViewer.inventory.set(slotKey(t),{code:t.code,lot:t.lot});t.done=true;this.carrying=false;this.speed=0;this.msg=`격납 완료 · ${slotKey(t)}`;this.idx++;
      if(this.idx>=this.tasks.length){this.done=true;this.refreshHud();this.fgDoneText.textContent=`총 ${this.tasks.length}개 파렛트를 지정 랙에 정상 격납했습니다.`;this.fgDone.classList.remove('hidden');return}
      this.transition=true;this.refreshHud();setTimeout(()=>{this.resetPosition();this.transition=false;this.msg='다음 파렛트가 검수 완료 구역에 도착했습니다. 픽업하십시오.';this.refreshHud()},900)
    }
    refreshHud(){
      const t=this.task()||this.tasks[this.tasks.length-1];this.fgFloor.textContent=this.floor;this.fgCode.textContent=t.code;this.fgLot.textContent=t.lot;this.fgDest.textContent=`${t.floor}-A${pad(t.row)}-${pad(t.col)}-L${t.level}`;this.fgAisle.textContent=`통로 ${pad(t.aisle)} · A${pad(t.row)} ${t.face} 방향 · BAY ${pad(t.col)} · ${t.level}단`;this.fgProgress.textContent=`작업 ${Math.min(this.idx+1,this.tasks.length)} / ${this.tasks.length}`;this.fgRemain.textContent=`완료 ${this.idx}`;this.fgLevel.textContent='L'+this.forkLevel;this.fgLevelTrack.innerHTML=[1,2,3,4].map(l=>`<i class="${l===this.forkLevel?'on':''}">L${l}</i>`).join('');this.fgCarry.innerHTML=this.carrying?`적재 상태 · <b>${t.code}</b><br>${t.lot}`:'포크 비어 있음 · 검수 완료 파렛트를 픽업하세요';this.fgElevList.innerHTML=RackViewer.elevators.map(e=>`<div class="${e.count>=8?'full':''}"><b>${e.id}</b><span>${e.count}/8</span></div>`).join('');this.fgStatus.textContent=this.msg;this.refreshCompass()}
    refreshCompass(){const t=this.task();if(!t)return;let target;if(!this.carrying)target=this.pallet;else if(t.floor==='2F'&&this.floor==='1F'){const usable=elevatorPads().filter((p,i)=>RackViewer.elevators[i].count<8);target=usable.sort((a,b)=>dist(this.fork,a)-dist(this.fork,b))[0]||elevatorPads()[0]}else target=approachPoint(t);const d=Math.round(dist(this.fork,target)/10);this.fgCompass.textContent=this.carrying?`${t.floor} · 통로 ${pad(t.aisle)} · A${pad(t.row)}-${pad(t.col)} · 약 ${d}m`:`파렛트까지 약 ${d}m`}
    draw(){
      const c=this.ctx,w=this.vw,h=this.vh;c.save();c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);c.fillStyle='#75827f';c.fillRect(0,0,w,h);
      const camX=clamp(this.fork.x-w/2,0,Math.max(0,WORLD_W-w)),camY=clamp(this.fork.y-h/2,0,Math.max(0,WORLD_H-h));c.translate(-camX,-camY);
      c.fillStyle=this.floor==='1F'?'#8c9694':'#939d9a';c.fillRect(0,0,WORLD_W,WORLD_H);
      c.strokeStyle='#aab3b0';c.lineWidth=1;for(let x=0;x<WORLD_W;x+=80){c.beginPath();c.moveTo(x,0);c.lineTo(x,WORLD_H);c.stroke()}for(let y=0;y<WORLD_H;y+=80){c.beginPath();c.moveTo(0,y);c.lineTo(WORLD_W,y);c.stroke()}
      // Rack rows and forklift aisles.
      for(let r=1;r<=RACKS;r++){
        const y=rackY(r);if(y+RACK_D<camY-50||y>camY+h+50)continue;c.fillStyle='#26342f';c.fillRect(X0,y,RACK_W,RACK_D);c.strokeStyle='#101916';c.strokeRect(X0,y,RACK_W,RACK_D);
        c.fillStyle='#e7ece9';c.font='bold 13px monospace';c.textAlign='right';c.fillText(`A${pad(r)} ${faceOf(r)}${pad(aisleOf(r))}`,X0-12,y+22);
        c.strokeStyle='#53625c';c.lineWidth=1;for(let col=5;col<BAYS;col+=5){const x=X0+col*BAY_W;c.beginPath();c.moveTo(x,y);c.lineTo(x,y+RACK_D);c.stroke()}
        if(r%2===1){const cy=y+RACK_D+AISLE_W/2;c.strokeStyle='#d7ddd955';c.setLineDash([14,14]);c.beginPath();c.moveTo(X0-90,cy);c.lineTo(X0+RACK_W+90,cy);c.stroke();c.setLineDash([]);c.fillStyle='#46534e';c.font='bold 12px monospace';c.textAlign='left';c.fillText(`통로 ${pad(aisleOf(r))}`,X0+10,cy-8)}
      }
      // Highlight destination bay and approach point.
      const t=this.task();if(t&&this.floor===t.floor){const ry=rackY(t.row),bx=X0+(t.col-1)*BAY_W,ap=approachPoint(t);c.fillStyle='#f1ae3c88';c.fillRect(bx,ry,BAY_W,RACK_D);c.strokeStyle='#ffd37a';c.lineWidth=3;c.strokeRect(bx+1,ry+1,BAY_W-2,RACK_D-2);c.beginPath();c.arc(ap.x,ap.y,22,0,Math.PI*2);c.stroke();c.fillStyle='#18201d';c.font='bold 11px monospace';c.textAlign='center';c.fillText(`B${pad(t.col)} L${t.level}`,ap.x,ap.y+4)}
      // Staging area.
      c.fillStyle='#52625d';c.fillRect(70,STAGE_Y-70,WORLD_W-140,390);c.strokeStyle='#e8b653';c.lineWidth=2;c.setLineDash([12,8]);c.strokeRect(110,STAGE_Y+145,680,170);c.setLineDash([]);c.fillStyle='#1a2521';c.font='bold 16px Arial';c.textAlign='left';c.fillText('검수 완료 파렛트 대기장',130,STAGE_Y+178);
      if(this.floor==='1F'&&!this.carrying&&!this.done){c.fillStyle='#d99b3f';c.fillRect(this.pallet.x-28,this.pallet.y-24,56,48);c.fillStyle='#151d1a';c.font='bold 11px monospace';c.textAlign='center';c.fillText(t.code,this.pallet.x,this.pallet.y+4)}
      // Freight elevators.
      elevatorPads().forEach((p,i)=>{const e=RackViewer.elevators[i];c.fillStyle=e.count>=8?'#7e332a':'#314841';c.fillRect(p.x-p.w/2,p.y-p.h/2,p.w,p.h);c.strokeStyle=e.count>=8?'#ef735f':'#e2ad4a';c.lineWidth=2;c.strokeRect(p.x-p.w/2,p.y-p.h/2,p.w,p.h);c.fillStyle='#f1f4f2';c.font='bold 12px monospace';c.textAlign='center';c.fillText(e.id,p.x,p.y-5);c.fillText(`${e.count}/8`,p.x,p.y+13)});
      // Forklift and carried pallet.
      c.save();c.translate(this.fork.x,this.fork.y);c.rotate(this.fork.a);c.fillStyle='#d49a32';c.fillRect(-24,-16,48,32);c.fillStyle='#17201e';c.fillRect(-17,-21,12,7);c.fillRect(7,-21,12,7);c.fillRect(-17,14,12,7);c.fillRect(7,14,12,7);c.fillStyle='#1e2926';c.fillRect(16,-13,15,26);c.strokeStyle='#202824';c.lineWidth=4;c.beginPath();c.moveTo(31,-10);c.lineTo(47,-10);c.moveTo(31,10);c.lineTo(47,10);c.stroke();if(this.carrying){c.fillStyle='#e4ac53';c.fillRect(43,-19,38,38);c.fillStyle='#17201e';c.font='bold 8px monospace';c.textAlign='center';c.fillText(t.code,62,3)}c.restore();
      c.restore();
    }
    loop(now){const dt=Math.min(.04,(now-this.last)/1000);this.last=now;this.update(dt);this.draw();this.raf=requestAnimationFrame(this.loop)}
    destroy(){cancelAnimationFrame(this.raf);removeEventListener('keydown',this.kd);removeEventListener('keyup',this.ku);removeEventListener('resize',this.rs);this.root.innerHTML='';if(game===this)game=null}
  }
  return {mount,get active(){return game}};
})();
window.ForkliftGame=ForkliftGame;
