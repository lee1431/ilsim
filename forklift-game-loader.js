// Loads the 3D forklift source, repairs known source issues, then starts it.
window.ForkliftGame={
  async mount(root,onExit){
    const res=await fetch('./forklift-game.js?v=3d-hotfix-3',{cache:'no-store'});
    if(!res.ok)throw new Error('forklift-game.js load failed: '+res.status);

    let src=await res.text();

    // 1) Repair the missing class-method brace after buildElevators().
    const brokenBrace="this.elevatorMeshes.push({group:eg,...e,index:i})})}\n    buildForklift(){";
    const fixedBrace="this.elevatorMeshes.push({group:eg,...e,index:i})})}}\n    buildForklift(){";
    if(src.includes(brokenBrace))src=src.replace(brokenBrace,fixedBrace);

    // 2) The forklift model's physical front is local -Z (the fork side).
    // Start facing the waiting pallet (+world Z) and move along local -Z.
    src=src.replaceAll('this.yaw=0;','this.yaw=Math.PI;');

    const oldMove="const nx=this.forklift.position.x+Math.sin(this.yaw)*this.speed*dt,nz=this.forklift.position.z+Math.cos(this.yaw)*this.speed*dt;";
    const newMove="const nx=this.forklift.position.x-Math.sin(this.yaw)*this.speed*dt,nz=this.forklift.position.z-Math.cos(this.yaw)*this.speed*dt;";
    if(src.includes(oldMove))src=src.replace(oldMove,newMove);

    // 3) Chase camera belongs behind the forklift, opposite the fork direction.
    const oldCamera="const p=this.forklift.position,back=10,tx=p.x-Math.sin(this.yaw)*back,tz=p.z-Math.cos(this.yaw)*back,ty=p.y+6.1;";
    const newCamera="const p=this.forklift.position,back=10,tx=p.x+Math.sin(this.yaw)*back,tz=p.z+Math.cos(this.yaw)*back,ty=p.y+6.1;";
    if(src.includes(oldCamera))src=src.replace(oldCamera,newCamera);

    (0,eval)(src+'\n//# sourceURL=forklift-game-fixed.js');

    const real=window.ForkliftGame;
    if(!real||real.mount===this.mount){
      throw new Error('ForkliftGame did not initialize');
    }
    return real.mount(root,onExit);
  }
};
