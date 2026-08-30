// Temporary hotfix loader for forklift-game.js.
// The 3D warehouse source is fetched as text, one missing brace is repaired,
// then the repaired source is evaluated before the real game is mounted.
window.ForkliftGame={
  async mount(root,onExit){
    try{
      const res=await fetch('./forklift-game.js?v=3d-hotfix',{cache:'no-store'});
      if(!res.ok)throw new Error('forklift-game.js load failed: '+res.status);
      let src=await res.text();
      const broken="this.elevatorMeshes.push({group:eg,...e,index:i})})}\n    buildForklift(){";
      const fixed="this.elevatorMeshes.push({group:eg,...e,index:i})})}}\n    buildForklift(){";
      if(src.includes(broken))src=src.replace(broken,fixed);
      else console.warn('Forklift hotfix pattern not found; evaluating source unchanged.');
      (0,eval)(src+'\n//# sourceURL=forklift-game-fixed.js');
      const real=window.ForkliftGame;
      if(!real||real.mount===this.mount)throw new Error('ForkliftGame did not initialize');
      return real.mount(root,onExit);
    }
  }
};
