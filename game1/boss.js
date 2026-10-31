// Stationary arena boss. Timers advance only during active gameplay.
window.Boss = {
  create(level) {
    level.blocks = level.blocks.filter(block => !block.bossGate);
    if (!level.bossArena) return null;
    return { kind: "boss", x: 752, y: 216, w: 96, h: 80,
      health: 36, maxHealth: 36, active: false, defeated: false,
      phase: 0, time: 0, shotTimer: 0, waveTimer: 0, laserTimer: 0,
      lasers: [], wave: 0, label: "Enter the arena" };
  },
  vulnerable(boss) { return boss.active && !boss.defeated && (boss.phase === 1 || boss.phase === 4); },
  hit(boss, damage) {
    if (!this.vulnerable(boss)) return;
    // Do not let a heavy swing skip the horde and laser phases.
    boss.health = Math.max(boss.phase === 1 ? 24 : 0, boss.health - damage);
  },
  enterPhase(boss, phase, enemies, shots, player) {
    boss.phase = phase; boss.time = 0; boss.shotTimer = 0.8;
    boss.waveTimer = 8; boss.laserTimer = 0.5; boss.lasers = [];
    shots.length = 0;
    if (phase === 2 || phase === 4) this.spawnWave(boss, enemies, player);
  },
  spawnWave(boss, enemies, player) {
    // Eight telegraphed edge spawns; cap surviving reinforcements in the final phase.
    const points = [[448,80],[1120,80],[448,190],[1120,190],
      [464,292],[1104,292],[640,32],[928,32]];
    boss.wave += 1;
    for (const [index, point] of points.entries()) {
      if (enemies.filter(enemy => enemy.bossMinion).length >= 12) break;
      let [x,y] = point;
      if (Math.hypot(x-player.x, y-player.y) < 100) x = x < 800 ? 1120 : 448;
      const enemy = Enemies.create({ x, y, kind: "flying", variant: index % 3 === 0 ? "A" : "B" });
      Object.assign(enemy, { bossMinion: true, visionRadius: 850,
        state: "recover", timer: 1.2, cooldown: 0.8 });
      enemies.push(enemy);
    }
  },
  aimedShots(boss, player, shots) {
    const x = boss.x + boss.w/2, y = boss.y + boss.h/2;
    const aim = Math.atan2(player.y+player.h/2-y, player.x+player.w/2-x);
    for (const offset of [-0.28,0,0.28]) {
      const angle = aim + offset;
      shots.push({ x:x-6, y:y-6, w:12, h:12,
        vx:Math.cos(angle)*190, vy:Math.sin(angle)*190, life:5 });
    }
  },
  trackingLaser(boss, player) {
    const x = boss.x+boss.w/2, y = boss.y+boss.h/2;
    boss.lasers.push({ x,y, angle: Math.atan2(player.y+player.h/2-y,player.x+player.w/2-x),
      age:0, warning:1.5, duration:4.5, length:950, width:12, tracking:true });
  },
  crossLasers(boss, player) {
    // Lock lanes at warning time so the player can escape before they fire.
    boss.lasers.push({ x:420,y:Math.max(60,Math.min(415,player.y+player.h/2)), angle:0,
      age:0, warning:1.3, duration:0.9, length:760, width:14 });
    boss.lasers.push({ x:Math.max(440,Math.min(1150,player.x+player.w/2)),y:0, angle:Math.PI/2,
      age:0, warning:1.3, duration:0.9, length:440, width:14 });
  },
  update(boss, level, player, enemies, shots, dt) {
    if (!boss || boss.defeated) return;
    if (!boss.active) {
      if (player.x < 440) return;
      boss.active = true;
      level.blocks.push({ x:400,y:0,w:20,h:440,bossGate:true });
      this.enterPhase(boss,1,enemies,shots,player);
    }
    if (boss.health <= 0) {
      boss.defeated = true; boss.lasers = []; shots.length = 0;
      enemies.splice(0,enemies.length);
      level.blocks = level.blocks.filter(block => !block.bossGate);
      boss.label = "Boss defeated! The gate is open - reach the flag.";
      return;
    }
    boss.time += dt;
    if (boss.phase === 1 && boss.health <= 24) this.enterPhase(boss,2,enemies,shots,player);
    else if (boss.phase === 2 && (boss.time >= 30 || !enemies.some(enemy => enemy.bossMinion))) {
      this.enterPhase(boss,3,enemies,shots,player);
    } else if (boss.phase === 3 && boss.time >= 14) this.enterPhase(boss,4,enemies,shots,player);
    if (boss.phase === 1 || boss.phase === 4) {
      boss.shotTimer -= dt;
      if (boss.shotTimer <= 0) { this.aimedShots(boss,player,shots); boss.shotTimer = boss.phase===1 ? 1.25 : 1.8; }
    }
    if (boss.phase === 4) {
      boss.waveTimer -= dt;
      if (boss.waveTimer <= 0) { this.spawnWave(boss,enemies,player); boss.waveTimer = 12; }
    }
    if (boss.phase === 3 || boss.phase === 4) {
      boss.laserTimer -= dt;
      if (boss.laserTimer <= 0) {
        this.trackingLaser(boss,player);
        if (boss.phase === 3) this.crossLasers(boss,player);
        boss.laserTimer = 7;
      }
      // Additional crossing lanes during the tracking beam's firing window.
      if (boss.phase === 3 && boss.time-dt < 4 && boss.time >= 4) this.crossLasers(boss,player);
      if (boss.phase === 3 && boss.time-dt < 11 && boss.time >= 11) this.crossLasers(boss,player);
    }
    for (const laser of boss.lasers) {
      laser.age += dt;
      if (laser.tracking) {
        const aim = Math.atan2(player.y+player.h/2-laser.y,player.x+player.w/2-laser.x);
        const delta = Math.atan2(Math.sin(aim-laser.angle),Math.cos(aim-laser.angle));
        const speed = laser.age < laser.warning ? 0.65 : 0.35;
        laser.angle += Math.max(-speed*dt,Math.min(speed*dt,delta));
      }
    }
    boss.lasers = boss.lasers.filter(laser => laser.age < laser.warning+laser.duration);
    boss.label = boss.phase === 1 ? "Phase 1: projectile barrage - attack the boss!"
      : boss.phase === 2 ? `Phase 2: horde - ${Math.ceil(30-boss.time)}s or defeat all bugs (shielded)`
      : boss.phase === 3 ? `Phase 3: lasers - survive ${Math.ceil(14-boss.time)}s (shielded)`
      : "Final phase: bugs, projectiles and core lasers - finish the boss!";
  },
  laserHits(laser, body) {
    if (laser.age < laser.warning || laser.age >= laser.warning+laser.duration) return false;
    // Segment versus expanded player rectangle (slab intersection).
    const pad = laser.width/2;
    const dx = Math.cos(laser.angle), dy = Math.sin(laser.angle);
    let near = 0, far = laser.length;
    for (const [origin, direction, low, high] of [
      [laser.x,dx,body.x-pad,body.x+body.w+pad],
      [laser.y,dy,body.y-pad,body.y+body.h+pad]]) {
      if (Math.abs(direction)<1e-8) { if (origin<low || origin>high) return false; }
      else {
        const a=(low-origin)/direction,b=(high-origin)/direction;
        near=Math.max(near,Math.min(a,b)); far=Math.min(far,Math.max(a,b));
        if (near>far) return false;
      }
    }
    return true;
  },
  hazard(boss, player) {
    if (!boss?.active || boss.defeated) return null;
    if (Physics.overlaps(player,boss)) return boss;
    const laser=boss.lasers.find(beam=>this.laserHits(beam,player));
    return laser ? {x:laser.x,y:laser.y,w:1,h:1} : null;
  },
  cameraX(boss) { return boss?.active ? 400 : null; },
  draw(boss,ctx,art,time) {
    if (!boss) return;
    ctx.save();
    ctx.fillStyle="#26324c"; ctx.fillRect(1180,0,20,440);
    if (boss.active && !boss.defeated) {
      ctx.fillStyle="#b34b75"; ctx.fillRect(400,0,20,440);
      ctx.strokeStyle="#ffcadb"; ctx.lineWidth=2;
      for(let y=0;y<440;y+=24) { ctx.beginPath();ctx.moveTo(400,y);ctx.lineTo(420,y+20);ctx.stroke(); }
    }
    ctx.beginPath();ctx.rect(420,0,760,440);ctx.clip();
    if (!boss.defeated) {
      const shielded=!this.vulnerable(boss);
      ctx.fillStyle=shielded ? "#64ceff33" : "#ef508a33";
      ctx.beginPath();ctx.arc(800,256,64,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=shielded ? "#64ceff" : "#ef508a";ctx.lineWidth=3;ctx.stroke();
      ctx.filter="hue-rotate(280deg)";
      ctx.drawImage(art[Math.floor(time*10)%2 ? "beeA":"beeB"],boss.x,boss.y,boss.w,boss.h);
      ctx.filter="none";
    }
    for(const laser of boss.lasers) {
      const warning=laser.age<laser.warning;
      ctx.strokeStyle=warning ? "#ffcf5a99":"#ff3869";
      ctx.lineWidth=warning ? 2:laser.width;
      ctx.setLineDash(warning ? [10,8]:[]);
      ctx.beginPath();ctx.moveTo(laser.x,laser.y);
      ctx.lineTo(laser.x+Math.cos(laser.angle)*laser.length,laser.y+Math.sin(laser.angle)*laser.length);ctx.stroke();
      if(!warning) {ctx.strokeStyle="#fff0f6";ctx.lineWidth=3;ctx.stroke();}
    }
    ctx.restore();
  },
  drawHUD(boss,ctx) {
    if (!boss) return;
    ctx.save();ctx.fillStyle="#101522ed";ctx.fillRect(14,12,772,66);
    ctx.fillStyle="#fff";ctx.font="bold 15px system-ui";ctx.textAlign="center";
    ctx.fillText("THE HIVE GUARDIAN  " + boss.health + " / " + boss.maxHealth,400,33);
    ctx.font="13px system-ui";ctx.fillText(boss.label,400,54);
    ctx.fillStyle="#3e4b65";ctx.fillRect(32,64,736,6);
    ctx.fillStyle=this.vulnerable(boss)?"#f25289":"#64ceff";
    ctx.fillRect(32,64,736*boss.health/boss.maxHealth,6);ctx.restore();
  }
};
