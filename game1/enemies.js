// An enemy is a moving body plus a tiny rule: patrol and turn around.
window.Enemies = {
  create(spawn) {
    return { ...spawn, w: 28, h: 30, vx: 0, vy: 0, grounded: false,
      direction: -1, startX: spawn.x, speed: 65 };
  },

  update(enemies, level, dt) {
    for (const enemy of enemies) {
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
