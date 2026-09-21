(function(){
'use strict';

/* ===== 포털 연동 (이름·학번·랭킹) =====
   집 안의 다른 게임과 같은 방식이다. shared/halomath-*.js가 실제 일을 하고
   여기서는 부르기만 한다. Firebase가 없거나 막혀도 게임은 그대로 돌아가야 한다. */
var firebaseConfig=(window.ENV&&window.ENV.FIREBASE_CONFIG)||null;
var firebaseDb=null;
var firebaseAuth=null;
if(window.firebase&&firebaseConfig&&firebaseConfig.apiKey){
  try{
    if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
    firebaseDb=firebase.database();
    if(firebase.auth)firebaseAuth=firebase.auth();
  }catch(err){console.error('Firebase init failed:',err)}
}
/* 관리자 미리보기만 허용. 포털 관리자 로그인 중이거나 이메일 계정이 있을 때만. */
function hasAdminPreviewAccess(){
  try{if(localStorage.getItem('halomath_admin_preview')==='1')return true}catch(e){}
  var u=firebaseAuth&&firebaseAuth.currentUser;
  return !!(u&&u.email);
}
function showPreviewLocked(){
  var stage=document.getElementById('stage');
  if(!stage)return;
  stage.style.visibility='visible';
  stage.innerHTML='<div class="intro" style="max-width:420px;margin:12vh auto;text-align:center;padding:28px">'
    +'<div class="big">🥖</div>'
    +'<h1>냥셰프의 빵집</h1>'
    +'<div class="sub" style="margin-top:12px;line-height:1.5">이 게임은 아직 준비 중이에요.</div>'
    +'</div>';
}
function gateAdminPreview(then){
  var stage=document.getElementById('stage');
  if(stage)stage.style.visibility='hidden';
  function pass(){
    if(hasAdminPreviewAccess()){
      if(stage)stage.style.visibility='visible';
      then();
    }else showPreviewLocked();
  }
  if(firebaseAuth){
    var done=false;
    var unsub=firebaseAuth.onAuthStateChanged(function(){
      if(done)return;done=true;try{unsub()}catch(e){}
      pass();
    });
    setTimeout(function(){if(done)return;done=true;try{unsub()}catch(e){}pass()},2500);
  }else pass();
}
var GAME_ID='similar-kitchen';
var GAME_IDS=['similar-kitchen','nyang-bakery','similar_kitchen'];
var activeMode=(window.HalomathMode&&HalomathMode.detectActiveMode())||'dorms';
function sanitize(s,max){
  if(typeof s!=='string')return '';
  return s.replace(/[<>'"/]/g,'').trim().slice(0,max||12);
}
function esc(s){
  if(s===null||s===undefined)return '';
  return String(s).replace(/[&<>"']/g,function(m){
    return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
}
function randomDormsNick(){
  var p=['도름','별빛','반짝','똑똑','신난','고냥','빙수','프리즘','냥셰프'];
  return sanitize(p[Math.floor(Math.random()*p.length)]+String(Math.floor(10+Math.random()*90)),12);
}
var playerName=sanitize((window.HalomathProfile&&HalomathProfile.loadName(activeMode))||'',12);
var studentId=activeMode==='school'?sanitize((window.HalomathProfile&&HalomathProfile.loadStudentId(activeMode))||'',10):'';
if(activeMode==='dorms'&&(!playerName||playerName==='도전자')){
  playerName=randomDormsNick();
  if(window.HalomathProfile)HalomathProfile.saveName(activeMode,playerName);
}
/* ===== 설정 ===== */
var SLOTS=3,BEAT=0.7,WRONG_COST=5,BASE_R=16,PAT_BONUS=0.3,GIANT_MULT=1.5,ROUND_T=70,COMBO_BONUS=20,LAST_ROUND=4;
/* 라운드 종료 N초 전부터는 손님이 한 명이라도 있으면 새 손님을 받지 않는다.
   빈자리만 남은 경우에는 그래도 한 명 받아, 마감 직전에 손님이 텅 비지 않게 한다 */
var SPAWN_LOCK=18;
/* 오븐 집중 모드 동안 손님 인내심(대기)이 흐르는 배율. 1이면 평소와 같고, 작을수록 느리게 기다린다 */
var PATIENCE_SLOW=0.35;
var ANIMALS=[
  ['🦁','사자','cust-lion'],['🐯','호랑이','cust-tiger'],['🦛','하마','cust-hippo'],
  ['🐘','코끼리','cust-elephant'],['🦒','기린','cust-giraffe'],['🦏','코뿔소','cust-rhino'],['🐻','곰','cust-bear']
];
var DISHES=[
  {name:'냥 바게트',ing:'반죽',ico:'🥖',dim:1,max:15,tile:'#e8a94f',edge:'#b8742a',raw:'#f6e6c8',rawEdge:'#dcc08e',unit:'개',price:0,unlockR:1,up:[70,140],lvDesc:['','','깨를 솔솔 뿌린 바게트','윤기 나는 황금 바게트']},
  {name:'냥 토스트',ing:'식빵',ico:'🍞',dim:2,max:120,tile:'#ffd24a',edge:'#e0a800',raw:'#f6e8b8',rawEdge:'#d8c48a',unit:'개',price:60,unlockR:2,up:[85,160],lvDesc:['','','버터를 올린 토스트','딸기잼 토스트']},
  {name:'냥 케이크',ing:'스펀지',ico:'🍰',dim:3,max:130,tile:'#ff8fb1',edge:'#e0507c',raw:'#ffdbe6',rawEdge:'#e8b4c6',unit:'개',price:120,unlockR:3,up:[100,190],lvDesc:['','','딸기 케이크','초콜릿 케이크']}
];
var LVMULT=[0,1,1.5,2.2];
var OVEN=[null,{taps:5,name:'기본 오븐',cost:0,desc:'5번 탭'},{taps:3,name:'벽돌 오븐',cost:75,desc:'3번만 탭!'},{taps:2,name:'황금 오븐',cost:150,desc:'2번만 탭!'}];
var BAGS=[1,5,10,50,100],BAGCOST={1:0,5:25,10:50,50:95,100:150};
/* 빵마다 실제로 쓰는 칩만 노출 (바게트 최대 N=12 → 50·100 제외) */
var DISH_BAGS=[[1,5,10],[1,5,10,50,100],[1,5,10,50,100]];
var PAL=[null,{rim:'#c98a4b',base:'#f6e3b5',tile:'#ffd24a',edge:'#e0a800',dot:'#f0b800',dash:'rgba(160,110,60,.55)'},null];
/* 주문 배율 후보 [배율, 이 라운드부터] */
var POOL=[
  [[2,1],[3,1],[4,1],[5,1],[6,2],[7,2]],
  [[2,1],[3,1],[4,1],[5,2],[6,3]],
  [[2,1],[2,1],[2,1],[3,1],[3,2],[4,3]]
];
var GIANT=[[10,12],[8,10],[5]];             // 자이언트 손님이 시키는 배율
var GIANT_AT={2:[32],3:[30],4:[22,50]};     // 라운드별 자이언트 등장 시각(초)
var clock=function(){return performance.now()};
var $=function(id){return document.getElementById(id)};
/* 손가락은 마우스보다 많이 흔들린다. 탭이 드래그로 잘못 읽히지 않게 여유를 준다 */
var COARSE=(function(){try{return matchMedia('(pointer: coarse)').matches}catch(e){return false}})();
var DRAG_SLOP=COARSE?18:10;

/* ===== 소리 =====
   음원 파일 없이 WebAudio로 그때그때 만든다. 「단일 HTML 유지」 규칙을 지키려는 것이다.
   교실에서 태블릿 여러 대가 동시에 울리면 시끄러우니 끄는 버튼을 두고 선택을 기억한다. */
var SND={on:true,ctx:null,master:null};
try{SND.on=localStorage.getItem('nyang.sound')!=='off'}catch(e){}
function audioMake(){
  if(SND.ctx)return true;
  var AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return false;
  try{
    SND.ctx=new AC();
    SND.master=SND.ctx.createGain();SND.master.gain.value=0.22;
    SND.master.connect(SND.ctx.destination);
  }catch(e){SND.ctx=null;return false}
  return true;
}
/* iOS·안드로이드는 학생이 화면을 처음 만지기 전에는 소리를 내주지 않는다 */
function audioUnlock(){
  if(!audioMake())return;
  if(SND.ctx.state==='suspended')try{SND.ctx.resume()}catch(e){}
}
function audioLive(){return !!(SND.on&&SND.ctx&&SND.ctx.state==='running')}
function tone(f,at,dur,type,vol,f2){
  if(!audioLive())return;
  var c=SND.ctx,t=c.currentTime+at,o=c.createOscillator(),g=c.createGain();
  o.type=type||'sine';o.frequency.setValueAtTime(f,t);
  if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vol||0.4,t+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g);g.connect(SND.master);o.start(t);o.stop(t+dur+0.03);
}
function run(list,type,vol,step,dur){
  list.forEach(function(f,i){tone(f,i*(step||0.07),dur||0.18,type||'triangle',vol||0.4)});
}
var SFX={
  tap:function(){tone(640,0,0.08,'sine',0.3,760)},
  bag:function(){tone(420,0,0.1,'sine',0.3,640)},
  perfect:function(){tone(880,0,0.1,'triangle',0.5);tone(1320,0.06,0.15,'triangle',0.42)},
  good:function(){tone(740,0,0.12,'triangle',0.4)},
  miss:function(){tone(210,0,0.17,'sawtooth',0.26,120)},
  done:function(){run([523,659,784],'triangle',0.42,0.07,0.17)},
  serve:function(){run([659,784,988,1319],'triangle',0.4,0.062,0.2)},
  giant:function(){run([392,523,659,784,1047],'triangle',0.46,0.07,0.26);tone(196,0,0.5,'sine',0.3)},
  fail:function(){tone(330,0,0.15,'square',0.26);tone(247,0.11,0.22,'square',0.24)},
  coin:function(){tone(988,0,0.06,'square',0.22);tone(1319,0.055,0.11,'square',0.2)},
  buy:function(){run([784,1047,1319,1568],'triangle',0.36,0.055,0.16)},
  arrive:function(){tone(784,0,0.15,'sine',0.32);tone(587,0.13,0.2,'sine',0.3)},
  giantIn:function(){tone(147,0,0.3,'sawtooth',0.3);tone(220,0.16,0.3,'square',0.26)},
  angry:function(){tone(196,0,0.26,'sawtooth',0.26,98)},
  combo:function(){run([784,988,1175,1568,1976],'triangle',0.42,0.055,0.2)},
  warn:function(){tone(880,0,0.09,'square',0.2);tone(880,0.15,0.09,'square',0.2)},
  trash:function(){tone(160,0,0.14,'sawtooth',0.22,90)},
  roundEnd:function(){run([523,659,784,1047,1319],'triangle',0.42,0.09,0.28)}
};
function sfx(n){if(!audioLive())return;var f=SFX[n];if(f)try{f()}catch(e){}}
function sndSync(){$('sndBtn').textContent=SND.on?'🔊':'🔇'}

/* ===== 연출 ===== */
var flos=[];
/* 무대 안에서의 위치. 화면 사각형이 아니라 offset으로 잰다.
   사각형은 무대의 확대·회전이 이미 반영된 값이라, 그걸로 역산하면 돌렸을 때 어긋난다.
   offset은 변환과 무관한 배치 좌표라 어느 경우에나 맞는다. */
function stageXY(el){
  var x=el.offsetWidth/2,y=el.offsetHeight/2,n=el;
  while(n&&n!==stage){x+=n.offsetLeft;y+=n.offsetTop;n=n.offsetParent}
  return{x:x,y:y};
}
function fxDrop(d){
  var i=flos.indexOf(d);if(i>=0)flos.splice(i,1);
  if(d.parentNode)d.parentNode.removeChild(d);
}
/* animationend만 믿으면 안 된다. 화면이 바뀌거나 한꺼번에 많이 생기면 오지 않는다 */
function fxAdd(d){
  stage.appendChild(d);flos.push(d);
  while(flos.length>24)fxDrop(flos[0]);
  d.addEventListener('animationend',function(){fxDrop(d)});
  setTimeout(function(){fxDrop(d)},1600);
}
function fxClear(){while(flos.length)fxDrop(flos[0])}
function floatText(x,y,txt,cls){
  var d=document.createElement('div');
  d.className='flo '+(cls||'coin');d.textContent=txt;
  d.style.left=x+'px';d.style.top=y+'px';
  fxAdd(d);
}
function floatAtSlot(i,txt,cls){
  var el=slotEls[i];if(!el)return;
  var p=stageXY(el);floatText(p.x,p.y+12,txt,cls);
}
function comboBanner(txt){
  var d=document.createElement('div');d.className='combo';d.textContent=txt;
  fxAdd(d);
}
function bumpCoins(){var c=$('coinsTxt');c.classList.remove('bump');void c.offsetWidth;c.classList.add('bump')}
var shake={until:0,mag:0};
function doShake(mag,ms){shake.mag=mag;shake.until=performance.now()+ms}

/* ===== 랜덤 (학생마다 다른 주문) ===== */
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
var seedParam=(function(){try{return new URLSearchParams(location.search).get('seed')}catch(e){return null}})();
var rnd=mulberry(seedParam?parseInt(seedParam,10)||1:(Math.random()*4294967296)>>>0);
function pick(a){return a[Math.floor(rnd()*a.length)]}
function needOf(dish,k){return Math.pow(k,DISHES[dish].dim)}
function baseOf(dish,k){return BASE_R*Math.sqrt(needOf(dish,k))}

/* ===== 상태 ===== */
var G={},S={};
function resetG(){
  G={round:1,wallet:0,earned:0,log:[],first:true,hintOn:true,
     u:{oven:1,bag:{1:1},dish:{0:1}},wrongAll:{wrongDish:0,notSimilar:0,wrongSize:0,raw:0},trashedAll:0,wastedAll:0,servedAll:0,leftAll:0};
}
resetG();
function LV(t){return (G.u&&G.u.dish[t])||0}
function owned(t){return LV(t)>0}
function ovenIdle(){return{dish:null,state:'idle',t0:0,n:0,need:OVEN[G.u.oven].taps,grades:[],last:null}}
function earn(v){G.wallet+=v;G.earned+=v}
function pay(v){G.wallet=Math.max(0,G.wallet-v);G.earned=Math.max(0,G.earned-v)}
function newRound(r){
  S={phase:'play',round:r,time:0,cust:[],nid:0,bench:null,oven:ovenIdle(),sel:null,
     reward:0,patience:0,combo:0,streak:0,served:0,penalty:0,left:0,qs:[],
     wrong:{wrongDish:0,notSimilar:0,wrongSize:0,raw:0},trashed:0,wasted:0,
     guide:false,hover:-1,roundT:ROUND_T,nextAt:2,giants:(GIANT_AT[r]||[]).slice(),lastKey:'',warned:false};
}
window.__S=function(){return S};window.__G=function(){return G};

/* 손님 만들기 */
function makeCust(giant){
  var own=[];DISHES.forEach(function(d,i){if(owned(i))own.push(i)});
  var dish,k,tries;
  if(giant){dish=pick(own);k=pick(GIANT[dish])}
  else{
    var bag=[];own.forEach(function(i){var w=(i===own[own.length-1]&&own.length>1)?2:1;for(var j=0;j<w;j++)bag.push(i)});
    for(tries=0;tries<30;tries++){
      dish=pick(bag);
      var ks=POOL[dish].filter(function(p){return p[1]<=S.round}).map(function(p){return p[0]});
      k=pick(ks);if(dish+':'+k!==S.lastKey)break;
    }
    if(G.first){dish=0;k=pick([2,3]);G.first=false}
  }
  S.lastKey=dish+':'+k;
  var N=needOf(dish,k),an=pick(ANIMALS);
  var pat=giant?Math.min(95,Math.round(60+4*Math.sqrt(N))):Math.round(44+7*Math.sqrt(N));
  return{id:S.nid++,k:k,dish:dish,giant:!!giant,N:N,pat:pat,fails:0,state:'wait',wait:0,slot:-1,until:0,
         an:an[0],anName:an[1],spr:an[2]||'',got:null,gotUntil:0,mood:''};
}
function freeSeat(){
  var used={};S.cust.forEach(function(c){if(c.slot>=0&&c.state!=='gone')used[c.slot]=true});
  for(var i=0;i<SLOTS;i++)if(!used[i])return i;return -1;
}
function liveCustCount(){
  var n=0;S.cust.forEach(function(c){if(c.state!=='gone')n++});return n;
}
/* 마감 임박에는 손님이 남아 있으면 더 받지 않는다. 텅 비었을 때만 예외 */
function canSpawnMore(){
  if(S.roundT-S.time>SPAWN_LOCK)return true;
  return liveCustCount()===0;
}
/* 구운 빵은 도마로 돌아온다. 도마에 구운 빵이 있는 동안은 재료를 더 얹을 수 없다 */
function benchBaked(){return !!(S&&S.bench&&S.bench.cooked)}
function warnBaked(){toast('🍞 구운 빵이에요! 손님에게 끌어다 주거나 🗑️에 버려 주세요',1800)}
function isOvenFocus(){return !!(S&&S.oven&&S.oven.state==='cooking')}
function spawn(giant){
  var seat=freeSeat();if(seat<0)return null;
  if(!canSpawnMore())return null;
  var c=makeCust(giant);c.slot=seat;S.cust.push(c);
  S.nextAt=S.time+8+rnd()*4;
  sfx(giant?'giantIn':'arrive');
  if(giant)doShake(6,420);
  toast(giant?'👑 자이언트 '+c.anName+'이(가) 나타났어요!':'🔔 '+c.anName+' 손님이 왔어요!',1300);
  return c;
}

var toastT=null;
function toast(msg,ms){
  var t=$('toast');
  /* 손님 줄 바로 아래에 띄운다. 기기마다 화면이 줄어드는 비율이 달라 고정값을 쓸 수 없다 */
  var r=$('custRow').getBoundingClientRect();
  /* 토스트는 돌아간 좌표계 안에 있으므로, 화면 사각형을 게임 좌표로 바꿔서 얹는다 */
  if(r.height){var p=toGame(r.left+r.width/2,r.bottom);t.style.top=Math.round(p.y+8)+'px'}
  t.textContent=msg;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('on')},ms||1900);
}
function show(id){$('toast').classList.remove('on');['intro','play','roundEnd','result'].forEach(function(s){$(s).classList.toggle('on',s===id)})}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function rr(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}


/* ===== 접시 모양 (재료 n개 → 도형) ===== */
function cbrtCeil(n){var s=1;while(s*s*s<n)s++;return s}
function refresh(d){
  var dim=DISHES[d.type].dim,n=d.n,i;
  d.cells=[];
  if(dim===1){d.w=Math.max(1,n);d.h=1;for(i=0;i<d.w;i++)d.cells.push(i<n)}
  else if(dim===2){
    d.w=n<=0?1:Math.ceil(Math.sqrt(n));d.h=n<=0?1:Math.ceil(n/d.w);
    for(i=0;i<d.w*d.h;i++)d.cells.push(i<n);
  }else{
    d.s=n<=0?1:cbrtCeil(n);d.L=n<=0?1:Math.ceil(n/(d.s*d.s));d.w=d.s;d.h=d.L;
    for(i=0;i<d.s*d.s*d.L;i++)d.cells.push(i<n);
  }
}
function newDish(type,n){var d={type:type,n:n||0,cooked:false,quality:1};refresh(d);return d}
function isSimilar(d){
  var dim=DISHES[d.type].dim;
  if(d.n<=0)return false;
  if(dim===1)return true;
  if(dim===2)return d.w===d.h&&d.n===d.w*d.h;
  return d.s===d.L&&d.n===d.s*d.s*d.s;
}
function fitCell(d,mw,mh,cap){
  var dim=DISHES[d.type].dim,c;
  if(piecesOn(d)){
    var e=pieceExt(d,1),cc=Math.min(cap,mw/e.w,mh/e.h);
    if(dim===1){ /* 한 줄 : 덩어리 폭이 최소 9px라서 줄이 길 때만 계산이 달라진다 */
      var P0=PIECE[d.type];cc=Math.min(cap,mw/(d.w-1+P0.wk),mh/(P0.wk*P0.hr));
      if(cc*P0.wk<9&&d.w>1)cc=Math.min(cc,(mw-9)/(d.w-1));
    }
    return Math.max(1.5,Math.floor(cc*4)/4);
  }
  if(dim===1)c=Math.min(mw/(d.w+0.5),mh/1.6);
  else if(dim===2)c=Math.min(mw/d.w,mh/(1.36*d.h));
  else c=Math.min(mh/(d.s+d.L+0.4),mw/(1.75*d.s+0.2));
  return Math.max(4,Math.floor(Math.min(cap,c)));
}
function dishBox(d,cell,cx,baseY){
  var dim=DISHES[d.type].dim,w,h;
  if(piecesOn(d)){var e=pieceExt(d,cell);return{x:cx-e.w/2,y:baseY-e.h,w:e.w,h:e.h}}
  if(dim===1){w=d.w*cell+12;h=cell*1.2}
  else if(dim===2){w=d.w*cell;h=d.h*cell*1.3}
  else{w=1.75*d.s*cell;h=(d.s+d.L)*cell}
  return{x:cx-w/2,y:baseY-h,w:w,h:h};
}


/* ===== 조각 그림으로 쌓기 =====
   assets/piece-*.png (투명 PNG)가 있으면 도마 위 빵을 그 그림으로 쌓는다. 없으면 아래의 코드 그림으로 돌아간다.
   · 반죽(바게트) : 한 줄로 이어진 덩어리  · 식빵 : 마름모 판을 바둑판처럼  · 스펀지 : 큐브를 가로·세로·층으로
   구운 그림(full)은 날것(raw)과 「아랫가운데」를 맞춰 겹쳐 그린다. 그래서 구운 그림 파일만 바꿔 끼워도 된다.
   rT = 윗면 마름모의 높이/폭, tk = 식빵 두께/폭, eg = 큐브 옆면 높이/폭, hr = 반죽 높이/폭 (그림에서 잰 값) */
var PIECE=[
  {raw:'piece-dough-raw',full:'piece-dough-baked',wk:1.1,hr:0.778},
  {raw:'piece-toast-raw',full:'piece-toast-baked',wk:1.5,rT:0.505,tk:0.139},
  {raw:'piece-sponge-raw',full:'piece-sponge-baked',wk:1.732,rT:0.4575,eg:0.564}
];
function piecesOn(d){var P=PIECE[d.type];return !!(P&&SPRITE_READY&&SPRITE_READY[P.raw]&&SPRITE_READY[P.full])}
/* cell = 조각 하나의 기준 크기. 전체 폭·높이는 조각 수(d.w·d.h·d.s·d.L)로 정해진다 */
function pieceExt(d,cell){
  var dim=DISHES[d.type].dim,P=PIECE[d.type],W=cell*P.wk;
  if(dim===1)W=Math.max(W,9); /* 개수가 많아 칸이 좁아져도 덩어리가 보이게 : 서로 겹쳐 이어진다 */
  if(dim===1)return{W:W,w:(d.w-1)*cell+W,h:W*P.hr};
  if(dim===2)return{W:W,w:(d.w+d.h)/2*W,h:W*((d.w+d.h)/2*P.rT+P.tk)};
  return{W:W,w:d.s*W,h:W*(d.s*P.rT+d.L*P.eg)};
}
/* 큰 그림을 작게 그리면 거칠어지므로, 목표 크기 근처까지 반씩 줄인 그림을 만들어 둔다 */
var PC_CACHE={},PC_N=0;
function pieceImg(name,w){
  var src=sprite(name);
  if(w>=src.width*0.9)return src;
  var b=Math.max(4,Math.ceil(w/6)*6),k=name+'|'+b,hit=PC_CACHE[k];if(hit)return hit;
  var cv=src,cw=src.width,ch=src.height;
  while(cw>b){
    var nw=cw/2>=b?Math.round(cw/2):b,nh=Math.max(1,Math.round(ch*nw/cw)),t=document.createElement('canvas');
    t.width=nw;t.height=nh;var g=t.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(cv,0,0,nw,nh);
    cv=t;cw=nw;ch=nh;
  }
  if(PC_N>120){PC_CACHE={};PC_N=0}
  PC_CACHE[k]=cv;PC_N++;return cv;
}
/* 조각 하나를 「아랫가운데」(bx,by)에 맞춰 폭 W로 그린다 */
function blitPiece(c,name,W,bx,by){
  var src=sprite(name),sc=1;
  try{sc=Math.abs(c.getTransform().a)||1}catch(e){}
  var im=pieceImg(name,W*sc),H=W*src.height/src.width;
  c.drawImage(im,bx-W/2,by-H,W,H);
}
function dashRhomb(c,px,py,W,dT){ /* 비어 있는 자리 : 점선 마름모(위 꼭짓점 = px,py) */
  var k=0.92,x=W/2*k,y=dT/2*k,cy=py+dT/2;
  c.save();c.setLineDash([4,3]);c.strokeStyle='rgba(180,150,100,.5)';c.lineWidth=1.5;c.lineJoin='round';
  c.beginPath();c.moveTo(px,cy-y);c.lineTo(px+x,cy);c.lineTo(px,cy+y);c.lineTo(px-x,cy);c.closePath();c.stroke();c.restore();
}
function drawPieces(c,cx,baseY,cell,d,full){
  var dim=DISHES[d.type].dim,P=PIECE[d.type],e=pieceExt(d,cell),W=e.W,name=full?P.full:P.raw,i,j,l;
  if(dim===1){
    var x0=cx-e.w/2+W/2;
    for(i=0;i<d.w;i++){
      if(i<d.n)blitPiece(c,name,W,x0+i*cell,baseY);
      else if(d.n===0&&i===0){c.save();c.setLineDash([4,3]);c.strokeStyle='rgba(180,150,100,.5)';c.lineWidth=1.5;c.beginPath();c.ellipse(x0,baseY-W*P.hr/2,W*0.45,W*P.hr*0.4,0,0,7);c.stroke();c.restore()}
    }
    return;
  }
  if(dim===2){
    var ox=cx-(d.w-d.h)*W/4,y0=baseY-e.h,dT=P.rT*W,Hr=(P.rT+P.tk)*W;
    for(j=0;j<d.h;j++)for(i=0;i<d.w;i++){
      var px=ox+(i-j)*W/2,py=y0+(i+j)*dT/2;
      if(d.cells[j*d.w+i])blitPiece(c,name,W,px,py+Hr);else dashRhomb(c,px,py,W,dT);
    }
    return;
  }
  var s=d.s,L=d.L,n=d.n,dT2=P.rT*W,eg=P.eg*W,ox2=cx,y02=baseY-e.h;
  if(n<=0){dashRhomb(c,ox2,baseY-dT2,W,dT2);return}
  for(l=0;l<L;l++)for(j=0;j<s;j++)for(i=0;i<s;i++){
    if(l*s*s+j*s+i>=n)continue;
    var qx=ox2+(i-j)*W/2,top=y02+(i+j)*dT2/2+(L-1-l)*eg;
    blitPiece(c,name,W,qx,top+dT2+eg);
  }
}

/* ===== 그리기 ===== */
function drawPizza(c,x,y,w,h,o){  // 토스트(네모난 빵) : 귀 + 고양이 얼굴
  o=o||{};var pal=Object.assign({},PAL[1]),LV1=LV(1);if(LV1>=3){pal.rim='#8f5a24';pal.tile='#ffdf6e'}
  var m=Math.min(w,h),lw=Math.max(1.5,m*0.035),ew=w*0.3,eh=Math.min(h*0.32,w*0.42);
  c.lineJoin='round';c.lineWidth=lw;c.fillStyle='#c98a4b';c.strokeStyle='#8a5a2b';
  [0.05,0.65].forEach(function(px){c.beginPath();c.moveTo(x+w*px,y+2);c.lineTo(x+w*px+ew/2,y-eh);c.lineTo(x+w*px+ew,y+2);c.closePath();c.fill();c.stroke()});
  rr(c,x,y,w,h,m*0.12);c.fillStyle=pal.rim;c.fill();c.stroke();
  var p=m*0.07,gx=x+p,gy=y+p,gw=w-2*p,gh=h-2*p;
  rr(c,gx,gy,gw,gh,m*0.08);c.fillStyle=pal.base;c.fill();
  /* 윗면 하이라이트 — 납작한 그림체에 약한 빛만 */
  var hg=c.createLinearGradient(gx,gy,gx,gy+gh*0.35);
  hg.addColorStop(0,'rgba(255,255,255,.28)');hg.addColorStop(1,'rgba(255,255,255,0)');
  rr(c,gx,gy,gw,gh*0.35,m*0.08);c.fillStyle=hg;c.fill();
  var cols=o.cols||1,rows=o.rows||1;
  if(o.grid){
    var cw=gw/cols,ch=gh/rows;
    for(var r=0;r<rows;r++)for(var q=0;q<cols;q++){
      var cx=gx+q*cw,cy=gy+r*ch,on=o.cells&&o.cells[r*cols+q];
      if(on){
        rr(c,cx+1.5,cy+1.5,cw-3,ch-3,Math.min(cw,ch)*0.14);c.fillStyle=pal.tile;c.fill();
        c.strokeStyle=pal.edge;c.lineWidth=Math.min(2,Math.max(1,cw*0.05));c.stroke();c.fillStyle=pal.dot;
        c.beginPath();c.arc(cx+cw*0.3,cy+ch*0.35,Math.min(cw,ch)*0.07,0,7);c.fill();
        c.beginPath();c.arc(cx+cw*0.66,cy+ch*0.62,Math.min(cw,ch)*0.06,0,7);c.fill();
        if(LV1>=2){c.fillStyle='#fff3a8';rr(c,cx+cw*0.52,cy+ch*0.14,cw*0.32,ch*0.22,2);c.fill();c.fillStyle=pal.dot}
        if(LV1>=3){c.fillStyle='#e0304f';c.beginPath();c.arc(cx+cw*0.3,cy+ch*0.7,Math.min(cw,ch)*0.11,0,7);c.fill();c.fillStyle=pal.dot}
      }else{
        c.setLineDash([4,3]);c.strokeStyle=pal.dash;c.lineWidth=1.5;
        rr(c,cx+2,cy+2,cw-4,ch-4,Math.min(cw,ch)*0.12);c.stroke();c.setLineDash([]);
      }
    }
  }
  [0.3,0.7].forEach(function(f){
    c.beginPath();c.ellipse(x+w*f,y+h*0.38,m*0.055*(w/m),m*0.055*(h/m),0,0,7);
    c.fillStyle='#3b2a1a';c.fill();c.strokeStyle='rgba(255,255,255,.85)';c.lineWidth=Math.max(1,lw*0.6);c.stroke();
  });
  c.beginPath();c.moveTo(x+w*0.46,y+h*0.55);c.lineTo(x+w*0.54,y+h*0.55);c.lineTo(x+w*0.5,y+h*0.6);c.closePath();
  c.fillStyle='#ff8fa6';c.fill();c.strokeStyle='#3b2a1a';c.lineWidth=Math.max(1,lw*0.5);c.stroke();
  c.strokeStyle='rgba(59,42,26,.8)';c.lineWidth=Math.max(1,lw*0.5);
  [[-1,-0.02],[-1,0.03],[1,-0.02],[1,0.03]].forEach(function(v){
    c.beginPath();c.moveTo(x+w*(0.5+v[0]*0.09),y+h*(0.58+v[1]));c.lineTo(x+w*(0.5+v[0]*0.3),y+h*(0.56+v[1]*2));c.stroke();
  });
}
function toastFull(c,cx,baseY,cell,d){var w=d.w*cell,h=d.h*cell;drawPizza(c,cx-w/2,baseY-h,w,h,{grid:true,cols:d.w,rows:d.h,cells:d.cells})}
function toastRaw(c,cx,baseY,cell,d){
  var w=d.w*cell,h=d.h*cell,x=cx-w/2,y=baseY-h,D=DISHES[1],m=Math.min(w,h);
  rr(c,x,y,w,h,m*0.12);c.fillStyle='#fbf3e4';c.fill();c.lineWidth=Math.max(2,cell*0.06);c.strokeStyle='#cbb28a';c.stroke();
  var p=m*0.07,gx=x+p,gy=y+p,cw=(w-2*p)/d.w,ch=(h-2*p)/d.h;
  for(var rw=0;rw<d.h;rw++)for(var q=0;q<d.w;q++){
    var i=rw*d.w+q,px=gx+q*cw,py=gy+rw*ch;
    if(d.cells[i]){rr(c,px+1.5,py+1.5,cw-3,ch-3,Math.min(cw,ch)*0.14);c.fillStyle=D.raw;c.fill();c.lineWidth=Math.min(2,Math.max(1,cw*0.05));c.strokeStyle=D.rawEdge;c.stroke()}
    else{c.save();c.setLineDash([4,3]);c.strokeStyle='rgba(180,150,100,.35)';c.lineWidth=1.5;rr(c,px+2,py+2,cw-4,ch-4,Math.min(cw,ch)*0.12);c.stroke();c.restore()}
  }
}
/* 바게트 : 반죽 마디 n개가 한 줄로 */
function skewer(c,cx,baseY,cell,d,full){
  var D=DISHES[0],n=d.n,W=d.w,w=W*cell,x0=cx-w/2,y=baseY-cell,lv=LV(0);
  for(var i=0;i<W;i++){
    var px=x0+i*cell;
    if(i<n){
      rr(c,px+0.5,y+cell*0.18,cell-1,cell*0.64,cell*0.3);
      c.fillStyle=full?(lv>=3?'#cf8420':lv>=2?'#dc9a3a':D.tile):D.raw;c.fill();c.lineWidth=Math.min(2,Math.max(1,cell*0.06));c.strokeStyle=full?D.edge:D.rawEdge;c.stroke();
      if(full){c.strokeStyle='rgba(120,50,30,.45)';c.lineWidth=Math.max(1,cell*0.05);
        c.beginPath();c.moveTo(px+cell*0.3,y+cell*0.32);c.lineTo(px+cell*0.5,y+cell*0.68);c.moveTo(px+cell*0.5,y+cell*0.32);c.lineTo(px+cell*0.7,y+cell*0.68);c.stroke();
        if(lv>=2){c.fillStyle='#fff3d0';[[0.25,0.28],[0.62,0.26],[0.45,0.74],[0.78,0.6]].forEach(function(q){c.beginPath();c.ellipse(px+cell*q[0],y+cell*q[1],Math.max(1,cell*0.05),Math.max(1,cell*0.035),0.6,0,7);c.fill()})}
        if(lv>=3){c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=Math.max(1.5,cell*0.07);c.beginPath();c.moveTo(px+cell*0.2,y+cell*0.24);c.lineTo(px+cell*0.8,y+cell*0.24);c.stroke()}}
    }else if(n===0&&i===0){
      c.save();c.setLineDash([4,3]);c.strokeStyle='rgba(180,150,100,.5)';c.lineWidth=1.5;rr(c,px+2,y+2,cell-4,cell-4,cell*0.2);c.stroke();c.restore();
    }
  }
  if(full&&n>0){ // 첫 조각 : 고양이 귀와 얼굴
    var m=Math.max(cell,10);
    c.fillStyle=D.tile;c.strokeStyle=D.edge;c.lineWidth=Math.max(1,cell*0.05);
    [[0.12,0.42],[0.58,0.88]].forEach(function(v){c.beginPath();c.moveTo(x0+m*v[0],y+cell*0.2);c.lineTo(x0+m*(v[0]+v[1])/2,y-m*0.15);c.lineTo(x0+m*v[1],y+cell*0.2);c.closePath();c.fill();c.stroke()});
    c.fillStyle='#3b2a1a';c.beginPath();c.arc(x0+m*0.32,y+m*0.42,Math.max(1,m*0.06),0,7);c.fill();c.beginPath();c.arc(x0+m*0.68,y+m*0.42,Math.max(1,m*0.06),0,7);c.fill();
    c.fillStyle='#ff8fa6';c.beginPath();c.moveTo(x0+m*0.46,y+m*0.58);c.lineTo(x0+m*0.54,y+m*0.58);c.lineTo(x0+m*0.5,y+m*0.65);c.closePath();c.fill();
  }
}
/* 케이크 : 밑면 s×s, L층으로 쌓이는 상자 */
function cake(c,cx,baseY,a,d,full){
  if(piecesOn(d)){drawPieces(c,cx,baseY,a,d,full);return}
  var D=DISHES[2],s=d.s,L=d.L,n=d.n,ox=cx,oy=baseY-s*a,ex=[0.866*a,0.5*a],ey=[-0.866*a,0.5*a],ez=[0,-a];
  function V(u,v,w){return[ox+u*ex[0]+v*ey[0]+w*ez[0],oy+u*ex[1]+v*ey[1]+w*ez[1]]}
  function poly(pts,fill,stroke){c.beginPath();pts.forEach(function(p,i){i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1])});c.closePath();c.fillStyle=fill;c.fill();c.lineWidth=Math.max(1,a*0.06);c.strokeStyle=stroke;c.lineJoin='round';c.stroke()}
  var top=full?'#fff0d6':'#ffeef3',lf=full?'#f2c08e':'#f6d6e0',rt=full?'#dca06a':'#eab9cc',ed=full?'#a8703e':D.rawEdge;
  var LC=LV(2);if(full&&LC>=3){top='#6b3b24';lf='#8a4a2c';rt='#70391f';ed='#3d2012'}else if(full&&LC>=2){top='#fff8f2'}
  if(n<=0){
    c.save();c.setLineDash([4,3]);c.strokeStyle='rgba(180,150,100,.6)';c.lineWidth=1.5;
    c.beginPath();[V(0,0,0),V(1,0,0),V(1,1,0),V(0,1,0)].forEach(function(p,i){i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1])});c.closePath();c.stroke();c.restore();return;
  }
  for(var l=0;l<L;l++)for(var j=0;j<s;j++)for(var i=0;i<s;i++){
    var idx=l*s*s+j*s+i;if(idx>=n)continue;
    poly([V(i,j+1,l),V(i+1,j+1,l),V(i+1,j+1,l+1),V(i,j+1,l+1)],lf,ed);
    poly([V(i+1,j,l),V(i+1,j+1,l),V(i+1,j+1,l+1),V(i+1,j,l+1)],rt,ed);
    poly([V(i,j,l+1),V(i+1,j,l+1),V(i+1,j+1,l+1),V(i,j+1,l+1)],top,ed);
    if(full&&LC>=2&&(l===L-1||idx+s*s>=n)){var p=V(i+0.5,j+0.5,l+1);c.fillStyle=LC>=3?'#ffd24a':'#ff5c8a';c.beginPath();c.arc(p[0],p[1],Math.max(1.5,a*0.16),0,7);c.fill()}
  }
  if(full){ // 앞쪽 면에 고양이 얼굴
    var f=V(0.5,s,Math.min(L,s)*0.5-0.0),fx=f[0]-a*0.25,fy=f[1]-a*0.1;
    if(a>=9){c.fillStyle='#3b2a1a';c.beginPath();c.arc(fx-a*0.22,fy,Math.max(1,a*0.07),0,7);c.fill();c.beginPath();c.arc(fx+a*0.22,fy,Math.max(1,a*0.07),0,7);c.fill()}
  }
}
function drawRawOrFull(c,cx,baseY,cell,d,full){
  var dim=DISHES[d.type].dim;
  if(piecesOn(d)){drawPieces(c,cx,baseY,cell,d,full);return}
  if(dim===1)skewer(c,cx,baseY,cell,d,full);
  else if(dim===2)full?toastFull(c,cx,baseY,cell,d):toastRaw(c,cx,baseY,cell,d);
  else cake(c,cx,baseY,cell,d,full);
}
/* prog 0 = 날것, 1 = 완성 (사이는 겹쳐서 서서히 나타남) */
function drawDishState(c,cx,baseY,cell,d,prog){
  if(d.cooked)prog=1;
  if(prog<1)drawRawOrFull(c,cx,baseY,cell,d,false);
  if(prog>0){c.save();c.globalAlpha=prog;drawRawOrFull(c,cx,baseY,cell,d,true);c.restore()}
}

/* ===== 재료 선반 (가로 3열 · 개수 칩) ===== */
var dishEls=[];
var chipEls=[]; /* [dishIndex][bagSize] -> element */
(function(){
  var sh=$('shelf');
  DISHES.forEach(function(m,i){
    var b=document.createElement('div');b.className='mold';
    var bags=DISH_BAGS[i];
    var chipsHtml=bags.map(function(n){
      return '<button type="button" class="chip" data-n="'+n+'"><span class="cl">'+n+'</span><div class="ck"></div></button>';
    }).join('');
    b.innerHTML='<div class="mold-head">'
      +'<canvas width="100" height="70"></canvas>'
      +'<button type="button" class="upb"></button>'
      +'</div>'
      +'<div class="chips" style="grid-template-columns:repeat('+bags.length+',minmax(0,1fr))">'+chipsHtml+'</div>'
      +'<div class="lock"><div class="lk"></div></div>';
    b.querySelector('.mold-head').addEventListener('click',function(e){
      if(e.target.closest&&e.target.closest('.upb'))return;
      if(!owned(i))buyDish(i);else selectDish(i);
    });
    b.querySelector('.lock').addEventListener('click',function(e){
      e.stopPropagation();buyDish(i);
    });
    b.querySelector('.upb').addEventListener('click',function(e){e.stopPropagation();upDish(i)});
    chipEls[i]={};
    b.querySelectorAll('.chip').forEach(function(ch){
      var n=+ch.dataset.n;
      chipEls[i][n]=ch;
      ch.addEventListener('click',function(e){
        e.stopPropagation();
        addFromShelf(i,n);
      });
    });
    sh.appendChild(b);dishEls.push(b);
  });
})();
function renderShelf(){
  dishEls.forEach(function(el,i){
    var cv=el.querySelector('canvas'),c=cv.getContext('2d');
    var key=LV(i)+'';if(el.dataset.lv===key)return;el.dataset.lv=key;
    c.clearRect(0,0,100,70);
    var d=newDish(i,i===0?3:i===1?4:8);d.cooked=true;
    drawDishState(c,50,66,fitCell(d,90,52,i===0?24:i===1?26:18),d,1);
  });
}
/* 선반 머리 탭: 활성 빵만 표시 (개수는 칩으로) */
function selectDish(i){
  if(S.phase!=='play'||S.guide||isOvenFocus())return;
  if(!owned(i)){buyDish(i);return}
  if(benchBaked()){warnBaked();return}
  if(S.bench&&S.bench.type===i){updateAll();return}
  S.bench=newDish(i);fx=[];S.sel=null;updateAll();
  toast(sceneOven()?'👆 재료 그림을 톡해요':'👆 개수 칩을 톡해요',1200);
}
function chooseDish(i){selectDish(i)}
/* 칩 한 번 = 그 빵으로 접시 준비 + 개수 추가 */
function addFromShelf(i,n){
  if(S.phase!=='play'||S.guide||isOvenFocus())return;
  if(DISH_BAGS[i].indexOf(n)<0)return;
  if(!owned(i)){if(!buyDish(i))return}
  if(!G.u.bag[n]){buyBag(n);return}                  // 배율을 사는 것뿐, 재료는 올라가지 않는다
  if(benchBaked()){warnBaked();return}
  if(!S.bench||S.bench.type!==i){S.bench=newDish(i);fx=[];S.sel=null}
  addN(n);
}

/* ===== 재료가 날아와 쌓이는 연출 =====
   재료 그림을 누르면 그 자리에서 재료 한 개가 조리대 위로 날아가 놓인다.
   날아가는 그림은 조리대 캔버스가 아니라 무대 전체를 덮는 캔버스(flyCv)에 그린다.
   조리대 캔버스는 재료 그림이 있는 곳까지 못 그려서, 출발하는 모습이 안 보이기 때문이다. */
var flyCv=$('flyCv'),fctx=flyCv.getContext('2d'),FLYW=0,FLYH=0,FLYQ=0,flyDirty=false;
var fliers=[];
function syncFly(){
  var W=stage.offsetWidth,H=stage.offsetHeight,q=VIEW.q;
  if(W!==FLYW||H!==FLYH||q!==FLYQ){FLYW=W;FLYH=H;FLYQ=q;hidpi(flyCv,W,H,q)}
}
/* 무대 안에서의 사각형. 화면 사각형이 아니라 offset으로 잰다(확대·회전과 무관하게 맞는다) */
function elRectStage(el){
  var x=0,y=0,n=el;
  while(n&&n!==stage){x+=n.offsetLeft;y+=n.offsetTop;n=n.offsetParent}
  return{x:x,y:y,w:el.offsetWidth,h:el.offsetHeight};
}
/* 조리대 캔버스 안의 점 -> 무대 좌표. object-fit:contain이라 가운데 정렬로 줄어든다 */
function benchToStage(x,y){
  var r=elRectStage(bcv),s=Math.min(r.w/BW,r.h/BH);
  return{x:r.x+(r.w-BW*s)/2+x*s,y:r.y+(r.h-BH*s)/2+y*s,s:s};
}
function launchFliers(d,can,srcEl){
  var f=Math.min(can,8),per=Math.floor(can/f),rem=can-per*f,now=performance.now();
  var cell=benchCell(d),box=dishBox(d,cell,BW/2,BBASE),dim=DISHES[d.type].dim;
  var src=elRectStage(srcEl);
  for(var i=0;i<f;i++){
    var tx,ty;
    if(dim===1){
      var idx=Math.max(0,Math.min(d.n-1,d.n-can+Math.round((i+1)*can/f)-1));
      tx=piecesOn(d)?box.x+cell*0.55+idx*cell:box.x+6+idx*cell+cell/2;ty=BBASE-cell*0.5;
    }else{
      tx=box.x+box.w*(0.2+0.6*rnd());ty=box.y+box.h*(0.35+0.5*rnd());
    }
    var to=benchToStage(tx,ty);
    fliers.push({t0:now+i*70,dur:380,sx:src.x+src.w/2,sy:src.y+src.h*0.4,tx:to.x,ty:to.y,type:d.type,
                 inc:per+(i===f-1?rem:0),dish:d,size:Math.max(24,cell*to.s*0.95)});
  }
  /* 순식간에 많이 부를 때 쌓이지 않게: 넘치는 것은 바로 도착 처리 */
  while(fliers.length>40){var o=fliers.shift();if(o.dish.shown!==undefined)o.dish.shown=Math.min(o.dish.n,o.dish.shown+o.inc)}
}
function landFliers(){
  var now=performance.now();
  for(var i=fliers.length-1;i>=0;i--){
    var f=fliers[i];
    if(f.dish!==S.bench){fliers.splice(i,1);continue}
    if(now>=f.t0+f.dur){
      f.dish.shown=Math.min(f.dish.n,(f.dish.shown||0)+f.inc);
      fliers.splice(i,1);
    }
  }
}
function renderFly(){
  if(!fliers.length){if(flyDirty){fctx.clearRect(0,0,FLYW,FLYH);flyDirty=false}return}
  fctx.clearRect(0,0,FLYW,FLYH);flyDirty=true;
  var now=performance.now();
  fliers.forEach(function(f){
    var p=(now-f.t0)/f.dur;if(p<0)return;p=Math.min(1,p);
    var e=p*p*(3-2*p);                                  // 부드럽게 가속·감속
    var cx=(f.sx+f.tx)/2,cy=Math.min(f.sy,f.ty)-70;     // 위로 솟았다가 내려오는 곡선
    var x=(1-e)*(1-e)*f.sx+2*(1-e)*e*cx+e*e*f.tx;
    var y=(1-e)*(1-e)*f.sy+2*(1-e)*e*cy+e*e*f.ty;
    var u=newDish(f.type,1),sz=f.size*(0.7+0.3*e);
    fctx.save();fctx.globalAlpha=Math.min(1,p*6);
    drawDishState(fctx,x,y+sz*0.5,sz,u,0);
    fctx.restore();
  });
}

/* ===== 재료 그림(누르면 도마에 올라감) + 배율 버튼 =====
   재료 그림은 카운터의 재료 자리 3곳에 놓인다. 누르면 그 재료가 「지금 배율」만큼 도마로 올라간다.
   진짜 그림은 assets/ing-dough.png · ing-toast.png · ing-sponge.png(투명 PNG)다. tools/key-jpg.py로 만든다.
   SRC_ART에 이름이 있으면 그 그림을 쓴다. 없으면 임시 그림(나무 판 + 재료 더미)을 그린다. */
var SRC_KEY=['ing-dough','ing-toast','ing-sponge'],SRC_ART=['ing-dough','ing-toast','ing-sponge'];
var srcEls=[],amtEls=[];   // amtEls[i][n] = i번 재료의 ×n 버튼
(function(){
  var box=$('sources');
  if(!box)return;
  DISHES.forEach(function(D,i){
    var col=document.createElement('div');col.className='srccol';
    /* 재료 그림 = 1개. 누르면 그 자리에서 재료가 도마로 날아간다 */
    var b=document.createElement('button');b.type='button';b.className='src';b.dataset.i=i;
    b.setAttribute('aria-label',D.ing+' 1개');
    b.innerHTML='<canvas width="200" height="180"></canvas><div class="src-lock"></div><span class="src-x1">×1</span>';
    b.addEventListener('click',function(e){e.stopPropagation();tapSource(i,b,1)});
    col.appendChild(b);
    /* 그 아래 ×5 ×10 ×50 ×100: 누르면 바로 그 개수가 올라간다(배율을 고르는 단계 없음) */
    var am=document.createElement('div');am.className='amts';amtEls[i]={};
    DISH_BAGS[i].forEach(function(n){
      if(n===1)return;
      var m=document.createElement('button');m.type='button';m.className='amt';m.dataset.n=n;
      m.innerHTML='<span class="an">×'+n+'</span><span class="ac"></span>';
      m.addEventListener('click',function(e){e.stopPropagation();tapSource(i,b,n)});
      am.appendChild(m);amtEls[i][n]=m;
    });
    col.appendChild(am);box.appendChild(col);srcEls.push(b);
  });
})();
function tapSource(i,el,n){
  if(S.phase!=='play'||S.guide||isOvenFocus())return;
  n=n||1;
  if(!owned(i)){buyDish(i);return}
  if(n>1&&!G.u.bag[n]){buyBag(n);return}             // 못 산 배율은 누르면 구입만 한다 (재료는 올라가지 않는다)
  if(benchBaked()){warnBaked();return}
  if(!S.bench||S.bench.type!==i){S.bench=newDish(i);fx=[];S.sel=null}
  el.classList.remove('tap');void el.offsetWidth;el.classList.add('tap');
  addN(n,el);
}
function drawSource(i){
  var cv=srcEls[i].querySelector('canvas'),c=cv.getContext('2d');
  c.clearRect(0,0,200,180);
  var art=SRC_ART.indexOf(SRC_KEY[i])>=0?sprite(SRC_KEY[i]):null;
  if(art){
    var sc=Math.min(190/art.width,176/art.height),w=art.width*sc,h=art.height*sc;
    c.drawImage(art,(200-w)/2,178-h,w,h);return
  }
  /* 임시 그림: 나무 판 위에 재료 더미 */
  c.fillStyle='#9b6a36';rr(c,10,108,180,58,12);c.fill();
  c.lineWidth=4;c.strokeStyle='#3b2a1a';rr(c,10,108,180,58,12);c.stroke();
  c.fillStyle='#b8813f';rr(c,16,112,168,20,8);c.fill();
  var d=newDish(i,i===2?8:4);
  drawDishState(c,100,134,fitCell(d,150,90,42),d,0);
}
function renderSources(){
  if(!srcEls.length)return;
  srcEls.forEach(function(b,i){
    var D=DISHES[i],own=owned(i);
    var key=(own?1:0)+'|'+((SRC_ART.indexOf(SRC_KEY[i])>=0&&sprite(SRC_KEY[i]))?1:0);
    if(b.dataset.key!==key){b.dataset.key=key;drawSource(i)}
    var open=S.round>=D.unlockR,can=!own&&open&&G.wallet>=D.price,dim=!!S.guide||isOvenFocus();
    b.classList.toggle('locked',!own);b.classList.toggle('canbuy',can);
    b.classList.toggle('on',!!S.bench&&S.bench.type===i);
    b.classList.toggle('off',dim);
    var lk=b.querySelector('.src-lock'),h=own?'':('🔒<small>'+(open?'🪙 '+D.price:'R'+D.unlockR+'에 열려요')+'</small>');
    if(lk.innerHTML!==h)lk.innerHTML=h;
    DISH_BAGS[i].forEach(function(n){
      if(n===1)return;
      var m=amtEls[i][n],has=!!G.u.bag[n];
      m.classList.toggle('locked',own&&!has);m.classList.toggle('canbuy',own&&!has&&G.wallet>=BAGCOST[n]);
      m.classList.toggle('off',!own||dim);
      var ac=m.querySelector('.ac'),t=(own&&!has)?('🪙 '+BAGCOST[n]):'';
      if(ac.textContent!==t)ac.textContent=t;
    });
  });
}

/* ===== 작업판 ===== */
var BW=360,BH=300,BBASE=282;
var bcv=$('benchCv'),bctx=bcv.getContext('2d');
function benchCell(d){return fitCell(d,330,200,72)}
/* 화면에 보이는 접시. 재료가 날아오는 동안은 d.n(규칙)보다 d.shown(화면)이 적다.
   판정·보상·봇은 전부 d.n만 보므로 규칙은 그대로다 */
function viewDish(d){
  if(d.shown===undefined||d.shown>d.n)d.shown=d.n;
  if(d.shown===d.n)return d;
  var v={type:d.type,n:d.shown,cooked:d.cooked,quality:d.quality};refresh(v);return v;
}
function benchHint(){return sceneOven()?'재료를 톡!':'봉지 톡!'}
function renderBench(){
  bctx.clearRect(0,0,BW,BH);
  landFliers();
  var d=S.bench,vd=d?viewDish(d):null;
  if(!d){
    bctx.fillStyle='#5a3a1e';bctx.font='800 22px Malgun Gothic,sans-serif';bctx.textAlign='center';
    bctx.fillText(benchHint(),BW/2,BH/2);
  }else{
    if(vd.n===0){
      if(d.n===0){
        bctx.fillStyle='#5a3a1e';bctx.font='800 20px Malgun Gothic,sans-serif';bctx.textAlign='center';
        bctx.fillText(benchHint(),BW/2,BH/2-24);
      }
      var e=newDish(d.type);drawDishState(bctx,BW/2,BBASE,64,e,0);
    }else{
      /* 오븐에서 막 돌아온 빵은 톡 튀어 오른다 */
      var age=d.popAt?performance.now()-d.popAt:1e9,pop=age<420?1+0.16*Math.sin(Math.PI*age/420):1;
      bctx.save();bctx.translate(BW/2,BBASE);bctx.scale(pop,pop);bctx.translate(-BW/2,-BBASE);
      drawDishState(bctx,BW/2,BBASE,benchCell(vd),vd,0);
      bctx.restore();
    }
    bctx.fillStyle='#3b2a1a';bctx.font='800 20px Malgun Gothic,sans-serif';bctx.textAlign='center';
    if(vd.n>0)bctx.fillText(d.cooked?(vd.n+'개 · 완성도 '+Math.round((d.quality||0)*100)+'%'):(vd.n+'개'),BW/2,BBASE+18);
  }
  var nw=performance.now();
  fx=fx.filter(function(f){return nw-f.t0<f.dl+700});
  fx.forEach(function(f){var a=nw-f.t0-f.dl;if(a<0)return;var q=Math.min(1,a/320),y=-20+(f.y1+20)*q*q;bctx.save();bctx.globalAlpha=a>320?Math.max(0,1-(a-320)/380):1;bctx.font='28px sans-serif';bctx.textAlign='center';bctx.translate(f.x,y);bctx.rotate(f.rot*q);bctx.fillText(f.ico,0,0);bctx.restore()});
  bcv.style.pointerEvents=(d&&d.n>0)?'auto':'none';
  $('benchWrap').classList.toggle('sel',S.sel==='bench');
  var t=$('benchInfo');
  if(!d||!d.n)t.textContent='';
  else t.textContent=d.n+'개';
}
var fx=[];
function spawnFx(d,n){
  var cell=benchCell(d),b=dishBox(d,cell,BW/2,BBASE),now=performance.now(),ico=DISHES[d.type].ico;
  for(var i=0;i<Math.min(n,12);i++)fx.push({x:b.x+b.w*(0.15+0.7*rnd()),y1:b.y+b.h*(0.3+0.6*rnd()),t0:now,dl:i*60,ico:ico,rot:(rnd()-.5)*2});
}
function pt(cnv,e,W,H){var r=cnv.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
function addN(n,srcEl){
  if(S.guide||S.phase!=='play'||isOvenFocus())return;
  var d=S.bench;if(!d){toast(sceneOven()?'👆 재료 그림을 톡해요':'👆 선반에서 개수 칩을 톡해요');return}
  if(d.cooked){warnBaked();return}
  var mx=DISHES[d.type].max;
  if(n>0){
    var can=Math.min(n,mx-d.n);
    if(can<=0){toast('접시가 가득 찼어요');return}
    /* 칩 개수가 접시 한도에 잘려 일부만 들어가면 학생이 모른 채 개수를 틀린다 */
    if(can<n)toast('접시에 '+can+'개만 더 들어가요');
    if(d.shown===undefined)d.shown=d.n;
    d.n+=can;refresh(d);
    if(srcEl&&sceneOven())launchFliers(d,can,srcEl);
    else{d.shown=d.n;spawnFx(d,can)}
    sfx(n>1?'bag':'tap');
  }else{
    var m=Math.min(-n,d.n);if(m<=0)return;
    d.n-=m;refresh(d);
  }
  updateAll();
}
function clearBench(){var d=S.bench;if(!d||!d.n)return;if(d.cooked){warnBaked();return}d.n=0;refresh(d);updateAll()}
$('um1').onclick=function(){if(!isOvenFocus())addN(-1)};
$('clearBtn').onclick=function(){if(S.phase==='play'&&!S.guide&&!isOvenFocus())clearBench()};

function renderChips(){
  var focus=isOvenFocus()||!!S.guide;
  dishEls.forEach(function(el,i){
    var own=owned(i);
    DISH_BAGS[i].forEach(function(n){
      var ch=chipEls[i][n],has=!!G.u.bag[n];
      ch.classList.toggle('locked',own&&!has);
      ch.classList.toggle('off',!own||focus);
      ch.classList.toggle('canbuy',own&&!has&&G.wallet>=BAGCOST[n]);
      var ck=ch.querySelector('.ck');
      if(!has){
        var h='🔒<span class="ck-cost">'+BAGCOST[n]+'</span>';
        if(ck.innerHTML!==h)ck.innerHTML=h;
      }else if(ck.innerHTML)ck.innerHTML='';
    });
  });
}

/* ===== 오븐 (리듬 굽기 · 집중 모드) ===== */
var OW=260,OH=280,OBASE=262;
var ocv=$('ovenCv'),octx=ocv.getContext('2d');
var focusCv=$('ovenFocusCv'),focusCtx=focusCv?focusCv.getContext('2d'):null;
var FOCUS_W=220,FOCUS_H=220;
function setOvenFocus(on){
  var el=$('ovenFocus');if(!el)return;
  el.hidden=!on;el.classList.toggle('is-on',!!on);
  document.documentElement.classList.toggle('oven-focus-on',!!on);
  if(!on&&focusCtx)focusCtx.clearRect(0,0,FOCUS_W,FOCUS_H);
}
function toOven(){
  if(S.phase!=='play'||S.guide||isOvenFocus())return;
  var d=S.bench;
  if(!d){toast('👆 먼저 선반에서 개수 칩을 톡해요');return}
  if(d.n<=0){toast('👆 선반에서 개수 칩을 톡해요');return}
  if(d.cooked){toast('🍞 이미 구운 빵이에요. 손님에게 서빙해요');return}
  if(S.oven.dish){
    if(S.oven.state==='cooking')toast('🔥 아직 굽는 중이에요');
    else toast('🔥 오븐이 차 있어요. 완성품을 꺼내 오븐을 비워 주세요');
    return;
  }
  S.oven={dish:d,state:'cooking',t0:clock(),n:0,need:OVEN[G.u.oven].taps,grades:[],last:null};
  S.bench=null;S.sel=null;fx=[];drag=null;
  setOvenFocus(true);
  updateAll();
}
$('toOven').onclick=toOven;
function cookTap(){
  var o=S.oven;if(!o||o.state!=='cooking')return;
  var t=(clock()-o.t0)/1000,n=Math.max(1,Math.round(t/BEAT)),dev=Math.abs(t-n*BEAT);
  var g=dev<=0.10?'perfect':(dev<=0.20?'good':'miss'),q=g==='perfect'?1:(g==='good'?0.7:0.4);
  o.grades.push(q);o.n++;o.last={g:g,at:clock()};
  sfx(g);
  if(o.n>=o.need){
    o.state='done';o.dish.cooked=true;
    o.dish.quality=o.grades.reduce(function(a,b){return a+b},0)/o.grades.length;
    sfx('done');
    setOvenFocus(false);
    /* 구운 빵은 오븐에 두지 않고 도마로 돌아온다. 오븐은 바로 다음 빵을 받을 수 있다 */
    S.bench=o.dish;S.bench.shown=S.bench.n;S.bench.popAt=performance.now();
    S.oven=ovenIdle();S.sel=null;fx=[];fliers.length=0;
    toast('✅ 완성! 완성도 '+Math.round(S.bench.quality*100)+'% · 손님에게 끌어다 주세요',2200);
  }
  updateAll();
}
/* 집중 모드: 오버레이 아무 곳이나 탭하면 박자 입력 */
var ovenLastTap=-1e9;
function onOvenFocusTap(e){
  if(!isOvenFocus())return;
  if(e&&e.isPrimary===false)return;
  e.preventDefault();
  var t=clock();if(t-ovenLastTap<90)return;
  ovenLastTap=t;cookTap();
}
(function(){
  var hit=$('ovenFocus');
  if(!hit)return;
  hit.addEventListener('pointerdown',onOvenFocusTap);
})();
function renderFocusRing(){
  if(!focusCtx||!isOvenFocus())return;
  var o=S.oven,c=focusCtx,W=FOCUS_W,H=FOCUS_H;
  c.clearRect(0,0,W,H);
  var ct=(clock()-o.t0)/1000,nb=(Math.floor(ct/BEAT)+1)*BEAT,ph=clamp((nb-ct)/BEAT,0,1);
  var rx=W/2,ry=H/2,r0=36;
  c.beginPath();c.arc(rx,ry,r0,0,7);c.fillStyle='rgba(255,138,61,.28)';c.fill();
  c.lineWidth=7;c.strokeStyle='#ff8a3d';c.stroke();
  c.beginPath();c.arc(rx,ry,r0+ph*48,0,7);c.lineWidth=6;c.strokeStyle='rgba(120,180,255,'+(0.4+0.6*(1-ph))+')';c.stroke();
  var l=o.last;
  if(l&&clock()-l.at<700){
    c.font='800 28px Malgun Gothic,sans-serif';c.textAlign='center';
    c.fillStyle=l.g==='perfect'?'#5fe08f':l.g==='good'?'#ffc247':'#ff7a70';
    c.fillText(l.g==='perfect'?'PERFECT!':l.g==='good'?'GOOD':'MISS',rx,ry+8);
  }else{
    c.font='800 22px Malgun Gothic,sans-serif';c.textAlign='center';c.fillStyle='#fff';
    c.fillText('톡!',rx,ry+8);
  }
  var st=$('ovenFocusStat');
  if(st)st.textContent=o.n+' / '+o.need;
}
function steam(c,o,cx,top,w,pr){
  var t=performance.now()/1000,heat=o.state==='cooking'?0.35+pr*0.65:(o.state==='done'?0.5:0);
  var n=o.state==='idle'?0:3+Math.round(pr*3);
  for(var i=0;i<n;i++){
    var ph=(t*0.55+i/n)%1,x=cx+(i-(n-1)/2)*w/(n+0.5)+Math.sin(t*2+i)*6,y=top-6-ph*64;
    c.beginPath();c.arc(x,y,5+ph*9,0,7);c.fillStyle='rgba(255,255,255,'+(0.28*(1-ph)*heat+0.02)+')';c.fill();
  }
  if(o.state==='cooking'){c.font='800 14px Malgun Gothic,sans-serif';c.textAlign='center';c.fillStyle='rgba(255,200,120,'+(0.55+0.45*Math.sin(t*9))+')';c.fillText(pr<0.5?'지글…':'지글지글~',cx,Math.max(96,top-80))}
  if(o.state==='done'){for(var k=0;k<4;k++){var a=(t*1.2+k/4)%1;c.globalAlpha=Math.sin(a*Math.PI);c.font='18px sans-serif';c.textAlign='center';c.fillText('✨',cx+(k-1.5)*w/4,top+10+Math.cos(k*2+t)*6);c.globalAlpha=1}}
}
/* ===== 스프라이트 =====
   그림은 배경이 형광 초록(#00FF00)으로 채워져 오거나, 미리 투명으로 빼 둔다.
   네온 초록만 지운다. 쓰레기통·나뭇잎처럼 일반 초록은 남긴다. */
var SPRITE={},SPRITE_READY={};
function loadKeyed(name){
  if(SPRITE[name]!==undefined)return SPRITE[name];
  SPRITE[name]=null;
  var im=new Image();
  im.onload=function(){
    var cv=document.createElement('canvas');cv.width=im.naturalWidth;cv.height=im.naturalHeight;
    var g=cv.getContext('2d');g.drawImage(im,0,0);
    try{
      var d=g.getImageData(0,0,cv.width,cv.height),p=d.data,kept=0;
      for(var i=0;i<p.length;i+=4){
        var r=p[i],gr=p[i+1],b=p[i+2],a=p[i+3];
        /* 네온 크로마만 제거 (#00FF00 근처). 나무·크림 오븐은 건드리지 않음 */
        if(a>0&&gr>=200&&r<=100&&b<=100&&(gr-r)>=90&&(gr-b)>=90){p[i+3]=0;continue}
        /* 자홍(#FF00FF) 배경도 뺀다. 초록 물체가 있는 그림은 자홍 배경으로 받는다 */
        if(a>0&&r>=200&&b>=200&&gr<=100&&(r-gr)>=90&&(b-gr)>=90){p[i+3]=0;continue}
        if(p[i+3]>8)kept++;
      }
      if(kept>80)g.putImageData(d,0,0);
    }catch(e){/* file:// 등에서 getImageData가 막혀도 원본 그림은 씀 */}
    SPRITE[name]=cv;SPRITE_READY[name]=true;
    if(name==='trash')applyTrashArt();
    if(S&&S.phase==='play')updateAll();
  };
  im.onerror=function(){SPRITE[name]=null};
  /* 캐시에 깨진 예전 파일이 남지 않게 */
  im.src='assets/'+name+'.png?v=3';
  return null;
}
function sprite(name){return SPRITE_READY[name]?SPRITE[name]:null}
['oven-basic','oven-brick','oven-gold','trash'].forEach(loadKeyed);
/* 재료 그림(SRC_ART)은 SPRITE 저장소가 만들어진 뒤에 불러야 한다 */
SRC_ART.forEach(function(k){loadKeyed(k)});
PIECE.forEach(function(P){loadKeyed(P.raw);loadKeyed(P.full)});
function applyTrashArt(){
  var el=$('trash');if(!el)return;
  var cv=sprite('trash');
  if(cv){
    el.style.backgroundImage='url('+cv.toDataURL('image/png')+')';
  }else{
    el.style.backgroundImage='url(assets/trash.png?v=3)';
  }
  el.style.backgroundColor='transparent';
  el.style.backgroundSize='contain';
  el.style.backgroundRepeat='no-repeat';
  el.style.backgroundPosition='center';
  el.textContent='';
}
var OVEN_SPR=[null,'oven-basic','oven-brick','oven-gold'];
/* 스프라이트를 칸에 맞춰(비율 유지) 그리고, 그려진 영역을 돌려준다 */
function drawSpriteFit(c,cv,x,y,w,h){
  var s=Math.min(w/cv.width,h/cv.height),dw=cv.width*s,dh=cv.height*s;
  var dx=x+(w-dw)/2,dy=y+(h-dh)/2;
  c.drawImage(cv,dx,dy,dw,dh);
  return{x:dx,y:dy,w:dw,h:dh};
}
function sceneOven(){return document.documentElement.classList.contains('scene-v2')}
function ovenFrame(c,lv){
  if(sceneOven())return;
  var cv=sprite(OVEN_SPR[lv]);
  if(cv){drawSpriteFit(c,cv,0,0,OW,OH);return}
  if(lv===1){rr(c,0,0,OW,OH,14);c.fillStyle='#4a2f1d';c.fill();rr(c,8,8,OW-16,OH-16,10);c.fillStyle='#2b1b10';c.fill();return}
  if(lv===2){
    rr(c,0,0,OW,OH,14);c.fillStyle='#a8452e';c.fill();
    c.save();rr(c,0,0,OW,OH,14);c.clip();c.strokeStyle='#6e2a1b';c.lineWidth=2;
    for(var y=0,r=0;y<OH;y+=16,r++){c.beginPath();c.moveTo(0,y);c.lineTo(OW,y);c.stroke();for(var x=(r%2?0:20);x<OW;x+=40){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+16);c.stroke()}}
    c.restore();
    rr(c,14,14,OW-28,OH-28,26);c.fillStyle='#3a2314';c.fill();c.lineWidth=5;c.strokeStyle='#5b2a1a';c.stroke();
    rr(c,20,20,OW-40,OH-40,22);c.fillStyle='#2b1b10';c.fill();return
  }
  var g=c.createLinearGradient(0,0,OW,OH);g.addColorStop(0,'#f2d774');g.addColorStop(0.5,'#c9a227');g.addColorStop(1,'#efd36a');
  rr(c,0,0,OW,OH,16);c.fillStyle=g;c.fill();c.lineWidth=3;c.strokeStyle='#8a6a10';c.stroke();
  [[10,10],[OW-10,10],[10,OH-10],[OW-10,OH-10]].forEach(function(p){c.beginPath();c.arc(p[0],p[1],4,0,7);c.fillStyle='#8a6a10';c.fill()});
  rr(c,16,16,OW-32,OH-32,20);c.fillStyle='#5e4610';c.fill();
  var rg=c.createRadialGradient(OW/2,OH*0.75,10,OW/2,OH*0.75,OW*0.7);rg.addColorStop(0,'#5a2a0e');rg.addColorStop(1,'#241208');
  rr(c,22,22,OW-44,OH-44,16);c.fillStyle=rg;c.fill();
}
function renderOven(){
  octx.clearRect(0,0,OW,OH);
  ovenFrame(octx,G.u.oven);
  var o=S.oven,d=o.dish;
  if(!d){
    if(sceneOven())return;
    var useSpr=!!sprite(OVEN_SPR[G.u.oven]);
    octx.font='800 16px Malgun Gothic,sans-serif';octx.textAlign='center';
    if(useSpr){
      octx.lineWidth=4;octx.strokeStyle='rgba(59,42,26,.55)';octx.fillStyle='#fff8ec';
      octx.strokeText('빈 오븐',OW/2,OH*0.78);
      octx.fillText('빈 오븐',OW/2,OH*0.78);
    }else{
      octx.fillStyle='#8f7350';
      octx.fillText('빈 오븐',OW/2,OH/2);
      octx.font='15px Malgun Gothic,sans-serif';octx.fillText('작업판에서 🔥 오븐에 넣어요',OW/2,OH/2+24);
    }
    return;
  }
  /* 스프라이트 오븐은 창이 가운데 있다. 캔버스 바닥(OBASE)에 그리면 빵이
     오븐 발밑에 놓인 것처럼 보이므로, 창 안으로 올려서 그린다 */
  var useSpr=!!sprite(OVEN_SPR[G.u.oven]);
  var scn=sceneOven();
  var OB=scn?228:(useSpr?Math.round(OH*0.60):OBASE);
  var CO=scn?fitCell(d,118,78,28):fitCell(d,useSpr?150:220,useSpr?92:135,useSpr?30:44);
  var bs=1+(o.last&&clock()-o.last.at<260?0.09*(1-(clock()-o.last.at)/260):0);
  var pr=o.state==='done'?1:Math.min(0.95,o.n/o.need),bx=dishBox(d,CO,OW/2,OB);
  octx.save();octx.translate(OW/2,OB);octx.scale(bs,bs);octx.translate(-OW/2,-OB);
  drawDishState(octx,OW/2,OB,CO,d,pr);
  if(DISHES[d.type].dim===2&&!piecesOn(d)){
    var w=d.w*CO,h=d.h*CO;
    octx.save();rr(octx,OW/2-w/2,OB-h,w,h,Math.min(w,h)*0.12);octx.fillStyle='rgba(150,70,15,'+(0.03+0.4*(o.state==='done'?1:pr))+')';octx.fill();octx.restore();
  }
  octx.restore();
  steam(octx,o,OW/2,bx.y,bx.w,pr);
  if(o.state==='cooking'){
    /* 박자 링·판정은 집중 모드 패널에만 표시 (오븐 안 중복 제거) */
    octx.fillStyle='#e8d4b0';octx.font='800 16px Malgun Gothic,sans-serif';octx.textAlign='center';
    octx.fillText('굽는 중…',OW/2,OB+16);
  }else if(o.state==='done'){
    var q=d.quality;
    octx.fillStyle='#5fe08f';octx.font='800 18px Malgun Gothic,sans-serif';octx.textAlign='center';
    octx.fillText('✅ 완성! 끌어다 서빙',OW/2,44);
    octx.fillText(Math.round(q*100)+'% '+(q>=0.9?'⭐⭐⭐':q>=0.7?'⭐⭐':'⭐'),OW/2,70);
  }
  ocv.classList.toggle('sel',S.sel==='oven');
}

/* ===== 손님 슬롯 ===== */
var slotEls=[],SLOT_W=260,SLOT_H=52;
(function(){
  var row=$('custRow');
  for(var i=0;i<SLOTS;i++){
    var d=document.createElement('div');d.className='slot empty';
    d.innerHTML='<div class="bubble"><div class="bubble-body"><i class="bubble-fill"></i><canvas width="'+SLOT_W+'" height="'+SLOT_H+'"></canvas></div></div>'
      +'<div class="cat">🪑</div>';
    (function(idx){d.addEventListener('click',function(){
      if(S.phase!=='play'||S.guide||isOvenFocus())return;
      if(S.sel){var c=slotCust(idx);if(c)serveDish(S.sel,c)}
      else if(slotCust(idx))toast('빵을 손님에게 끌어다 놓아요 (또는 빵을 탭한 뒤 손님을 탭)');
    })})(i);
    row.appendChild(d);slotEls.push(d);
  }
})();
function slotCust(i){return S.cust.filter(function(c){return c.slot===i&&c.state!=='gone'})[0]||null}
/* 원본과 같은 모양의 '통짜' 빵 (칸 나누기 없음). k배 크기로 그려서 비교하게 한다. */
function loaf(c,cx,base,len,h,full){
  var D=DISHES[0],lv=LV(0),x=cx-len/2,y=base-h;
  rr(c,x,y,len,h,h*0.5);
  c.fillStyle=full?(lv>=3?'#cf8420':lv>=2?'#dc9a3a':D.tile):D.raw;c.fill();
  c.lineWidth=Math.max(1.5,h*0.07);c.strokeStyle=full?D.edge:D.rawEdge;c.stroke();
  if(!full)return;
  c.strokeStyle='rgba(120,60,20,.5)';c.lineWidth=Math.max(1,h*0.06);c.lineCap='round';
  var st=h*0.9,n=Math.max(1,Math.floor((len-h*0.9)/st));
  for(var i=0;i<n;i++){var px=x+h*0.75+i*st;c.beginPath();c.moveTo(px,y+h*0.3);c.lineTo(px+h*0.3,y+h*0.7);c.stroke()}
  c.fillStyle=lv>=3?'#cf8420':D.tile;c.strokeStyle=D.edge;c.lineWidth=Math.max(1,h*0.06);
  [[0.12,0.42],[0.58,0.88]].forEach(function(v){c.beginPath();c.moveTo(x+h*v[0]+len*0,y+h*0.12);c.lineTo(x+h*(v[0]+v[1])/2,y-h*0.32);c.lineTo(x+h*v[1],y+h*0.12);c.closePath();c.fill();c.stroke()});
}
function sil(c,ty,k,cx,base,cap){
  if(ty===0){var h=16,len=Math.min(Math.max(k,0.15)*16,cap||160);loaf(c,cx,base,len,h,true)}
  else if(ty===1){var s=Math.min(Math.max(k,0.15)*11,cap||64),d=newDish(1,1);d.cooked=true;drawDishState(c,cx,base,s,d,1)}
  else{var a=Math.min(Math.max(k,0.15)*7,cap||28),d3=newDish(2,1);d3.cooked=true;cake(c,cx,base,a,d3,true)}
}
/* 1 → k로 닮아 커지는 배율 (루프). 양 끝에서 잠깐 멈춤 */
function orderGrowK(c0,now){
  var t0=c0.animT0!=null?c0.animT0:(c0.animT0=now);
  var u=((now-t0)/2000)%1;
  var e=u<0.12?0:(u>0.72?1:(u-0.12)/0.6);
  e=e*e*(3-2*e);
  return 1+(c0.k-1)*e;
}
function silUnit(ty){return ty===0?16:ty===1?11:7}
function drawBubble(cnv,c0,got,now){
  var k=c0.k,ty=c0.dish,c=cnv.getContext('2d'),w=SLOT_W,h=SLOT_H;
  now=now||performance.now();
  c.clearRect(0,0,w,h);
  var base=h-4;
  if(got){
    var g=got,gd=newDish(g.type,g.n);
    gd.cooked=true;
    var block=210,x0=(w-block)/2;
    c.fillStyle='#d94b43';c.font='800 14px Malgun Gothic,sans-serif';c.textAlign='left';
    c.fillText('≠',x0,18);
    sil(c,ty,Math.min(k,3),x0+42,base,70);
    c.fillStyle='#d94b43';c.font='700 12px Malgun Gothic,sans-serif';
    c.fillText(DISHES[g.type].ico+g.n,x0+100,18);
    var c2=fitCell(gd,80,40,14);drawDishState(c,x0+140,base,c2,gd,1);
    return;
  }
  /* 한 줄 가운데: 🥖1:k + 닮아 커지는 빵 */
  var sk=orderGrowK(c0,now),unit=silUnit(ty);
  var labelW=50,gap=8,pad=8;
  var breadCap=Math.max(40,w-labelW-gap-pad*2);
  var fullLen=Math.min(k*unit,breadCap);
  var total=labelW+gap+fullLen;
  var x0=(w-total)/2;
  var breadX=x0+labelW+gap;
  c.fillStyle=c0.giant?'#d94b43':'#c9631f';
  c.font='800 18px Malgun Gothic,sans-serif';c.textAlign='left';
  c.fillText(DISHES[ty].ico,x0,20);
  c.font='800 16px Malgun Gothic,sans-serif';
  c.fillText('1:'+k,x0+22,20);
  c.save();c.globalAlpha=0.18;sil(c,ty,k,breadX+fullLen/2,base,breadCap);c.restore();
  var curLen=Math.min(sk*unit,breadCap);
  sil(c,ty,sk,breadX+curLen/2,base,breadCap);
  if(sk<k-0.05){c.save();c.globalAlpha=0.5;sil(c,ty,1,breadX+unit/2,base,breadCap);c.restore()}
}
function renderSlots(){
  var now=performance.now();
  for(var i=0;i<SLOTS;i++){
    var el=slotEls[i],c=slotCust(i);
    var cat=el.querySelector('.cat'),fill=el.querySelector('.bubble-fill');
    if(!c){
      el.className='slot empty'+(S.hover===i?' drop':'');
      el.dataset.cid='';el.dataset.mode='';el.dataset.f='';
      cat.textContent='🪑';
      if(fill)fill.style.height='0%';
      continue;
    }
    var showGot=c.got&&S.time<c.gotUntil,mode=showGot?'got':'ord';
    var fresh=el.dataset.cid!==String(c.id);
    if(fresh||el.dataset.mode!==mode||el.dataset.f!==String(c.fails||0)){
      el.dataset.f=String(c.fails||0);
      el.dataset.cid=String(c.id);el.dataset.mode=mode;
      if(fresh){
        c.animT0=now;
        el.classList.remove('enter');void el.offsetWidth;el.classList.add('enter');
      }
    }
    drawBubble(el.querySelector('canvas'),c,showGot?c.got:null,now);
    /* 기다릴수록 말풍선 안이 아래에서 위로 빨갛게 차오른다 */
    var anger=c.state==='wait'?clamp(c.wait/c.pat,0,1):(c.state==='angry'?1:0);
    if(fill)fill.style.height=(anger*100)+'%';
    var low=c.state==='wait'&&anger>=0.7;
    el.className='slot'+(c.giant?' giant':'')+(el.classList.contains('enter')?' enter':'')+(c.state==='happy'?' happy':c.state==='angry'?' angry':(showGot?' sad':''))+(low?' low':'')+(S.hover===i?' drop':'');
    var md=c.state==='happy'?'💖':c.state==='angry'?'💢':(showGot?(c.mood||'💧'):(low?'💢':''));
    var html=c.spr
      ?('<img class="guest-spr" alt="" src="assets/'+c.spr+'.png">'+(md?'<span class="md">'+md+'</span>':''))
      :(c.an+(md?'<span class="md">'+md+'</span>':''));
    if(cat.innerHTML!==html)cat.innerHTML=html;
  }
}

/* ===== 판정 + 서빙 + 버리기 ===== */
function judge(d,c){
  if(d.type!==c.dish)return 'wrongDish';
  var dim=DISHES[d.type].dim;
  if(dim>=2&&!isSimilar(d))return 'notSimilar';
  if(d.n!==c.N)return 'wrongSize';
  if(!d.cooked)return 'raw';
  return 'ok';
}
function getDish(src){return src==='bench'?S.bench:S.oven.dish}
function removeDish(src){if(src==='bench')S.bench=null;else S.oven=ovenIdle();if(S.sel===src)S.sel=null}
function serveDish(src,c){
  if(S.phase!=='play'||S.guide||isOvenFocus())return false;
  var d=getDish(src);
  if(!d||!c||c.state!=='wait')return false;
  if(d.n<=0){toast('접시가 비었어요');return false}
  if(src==='oven'&&S.oven.state==='cooking'){toast('🔥 아직 굽는 중이에요');return false}
  var r=judge(d,c);
  removeDish(src);
  if(r==='ok'){
    var base=baseOf(c.dish,c.k)*LVMULT[LV(c.dish)]*(c.giant?GIANT_MULT:1);
    var q=d.quality,rw=Math.round(base*q),pb=Math.round(base*PAT_BONUS*(1-c.wait/c.pat)),gain=rw+pb;
    S.reward+=rw;S.patience+=pb;S.served++;S.streak++;S.qs.push(q);
    c.speed=1-c.wait/c.pat;c.state='happy';c.until=S.time+0.9;
    var msg=(c.giant?'👑 ':'😋 ')+'+'+gain+'코인! 완성도 '+Math.round(q*100)+'%';
    if(S.streak%3===0){S.combo+=COMBO_BONUS;gain+=COMBO_BONUS;msg+='  콤보 +'+COMBO_BONUS}
    earn(gain);
    floatAtSlot(c.slot,'+'+gain,'coin');
    if(q>=0.9)floatAtSlot(c.slot,'완벽하게 구웠어요!','ok');
    bumpCoins();
    sfx(c.giant?'giant':'serve');
    if(c.giant)doShake(5,320);
    if(S.streak%3===0){comboBanner('콤보 ×'+S.streak+'  +'+COMBO_BONUS);sfx('combo')}
    toast(msg);
  }else{
    S.wrong[r]++;G.wrongAll[r]++;S.streak=0;
    var frac=r==='notSimilar'?0.5:0.3;
    c.wait=Math.min(c.pat-1,c.wait+c.pat*frac);   // 기다린 시간이 늘어남 = 인내심 감소
    if(r!=='wrongDish')c.fails=(c.fails||0)+1;
    c.got={type:d.type,n:d.n};c.gotUntil=S.time+2.8;
    sfx('fail');doShake(4,240);
    if(r==='wrongDish'){c.mood='💢';toast('💢 주문은 「'+DISHES[c.dish].name+'」인데 「'+DISHES[d.type].name+'」이 왔어요!')}
    else if(r==='notSimilar'){S.penalty+=WRONG_COST;pay(WRONG_COST);c.mood='💢';floatAtSlot(c.slot,'−'+WRONG_COST,'bad');bumpCoins();toast('💢 원본과 모양이 달라요!  −'+WRONG_COST+'코인')}
    else if(r==='wrongSize'){c.mood='💧';floatAtSlot(c.slot,d.n<c.N?'너무 작아요':'너무 커요','bad');toast('💧 이 크기가 아니에요. '+(d.n<c.N?'너무 작아요':'너무 커요')+'!')}
    else{c.mood='💧';floatAtSlot(c.slot,'안 익었어요','bad');toast('💧 안 익었어요! 오븐에서 구워 주세요')}
  }
  updateAll();return true;
}
function discard(src){
  if(S.phase!=='play'||S.guide||isOvenFocus())return false;
  var d=getDish(src);if(!d)return false;
  var n=d.n;S.wasted+=n;G.wastedAll+=n;S.trashed++;G.trashedAll++;
  removeDish(src);sfx('trash');
  toast('🗑️ 버렸어요'+(n?' (재료 '+n+'개 낭비)':''));updateAll();return true;
}
$('trash').addEventListener('click',function(){if(!isOvenFocus()&&S.sel)discard(S.sel)});
$('ovenBox').addEventListener('click',function(){
  if(isOvenFocus())return;
  if(S.sel==='bench')toOven();
});

/* ===== 요리 끌어다 놓기 ===== */
var drag=null,ghost=$('ghost'),gctx=ghost.getContext('2d');
function setupDish(cnv,src,W,H){
  cnv.addEventListener('pointerdown',function(e){
    if(S.phase!=='play'||S.guide||isOvenFocus())return;
    e.preventDefault();
    drag={src:src,cnv:cnv,W:W,H:H,x0:e.clientX,y0:e.clientY,started:false,pid:e.pointerId};
  });
}
setupDish(bcv,'bench',BW,BH);setupDish(ocv,'oven',OW,OH);
function beginGhost(d){
  gctx.clearRect(0,0,200,200);
  drawDishState(gctx,100,190,fitCell(d,170,120,56),d,d.cooked?1:0);
  ghost.style.display='block';
  document.documentElement.classList.add('dragging');
}
/* 끌고 다니는 그림은 손가락을 따라간다. 돌아갔으면 손가락 좌표를 게임 좌표로 바꿔야 한다 */
function moveGhost(x,y){
  var p=toGame(x,y);
  ghost.style.transform='translate('+(p.x-100*VIEW.s)+'px,'+(p.y-160*VIEW.s)+'px)';
}
function targetAt(x,y){
  var el=document.elementFromPoint(x,y);if(!el)return {};
  var sl=el.closest&&el.closest('.slot');
  return {slot:sl?slotEls.indexOf(sl):-1,trash:!!(el.closest&&el.closest('#trash')),oven:!!(el.closest&&el.closest('#ovenBox'))};
}
function hoverTargets(x,y){
  var t=targetAt(x,y);
  S.hover=t.slot>=0?t.slot:-1;
  $('trash').classList.toggle('drop',!!t.trash);
  $('ovenBox').classList.toggle('drop',!!t.oven&&drag&&drag.src==='bench');
  renderSlots();
}
function clearHover(){S.hover=-1;$('trash').classList.remove('drop');$('ovenBox').classList.remove('drop');renderSlots()}
window.addEventListener('pointermove',function(e){
  if(!drag||e.pointerId!==drag.pid)return;
  var d=getDish(drag.src);
  if(!drag.started&&d&&Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0)>DRAG_SLOP){drag.started=true;beginGhost(d)}
  if(drag.started){moveGhost(e.clientX,e.clientY);hoverTargets(e.clientX,e.clientY)}
});
function finishDrag(e,cancel){
  if(!drag||e.pointerId!==drag.pid)return;
  var dr=drag;drag=null;
  document.documentElement.classList.remove('dragging');
  if(dr.started){
    ghost.style.display='none';clearHover();
    if(cancel)return;
    var t=targetAt(e.clientX,e.clientY);
    if(t.slot>=0){var c=slotCust(t.slot);if(c)serveDish(dr.src,c);else toast('손님이 없는 자리예요')}
    else if(t.trash)discard(dr.src);
    else if(t.oven&&dr.src==='bench')toOven();
    return;
  }
  if(cancel)return;
  if(dr.src==='bench'){
    if(S.bench){S.sel=S.sel==='bench'?null:'bench';updateAll()}
  }else if(dr.src==='oven'){
    if(S.oven.dish&&S.oven.state==='done'){S.sel=S.sel==='oven'?null:'oven';updateAll()}
  }
}
window.addEventListener('pointerup',function(e){finishDrag(e,false)});
window.addEventListener('pointercancel',function(e){finishDrag(e,true)});

/* ===== HUD / 진행 ===== */
function fmtTime(sec){
  sec=Math.max(0,Math.ceil(sec));
  var m=Math.floor(sec/60),s=sec%60;
  return m+':'+String(s).padStart(2,'0');
}
function setEndBtn(on){
  var el=$('endBtn');if(!el)return;
  el.hidden=!on;el.classList.toggle('on',!!on);
}
function updateHud(){
  $('coinsTxt').textContent='🪙 '+G.wallet;
  var tleft=Math.max(0,S.roundT-S.time);
  $('timerBar').style.transform='scaleX('+clamp(tleft/S.roundT,0,1)+')';
  $('timerBar').parentNode.classList.toggle('warn',tleft<=10&&tleft>0);
  var tt=$('timerTxt');if(tt)tt.textContent=fmtTime(tleft);
  renderSlots();
  var focus=isOvenFocus();
  var un=!S.bench||S.bench.cooked||S.guide||focus;
  ['um1','clearBtn'].forEach(function(id){var el=$(id);if(el)el.classList.toggle('off',un)});
  var canBake=!!(S.bench&&S.bench.n>0&&!S.bench.cooked&&S.oven.state==='idle'&&!S.oven.dish&&!focus&&!S.guide);
  $('toOven').classList.toggle('off',!canBake);
}
function updateAll(){
  renderBench();renderOven();updateHud();renderShelf();renderChips();renderUpg();renderSources();
  dishEls.forEach(function(el,i){
    el.classList.toggle('on',!!S.bench&&S.bench.type===i);
    el.classList.toggle('locked',!owned(i));
  });
}

/* ===== 라운드 진행 ===== */
/* ===== 이름·학번 =====
   다른 아케이드 게임과 같은 HalomathProfile 규칙:
   dorms = 닉네임만, school = 이름 + 학번 */
function nameFieldLabel(){return activeMode==='dorms'?'닉네임':'이름'}
function profileInit(){
  var n=$('inName'),i=$('inId'),lead=$('profileLead');
  if(activeMode==='dorms'){
    document.body.classList.add('mode-dorms');
    $('labName').textContent='닉네임:';
    $('idGroup').style.display='none';
    if(i){i.value='';i.disabled=true;i.removeAttribute('required')}
    n.placeholder='닉네임';
    if(lead)lead.textContent='닉네임을 입력해야 시작할 수 있습니다.';
    if(!playerName||playerName==='도전자'){
      playerName=randomDormsNick();
      if(window.HalomathProfile)HalomathProfile.saveName(activeMode,playerName);
    }
  }else{
    document.body.classList.remove('mode-dorms');
    $('labName').textContent='이름:';
    $('idGroup').style.display='';
    if(i){i.disabled=false;i.placeholder='4글자로 입력 (예: 2230)';i.value=studentId||''}
    n.placeholder='예: 홍길동';
    if(lead)lead.textContent='이름과 학번을 입력해야 시작할 수 있습니다.';
  }
  n.value=playerName||'';
}
/* 통과하면 이름·학번을 저장하고 true를 준다 */
function profileCommit(){
  var e=$('pErr'),name=sanitize($('inName').value,12);
  if(!name){e.textContent=nameFieldLabel()+'을 입력해야 시작할 수 있습니다.';$('inName').focus();return false}
  if(activeMode==='school'){
    var id=sanitize($('inId').value,10);
    if(window.HalomathProfile&&!HalomathProfile.isValidStudentId(id)){
      e.textContent='학번을 1~10자 영문·숫자·한글로 입력해 주세요.';$('inId').focus();return false;
    }
    studentId=id;
    if(window.HalomathProfile)HalomathProfile.saveStudentId(activeMode,studentId);
  }else{
    studentId='';
  }
  playerName=name;
  if(window.HalomathProfile)HalomathProfile.saveName(activeMode,playerName);
  e.textContent='';
  return true;
}
profileInit();

/* 전체화면 전환은 사용자가 누른 순간에만 허용된다. 시작 버튼이 그 기회다 */
$('startBtn').onclick=function(){
  if(!hasAdminPreviewAccess()){showPreviewLocked();return}
  if(!profileCommit())return;
  if(wantsFS())fsRequest();
  audioUnlock();
  startGame();
};
function startGame(){resetG();startRound(1,true)}
function setOverlay(id,on){
  var el=$(id);if(!el)return;
  el.hidden=!on;
  el.classList.toggle('is-on',!!on);
  if(on)el.style.display='flex';else el.style.display='';
}
function startRound(r,withGuide){
  G.round=r;newRound(r);drag=null;fx=[];fxClear();fliers.length=0;
  shake.mag=0;shake.until=0;applyStage(0,0);
  setOvenFocus(false);
  setOverlay('endConfirm',false);
  setEndBtn(false);
  S.guide=true;
  var ic=[];DISHES.forEach(function(d,i){if(owned(i))ic.push(d.ico)});
  $('hudTitle').textContent='R'+r+' / '+LAST_ROUND;
  $('riIco').textContent=ic.join(' ');
  $('riTitle').textContent=r+'라운드';
  var msg=r===1?'<b>냥 바게트</b> 주문이 들어와요. 바게트는 반죽 마디가 한 줄로 길게 이어져요. <b>반죽 1개가 원본 바게트</b>예요!'
    :'오늘도 손님이 몰려와요!'+(GIANT_AT[r]?'<br>👑 <b>자이언트</b> 손님이 올 수도 있어요!':'');
  DISHES.forEach(function(d,i){if(d.unlockR===r&&r>1)msg+='<br>🆕 <b>'+d.name+'</b>을 열 수 있어요! 재료 선반의 🔒를 눌러 코인으로 열어요.'});
  $('riDesc').innerHTML=msg;
  slotEls.forEach(function(el){el.dataset.cid='';el.dataset.mode='';el.dataset.f=''});
  if(withGuide&&G.hintOn){setOverlay('guide',true);setOverlay('rintro',false)}
  else{setOverlay('guide',false);setOverlay('rintro',true)}
  show('play');last=performance.now();updateAll();requestAnimationFrame(loop);
}
function endGuide(){
  if(!S.guide)return;
  S.guide=false;G.hintOn=false;setOverlay('guide',false);setOverlay('rintro',false);setEndBtn(true);
  last=performance.now();updateAll();
}
$('guideBtn').onclick=function(){setOverlay('guide',false);setOverlay('rintro',true)};
$('riBtn').onclick=endGuide;

function update(dt){
  S.time+=dt;
  if(!S.warned&&S.roundT-S.time<=10){S.warned=true;sfx('warn')}
  /* 오븐 집중 중에는 손님 인내심만 느리게 흐름 (라운드 시계는 그대로) */
  var waitDt=isOvenFocus()?dt*PATIENCE_SLOW:dt;
  S.cust.forEach(function(c){
    if(c.state==='wait'){
      c.wait+=waitDt;
      if(c.wait>=c.pat){c.state='angry';c.until=S.time+0.9;S.streak=0;S.left++;G.leftAll++;sfx('angry');floatAtSlot(c.slot,'떠났어요','bad');toast('💢 손님이 화나서 떠났어요')}
    }else if((c.state==='happy'||c.state==='angry')&&S.time>=c.until){
      var sp=c.state==='happy'?c.speed:0;
      c.state='gone';callNext(sp);c.slot=-1;
    }
  });
  if(freeSeat()>=0&&canSpawnMore()){
    if(S.giants.length&&S.time>=S.giants[0]){S.giants.shift();spawn(true)}
    else if(S.time>=S.nextAt)spawn(false);
  }
  S.cust=S.cust.filter(function(c){return c.state!=='gone'});
}
/* 손님이 떠나면 다음 손님이 온다. 빨리 해결(인내심이 많이 남음)할수록 더 빨리! */
function callNext(speed){
  var at=S.time+1.2+2.8*(1-clamp(speed,0,1));
  if(S.nextAt<=S.time||S.nextAt>at)S.nextAt=at;
}
var last=0;
function loop(now){
  if(S.phase!=='play')return;
  var dt=Math.min(0.1,(now-last)/1000);last=now;
  if(S.guide){requestAnimationFrame(loop);return}
  update(dt);
  tickShake(now);
  if(S.time>=S.roundT){finishRound();return}
  updateHud();renderBench();renderOven();renderFocusRing();renderFly();
  requestAnimationFrame(loop);
}
function row(a,b){return '<tr><td>'+a+'</td><td class="r">'+(b>0?'+':'')+b+'</td></tr>'}
function ledgerRows(o){
  return row('서빙 보상',o.reward)+row('빨리 서빙 보너스',o.patience)+row('콤보 보너스',o.combo)+row('닮은 모양이 아닌 빵 서빙 ('+o.notSimilar+'회)',-o.penalty);
}
function finishRound(){
  S.phase='roundEnd';
  setOvenFocus(false);
  setEndBtn(true);
  shake.mag=0;shake.until=0;applyStage(0,0);fxClear();
  sfx('roundEnd');
  var net=S.reward+S.patience+S.combo-S.penalty;
  var entry={r:S.round,net:net,reward:S.reward,patience:S.patience,combo:S.combo,penalty:S.penalty,notSimilar:S.wrong.notSimilar,served:S.served,left:S.left};
  G.log.push(entry);G.servedAll+=S.served;
  if(S.round<LAST_ROUND){
    $('reTitle').textContent=(net>=250?'🏆 ':net>=120?'👍 ':'😺 ')+S.round+'라운드 끝!';
    $('reSub').textContent='손님 '+S.served+'명 서빙 · 떠난 손님 '+S.left+'명 · 보유 🪙 '+G.wallet;
    $('reLedger').innerHTML=ledgerRows(entry)+'<tr class="total"><td>이번 라운드 수입</td><td class="r">'+net+'코인</td></tr>';
    $('nextBtn').textContent=(S.round+1)+'라운드 ▶';
    show('roundEnd');
  }else finishGame();
}
/* ===== 즉석 업그레이드 (게임 중에 바로 구입) ===== */
function spend(cost,msg){
  if(S.phase!=='play'||S.guide||isOvenFocus())return false;
  if(G.wallet<cost){toast('🪙 코인이 모자라요 (앞으로 '+(cost-G.wallet)+'코인)');sfx('miss');return false}
  G.wallet-=cost;sfx('buy');bumpCoins();toast('✅ '+msg,1700);return true;
}
function buyDish(i){var D=DISHES[i];if(owned(i))return false;
  if(S.round<D.unlockR){toast('🔒 '+D.unlockR+'라운드부터 열 수 있어요');return false}
  if(!spend(D.price,D.name+' 오픈! 이제 주문이 들어와요'))return false;G.u.dish[i]=1;updateAll();return true}
function upDish(i){var lv=LV(i);if(!lv||lv>=3)return false;var D=DISHES[i];
  if(!spend(D.up[lv-1],D.name+' Lv'+(lv+1)+'! '+D.lvDesc[lv+1]+' (코인 ×'+LVMULT[lv+1]+')'))return false;G.u.dish[i]=lv+1;updateAll();return true}
function upOven(){var ov=G.u.oven;if(ov>=3)return false;
  if(!spend(OVEN[ov+1].cost,OVEN[ov+1].name+'! '+OVEN[ov+1].desc))return false;G.u.oven=ov+1;if(S.oven.state==='idle')S.oven.need=OVEN[ov+1].taps;updateAll();return true}
function buyBag(n){if(G.u.bag[n])return false;if(!spend(BAGCOST[n],'한 번에 '+n+'개씩 넣을 수 있어요!'))return false;G.u.bag[n]=1;updateAll();return true}
$('ovenUp').addEventListener('click',function(){if(!isOvenFocus())upOven()});
function renderUpg(){
  dishEls.forEach(function(el,i){
    var D=DISHES[i],lk=el.querySelector('.lk'),ub=el.querySelector('.upb'),h;
    if(!owned(i)){
      var can=S.round>=D.unlockR;
      h=can?'🔒<span class="lk-cost">'+D.price+'</span>':'🔒<span class="lk-cost">R'+D.unlockR+'</span>';
      if(lk.innerHTML!==h)lk.innerHTML=h;
      el.classList.toggle('canbuy',can&&G.wallet>=D.price);
      ub.style.display='none';
    }else{
      var lv=LV(i);el.classList.remove('canbuy');ub.style.display='';
      if(lv<3){ub.innerHTML='⬆ '+D.up[lv-1];ub.classList.toggle('can',G.wallet>=D.up[lv-1])}
      else{ub.innerHTML='★';ub.classList.remove('can')}
    }
  });
  var ov=G.u.oven,ob=$('ovenUp');
  if(ov<3){
    ob.innerHTML='⬆ '+OVEN[ov+1].cost;
    ob.title=OVEN[ov+1].name+' · '+OVEN[ov+1].desc;
    ob.classList.toggle('can',G.wallet>=OVEN[ov+1].cost);ob.style.display='';
  }else{ob.innerHTML='★';ob.title='황금 오븐';ob.classList.remove('can')}
}
$('nextBtn').onclick=function(){startRound(G.round+1,false)};

function askEndGame(){
  if(S.phase!=='play'&&S.phase!=='roundEnd')return;
  if(S.phase==='play'&&S.guide)return;
  setOverlay('endConfirm',true);
}
function cancelEndGame(){setOverlay('endConfirm',false)}
function confirmEndGame(){
  setOverlay('endConfirm',false);
  if(S.phase==='play'){
    var net=S.reward+S.patience+S.combo-S.penalty;
    G.log.push({r:S.round,net:net,reward:S.reward,patience:S.patience,combo:S.combo,penalty:S.penalty,notSimilar:S.wrong.notSimilar,served:S.served,left:S.left});
    G.servedAll+=S.served;
  }
  finishGame();
}
$('endBtn').onclick=askEndGame;
$('reEndBtn').onclick=askEndGame;
$('endConfirmBtn').onclick=confirmEndGame;
$('endCancelBtn').onclick=cancelEndGame;

function finishGame(){
  setOvenFocus(false);
  setEndBtn(false);
  setOverlay('endConfirm',false);
  setOverlay('guide',false);
  setOverlay('rintro',false);
  var sum=G.earned+30;
  $('resTitle').textContent=sum>=1200?'🏆 대성공!':sum>=600?'👍 잘했어요!':'😺 수고했어요!';
  $('resSub').textContent='총 벌어들인 코인이 점수예요!';
  var h='<tr><th>라운드</th><th class="r">코인</th></tr>';
  G.log.forEach(function(l){h+='<tr><td>R'+l.r+' · 손님 '+l.served+'명</td><td class="r">'+l.net+'</td></tr>'});
  h+=row('참여 보너스',30)+'<tr class="total"><td>최종 점수</td><td class="r">'+sum+'코인</td></tr>';
  $('ledger').innerHTML=h;
  var t=[],w=G.wrongAll;
  t.push('🗣️ <b>함께 생각해 봐요</b><br>① 닮음비가 커질 때 재료 개수는 어떻게 달라졌나요?<br>② 바게트, 토스트, 케이크는 왜 늘어나는 방식이 다를까요?');
  if(w.notSimilar>0)t.push('🙅 원본과 모양이 다른 빵을 서빙한 적이 있어요. 어떻게 하면 원본과 닮은 모양이 될까요?');
  if(G.trashedAll>0)t.push('🗑️ 버린 빵 '+G.trashedAll+'개 (낭비한 재료 '+G.wastedAll+'개).');
  $('insight').innerHTML=t.join('<br>');
  S.phase='result';show('result');
  submitScore(sum);
  fetchRanking();
}

/* ===== 랭킹 =====
   점수는 설계대로 「번 코인의 합 + 참여 30」이다. 높을수록 좋다.
   쓰기·읽기는 다른 아케이드와 같이 scores/ 평탄 경로 + 레거시 dorms 하위. */
function submitScore(score){
  var msg=$('rankMsg');
  if(!playerName){msg.textContent=nameFieldLabel()+'이 없어 랭킹에 올리지 않았어요.';return}
  if(!firebaseDb||!window.HalomathScores){
    msg.className='title2 err';
    msg.textContent='랭킹 서버에 연결하지 못했어요. 점수는 화면에만 남아요.';
    return;
  }
  msg.className='title2';msg.textContent='⏳ 랭킹에 올리는 중…';
  var payload={
    score:score,
    gameId:GAME_ID,
    timestamp:(window.firebase&&firebase.database&&typeof firebase.database.ServerValue!=='undefined')
      ?firebase.database.ServerValue.TIMESTAMP:Date.now()
  };
  HalomathScores.submitScore(firebaseDb,{
    activeMode:activeMode,
    name:playerName,
    studentId:studentId,
    gameIds:GAME_IDS,
    payload:payload,
    compareMode:'higher',
    acceptEntry:function(v){return v&&typeof v.score==='number'},
    updatedMessage:'🎉 최고 기록을 '+score+'코인으로 갱신했어요!',
    createdMessage:'🎉 '+score+'코인이 랭킹에 올랐어요!',
    unchangedMessage:'ℹ️ 예전 최고 기록이 더 높아 그대로 뒀어요.'
  }).then(function(r){
    msg.className='title2 '+(r&&r.success?'ok':'err');
    msg.textContent=(r&&r.message)||'랭킹 등록을 마쳤어요.';
    fetchRanking();
  }).catch(function(){
    msg.className='title2 err';
    msg.textContent='랭킹 등록에 실패했어요. 점수는 화면에 남아요.';
  });
}
function rankRows(list){
  if(!list.length)return '<tr><td>아직 기록이 없어요</td></tr>';
  var nameTh=activeMode==='dorms'?'닉네임':'이름';
  var h='<tr><th>순위</th><th>'+nameTh+'</th>'+(activeMode==='school'?'<th>학번</th>':'')+'<th class="r">코인</th></tr>';
  list.forEach(function(e,i){
    var me=window.HalomathScores&&HalomathScores.matchesPlayer(e,playerName,studentId,activeMode);
    var sid=e.studentId&&e.studentId!=='DORMS'&&e.studentId!=='DOREMS'?e.studentId:'—';
    h+='<tr'+(me?' class="me"':'')+'><td>'+(i+1)+'</td><td>'+esc(e.name||'')+'</td>'
      +(activeMode==='school'?'<td>'+esc(sid)+'</td>':'')
      +'<td class="r">'+Math.round(e.score||0)+'</td></tr>';
  });
  return h;
}
function collectKitchenScores(dataObj){
  var best=new Map();
  function walk(obj,inDorms){
    if(!obj||typeof obj!=='object')return;
    Object.keys(obj).forEach(function(key){
      var item=obj[key];
      if(!item||typeof item!=='object')return;
      if(item.name&&typeof item.score==='number'){
        if(window.HalomathScores){
          if(!HalomathScores.matchesGameId(item,GAME_IDS))return;
        }else if(String(item.gameId||'')!==GAME_ID)return;
        var isDorms=inDorms||(window.HalomathScores&&HalomathScores.isDormsRecord(item));
        if(activeMode==='dorms'? !isDorms : isDorms)return;
        var name=sanitize(item.name,12);
        var sid=String(item.studentId||'').trim();
        var score=Math.max(0,Math.round(Number(item.score)||0));
        var userKey=activeMode==='school'?name+'_'+sid:name;
        var prev=best.get(userKey);
        if(!prev||score>prev.score)best.set(userKey,{name:name,studentId:sid,score:score});
        return;
      }
      walk(item,inDorms||key==='dorms'||key==='dorems');
    });
  }
  walk(dataObj,false);
  return Array.from(best.values()).sort(function(a,b){return b.score-a.score});
}
function processRankingData(dataObj){
  var list=collectKitchenScores(dataObj||{});
  $('rankTable').innerHTML=rankRows(list.slice(0,20));
}
function fetchRanking(){
  var REST='https://math-game-halogini-default-rtdb.firebaseio.com';
  function viaRest(){
    var ctl=new AbortController(),to=setTimeout(function(){ctl.abort()},3500);
    Promise.all([
      fetch(REST+'/scores.json',{signal:ctl.signal}).then(function(r){return r.json()}).catch(function(){return null}),
      fetch(REST+'/scores/dorms.json',{signal:ctl.signal}).then(function(r){return r.json()}).catch(function(){return null})
    ]).then(function(parts){
      clearTimeout(to);
      var combined={};
      if(parts[0]&&typeof parts[0]==='object')Object.assign(combined,parts[0]);
      if(parts[1]&&typeof parts[1]==='object')Object.assign(combined,parts[1]);
      processRankingData(combined);
    }).catch(function(){
      clearTimeout(to);
      $('rankTable').innerHTML='<tr><td>랭킹을 불러오지 못했어요</td></tr>';
    });
  }
  if(firebaseDb){
    var done=false;
    var to=setTimeout(function(){if(done)return;done=true;viaRest()},2500);
    firebaseDb.ref('scores').once('value').then(function(snap){
      return firebaseDb.ref('scores/dorms').once('value').then(function(snapD){
        if(done)return;done=true;clearTimeout(to);
        var combined={};
        var a=snap.val(),b=snapD.val();
        if(a&&typeof a==='object')Object.assign(combined,a);
        if(b&&typeof b==='object')Object.assign(combined,b);
        processRankingData(combined);
      });
    }).catch(function(){
      if(done)return;done=true;clearTimeout(to);viaRest();
    });
    return;
  }
  viaRest();
}
$('againBtn').onclick=function(){setEndBtn(false);setOverlay('endConfirm',false);show('intro')};

/* ===== 화면 맞추기 =====
   기기마다 화면 크기가 제각각이라, 정해진 크기로 만든 화면을 통째로 줄이거나 키워서 맞춘다.
   DESIGN : 태블릿·PC 기준. COMPACT: 폰 가로(낮은 높이).
   safe-area는 CSS padding으로 흡수하고, 스케일은 visualViewport 기준으로 잡는다. */
var DESIGN={w:1024,h:720},COMPACT={w:860,h:420},MAX_S=1;
/* 폰 가로에서 「실제 크기로 배치」를 보장하는 최소 상자. 이보다 작을 때만 축소한다 */
var PHONE_MIN={w:640,h:318};
var VIEW={w:1024,h:716,s:1,q:1,compact:false,ox:0,oy:0};
var stage=$('stage');
function applyStage(dx,dy){
  stage.style.transform='translate('+(VIEW.ox+dx)+'px,'+(VIEW.oy+dy)+'px) scale('+VIEW.s+')';
}
function tickShake(now){
  if(now>=shake.until){if(shake.mag){shake.mag=0;applyStage(0,0)}return}
  var k=shake.mag;
  applyStage((Math.random()-0.5)*2*k,(Math.random()-0.5)*2*k);
}
var DBG=(function(){try{return new URLSearchParams(location.search).has('debug')}catch(e){return false}})();

function safePad(){
  var cs=getComputedStyle(document.documentElement);
  function read(name){return parseFloat(cs.getPropertyValue(name))||0}
  /* env()는 JS에서 직접 못 읽으므로, 임시 측정 노드로 읽는다 */
  var probe=document.getElementById('__safeProbe');
  if(!probe){
    probe=document.createElement('div');probe.id='__safeProbe';
    probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
  }
  var s=getComputedStyle(probe);
  return{
    t:parseFloat(s.paddingTop)||0,
    r:parseFloat(s.paddingRight)||0,
    b:parseFloat(s.paddingBottom)||0,
    l:parseFloat(s.paddingLeft)||0
  };
}
/* ===== 세로로 든 기기 돌려 주기 =====
   ROT: 0=그대로, 90=시계방향, -90=반시계방향. CSS의 force-landscape와 짝이다. */
var ROT=0,lastGamma=null,rotLocked=false;
try{
  window.addEventListener('deviceorientation',function(e){
    if(typeof e.gamma==='number')lastGamma=e.gamma;
  },true);
}catch(e){}
/* 폭이 넓으면(태블릿·PC) 건드리지 않는다. 폰이 세로일 때만 돌린다 */
function isNaturalPortrait(){
  var w=window.innerWidth,h=window.innerHeight;
  if(w>=800)return false;
  return h>w+28;
}
function applyForcedLandscape(on){
  var root=document.documentElement;
  if(on){
    if(!rotLocked){
      /* 기기를 어느 쪽으로 눕힐지는 기울기로 고른다. 모르면 시계방향 */
      ROT=(typeof lastGamma==='number'&&Math.abs(lastGamma)>=10)?(lastGamma>0?-90:90):90;
      rotLocked=true;
    }
    root.classList.add('force-landscape');
    root.classList.toggle('force-landscape-ccw',ROT<0);
  }else{
    ROT=0;rotLocked=false;
    root.classList.remove('force-landscape','force-landscape-ccw');
  }
}
/* 화면 좌표(손가락) -> 돌아간 게임 좌표.
   맞히기(elementFromPoint)와 사각형은 브라우저가 알아서 변환해 주므로 건드릴 필요가 없고,
   손가락 위치로 직접 무언가를 놓을 때만 이 변환이 필요하다. */
function toGame(sx,sy){
  if(!ROT)return{x:sx,y:sy};
  var vv=window.visualViewport;
  var w=Math.round((vv&&vv.width)||window.innerWidth);
  var h=Math.round((vv&&vv.height)||window.innerHeight);
  return ROT>0?{x:sy,y:w-sx}:{x:h-sy,y:sx};
}
function vpSize(){
  var vv=window.visualViewport;
  var w=Math.round((vv&&vv.width)||window.innerWidth);
  var h=Math.round((vv&&vv.height)||window.innerHeight);
  var pad=safePad();
  var box={w:Math.max(320,w-pad.l-pad.r),h:Math.max(240,h-pad.t-pad.b),ox:pad.l+(vv&&vv.offsetLeft||0),oy:pad.t+(vv&&vv.offsetTop||0)};
  /* 돌렸으면 게임이 쓰는 가로·세로가 서로 바뀐다 */
  if(ROT)return{w:box.h,h:box.w,ox:0,oy:0};
  return box;
}
function hidpi(cv,w,h,q){
  var W=Math.round(w*q),H=Math.round(h*q);
  if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
  cv.getContext('2d').setTransform(q,0,0,q,0,0);
}
function setupCanvases(){
  var q=clamp(Math.round((window.devicePixelRatio||1)*VIEW.s*100)/100,1,3);
  if(q===VIEW.q)return false;
  VIEW.q=q;
  hidpi(bcv,BW,BH,q);hidpi(ocv,OW,OH,q);hidpi(ghost,200,200,q);
  if(focusCv)hidpi(focusCv,FOCUS_W,FOCUS_H,q);
  slotEls.forEach(function(el){hidpi(el.querySelector('canvas'),SLOT_W,SLOT_H,q)});
  dishEls.forEach(function(el){hidpi(el.querySelector('canvas'),100,70,q)});
  srcEls.forEach(function(el){hidpi(el.querySelector('canvas'),200,180,q)});
  ghost.style.width=(200*VIEW.s)+'px';ghost.style.height=(200*VIEW.s)+'px';
  return true;
}
function invalidate(){
  dishEls.forEach(function(el){el.dataset.lv=''});
  srcEls.forEach(function(el){el.dataset.key=''});
  slotEls.forEach(function(el){el.dataset.cid='';el.dataset.mode='';el.dataset.f=''});
  if(S&&S.oven)updateAll();else renderShelf();
}
function fit(){
  applyForcedLandscape(isNaturalPortrait());
  var v=vpSize();
  /* 폰 가로(낮은 높이)·초광폭은 compact. 태블릿 가로는 기본 레이아웃 유지 */
  /* 여유 레이아웃(DESIGN)이 거의 그대로 들어가는 화면에서만 그걸 쓴다.
     안 들어가면 통째로 축소하지 말고 촘촘한 레이아웃을 「실제 크기」로 편다.
     축소는 글자와 터치 칸을 같이 줄여서, 960x545 태블릿에서 글자 11.4px,
     터치 33px까지 내려가 있었다. */
  var compact=!(v.w>=DESIGN.w*0.95&&v.h>=DESIGN.h*0.95);
  /* 폰에서는 줄이지 않고 화면 크기 그대로 배치한다.
     태블릿처럼 통째로 축소하면 글자가 10px, 터치 칸이 31px까지 작아져 못 쓴다.
     PHONE_MIN보다 작은 화면에서만 줄인다. */
  var D=compact?{w:Math.max(v.w,PHONE_MIN.w),h:Math.max(v.h,PHONE_MIN.h)}:DESIGN;
  document.documentElement.classList.toggle('compact',compact);
  /* 장면 배치(kitchen-play.png 한 장 위에 조작 요소를 올림)를 모든 화면에서 쓴다 */
  document.documentElement.classList.toggle('scene-v2',true);
  BBASE=229;
  stage.style.width=D.w+'px';stage.style.height=D.h+'px';
  /* 장면 그림은 폭에 맞추되, 낮은 화면(폰 가로)에서는 세로만 조금 눌러서 손님이 설 띠를 남긴다.
     장면 높이 bh = 자연 높이(폭×0.6688)와 「위 136px(HUD 36 + 손님 100) 빼고 카운터 48%」 중 작은 쪽.
     그림의 위쪽은 화면 밖으로 잘리고, 손님 줄은 카운터 뒤 가장자리(52%)에서 위로 rowh만큼 선다. */
  var bh=Math.min(D.w*0.6688,(D.h-136)/0.48),crop=Math.max(0,bh-D.h);
  stage.style.setProperty('--bh',bh.toFixed(1)+'px');
  stage.style.setProperty('--rowh',Math.max(64,Math.min(0.52*bh,0.52*bh-crop-36)).toFixed(1)+'px');
  var s=Math.min(v.w/D.w,v.h/D.h,MAX_S);
  VIEW.w=v.w;VIEW.h=v.h;VIEW.s=s;VIEW.compact=compact;
  VIEW.ox=v.ox+(v.w-D.w*s)/2;VIEW.oy=v.oy+(v.h-D.h*s)/2;
  applyStage(0,0);
  if(setupCanvases())invalidate();
  syncFly();
  layoutChrome();
  renderDbg();
}
var fitQ=0;
function refit(){if(fitQ)return;fitQ=requestAnimationFrame(function(){fitQ=0;fit()})}

/* ===== 전체화면 (shared/mobile-fullscreen.js와 같은 동작을 단일 HTML 규칙에 맞춰 옮김) ===== */
function wantsFS(){
  try{
    if(matchMedia('(any-hover: hover) and (any-pointer: fine)').matches)return false; // 터치 노트북 제외
    return matchMedia('(pointer: coarse)').matches;
  }catch(e){return false}
}
function fsSupported(){var r=document.documentElement;return !!(r.requestFullscreen||r.webkitRequestFullscreen)}
function fsActive(){return !!(document.fullscreenElement||document.webkitFullscreenElement)}
function fsRequest(){
  if(!fsSupported()||fsActive())return;
  var r=document.documentElement,p=r.requestFullscreen?r.requestFullscreen():r.webkitRequestFullscreen();
  if(p&&typeof p.catch==='function')p.catch(function(){});
}
/* 버튼 글자 폭은 기기·언어에 따라 달라진다. 자리를 재서 비워 두면 코인 표시를 덮지 않는다 */
function layoutChrome(){
  var h=document.querySelector('.hud');
  if(h)h.style.paddingRight=($('chrome').offsetWidth+14)+'px';
}
function syncFsBtn(){$('fsBtn').classList.toggle('on',fsSupported()&&wantsFS()&&!fsActive());layoutChrome()}
$('fsBtn').addEventListener('click',function(e){e.stopPropagation();fsRequest()});

/* 소리 끄기/켜기. 교실에서 태블릿이 한꺼번에 울리는 상황을 위해 눈에 띄게 둔다 */
$('sndBtn').addEventListener('click',function(e){
  e.stopPropagation();
  SND.on=!SND.on;
  try{localStorage.setItem('nyang.sound',SND.on?'on':'off')}catch(err){}
  sndSync();
  if(SND.on){audioUnlock();sfx('coin')}
});
/* 첫 터치에서 소리를 깨운다 (모바일 브라우저 규칙) */
window.addEventListener('pointerdown',function once(){
  audioUnlock();window.removeEventListener('pointerdown',once,true);
},true);

function renderDbg(){
  if(!DBG)return;
  var d=$('dbg');d.style.display='block';
  d.textContent='화면 '+VIEW.w+'×'+VIEW.h+'   배율 '+VIEW.s.toFixed(3)+'\n'
    +'DPR '+(window.devicePixelRatio||1)+'   캔버스 '+VIEW.q+'배\n'
    +'모드 '+(VIEW.compact?'좁은화면':'기본')+'   전체화면 '+(fsActive()?'O':'X')+'\n'
    +'포인터 '+(COARSE?'터치':'마우스')+'   드래그 '+DRAG_SLOP+'px';
}

window.addEventListener('resize',refit);
window.addEventListener('orientationchange',function(){setTimeout(fit,260)});
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',refit);
  window.visualViewport.addEventListener('scroll',refit);
}
['fullscreenchange','webkitfullscreenchange'].forEach(function(t){
  document.addEventListener(t,function(){syncFsBtn();setTimeout(fit,90)});
});
/* iOS는 user-scalable=no를 무시한다. 핀치·더블탭 확대와 길게 누르기 메뉴를 직접 막는다 */
['gesturestart','gesturechange','gestureend'].forEach(function(t){
  document.addEventListener(t,function(e){e.preventDefault()},{passive:false});
});
/* 입력칸은 빼 준다. 길게 누르기·더블탭으로 글자를 고르고 붙여넣어야 한다 */
function inField(e){var t=e.target;return !!(t&&t.tagName&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'))}
document.addEventListener('dblclick',function(e){if(!inField(e))e.preventDefault()},{passive:false});
document.addEventListener('contextmenu',function(e){if(!inField(e))e.preventDefault()});

gateAdminPreview(function(){
  fit();syncFsBtn();sndSync();applyTrashArt();
});

window.__api={chooseDish:chooseDish,selectDish:selectDish,addFromShelf:addFromShelf,addN:addN,toOven:toOven,cookTap:cookTap,setClock:function(f){clock=f},
  serveDish:serveDish,discard:discard,tick:function(d){update(d);updateAll()},endGuide:endGuide,startGame:startGame,startRound:startRound,
  finishRound:finishRound,slotCust:slotCust,judge:judge,needOf:needOf,baseOf:baseOf,spawn:spawn,buyDish:buyDish,upDish:upDish,upOven:upOven,buyBag:buyBag,
  setRnd:function(f){rnd=f},refresh:refresh,newDish:newDish,earn:earn,
  fit:fit,view:function(){return VIEW},
  tapSource:tapSource,fliers:function(){return fliers.length},
  tapAmt:function(i,n){return tapSource(i,srcEls[i],n)}};
})();
