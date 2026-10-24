window.Physics = {
  gravity: 1500,       // pixels per second squared
  speed: 240,          // pixels per second
  jumpSpeed: 560,


  tryJump(body, doubleJumpEnabled) {
    if (body.grounded) {
      body.airJumpUsed = false;
    } else {
      if (!doubleJumpEnabled || body.airJumpUsed) return false;
      body.airJumpUsed = true;
    }
    body.vy = -this.jumpSpeed;
    body.grounded = false;
    return true;
  },

  overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  },

  // Sample the highest part of the ramp beneath either edge of the feet.
  // Canvas y increases downward, so the highest surface has the smallest y.
  slopeHeight(slope, body) {
    const footX = slope.rising ? Math.min(body.x + body.w, slope.x + slope.w)
      : Math.max(body.x, slope.x);
    const fraction = Math.max(0, Math.min(1, (footX - slope.x) / slope.w));
    return slope.y + slope.h * (slope.rising ? 1 - fraction : fraction);
  },

  step(player, blocks, direction, jump, dt, worldWidth = 800, slopes = [], speed = this.speed) {
    const previousFeet = player.y + player.h;
    const wasGrounded = player.grounded;
    player.vx = direction * speed;
    if (jump && player.grounded) player.vy = -this.jumpSpeed;
    player.vy += this.gravity * dt;

    // Resolve horizontal movement first, so walls stop sideways movement.
    player.x += player.vx * dt;
    for (const block of blocks) {
      if (!this.overlaps(player, block)) continue;
      if (player.vx > 0) player.x = block.x - player.w;
      if (player.vx < 0) player.x = block.x + block.w;
    }
    player.x = Math.max(0, Math.min(worldWidth - player.w, player.x));

    // Resolve vertical movement separately: floors, ceilings, and landing.
    player.y += player.vy * dt;
    const falling = player.vy >= 0;
    player.grounded = false;
    for (const block of blocks) {
      if (!this.overlaps(player, block)) continue;
      if (player.vy > 0) {
        player.y = block.y - player.h;
        player.grounded = true;
      } else if (player.vy < 0) {
        player.y = block.y + block.h;
      }
      player.vy = 0;
    }

    // Ramps are one-way surfaces: jumping upward through them is allowed.
    // Grounded bodies can follow a descending ramp by a small step each frame.
    if (falling) {
      const snap = wasGrounded ? Math.abs(player.vx * dt) + 1 : 0;
      // Bridge the final tiny drop from a ramp back onto a flat floor.
      if (wasGrounded) {
        for (const block of blocks) {
          if (player.x + player.w > block.x && player.x < block.x + block.w &&
              previousFeet <= block.y && Math.abs(player.y + player.h - block.y) <= snap) {
            player.y = block.y - player.h;
            player.vy = 0;
            player.grounded = true;
          }
        }
      }
      for (const slope of slopes) {
        if (player.x + player.w <= slope.x || player.x >= slope.x + slope.w) continue;
        const surface = this.slopeHeight(slope, player);
        if (previousFeet <= surface + snap && player.y + player.h >= surface - snap) {
          player.y = surface - player.h;
          player.vy = 0;
          player.grounded = true;
        }
      }
    }
  }
};
