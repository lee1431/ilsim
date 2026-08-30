const fs = require('fs');
const path = 'index.html';
let s = fs.readFileSync(path, 'utf8');

// Shared styles + rack viewer data/UI.
if (!s.includes('rack-viewer.css')) {
  s = s.replace(
    '</head>',
    '<link rel="stylesheet" href="./ui-font-fix.css">\n<link rel="stylesheet" href="./rack-viewer.css">\n</head>'
  );
}
if (!s.includes('rack-viewer.js')) {
  s = s.replace(
    '<script type="module">',
    '<script src="./rack-viewer.js"></script>\n<script type="module">'
  );
}

// Enable forklift role.
s = s.replace(
  "{id:'forklift',name:'지게차',desc:'하차 · 적치 · 파렛트 이동 · 동선 판단',on:false}",
  "{id:'forklift',name:'지게차',desc:'하차 · 적치 · 파렛트 이동 · 동선 판단',on:true}"
);
s = s.replace(
  '<span>현재 1개 직무 체험 가능</span>',
  '<span>현재 2개 직무 체험 가능</span>'
);

// Add forklift page without nested template literals.
if (!s.includes('function forklift(){')) {
  const forklift = [
    "function forklift(){",
    "const elevatorHtml=RackViewer.elevators.map(e=>'<div><strong>'+e.id+'</strong><b>'+e.count+' / 8</b><span>대기 PALLET</span></div>').join('');",
    "app.innerHTML='<main class=\"forkliftMode\"><div class=\"forkHead\"><div class=\"forkBrand\"><b>일</b>sim · 지게차</div><button id=\"forkBack\">← 직무 선택</button></div><section class=\"forkMain\"><span class=\"forkEyebrow\">LOGISTICS · FORKLIFT</span><h1>지게차 작업</h1><p class=\"forkLead\">1층 검수 완료 파렛트를 화물 엘리베이터 컨베이어로 보내고, 2층에서 받아 지정 랙에 격납합니다. 화물기 1대의 대기 한도는 8 PALLET입니다.</p><div class=\"forkGrid\"><article class=\"forkCard\"><h3>화물 엘리베이터</h3><div class=\"forkElevators\">'+elevatorHtml+'</div><p class=\"forkNote\">2층 지게차가 제때 반출하지 않으면 8/8 FULL이 되고 1층 투입이 막힙니다.</p></article><article class=\"forkCard\"><h3>작업 도구</h3><div class=\"forkActions\"><button class=\"primary\" id=\"forkRack\">▦ 랙 보기 · 20,000 SLOT</button><button disabled>지게차 탑승 · 다음 구현</button><button disabled>엘리베이터 투입 · 다음 구현</button></div></article></div></section></main>';",
    "document.getElementById('forkBack').onclick=()=>go('/logistics');",
    "document.getElementById('forkRack').onclick=()=>RackViewer.open({floor:'2F'});",
    "}",
    ""
  ].join('\n');
  s = s.replace('function route(){', forklift + 'function route(){');
}

// Route to forklift page.
s = s.replace(
  "else if(p==='/logistics/inspection')sim=new Inspection();else shell",
  "else if(p==='/logistics/inspection')sim=new Inspection();else if(p==='/logistics/forklift')forklift();else shell"
);

// Shared rack button in inspection tools.
const oldTools = '<button id="printer" disabled><b>3</b> 라벨 프린터</button></div>';
const newTools = '<button id="printer" disabled><b>3</b> 라벨 프린터</button><button id="rackBtn" class="rackLaunch"><b>4</b> 랙 보기</button></div>';
if (!s.includes('id="rackBtn"')) s = s.replace(oldTools, newTools);

// Cache rack button DOM node.
s = s.replace(
  "'pdaBtn','printer','pda'",
  "'pdaBtn','printer','rackBtn','pda'"
);

// Bind rack button alongside PDA controls.
const bindNeedle = "this.pdaBtn.onclick=()=>{if(this.scanned()<this.s.pallets.length)return;this.s.pda=!this.s.pda;if(this.s.pda&&document.pointerLockElement)document.exitPointerLock();this.ui()}";
if (!s.includes('this.rackBtn.onclick')) {
  s = s.replace(
    bindNeedle,
    bindNeedle + ";this.rackBtn.onclick=()=>{if(document.pointerLockElement)document.exitPointerLock();RackViewer.open({floor:'1F',row:3,col:12})}"
  );
}

fs.writeFileSync(path, s);
console.log('Rack viewer injected into index.html');
