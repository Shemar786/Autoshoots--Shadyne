const assert = require('node:assert/strict');
const E = require('../dist/engine.js');

function advance(state, seconds) {
  for (let i = 0; i < Math.round(seconds * 100); i++) E.tick(state, .01);
}
function shoot(state,target,part='head'){
  const b=E.box(target,state);
  return E.fire(state,b.x+b.w*.49,b.y+b.h*(part==='head'?.083:.4));
}
const practice = E.make(0, () => .5);
advance(practice, .65);
const target=practice.targets[0],before=E.box(target,practice);
assert.equal(shoot(practice,target,'body'),'wound');
assert.equal(target.hp,57);
assert.equal(target.dead,false);
assert.equal(practice.kills,0);
assert.equal(practice.cash,0);
assert.equal(practice.effects.at(-1).kind,'hit');
assert.equal(shoot(practice,target),'blocked');
advance(practice,.35);
assert.notEqual(E.box(target,practice).x,before.x);
assert.equal(shoot(practice,target),'head');
assert.equal(practice.effects.at(-1).kind,'eliminate');
assert.equal(practice.cash,330);
assert.equal(practice.ammo,18);
assert(E.reload(practice));
assert(E.cover(practice));
advance(practice,1.5);
assert.equal(practice.ammo,E.MAG);
assert.equal(shoot(practice,target),'blocked');
advance(practice,7);
assert.equal(practice.armor,100);
E.cover(practice);
advance(practice,6);
assert(practice.armor<100);
const doomed = E.make(2, () => .5);
advance(doomed,40);
assert.equal(doomed.result,'down');
assert.equal(doomed.armor,0);
const expired = E.make(0, () => .5);
E.cover(expired);
advance(expired,60);
assert.equal(expired.result,'expired');
assert.equal(expired.cash,0);

for (let i=0;i<E.missions.length;i++){
  const mission=E.make(i,()=>.5);
  while(!mission.result){
    advance(mission,.05);
    const target=mission.targets.find(t=>!t.dead&&mission.clock-t.born>.22);
    if(!mission.ammo){ E.reload(mission);continue }
    if(!target||mission.reloadEnd)continue;
    shoot(mission,target);
  }
  assert.equal(mission.result,'cleared');
  assert.equal(mission.kills,mission.m.objective);
  assert.equal(mission.hits,mission.kills*2);
  assert.equal(mission.kills*2,mission.precision);
  assert.equal(mission.armor,100);
  assert.equal(mission.won,true);
  assert.equal(E.ranks(mission)[0].name,'GHOST-07');
}
console.log('Impact and survival, walking after damage, armor, scoring, reload, cover, defeat, timer, and all three winning paths passed.');
