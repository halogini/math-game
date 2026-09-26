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
/* 관리자 미리보기만 허용. 포털 관리자 로그인 중이거나 이메일 계정이 있을 때만.
   localhost·127.0.0.1·file:// 은 로컬 개발용으로 통과한다. */
function isLocalDev(){
  try{
    if(location.protocol==='file:')return true;
    var h=location.hostname;
    return h==='localhost'||h==='127.0.0.1'||h==='[::1]';
  }catch(e){return false}
}
function hasAdminPreviewAccess(){
  if(isLocalDev())return true;
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
/* 손님 인내심 배율. 1이면 예전 값(44+7√N초, 54~86초)이다. 0.6이면 약 32~52초.
   예전 값은 라운드(70초)보다 길어서 손님이 거의 떠나지 않았고, 가게 붕괴가 일어날 수 없었다 */
var PAT_SCALE=0.6;
/* 화나서 떠난 손님이 판 전체(4라운드)에서 이 수가 되면 가게가 무너진다 */
var COLLAPSE_AT=5;
var ANIMALS=[
  ['🦁','사자','cust2-lion'],['🐯','호랑이','cust2-tiger'],['🦛','하마','cust2-hippo'],
  ['🐘','코끼리','cust2-elephant'],['🦒','기린','cust2-giraffe'],['🦏','코뿔소','cust2-rhino'],['🐻','곰','cust2-bear']
];
var DISHES=[
  {name:'냥 바게트',ing:'반죽',ico:'🥖',dim:1,max:15,tile:'#e8a94f',edge:'#b8742a',raw:'#f6e6c8',rawEdge:'#dcc08e',unit:'개',unlockR:1},
  {name:'냥 토스트',ing:'식빵',ico:'🍞',dim:2,max:120,tile:'#ffd24a',edge:'#e0a800',raw:'#f6e8b8',rawEdge:'#d8c48a',unit:'개',unlockR:2},
  {name:'냥 케이크',ing:'스펀지',ico:'🍰',dim:3,max:130,tile:'#ff8fb1',edge:'#e0507c',raw:'#ffdbe6',rawEdge:'#e8b4c6',unit:'개',unlockR:3}
];
var OVEN=[null,{taps:3,name:'기본 오븐',cost:0,desc:'3번 탭'},{taps:2,name:'벽돌 오븐',cost:75,desc:'2번만 탭!'},{taps:1,name:'황금 오븐',cost:150,desc:'1번만 탭!'}];
var BAGS=[1,5,10,50,100],BAGCOST={1:0,5:25,10:50,50:95,100:150};
/* 빵마다 실제로 쓰는 칩만 노출 (바게트 최대 N=12 → 50·100 제외) */
var DISH_BAGS=[[1,5,10],[1,5,10,50,100],[1,5,10,50,100]];
var PAL=[null,{rim:'#c98a4b',base:'#f6e3b5',tile:'#ffd24a',edge:'#e0a800',dot:'#f0b800',dash:'rgba(160,110,60,.55)'},null];
/* 주문 배율 후보 [배율, 이 라운드부터] */
var POOL=[
  [[2,1],[3,1],[4,1],[5,1],[6,2],[7,2]],
  [[2,1],[3,1],[4,1],[5,2],[6,3]],
  [[2,1],[2,1],[2,1],[3,1],[3,2]]
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
  close:function(){tone(520,0,0.12,'triangle',0.32)},
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
  rumble:function(){tone(70,0,0.5,'sawtooth',0.22,45);tone(95,0.05,0.35,'triangle',0.18,60)},
  crack:function(){tone(1400,0,0.05,'square',0.18,300);tone(180,0.04,0.45,'sawtooth',0.28,50)},
  collapse:function(){tone(60,0,1.4,'sawtooth',0.34,30);tone(120,0.1,1.1,'square',0.22,40);run([392,330,262,196,131],'triangle',0.3,0.16,0.3)},
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
/* 서빙 보상: 손님 자리에서 지갑으로 코인이 날아간다. 코인은 이미 들어왔고, 이건 보여 주기만 한다.
   번 코인이 많을수록 금화도 많아진다. 마지막 코인이 닿을 때 지갑 숫자가 통통 튄다 */
function flyCoins(slot,gain){
  var el=slotEls[slot],w=$('coinsTxt');
  if(!el||!w||!Element.prototype.animate){bumpCoins();return}
  var a=stageXY(el),b=stageXY(w),n=Math.max(3,Math.min(16,3+Math.floor(gain/40))),DUR=620;
  var GAP=Math.min(70,Math.floor(860/Math.max(1,n-1))),step=Math.min(14,180/n);
  for(var i=0;i<n;i++)(function(i){
    var d=document.createElement('div');d.className='coinfly';d.textContent='🪙';
    d.style.left=a.x+'px';d.style.top=a.y+'px';
    fxAdd(d);
    var sx=(i-(n-1)/2)*step,dx=b.x-a.x,dy=b.y-a.y;
    var an=d.animate([
      {transform:'translate(-50%,-50%) translate(0,0) scale(.6)',opacity:0},
      {transform:'translate(-50%,-50%) translate('+sx+'px,-36px) scale(1.1)',opacity:1,offset:0.25},
      {transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px) scale(.7)',opacity:1}
    ],{duration:DUR,delay:i*GAP,easing:'ease-in',fill:'both'});
    an.onfinish=function(){fxDrop(d);if(i===n-1){bumpCoins();sfx('coin')}};
  })(i);
}
var shake={until:0,mag:0};
function doShake(mag,ms){shake.mag=mag;shake.until=performance.now()+ms}

/* ===== 가게 붕괴 =====
   화나서 떠난 손님 수(G.leftAll, 판 전체)에 따라 숫자 없이 신호로만 알린다.
   1회 먼지 한 번 · 2회 조명 깜빡 · 3회 먼지가 자주 + 조명이 계속 살짝 떨림 · 4회 흔들림 + 벽에 금 · 5회 무너짐.
   어두워지는 막(.shop-dim)은 배경 그림만 덮는다(손님·카드·재료보다 아래). 주문 카드 숫자는 늘 밝게 읽힌다.
   먼지는 화면 양 가장자리에서만 떨어진다 */
var shopFx=null;
function shopLayer(){
  if(shopFx)return shopFx;
  var body=document.querySelector('#play .scene-body');if(!body)return null;
  var dim=document.createElement('div');dim.className='shop-dim';
  var crack=document.createElement('div');crack.className='shop-cracks';
  crack.innerHTML='<svg viewBox="0 0 1280 640" preserveAspectRatio="none">'
    +'<path d="M300 18 L292 52 L310 80 L296 118 L318 150 L304 182"/><path d="M296 118 L270 132 L258 158"/>'
    +'<path d="M720 10 L732 44 L716 70 L738 104 L726 140"/><path d="M716 70 L748 78 L760 98"/></svg>';
  var dust=document.createElement('div');dust.className='shop-dust';
  body.appendChild(dim);body.appendChild(crack);body.appendChild(dust);
  shopFx={body:body,dim:dim,crack:crack,dust:dust};
  return shopFx;
}
/* 라운드가 바뀌어도 금과 떨림은 남는다(판 전체로 센다) */
function shopState(){
  var L=shopLayer();if(!L)return;var n=G.leftAll||0;
  L.body.classList.toggle('shop-unstable',n>=3);
  L.body.classList.toggle('shop-cracked',n>=4);
  L.body.classList.remove('shop-collapse');
}
function dustFall(n){
  var L=shopLayer();if(!L)return;
  for(var i=0;i<n;i++){
    var d=document.createElement('i'),left=Math.random()<0.5;
    d.style.left=(left?0.5+Math.random()*4:95.5+Math.random()*4)+'%';
    d.style.animationDelay=(Math.random()*0.35)+'s';
    d.style.animationDuration=(1+Math.random()*0.5)+'s';
    L.dust.appendChild(d);
    setTimeout(function(x){return function(){if(x.parentNode)x.parentNode.removeChild(x)}}(d),2000);
  }
}
function lightFlicker(){
  var L=shopLayer();if(!L)return;
  L.dim.classList.remove('flick');void L.dim.offsetWidth;L.dim.classList.add('flick');
}
function shopWarn(){
  var n=G.leftAll;
  if(n>=COLLAPSE_AT){collapseShop();return}
  if(n===1){dustFall(5);sfx('rumble')}
  else if(n===2){dustFall(4);lightFlicker();sfx('rumble')}
  else if(n===3){dustFall(7);lightFlicker();sfx('rumble')}
  else if(n===4){dustFall(10);doShake(7,700);sfx('crack')}
  shopState();
}
function collapseShop(){
  if(S.phase!=='play')return;
  var net=S.reward+S.patience+S.combo-S.penalty;
  G.log.push({r:S.round,net:net,reward:S.reward,patience:S.patience,combo:S.combo,penalty:S.penalty,notSimilar:S.wrong.notSimilar,served:S.served,left:S.left});
  G.servedAll+=S.served;G.collapsed=true;
  S.phase='collapse';setOvenFocus(false);setEndBtn(false);
  var L=shopLayer();
  if(L){L.body.classList.add('shop-cracked','shop-collapse');dustFall(18)}
  sfx('collapse');
  /* 게임 루프가 멈췄으니 흔들림은 따로 돌린다 */
  var t0=performance.now();
  (function quake(now){
    var a=now-t0;if(a>1500){applyStage(0,0);return}
    var k=12*(1-a/1500);applyStage((Math.random()-0.5)*2*k,(Math.random()-0.5)*2*k);
    requestAnimationFrame(quake);
  })(t0);
  setTimeout(function(){if(S.phase==='collapse')finishGame()},2600);
}

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
     u:{oven:1,bag:{0:{1:1}},dish:{0:1}},wrongAll:{wrongDish:0,notSimilar:0,wrongSize:0,raw:0},trashedAll:0,wastedAll:0,servedAll:0,leftAll:0};
}
resetG();
function owned(t){return !!(G.u&&G.u.dish[t])}
/* 배율 칩은 빵마다 따로 산다. ×1은 빵이 열릴 때 함께 열린다 */
function hasBag(t,n){var b=G.u&&G.u.bag[t];return !!(b&&b[n])}
/* 칩은 작은 것부터 차례로 산다. 다음에 살 수 있는 칩 하나 (다 샀으면 0) */
function nextBag(t){var a=DISH_BAGS[t];for(var j=0;j<a.length;j++)if(!hasBag(t,a[j]))return a[j];return 0}
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
/* ===== 새 손님 종류 =====
   roo = 캥거루(만족시키면 자리를 뜨지 않고, 아기가 나온 모습으로 바뀌어 같은 빵을 1 : 1로 한 번 더 주문. 이때 kind는 joey)
   hurry = 급한 손님(예전 인내심의 절반, 보상 ×1.5, 2배 주문만).
   [종류, 이 라운드부터]. 한 번에 한 종류씩만 화면에 나온다. 첫 손님은 늘 보통 손님이다 */
var KINDS=[['roo',1],['hurry',4]];
var KIND_CHANCE=0.25,HURRY_MULT=1.5;
/* 그림이 생기기 전까지는 이모지로 보인다. 그림이 생기면 spr에 파일 이름(assets/*.png, 확장자 없이)을 넣는다 */
var KIND_LOOK={roo:['🦘','캥거루','cust2-kangaroo'],joey:['🦘','아기 캥거루','cust2-kangaroo-joey'],hurry:['🐎','경주마','cust2-horse']};
/* 표정 프레임이 있는 손님 그림(tools/face-frames.py가 만든 -blink, -happy). 기본 그림 위에 겹쳐 두고 CSS로 켠다:
   기다릴 때 가끔 눈 깜빡임, 서빙 성공(.happy)이면 웃는 얼굴. 윤곽은 기본 그림과 픽셀까지 같아 넘겨도 떨리지 않는다 */
/* 손님 그림 버전. 같은 파일 이름으로 그림을 바꾸면 이 숫자를 올린다(태블릿이 예전 그림을 저장해 두고 계속 보여 주지 않게) */
var ART_V=3;
var FACE_FRAMES={};   // 2026-09-26: 손님 그림을 「배경만 지우기」로 바꿔 예전 프레임과 어긋난다. tools/face-frames.py를 원본 격자(약 57칸)에 맞게 고친 뒤 다시 만들어 넣는다
function faceFrames(spr){
  if(!FACE_FRAMES[spr])return '';
  return '<span class="fr fr-blink"><img class="guest-spr" alt="" src="assets/'+spr+'-blink.png?v='+ART_V+'"></span>'
    +'<span class="fr fr-happy"><img class="guest-spr" alt="" src="assets/'+spr+'-happy.png?v='+ART_V+'"></span>';
}
function pickKind(){
  if(G.first)return '';
  var live={};S.cust.forEach(function(c){if(c.state!=='gone'&&c.kind)live[c.kind]=1});
  if(live.joey)live.roo=1;
  var av=KINDS.filter(function(p){return p[1]<=S.round&&!live[p[0]]}).map(function(p){return p[0]});
  if(!av.length||rnd()>=KIND_CHANCE)return '';
  return pick(av);
}
/* opt = {kind, dish, k}: 아기 캥거루처럼 주문을 정해 두고 만들 때 쓴다 */
function makeCust(giant,opt){
  var own=[];DISHES.forEach(function(d,i){if(owned(i))own.push(i)});
  var dish,k,tries,kind=opt?opt.kind:(giant?'':pickKind());
  if(opt&&opt.dish!=null){dish=opt.dish;k=opt.k}
  else if(giant){dish=pick(own);k=pick(GIANT[dish])}
  else{
    var bag=[];own.forEach(function(i){var w=(i===own[own.length-1]&&own.length>1)?2:1;for(var j=0;j<w;j++)bag.push(i)});
    for(tries=0;tries<30;tries++){
      dish=pick(bag);
      var ks=POOL[dish].filter(function(p){return p[1]<=S.round}).map(function(p){return p[0]});
      k=pick(ks);if(dish+':'+k!==S.lastKey)break;
    }
    if(G.first){dish=0;k=pick([2,3]);G.first=false}
    if(kind==='hurry')k=2;
  }
  S.lastKey=dish+':'+k;
  var N=needOf(dish,k),an=KIND_LOOK[kind]||pick(ANIMALS);
  var base=giant?Math.min(95,60+4*Math.sqrt(N)):44+7*Math.sqrt(N);
  var pat=Math.round(base*(kind==='hurry'?0.5:PAT_SCALE));   // 급한 손님은 예전 인내심의 절반
  return{id:S.nid++,k:k,dish:dish,giant:!!giant,kind:kind||'',N:N,pat:pat,fails:0,state:'wait',wait:0,slot:-1,until:0,
         an:an[0],anName:an[1],spr:an[2]||'',got:null,gotUntil:0,mood:''};
}
function freeSeat(){
  var used={};S.cust.forEach(function(c){if(c.slot>=0&&c.state!=='gone')used[c.slot]=true});
  for(var i=0;i<SLOTS;i++)if(!used[i])return i;return -1;
}
function liveCustCount(){
  var n=0;S.cust.forEach(function(c){if(c.state!=='gone')n++});return n;
}
/* 추가 시간: 70초가 지나도 기다리는 손님이 있으면 라운드를 끝내지 않는다.
   새 손님은 받지 않고, 남은 손님을 모두 서빙하거나 손님이 떠나면 끝난다 */
function overtime(){return S.time>=S.roundT}
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
function show(id){$('toast').classList.remove('on');document.documentElement.classList.toggle('in-play',id==='play');['intro','play','roundEnd','result'].forEach(function(s){$(s).classList.toggle('on',s===id)})}
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
/* 바게트 통그림의 「토막 단위」개수. 양 끝(L·R) + 가운데 n개 */
/* 바게트 길이 = 개수 × (개수 1일 때의 길이). 그래서 k개는 1개보다 정확히 k배 길다 (길이의 닮음비 1 : k).
   cell = 개수 1일 때의 길이(px). 굵기는 개수와 상관없이 같고(cell × BAG_THICK), 그림은 원래 비율로 그린다.
   양 끝(왼쪽 L, 오른쪽 R0~)은 그대로 두고 가운데 토막 수만 늘려서 전체 길이를 n·cell에 맞춘다. */
var BAG_REF=10,BAG_THICK=0.62;   /* BAG_REF개일 때 칸을 가득 채운다 / 굵기 = cell × BAG_THICK */
function fitCell(d,mw,mh,cap){
  var dim=DISHES[d.type].dim,c;
  if(piecesOn(d)){
    var e=pieceExt(d,1),cc=Math.min(cap,mw/e.w,mh/e.h);
    if(dim===1){ /* 바게트 : 10개일 때 칸을 꽉 채우는 크기가 기준. 10개 이하는 같은 크기로 짧아지고, 10개를 넘으면 칸에 맞춰 줄어든다 */
      cc=Math.min(cap,mw/Math.max(BAG_REF,d.n),mh/BAG_THICK);
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
  /* 바게트는 한 개를 통째로 그린 그림을 「왼쪽 끝 / 반복 토막 / 오른쪽 끝」으로 잘라 이어 붙인다.
     전체 길이는 항상 최대 개수(max)일 때와 같고, 개수가 적으면 가로로 늘려 맞춘다.
     bag = 그림 크기 W×H, 왼쪽 끝 L, 토막 폭 T(칼집 한 주기), 오른쪽 끝이 시작하는 곳 R0 (모두 그림 픽셀).
     minH = 개수가 많아도 줄어들지 않는 최소 높이(px) */
  {raw:'piece-baguette-raw',full:'piece-baguette-baked',bag:{W:1160,H:258,L:245,T:241,R0:900,minH:7}},
  {raw:'piece-toast-raw',full:'piece-toast-baked',wk:1.5,rT:0.505,tk:0.139},
  {raw:'piece-sponge-raw',full:'piece-sponge-baked',wk:1.732,rT:0.4575,eg:0.564}
];
function piecesOn(d){var P=PIECE[d.type];return !!(P&&SPRITE_READY&&SPRITE_READY[P.raw]&&SPRITE_READY[P.full])}
/* cell = 조각 하나의 기준 크기. 전체 폭·높이는 조각 수(d.w·d.h·d.s·d.L)로 정해진다 */
function pieceExt(d,cell){
  var dim=DISHES[d.type].dim,P=PIECE[d.type],W=cell*(P.wk||1);
  if(dim===1){
    var B=P.bag;
    return{W:W,w:cell*Math.max(1,d.n),h:Math.max(B.minH,cell*BAG_THICK)};
  }
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
/* 바게트 통그림을 잘라 둔 조각(왼쪽 끝 #L, 반복 토막 #M, 오른쪽 끝 #R). 처음 쓸 때 한 번만 만든다 */
function bagSlice(name,B,k){
  var key=name+'#'+k;
  if(SPRITE_READY[key])return key;
  var src=sprite(name),x0=k==='L'?0:k==='M'?B.L:B.R0,x1=k==='L'?B.L:k==='M'?B.L+B.T:B.W;
  var cv=document.createElement('canvas');cv.width=x1-x0;cv.height=src.height;
  cv.getContext('2d').drawImage(src,x0,0,x1-x0,src.height,0,0,x1-x0,src.height);
  SPRITE[key]=cv;SPRITE_READY[key]=true;return key;
}
function blitSlice(c,key,x,y,w,h){
  var sc=1;try{sc=Math.abs(c.getTransform().a)||1}catch(e){}
  c.drawImage(pieceImg(key,w*sc),x,y,w+0.8,h);   /* 조각 사이에 실금이 안 생기게 살짝 겹친다 */
}
function drawPieces(c,cx,baseY,cell,d,full){
  var dim=DISHES[d.type].dim,P=PIECE[d.type],e=pieceExt(d,cell),W=e.W,name=full?P.full:P.raw,i,j,l;
  if(dim===1){
    var B=P.bag,H=e.h;
    if(d.n<=0){c.save();c.setLineDash([4,3]);c.strokeStyle='rgba(180,150,100,.5)';c.lineWidth=1.5;c.beginPath();c.ellipse(cx,baseY-H/2,e.w*0.45,H*0.4,0,0,7);c.stroke();c.restore();return}
    var s0=H/B.H,Lw=B.L*s0,Rw=(B.W-B.R0)*s0,Tw=B.T*s0,tot=e.w,capsW=Lw+Rw,x=cx-tot/2,y=baseY-H;
    var kL=bagSlice(name,B,'L'),kM=bagSlice(name,B,'M'),kR=bagSlice(name,B,'R');
    if(tot<capsW+Tw){                     /* 아주 짧을 때(1개)는 양 끝 + 토막 하나를 통째로 조금 눌러서 붙인다(칼집이 한 줄 보이게) */
      var q=tot/(capsW+Tw);blitSlice(c,kL,x,y,Lw*q,H);x+=Lw*q;blitSlice(c,kM,x,y,Tw*q,H);x+=Tw*q;blitSlice(c,kR,x,y,Rw*q,H);
    }else{                                /* 가운데 토막을 원래 비율로 깔고, 길이에 맞게 조금만 늘이거나 줄인다 */
      var Lt=tot-capsW,nt=Math.max(1,Math.round(Lt/Tw)),mw=Lt/nt;
      blitSlice(c,kL,x,y,Lw,H);x+=Lw;
      for(i=0;i<nt;i++){blitSlice(c,kM,x,y,mw,H);x+=mw}
      blitSlice(c,kR,x,y,Rw,H);
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
    var idx=l*s*s+j*s+i;if(idx>=n)continue;
    var qx=ox2+(i-j)*W/2,top=y02+(i+j)*dT2/2+(L-1-l)*eg;
    blitPiece(c,name,W,qx,top+dT2+eg);
    /* 구우면 크림 케이크가 된다: 위가 빈 조각 윗면에 크림, 맨 윗층에는 딸기. 옆면 스펀지는 그대로라 조각 수는 계속 셀 수 있다 */
    if(full&&idx+s*s>=n)creamTop(c,qx,top,W,dT2,eg,l===L-1);
  }
}
/* 조각 하나의 윗면(위 꼭짓점 x,y · 폭 W · 마름모 높이 dT)에 크림을 얹고, 앞 두 면으로 조금 흘러내리게 한다 */
function creamTop(c,x,y,W,dT,eg,berry){
  var k=0.97,hw=W/2*k,cy=y+dT/2,top=cy-dT/2*k,bot=cy+dT/2*k,t=eg*0.16,lw=Math.max(0.6,W*0.02);
  var Lx=x-hw,Rx=x+hw;
  c.save();c.lineJoin='round';
  /* 흘러내린 띠: 오른쪽 아래 모서리 → 아래 꼭짓점 → 왼쪽, 아래 가장자리는 물결 */
  c.beginPath();c.moveTo(Rx,cy);c.lineTo(x,bot);c.lineTo(Lx,cy);
  var N=6;
  for(var q=0;q<=N;q++){var u=q/N,px=Lx+(x-Lx)*u,py=cy+(bot-cy)*u+t*(1+(q%2?0.7:0));c.lineTo(px,py)}
  for(q=1;q<=N;q++){var u2=q/N,px2=x+(Rx-x)*u2,py2=bot+(cy-bot)*u2+t*(1+(q%2?0.7:0));c.lineTo(px2,py2)}
  c.closePath();c.fillStyle='#f6e2cf';c.fill();c.strokeStyle='rgba(150,100,70,.45)';c.lineWidth=lw;c.stroke();
  /* 윗면 크림 */
  c.beginPath();c.moveTo(x,top);c.lineTo(Rx,cy);c.lineTo(x,bot);c.lineTo(Lx,cy);c.closePath();
  var g=c.createLinearGradient(x,top,x,bot);g.addColorStop(0,'#ffffff');g.addColorStop(1,'#fdf1e4');
  c.fillStyle=g;c.fill();c.stroke();
  if(berry){
    var r=W*0.12,bx=x,by=cy-r*0.35;
    c.beginPath();c.ellipse(bx,by,r,r*1.1,0,0,7);c.fillStyle='#e8394d';c.fill();
    c.strokeStyle='#9c1f2e';c.lineWidth=Math.max(0.6,r*0.12);c.stroke();
    c.fillStyle='#4caf50';c.beginPath();c.ellipse(bx,by-r*1.0,r*0.55,r*0.25,0,0,7);c.fill();
    c.fillStyle='rgba(255,255,255,.75)';c.beginPath();c.ellipse(bx-r*0.35,by-r*0.3,r*0.18,r*0.26,-0.4,0,7);c.fill();
  }
  c.restore();
}

/* ===== 그리기 ===== */
function drawPizza(c,x,y,w,h,o){  // 토스트(네모난 빵) : 귀 + 고양이 얼굴
  o=o||{};var pal=PAL[1];
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
  var D=DISHES[0],n=d.n,W=d.w,w=W*cell,x0=cx-w/2,y=baseY-cell;
  for(var i=0;i<W;i++){
    var px=x0+i*cell;
    if(i<n){
      rr(c,px+0.5,y+cell*0.18,cell-1,cell*0.64,cell*0.3);
      c.fillStyle=full?D.tile:D.raw;c.fill();c.lineWidth=Math.min(2,Math.max(1,cell*0.06));c.strokeStyle=full?D.edge:D.rawEdge;c.stroke();
      if(full){c.strokeStyle='rgba(120,50,30,.45)';c.lineWidth=Math.max(1,cell*0.05);
        c.beginPath();c.moveTo(px+cell*0.3,y+cell*0.32);c.lineTo(px+cell*0.5,y+cell*0.68);c.moveTo(px+cell*0.5,y+cell*0.32);c.lineTo(px+cell*0.7,y+cell*0.68);c.stroke()}
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
  var top=full?'#fffaf3':'#ffeef3',lf=full?'#f2c08e':'#f6d6e0',rt=full?'#dca06a':'#eab9cc',ed=full?'#a8703e':D.rawEdge;
  if(n<=0){
    c.save();c.setLineDash([4,3]);c.strokeStyle='rgba(180,150,100,.6)';c.lineWidth=1.5;
    c.beginPath();[V(0,0,0),V(1,0,0),V(1,1,0),V(0,1,0)].forEach(function(p,i){i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1])});c.closePath();c.stroke();c.restore();return;
  }
  for(var l=0;l<L;l++)for(var j=0;j<s;j++)for(var i=0;i<s;i++){
    var idx=l*s*s+j*s+i;if(idx>=n)continue;
    poly([V(i,j+1,l),V(i+1,j+1,l),V(i+1,j+1,l+1),V(i,j+1,l+1)],lf,ed);
    poly([V(i+1,j,l),V(i+1,j+1,l),V(i+1,j+1,l+1),V(i+1,j,l+1)],rt,ed);
    poly([V(i,j,l+1),V(i+1,j,l+1),V(i+1,j+1,l+1),V(i,j+1,l+1)],top,ed);
    if(full&&l===L-1){var bp=V(i+0.5,j+0.5,l+1);c.fillStyle='#e8394d';c.beginPath();c.arc(bp[0],bp[1]-a*0.08,Math.max(1.5,a*0.18),0,7);c.fill()}   // 크림 위 딸기
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
      +'</div>'
      +'<div class="chips" style="grid-template-columns:repeat('+bags.length+',minmax(0,1fr))">'+chipsHtml+'</div>'
      +'<div class="lock"><div class="lk"></div></div>';
    b.querySelector('.mold-head').addEventListener('click',function(e){
      selectDish(i);
    });
    b.querySelector('.lock').addEventListener('click',function(e){
      e.stopPropagation();notOpen(i);
    });
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
    var key=owned(i)+'';if(el.dataset.lv===key)return;el.dataset.lv=key;
    c.clearRect(0,0,100,70);
    var d=newDish(i,i===0?3:i===1?4:8);d.cooked=true;
    drawDishState(c,50,66,fitCell(d,90,52,i===0?24:i===1?26:18),d,1);
  });
}
/* 선반 머리 탭: 활성 빵만 표시 (개수는 칩으로) */
function selectDish(i){
  if(S.phase!=='play'||S.guide||isOvenFocus())return;
  if(!owned(i)){notOpen(i);return}
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
  if(!owned(i)){notOpen(i);return}
  if(!hasBag(i,n)){buyBag(i,n);return}                  // 배율을 사는 것뿐, 재료는 올라가지 않는다
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
/* 오븐 캔버스 안의 점 -> 무대 좌표 */
function ovenToStage(x,y){
  var r=elRectStage(ocv),s=Math.min(r.w/OW,r.h/OH);
  return{x:r.x+(r.w-OW*s)/2+x*s,y:r.y+(r.h-OH*s)/2+y*s,s:s};
}
/* 빵이 도마에서 오븐 입구로 들어가고(in), 다 구워지면 입구에서 도마로 나오는(out) 연출.
   규칙(S.bench·S.oven)은 바로 바뀌고, 이 그림과 「보이는 시점」만 늦춘다. */
var ENTER_MS=720,EXIT_MS=560,dishFly=[];
function benchDishGeom(d){var p=benchToStage(BW/2,BBASE);return{x:p.x,y:p.y,cell:benchCell(d)*p.s}}
/* 오븐 안 빵 칸. 도마와 같은 크기로 두되, 입구(가로 124·세로 88)보다 크면 그만큼만 줄인다 */
function ovenCell(d){
  var b=benchCell(d),e=piecesOn(d)?pieceExt(d,b):{w:Math.max(b,b*(d.n||1)),h:b*1.2};
  var s=Math.min(1,124/Math.max(8,e.w),88/Math.max(8,e.h));
  return Math.max(6,Math.round(b*s*4)/4);
}
/* 장면에서는 빵이 오븐 아치 바닥으로 들어가고 나온다 */
function ovenDishGeom(d){
  if(sceneOven()){var m=ovenToStage(OVEN_REST.x,OVEN_REST.y);return{x:m.x,y:m.y,cell:ovenCell(d)*m.s}}
  var p=ovenToStage(OW/2,228);return{x:p.x,y:p.y,cell:fitCell(d,118,78,28)*p.s}
}
function launchDishFly(mode,d){
  var b=benchDishGeom(d),o=ovenDishGeom(d),a=mode==='in'?b:o,z=mode==='in'?o:b;
  dishFly.push({mode:mode,dish:d,t0:performance.now(),dur:mode==='in'?ENTER_MS:EXIT_MS,
    ax:a.x,ay:a.y,ac:a.cell,bx:z.x,by:z.y,bc:z.cell,arc:Math.max(36,Math.abs(b.y-o.y)*0.35)});
}
function launchFliers(d,can,srcEl){
  var f=Math.min(can,8),per=Math.floor(can/f),rem=can-per*f,now=performance.now();
  var cell=benchCell(d),box=dishBox(d,cell,BW/2,BBASE),dim=DISHES[d.type].dim;
  var src=elRectStage(srcEl);
  for(var i=0;i<f;i++){
    var tx,ty;
    if(dim===1){
      var idx=Math.max(0,Math.min(d.n-1,d.n-can+Math.round((i+1)*can/f)-1));
      if(piecesOn(d)){
        tx=box.x+box.w*(idx+0.5)/Math.max(1,d.n);ty=BBASE-box.h*0.5;
      }else{tx=box.x+6+idx*cell+cell/2;ty=BBASE-cell*0.45}
    }else{
      tx=box.x+box.w*(0.2+0.6*rnd());ty=box.y+box.h*(0.35+0.5*rnd());
    }
    var to=benchToStage(tx,ty);
    fliers.push({t0:now+i*70,dur:380,sx:src.x+src.w/2,sy:src.y+src.h*0.4,tx:to.x,ty:to.y,type:d.type,
                 inc:per+(i===f-1?rem:0),dish:d,size:dim===1&&piecesOn(d)?Math.max(8,cell*to.s*0.3):Math.max(24,cell*to.s*0.95)});
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
  if(!fliers.length&&!dishFly.length){if(flyDirty){fctx.clearRect(0,0,FLYW,FLYH);flyDirty=false}return}
  fctx.clearRect(0,0,FLYW,FLYH);flyDirty=true;
  var now=performance.now();
  for(var di=dishFly.length-1;di>=0;di--){
    var g=dishFly[di],gp=Math.min(1,(now-g.t0)/g.dur);
    if(gp>=1){dishFly.splice(di,1);continue}
    var ge=g.mode==='in'?gp*gp*(3-2*gp):1-Math.pow(1-gp,3);         // 들어갈 땐 부드럽게, 나올 땐 톡 튀어나오며 감속
    var gx=g.ax+(g.bx-g.ax)*ge,gy=g.ay+(g.by-g.ay)*ge-Math.sin(Math.PI*ge)*g.arc;
    var gc=Math.max(3,g.ac+(g.bc-g.ac)*ge);
    fctx.save();
    fctx.globalAlpha=g.mode==='in'?(gp<0.88?1:(1-gp)/0.12):Math.min(1,gp*5);
    drawDishState(fctx,gx,gy,gc,g.dish,g.dish.cooked?1:0);
    fctx.restore();
  }
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

/* ===== 재료 자리(누르면 도마에 올라감) =====
   재료마다 배율(×1 ×5 ×10 …)이 하나씩 「물건」으로 카운터 위에 놓인다(mock13 배치).
   반죽 = 카운터 뒷줄, 식빵 = 카운터 앞줄, 스펀지 = 수납장 열린 선반.
   물건 그림은 재료 스프라이트(ing-*, piece-*-raw, bag, bench)를 조합해 그린다. 배율별 전용 그림이 오면 바꿔 끼운다.
   좌표는 배경 그림(1280×640) 기준이다. by = 물건 바닥, xa~xb = 그 줄의 폭, s = 물건 크기 */
var SRC_ROWS=[{by:350,xa:95,xb:390,s:62},{by:462,xa:18,xb:422,s:72},{by:596,xa:172,xb:612,s:64}];
var SRC_TAG=34;            /* 물건 아래 「×n」 표 높이(그림 px) */
/* 반죽(윗단)·식빵(아랫단)은 2단 진열대 그림 한 장(stand-empty) 위에 칸별 재료 그림(stand-item-*)을 얹는다.
   값은 assets/stand-items.json(design-refs/ingredients-2026-09-24/export-stand-assets.py가 만듦)과 같게 둔다.
   item = 그림 자리 [x,y,w,h], cell = 칸 바닥 [x0,y0,x1,y1](칸막이 가운데로 나눔. 누르는 영역과 🔒 자리) */
var STAND={box:[76,255,413,232],rows:[0,1],
  item:{dough1:[157,294,71,49],dough5:[206,294,119,49],dough10:[303,294,176,49],
    toast1:[112,399,38,27],toast5:[162,382,42,46],toast10:[215,360,42,69],toast50:[260,365,68,68],toast100:[336,365,120,68]},
  cell:{dough1:[177,303,209,334],dough5:[224,303,308,334],dough10:[320,303,466,334],
    toast1:[117,381,157,429],toast5:[168,381,207,429],toast10:[218,381,259,429],toast50:[269,381,331,429],toast100:[342,381,458,429]}};
var STAND_KEY=['dough','toast'];
var srcEls=[],amtEls=[],itemEls=[];   // srcEls[i] = i번 재료의 ×1, amtEls[i][n] = ×n, itemEls = 전부
function placeStage(el,x,y,w,h){el.style.left=(x/12.8)+'%';el.style.top=(y/6.4)+'%';el.style.width=(w/12.8)+'%';el.style.height=(h/6.4)+'%'}
(function(){
  var box=$('sources');
  if(!box)return;
  var art=document.createElement('img');art.className='stand-art';art.src='assets/stand-empty.png';art.alt='';
  placeStage(art,STAND.box[0],STAND.box[1],STAND.box[2],STAND.box[3]);box.appendChild(art);
  var arts={};
  STAND.rows.forEach(function(i){DISH_BAGS[i].forEach(function(n){
    var k=STAND_KEY[i]+n,a=STAND.item[k],im=document.createElement('img');
    im.className='stand-item';im.src='assets/stand-item-'+k+'.png';im.alt='';
    placeStage(im,a[0],a[1],a[2],a[3]);box.appendChild(im);arts[k]=im;
  })});
  DISH_BAGS.forEach(function(bags,i){
    if(STAND.rows.indexOf(i)<0)return;
    amtEls[i]={};
    bags.forEach(function(n){
      var k=STAND_KEY[i]+n,c=STAND.cell[k],a=STAND.item[k];
      var top=Math.min(c[1],a[1]),bot=c[3]+SRC_TAG,h=bot-top;
      var b=document.createElement('button');b.type='button';b.className='src src-cell'+(n===1?' src-one':' amt');
      b.dataset.i=i;b.dataset.n=n;b.setAttribute('aria-label',DISHES[i].ing+' '+n+'개');
      placeStage(b,c[0],top,c[2]-c[0],h);
      b.innerHTML='<span class="src-x">×'+n+'</span><div class="src-lock"></div>';
      var lk=b.querySelector('.src-lock');lk.style.top=((c[1]-top)/h*100)+'%';lk.style.bottom=(SRC_TAG/h*100)+'%';
      b.addEventListener('click',function(e){e.stopPropagation();tapSource(i,b,n)});
      box.appendChild(b);b._art=arts[k];
      itemEls.push({el:b,art:arts[k],i:i,n:n});
      if(n===1)srcEls[i]=b;else amtEls[i][n]=b;
    });
  });
  DISHES.forEach(function(D,i){
    if(STAND.rows.indexOf(i)>=0)return;
    var R=SRC_ROWS[i],bags=DISH_BAGS[i],step=(R.xb-R.xa)/bags.length,ch=Math.round(R.s*1.3);
    amtEls[i]={};
    bags.forEach(function(n,j){
      var cx=R.xa+step*(j+0.5),w=Math.round(step);
      var b=document.createElement('button');b.type='button';b.className='src'+(n===1?' src-one':' amt');
      b.dataset.i=i;b.dataset.n=n;b.setAttribute('aria-label',D.ing+' '+n+'개');
      b.style.left=((cx-w/2)/12.8)+'%';b.style.top=((R.by-ch)/6.4)+'%';
      b.style.width=(w/12.8)+'%';b.style.height=((ch+SRC_TAG)/6.4)+'%';
      b.innerHTML='<canvas width="'+w+'" height="'+ch+'"></canvas><span class="src-x">×'+n+'</span><div class="src-lock"></div>';
      b.querySelector('canvas').style.height=(ch/(ch+SRC_TAG)*100)+'%';
      b.addEventListener('click',function(e){e.stopPropagation();tapSource(i,b,n)});
      box.appendChild(b);
      itemEls.push({el:b,cv:b.querySelector('canvas'),i:i,n:n,w:w,h:ch,s:R.s});
      if(n===1)srcEls[i]=b;else amtEls[i][n]=b;
    });
  });
})();
function tapSource(i,el,n){
  if(S.phase!=='play'||S.guide||isOvenFocus())return;
  n=n||1;
  if(!owned(i)){notOpen(i);return}
  if(!hasBag(i,n)){buyBag(i,n);return}             // 못 산 배율은 누르면 구입만 한다 (재료는 올라가지 않는다)
  if(benchBaked()){warnBaked();return}
  if(!S.bench||S.bench.type!==i){S.bench=newDish(i);fx=[];S.sel=null}
  var tg=el._art||el;
  tg.classList.remove('tap');void tg.offsetWidth;tg.classList.add('tap');
  addN(n,el);
}
/* 스프라이트의 투명 여백을 잘라 낸 그림 (한 번만 만든다) */
var TRIM={};
function trimmed(name){
  if(TRIM[name])return TRIM[name];
  var src=sprite(name);if(!src)return null;
  var w=src.width,h=src.height,x0=w,y0=h,x1=-1,y1=-1;
  try{
    var p=src.getContext('2d').getImageData(0,0,w,h).data;
    for(var y=0;y<h;y++)for(var x=0;x<w;x++)if(p[(y*w+x)*4+3]>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  }catch(e){x0=0;y0=0;x1=w-1;y1=h-1}
  if(x1<0)return null;
  var cv=document.createElement('canvas');cv.width=x1-x0+1;cv.height=y1-y0+1;
  cv.getContext('2d').drawImage(src,x0,y0,cv.width,cv.height,0,0,cv.width,cv.height);
  return TRIM[name]=cv;
}
/* 그림을 아랫가운데(cx,by)에 맞춰 놓는다. byW=true면 폭 w, 아니면 높이 w로 맞춘다 */
function putArt(c,name,cx,by,w,byW){
  var a=trimmed(name);if(!a)return false;
  var dw=byW?w:w*a.width/a.height,dh=byW?w*a.height/a.width:w;
  c.drawImage(a,cx-dw/2,by-dh,dw,dh);return true;
}
function crateArt(c,cx,by,w,h,one,n){
  var fh=h*0.55;
  for(var j=0;j<n;j++)putArt(c,one,cx-w*0.28+j*(w*0.56/Math.max(1,n-1)),by-fh+h*0.09,w*0.42,true);
  c.fillStyle='#966030';c.strokeStyle='#462812';c.lineWidth=2;
  c.fillRect(cx-w/2,by-fh,w,fh);c.strokeRect(cx-w/2,by-fh,w,fh);
  c.strokeStyle='#704622';
  [0.33,0.66].forEach(function(k){c.beginPath();c.moveTo(cx-w/2,by-fh*k);c.lineTo(cx+w/2,by-fh*k);c.stroke()});
}
var ITEM_ART=[['ing-dough','bench','bag'],['piece-toast-raw','ing-toast'],['piece-sponge-raw','ing-sponge']];
function itemReady(i){return ITEM_ART[i].every(function(k){return !!sprite(k)})}
function drawItem(it){
  var c=it.cv.getContext('2d'),w=it.w,h=it.h,s=it.s,cx=w/2,by=h-2,i=it.i,n=it.n;
  c.clearRect(0,0,w,h);
  c.fillStyle='rgba(40,20,5,.28)';c.beginPath();c.ellipse(cx,by-s*0.01,s*0.5,s*0.09,0,0,7);c.fill();
  if(!itemReady(i))return;
  if(i===0){
    if(n===1)putArt(c,'ing-dough',cx,by,s*0.8);
    else if(n===5){
      putArt(c,'bench',cx,by,s*1.25,true);
      [[-0.3,-0.22],[0.05,-0.26],[0.34,-0.2],[-0.12,-0.08],[0.2,-0.06]].forEach(function(o){putArt(c,'ing-dough',cx+o[0]*s,by+o[1]*s,s*0.36)});
    }else{putArt(c,'bag',cx,by,s);putArt(c,'ing-dough',cx-s*0.08,by-s*0.78,s*0.38)}
    return;
  }
  var one=ITEM_ART[i][0],stk=ITEM_ART[i][1];
  if(n===1)putArt(c,one,cx,by,s*0.62,true);
  else if(n===5){for(var j=0;j<3;j++)putArt(c,one,cx-s*0.2+j*s*0.2,by-j*s*0.07,s*0.55,true)}
  else if(n===10)putArt(c,stk,cx,by,s*0.82);
  else if(n===50)crateArt(c,cx,by,s*0.9,s*0.9,one,2);
  else crateArt(c,cx,by,s*1.05,s*1.0,one,3);
}
function renderSources(){
  if(!itemEls.length)return;
  var dim=!!S.guide||isOvenFocus();
  itemEls.forEach(function(it){
    var b=it.el,i=it.i,n=it.n,own=owned(i);
    var key=(itemReady(i)?1:0)+'|'+VIEW.q;
    if(it.cv&&b.dataset.key!==key){b.dataset.key=key;drawItem(it)}
    /* 처음부터 다 보이면 복잡하다. 가진 칩과 바로 다음에 살 칩 하나만 보이고, 나머지 칸과 아직 안 열린 빵은 빈칸이다 */
    var has=hasBag(i,n),next=own&&n===nextBag(i),lk=b.querySelector('.src-lock'),h='';
    b.classList.toggle('hide',!has&&!next);
    b.classList.toggle('locked',next);b.classList.toggle('canbuy',next&&G.wallet>=BAGCOST[n]);
    b.classList.toggle('off',dim);
    if(next)h='🔒<small>🪙 '+BAGCOST[n]+'</small>';
    b.classList.toggle('on',!!S.bench&&S.bench.type===i);
    if(it.art)['hide','locked','off','on'].forEach(function(c){it.art.classList.toggle(c,b.classList.contains(c))});
    if(lk.innerHTML!==h)lk.innerHTML=h;
  });
}

/* ===== 작업판 ===== */
var BW=360,BH=300,BBASE=282;
var bcv=$('benchCv'),bctx=bcv.getContext('2d');
/* 장면에서는 도마 위쪽이 손님 카드와 가까워서 높이를 170, 한 칸 크기를 60까지로 묶는다 */
function benchCell(d){return fitCell(d,330,170,60)}
/* 화면에 보이는 접시. 재료가 날아오는 동안은 d.n(규칙)보다 d.shown(화면)이 적다.
   판정·보상·봇은 전부 d.n만 보므로 규칙은 그대로다 */
function viewDish(d){
  if(d.shown===undefined||d.shown>d.n)d.shown=d.n;
  if(d.shown===d.n)return d;
  var v={type:d.type,n:d.shown,cooked:d.cooked,quality:d.quality};refresh(v);return v;
}
function renderBench(){
  bctx.clearRect(0,0,BW,BH);
  landFliers();
  var d=S.bench,hid=!!(d&&d.hideUntil&&performance.now()<d.hideUntil),lifted=isDragActive('bench'),vd=(d&&!hid&&!lifted)?viewDish(d):null;
  if(!d){
    /* 빈 도마에는 글씨를 쓰지 않는다 */
  }else if(!hid&&!lifted){
    if(vd.n===0){
      var e=newDish(d.type);drawDishState(bctx,BW/2,BBASE,64,e,0);
    }else{
      /* 오븐에서 막 돌아온 빵은 톡 튀어 오른다 */
      var age=d.popAt?performance.now()-d.popAt:1e9,pop=age<420?1+0.16*Math.sin(Math.PI*age/420):1;
      bctx.save();bctx.translate(BW/2,BBASE);bctx.scale(pop,pop);bctx.translate(-BW/2,-BBASE);
      drawDishState(bctx,BW/2,BBASE,benchCell(vd),vd,0);
      bctx.restore();
    }
    bctx.fillStyle='#3b2a1a';bctx.font='800 20px Jua,Pretendard,Malgun Gothic,sans-serif';bctx.textAlign='center';
    if(vd.n>0)bctx.fillText(d.cooked?(vd.n+'개 · 완성도 '+Math.round((d.quality||0)*100)+'%'):(vd.n+'개'),BW/2,BBASE+18);
  }
  var nw=performance.now();
  fx=fx.filter(function(f){return nw-f.t0<f.dl+700});
  fx.forEach(function(f){var a=nw-f.t0-f.dl;if(a<0)return;var q=Math.min(1,a/320),y=-20+(f.y1+20)*q*q;bctx.save();bctx.globalAlpha=a>320?Math.max(0,1-(a-320)/380):1;bctx.font='28px sans-serif';bctx.textAlign='center';bctx.translate(f.x,y);bctx.rotate(f.rot*q);bctx.fillText(f.ico,0,0);bctx.restore()});
  bcv.style.pointerEvents=(d&&d.n>0&&!hid)?'auto':'none';
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
      var ch=chipEls[i][n],has=hasBag(i,n);
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
/* 오븐 캔버스 = 장면 그림의 (940,140)~(1260,480) 영역. 좌표 1 = 그림 1px.
   OVEN_MOUTH = 입구 안쪽(빵이 드나드는 곳), OVEN_SEE = 옆면에서 안이 비쳐 보이는 타원(가운데·반지름) */
var OW=320,OH=340,OBASE=262;
/* 입구 = oven-v3 아치 안쪽 바닥. 그림 (60,368) → 캔버스 (52,198). y=240은 아치 아래 벽돌이라 빵이 입구 밖에 멈췄다 */
var OVEN_MOUTH={x:72,y:188},OVEN_SEE={x:208,y:186,rx:94,ry:124,floor:250};
/* 굽는 빵이 머무는 곳 = 옆면 불빛 한가운데 */
var OVEN_REST={x:208,y:210};
var ovenFade=null;   /* 다 구운 뒤 옆면 비침이 서서히 사라지는 동안 */
var ocv=$('ovenCv'),octx=ocv.getContext('2d');
var focusCv=$('ovenFocusCv'),focusCtx=focusCv?focusCv.getContext('2d'):null;
var FOCUS_W=220,FOCUS_H=220;
function placeOvenFocus(){
  var panel=document.querySelector('.oven-focus-panel'),st=stage.getBoundingClientRect();
  var bench=document.querySelector('.bench-station');
  if(!panel||!st.width||!bench)return;
  var br=bench.getBoundingClientRect();
  var left=st.left+6;
  panel.style.left=left+'px';
  panel.style.width=Math.max(160,br.right-left)+'px';
  panel.style.top=br.top+'px';
  panel.style.height=br.height+'px';
}
function setOvenFocus(on){
  var el=$('ovenFocus');if(!el)return;
  el.hidden=!on;el.classList.toggle('is-on',!!on);
  document.documentElement.classList.toggle('oven-focus-on',!!on);
  if(on)placeOvenFocus();
  else if(focusCtx)focusCtx.clearRect(0,0,FOCUS_W,FOCUS_H);
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
  /* 빵이 오븐에 들어가는 동안(ENTER_MS)은 박자도 안내 창도 시작하지 않는다 */
  d.shown=d.n;
  S.oven={dish:d,state:'cooking',t0:clock()+ENTER_MS,n:0,need:OVEN[G.u.oven].taps,grades:[],last:null,showAt:performance.now()+ENTER_MS};
  S.bench=null;S.sel=null;fx=[];fliers.length=0;drag=null;
  launchDishFly('in',d);sfx('bag');
  setTimeout(function(){if(S.phase==='play'&&isOvenFocus())setOvenFocus(true)},ENTER_MS);
  updateAll();
}
$('toOven').onclick=toOven;
function cookTap(){
  var o=S.oven;if(!o||o.state!=='cooking')return;
  /* n번째 터치는 n번째 박자나 그 뒤 박자와 비교한다. 이미 쓴 박자에 또 두드리면(연타) 멀어서 빗나감이 된다.
     늦게 시작하거나 박자를 건너뛴 것은 손해 보지 않는다. o.beat = 지난 터치가 맞춘 박자 */
  var t=(clock()-o.t0)/1000,n=Math.max((o.beat||0)+1,Math.round(t/BEAT)),dev=Math.abs(t-n*BEAT);
  o.beat=n;
  var g=dev<=0.10?'perfect':dev<=0.20?'good':dev<=0.35?'close':'miss',q={perfect:1,good:0.7,close:0.4,miss:0.1}[g];
  o.grades.push(q);o.n++;o.last={g:g,at:clock()};
  sfx(g);
  if(o.n>=o.need){
    o.state='done';o.dish.cooked=true;ovenFade={t0:performance.now()};
    o.dish.quality=o.grades.reduce(function(a,b){return a+b},0)/o.grades.length;
    sfx('done');
    setOvenFocus(false);
    /* 구운 빵은 오븐에 두지 않고 도마로 돌아온다. 오븐은 바로 다음 빵을 받을 수 있다 */
    S.bench=o.dish;S.bench.shown=S.bench.n;S.bench.hideUntil=S.bench.popAt=performance.now()+EXIT_MS;
    S.oven=ovenIdle();S.sel=null;fx=[];fliers.length=0;
    launchDishFly('out',S.bench);
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
    /* 글자가 링보다 넓어도 읽히게 진한 테두리를 두른다 */
    var gt={perfect:'완벽!',good:'좋아요',close:'아쉬워요',miss:'빗나감'}[l.g];
    c.font='800 24px Jua,Pretendard,Malgun Gothic,sans-serif';c.textAlign='center';
    c.lineWidth=5;c.lineJoin='miter';c.strokeStyle='#2a1a10';c.strokeText(gt,rx,ry+8);
    c.fillStyle={perfect:'#5fe08f',good:'#ffc247',close:'#ffa05a',miss:'#ff7a70'}[l.g];
    c.fillText(gt,rx,ry+8);
  }else{
    c.font='800 22px Jua,Pretendard,Malgun Gothic,sans-serif';c.textAlign='center';c.fillStyle='#fff';
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
    if(S&&S.phase==='play')updateAll();
  };
  im.onerror=function(){SPRITE[name]=null};
  /* 캐시에 깨진 예전 파일이 남지 않게 */
  im.src='assets/'+name+'.png?v=3';
  return null;
}
function sprite(name){return SPRITE_READY[name]?SPRITE[name]:null}
/* 재료 자리 그림(ITEM_ART)은 SPRITE 저장소가 만들어진 뒤에 불러야 한다.
   오븐·쓰레기통은 장면 그림(oven-v3, trash-*-v3)을 index.html에서 바로 쓴다 */
ITEM_ART.forEach(function(a){a.forEach(function(k){loadKeyed(k)})});
PIECE.forEach(function(P){loadKeyed(P.raw);loadKeyed(P.full)});
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
/* ===== 굽는 동안 오븐 옆면 투시 =====
   배경의 오븐 옆면은 평범한 돌벽이다. 굽는 동안에만 그 자리를 벽 너머를 보듯 비춰서
   안쪽 화덕과 구워지는 빵을 보여 준다: 안쪽 그림 + 부드러운 타원 가장자리 + 옅은 돌 줄눈 + 불빛 */
var seeCv=null;
function ovenSeeThrough(a,d,prog){
  var E=OVEN_SEE,W=OW,H=OH,q=VIEW.q||1;
  if(!seeCv)seeCv=document.createElement('canvas');
  if(seeCv.width!==Math.round(W*q)){seeCv.width=Math.round(W*q);seeCv.height=Math.round(H*q)}
  var c=seeCv.getContext('2d'),t=performance.now()/1000,flick=0.85+0.15*Math.sin(t*7.3)*Math.sin(t*3.1);
  c.setTransform(q,0,0,q,0,0);c.clearRect(0,0,W,H);c.globalCompositeOperation='source-over';
  var x0=E.x-E.rx,y0=E.y-E.ry,x1=E.x+E.rx,y1=E.y+E.ry;
  var g=c.createLinearGradient(0,y0,0,y1);                     /* 안쪽 벽: 위는 어둡고 바닥 쪽은 불빛 */
  g.addColorStop(0,'#120503');g.addColorStop(0.5,'#3a1407');g.addColorStop(0.72,'#8a3a12');g.addColorStop(1,'#5a240c');
  c.fillStyle=g;c.fillRect(x0,y0,x1-x0,y1-y0);
  c.fillStyle='#a4572a';c.beginPath();                        /* 화덕 바닥 */
  c.moveTo(x0,E.floor+26);c.lineTo(x1,E.floor+26);c.lineTo(x1-22,E.floor-14);c.lineTo(x0+22,E.floor-14);c.closePath();c.fill();
  var rg=c.createRadialGradient(E.x+30,E.floor-10,4,E.x+30,E.floor-10,E.rx*1.1);   /* 안쪽 끝 불씨 */
  rg.addColorStop(0,'rgba(255,190,90,'+(0.75*flick)+')');rg.addColorStop(1,'rgba(255,120,40,0)');
  c.fillStyle=rg;c.fillRect(x0,y0,x1-x0,y1-y0);
  /* 빵은 옆면 창이 아니라 입구에 그린다. 날아 들어온 자리와 같아야 한다 */
  c.strokeStyle='rgba(210,200,190,.2)';c.lineWidth=2;         /* 벽 너머로 본다는 느낌: 돌 줄눈을 옅게 */
  for(var y=y0+14,r=0;y<y1;y+=34,r++){
    c.beginPath();c.moveTo(x0,y+4);c.lineTo(x1,y-4);c.stroke();
    for(var x=x0+(r%2?24:0);x<x1;x+=48){c.beginPath();c.moveTo(x,y+2);c.lineTo(x,y+32);c.stroke()}
  }
  c.globalCompositeOperation='destination-in';                  /* 가장자리가 부드러운 타원만 남긴다 */
  c.save();c.translate(E.x,E.y);c.scale(1,E.ry/E.rx);
  var m=c.createRadialGradient(0,0,0,0,0,E.rx);
  m.addColorStop(0,'#000');m.addColorStop(0.68,'#000');m.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=m;c.beginPath();c.arc(0,0,E.rx,0,7);c.fill();c.restore();
  c.globalCompositeOperation='source-over';
  octx.save();octx.globalAlpha=a;
  octx.drawImage(seeCv,0,0,W,H);
  var gl=octx.createRadialGradient(E.x,E.y,E.rx*0.6,E.x,E.y,E.rx*1.35);   /* 둘레로 번지는 불빛 */
  gl.addColorStop(0,'rgba(255,150,60,'+(0.12*flick)+')');gl.addColorStop(1,'rgba(255,150,60,0)');
  octx.fillStyle=gl;octx.fillRect(0,0,W,H);
  var mg=octx.createRadialGradient(OVEN_MOUTH.x,OVEN_MOUTH.y,4,OVEN_MOUTH.x,OVEN_MOUTH.y,70);   /* 입구 안쪽도 달아오름 */
  mg.addColorStop(0,'rgba(255,140,50,'+(0.45*flick)+')');mg.addColorStop(1,'rgba(255,140,50,0)');
  octx.fillStyle=mg;octx.fillRect(0,0,W,H);
  octx.restore();
}
function renderOvenScene(){
  octx.clearRect(0,0,OW,OH);
  var o=S.oven,d=o.dish,now=performance.now();
  if(d&&o.state==='cooking'){
    var age=o.showAt?now-o.showAt:1e9;if(age<0)return;          /* 빵이 입구로 들어가는 동안은 아직 안 비친다 */
    var pr=Math.min(0.95,o.n/o.need);
    ovenSeeThrough(clamp(age/350,0,1),d,pr);
    octx.save();octx.globalAlpha=clamp(age/180,0,1);
    drawDishState(octx,OVEN_REST.x,OVEN_REST.y,ovenCell(d),d,pr);
    octx.restore();
    return;
  }
  if(ovenFade){
    var f=1-(now-ovenFade.t0)/450;
    if(f<=0)ovenFade=null;else ovenSeeThrough(f,null,0);
  }
}
function renderOven(){
  if(sceneOven()){renderOvenScene();return}
  octx.clearRect(0,0,OW,OH);
  ovenFrame(octx,G.u.oven);
  var o=S.oven,d=o.dish;
  if(!d){
    if(sceneOven())return;
    var useSpr=!!sprite(OVEN_SPR[G.u.oven]);
    octx.font='800 16px Jua,Pretendard,Malgun Gothic,sans-serif';octx.textAlign='center';
    if(useSpr){
      octx.lineWidth=4;octx.strokeStyle='rgba(59,42,26,.55)';octx.fillStyle='#fff8ec';
      octx.strokeText('빈 오븐',OW/2,OH*0.78);
      octx.fillText('빈 오븐',OW/2,OH*0.78);
    }else{
      octx.fillStyle='#8f7350';
      octx.fillText('빈 오븐',OW/2,OH/2);
      octx.font='15px Pretendard,Malgun Gothic,sans-serif';octx.fillText('작업판에서 🔥 오븐에 넣어요',OW/2,OH/2+24);
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
  var inFlight=!!(o.showAt&&performance.now()<o.showAt);
  octx.save();octx.translate(OW/2,OB);octx.scale(bs,bs);octx.translate(-OW/2,-OB);
  if(!inFlight&&!isDragActive('oven'))drawDishState(octx,OW/2,OB,CO,d,pr);
  if(DISHES[d.type].dim===2&&!piecesOn(d)){
    var w=d.w*CO,h=d.h*CO;
    octx.save();rr(octx,OW/2-w/2,OB-h,w,h,Math.min(w,h)*0.12);octx.fillStyle='rgba(150,70,15,'+(0.03+0.4*(o.state==='done'?1:pr))+')';octx.fill();octx.restore();
  }
  octx.restore();
  steam(octx,o,OW/2,bx.y,bx.w,pr);
  if(o.state==='done'){
    var q=d.quality;
    octx.fillStyle='#5fe08f';octx.font='800 18px Jua,Pretendard,Malgun Gothic,sans-serif';octx.textAlign='center';
    octx.fillText('✅ 완성! 끌어다 서빙',OW/2,44);
    octx.fillText(Math.round(q*100)+'% '+(q>=0.9?'⭐⭐⭐':q>=0.7?'⭐⭐':'⭐'),OW/2,70);
  }
  ocv.classList.toggle('sel',S.sel==='oven');
}

/* ===== 손님 슬롯 ===== */
/* 손님 옆 주문 카드(그림 px 기준 110×160). 오른쪽 18px은 세로 인내심 막대 자리 */
var slotEls=[],SLOT_W=110,SLOT_H=160,CARD_BAR=18;
(function(){
  var row=$('custRow');
  for(var i=0;i<SLOTS;i++){
    var d=document.createElement('div');d.className='slot empty';
    d.innerHTML='<div class="bubble"><div class="bubble-body"><canvas width="'+SLOT_W+'" height="'+SLOT_H+'"></canvas><i class="pat"><i class="bubble-fill"></i></i></div><b class="giant-stamp">특대</b></div>'
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
/* 말풍선 속 빵. 토스트·케이크·바게트 모두 도마와 같은 그림이다.
   바게트는 길이만 k배(굵기는 그대로). 칸을 넘치면 길이만 거기까지 자른다. */
function sil(c,ty,k,cx,base,cap){
  if(ty===0){
    var cell=17,limit=cap||160,kk=Math.max(0.15,k);
    if(kk*cell>limit)kk=limit/cell;
    var d0=newDish(0,kk);d0.cooked=true;
    drawDishState(c,cx,base,cell,d0,1);
  }
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
function dishShort(t){return DISHES[t].name.replace(/^냥 /,'')}
/* 주문 카드: 위 「1 : k」, 가운데 1→k로 닮아 커지는 빵, 아래 빵 이름.
   잘못 받은 빵이면 「≠」와 받은 빵을 보여 준다 */
function drawBubble(cnv,c0,got,now){
  var k=c0.k,ty=c0.dish,c=cnv.getContext('2d'),w=SLOT_W,h=SLOT_H,cw=w-CARD_BAR,cx=cw/2+2;
  now=now||performance.now();
  c.clearRect(0,0,w,h);
  c.textAlign='center';
  if(got){
    var gd=newDish(got.type,got.n);gd.cooked=true;
    c.fillStyle='#d94b43';c.font='800 34px Jua,Pretendard,Malgun Gothic,sans-serif';c.fillText('≠',cx,40);
    drawDishState(c,cx,108,fitCell(gd,cw-16,50,14),gd,1);
    c.font='800 24px Jua,Pretendard,Malgun Gothic,sans-serif';c.fillText(got.n+'개',cx,146);
    return;
  }
  c.fillStyle=c0.giant?'#d94b43':'#3b2a1a';
  c.font='800 30px Jua,Pretendard,Malgun Gothic,sans-serif';c.fillText('1 : '+k,cx,38);
  /* 카드가 작아서 빵 그림은 1.4배로 키워 그린다(cap도 그만큼 줄여 카드 폭을 넘지 않게) */
  var sk=orderGrowK(c0,now),z=1.4,cap=(ty===2?24:cw-12)/z,base=ty===0?92:110;   /* 케이크 cap은 큐브 한 변 */
  c.save();c.translate(cx,base);c.scale(z,z);c.translate(-cx,-base);
  c.save();c.globalAlpha=0.18;sil(c,ty,k,cx,base,cap);c.restore();
  sil(c,ty,sk,cx,base,cap);
  c.restore();
  c.fillStyle='#8a5a2b';c.font='800 24px Jua,Pretendard,Malgun Gothic,sans-serif';c.fillText(dishShort(ty),cx,146);
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
      if(fill)fill.style.height='100%';
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
    /* 카드 옆 세로 막대 = 남은 인내심. 줄어들수록 초록 → 꿀색 → 빨강 (색은 style.css의 data-lv) */
    var anger=c.state==='wait'?clamp(c.wait/c.pat,0,1):(c.state==='angry'?1:0),left=1-anger;
    if(fill){fill.style.height=(left*100)+'%';var lv=left>0.5?'hi':left>0.3?'mid':'lo';if(fill.dataset.lv!==lv)fill.dataset.lv=lv}
    var low=c.state==='wait'&&anger>=0.7;
    el.className='slot'+(c.giant?' giant':'')+(c.kind?' k-'+c.kind:'')+(el.classList.contains('enter')?' enter':'')+(c.state==='happy'?' happy':c.state==='angry'?' angry':(showGot?' sad':''))+(low?' low':'')+(S.hover===i?' drop':'');
    var md=c.state==='happy'?'💖':c.state==='angry'?'💢':(showGot?(c.mood||'💧'):(low?'💢':''));
    var html=c.spr
      ?('<img class="guest-spr" alt="" src="assets/'+c.spr+'.png?v='+ART_V+'">'+faceFrames(c.spr)+(md?'<span class="md">'+md+'</span>':''))
      :('<span class="guest-emo">'+c.an+'</span>'+(md?'<span class="md">'+md+'</span>':''));
    if(c.kind==='hurry')html+='<span class="kind-badge">⏰</span>';   // 급한 손님: 시계로 바로 읽히게
    if(cat.innerHTML!==html)cat.innerHTML=html;
  }
}

/* ===== 판정 + 서빙 + 버리기 ===== */
function judge(d,c){
  if(!d.cooked)return 'raw';
  if(d.type!==c.dish)return 'wrongDish';
  var dim=DISHES[d.type].dim;
  if(dim>=2&&!isSimilar(d))return 'notSimilar';
  if(d.n!==c.N)return 'wrongSize';
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
  if(r!=='raw')removeDish(src);
  if(r==='ok'){
    var base=baseOf(c.dish,c.k)*(c.giant?GIANT_MULT:1)*(c.kind==='hurry'?HURRY_MULT:1);
    var q=d.quality,rw=Math.round(base*q),pb=Math.round(base*PAT_BONUS*(1-c.wait/c.pat)),gain=rw+pb;
    S.reward+=rw;S.patience+=pb;S.served++;S.streak++;S.qs.push(q);
    c.speed=1-c.wait/c.pat;c.state='happy';c.until=S.time+0.9;
    var msg=(c.giant?'👑 ':'😋 ')+'+'+gain+'코인! 완성도 '+Math.round(q*100)+'%';
    if(S.streak%3===0){S.combo+=COMBO_BONUS;gain+=COMBO_BONUS;msg+='  콤보 +'+COMBO_BONUS}
    earn(gain);
    floatAtSlot(c.slot,'+'+gain,'coin');
    if(q>=0.9)floatAtSlot(c.slot,'완벽하게 구웠어요!','ok');
    flyCoins(c.slot,gain);
    sfx(c.giant?'giant':'serve');
    if(S.streak%3===0){comboBanner('콤보 ×'+S.streak+'  +'+COMBO_BONUS);sfx('combo')}
    toast(msg);
  }else if(r==='raw'){
    S.wrong.raw++;G.wrongAll.raw++;
    toast('💧 안 익었어요! 오븐에서 구워 주세요');
  }else{
    S.wrong[r]++;G.wrongAll[r]++;S.streak=0;
    var frac=r==='notSimilar'?0.5:0.3;
    c.wait=Math.min(c.pat-1,c.wait+c.pat*frac);   // 기다린 시간이 늘어남 = 인내심 감소
    if(r!=='wrongDish')c.fails=(c.fails||0)+1;
    c.got={type:d.type,n:d.n};c.gotUntil=S.time+2.8;
    sfx('fail');doShake(4,240);
    if(r==='wrongDish'){c.mood='💢';toast('💢 주문은 「'+DISHES[c.dish].name+'」인데 「'+DISHES[d.type].name+'」이 왔어요!')}
    else if(r==='notSimilar'){S.penalty+=WRONG_COST;pay(WRONG_COST);c.mood='💢';floatAtSlot(c.slot,'−'+WRONG_COST,'bad');bumpCoins();toast('💢 원본과 모양이 달라요!  −'+WRONG_COST+'코인')}
    else{c.mood='💧';floatAtSlot(c.slot,d.n<c.N?'너무 작아요':'너무 커요','bad');toast('💧 이 크기가 아니에요. '+(d.n<c.N?'너무 작아요':'너무 커요')+'!')}
  }
  updateAll();return true;
}
/* 쓰레기통 뚜껑: 빵을 끌어다 대면(.drop) 열리고, 버리면 잠깐 열렸다가 탁 닫힌다 */
var trashT=null;
function trashGulp(){
  var t=$('trash');t.classList.add('gulp');clearTimeout(trashT);
  trashT=setTimeout(function(){t.classList.remove('gulp')},420);
}
function discard(src){
  if(S.phase!=='play'||S.guide||isOvenFocus())return false;
  var d=getDish(src);if(!d)return false;
  var n=d.n;S.wasted+=n;G.wastedAll+=n;S.trashed++;G.trashedAll++;
  removeDish(src);sfx('trash');trashGulp();
  toast('🗑️ 버렸어요'+(n?' (재료 '+n+'개 낭비)':''));updateAll();return true;
}
$('trash').addEventListener('click',function(){if(!isOvenFocus()&&S.sel)discard(S.sel)});
$('ovenBox').addEventListener('click',function(){
  if(isOvenFocus())return;
  if(S.sel==='bench')toOven();
});

/* ===== 요리 끌어다 놓기 ===== */
var drag=null,ghost=$('ghost'),gctx=ghost.getContext('2d');
function canvasPtViewport(cnv,W,H,x,y){
  var r=cnv.getBoundingClientRect(),s=Math.min(r.width/W,r.height/H);
  return{x:r.left+(r.width-W*s)/2+x*s,y:r.top+(r.height-H*s)/2+y*s,s:s};
}
function dragDishGeom(src,d){
  if(src==='bench'){
    var vd=viewDish(d),cell=benchCell(vd);
    return{cnv:bcv,W:BW,H:BH,cell:cell,cx:BW/2,baseY:BBASE};
  }
  var useSpr=!!sprite(OVEN_SPR[G.u.oven]),scn=sceneOven();
  var OB=scn?228:(useSpr?Math.round(OH*0.60):OBASE);
  var cell=scn?fitCell(d,118,78,28):fitCell(d,useSpr?150:220,useSpr?92:135,useSpr?30:44);
  return{cnv:ocv,W:OW,H:OH,cell:cell,cx:OW/2,baseY:OB};
}
function isDragActive(src){return !!(drag&&drag.started&&drag.src===src)}
function canDragFrom(src){
  if(S.phase!=='play'||S.guide||isOvenFocus())return false;
  var d=getDish(src);
  if(src==='bench'){
    if(!d||!d.n)return false;
    if(d.hideUntil&&performance.now()<d.hideUntil)return false;
    return true;
  }
  return !!(d&&S.oven.state==='done');
}
function setupDish(cnv,src,W,H){
  cnv.addEventListener('pointerdown',function(e){
    if(!canDragFrom(src))return;
    e.preventDefault();
    try{cnv.setPointerCapture(e.pointerId)}catch(err){}
    var d=getDish(src);
    drag={src:src,cnv:cnv,W:W,H:H,x0:e.clientX,y0:e.clientY,started:true,pid:e.pointerId};
    beginGhost(d,src,e.clientX,e.clientY);
    moveGhost(e.clientX,e.clientY);
    if(src==='bench')renderBench();else renderOven();
  });
}
setupDish(bcv,'bench',BW,BH);setupDish(ocv,'oven',OW,OH);
function beginGhost(d,src,fx,fy){
  var g=dragDishGeom(src,d),box=dishBox(d,g.cell,g.cx,g.baseY),pad=6;
  var gw=Math.ceil(box.w+pad*2),gh=Math.ceil(box.h+pad*2);
  var gcx=gw/2,gbaseY=gh-pad;
  var vp=canvasPtViewport(g.cnv,g.W,g.H,g.cx,g.baseY);
  var fp=toGame(fx,fy),ap=toGame(vp.x,vp.y);
  drag.geom={gw:gw,gh:gh,gcx:gcx,gbaseY:gbaseY,vscale:vp.s};
  drag.ox=fp.x-ap.x;drag.oy=fp.y-ap.y;
  hidpi(ghost,gw,gh,VIEW.q);
  ghost.style.width=(gw*vp.s)+'px';ghost.style.height=(gh*vp.s)+'px';
  gctx.clearRect(0,0,gw,gh);
  drawDishState(gctx,gcx,gbaseY,g.cell,d,d.cooked?1:0);
  ghost.style.display='block';
  document.documentElement.classList.add('dragging');
}
/* 끌고 다니는 그림은 손가락을 따라간다. 돌아갔으면 손가락 좌표를 게임 좌표로 바꿔야 한다 */
function moveGhost(x,y){
  if(!drag||!drag.geom)return;
  var p=toGame(x,y),gm=drag.geom;
  ghost.style.transform='translate('+(p.x-drag.ox-gm.gcx*gm.vscale)+'px,'+(p.y-drag.oy-gm.gbaseY*gm.vscale)+'px)';
}
function targetAt(x,y){
  /* 손님 그림은 도마·오븐 칸 뒤에 있다. 맨 위만 보면 말풍선에만 놓을 수 있다. */
  var list=document.elementsFromPoint?document.elementsFromPoint(x,y):[];
  if(!list.length){var one=document.elementFromPoint(x,y);if(one)list=[one]}
  var slot=-1,trash=false,oven=false;
  for(var i=0;i<list.length;i++){
    var el=list[i];if(!el.closest)continue;
    if(slot<0){
      var part=el.closest('.cat')||el.closest('.bubble');
      var sl=part&&part.closest('.slot');
      if(sl&&!sl.classList.contains('empty'))slot=slotEls.indexOf(sl);
    }
    if(!trash&&el.closest('#trash'))trash=true;
    if(!oven&&el.closest('#ovenBox'))oven=true;
  }
  return {slot:slot,trash:trash,oven:oven};
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
  if(!drag||e.pointerId!==drag.pid||!drag.started)return;
  moveGhost(e.clientX,e.clientY);hoverTargets(e.clientX,e.clientY);
});
function finishDrag(e,cancel){
  if(!drag||e.pointerId!==drag.pid)return;
  var dr=drag;drag=null;
  try{dr.cnv.releasePointerCapture(e.pointerId)}catch(err){}
  document.documentElement.classList.remove('dragging');
  ghost.style.display='none';clearHover();
  if(dr.src==='bench')renderBench();else if(dr.src==='oven')renderOven();
  if(cancel)return;
  var moved=Math.hypot(e.clientX-dr.x0,e.clientY-dr.y0);
  if(moved<=DRAG_SLOP){
    if(dr.src==='bench'){
      if(S.bench){S.sel=S.sel==='bench'?null:'bench';updateAll()}
    }else if(dr.src==='oven'){
      if(S.oven.dish&&S.oven.state==='done'){S.sel=S.sel==='oven'?null:'oven';updateAll()}
    }
    return;
  }
  var t=targetAt(e.clientX,e.clientY);
  if(t.slot>=0){var c=slotCust(t.slot);if(c)serveDish(dr.src,c);else toast('손님이 없는 자리예요')}
  else if(t.trash)discard(dr.src);
  else if(t.oven&&dr.src==='bench')toOven();
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
  var tleft=Math.max(0,S.roundT-S.time),ot=overtime();
  $('timerBar').style.transform='scaleX('+(ot?1:clamp(tleft/S.roundT,0,1))+')';
  $('timerBar').parentNode.classList.toggle('warn',tleft<=10&&tleft>0);
  $('timerBar').parentNode.classList.toggle('over',ot);
  var tt=$('timerTxt');if(tt)tt.textContent=ot?'⏰ 추가 시간':fmtTime(tleft);
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
  G.round=r;
  /* 빵은 라운드에 맞춰 저절로 열린다. 모두가 그 라운드의 새 개념(제곱·세제곱)을 만나야 한다 */
  DISHES.forEach(function(D,i){if(D.unlockR<=r&&!owned(i)){G.u.dish[i]=1;G.u.bag[i]={1:1}}});
  newRound(r);fx=[];fxClear();clearFlight();shopState();
  shake.mag=0;shake.until=0;applyStage(0,0);
  setOvenFocus(false);
  setOverlay('endConfirm',false);
  setEndBtn(false);
  S.guide=true;
  var ic=[];DISHES.forEach(function(d,i){if(owned(i))ic.push(d.ico)});
  $('hudTitle').textContent=r+'라운드';
  $('riIco').textContent=ic.join(' ');
  $('riTitle').textContent=r+'라운드';
  var msg=r===1?'<b>냥 바게트</b> 주문이 들어와요. 바게트는 반죽 마디가 한 줄로 길게 이어져요. <b>반죽 1개가 원본 바게트</b>예요!'
    :'오늘도 손님이 몰려와요!'+(GIANT_AT[r]?'<br>👑 <b>자이언트</b> 손님이 올 수도 있어요!':'');
  DISHES.forEach(function(d,i){if(d.unlockR===r&&r>1)msg+='<br>🆕 <b>'+d.name+'</b> 주문이 새로 들어와요! (재료: <b>'+d.ing+'</b>)'});
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
      if(c.wait>=c.pat){c.state='angry';c.until=S.time+0.9;S.streak=0;S.left++;G.leftAll++;sfx('angry');floatAtSlot(c.slot,'떠났어요','bad');toast('💢 손님이 화나서 떠났어요');shopWarn()}
    }else if((c.state==='happy'||c.state==='angry')&&S.time>=c.until){
      var sp=c.state==='happy'?c.speed:0;
      /* 캥거루를 만족시키면 자리를 뜨지 않는다. 같은 손님이 아기가 나온 모습으로 바뀌고, 같은 빵을 1:1로 한 번 더 주문한다 */
      if(c.kind==='roo'&&c.state==='happy'){
        var an=KIND_LOOK.joey;
        c.kind='joey';c.an=an[0];c.anName=an[1];c.spr=an[2]||'';
        c.k=1;c.N=needOf(c.dish,1);
        c.pat=Math.round((44+7*Math.sqrt(c.N))*PAT_SCALE);
        c.wait=0;c.fails=0;c.got=null;c.gotUntil=0;c.mood='';c.animT0=null;
        c.state='wait';
        floatAtSlot(c.slot,'아기도 주문해요!','ok');sfx('arrive');
      }else{
        c.state='gone';callNext(sp);c.slot=-1;
      }
    }
  });
  if(S.phase!=='play')return;          // 방금 가게가 무너졌다
  if(overtime()&&!S.otNoted&&liveCustCount()){S.otNoted=true;sfx('warn');toast('⏰ 추가 시간! 남은 손님을 마저 받아요',2200)}
  if(G.leftAll>=3&&S.time>=(S.dustAt||0)){dustFall(3);S.dustAt=S.time+3+Math.random()*2.5}   // 3회부터 먼지가 자주 떨어진다
  if(!overtime()&&freeSeat()>=0&&canSpawnMore()){
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
  if(S.phase!=='play')return;          // 가게가 무너지면 update 안에서 판이 끝난다
  tickShake(now);
  if(overtime()&&!liveCustCount()){finishRound();return}
  updateHud();renderBench();renderOven();renderFocusRing();renderFly();
  requestAnimationFrame(loop);
}
function row(a,b){return '<tr><td>'+a+'</td><td class="r">'+(b>0?'+':'')+b+'</td></tr>'}
function ledgerRows(o){
  return row('서빙 보상',o.reward)+row('빨리 서빙 보너스',o.patience)+row('콤보 보너스',o.combo)+row('닮은 모양이 아닌 빵 서빙 ('+o.notSimilar+'회)',-o.penalty);
}
/* 라운드가 끝나는 프레임에는 루프가 날아가는 빵을 더 그리지 않는다.
   그때 무대 캔버스·끌고 있던 그림에 남은 빵이 장부 위에 그대로 보인다. */
function clearFlight(){
  fliers.length=0;dishFly.length=0;
  if(fctx){
    fctx.save();
    fctx.setTransform(1,0,0,1,0,0);
    fctx.clearRect(0,0,flyCv.width,flyCv.height);
    fctx.restore();
    flyDirty=false;
  }
  if(bctx)bctx.clearRect(0,0,BW,BH);
  if(octx)octx.clearRect(0,0,OW,OH);
  if(drag){
    try{if(drag.cnv)drag.cnv.releasePointerCapture(drag.pid)}catch(err){}
    drag=null;
  }
  document.documentElement.classList.remove('dragging');
  if(ghost)ghost.style.display='none';
  var trash=$('trash');if(trash)trash.classList.remove('drop');
  var box=$('ovenBox');if(box)box.classList.remove('drop');
  if(S)S.hover=-1;
}
function finishRound(){
  S.phase='roundEnd';
  S.bench=null;S.oven=ovenIdle();S.sel=null;
  clearFlight();
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
/* 빵은 사지 않는다. 아직 안 열린 빵을 누르면 언제 열리는지만 알려 준다 */
function notOpen(i){toast(DISHES[i].name+'는 '+DISHES[i].unlockR+'라운드부터 나와요')}
function upOven(){var ov=G.u.oven;if(ov>=3)return false;
  if(!spend(OVEN[ov+1].cost,OVEN[ov+1].name+'! '+OVEN[ov+1].desc))return false;G.u.oven=ov+1;if(S.oven.state==='idle')S.oven.need=OVEN[ov+1].taps;updateAll();return true}
function buyBag(i,n){if(!owned(i)||n!==nextBag(i))return false;if(!spend(BAGCOST[n],DISHES[i].ing+' '+n+'개를 한 번에 넣을 수 있어요!'))return false;G.u.bag[i][n]=1;updateAll();return true}
$('ovenUp').addEventListener('click',function(e){e.stopPropagation();if(!isOvenFocus())upOven()});
function renderUpg(){
  dishEls.forEach(function(el,i){
    var lk=el.querySelector('.lk'),h=owned(i)?'':'<span class="lk-cost">R'+DISHES[i].unlockR+'</span>';
    if(lk.innerHTML!==h)lk.innerHTML=h;
  });
  var ov=G.u.oven,ob=$('ovenUp');
  $('ovenBox').dataset.lv=String(ov);   /* 오븐 단계별 전용 그림이 오기 전까지는 CSS 색으로 구분 */
  if(ov<3){
    ob.innerHTML='⬆ '+OVEN[ov+1].cost;
    ob.title=OVEN[ov+1].name+' · '+OVEN[ov+1].desc;
    ob.classList.toggle('can',G.wallet>=OVEN[ov+1].cost);ob.style.display='';
  }else{ob.innerHTML='★';ob.title='황금 오븐';ob.classList.remove('can')}
}
$('nextBtn').onclick=function(){startRound(G.round+1,false)};

function askEndGame(){
  if(S.phase!=='play'||S.guide)return;
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
$('endConfirmBtn').onclick=confirmEndGame;
$('endCancelBtn').onclick=cancelEndGame;

function finishGame(){
  if(S){S.bench=null;if(G.u)S.oven=ovenIdle();S.sel=null}
  clearFlight();
  setOvenFocus(false);
  setEndBtn(false);
  setOverlay('endConfirm',false);
  setOverlay('guide',false);
  setOverlay('rintro',false);
  var sum=G.earned+30;
  $('resTitle').textContent=G.collapsed?'🏚️ 가게가 무너졌어요!':sum>=1200?'🏆 대성공!':sum>=600?'👍 잘했어요!':'😺 수고했어요!';
  $('resSub').textContent=G.collapsed?'화나서 떠난 손님이 '+COLLAPSE_AT+'명이 되었어요. 그래도 번 코인은 그대로 점수예요!':'총 벌어들인 코인이 점수예요!';
  var h='<tr><th>라운드</th><th class="r">코인</th></tr>';
  G.log.forEach(function(l){h+='<tr><td>R'+l.r+' · 손님 '+l.served+'명</td><td class="r">'+l.net+'</td></tr>'});
  h+=row('참여 보너스',30)+'<tr class="total"><td>최종 점수</td><td class="r">'+sum+'코인</td></tr>';
  $('ledger').innerHTML=h;
  var t=[],w=G.wrongAll;
  if(w.notSimilar>0)t.push('🙅 원본과 모양이 다른 빵을 서빙한 적이 있어요. 어떻게 하면 원본과 닮은 모양이 될까요?');
  if(G.trashedAll>0)t.push('🗑️ 버린 빵 '+G.trashedAll+'개 (낭비한 재료 '+G.wastedAll+'개).');
  var insight=$('insight');
  insight.innerHTML=t.join('<br>');
  insight.hidden=!t.length;
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
   무대는 논리 720×360(2:1) 한 장이다. 배경 그림(1280×640)과 같은 비율이라, 어느 기기에서나
   장면을 통째로 확대·축소만 한다(폰 전용 배치 없음). 배율 = min(가로/720, 세로/360).
   마우스·트랙패드 PC는 1280×640 이상으로 키우지 않아 큰 모니터에서도 여백이 남는다.
   남는 가장자리는 몸통 배경색. safe-area는 빼고, 스케일은 visualViewport 기준으로 잡는다. */
var DESIGN={w:720,h:360};
var DESKTOP_STAGE_CAP={w:1280,h:640};
function isMouseDesktop(){
  try{return matchMedia('(any-hover: hover) and (any-pointer: fine)').matches}catch(e){return false}
}
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
  hidpi(bcv,BW,BH,q);hidpi(ocv,OW,OH,q);
  if(drag&&drag.geom){
    hidpi(ghost,drag.geom.gw,drag.geom.gh,q);
    ghost.style.width=(drag.geom.gw*drag.geom.vscale)+'px';
    ghost.style.height=(drag.geom.gh*drag.geom.vscale)+'px';
  }else{hidpi(ghost,200,200,q);ghost.style.width='0';ghost.style.height='0'}
  if(focusCv)hidpi(focusCv,FOCUS_W,FOCUS_H,q);
  slotEls.forEach(function(el){hidpi(el.querySelector('canvas'),SLOT_W,SLOT_H,q)});
  dishEls.forEach(function(el){hidpi(el.querySelector('canvas'),100,70,q)});
  itemEls.forEach(function(it){if(it.cv)hidpi(it.cv,it.w,it.h,q)});
  return true;
}
function invalidate(){
  dishEls.forEach(function(el){el.dataset.lv=''});
  itemEls.forEach(function(it){it.el.dataset.key=''});
  slotEls.forEach(function(el){el.dataset.cid='';el.dataset.mode='';el.dataset.f=''});
  if(S&&S.oven)updateAll();else renderShelf();
}
function fit(){
  applyForcedLandscape(isNaturalPortrait());
  var v=vpSize(),D=DESIGN;
  /* 논리 화면이 폰 크기라 좁은 화면용 글자·여백 규칙(.compact)을 늘 쓴다 */
  document.documentElement.classList.toggle('compact',true);
  document.documentElement.classList.toggle('scene-v2',true);
  BBASE=243;
  stage.style.width=D.w+'px';stage.style.height=D.h+'px';
  var s=Math.min(v.w/D.w,v.h/D.h);
  if(isMouseDesktop())s=Math.min(s,DESKTOP_STAGE_CAP.w/D.w,DESKTOP_STAGE_CAP.h/D.h);
  VIEW.w=v.w;VIEW.h=v.h;VIEW.s=s;VIEW.compact=true;
  VIEW.ox=v.ox+(v.w-D.w*s)/2;VIEW.oy=v.oy+(v.h-D.h*s)/2;
  applyStage(0,0);
  if(setupCanvases())invalidate();
  syncFly();
  layoutChrome();
  if(isOvenFocus())placeOvenFocus();
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
  fit();syncFsBtn();sndSync();
});

/* 캔버스는 글꼴이 다 받아지기 전에 그리면 기본 글꼴로 남는다. 받아지면 주문 카드를 한 번 다시 그린다 */
if(document.fonts&&document.fonts.load){
  Promise.all([document.fonts.load("16px Jua"),document.fonts.load("16px Pretendard")]).then(function(){
    slotEls.forEach(function(el){el.dataset.cid='';el.dataset.mode='';el.dataset.f=''});
    if(S&&S.phase==='play')updateAll();
  },function(){});
}
window.__api={chooseDish:chooseDish,selectDish:selectDish,addFromShelf:addFromShelf,addN:addN,toOven:toOven,cookTap:cookTap,setClock:function(f){clock=f},
  serveDish:serveDish,discard:discard,tick:function(d){update(d);updateAll()},endGuide:endGuide,startGame:startGame,startRound:startRound,
  finishRound:finishRound,slotCust:slotCust,judge:judge,needOf:needOf,baseOf:baseOf,spawn:spawn,upOven:upOven,buyBag:buyBag,
  setRnd:function(f){rnd=f},
  /* 테스트·시뮬레이션용 값 바꾸기 (game.js는 함수로 감싸여 있어 window에서 바꿀 수 없다) */
  tune:function(o){if(o.pat!=null)PAT_SCALE=o.pat;if(o.kind!=null)KIND_CHANCE=o.kind;return{pat:PAT_SCALE,kind:KIND_CHANCE}},
  refresh:refresh,newDish:newDish,earn:earn,
  fit:fit,view:function(){return VIEW},
  tapSource:tapSource,fliers:function(){return fliers.length},
  renderFly:function(){renderFly()},renderBench:function(){renderBench()},renderOven:function(){renderOven()},dishFly:function(){return dishFly.length},
  tapAmt:function(i,n){return tapSource(i,srcEls[i],n)}};
})();
