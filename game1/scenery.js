// Camera changes drawing coordinates, never the player's world position.
window.Scenery = {
  cameraX(player, worldWidth, viewportWidth) {
    return Math.max(0, Math.min(worldWidth - viewportWidth,
      player.x + player.w / 2 - viewportWidth / 2));
  },

  draw(ctx, width, height, cameraX, seconds, sunset) {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, sunset ? "#765f9e" : "#83c9ec");
    sky.addColorStop(1, sunset ? "#ffce9c" : "#effaf2");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#fff2bb";
    ctx.beginPath();
    ctx.arc(width - 120, sunset ? 170 : 80, 35, 0, Math.PI * 2);
    ctx.fill();

    // Clouds drift with time, even while the player stands still.
    ctx.fillStyle = "#ffffffaa";
    for (let i = -1; i < 5; i++) {
      const x = ((i * 260 + seconds * 12 - cameraX * 0.1) % 1300 + 1300) % 1300 - 260;
      const y = 80 + (i % 2) * 35;
      ctx.beginPath();
      ctx.ellipse(x, y, 58, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 12, y - 10, 30, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Background layers move at 20% and 45% of the camera speed.
    for (const [speed, color, top] of [[0.2, sunset ? "#897694" : "#9bc6b7", 260], [0.45, sunset ? "#6f7e85" : "#639e90", 350]]) {
      ctx.fillStyle = color;
      const offset = (cameraX * speed) % 360;
      for (let x = -360; x < width + 360; x += 360) {
        ctx.beginPath();
        ctx.moveTo(x - offset, height);
        ctx.quadraticCurveTo(x + 180 - offset, top - 160, x + 360 - offset, height);
        ctx.fill();
      }
    }
  }
};
