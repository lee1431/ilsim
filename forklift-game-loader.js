// Loads the 3D forklift source, repairs the known missing brace, then starts it.
window.ForkliftGame={
  async mount(root,onExit){
    const res=await fetch('./forklift-game.js?v=3d-hotfix-2',{cache:'no-store'});
    if(!res.ok)throw new Error('forklift-game.js load failed: '+res.status);

    let src=await res.text();
    const broken="this.elevatorMeshes.push({group:eg,...e,index:i})})}\n    buildForklift(){";
    const fixed="this.elevatorMeshes.push({group:eg,...e,index:i})})}}\n    buildForklift(){";

    if(src.includes(broken)){
      src=src.replace(broken,fixed);
    }

    (0,eval)(src+'\n//# sourceURL=forklift-game-fixed.js');

    const real=window.ForkliftGame;
    if(!real||real.mount===this.mount){
      throw new Error('ForkliftGame did not initialize');
    }
    return real.mount(root,onExit);
  }
};
