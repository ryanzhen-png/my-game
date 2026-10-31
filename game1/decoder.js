// This is a JSON decoder, not a binary decoder. Both produce usable game data.
// Coordinates start at the top left: x increases right; y increases down.
window.decodeMap = function (text) {
  const data = JSON.parse(text);
  if (!data || data.tileSize !== 40 || !Array.isArray(data.rows) ||
      data.rows.length !== 12 || typeof data.rows[0] !== "string" ||
      data.rows[0].length < 20 || data.rows[0].length > 200 ||
      data.rows.some(row => typeof row !== "string" || row.length !== data.rows[0].length)) {
    throw new Error("Use tileSize 40 and 12 equal-length rows, each between 20 and 200 characters.");
  }
  const level = { width: data.rows[0].length * 40, height: data.rows.length * 40, blocks: [], slopes: [], enemies: [], spikes: [], spawn: null, goal: null };
  if (data.bossArena !== undefined && typeof data.bossArena !== "boolean") {
    throw new Error("bossArena must be true or false.");
  }
  if (data.bossArena && level.width !== 1200) throw new Error("The boss arena requires 30 columns.");
  level.bossArena = data.bossArena === true;
  let players = 0;
  let goals = 0;
  data.rows.forEach((row, rowIndex) => {
    [...row].forEach((symbol, columnIndex) => {
      if (![".", "#", "P", "^", "F", "/", "\\", "E", "B", "C"].includes(symbol)) throw new Error("Unknown map character: " + symbol);
      const cell = { x: columnIndex * 40, y: rowIndex * 40, w: 40, h: 40 };
      if (symbol === "/" || symbol === "\\") level.slopes.push({ ...cell, rising: symbol === "/" });
      if (symbol === "E" || symbol === "B" || symbol === "C") level.enemies.push({ x: cell.x + 6, y: cell.y + 10, kind: symbol === "E" ? "ground" : "flying", variant: symbol === "C" ? "B" : "A" });
      if (symbol === "#") level.blocks.push(cell);
      if (symbol === "^") level.spikes.push(cell);
      if (symbol === "P") { level.spawn = { x: cell.x + 6, y: cell.y + 6 }; players++; }
      if (symbol === "F") { level.goal = cell; goals++; }
    });
  });
  if (players !== 1 || goals !== 1) throw new Error("Include exactly one P and one F.");
  return level;
};
