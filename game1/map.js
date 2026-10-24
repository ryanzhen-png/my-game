/* Levels are JSON text; this JS wrapper keeps direct file opening possible.
   The first level shows literal rows. Wider levels use a tiny layout helper. */
function makeWideMap(name, columns, platforms, spikes, finish) {
  const rows = Array.from({ length: 12 }, () => Array(columns).fill("."));
  rows[11].fill("#");
  rows[10][1] = "P";
  for (const [x, y, length] of platforms) {
    for (let i = 0; i < length; i++) rows[y][x + i] = "#";
  }
  for (const x of spikes) rows[10][x] = "^";
  // A small hill has a ramp on each side and a flat top.
  for (const [offset, symbol] of ["/", "#", "#", "\\"].entries()) rows[10][3 + offset] = symbol;
  rows[10][columns - 10] = "E";
  rows[8][columns - 17] = "B";
  rows[finish[1]][finish[0]] = "F";
  return { name, tileSize: 40, rows: rows.map(row => row.join("")) };
}
window.demoLevels = [
  {
    name: "1. First steps",
    tileSize: 40,
    rows: [
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      ".................B..",
      "..............F.....",
      "............####....",
      ".......###..........",
      "...###..............",
      ".P.../##\\..^^....E..",
      "####################"
    ]
  },
  makeWideMap("2. Meadow trail", 60,
    [[6, 9, 3], [13, 8, 3], [22, 9, 4], [33, 9, 3], [42, 9, 3], [49, 8, 3], [54, 7, 4]],
    [10, 11, 19, 20, 29, 30, 38, 39, 46, 47], [56, 6]),
  makeWideMap("3. Sunset journey", 80,
    [[5, 9, 3], [12, 8, 3], [20, 9, 3], [28, 8, 3], [37, 9, 3], [45, 8, 3], [53, 9, 3], [61, 9, 3], [67, 8, 3], [73, 7, 5]],
    [9, 10, 17, 18, 25, 26, 33, 34, 42, 43, 50, 51, 58, 59, 65, 66, 71], [76, 6])
].map(data => ({ name: data.name, text: JSON.stringify(data, null, 2) }));
window.exampleMap = window.demoLevels[0].text;
