(function(){
'use strict';

/* ===== 포털 연동 (이름·학번·랭킹) =====
   집 안의 다른 게임과 같은 방식이다. shared/halomath-*.js가 실제 일을 하고
   여기서는 부르기만 한다. Firebase가 없거나 막혀도 게임은 그대로 돌아가야 한다. */
var firebaseConfig=(window.ENV&&window.ENV.FIREBASE_CONFIG)||null;
var firebaseDb=null;
if(window.firebase&&firebaseConfig&&firebaseConfig.apiKey){
  try{
    if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
    firebaseDb=firebase.database();
  }catch(err){console.error('Firebase init failed:',err)}
}
var GAME_ID='similar-kitchen';
var GAME_IDS=['similar-kitchen','nyang-bakery','similar_kitchen'];
var activeMode=(window.HalomathMode&&HalomathMode.detectActiveMode())||'school';
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
var ANIMALS=[['🦁','사자'],['🐯','호랑이'],['🦛','하마'],['🐘','코끼리'],['🦒','기린'],['🦏','코뿔소'],['🐻','곰']];
var DISHES=[
  {name:'냥 바게트',ing:'반죽',ico:'🥖',dim:1,max:15,tile:'#e8a94f',edge:'#b8742a',raw:'#f6e6c8',rawEdge:'#dcc08e',unit:'개',price:0,unlockR:1,up:[150,300],lvDesc:['','','깨를 솔솔 뿌린 바게트','윤기 나는 황금 바게트']},
  {name:'냥 토스트',ing:'식빵',ico:'🍞',dim:2,max:120,tile:'#ffd24a',edge:'#e0a800',raw:'#f6e8b8',rawEdge:'#d8c48a',unit:'개',price:120,unlockR:2,up:[180,340],lvDesc:['','','버터를 올린 토스트','딸기잼 토스트']},
  {name:'냥 케이크',ing:'스펀지',ico:'🍰',dim:3,max:130,tile:'#ff8fb1',edge:'#e0507c',raw:'#ffdbe6',rawEdge:'#e8b4c6',unit:'개',price:260,unlockR:3,up:[220,400],lvDesc:['','','딸기 케이크','초콜릿 케이크']}
];
var LVMULT=[0,1,1.5,2.2];
var OVEN=[null,{taps:5,name:'기본 오븐',cost:0,desc:'5번 탭'},{taps:3,name:'벽돌 오븐',cost:150,desc:'3번만 탭!'},{taps:2,name:'황금 오븐',cost:320,desc:'2번만 탭!'}];
var BAGS=[1,5,10,50,100],BAGCOST={1:0,5:50,10:110,50:240,100:380};
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
function stageXY(el){
  var r=el.getBoundingClientRect(),s=stage.getBoundingClientRect();
  return{x:(r.left+r.width/2-s.left)/VIEW.s,y:(r.top+r.height/2-s.top)/VIEW.s};
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
  G={round:1,wallet:0,earned:0,log:[],seen:{},first:true,hintOn:true,
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
         an:an[0],anName:an[1],got:null,gotUntil:0,mood:''};
}
function freeSeat(){
  var used={};S.cust.forEach(function(c){if(c.slot>=0&&c.state!=='gone')used[c.slot]=true});
  for(var i=0;i<SLOTS;i++)if(!used[i])return i;return -1;
}
function spawn(giant){
  var seat=freeSeat();if(seat<0)return null;
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
  if(r.height)t.style.top=Math.round(r.bottom+8)+'px';
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
  if(dim===1)c=Math.min(mw/(d.w+0.5),mh/1.6);
  else if(dim===2)c=Math.min(mw/d.w,mh/(1.36*d.h));
  else c=Math.min(mh/(d.s+d.L+0.4),mw/(1.75*d.s+0.2));
  return Math.max(4,Math.floor(Math.min(cap,c)));
}
function dishBox(d,cell,cx,baseY){
  var dim=DISHES[d.type].dim,w,h;
  if(dim===1){w=d.w*cell+12;h=cell*1.2}
  else if(dim===2){w=d.w*cell;h=d.h*cell*1.3}
  else{w=1.75*d.s*cell;h=(d.s+d.L)*cell}
  return{x:cx-w/2,y:baseY-h,w:w,h:h};
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

/* ===== 재료 선반 (요리별 재료) ===== */
var dishEls=[];
(function(){
  var sh=$('shelf');
  DISHES.forEach(function(m,i){
    var b=document.createElement('div');b.className='mold';
    b.innerHTML='<canvas width="100" height="70"></canvas><b>'+m.ico+' '+m.ing+'</b><span>'+m.name+'</span><button class="upb"></button><div class="lock"><div class="lk"></div></div>';
    b.addEventListener('click',function(){if(!owned(i))buyDish(i);else chooseDish(i)});
    b.querySelector('.upb').addEventListener('click',function(e){e.stopPropagation();upDish(i)});
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
function chooseDish(i){
  if(S.phase!=='play'||S.guide)return;
  if(!owned(i)){buyDish(i);return}
  S.bench=newDish(i);fx=[];S.sel=null;updateAll();
}

/* ===== 작업판 ===== */
var BW=360,BH=300,BBASE=282;
var bcv=$('benchCv'),bctx=bcv.getContext('2d');
function benchCell(d){return fitCell(d,330,200,72)}
function renderBench(){
  bctx.clearRect(0,0,BW,BH);
  var d=S.bench;
  if(!d){
    bctx.fillStyle='#b59a72';bctx.font='800 20px Malgun Gothic,sans-serif';bctx.textAlign='center';
    bctx.fillText('👈 재료 선반을 골라요',BW/2,BH/2);
  }else{
    if(d.n===0){
      bctx.fillStyle='#b59a72';bctx.font='800 18px Malgun Gothic,sans-serif';bctx.textAlign='center';
      bctx.fillText('빈 접시 · 재료 봉지를 끌어다 놓아요',BW/2,BH/2-30);
      var e=newDish(d.type);drawDishState(bctx,BW/2,BBASE,64,e,0);
    }else drawDishState(bctx,BW/2,BBASE,benchCell(d),d,0);
    bctx.fillStyle='#3b2a1a';bctx.font='800 16px Malgun Gothic,sans-serif';bctx.textAlign='center';
    if(d.n>0)bctx.fillText(DISHES[d.type].ico+' '+d.n+'개',BW/2,BBASE+15);
  }
  var nw=performance.now();
  fx=fx.filter(function(f){return nw-f.t0<f.dl+700});
  fx.forEach(function(f){var a=nw-f.t0-f.dl;if(a<0)return;var q=Math.min(1,a/320),y=-20+(f.y1+20)*q*q;bctx.save();bctx.globalAlpha=a>320?Math.max(0,1-(a-320)/380):1;bctx.font='28px sans-serif';bctx.textAlign='center';bctx.translate(f.x,y);bctx.rotate(f.rot*q);bctx.fillText(f.ico,0,0);bctx.restore()});
  $('benchWrap').classList.toggle('sel',S.sel==='bench');
  var t=$('benchInfo');
  if(!d)t.textContent='';else t.textContent=DISHES[d.type].name+' · '+DISHES[d.type].ing+' '+d.n+'개';
  var ok=d&&d.n>0&&S.oven.state==='idle'&&!S.oven.dish;
  $('toOven').classList.toggle('off',!ok);
}
var fx=[];
function spawnFx(d,n){
  var cell=benchCell(d),b=dishBox(d,cell,BW/2,BBASE),now=performance.now(),ico=DISHES[d.type].ico;
  for(var i=0;i<Math.min(n,12);i++)fx.push({x:b.x+b.w*(0.15+0.7*rnd()),y1:b.y+b.h*(0.3+0.6*rnd()),t0:now,dl:i*60,ico:ico,rot:(rnd()-.5)*2});
}
function pt(cnv,e,W,H){var r=cnv.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
function addN(n){
  if(S.guide||S.phase!=='play')return;
  var d=S.bench;if(!d){toast('👈 먼저 요리를 골라요');return}
  var mx=DISHES[d.type].max;
  if(n>0){
    var can=Math.min(n,mx-d.n);
    if(can<=0){toast('접시가 가득 찼어요');return}
    /* 봉지가 접시 한도에 잘려 일부만 들어가면 학생이 모른 채 개수를 틀린다 */
    if(can<n)toast('접시에 '+can+'개만 더 들어가요');
    d.n+=can;refresh(d);spawnFx(d,can);sfx(n>1?'bag':'tap');
  }else{
    var m=Math.min(-n,d.n);if(m<=0)return;
    d.n-=m;refresh(d);
  }
  updateAll();
}
function clearBench(){var d=S.bench;if(!d||!d.n)return;d.n=0;refresh(d);updateAll()}
$('um1').onclick=function(){addN(-1)};
$('clearBtn').onclick=function(){if(S.phase==='play'&&!S.guide)clearBench()};

/* ===== 재료 봉지 (끌어다 놓기) ===== */
var bagEls={};
(function(){
  var box=$('bags');
  BAGS.forEach(function(n){
    var b=document.createElement('div');b.className='bag';b.id='u'+n;b.dataset.n=n;
    b.innerHTML='<span class="bi"></span><span class="bl">'+n+'개</span><div class="bk"></div>';
    box.appendChild(b);bagEls[n]=b;
    b.addEventListener('pointerdown',function(e){
      if(S.phase!=='play'||S.guide)return;
      if(!G.u.bag[n]){buyBag(n);return}
      e.preventDefault();bagDrag={n:n,x0:e.clientX,y0:e.clientY,started:false,pid:e.pointerId};
    });
  });
})();
function renderBags(){
  var bd=S.bench,D=DISHES[bd?bd.type:0];
  BAGS.forEach(function(n){
    var el=bagEls[n],has=!!G.u.bag[n];
    el.classList.toggle('locked',!has);el.classList.toggle('off',has&&(!bd||S.guide));
    el.querySelector('.bi').textContent=n>=50?new Array(n>=100?3:2).join('📦'):new Array((n===1?1:n===5?2:3)+1).join(D.ico);
  });
}
var bagDrag=null;
function bagOver(x,y){var el=document.elementFromPoint(x,y);return !!(el&&el.closest&&el.closest('#benchWrap'))}
window.addEventListener('pointermove',function(e){
  if(!bagDrag||e.pointerId!==bagDrag.pid)return;
  var g=$('ghost');
  if(!bagDrag.started&&Math.hypot(e.clientX-bagDrag.x0,e.clientY-bagDrag.y0)>DRAG_SLOP){
    bagDrag.started=true;
    var c=g.getContext('2d'),ic=DISHES[S.bench?S.bench.type:0].ico;
    c.clearRect(0,0,200,200);c.font='40px sans-serif';c.textAlign='center';
    for(var i=0;i<Math.min(bagDrag.n,5,bagDrag.n>=50?1:5);i++)c.fillText(bagDrag.n>=50?'📦':ic,60+i*20,120+(i%2)*14);
    c.font='800 22px Malgun Gothic,sans-serif';c.fillStyle='#3b2a1a';c.fillText('×'+bagDrag.n,100,165);
    g.style.display='block';
  }
  if(bagDrag.started){g.style.transform='translate('+(e.clientX-100*VIEW.s)+'px,'+(e.clientY-140*VIEW.s)+'px)';$('benchWrap').classList.toggle('drop',bagOver(e.clientX,e.clientY))}
});
function endBag(e,cancel){
  if(!bagDrag||e.pointerId!==bagDrag.pid)return;
  var b=bagDrag;bagDrag=null;$('benchWrap').classList.remove('drop');
  if(b.started){$('ghost').style.display='none';if(!cancel&&bagOver(e.clientX,e.clientY))addN(b.n);else if(!cancel)toast('🍽️ 접시 위에 놓아야 해요')}
  else if(!cancel)addN(b.n);
}
window.addEventListener('pointerup',function(e){endBag(e,false)});
window.addEventListener('pointercancel',function(e){endBag(e,true)});

/* ===== 오븐 (리듬 굽기) ===== */
var OW=260,OH=280,OBASE=262;
var ocv=$('ovenCv'),octx=ocv.getContext('2d');
function toOven(){
  if(S.phase!=='play'||S.guide)return;
  var d=S.bench;
  if(!d){toast('👈 먼저 요리를 고르고 재료를 넣어요');return}
  if(d.n<=0){toast('🧺 재료를 넣어 주세요');return}
  if(S.oven.dish){toast('🔥 오븐이 차 있어요. 완성품을 먼저 꺼내요');return}
  S.oven={dish:d,state:'cooking',t0:clock(),n:0,need:OVEN[G.u.oven].taps,grades:[],last:null};
  S.bench=null;S.sel=null;fx=[];
  toast('🔥 화면 아무 곳이나 박자에 맞춰 톡! '+S.oven.need+'번이면 완성!',2000);updateAll();
}
$('toOven').onclick=toOven;
function cookTap(){
  var o=S.oven;if(o.state!=='cooking')return;
  var t=(clock()-o.t0)/1000,n=Math.max(1,Math.round(t/BEAT)),dev=Math.abs(t-n*BEAT);
  var g=dev<=0.10?'perfect':(dev<=0.20?'good':'miss'),q=g==='perfect'?1:(g==='good'?0.7:0.4);
  o.grades.push(q);o.n++;o.last={g:g,at:clock()};
  sfx(g);
  if(o.n>=o.need){
    o.state='done';o.dish.cooked=true;
    o.dish.quality=o.grades.reduce(function(a,b){return a+b},0)/o.grades.length;
    sfx('done');
    toast('✅ 완성! 완성도 '+Math.round(o.dish.quality*100)+'% · 거인에게 끌어다 놓아요');
  }
  updateAll();
}
/* 화면 아무 곳이나 탭 = 박자 1번. 두 손가락이나 손바닥이 한꺼번에 닿아도 1번으로 센다 */
var ovenLastTap=-1e9;
window.addEventListener('pointerdown',function(e){
  if(S.phase!=='play'||S.guide||!S.oven||S.oven.state!=='cooking')return;
  if(e.isPrimary===false)return;
  var t=clock();if(t-ovenLastTap<90)return;
  ovenLastTap=t;cookTap();
},true);
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
function ovenFrame(c,lv){
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
    octx.fillStyle='#8f7350';octx.font='700 16px Malgun Gothic,sans-serif';octx.textAlign='center';
    octx.fillText('빈 오븐',OW/2,OH/2);
    octx.font='13px Malgun Gothic,sans-serif';octx.fillText('작업판에서 🔥 오븐에 넣어요',OW/2,OH/2+22);
    return;
  }
  var CO=fitCell(d,220,135,44);
  var bs=1+(o.last&&clock()-o.last.at<260?0.09*(1-(clock()-o.last.at)/260):0);
  var pr=o.state==='done'?1:Math.min(0.95,o.n/o.need),bx=dishBox(d,CO,OW/2,OBASE);
  octx.save();octx.translate(OW/2,OBASE);octx.scale(bs,bs);octx.translate(-OW/2,-OBASE);
  drawDishState(octx,OW/2,OBASE,CO,d,pr);
  if(DISHES[d.type].dim===2){
    var w=d.w*CO,h=d.h*CO;
    octx.save();rr(octx,OW/2-w/2,OBASE-h,w,h,Math.min(w,h)*0.12);octx.fillStyle='rgba(150,70,15,'+(0.03+0.4*(o.state==='done'?1:pr))+')';octx.fill();octx.restore();
  }
  octx.restore();
  steam(octx,o,OW/2,bx.y,bx.w,pr);
  if(o.state==='cooking'){
    var ct=(clock()-o.t0)/1000,nb=(Math.floor(ct/BEAT)+1)*BEAT,ph=clamp((nb-ct)/BEAT,0,1);
    var rx=OW/2,ry=58,r0=22;
    octx.beginPath();octx.arc(rx,ry,r0,0,7);octx.fillStyle='rgba(255,138,61,.25)';octx.fill();
    octx.lineWidth=5;octx.strokeStyle='#ff8a3d';octx.stroke();
    octx.beginPath();octx.arc(rx,ry,r0+ph*36,0,7);octx.lineWidth=4;octx.strokeStyle='rgba(120,180,255,'+(0.35+0.65*(1-ph))+')';octx.stroke();
    var l=o.last;
    if(l&&clock()-l.at<700){
      octx.font='800 20px Malgun Gothic,sans-serif';octx.textAlign='center';
      octx.fillStyle=l.g==='perfect'?'#5fe08f':l.g==='good'?'#ffc247':'#ff7a70';
      octx.fillText(l.g==='perfect'?'PERFECT!':l.g==='good'?'GOOD':'MISS',rx,ry-r0-8);
    }
    octx.fillStyle='#e8d4b0';octx.font='800 14px Malgun Gothic,sans-serif';octx.textAlign='center';
    octx.fillText('굽기 '+o.n+' / '+o.need,OW/2,OBASE+16);
  }else if(o.state==='done'){
    var q=d.quality;
    octx.fillStyle='#5fe08f';octx.font='800 18px Malgun Gothic,sans-serif';octx.textAlign='center';
    octx.fillText('✅ 완성! '+Math.round(q*100)+'% '+(q>=0.9?'⭐⭐⭐':q>=0.7?'⭐⭐':'⭐'),OW/2,44);
  }
  ocv.classList.toggle('sel',S.sel==='oven');
}

/* ===== 손님 슬롯 ===== */
var slotEls=[],SLOT_W=340,SLOT_H=120;
(function(){
  var row=$('custRow');
  for(var i=0;i<SLOTS;i++){
    var d=document.createElement('div');d.className='slot empty';
    d.innerHTML='<canvas width="'+SLOT_W+'" height="'+SLOT_H+'"></canvas><div class="cat">🪑</div><div class="tag">손님</div><div class="pbar"><i></i></div>';
    (function(idx){d.addEventListener('click',function(){
      if(S.phase!=='play'||S.guide)return;
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
  // 고양이 귀
  c.fillStyle=lv>=3?'#cf8420':D.tile;c.strokeStyle=D.edge;c.lineWidth=Math.max(1,h*0.06);
  [[0.12,0.42],[0.58,0.88]].forEach(function(v){c.beginPath();c.moveTo(x+h*v[0]+len*0,y+h*0.12);c.lineTo(x+h*(v[0]+v[1])/2,y-h*0.32);c.lineTo(x+h*v[1],y+h*0.12);c.closePath();c.fill();c.stroke()});
}
function sil(c,ty,k,cx,base,cap){
  if(ty===0){var h=20,len=Math.min(k*20,cap||140);loaf(c,cx,base,len,h,true)}
  else if(ty===1){var s=Math.min(k*14,cap||84),d=newDish(1,1);d.cooked=true;drawDishState(c,cx,base,s,d,1)}
  else{var a=Math.min(k*9,cap||36),d3=newDish(2,1);d3.cooked=true;cake(c,cx,base,a,d3,true)}
}
function drawBubble(cnv,c0,got){
  /* w,h는 논리 크기(SLOT_W/SLOT_H). cnv.width는 고해상도 대응 때문에 논리 크기와 다르다 */
  var k=c0.k,ty=c0.dish,c=cnv.getContext('2d'),w=SLOT_W,h=SLOT_H,base=h-14;
  c.clearRect(0,0,w,h);
  rr(c,2,2,w-4,h-6,16);c.fillStyle='#fff';c.fill();c.lineWidth=2;c.strokeStyle='#ead6b4';c.stroke();
  c.fillStyle='#8a6a45';c.font='700 12px Malgun Gothic,sans-serif';c.textAlign='left';
  if(!got){
    c.fillText(DISHES[ty].name+' 원본',12,base-36);
    sil(c,ty,1,40,base,30);
    c.fillStyle='#3b2a1a';c.font='800 22px Malgun Gothic,sans-serif';c.textAlign='center';c.fillText('→',100,base-14);
    sil(c,ty,k,186,base,ty===0?124:ty===1?84:38);
    c.fillStyle='#8a6a45';c.font='700 12px Malgun Gothic,sans-serif';c.textAlign='center';c.fillText('이 크기로 만들어 줘!',186,15);
    c.fillStyle=c0.giant?'#d94b43':'#c9631f';c.font='700 13px Malgun Gothic,sans-serif';c.textAlign='center';c.fillText('닮음비',296,base-52);
    c.font='800 24px Malgun Gothic,sans-serif';c.fillText('1 : '+k,296,base-26);
  }else{
    var g=got,gd=newDish(g.type,g.n);gd.cooked=true;
    c.fillStyle='#8a6a45';c.textAlign='center';c.font='700 13px Malgun Gothic,sans-serif';
    c.fillText('주문 1 : '+k,80,22);
    sil(c,ty,k,80,base,ty===0?110:ty===1?70:34);
    c.fillStyle='#d94b43';c.font='800 26px Malgun Gothic,sans-serif';c.fillText('≠',170,base-24);
    c.fillStyle='#d94b43';c.font='700 13px Malgun Gothic,sans-serif';
    c.fillText('받은 것 '+DISHES[g.type].ico+g.n+'개',260,22);
    var c2=fitCell(gd,110,76,20);drawDishState(c,260,base,c2,gd,1);
  }
}
function renderSlots(){
  for(var i=0;i<SLOTS;i++){
    var el=slotEls[i],c=slotCust(i);
    var cat=el.querySelector('.cat'),bar=el.querySelector('.pbar i'),tag=el.querySelector('.tag');
    if(!c){el.className='slot empty'+(S.hover===i?' drop':'');el.dataset.cid='';el.dataset.mode='';cat.textContent='🪑';bar.style.width='0%';continue}
    var showGot=c.got&&S.time<c.gotUntil,mode=showGot?'got':'ord';
    if(el.dataset.cid!==String(c.id)||el.dataset.mode!==mode||el.dataset.f!==String(c.fails||0)){
      el.dataset.f=String(c.fails||0);
      var fresh=el.dataset.cid!==String(c.id);
      drawBubble(el.querySelector('canvas'),c,showGot?c.got:null);
      el.dataset.cid=String(c.id);el.dataset.mode=mode;
      tag.textContent=c.giant?'👑 자이언트 '+c.anName:c.anName+' 손님';
      if(fresh){el.classList.remove('enter');void el.offsetWidth;el.classList.add('enter')}
    }
    var pct=clamp(1-c.wait/c.pat,0,1);
    el.className='slot'+(c.giant?' giant':'')+(el.classList.contains('enter')?' enter':'')+(c.state==='happy'?' happy':c.state==='angry'?' angry':(showGot?' sad':''))+(c.state==='wait'&&pct<0.3?' low':'')+(S.hover===i?' drop':'');
    var md=c.state==='happy'?'💖':c.state==='angry'?'💢':(showGot?(c.mood||'💧'):(pct<0.3?'💢':''));
    var html=c.an+(md?'<span class="md">'+md+'</span>':'');
    if(cat.innerHTML!==html)cat.innerHTML=html;
    bar.style.width=(c.state==='wait'?pct*100:0)+'%';
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
  if(S.phase!=='play'||S.guide)return false;
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
    G.seen[c.dish+':'+c.k]=c.N;
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
  if(S.phase!=='play'||S.guide)return false;
  var d=getDish(src);if(!d)return false;
  var n=d.n;S.wasted+=n;G.wastedAll+=n;S.trashed++;G.trashedAll++;
  removeDish(src);sfx('trash');
  toast('🗑️ 버렸어요'+(n?' (재료 '+n+'개 낭비)':''));updateAll();return true;
}
$('trash').addEventListener('click',function(){if(S.sel)discard(S.sel)});
$('ovenBox').addEventListener('click',function(e){
  if(e.target.id==='cookBtn')return;
  if(S.sel==='bench')toOven();
});

/* ===== 요리 끌어다 놓기 ===== */
var drag=null,ghost=$('ghost'),gctx=ghost.getContext('2d');
function setupDish(cnv,src,W,H){
  cnv.addEventListener('pointerdown',function(e){
    if(S.phase!=='play'||S.guide)return;
    e.preventDefault();
    drag={src:src,cnv:cnv,W:W,H:H,x0:e.clientX,y0:e.clientY,started:false,pid:e.pointerId};
  });
}
setupDish(bcv,'bench',BW,BH);setupDish(ocv,'oven',OW,OH);
function beginGhost(d){
  gctx.clearRect(0,0,200,200);
  drawDishState(gctx,100,190,fitCell(d,170,120,56),d,d.cooked?1:0);
  ghost.style.display='block';
}
function moveGhost(x,y){ghost.style.transform='translate('+(x-100*VIEW.s)+'px,'+(y-160*VIEW.s)+'px)'}
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
function updateHud(){
  $('coinsTxt').textContent='🪙 '+G.wallet;
  $('timerBar').style.transform='scaleX('+clamp(1-S.time/S.roundT,0,1)+')';
  var tleft=S.roundT-S.time;
  $('timerBar').parentNode.classList.toggle('warn',tleft<=10&&tleft>0);
  renderSlots();
  var cb=$('cookBtn'),o=S.oven;
  cb.className='btn'+(o.state==='cooking'?' cooking':o.state==='done'?' done':' off');
  cb.textContent=o.state==='cooking'?('🔥 아무 곳이나 톡! ('+o.n+'/'+o.need+')'):o.state==='done'?'✅ 완성! 끌어서 서빙':'🔥 굽기 (오븐이 비었어요)';
  var un=!S.bench||S.guide;['um1','clearBtn'].forEach(function(id){$(id).classList.toggle('off',un)});
}
function updateAll(){
  renderBench();renderOven();updateHud();renderShelf();renderBags();renderUpg();
  dishEls.forEach(function(el,i){
    el.classList.toggle('on',!!S.bench&&S.bench.type===i);
    el.classList.toggle('locked',!owned(i));
  });
}

/* ===== 라운드 진행 ===== */
/* ===== 이름·학번 =====
   기숙사(dorms) 모드는 닉네임만, 학교(school) 모드는 이름과 학번을 받는다 */
function profileInit(){
  var n=$('inName'),i=$('inId');
  n.value=playerName;i.value=studentId;
  $('labName').textContent=activeMode==='dorms'?'닉네임':'이름';
  $('idGroup').style.display=activeMode==='school'?'':'none';
  n.placeholder=activeMode==='dorms'?'예: 별빛42':'예: 홍길동';
}
/* 통과하면 이름·학번을 저장하고 true를 준다 */
function profileCommit(){
  var e=$('pErr'),name=sanitize($('inName').value,12);
  if(!name){e.textContent=(activeMode==='dorms'?'닉네임을':'이름을')+' 입력해 주세요.';$('inName').focus();return false}
  if(activeMode==='school'){
    var id=sanitize($('inId').value,10);
    /* 판정은 공유 모듈(1~10자, 한글·영문·숫자·-)에 맡긴다. 다른 게임과 같은 기준이어야
       같은 학생의 기록이 게임마다 어긋나지 않는다. 자릿수를 더 죄려면 여기가 아니라
       shared/halomath-profile.js를 고쳐 다 같이 바꿔야 한다 */
    if(window.HalomathProfile&&!HalomathProfile.isValidStudentId(id)){
      e.textContent='학번을 입력해 주세요. (예: 2230)';$('inId').focus();return false;
    }
    studentId=id;
    if(window.HalomathProfile)HalomathProfile.saveStudentId(activeMode,studentId);
  }
  playerName=name;
  if(window.HalomathProfile)HalomathProfile.saveName(activeMode,playerName);
  e.textContent='';
  return true;
}
profileInit();

/* 전체화면 전환은 사용자가 누른 순간에만 허용된다. 시작 버튼이 그 기회다 */
$('startBtn').onclick=function(){
  if(!profileCommit())return;
  if(wantsFS())fsRequest();
  audioUnlock();
  if(window.HalomathPlayStats&&HalomathPlayStats.recordPlay){
    try{HalomathPlayStats.recordPlay({gameId:GAME_ID,activeMode:activeMode,name:playerName,studentId:studentId})}catch(e){}
  }
  startGame();
};
function startGame(){resetG();startRound(1,true)}
function startRound(r,withGuide){
  G.round=r;newRound(r);drag=null;bagDrag=null;fx=[];fxClear();
  shake.mag=0;shake.until=0;applyStage(0,0);
  S.guide=true;
  var ic=[];DISHES.forEach(function(d,i){if(owned(i))ic.push(d.ico)});
  $('hudTitle').textContent='R'+r+' / '+LAST_ROUND;
  $('riIco').textContent=ic.join(' ');
  $('riTitle').textContent=r+'라운드';
  var msg=r===1?'<b>냥 바게트</b> 주문이 들어와요. 바게트는 반죽 마디가 한 줄로 길게 이어져요. <b>반죽 1개가 원본 바게트</b>예요!<br>빨리 해결할수록 손님이 더 많이 와요!'
    :'오늘도 손님이 몰려와요! 빨리 해결할수록 <b>손님이 더 많이</b> 와요.'+(GIANT_AT[r]?'<br>👑 <b>자이언트</b> 손님이 올 수도 있어요!':'');
  DISHES.forEach(function(d,i){if(d.unlockR===r&&r>1)msg+='<br>🆕 <b>'+d.name+'</b>을 열 수 있어요! 재료 선반의 🔒를 눌러 코인으로 열어요.'});
  $('riDesc').innerHTML=msg;
  slotEls.forEach(function(el){el.dataset.cid='';el.dataset.mode='';el.dataset.f=''});
  if(withGuide&&G.hintOn){$('guide').style.display='flex';$('rintro').style.display='none'}
  else{$('guide').style.display='none';$('rintro').style.display='flex'}
  show('play');last=performance.now();updateAll();requestAnimationFrame(loop);
}
function endGuide(){
  if(!S.guide)return;
  S.guide=false;G.hintOn=false;$('guide').style.display='none';$('rintro').style.display='none';last=performance.now();updateAll();
}
$('guideBtn').onclick=function(){$('guide').style.display='none';$('rintro').style.display='flex'};
$('riBtn').onclick=endGuide;

function update(dt){
  S.time+=dt;
  if(!S.warned&&S.roundT-S.time<=10){S.warned=true;sfx('warn')}
  S.cust.forEach(function(c){
    if(c.state==='wait'){
      c.wait+=dt;
      if(c.wait>=c.pat){c.state='angry';c.until=S.time+0.9;S.streak=0;S.left++;G.leftAll++;sfx('angry');floatAtSlot(c.slot,'떠났어요','bad');toast('💢 손님이 화나서 떠났어요')}
    }else if((c.state==='happy'||c.state==='angry')&&S.time>=c.until){
      var sp=c.state==='happy'?c.speed:0;
      c.state='gone';callNext(sp);c.slot=-1;
    }
  });
  if(freeSeat()>=0){
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
  updateHud();renderBench();renderOven();
  requestAnimationFrame(loop);
}
function row(a,b){return '<tr><td>'+a+'</td><td class="r">'+(b>0?'+':'')+b+'</td></tr>'}
function notebookHTML(){
  var ks={};Object.keys(G.seen).forEach(function(key){ks[key.split(':')[1]]=true});
  var kl=Object.keys(ks).map(Number).sort(function(a,b){return a-b});
  var rows='<tr><th>닮음비</th>'+DISHES.map(function(d){return '<th class="r">'+d.ico+' '+d.name.replace('냥 ','')+'</th>'}).join('')+'</tr>';
  kl.forEach(function(k){
    rows+='<tr><td>1 : '+k+'</td>'+[0,1,2].map(function(t){var v=G.seen[t+':'+k];return '<td class="r">'+(v?v+'개':'?')+'</td>'}).join('')+'</tr>';
  });
  if(!kl.length)rows+='<tr><td colspan="4">아직 서빙한 빵이 없어요</td></tr>';
  return rows;
}
var HINT_TXT='성공한 주문에 쓴 재료 개수예요. 닮음비가 커지면 재료 개수는 어떻게 달라졌나요? 빵마다 비교해 봐요!';
function ledgerRows(o){
  return row('서빙 보상',o.reward)+row('빨리 서빙 보너스',o.patience)+row('콤보 보너스',o.combo)+row('닮은 모양이 아닌 빵 서빙 ('+o.notSimilar+'회)',-o.penalty);
}
function finishRound(){
  S.phase='roundEnd';
  shake.mag=0;shake.until=0;applyStage(0,0);fxClear();
  sfx('roundEnd');
  var net=S.reward+S.patience+S.combo-S.penalty;
  var entry={r:S.round,net:net,reward:S.reward,patience:S.patience,combo:S.combo,penalty:S.penalty,notSimilar:S.wrong.notSimilar,served:S.served,left:S.left};
  G.log.push(entry);G.servedAll+=S.served;
  if(S.round<LAST_ROUND){
    $('reTitle').textContent=(net>=250?'🏆 ':net>=120?'👍 ':'😺 ')+S.round+'라운드 끝!';
    $('reSub').textContent='손님 '+S.served+'명 서빙 · 떠난 손님 '+S.left+'명 · 보유 🪙 '+G.wallet;
    $('reLedger').innerHTML=ledgerRows(entry)+'<tr class="total"><td>이번 라운드 수입</td><td class="r">'+net+'코인</td></tr>';
    $('reNoteHint').textContent=HINT_TXT;$('reNotebook').innerHTML=notebookHTML();
    $('nextBtn').textContent=(S.round+1)+'라운드 ▶';
    show('roundEnd');
  }else finishGame();
}
/* ===== 즉석 업그레이드 (게임 중에 바로 구입) ===== */
function spend(cost,msg){
  if(S.phase!=='play'||S.guide)return false;
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
function buyBag(n){if(G.u.bag[n])return false;if(!spend(BAGCOST[n],n+'개 봉지가 열렸어요!'))return false;G.u.bag[n]=1;updateAll();return true}
$('ovenUp').addEventListener('click',function(){upOven()});
function renderUpg(){
  dishEls.forEach(function(el,i){
    var D=DISHES[i],lk=el.querySelector('.lk'),ub=el.querySelector('.upb'),h;
    if(!owned(i)){
      var can=S.round>=D.unlockR;
      h=can?'🔒<small>🪙 '+D.price+' 열기</small>':'🔒<small>'+D.unlockR+'라운드부터</small>';
      if(lk.innerHTML!==h)lk.innerHTML=h;
      el.classList.toggle('canbuy',can&&G.wallet>=D.price);
      ub.style.display='none';
    }else{
      var lv=LV(i);el.classList.remove('canbuy');ub.style.display='';
      if(lv<3){ub.textContent='⬆ Lv'+(lv+1)+' · 🪙 '+D.up[lv-1];ub.classList.toggle('can',G.wallet>=D.up[lv-1])}
      else{ub.textContent='⭐ Lv3 최고';ub.classList.remove('can')}
    }
  });
  var ov=G.u.oven,ob=$('ovenUp');
  if(ov<3){ob.textContent='⬆ '+OVEN[ov+1].name+' · 🪙 '+OVEN[ov+1].cost+' ('+OVEN[ov+1].desc+')';ob.classList.toggle('can',G.wallet>=OVEN[ov+1].cost);ob.style.display=''}
  else{ob.textContent='⭐ 황금 오븐';ob.classList.remove('can')}
  BAGS.forEach(function(n){
    var el=bagEls[n],bk=el.querySelector('.bk');
    if(!G.u.bag[n]){var h='🔒<small>🪙 '+BAGCOST[n]+'</small>';if(bk.innerHTML!==h)bk.innerHTML=h;el.classList.toggle('canbuy',G.wallet>=BAGCOST[n])}
    else el.classList.remove('canbuy');
  });
}
$('nextBtn').onclick=function(){startRound(G.round+1,false)};

function finishGame(){
  var sum=G.earned+30;
  $('resTitle').textContent=sum>=1200?'🏆 대성공!':sum>=600?'👍 잘했어요!':'😺 수고했어요!';
  $('resSub').textContent='총 벌어들인 코인이 점수예요!';
  var h='<tr><th>라운드</th><th class="r">코인</th></tr>';
  G.log.forEach(function(l){h+='<tr><td>R'+l.r+' · 손님 '+l.served+'명</td><td class="r">'+l.net+'</td></tr>'});
  h+=row('참여 보너스',30)+'<tr class="total"><td>최종 점수</td><td class="r">'+sum+'코인</td></tr>';
  $('ledger').innerHTML=h;
  $('noteHint').textContent=HINT_TXT;$('notebook').innerHTML=notebookHTML();
  var t=[],w=G.wrongAll;
  t.push('🗣️ <b>함께 생각해 봐요</b><br>① 닮음비가 2, 3, 4…로 커질 때 빵마다 재료는 몇 개씩 필요했나요?<br>② 바게트, 토스트, 케이크는 왜 늘어나는 방식이 다를까요?');
  if(w.notSimilar>0)t.push('🙅 원본과 모양이 다른 빵을 서빙한 적이 있어요. 어떻게 하면 원본과 닮은 모양이 될까요?');
  if(G.trashedAll>0)t.push('🗑️ 버린 빵 '+G.trashedAll+'개 (낭비한 재료 '+G.wastedAll+'개).');
  $('insight').innerHTML=t.join('<br>');
  S.phase='result';show('result');
  submitScore(sum);
  fetchRanking();
}

/* ===== 랭킹 =====
   점수는 설계대로 「번 코인의 합 + 참여 30」이다. 높을수록 좋다. */
function submitScore(score){
  var msg=$('rankMsg');
  if(!playerName){msg.textContent='이름이 없어 랭킹에 올리지 않았어요.';return}
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
  var h='<tr><th>순위</th><th>이름</th>'+(activeMode==='school'?'<th>학번</th>':'')+'<th class="r">코인</th></tr>';
  list.forEach(function(e,i){
    var me=window.HalomathScores&&HalomathScores.matchesPlayer(e,playerName,studentId,activeMode);
    h+='<tr'+(me?' class="me"':'')+'><td>'+(i+1)+'</td><td>'+esc(e.name||'')+'</td>'
      +(activeMode==='school'?'<td>'+esc(e.studentId||'')+'</td>':'')
      +'<td class="r">'+Math.round(e.score||0)+'</td></tr>';
  });
  return h;
}
function fetchRanking(){
  var url='https://math-game-halogini-default-rtdb.firebaseio.com/scores'
    +(activeMode==='dorms'?'/dorms':'')+'.json';
  var ctl=new AbortController(),to=setTimeout(function(){ctl.abort()},3500);
  fetch(url,{signal:ctl.signal}).then(function(r){return r.json()}).then(function(data){
    clearTimeout(to);
    var list=[];
    Object.keys(data||{}).forEach(function(k){
      var v=data[k];
      if(!v||typeof v!=='object'||typeof v.score!=='number')return;
      if(window.HalomathScores){
        if(!HalomathScores.matchesGameId(v,GAME_IDS))return;
        /* 학교 랭킹에 기숙사 기록이 섞이지 않게 */
        if(activeMode!=='dorms'&&HalomathScores.isDormsRecord(v))return;
      }else if(String(v.gameId||'')!==GAME_ID)return;
      list.push(v);
    });
    list.sort(function(a,b){return b.score-a.score});
    $('rankTable').innerHTML=rankRows(list.slice(0,20));
  }).catch(function(){
    clearTimeout(to);
    $('rankTable').innerHTML='<tr><td>랭킹을 불러오지 못했어요</td></tr>';
  });
}
$('againBtn').onclick=function(){show('intro')};

/* ===== 화면 맞추기 =====
   기기마다 화면 크기가 제각각이라, 정해진 크기로 만든 화면을 통째로 줄이거나 키워서 맞춘다.
   덕분에 어떤 기기에서도 버튼이 잘려 나가지 않는다.
   DESIGN : 태블릿·PC 기준 크기. 지금 레이아웃이 실제로 요구하는 높이가 약 713px이다.
   COMPACT: 폰 가로처럼 높이가 아주 낮은 화면. .compact CSS로 눌러 담은 뒤의 요구 높이다. */
/* MAX_S: 기준 크기보다 크게는 키우지 않는다. 큰 모니터에서 화면이 부풀지 않게 하려는 것으로,
   three-chances의 .game-container{max-width:1100px;margin:0 auto}와 같은 뜻이다 */
var DESIGN={w:1024,h:740},COMPACT={w:900,h:540},MAX_S=1;
var VIEW={w:1024,h:716,s:1,q:1,compact:false,ox:0,oy:0};
var stage=$('stage');
/* 화면 흔들기가 기준 위치를 덮어쓰지 않도록, 변환은 항상 여기서만 쓴다 */
function applyStage(dx,dy){
  stage.style.transform='translate('+(VIEW.ox+dx)+'px,'+(VIEW.oy+dy)+'px) scale('+VIEW.s+')';
}
function tickShake(now){
  if(now>=shake.until){if(shake.mag){shake.mag=0;applyStage(0,0)}return}
  var k=shake.mag;
  applyStage((Math.random()-0.5)*2*k,(Math.random()-0.5)*2*k);
}
var DBG=(function(){try{return new URLSearchParams(location.search).has('debug')}catch(e){return false}})();

function vpSize(){
  var vv=window.visualViewport;
  return{w:Math.round((vv&&vv.width)||window.innerWidth),h:Math.round((vv&&vv.height)||window.innerHeight)};
}
/* 캔버스는 논리 크기로 그리고, 실제 화소는 기기 해상도 × 화면 배율만큼 잡는다 (글자가 안 흐려진다) */
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
  slotEls.forEach(function(el){hidpi(el.querySelector('canvas'),SLOT_W,SLOT_H,q)});
  dishEls.forEach(function(el){hidpi(el.querySelector('canvas'),100,70,q)});
  /* 배경 캔버스는 CSS 크기가 없으므로 직접 정해 준다 */
  ghost.style.width=(200*VIEW.s)+'px';ghost.style.height=(200*VIEW.s)+'px';
  return true;
}
function invalidate(){
  /* 다시 그리게 캐시를 비운다 */
  dishEls.forEach(function(el){el.dataset.lv=''});
  slotEls.forEach(function(el){el.dataset.cid='';el.dataset.mode='';el.dataset.f=''});
  if(S&&S.oven)updateAll();else renderShelf();
}
function fit(){
  var v=vpSize();
  /* 폰 가로는 높이가 350px 안팎이다. 태블릿(가로 545px 이상)과 같은 배치로는 글씨가 너무 작아진다 */
  var compact=v.h<=480||v.w/v.h>=1.9;
  var D=compact?COMPACT:DESIGN;
  document.documentElement.classList.toggle('compact',compact);
  stage.style.width=D.w+'px';stage.style.height=D.h+'px';
  var s=Math.min(v.w/D.w,v.h/D.h,MAX_S);
  VIEW.w=v.w;VIEW.h=v.h;VIEW.s=s;VIEW.compact=compact;
  VIEW.ox=(v.w-D.w*s)/2;VIEW.oy=(v.h-D.h*s)/2;
  applyStage(0,0);
  if(setupCanvases())invalidate();
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

fit();syncFsBtn();sndSync();

window.__api={chooseDish:chooseDish,addN:addN,toOven:toOven,cookTap:cookTap,setClock:function(f){clock=f},
  serveDish:serveDish,discard:discard,tick:function(d){update(d);updateAll()},endGuide:endGuide,startGame:startGame,startRound:startRound,
  finishRound:finishRound,slotCust:slotCust,judge:judge,needOf:needOf,baseOf:baseOf,spawn:spawn,buyDish:buyDish,upDish:upDish,upOven:upOven,buyBag:buyBag,
  setRnd:function(f){rnd=f},refresh:refresh,newDish:newDish,earn:earn,
  fit:fit,view:function(){return VIEW}};
})();
