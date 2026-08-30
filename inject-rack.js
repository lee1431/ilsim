const fs = require('fs');
const path = 'index.html';
let s = fs.readFileSync(path, 'utf8');

if (!s.includes('rack-viewer.css')) {
  s = s.replace('</head>','<link rel="stylesheet" href="./ui-font-fix.css">\n<link rel="stylesheet" href="./rack-viewer.css">\n<link rel="stylesheet" href="./forklift-game.css">\n</head>');
}
if (!s.includes('rack-viewer.js')) {
  s = s.replace('<script type="module">','<script src="./rack-viewer.js"></script>\n<script src="./forklift-game-loader.js"></script>\n<script type="module">');
}

s = s.replace(
  "{id:'forklift',name:'지게차',desc:'하차 · 적치 · 파렛트 이동 · 동선 판단',on:false}",
  "{id:'forklift',name:'지게차',desc:'하차 · 적치 · 파렛트 이동 · 동선 판단',on:true}"
);
s = s.replace('<span>현재 1개 직무 체험 가능</span>','<span>현재 2개 직무 체험 가능</span>');

if (!s.includes('function forklift(){')) {
  const forklift = [
    "function forklift(){",
    "app.innerHTML='<div id=\"forkliftGameRoot\"></div>';",
    "ForkliftGame.mount(document.getElementById('forkliftGameRoot'),()=>go('/logistics'));",
    "}",
    ""
  ].join('\n');
  s = s.replace('function route(){', forklift + 'function route(){');
} else {
  s = s.replace(/function forklift\(\)\{[\s\S]*?\n\}\nfunction route\(\)\{/,
    "function forklift(){\napp.innerHTML='<div id=\"forkliftGameRoot\"></div>';\nForkliftGame.mount(document.getElementById('forkliftGameRoot'),()=>go('/logistics'));\n}\nfunction route(){");
}

s = s.replace(
  "else if(p==='/logistics/inspection')sim=new Inspection();else shell",
  "else if(p==='/logistics/inspection')sim=new Inspection();else if(p==='/logistics/forklift')forklift();else shell"
);

const oldTools='<button id="printer" disabled><b>3</b> 라벨 프린터</button></div>';
const newTools='<button id="printer" disabled><b>3</b> 라벨 프린터</button><button id="rackBtn" class="rackLaunch"><b>4</b> 랙 보기</button></div>';
if(!s.includes('id="rackBtn"')) s=s.replace(oldTools,newTools);
s=s.replace("'pdaBtn','printer','pda'", "'pdaBtn','printer','rackBtn','pda'");
const bindNeedle="this.pdaBtn.onclick=()=>{if(this.scanned()<this.s.pallets.length)return;this.s.pda=!this.s.pda;if(this.s.pda&&document.pointerLockElement)document.exitPointerLock();this.ui()}";
if(!s.includes('this.rackBtn.onclick')) s=s.replace(bindNeedle,bindNeedle+";this.rackBtn.onclick=()=>{if(document.pointerLockElement)document.exitPointerLock();RackViewer.open({floor:'1F',row:3,col:12})}");

fs.writeFileSync(path,s);
console.log('Rack viewer and playable forklift job injected');
