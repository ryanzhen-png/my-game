// Reusable sword behavior: one hit per target per swing, with a short cooldown.
window.Combat = {
  duration: 0.10,
  cooldown: 0.16,
  start(player, aim, heavy = false) {
    if (player.attackCooldown > 0 || player.knockbackTime > 0) return false;
    player.attackDuration = heavy ? 0.25 : this.duration;
    player.attackTime = player.attackDuration;
    player.attackCooldown = heavy ? 0.40 : this.cooldown;
    player.attackDamage = heavy ? 2 : 1;
    player.attackHeavy = heavy;
    player.attackAngle = aim;
    player.attackHits = new Set();
    return true;
  },
  hitbox(player) {
    const dx = Math.cos(player.attackAngle), dy = Math.sin(player.attackAngle);
    const cx = player.x + player.w / 2 + dx * 26;
    const cy = player.y + player.h / 2 + dy * 26;
    const w = Math.abs(dx) * 32 + Math.abs(dy) * 32;
    const h = Math.abs(dy) * 32 + Math.abs(dx) * 32;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  },
  hits(player, enemy) {
    if (!Physics.overlaps(this.hitbox(player), enemy)) return false;
    // Test the rotated swing area as well as its world-aligned bounds.
    const dx = Math.cos(player.attackAngle), dy = Math.sin(player.attackAngle);
    const ox = enemy.x + enemy.w / 2 - (player.x + player.w / 2);
    const oy = enemy.y + enemy.h / 2 - (player.y + player.h / 2);
    const forward = ox * dx + oy * dy;
    const side = -ox * dy + oy * dx;
    const forwardRadius = Math.abs(dx) * enemy.w / 2 + Math.abs(dy) * enemy.h / 2;
    const sideRadius = Math.abs(dy) * enemy.w / 2 + Math.abs(dx) * enemy.h / 2;
    return forward + forwardRadius > 10 && forward - forwardRadius < 42 &&
      Math.abs(side) < 16 + sideRadius;
  },
  update(player, enemies, level, dt) {
    player.attackCooldown = Math.max(0, player.attackCooldown - dt);
    if (player.attackTime <= 0) return enemies;
    player.attackTime = Math.max(0, player.attackTime - dt);
    // Heavy swings spend their first half winding up before they can connect.
    if (player.attackHeavy && player.attackTime > player.attackDuration / 2) return enemies;
    const x = player.x + player.w / 2, y = player.y + player.h / 2;
    const edges = Enemies.visionEdges(level, x, y, 100);
    for (const enemy of enemies) {
      if (player.attackHits.has(enemy) || !this.hits(player, enemy)) continue;
      if (enemy.kind === "boss" && !Boss.vulnerable(enemy)) continue;
      const dx = enemy.x + enemy.w / 2 - x, dy = enemy.y + enemy.h / 2 - y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0 && Enemies.visionDistance(x, y, dx / distance, dy / distance,
          distance, edges) < distance) continue;
      player.attackHits.add(enemy);
      if (enemy.kind === "boss") {
        Boss.hit(enemy, player.attackDamage);
        continue;
      }
      enemy.health -= player.attackDamage;
      if (enemy.health > 0) Enemies.knockback(enemy, player, player.attackAngle, player.attackHeavy);
    }
    return enemies.filter(enemy => enemy.health > 0);
  }
};
