const assert = require('node:assert/strict');
const E = require('../dist/engine.js');

function advance(state, seconds) {
  for (let i = 0; i < Math.round(seconds * 100); i++) E.tick(state, .01);
}
const practice = E.make(0, () => .5);
advance(practice, .65);
const first = E.box(practice.targets[0],practice);
assert.equal(E.fire(practice,first.x+first.w/2,first.y+first.h*.1),'head');
assert.equal(practice.cash,330);
assert.equal(practice.ammo,7);
assert.equal(E.fire(practice,first.x,first.y),'blocked');
assert(E.reload(practice));
assert(E.cover(practice));
advance(practice,1.2);
assert.equal(practice.ammo,E.MAG);
assert.equal(E.fire(practice,first.x,first.y),'blocked');
advance(practice,7);
assert.equal(practice.armor,100);
E.cover(practice);
advance(practice,6);
assert(practice.armor<100);
const doomed = E.make(2, () => .5);
advance(doomed,30);
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
    const box=E.box(target,mission);
    E.fire(mission,box.x+box.w*.5,box.y+box.h*.1);
  }
  assert.equal(mission.result,'cleared');
  assert.equal(mission.kills,mission.m.objective);
  assert.equal(mission.kills,mission.precision);
  assert.equal(mission.armor,100);
  assert.equal(mission.won,true);
  assert.equal(E.ranks(mission)[0].name,'GHOST-07');
}
console.log('Combat, scoring, reload, cover, defeat, timer, and all three winning mission paths passed.');
