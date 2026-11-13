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
const keys=new Set();
let trigger=false,aimToggle=false,rightAim=false,shiftAim=false;
let camera={x:0,y:0,z:1.18,ads:0,walk:0};
const aiming=()=>aimToggle||rightAim||shiftAim;
function releaseInputs(){keys.clear();trigger=false;rightAim=false;shiftAim=false}
function syncSights(){
 const b=$('sights');b.classList.toggle('active',aiming());b.setAttribute('aria-pressed',String(aiming()));
}
function worldPoint(x,y){
 return {x:(x-W/2-camera.x)/camera.z+W/2,y:(y-H/2-camera.y)/camera.z+H/2};
}
function screenPoint(x,y){
 return {x:(x-W/2)*camera.z+W/2+camera.x,y:(y-H/2)*camera.z+H/2+camera.y};
}
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
 run=null;paused=false;releaseInputs();$('game').hidden=true;$('lobby').hidden=false;$('arena-overlay').hidden=true;
 lobby();window.scrollTo(0,0);
}
function start(i){
 if(!unlocked(i))return;
 run=E.make(i);paused=false;coverTween=0;lastHUD=-1;lastRanks='';hitBuzzAt=-10;
 releaseInputs();aimToggle=false;camera={x:0,y:0,z:1.18,ads:0,walk:0};aim={x:W/2,y:H/2,show:false};syncSights();
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
 paused=on;time=performance.now();if(on){releaseInputs();syncSights()}
 $('pause').textContent=on?'▶ RESUME':'Ⅱ PAUSE';
 $('arena-overlay').hidden=!on;
 if(on)overlay('TACTICAL HOLD','Paused','Your mission clock is on hold.',[action('RESUME MISSION',()=>pause(false),true),action('RETURN TO HQ',hq)]);
 else canvas.focus({preventScroll:true});
}
function end(){
 releaseInputs();
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
 const point=worldPoint(aim.x,aim.y);
 const result=E.fire(run,point.x,point.y);
 if(result==='empty')beep(165,.055,'square',.09);
 if(['head','body','leg','wound','miss'].includes(result))shotSound();
 if(result==='head')beep(980,.07,'triangle',.12);else if(result==='body'||result==='leg')beep(660,.07,'triangle',.09);else if(result==='wound')beep(445,.035,'triangle',.06);
 if(run.result)end();else updateHUD();
}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
 if(!run||paused||run.result)return;
 if(e.button===2){e.preventDefault();rightAim=true;aim=position(e);syncSights();return}
 if(e.button!==0)return;
 e.preventDefault();canvas.focus({preventScroll:true});aim=position(e);trigger=true;shoot();
 if(e.pointerType!=='mouse')canvas.setPointerCapture(e.pointerId);
});
function pointerUp(e){
 if(e.button===2)rightAim=false;else if(e.button===0||e.type==='pointercancel')trigger=false;
 syncSights();
}
window.addEventListener('pointerup',pointerUp);
window.addEventListener('pointercancel',pointerUp);
window.addEventListener('blur',()=>{releaseInputs();syncSights()});
function doReload(){if(run&&!run.result&&!paused&&E.reload(run)){beep(245,.09,'triangle',.105);updateHUD()}}
function doCover(){if(run&&!run.result&&!paused){E.cover(run);beep(85,.08,'triangle',.08);updateHUD()}}
window.addEventListener('keydown',e=>{
 if(!run||$('records').open||run.result)return;
 const key=e.key.toLowerCase();
 if(key==='escape'){e.preventDefault();if(!document.fullscreenElement)pause();return}
 if(paused||e.metaKey||e.ctrlKey||e.altKey)return;
 if(key==='shift'){shiftAim=true;syncSights()}
 if('wasd'.includes(key)&&key.length===1){keys.add(key);e.preventDefault();return}
 if(key==='r'&&!e.repeat){e.preventDefault();doReload()}
 else if(key==='c'&&!e.repeat){e.preventDefault();doCover()}
 else if(document.activeElement===canvas){
   if(key.startsWith('arrow')){
     e.preventDefault();aim.show=true;
     const step=aiming()?9:16;
     if(key==='arrowleft')aim.x=clamp(aim.x-step,0,W);if(key==='arrowright')aim.x=clamp(aim.x+step,0,W);
     if(key==='arrowup')aim.y=clamp(aim.y-step,0,H);if(key==='arrowdown')aim.y=clamp(aim.y+step,0,H);
   }else if(key===' '||key==='enter'){
     e.preventDefault();aim.show=true;
     if(!e.repeat){trigger=true;shoot()}
   }
 }
});
window.addEventListener('keyup',e=>{
 const key=e.key.toLowerCase();keys.delete(key);
 if(key==='shift'){shiftAim=false;syncSights()}
 if(key===' '||key==='enter')trigger=false;
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&run&&!run.result)pause(true)});
$('deploy').onclick=()=>start(nextMission());
$('back').onclick=hq;$('nav-ops').onclick=hq;$('home').onclick=e=>{e.preventDefault();hq()};
$('pause').onclick=()=>pause();$('reload').onclick=doReload;$('cover').onclick=doCover;
$('sights').onclick=()=>{if(run&&!run.result&&!paused){aimToggle=!aimToggle;syncSights();canvas.focus({preventScroll:true})}};
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
function soldierPose(at,t,s){
 const {x,y,w,h}=at, {naturalWidth:sw,naturalHeight:sh}=soldier;
 if(reduced||t.dead){ctx.drawImage(soldier,x,y,w,h);return}
 const phase=(s.clock-t.born)*8.6+t.id*2,step=Math.sin(phase);
 const hips=.59,split=.505;
 for(const sign of [-1,1]){
   const left=sign===-1;
   ctx.save();
   ctx.translate(x+w*(left?.35:.66),y+h*hips);
   ctx.rotate(step*sign*.105);
   ctx.scale(1,1- Math.max(0,step*sign)*.048);
   const sx=left?0:split, fw=left?split:1-split;
   ctx.drawImage(soldier,sw*sx,sh*hips,sw*fw,sh*(1-hips),w*(sx-(left?.35:.66)),0,w*fw,h*(1-hips));
   ctx.restore();
 }
 ctx.drawImage(soldier,0,0,sw,sh*.64,x,y,w,h*.64);
}
function drawTarget(t,s){
 const b=E.box(t,s),die=t.dead?clamp((s.clock-t.fallAt)/.46,0,1):0,warn=!t.dead&&t.fire-(s.clock-t.born)<.46;
 const hurt=clamp(1-(s.clock-t.hitAt)/.28,0,1);
 const age=s.clock-t.born;
 oval(b.x+b.w*.50,b.y+b.h,b.w*.58,7,'rgba(28,15,10,.4)');
 ctx.save();ctx.globalAlpha=1-die;
 ctx.translate(b.x+b.w/2,b.y+b.h);
 ctx.rotate((reduced?0:hurt*t.hitDir*.115+Math.sin(age*8.6)*.018)+die*t.dir*1.25);
 const at={x:-b.w/2,y:-b.h+die*55,w:b.w,h:b.h};
 if(t.variant===1)ctx.scale(-1,1);
 if(ready(soldier)){
   if(t.variant===2)ctx.filter='brightness(.86) saturate(.91)';
   soldierPose(at,t,s);
 }else{drawFallback(at)}
 ctx.restore();
 if(!t.dead&&age>.14){
   const x=b.x+b.w*.5,y=b.y-8;
   ctx.strokeStyle=warn?'#ffd68a':'#e27f66b4';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-5,y-3);ctx.lineTo(x,y+2);ctx.lineTo(x+5,y-3);ctx.stroke();
   if(t.hp<100&&s.clock-t.hitAt<1.4){
     ctx.fillStyle='#14161bd9';ctx.fillRect(x-15,y-10,30,4);
     ctx.fillStyle=t.hp>43?'#f6bf63':'#eb815f';ctx.fillRect(x-15,y-10,30*t.hp/100,4);
   }
   if(warn)flash(x,b.y+b.h*.196,11,.56);
 }
}
function drawWeapon(s,kick){
 if(coverTween>.96)return;
 const ads=camera.ads;
 const x=(aim.show?(aim.x-W/2)*(.14+ads*.68):0)+Math.sin(camera.walk)*3.4*(1-ads);
 const y=(aim.show?(aim.y-H/2)*(.095+ads*.58):0)+(reduced?0:Math.abs(Math.sin(camera.walk))*4);
 const reloadPhase=s.reloadEnd?Math.sin(Math.PI*clamp((s.reloadEnd-s.clock)/1.42,0,1))*115:0;
 ctx.save();ctx.translate(x,y+kick+coverTween*270+reloadPhase);
 let wx=W*.53-ads*166, wy=H*.53-ads*40, ww=528+ads*105;
 if(ready(weapon)){
   const h=ww*weapon.naturalHeight/weapon.naturalWidth;
   ctx.drawImage(weapon,wx,wy,ww,h);
 }else{
   ctx.strokeStyle='#10171d';ctx.lineWidth=66;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(814,665);ctx.lineTo(665,510);ctx.stroke();
   ctx.strokeStyle='#3b4850';ctx.lineWidth=29;ctx.beginPath();ctx.moveTo(794,650);ctx.lineTo(648,502);ctx.stroke();
 }
 if(s.clock-s.shotAt<.09&&!reduced){
   const mx=wx+ww*.22,my=wy+ww*.077;
   const shot=screenPoint(s.shotX,s.shotY);
   flash(mx,my,73,clamp(1-(s.clock-s.shotAt)*9,0,1));
   line(mx,my,shot.x-x,shot.y-y-kick-coverTween*270-reloadPhase,'#ffdc9770',1.8);
 }
 ctx.restore();
}
function impact(fx,age,s){
 const alpha=clamp(1-age/.39,0,1);
 if(fx.kind==='enemy'){
   if(!reduced){flash(fx.x,fx.y,39,alpha);if(age<.06)line(fx.x,fx.y,W/2,H*.92,'#ffce7c99',1.6)}
   return;
 }
 if(fx.kind==='miss'){
   oval(fx.x,fx.y,Math.max(1,age*35),Math.max(1,age*15),'rgba(230,171,125,'+alpha*.45+')');return;
 }
 const kill=fx.kind==='eliminate',helmet=fx.kind==='helmet';
 if(!reduced){
   flash(fx.x,fx.y,kill?27:19,alpha*.91);
   for(let i=0;i<(kill?11:7);i++){
     const a=i*2.397+s.i*.22, speed=24+(i%5)*36;
     const x=fx.x+Math.cos(a)*speed*age, y=fx.y+Math.sin(a)*speed*age+95*age*age;
     const c=i%3===0?'rgba(255,253,222,'+alpha+')':'rgba(255,180,92,'+alpha+')';
     line(x,y,x-Math.cos(a)*6*alpha,y-Math.sin(a)*6*alpha,c,1+(i%2));
   }
   oval(fx.x+fx.dir*age*28,fx.y-age*18,3+age*16,3+age*10,'rgba(206,198,186,'+alpha*.27+')');
 }
 const col=kill?'rgba(255,130,104,'+alpha+')':helmet?'rgba(255,223,148,'+alpha+')':'rgba(255,248,235,'+alpha+')';
 for(const [dx,dy] of [[1,1],[1,-1],[-1,1],[-1,-1]])line(fx.x+dx*7,fx.y+dy*7,fx.x+dx*15,fx.y+dy*15,col,2);
}
function paint(){
 if(!run)return;
 const s=run,t=s.clock,kick=reduced?0:Math.max(0,1-(t-s.shotAt)/.16)*17;
 ctx.fillStyle='#643f36';ctx.fillRect(0,0,W,H);
 ctx.save();ctx.translate(W/2+camera.x,H/2+camera.y);ctx.scale(camera.z,camera.z);ctx.translate(-W/2,-H/2);
 const bg=scenes[s.i];
 if(ready(bg))ctx.drawImage(bg,0,0,W,H);
 else {const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#392b36');g.addColorStop(.56,'#8d5140');g.addColorStop(1,'#47271c');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
 const dust=ctx.createLinearGradient(0,H*.2,W,H);dust.addColorStop(0,'#ffac7020');dust.addColorStop(.7,'#5f29191a');dust.addColorStop(1,'#29181121');ctx.fillStyle=dust;ctx.fillRect(0,0,W,H);
 for(const target of [...s.targets].sort((a,b)=>a.base-b.base))drawTarget(target,s);
 if(!reduced)for(let i=0;i<(s.i===2?43:24);i++){
   const x=((i*173+t*(18+i%6*9))%W),y=(i*91+t*(1+i%4))%H;
   line(x,y,x+3+s.i*4,y+1,'rgba(255,180,121,'+(.10+(i%4)*.04)+')',1);
 }
 for(const fx of s.effects)impact(fx,t-fx.at,s);
 ctx.restore();
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
   const gap=aiming()?3:6,len=aiming()?10:16;
   line(x-len,y,x-gap,y,c,1.5);line(x+gap,y,x+len,y,c,1.5);
   line(x,y-len,x,y-gap,c,1.5);line(x,y+gap,x,y+len,c,1.5);oval(x,y,1.4,1.4,c);ctx.shadowBlur=0;
 }
}
function moveCamera(s,dt){
 const dx=Number(keys.has('a'))-Number(keys.has('d')),dy=Number(keys.has('w'))-Number(keys.has('s'));
 const move=(!s.cover&&(dx||dy))?1:0;
 const ads=(!s.cover&&aiming())?1:0;
 const speed=ads?.49:1;
 camera.x=clamp(camera.x+dx*dt*151*speed*(s.cover?0:1),-92,92);
 camera.y=clamp(camera.y+dy*dt*34*speed*(s.cover?0:1),-19,23);
 camera.ads+=(ads-camera.ads)*Math.min(1,dt*13);
 camera.z=1.18+camera.ads*.20+(camera.y+19)*.0035;
 camera.walk+=dt*(move?14:2.2);s.evasive=move*speed;
}
function frame(now,fromAnimation=true){
 if(fromAnimation){lastAnimation=now;requestAnimationFrame(frame)}
 if(run&&!paused&&!run.result){
   const dt=clamp((now-time)/1000||0,0,.12);
   moveCamera(run,dt);E.tick(run,dt);coverTween+=((run.cover?1:0)-coverTween)*Math.min(1,dt*17);
   if(run.damageAt!==hitBuzzAt&&run.damageAt>=0){hitBuzzAt=run.damageAt;beep(95,.12,'sine',.18)}
   if(run.result){paint();end()}
   else{if(trigger&&run.clock>=run.cool&&!run.cover&&!run.reloadEnd){if(run.ammo)shoot();else{doReload();trigger=false}}paint();if(now-lastHUD>95){lastHUD=now;updateHUD()}}
 }
 time=Math.max(time,now);
}
lobby();soundIcon();requestAnimationFrame(frame);
setInterval(()=>{const now=performance.now();if(run&&!paused&&!run.result&&!document.hidden&&now-lastAnimation>150)frame(now,false)},100);
