// Frame-loop regression: boss spawns must not invalidate stomp snapshots.
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict"),path=require("node:path");
const elements=new Map();
function element(id) {
  if(!elements.has(id)) elements.set(id,{value:"",checked:false,open:false,disabled:false,
    append(){},replaceChildren(){},addEventListener(){},setAttribute(){},focus(){}});
  return elements.get(id);
}
const arcs=[];
const context=new Proxy({arc(...args){arcs.push(args);}}, {
  get(target,key){return target[key]??(()=>({addColorStop(){}}));},
  set(target,key,value){target[key]=value;return true;}
});
Object.assign(element("#game"),{width:800,height:480,getContext(){return context;}});
const env={console,Set,Math,Promise,setTimeout,
  document:{querySelector:element,querySelectorAll(){return [];},
    createElement(){return element("option");},addEventListener(){}},
  requestAnimationFrame(){},
  Image:class {naturalWidth=32;naturalHeight=48;set src(value){this.onload();}}
};
env.window=env;env.addEventListener=()=>{};env.matchMedia=()=>({matches:false});
vm.createContext(env);
for(const name of ["map","decoder","physics","scenery","enemies","boss","combat","game"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,name+".js"),"utf8"),env,{filename:name+".js"});
}
setImmediate(()=>{
  function run(source){return vm.runInContext(source,env);}
  run(`selectLevel(3);frame(0);
    player.x=700;player.y=180;player.vy=100;player.invulnerable=999;
    boss.health=24;frame(16);`);
  assert.equal(run("boss.phase"),2);
  assert.equal(run("enemies.length"),8);
  assert(run("player.vy>0"),"transition exercised while falling");
  run("for(let i=2;i<40;i++) frame(i*16);");
  assert(run("boss.time>0.5"),"frames keep advancing after spawn");
  run("enemies=[];frame(640);");assert.equal(run("boss.phase"),3);
  run(`boss.time=13.999;player.x=700;player.y=180;player.vy=100;
    frame(656);`);
  assert.equal(run("boss.phase"),4);assert.equal(run("enemies.length"),8);
  run(`player.x=700;player.y=180;player.vy=100;frame(672);`);
  assert.equal(run("enemies.length"),8,"no additional final-phase wave");
  const time=run("boss.time");
  run("levelsMenu.open=true;frame(688);");assert.equal(run("boss.time"),time);
  run("levelsMenu.open=false;restart();");
  assert.equal(run("boss.phase"),0);assert.equal(run("boss.attackState"),"rest");
  assert.equal(run("level.blocks.some(b=>b.bossGate)"),false);
  // Only invulnerable phases draw the full shield ring.
  for(const phase of [0,1,2,3,4]) {
    arcs.length=0;
    run(`boss.active=${phase!==0};boss.phase=${phase};Boss.draw(boss,ctx,art,0);`);
    assert.equal(arcs.filter(a=>a[2]===64).length,phase===2||phase===3?1:0,"shield phase "+phase);
  }
  run("selectLevel(0);frame(704);");assert.equal(run("boss"),null);
  console.log("Frame regression passed: falling during phase 2, phase 4 spawns; ongoing frames, pause, restart, shields, normal levels.");
});
