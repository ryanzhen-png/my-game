// All artwork is loaded separately. Map characters choose which image to draw.
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const statusText = document.querySelector("#status");
const editor = document.querySelector("#map");
const message = document.querySelector("#map-message");
const keys = new Set();
const art = {};
let level;
let player;
let enemies = [];
let projectiles = [];
let won = false;
let jumpRequested = false;
let attackRequested = false;
let attackAim = 0;
let previousTime;
let selectedLevel = 0;
let facing = 1;
let backgroundTime = 0;
let animationTime = 0;
const levelSelect = document.querySelector("#level-select");
const nextButton = document.querySelector("#next-level");
const motion = document.querySelector("#background-motion");
const heavyAttack = document.querySelector("#heavy-attack");
const doubleJump = document.querySelector("#double-jump");
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) motion.checked = false;
window.demoLevels.forEach((entry, index) => {
  const option = document.createElement("option");
  option.value = index;
  option.textContent = entry.name;
  levelSelect.append(option);
});
function selectLevel(index) {
  selectedLevel = index;
  levelSelect.value = index;
  editor.value = window.demoLevels[index].text;
  keys.clear();
  buildMap();
}
levelSelect.onchange = () => selectLevel(Number(levelSelect.value));
nextButton.onclick = () => {
  if (won && selectedLevel < window.demoLevels.length - 1) selectLevel(selectedLevel + 1);
};
editor.value = window.exampleMap;

function restart() {
  player = { ...level.spawn, w: 28, h: 34, vx: 0, vy: 0, grounded: false, health: 3, maxHealth: 3, invulnerable: 0, knockbackTime: 0, knockbackVX: 0, airJumpUsed: false, attackTime: 0, attackCooldown: 0, attackFacing: 1, attackHits: new Set() };
  enemies = level.enemies.map(spawn => Enemies.create(spawn));
  projectiles = [];
  won = false;
  facing = 1;
  nextButton.disabled = true;
  jumpRequested = false;
  attackRequested = false;
  statusText.textContent = "Reach the flag. You have 3 health; enemies take 2 hits. WASD aims; Space swings; Shift toggles heavy attacks. A bees shoot; B bees charge. Avoid spikes and shots.";
}

function knockbackPlayer(source, stomp = false) {
  if (stomp) {
    // A stomp adds vertical lift without changing horizontal momentum or steering.
    player.vy = -Physics.jumpSpeed * 0.75;
    player.grounded = false;
    player.knockbackTime = 0;
    player.knockbackVX = 0;
    player.airJumpUsed = false;
    return;
  }
  const offset = player.x + player.w / 2 - (source.x + source.w / 2);
  const away = Math.sign(offset) || -facing;
  player.attackTime = 0;
  player.knockbackVX = away * 280;
  player.knockbackTime = 0.28;
  player.vx = player.knockbackVX;
  player.vy = -Physics.jumpSpeed * 0.6;
  player.grounded = false;
}

function stepPlayer(direction, jump, dt) {
  const recoiling = player.knockbackTime > 0;
  const velocity = recoiling ? player.knockbackVX : direction * Physics.speed;
  if (player.grounded) player.airJumpUsed = false;
  if (!recoiling && jump) Physics.tryJump(player, doubleJump.checked);
  const oldX = player.x;
  Physics.step(player, level.blocks, Math.sign(velocity), false,
    dt, level.width, level.slopes, Math.abs(velocity));
  // Stop horizontal movement at walls, including during knockback.
  if (Math.abs(player.x - oldX - velocity * dt) > 0.0001) {
    player.vx = 0;
    if (recoiling) player.knockbackVX = 0;
  }
  player.knockbackTime = Math.max(0, player.knockbackTime - dt);
}

function damagePlayer(source) {
  if (player.invulnerable > 0) return;
  player.health -= 1;
  if (player.health <= 0) {
    restart();
    statusText.textContent = "Out of health! Back to the start with full health.";
  } else {
    player.invulnerable = 1;
    knockbackPlayer(source);
    statusText.textContent = `Ouch! ${player.health} of ${player.maxHealth} health remaining.`;
  }
}

function buildMap() {
  try {
    // Only replace the level after decoding succeeds.
    const decoded = window.decodeMap(editor.value);
    level = decoded;
    restart();
    message.textContent = `Decoded ${level.blocks.length} blocks, ${level.spikes.length} spikes, ${level.slopes.length} ramps, ${enemies.length} enemies, one player, and one flag. World width: ${level.width}px.`;
  } catch (error) {
    message.textContent = "Map error: " + error.message;
  }
}

const jumpKeys = ["ArrowUp"];
const aimKeys = { KeyD: 0, KeyS: Math.PI / 2, KeyA: Math.PI, KeyW: -Math.PI / 2 };
function updateAttackAim() {
  const x = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
  const y = Number(keys.has("KeyS")) - Number(keys.has("KeyW"));
  if (x || y) attackAim = Math.atan2(y, x);
}
const gameKeys = ["ArrowLeft", "ArrowRight", ...Object.keys(aimKeys), ...jumpKeys, "Space", "ShiftLeft", "ShiftRight", "KeyR"];
window.addEventListener("keydown", event => {
  // Leave typing, form navigation, and keyboard button activation alone.
  if (event.target.closest("input, textarea, select, button, a, [contenteditable]")) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (!gameKeys.includes(event.code)) return;
  event.preventDefault();
  if (jumpKeys.includes(event.code) && !event.repeat) jumpRequested = true;
  if (event.code in aimKeys) attackAim = aimKeys[event.code];
  if (event.code === "Space" && !event.repeat) attackRequested = true;
  if (["ShiftLeft", "ShiftRight"].includes(event.code) && !event.repeat) heavyAttack.checked = !heavyAttack.checked;
  if (event.code === "KeyR" && level) restart();
  keys.add(event.code);
  updateAttackAim();
});
window.addEventListener("keyup", event => { keys.delete(event.code); updateAttackAim(); });
function clearInput() { keys.clear(); jumpRequested = false; attackRequested = false; }
canvas.addEventListener("blur", clearInput);
window.addEventListener("blur", clearInput);

const fullscreenButton = document.querySelector("#fullscreen");
const gameScreen = document.querySelector("#game-screen");
fullscreenButton.hidden = !document.fullscreenEnabled;
fullscreenButton.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement === gameScreen) await document.exitFullscreen();
    else await gameScreen.requestFullscreen();
    canvas.focus({ preventScroll: true });
  } catch (error) {
    statusText.textContent = "Fullscreen could not open. You can still play here without arrow-key scrolling.";
  }
});
document.addEventListener("fullscreenchange", () => {
  const active = document.fullscreenElement === gameScreen;
  fullscreenButton.textContent = active ? "Exit fullscreen" : "Fullscreen";
  fullscreenButton.setAttribute("aria-pressed", String(active));
  clearInput();
});

// On-screen controls work with a mouse, touch, or keyboard activation.
document.querySelectorAll("[data-key]").forEach(button => {
  const key = button.dataset.key;
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    button.setPointerCapture(event.pointerId);
    keys.add(key);
    if (key in aimKeys) updateAttackAim();
    if (key === "ArrowUp") jumpRequested = true;
    if (key === "Space") attackRequested = true;
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
    button.addEventListener(name, () => { keys.delete(key); updateAttackAim(); });
  }
  button.addEventListener("click", event => {
    if (event.detail === 0) {
      if (key === "ArrowUp") jumpRequested = true;
      else if (key === "Space") attackRequested = true;
      else if (key in aimKeys) attackAim = aimKeys[key];
      else {
        keys.add(key);
        setTimeout(() => keys.delete(key), 150);
      }
    }
  });
});
document.querySelector("#restart").onclick = () => { if (level) restart(); };
document.querySelector("#build").onclick = buildMap;
document.querySelector("#reset-map").onclick = () => { editor.value = window.demoLevels[selectedLevel].text; buildMap(); };

function drawObject(image, object) {
  ctx.drawImage(image, object.x, object.y, object.w, object.h);
  if (document.querySelector("#debug").checked) {
    ctx.strokeStyle = "#df2476";
    ctx.lineWidth = 1;
    ctx.strokeRect(object.x + 0.5, object.y + 0.5, object.w - 1, object.h - 1);
  }
}

function frame(time) {
  // Small fixed-size substeps reduce the risk of passing through a block.
  let remaining = Math.min((time - (previousTime ?? time)) / 1000, 0.05);
  const elapsed = remaining;
  animationTime += elapsed;
  if (motion.checked) backgroundTime += elapsed;
  previousTime = time;
  while (remaining > 0) {
    const dt = Math.min(remaining, 1 / 120);
    if (!won) {
      player.invulnerable = Math.max(0, player.invulnerable - dt);
      const right = keys.has("ArrowRight");
      const left = keys.has("ArrowLeft");
      const direction = Number(right) - Number(left);
      if (direction) facing = direction;
      const previousPlayer = { x: player.x, y: player.y };
      const previousEnemies = enemies.map(enemy => ({ y: enemy.y }));
      stepPlayer(direction, jumpRequested, dt);
      projectiles = Enemies.updateProjectiles(projectiles, level, dt);
      Enemies.update(enemies, level, dt, player, projectiles);
      // A single landing damages one target, even if enemies overlap.
      const stompedIndex = enemies.findIndex((enemy, index) =>
        Enemies.stomp(player, previousPlayer, enemy, previousEnemies[index]));
      if (stompedIndex >= 0) {
        const target = enemies[stompedIndex];
        target.health -= 1;
        player.y = target.y - player.h;
        knockbackPlayer(target, true);
        if (target.health <= 0) enemies.splice(stompedIndex, 1);
        else Enemies.knockback(target, player);
      }
      updateAttackAim();
      if (attackRequested) Combat.start(player, attackAim, heavyAttack.checked);
      attackRequested = false;
      enemies = Combat.update(player, enemies, level, dt);
      const enemyHit = stompedIndex < 0 && enemies.find(enemy => Physics.overlaps(player, enemy));
      const shotHit = projectiles.find(shot => Physics.overlaps(player, shot));
      // Shots disappear on contact, including during the grace period.
      projectiles = projectiles.filter(shot => !Physics.overlaps(player, shot));
      jumpRequested = false;
      if (player.y > level.height) {
        restart();
        statusText.textContent = "Fell out of the world! Back to the start with full health.";
      } else {
        const damageSource = enemyHit || shotHit || level.spikes.find(spike => Physics.overlaps(player, spike));
        if (damageSource) damagePlayer(damageSource);
      }
      if (Physics.overlaps(player, level.goal)) {
        won = true;
        nextButton.disabled = selectedLevel === window.demoLevels.length - 1;
        statusText.textContent = nextButton.disabled
          ? "All three levels complete! Choose a level or edit a map to keep experimenting."
          : "Flag reached! Choose Next level to continue, or press R to replay.";
      }
    }
    remaining -= dt;
  }
  const cameraX = Scenery.cameraX(player, level.width, canvas.width);
  Scenery.draw(ctx, canvas.width, canvas.height, cameraX, backgroundTime, selectedLevel === 2);
  ctx.save();
  ctx.translate(-cameraX, 0);
  for (const block of level.blocks) drawObject(art.block, block);
  for (const slope of level.slopes) {
    ctx.save();
    ctx.translate(slope.x + (slope.rising ? 0 : slope.w), slope.y);
    ctx.scale(slope.rising ? 1 : -1, 1);
    ctx.drawImage(art.ramp, 0, 0, slope.w, slope.h);
    if (document.querySelector("#debug").checked) {
      ctx.beginPath();
      ctx.moveTo(0, slope.h);
      ctx.lineTo(slope.w, 0);
      ctx.lineTo(slope.w, slope.h);
      ctx.closePath();
      ctx.strokeStyle = "#df2476";
      ctx.stroke();
    }
    ctx.restore();
  }
  for (const shot of projectiles) {
    ctx.fillStyle = "#e58919";
    ctx.beginPath(); ctx.arc(shot.x + shot.w / 2, shot.y + shot.h / 2, shot.w / 2, 0, Math.PI * 2); ctx.fill();
  }
  for (const enemy of enemies) {
    if (enemy.kind === "flying") {
      const color = enemy.variant === "B" ? "#bf487e" : "#b37b12";
      if (document.querySelector("#debug").checked) {
        const outline = Enemies.visionOutline(enemy, level);
        ctx.save();
        ctx.beginPath();
        outline.forEach((point, i) => i === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
        ctx.closePath();
        ctx.fillStyle = enemy.seesPlayer ? color + "20" : color + "0a";
        ctx.fill(); ctx.strokeStyle = color + "80"; ctx.lineWidth = 1; ctx.setLineDash([5, 6]); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = color; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(enemy.variant + (enemy.state === "windup" ? " !" : ""), enemy.x + enemy.w / 2, enemy.y - 8);
    }
    if (enemy.state === "stunned") {
      ctx.save(); ctx.fillStyle = "#ffd54a"; ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      for (let i = 0; i < 3; i++) {
        const angle = animationTime * 5 + i * Math.PI * 2 / 3;
        ctx.fillText("*", enemy.x + enemy.w / 2 + Math.cos(angle) * 18,
          enemy.y - 12 + Math.sin(angle) * 5);
      }
      ctx.restore();
    }
    const chargeProgress = enemy.state === "windup"
      ? Math.max(0, Math.min(1, 1 - enemy.timer / enemy.windupDuration)) : 0;
    if (enemy.state === "windup") {
      const cx = enemy.x + enemy.w / 2, cy = enemy.y + enemy.h / 2;
      const chargeColor = enemy.variant === "B" ? "#ff529c" : "#ffbd32";
      const pulse = (Math.sin(chargeProgress * Math.PI * 8) + 1) / 2;
      ctx.save();
      ctx.strokeStyle = chargeColor; ctx.fillStyle = chargeColor;
      ctx.globalAlpha = 0.15 + pulse * 0.2;
      ctx.beginPath(); ctx.arc(cx, cy, 24 + pulse * 4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, 25, -Math.PI / 2,
        -Math.PI / 2 + chargeProgress * Math.PI * 2); ctx.stroke();
      // Sparks converge on the bug as its attack builds.
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3 + chargeProgress * 2;
        const radius = 38 - chargeProgress * 22;
        ctx.beginPath(); ctx.arc(cx + Math.cos(angle) * radius,
          cy + Math.sin(angle) * radius, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    const frameName = (enemy.kind === "flying" ? "bee" : "slime") +
      (Math.floor(animationTime * (enemy.kind === "flying" ? 12 : 6)) % 2 ? "B" : "A");
    // Flip the artwork with patrol direction; collision stays in world space.
    ctx.save();
    ctx.translate(enemy.x + enemy.w / 2, enemy.y);
    ctx.scale(enemy.direction < 0 ? 1 : -1, 1);
    if (enemy.kind === "flying" && enemy.variant === "B") ctx.filter = "hue-rotate(280deg)";
    if (enemy.state === "windup") {
      ctx.translate(Math.sin(chargeProgress * 65) * chargeProgress * 2.5, 0);
      ctx.scale(1 + chargeProgress * 0.12, 1 - chargeProgress * 0.1);
      ctx.filter = (enemy.variant === "B" ? "hue-rotate(280deg) " : "") +
        `brightness(${1.2 + chargeProgress * 0.8})`;
    }
    ctx.drawImage(art[frameName], -enemy.w / 2, 0, enemy.w, enemy.h);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "#382a35"; ctx.fillRect(enemy.x, enemy.y - 6, enemy.w, 4);
    ctx.fillStyle = "#65d46e";
    ctx.fillRect(enemy.x, enemy.y - 6, enemy.w * enemy.health / enemy.maxHealth, 4);
    ctx.restore();
    if (document.querySelector("#debug").checked) {
      ctx.strokeStyle = "#df2476";
      ctx.strokeRect(enemy.x, enemy.y, enemy.w, enemy.h);
    }
  }
  for (const spike of level.spikes) drawObject(art.spikes, spike);
  // The goal's collision rectangle stays fixed as its flag flutters.
  drawObject(art[Math.floor(animationTime * 6) % 2 ? "flagB" : "flagA"], level.goal);

  // Animation chooses an image; it does not change the collision rectangle.
  const pose = won ? "cheer1" : !player.grounded ? (player.vy < 0 ? "jump" : "fall")
    : player.vx ? (Math.floor(animationTime * 9) % 2 ? "walk1" : "walk2") : "idle";
  ctx.save();
  if (player.invulnerable > 0) ctx.globalAlpha = Math.floor(animationTime * 12) % 2 ? 0.35 : 1;
  ctx.translate(player.x + player.w / 2, player.y + player.h);
  ctx.scale(facing, 1);
  const image = art[pose];
  const displayHeight = 46;
  const displayWidth = displayHeight * image.naturalWidth / image.naturalHeight;
  ctx.drawImage(image, -displayWidth / 2, -displayHeight, displayWidth, displayHeight);
  ctx.restore();
  if (player.attackTime > 0) {
    const progress = 1 - player.attackTime / player.attackDuration;
    ctx.save();
    ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
    ctx.rotate(player.attackAngle);
    ctx.strokeStyle = player.attackHeavy ? "#ffd066bb" : "#e6f7ff99"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, 48, -1.05, -1.05 + progress * 2.1); ctx.stroke();
    ctx.rotate(-1.05 + progress * 2.1);
    ctx.drawImage(art.sword, 4, -8, 56, 17.5);
    ctx.restore();
    if (document.querySelector("#debug").checked) {
      const box = Combat.hitbox(player);
      ctx.strokeStyle = "#72b5ee"; ctx.strokeRect(box.x, box.y, box.w, box.h);
    }
  }
  if (document.querySelector("#debug").checked) {
    ctx.strokeStyle = "#df2476";
    ctx.strokeRect(player.x, player.y, player.w, player.h);
  }
  ctx.restore();
  document.querySelector("#health").textContent = `Health: ${player.health} / ${player.maxHealth}`;
  document.querySelector("#camera-info").textContent =
    `World: ${level.width}px | Camera: ${Math.round(cameraX)}px | Player world X: ${Math.round(player.x)}px`;
  requestAnimationFrame(frame);
}

const imageFiles = {
  sword: "sword.svg", ramp: "ramp.svg", block: "block.svg", spikes: "spikes.svg",
  slimeA: "kenney-platformer/slime_normal_walk_a.png",
  slimeB: "kenney-platformer/slime_normal_walk_b.png",
  beeA: "kenney-platformer/bee_a.png", beeB: "kenney-platformer/bee_b.png",
  flagA: "kenney-platformer/flag_yellow_a.png", flagB: "kenney-platformer/flag_yellow_b.png",
  ...Object.fromEntries(["idle", "walk1", "walk2", "jump", "fall", "cheer1"].map(pose =>
    [pose, "kenney/adventurer_" + pose + ".png"]))
};
Promise.all(Object.entries(imageFiles).map(([name, file]) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => { art[name] = image; resolve(); };
  image.onerror = () => reject(new Error("Could not load game1/assets/" + file));
  image.src = "game1/assets/" + file;
}))).then(() => {
  buildMap();
  requestAnimationFrame(frame);
}).catch(error => { statusText.textContent = error.message; });
