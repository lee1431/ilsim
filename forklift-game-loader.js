// Loads the 3D forklift source, repairs known source issues, then starts it.
window.ForkliftGame={
  async mount(root,onExit){
    const res=await fetch('./forklift-game.js?v=3d-flow-1',{cache:'no-store'});
    if(!res.ok)throw new Error('forklift-game.js load failed: '+res.status);

    let src=await res.text();

    const replaceBetween=(start,end,next)=>{
      const a=src.indexOf(start);
      const b=src.indexOf(end,a+start.length);
      if(a<0||b<0)throw new Error('Forklift patch marker not found: '+start);
      src=src.slice(0,a)+next+src.slice(b);
    };

    // Repair the missing class-method brace after buildElevators().
    const brokenBrace="this.elevatorMeshes.push({group:eg,...e,index:i})})}\n    buildForklift(){";
    const fixedBrace="this.elevatorMeshes.push({group:eg,...e,index:i})})}}\n    buildForklift(){";
    if(src.includes(brokenBrace))src=src.replace(brokenBrace,fixedBrace);

    // Fork side is local -Z. W moves toward the forks; camera stays behind.
    src=src.replaceAll('this.yaw=0;','this.yaw=Math.PI;');
    src=src.replace(
      "const nx=this.forklift.position.x+Math.sin(this.yaw)*this.speed*dt,nz=this.forklift.position.z+Math.cos(this.yaw)*this.speed*dt;",
      "const nx=this.forklift.position.x-Math.sin(this.yaw)*this.speed*dt,nz=this.forklift.position.z-Math.cos(this.yaw)*this.speed*dt;"
    );
    src=src.replace(
      "const p=this.forklift.position,back=10,tx=p.x-Math.sin(this.yaw)*back,tz=p.z-Math.cos(this.yaw)*back,ty=p.y+6.1;",
      "const p=this.forklift.position,back=10,tx=p.x+Math.sin(this.yaw)*back,tz=p.z+Math.cos(this.yaw)*back,ty=p.y+6.1;"
    );

    // Shared conveyor point: warehouse-side end of each freight elevator.
    src=src.replace(
      "function approach(d){return {x:rowX(d.row)+(d.row%2===1?1:-1)*(RACK_D/2+AISLE_W*.48),z:bayZ(d.col)}}",
      "function approach(d){return {x:rowX(d.row)+(d.row%2===1?1:-1)*(RACK_D/2+AISLE_W*.48),z:bayZ(d.col)}}\n  function conveyorPoint(e){return {x:e.x+(e.x>0?-5.8:5.8),z:e.z}}"
    );

    // Add persistent operator state for the separate 1F / 2F forklifts.
    src=src.replace(
      "this.transition=false;this.destroyed=false;this.msg='검수 완료 파렛트를 픽업하십시오.';this.last=performance.now();",
      "this.transition=false;this.destroyed=false;this.returnMode=false;this.activeElevatorIndex=null;this.awaiting2FPick=false;this.floorForkState={'1F':null,'2F':null};this.msg='검수 완료 파렛트를 픽업하십시오.';this.last=performance.now();"
    );

    // Give every freight elevator an actual conveyor protruding into the warehouse.
    src=src.replace(
      "eg.add(top);const sign=this.label(`${e.id}\\n${e.docks}`);",
      "eg.add(top);const conv=this.box(7.8,.42,3.4,0x56645f);conv.position.set(e.x>0?-5.1:5.1,.28,0);eg.add(conv);for(let rr=-3;rr<=3;rr++){const roller=this.box(.16,.08,3.05,0x26312e);roller.position.set((e.x>0?-5.1:5.1)+rr*.85,.54,0);eg.add(roller)}const sign=this.label(`${e.id}\\n${e.docks}`);"
    );

    // Nearest elevator is measured from the conveyor end, not the lift cabin.
    src=src.replace(
      "nearestElevator(){return ELEVATORS.map((e,i)=>({...e,index:i,d:Math.hypot(this.forklift.position.x-e.x,this.forklift.position.z-e.z)})).sort((a,b)=>a.d-b.d)[0]}",
      "nearestElevator(){return ELEVATORS.map((e,i)=>{const p=conveyorPoint(e);return {...e,index:i,cx:p.x,cz:p.z,d:Math.hypot(this.forklift.position.x-p.x,this.forklift.position.z-p.z)}}).sort((a,b)=>a.d-b.d)[0]}"
    );

    // Helpers: remember each floor's forklift and prepare the next pallet without teleporting the current one.
    src=src.replace(
      "    reset(){this.tasks=makeTasks();this.idx=0;this.fgDone.classList.add('hidden');this.newTask(true)}",
      "    saveForkState(f=this.floor){this.floorForkState[f]={x:this.forklift.position.x,z:this.forklift.position.z,yaw:this.yaw}}\n    restoreForkState(f,e){const s=this.floorForkState[f];if(s){this.forklift.position.set(s.x,f==='1F'?0:FLOOR_H,s.z);this.yaw=s.yaw}else if(e){const p=conveyorPoint(e);this.forklift.position.set(p.x+(e.x>0?-7:7),f==='1F'?0:FLOOR_H,p.z);this.yaw=e.x>0?-Math.PI/2:Math.PI/2}this.forklift.rotation.y=this.yaw;this.speed=0}\n    prepareNextPallet(){const t=this.task();if(!t)return;this.setFloor('1F');this.pallet.visible=true;this.pallet.position.set(0,0,-116);this.palletWaiting=true;this.carrying=false;this.target.position.set(0,.08,-116);this.target.visible=true;this.msg='다음 파렛트가 도착했습니다. 현재 위치에서 검수 완료 구역으로 복귀하십시오.';this.refreshHud()}\n    reset(){this.tasks=makeTasks();this.idx=0;this.returnMode=false;this.activeElevatorIndex=null;this.awaiting2FPick=false;this.floorForkState={'1F':null,'2F':null};this.fgDone.classList.add('hidden');this.newTask(true)}"
    );

    // Cargo-only elevator flow. 1F forklift leaves the pallet on the conveyor;
    // then the view switches to a separate 2F forklift waiting at the output conveyor.
    replaceBetween(
      "    interact(){\n",
      "    store(t){",
      `    interact(){
      if(this.transition||document.getElementById('rackViewerRoot'))return;
      const t=this.task();

      if(this.returnMode){
        const e=ELEVATORS[this.activeElevatorIndex],p=conveyorPoint(e);
        if(!this.near(p,4.5)){
          this.msg=\`격납 완료. ${'${e.id}'} 컨베이어 앞으로 복귀하십시오.\`;
          this.refreshHud();return;
        }
        this.saveForkState('2F');
        this.setFloor('1F');
        this.restoreForkState('1F',e);
        this.returnMode=false;
        this.activeElevatorIndex=null;
        this.prepareNextPallet();
        this.msg='1층 작업자로 복귀했습니다. 다음 파렛트를 받으러 이동하십시오.';
        this.refreshHud();
        return;
      }

      if(!this.carrying){
        if(this.pallet.visible&&this.near({x:this.pallet.position.x,z:this.pallet.position.z},4.2)){
          this.carrying=true;this.palletWaiting=false;
          if(this.floor==='2F'&&this.awaiting2FPick&&this.activeElevatorIndex!==null){
            const q=RackViewer.elevators[this.activeElevatorIndex];q.count=Math.max(0,q.count-1);this.awaiting2FPick=false;
          }
          const ap=approach(t);this.target.position.set(ap.x,this.floor==='1F'?.08:FLOOR_H+.08,ap.z);this.target.visible=true;
          this.msg=\`${'${t.code}'} 파렛트 픽업 완료 · ${'${t.floor}'}-A${'${pad(t.row)}'}-${'${pad(t.col)}'}-L${'${t.level}'}\`;
          this.refreshHud();return;
        }
        this.msg='파렛트 가까이 이동한 뒤 SPACE를 누르십시오.';this.refreshHud();return;
      }

      if(t.floor==='2F'&&this.floor==='1F'){
        const e=this.nearestElevator();
        if(e.d<4.8){
          const q=RackViewer.elevators[e.index];
          if(q.count>=8){this.msg=\`${'${e.id}'} FULL 8/8 · 다른 엘리베이터를 이용하십시오.\`;this.refreshHud();return}
          const cp=conveyorPoint(e);
          this.saveForkState('1F');
          q.count++;
          this.carrying=false;
          this.pallet.position.set(cp.x,.35,cp.z);
          this.pallet.visible=true;
          this.activeElevatorIndex=e.index;
          this.transition=true;
          this.msg=\`${'${e.id}'} 1층 컨베이어 투입 · 화물만 2층으로 상승 중\`;
          this.refreshHud();this.fgFade.classList.remove('hidden');
          setTimeout(()=>{
            this.setFloor('2F');
            this.restoreForkState('2F',e);
            const out=conveyorPoint(e);
            this.pallet.position.set(out.x,FLOOR_H+.35,out.z);
            this.pallet.visible=true;
            this.palletWaiting=true;
            this.awaiting2FPick=true;
            this.carrying=false;
            this.target.position.set(out.x,FLOOR_H+.08,out.z);this.target.visible=true;
            this.transition=false;
            this.msg=\`2층 ${'${e.id}'} 컨베이어에서 파렛트가 밀려 나왔습니다. 픽업하십시오.\`;
            this.fgFade.classList.add('hidden');this.refreshHud();
          },1000);
          return;
        }
        this.msg='2층 목적지입니다. 화물엘리베이터 앞 컨베이어까지 이동해 SPACE를 누르십시오.';this.refreshHud();return;
      }

      if(this.floor!==t.floor){this.msg=\`목적지는 ${'${t.floor}'}입니다.\`;this.refreshHud();return}
      const ap=approach(t);
      if(!this.near(ap,3.4)){this.msg=\`통로 ${'${pad(t.aisle)}'} · A${'${pad(t.row)}'} · ${'${pad(t.col)}'}번 BAY로 이동하십시오.\`;this.refreshHud();return}
      if(this.forkLevel!==t.level){this.msg=\`위치는 맞습니다. 포크를 L${'${t.level}'}로 맞추십시오.\`;this.refreshHud();return}
      this.store(t)
    }
`
    );

    // After storage, never teleport. 1F operator drives back to staging.
    // 2F operator first returns to the same elevator output, then control resumes with the parked 1F forklift.
    replaceBetween(
      "    store(t){",
      "    update(dt){",
      `    store(t){
      RackViewer.inventory.set(slotKey(t),{code:t.code,lot:t.lot});
      this.carrying=false;this.pallet.visible=false;t.done=true;this.idx++;this.speed=0;
      this.msg=\`격납 완료 · ${'${slotKey(t)}'}\`;
      if(this.idx>=this.tasks.length){
        this.fgDoneText.textContent=\`총 ${'${this.tasks.length}'}개 파렛트를 1층·2층 지정 랙에 정상 격납했습니다.\`;
        this.fgDone.classList.remove('hidden');this.refreshHud();return;
      }
      if(this.floor==='2F'){
        const e=ELEVATORS[this.activeElevatorIndex],cp=conveyorPoint(e);
        this.returnMode=true;
        this.target.position.set(cp.x,FLOOR_H+.08,cp.z);this.target.visible=true;
        this.msg=\`격납 완료. 빈차로 ${'${e.id}'} 컨베이어 앞으로 복귀하십시오.\`;
        this.refreshHud();return;
      }
      this.prepareNextPallet();
      this.msg='격납 완료. 다음 파렛트가 도착했습니다. 직접 출발지로 복귀하십시오.';
      this.refreshHud();
    }
`
    );

    // Navigation also points to the return conveyor when the 2F operator is coming back empty.
    replaceBetween(
      "    refreshCompass(){",
      "    refreshHud(){",
      `    refreshCompass(){
      const t=this.task();if(!t)return;let d,label='';
      if(this.returnMode){const e=ELEVATORS[this.activeElevatorIndex],p=conveyorPoint(e);d=Math.hypot(this.forklift.position.x-p.x,this.forklift.position.z-p.z);label=\`${'${e.id}'} 복귀 · 약 ${'${Math.round(d)}'}m\`}
      else if(!this.carrying){d=Math.hypot(this.forklift.position.x-this.pallet.position.x,this.forklift.position.z-this.pallet.position.z);label=\`파렛트까지 약 ${'${Math.round(d)}'}m\`}
      else if(t.floor==='2F'&&this.floor==='1F'){const e=this.nearestElevator();d=e.d;label=\`${'${e.id}'} 컨베이어 · 약 ${'${Math.round(d)}'}m\`}
      else{const ap=approach(t);d=Math.hypot(this.forklift.position.x-ap.x,this.forklift.position.z-ap.z);label=\`${'${t.floor}'} · 통로 ${'${pad(t.aisle)}'} · A${'${pad(t.row)}'}-${'${pad(t.col)}'} · 약 ${'${Math.round(d)}'}m\`}
      this.fgCompass.textContent=label
    }
`
    );

    // Updated 2F transition wording.
    src=src.replace('2층 지게차 작업자로 전환 중...','화물 상승 · 2층 지게차 작업자로 전환 중...');

    (0,eval)(src+'\n//# sourceURL=forklift-game-fixed.js');

    const real=window.ForkliftGame;
    if(!real||real.mount===this.mount)throw new Error('ForkliftGame did not initialize');
    return real.mount(root,onExit);
  }
};
