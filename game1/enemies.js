// An enemy is a moving body plus a tiny rule: patrol and turn around.
window.Enemies = {
  create(spawn) {
    if (spawn.kind === "flying") {
      return { ...spawn, w: 36, h: 30, direction: -1, startX: spawn.x,
        startY: spawn.y, age: 0, speed: 80, variant: spawn.variant || "A",
        health: 2, maxHealth: 2, visionRadius: 200, cooldown: 0.8, state: "patrol", timer: 0, vx: 0, vy: 0 };
    }
    return { kind: "ground", ...spawn, w: 28, h: 30, vx: 0, vy: 0, grounded: false,
      direction: -1, startX: spawn.x, speed: 65, health: 2, maxHealth: 2 };
  },

  knockback(enemy, player) {
    const offset = enemy.x + enemy.w / 2 - (player.x + player.w / 2);
    const away = Math.sign(offset) || Math.sign(player.vx) || -enemy.direction;
    enemy.state = "knockback"; enemy.timer = 0.3;
    enemy.vx = away * 180;
    enemy.vy = enemy.kind === "flying" ? 180 : -180;
    enemy.grounded = false;
  },

  stomp(player, previousPlayer, enemy, previousEnemy) {
    return player.vy > 0 && previousPlayer.y + player.h <= previousEnemy.y + 2 &&
      player.y + player.h >= enemy.y && player.y < enemy.y + enemy.h &&
      player.x + player.w > enemy.x && player.x < enemy.x + enemy.w;
  },

  updateProjectiles(projectiles, level, dt) {
    for (const shot of projectiles) {
      shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
    }
    return projectiles.filter(shot => shot.life > 0 && shot.x + shot.w >= 0 &&
      shot.x <= level.width && shot.y + shot.h >= 0 && shot.y <= level.height &&
      !level.blocks.some(block => Physics.overlaps(shot, block)) &&
      !level.slopes.some(slope => Physics.overlaps(shot, slope) &&
        shot.y + shot.h >= Physics.slopeHeight(slope, shot)));
  },

  // Use the same terrain edges for detection and the visible debug area.
  visionEdges(level, x, y, radius) {
    const edges = [];
    for (const shape of [...level.blocks, ...level.slopes]) {
      if (shape.x > x + radius || shape.x + shape.w < x - radius ||
          shape.y > y + radius || shape.y + shape.h < y - radius) continue;
      const { x: sx, y: sy, w, h } = shape;
      const points = typeof shape.rising === "boolean"
        ? (shape.rising ? [[sx, sy + h], [sx + w, sy], [sx + w, sy + h]]
          : [[sx, sy], [sx + w, sy + h], [sx, sy + h]])
        : [[sx, sy], [sx + w, sy], [sx + w, sy + h], [sx, sy + h]];
      points.forEach((point, i) => edges.push([point, points[(i + 1) % points.length]]));
    }
    return edges;
  },

  visionDistance(x, y, dx, dy, radius, edges) {
    let nearest = radius;
    for (const [[ax, ay], [bx, by]] of edges) {
      const ex = bx - ax, ey = by - ay;
      const cross = dx * ey - dy * ex;
      if (Math.abs(cross) < 0.0000001) continue;
      const ox = ax - x, oy = ay - y;
      const distance = (ox * ey - oy * ex) / cross;
      const along = (ox * dy - oy * dx) / cross;
      if (distance >= 0 && distance < nearest && along >= 0 && along <= 1) nearest = distance;
    }
    return nearest;
  },

  visionOutline(enemy, level) {
    const x = enemy.x + enemy.w / 2, y = enemy.y + enemy.h / 2;
    const edges = this.visionEdges(level, x, y, enemy.visionRadius);
    const angles = Array.from({ length: 96 }, (_, i) => i * Math.PI * 2 / 96 - Math.PI);
    // Rays on either side of each corner preserve sharp terrain shadows.
    for (const edge of edges) {
      const angle = Math.atan2(edge[0][1] - y, edge[0][0] - x);
      angles.push(angle - 0.00001, angle, angle + 0.00001);
    }
    return angles.sort((a, b) => a - b).map(angle => {
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const distance = this.visionDistance(x, y, dx, dy, enemy.visionRadius, edges);
      return { x: x + dx * distance, y: y + dy * distance };
    });
  },

  // Small movement steps keep fast charges from tunneling through thin terrain.
  moveFlying(enemy, level, moveX, moveY) {
    const hits = { wall: false, ground: false, ceiling: false };
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(moveX), Math.abs(moveY)) / 4));
    let stepX = moveX / steps, stepY = moveY / steps;
    const solidRamp = slope => Physics.overlaps(enemy, slope) &&
      enemy.y + enemy.h > Physics.slopeHeight(slope, enemy);
    for (let i = 0; i < steps; i++) {
      if (stepX) {
        const oldX = enemy.x;
        enemy.x += stepX;
        for (const block of level.blocks) {
          if (Physics.overlaps(enemy, block)) {
            enemy.x = stepX > 0 ? block.x - enemy.w : block.x + block.w;
            hits.wall = true;
          }
        }
        if (level.slopes.some(solidRamp)) { enemy.x = oldX; hits.wall = true; }
        const bounded = Math.max(0, Math.min(level.width - enemy.w, enemy.x));
        if (bounded !== enemy.x) hits.wall = true;
        enemy.x = bounded;
        if (hits.wall) stepX = 0;
      }
      if (stepY) {
        enemy.y += stepY;
        for (const block of level.blocks) {
          if (!Physics.overlaps(enemy, block)) continue;
          enemy.y = stepY > 0 ? block.y - enemy.h : block.y + block.h;
          if (stepY > 0) hits.ground = true; else hits.ceiling = true;
        }
        for (const slope of level.slopes) {
          if (!solidRamp(slope)) continue;
          enemy.y = stepY > 0 ? Physics.slopeHeight(slope, enemy) - enemy.h : slope.y + slope.h;
          if (stepY > 0) hits.ground = true; else hits.ceiling = true;
        }
        if (enemy.y < 0) { enemy.y = 0; hits.ceiling = true; }
        if (enemy.y > level.height - enemy.h) {
          enemy.y = level.height - enemy.h; hits.ground = true;
        }
        if (hits.ground || hits.ceiling) stepY = 0;
      }
      if (hits.ground) break;
    }
    if (hits.ground) {
      enemy.state = "stunned"; enemy.timer = 1; enemy.vx = 0; enemy.vy = 0;
    }
    return hits;
  },

  update(enemies, level, dt, player, projectiles = []) {
    for (const enemy of enemies) {
      if (enemy.state === "knockback") {
        // Recoil temporarily overrides patrol and interrupts any attack wind-up.
        if (enemy.kind === "flying") {
          const hit = this.moveFlying(enemy, level, enemy.vx * dt, enemy.vy * dt);
          if (hit.ground) continue; // Ground impacts still cause a full one-second stun.
          if (hit.wall) enemy.vx = 0;
          if (hit.ceiling) enemy.vy = 0;
        } else {
          const oldX = enemy.x, velocity = enemy.vx;
          Physics.step(enemy, level.blocks, Math.sign(velocity), false, dt,
            level.width, level.slopes, Math.abs(velocity));
          if (Math.abs(enemy.x - oldX - velocity * dt) > 0.0001) enemy.vx = 0;
          if (enemy.y > level.height) {
            enemy.x = enemy.startX; enemy.y = 0; enemy.vy = 0;
          }
        }
        enemy.vx *= Math.max(0, 1 - 5 * dt);
        enemy.timer -= dt;
        if (enemy.timer <= 0) {
          enemy.startX = enemy.x;
          if (enemy.kind === "flying") {
            enemy.state = "recover"; enemy.timer = 0.2;
          } else {
            enemy.state = "patrol";
          }
        }
        continue;
      }
      if (enemy.kind === "flying") {
        const dx = player ? player.x + player.w / 2 - (enemy.x + enemy.w / 2) : Infinity;
        const dy = player ? player.y + player.h / 2 - (enemy.y + enemy.h / 2) : Infinity;
        const playerDistance = Math.hypot(dx, dy);
        enemy.seesPlayer = playerDistance <= enemy.visionRadius;
        if (enemy.seesPlayer && playerDistance > 0) {
          const x = enemy.x + enemy.w / 2, y = enemy.y + enemy.h / 2;
          const edges = this.visionEdges(level, x, y, enemy.visionRadius);
          enemy.seesPlayer = this.visionDistance(x, y, dx / playerDistance,
            dy / playerDistance, enemy.visionRadius, edges) >= playerDistance;
        }
        enemy.cooldown = Math.max(0, enemy.cooldown - dt);
        if (enemy.state === "windup") {
          enemy.timer -= dt;
          if (enemy.timer <= 0) {
            if (enemy.variant === "B") {
              enemy.state = "charge"; enemy.timer = 0.55;
            } else {
              // Aim when the wind-up ends, using the player's latest position.
              if (player) {
                const distance = Math.hypot(dx, dy) || 1;
                enemy.vx = dx / distance * 220; enemy.vy = dy / distance * 220;
                enemy.direction = dx >= 0 ? 1 : -1;
              }
              projectiles.push({ x: enemy.x + enemy.w / 2 - 5, y: enemy.y + enemy.h / 2 - 5,
                w: 10, h: 10, vx: enemy.vx, vy: enemy.vy, life: 3 });
              enemy.state = "patrol"; enemy.cooldown = 1.4;
            }
          }
          continue;
        }
        if (enemy.state === "charge") {
          const hit = this.moveFlying(enemy, level, enemy.vx * dt, enemy.vy * dt);
          if (hit.ground) continue;
          if (hit.wall || hit.ceiling) {
            enemy.vx = 0; enemy.vy = 0;
            enemy.state = "recover"; enemy.timer = 0.9;
            continue;
          }
          enemy.timer -= dt;
          if (enemy.timer <= 0) { enemy.state = "recover"; enemy.timer = 0.9; }
          continue;
        }
        if (enemy.state === "recover" || enemy.state === "stunned") {
          enemy.timer -= dt;
          if (enemy.timer <= 0) {
            enemy.state = "patrol"; enemy.cooldown = 0.5;
            enemy.startX = enemy.x; enemy.startY = enemy.y - 18;
            // Resume at the bottom of the bob, moving upward away from the floor.
            enemy.age = Math.PI / 6;
          }
          continue;
        }
        if (enemy.seesPlayer && enemy.cooldown <= 0) {
          const distance = Math.hypot(dx, dy) || 1;
          enemy.direction = dx >= 0 ? 1 : -1;
          // The charging bug locks aim here; the shooter aims again at release.
          const attackSpeed = enemy.variant === "B" ? 350 : 220;
          enemy.vx = dx / distance * attackSpeed; enemy.vy = dy / distance * attackSpeed;
          enemy.windupDuration = enemy.variant === "B" ? 0.65 : 0.6;
          enemy.state = "windup"; enemy.timer = enemy.windupDuration;
          continue;
        }
        // Patrol without gravity while waiting to attack.
        enemy.age += dt;
        const left = Math.max(0, enemy.startX - 80);
        const right = Math.min(level.width - enemy.w, enemy.startX + 80);
        const targetX = Math.max(left, Math.min(right, enemy.x + enemy.direction * enemy.speed * dt));
        const targetY = enemy.startY + Math.sin(enemy.age * 3) * 16;
        const hit = this.moveFlying(enemy, level, targetX - enemy.x, targetY - enemy.y);
        if (hit.wall) enemy.direction *= -1;
        if (enemy.x <= left) enemy.direction = 1;
        if (enemy.x >= right) enemy.direction = -1;
        continue;
      }
      const oldX = enemy.x;
      const feet = enemy.y + enemy.h;
      const ahead = enemy.direction > 0 ? enemy.x + enemy.w + 3 : enemy.x - 3;
      // When grounded, check whether the next step still has a floor.
      const floorAhead = level.blocks.some(block => ahead >= block.x && ahead < block.x + block.w &&
        Math.abs(block.y - feet) < 12) || level.slopes.some(slope =>
        ahead >= slope.x && ahead < slope.x + slope.w &&
        Math.abs(Physics.slopeHeight(slope, { x: ahead, w: 0 }) - feet) < 12);
      if (enemy.grounded && !floorAhead) enemy.direction *= -1;
      Physics.step(enemy, level.blocks, enemy.direction, false, dt, level.width, level.slopes, enemy.speed);
      if (Math.abs(enemy.x - oldX) < 0.001 || Math.abs(enemy.x - enemy.startX) >= 60) {
        enemy.direction = enemy.x >= enemy.startX ? -1 : 1;
        // At a wall, reverse the attempted direction instead.
        if (Math.abs(enemy.x - oldX) < 0.001) enemy.direction = enemy.vx > 0 ? -1 : 1;
      }
      if (enemy.y > level.height) Object.assign(enemy, this.create({ x: enemy.startX, y: 0 }));
    }
  }
};
