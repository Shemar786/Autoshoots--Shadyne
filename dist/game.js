"use strict";
const E=globalThis.IronEngine, {W,H,missions,money,clamp}=E;
const $=id=>document.getElementById(id);
const canvas=$('arena'), ctx=canvas.getContext('2d',{alpha:false});
const storageKey='iron-contract-mars-v1';
let records=[];
try{const raw=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(raw))records=raw}catch{}
records=missions.map((_,i)=>({best:Math.max(0,Number(records[i]?.best)||0),cleared:records[i]?.cleared===true,won:records[i]?.won===true}));
let run=null,paused=false,muted=false,time=0,lastHUD=-1,lastRanks='',coverTween=0,hitBuzzAt=-10;
let aim={x:W/2,y:H/2,show:false},lastAnimation=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const img=src=>{const node=new Image();node.src='assets/'+src;return node};
const scenes=missions.map(m=>img(m.scene+'.webp')), soldier=img('soldier.webp'), weapon=img('carbine.webp');
const ready=i=>i.complete&&i.naturalWidth>0;
function save(){try{localStorage.setItem(storageKey,JSON.stringify(records))}catch{}}
function unlocked(i){return i===0||records.slice(0,i).every(r=>r.cleared)}
function nextMission(){const i=records.findIndex(r=>!r.cleared);return i===-1?2:i}
const pad=n=>String(n).padStart(2,'0');
function lobby(){
 $('bank-total').textContent=money(records.reduce((a,r)=>a+r.best,0));
 $('clear-count').textContent=records.filter(r=>r.cleared).length+' / '+missions.length;
 [...$('segments').children].forEach((el,i)=>el.classList.toggle('complete',records[i].cleared));
 const idx=nextMission();
 $('deploy-label').textContent=records.every(r=>r.cleared)?'REPLAY FINAL MISSION':'DEPLOY TO MISSION '+pad(idx+1);
 $('mission-grid').replaceChildren(...missions.map((m,i)=>{
   const b=document.createElement('button'), open=unlocked(i);
   b.className='mission '+(open?'unlocked':'');b.disabled=!open;
   b.style.backgroundImage='url("assets/'+m.scene+'.webp")';
   b.setAttribute('aria-label',open?'Deploy to '+m.name:'Locked: '+m.name+'. Clear the previous mission to unlock.');
   b.innerHTML='<div class="mission-kicker"><span>MISSION '+pad(i+1)+'</span><span class="difficulty">'+m.difficulty+'</span></div><div><div class="mission-title">'+m.name+'</div><small class="mission-location">'+m.location+'</small><div class="mission-foot"><span>'+(!open?'▧ LOCKED':records[i].won?'✦ MISSION WON':records[i].cleared?'✓ CLEARED':'▸ AVAILABLE')+'</span><b>'+money(m.bonus)+' BONUS</b></div></div>';
   b.addEventListener('click',()=>start(i));return b;
 }));
}
function updateRecordList(){
 $('record-list').innerHTML=missions.map((m,i)=>'<div class="record-row"><div><strong>'+pad(i+1)+' · '+m.name+'</strong><small>'+(records[i].won?'WON':records[i].cleared?'CLEARED':unlocked(i)?'AVAILABLE':'LOCKED')+'</small></div><b>'+money(records[i].best)+'</b></div>').join('');
}
function hq(){
 if(run&&!run.result){
   const i=run.i;
   pause(true);
   overlay('FIELD OPERATIONS','Return to HQ?','The current sortie will end. Your saved records will stay on this device.',[
     action('RESUME',()=>pause(false),true),action('RESTART',()=>start(i)),action('RETURN TO HQ',showHQ)]);
 }else showHQ();
}
function showHQ(){
 run=null;paused=false;$('game').hidden=true;$('lobby').hidden=false;$('arena-overlay').hidden=true;
 lobby();window.scrollTo(0,0);
}
function start(i){
 if(!unlocked(i))return;
 run=E.make(i);paused=false;coverTween=0;lastHUD=-1;lastRanks='';hitBuzzAt=-10;
 $('lobby').hidden=true;$('game').hidden=false;$('arena-overlay').hidden=true;
 $('pause').disabled=false;$('pause').textContent='Ⅱ PAUSE';
 $('game-id').textContent='MISSION / '+pad(i+1)+' · MARS';
 $('game-name').textContent=run.m.name;
 $('brief-text').textContent=run.m.brief;
 $('base-pay').textContent=money(run.m.base);
 $('clear-pay').textContent=money(run.m.bonus);
 time=performance.now();aim.show=false;updateHUD();paint();
 window.scrollTo(0,0);canvas.focus({preventScroll:true});audioInit();
}
function updateHUD(){
 if(!run)return;
 const s=run,t=Math.max(0,Math.ceil(s.m.time-s.clock));
 $('hud-time').textContent=Math.floor(t/60)+':'+pad(t%60);
 $('hud-time').style.color=t<11?'#ffa385':'';
 $('hud-target').textContent=s.kills+' / '+s.m.objective;
 $('hud-cash').textContent=money(s.cash);
 $('hud-hp').textContent=s.armor;
 $('hp-bar').style.width=s.armor+'%';
 $('hp-bar').style.background=s.armor>35?'':'#e87b65';
 $('hud-ammo').textContent=s.reloadEnd?'··':pad(s.ammo);
 $('ammo-label').textContent=s.reloadEnd?'RELOADING':'CARBINE';
 $('toast').textContent=s.clock<s.noticeUntil?s.notice:'';
 $('cover').classList.toggle('active',s.cover);
 $('cover').setAttribute('aria-pressed',String(s.cover));
 const ranking=E.ranks(s);
 const key=ranking.map(r=>r.name+r.cash).join(':');
 if(key!==lastRanks){
   lastRanks=key;
   $('live-ranks').innerHTML=ranking.map((r,i)=>'<div class="rank-row '+(r.you?'is-you':'')+'"><span class="place">'+pad(i+1)+'</span><span>'+r.name+(r.you?' <small>(YOU)</small>':'')+'</span><span class="value">'+money(r.cash)+'</span></div>').join('');
 }
}
function action(label,fn,primary=false){return {label,fn,primary}}
function overlay(kicker,title,body,actions,extras=''){
 const target=$('arena-overlay');target.hidden=false;
 target.innerHTML='<div class="result-box"><div class="eyebrow">'+kicker+'</div><h2>'+title+'</h2>'+extras+'<p>'+body+'</p><div class="result-actions"></div></div>';
 const buttons=target.querySelector('.result-actions');
 actions.forEach(a=>{const button=document.createElement('button');button.className='action '+(a.primary?'primary':'secondary');button.textContent=a.label;button.onclick=a.fn;buttons.append(button)});
 buttons.firstElementChild?.focus({preventScroll:true});
}
function pause(on=!paused){
 if(!run||run.result)return;
 paused=on;time=performance.now();
 $('pause').textContent=on?'▶ RESUME':'Ⅱ PAUSE';
 $('arena-overlay').hidden=!on;
 if(on)overlay('TACTICAL HOLD','Paused','Your mission clock is on hold.',[action('RESUME MISSION',()=>pause(false),true),action('RETURN TO HQ',hq)]);
 else canvas.focus({preventScroll:true});
}
function end(){
 const s=run,r=records[s.i];r.best=Math.max(s.cash,r.best);r.cleared=r.cleared||s.clean;r.won=r.won||s.won;save();updateHUD();$('pause').disabled=true;
 const winner=E.ranks(s)[0], reason=s.won?'You earned the highest payout.':s.clean?winner.name+' finished first with '+money(winner.cash)+'.':s.result==='down'?'Your armor failed before you cleared the objective.':'The contract timer expired before you cleared the objective.';
 const actions=[];
 if(s.clean&&s.i<missions.length-1)actions.push(action('NEXT MISSION →',()=>start(s.i+1),true));
 actions.push(action('RETRY MISSION',()=>start(s.i),!actions.length),action('RETURN TO HQ',showHQ));
 const stats='<strong class="result-pay">'+money(s.cash)+'</strong><div class="result-detail"><span>'+s.kills+' / '+s.m.objective+' ELIMINATIONS</span><span>'+s.precision+' PRECISION</span><span>'+Math.round(100*s.hits/(s.shots||1))+'% ACCURACY</span></div>';
 overlay('MISSION REPORT · '+pad(s.i+1),s.won?'Contract won':s.clean?'Mission cleared':'Mission failed',reason,actions,stats);
 beep(s.won?660:s.clean?480:160,.28,'triangle',.13);
}
function position(e){
 const r=canvas.getBoundingClientRect();return {x:clamp((e.clientX-r.left)*W/r.width,0,W),y:clamp((e.clientY-r.top)*H/r.height,0,H),show:true};
}
canvas.addEventListener('pointermove',e=>aim=position(e));
canvas.addEventListener('pointerleave',()=>{aim.show=false});
function shoot(){
 if(!run||paused||run.result)return;
 audioInit();
 const result=E.fire(run,aim.x,aim.y);
 if(result==='empty')beep(165,.055,'square',.09);
 if(['head','body','miss'].includes(result))shotSound();
 if(result==='head')beep(980,.07,'triangle',.12);else if(result==='body')beep(520,.07,'triangle',.08);
 if(run.result)end();else updateHUD();
}
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0||!run||paused||run.result)return;
 e.preventDefault();canvas.focus({preventScroll:true});aim=position(e);shoot();
});
function doReload(){if(run&&!run.result&&!paused&&E.reload(run)){beep(245,.09,'triangle',.105);updateHUD()}}
function doCover(){if(run&&!run.result&&!paused){E.cover(run);beep(85,.08,'triangle',.08);updateHUD()}}
window.addEventListener('keydown',e=>{
 if(!run||$('records').open||run.result)return;
 const key=e.key.toLowerCase();
 if(key==='escape'){e.preventDefault();pause();return}
 if(paused||e.repeat&&(key==='c'||key==='r'))return;
 if(key==='r'){e.preventDefault();doReload()}
 else if(key==='c'){e.preventDefault();doCover()}
 else if(document.activeElement===canvas){
   if(key.startsWith('arrow')){
     e.preventDefault();aim.show=true;
     if(key==='arrowleft')aim.x=clamp(aim.x-16,0,W);if(key==='arrowright')aim.x=clamp(aim.x+16,0,W);
     if(key==='arrowup')aim.y=clamp(aim.y-16,0,H);if(key==='arrowdown')aim.y=clamp(aim.y+16,0,H);
   }else if(key===' '||key==='enter'){e.preventDefault();aim.show=true;shoot()}
 }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&run&&!run.result)pause(true)});
$('deploy').onclick=()=>start(nextMission());
$('back').onclick=hq;$('nav-ops').onclick=hq;$('home').onclick=e=>{e.preventDefault();hq()};
$('pause').onclick=()=>pause();$('reload').onclick=doReload;$('cover').onclick=doCover;
$('nav-rank').onclick=()=>{if(run&&!run.result&&!paused)pause(true);updateRecordList();$('records').showModal()};
$('close-records').onclick=()=>$('records').close();
let audio;
function audioInit(){if(muted)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{})}catch{}}
function beep(freq,dur,wave,volume){
 if(!audio||muted||audio.state!=='running')return;
 const t=audio.currentTime,osc=audio.createOscillator(),g=audio.createGain();
 osc.type=wave;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(freq*.62,t+dur);
 g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);osc.connect(g);g.connect(audio.destination);osc.start(t);osc.stop(t+dur);
}
function shotSound(){
 if(!audio||muted||audio.state!=='running')return;
 const t=audio.currentTime,buf=audio.createBuffer(1,Math.floor(audio.sampleRate*.17),audio.sampleRate),data=buf.getChannelData(0);
 for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(data.length*.13));
 const source=audio.createBufferSource(),g=audio.createGain(),f=audio.createBiquadFilter();
 source.buffer=buf;f.type='lowpass';f.frequency.value=1700;g.gain.value=.55;source.connect(f);f.connect(g);g.connect(audio.destination);source.start(t);
 beep(120,.09,'triangle',.14);
}
function soundIcon(){
 $('sound').innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/>'+(muted?'<path d="m17 9 5 6m0-6-5 6"/>':'<path d="M16 9a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10"/>')+'</svg>';
 $('sound').setAttribute('aria-label',muted?'Unmute sound':'Mute sound');
 $('sound').setAttribute('title',muted?'Unmute sound':'Mute sound');
}
$('sound').onclick=()=>{muted=!muted;if(!muted)audioInit();soundIcon()};
function line(x,y,x2,y2,col,weight=1){ctx.strokeStyle=col;ctx.lineWidth=weight;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke()}
function oval(x,y,rx,ry,c){ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()}
function drawFallback(b){
 const x=b.x+b.w/2,y=b.y,w=b.w,h=b.h;
 oval(x,y+h*.1,w*.212,h*.10,'#355a7d');oval(x,y+h*.102,w*.16,h*.053,'#1d2836');
 ctx.fillStyle='#345f89';ctx.fillRect(x-w*.34,y+h*.19,w*.68,h*.43);ctx.fillRect(x-w*.33,y+h*.61,w*.26,h*.36);ctx.fillRect(x+w*.07,y+h*.61,w*.26,h*.36);
 ctx.fillStyle='#202e3f';ctx.fillRect(x-w*.14,y+h*.31,w*.34,h*.12);
}
function flash(x,y,r,opacity=1){
 if(r<=0)return;
 const f=ctx.createRadialGradient(x,y,0,x,y,r);f.addColorStop(0,'rgba(255,255,217,'+opacity+')');f.addColorStop(.24,'rgba(255,200,105,'+(opacity*.76)+')');f.addColorStop(1,'rgba(240,118,42,0)');
 ctx.fillStyle=f;ctx.fillRect(x-r,y-r,r*2,r*2);
}
function drawTarget(t,s){
 const b=E.box(t,s),die=t.dead?clamp((s.clock-t.fallAt)/.46,0,1):0,warn=!t.dead&&t.fire-(s.clock-t.born)<.46;
 oval(b.x+b.w*.5,b.y+b.h,b.w*.55,10,'rgba(28,15,10,.36)');
 ctx.save();ctx.globalAlpha=1-die;ctx.translate(b.x+b.w/2,b.y+b.h);ctx.rotate(die*t.dir*.85);
 const at={x:-b.w/2,y:-b.h+die*50,w:b.w,h:b.h};
 if(ready(soldier)){ctx.drawImage(soldier,at.x,at.y,at.w,at.h)}else{drawFallback(at)}
 ctx.restore();
 if(!t.dead&&s.clock-t.born>.14){
   const x=b.x+b.w*.5,y=b.y-8;
   ctx.strokeStyle=warn?'#ffb35d':'#e27f66b4';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-5,y-3);ctx.lineTo(x,y+2);ctx.lineTo(x+5,y-3);ctx.stroke();
   if(warn)flash(x,b.y+b.h*.23,10,.5);
 }
}
function drawWeapon(s,kick){
 if(coverTween>.96)return;
 const x=aim.show?(aim.x-W/2)*.17:0,y=aim.show?(aim.y-H/2)*.115:0, reloadPhase=s.reloadEnd?Math.sin(Math.PI*clamp((s.reloadEnd-s.clock)/1.17,0,1))*105:0;
 ctx.save();ctx.translate(x,y+kick+coverTween*270+reloadPhase);
 if(ready(weapon)){
   const w=547,h=w*weapon.naturalHeight/weapon.naturalWidth;
   ctx.drawImage(weapon,W*.46,H-h*.79,w,h);
 }else{
   ctx.strokeStyle='#10171d';ctx.lineWidth=66;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(814,665);ctx.lineTo(665,510);ctx.stroke();
   ctx.strokeStyle='#3b4850';ctx.lineWidth=29;ctx.beginPath();ctx.moveTo(794,650);ctx.lineTo(648,502);ctx.stroke();
 }
 if(s.clock-s.shotAt<.10&&!reduced){flash(W*.565,H*.745,83,1-(s.clock-s.shotAt)*8);line(W*.565,H*.745,aim.x,aim.y,'#ffdc9770',2)}
 ctx.restore();
}
function paint(){
 if(!run)return;
 const s=run,t=s.clock,kick=reduced?0:Math.max(0,1-(t-s.shotAt)/.16)*17;
 ctx.fillStyle='#643f36';ctx.fillRect(0,0,W,H);
 const bg=scenes[s.i];
 if(ready(bg))ctx.drawImage(bg,0,0,W,H);
 else {const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#392b36');g.addColorStop(.56,'#8d5140');g.addColorStop(1,'#47271c');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
 const dust=ctx.createLinearGradient(0,H*.2,W,H);dust.addColorStop(0,'#ffac7020');dust.addColorStop(.7,'#5f29191a');dust.addColorStop(1,'#29181121');ctx.fillStyle=dust;ctx.fillRect(0,0,W,H);
 for(const target of [...s.targets].sort((a,b)=>a.base-b.base))drawTarget(target,s);
 if(!reduced)for(let i=0;i<(s.i===2?43:24);i++){
   const x=((i*173+t*(18+i%6*9))%W),y=(i*91+t*(1+i%4))%H;
   line(x,y,x+3+s.i*4,y+1,'rgba(255,180,121,'+(.10+(i%4)*.04)+')',1);
 }
 for(const fx of s.effects){
   const age=t-fx.at,alpha=clamp(1-age/.32,0,1);
   if(fx.kind==='enemy'&&!reduced){flash(fx.x,fx.y,40,alpha);if(age<.062)line(fx.x,fx.y,W/2,H*.92,'#ffce7c9c',2)}
   else if(fx.kind==='hit'){
     for(const [dx,dy] of [[1,1],[1,-1],[-1,1],[-1,-1]])line(fx.x+dx*7,fx.y+dy*7,fx.x+dx*15,fx.y+dy*15,'rgba(255,218,138,'+alpha+')',2);
   }else if(fx.kind==='miss'){oval(fx.x,fx.y,Math.max(1,age*18),Math.max(1,age*9),'rgba(230,199,166,'+alpha*.4+')')}
 }
 drawWeapon(s,kick);
 if(coverTween>.01){
   const y=H-coverTween*240;
   const c=ctx.createLinearGradient(0,y,0,H);c.addColorStop(0,'#383b44');c.addColorStop(.08,'#202732');c.addColorStop(1,'#101820');
   ctx.fillStyle=c;ctx.fillRect(0,y,W,H-y);line(0,y,W,y,'#667583',5);line(0,y+14,W,y+14,'#131a22',3);
   for(let i=0;i<36;i++){let x=(i*143)%W,yy=y+26+(i*193)%210;line(x,yy,x+7+i%20,yy-4,'#798a9428',1)}
   ctx.fillStyle='#e7ba58';ctx.textAlign='center';ctx.font='700 15px monospace';if(coverTween>.7)ctx.fillText('IN COVER  /  C TO PEEK',W/2,y+42);
 }
 const v=ctx.createRadialGradient(W*.5,H*.48,H*.32,W*.5,H*.5,W*.63);
 const hurt=clamp(1-(t-s.damageAt)/.32,0,1);
 v.addColorStop(0,'transparent');v.addColorStop(1,hurt&&!reduced?'rgba(189,48,27,'+(.25+hurt*.55)+')':'#0b1016bd');
 ctx.fillStyle=v;ctx.fillRect(0,0,W,H);
 if(!s.cover&&!paused&&!s.result){
   const x=aim.show?aim.x:W/2,y=aim.show?aim.y:H/2,c='#fff0cbe1';
   ctx.shadowColor='#121518';ctx.shadowBlur=4;
   line(x-15,y,x-5,y,c,1.5);line(x+5,y,x+15,y,c,1.5);line(x,y-15,x,y-5,c,1.5);line(x,y+5,x,y+15,c,1.5);oval(x,y,1.4,1.4,c);ctx.shadowBlur=0;
 }
}
function frame(now,fromAnimation=true){
 if(fromAnimation){lastAnimation=now;requestAnimationFrame(frame)}
 if(run&&!paused&&!run.result){
   const dt=clamp((now-time)/1000||0,0,.12);
   E.tick(run,dt);coverTween+=((run.cover?1:0)-coverTween)*Math.min(1,dt*17);
   if(run.damageAt!==hitBuzzAt&&run.damageAt>=0){hitBuzzAt=run.damageAt;beep(95,.12,'sine',.18)}
   if(run.result){paint();end()}
   else{paint();if(now-lastHUD>95){lastHUD=now;updateHUD()}}
 }
 time=Math.max(time,now);
}
lobby();soundIcon();requestAnimationFrame(frame);
setInterval(()=>{const now=performance.now();if(run&&!paused&&!run.result&&!document.hidden&&now-lastAnimation>150)frame(now,false)},100);
