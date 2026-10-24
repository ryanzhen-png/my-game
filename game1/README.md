# Game 1: a tiny platformer students can take apart

Open ../page1.html in a browser. No installation, server, libraries, or build step is required. Click the canvas to use keyboard controls, or use the on-screen buttons.

## Read in this order

1. map.js: JSON text describing three 12-row grids, with 20, 60, and 80 columns. Every cell is 40 pixels. It is wrapped in a JavaScript file to work when opened directly from disk, without fetch restrictions.
2. decoder.js: JSON.parse reads the text; validation rejects malformed levels; each symbol becomes an object with coordinates and dimensions.
3. assets/: local SVG drawings plus downloaded Kenney adventurer PNGs (CC0; see assets/CREDITS.md). Open SVGs as text to see how they are drawn; PNGs contain raster image data. The decoder does not generate artwork.
4. physics.js: velocity, gravity, jumping, and axis-separated rectangle collision. Units are pixels and seconds; negative vertical velocity moves upward.
5. game.js: input, loading images, updating physics, spike/goal overlap rules, and drawing via requestAnimationFrame.
6. scenery.js: camera clamping, moving clouds, and parallax hills. Camera offset affects drawing only; it never changes map coordinates.
7. style.css: presentation of the teaching page.

## Try these experiments

- Move a # in the page's JSON editor and rebuild. Observe how map coordinates change the level.
- Change gravity or jumpSpeed in physics.js, reload, and compare the jump.
- Change the player's fill color in assets/player.svg and reload. The map and physics do not need to change.
- Toggle collision boxes. Spikes deliberately use a whole-cell rectangle, illustrating that collision shapes and artwork are independent.
- Remove P, add a second F, or type an unknown character. The decoder should explain the error while the old level remains playable.

## What this demo simplifies

JSON is readable structured text, not a binary format. A binary decoder would read bytes into the same kind of game objects; binary is not necessary here. The page editor builds a level in memory; it does not save edits to disk. Copy edited JSON somewhere to keep it.

There is no skeletal animation system, map-editor dependency, networking, or general physics engine. The player switches between six image poses, collisions are rectangles, and player movement builds momentum and slows gradually when you release a direction. The custom collision code is intended for this small static-block example, not arbitrary high-speed bodies, moving platforms, or slopes.

A real project could replace the text editor with Tiled, the small decoder with a Tiled loader, and the basic movement code with a game engine. The separation between data, art, behavior, and physics would stay useful.


## Levels, camera, and background

Choose a level above the canvas. Reaching its flag unlocks Next level. You can also select any level directly for classroom demonstrations. Restart replays the current map, and Restore selected level discards editor changes. Edits are temporary and changing levels replaces the editor contents.

map.js contains the original literal map and a makeWideMap helper that places platforms and spikes into wider grids. Add another entry to demoLevels to add a level. decoder.js accepts 12 equally sized rows of 20?200 cells. Physics receives the decoded world width rather than clamping movement to the canvas width.

scenery.js keeps the player near the center of the screen and clamps the camera to the world edges. game.js translates drawing by negative camera X. Clouds drift using elapsed seconds; hills move at fractions of the camera speed. Animate background freezes cloud drift; parallax still follows the camera. Reduced-motion preferences disable cloud drift initially.

Try standing still and observing the clouds, then walking through Meadow trail while comparing camera X with player world X. Change the 0.2 and 0.45 parallax factors in scenery.js. Changing visuals does not change the physics.

## Ramps and enemies

New map symbols: / rises to the right, \ descends to the right, and E spawns a slime enemy. Both ramp types appear in the hill near each level's start. The enemy uses a local SVG so its behavior is easy to change independently from its art.

physics.js calculates the highest ramp surface beneath the character's feet. Grounded characters follow descending ramps with a small per-step snap distance. Ramps are one-way walking surfaces: upward jumps pass through the underside. This is an intentional teaching simplification, not a complete solid-triangle collision system.

enemies.js creates patrol bodies and moves them using the same gravity and collision code, at a slower speed. Enemies reverse near their patrol boundary (60 pixels either side of spawn), walls, and ledges. Side and underside contact damage the player. Landing from above deals one damage to one enemy and bounces the player.

Experiments: change enemy.speed from 65, change the patrol range from 60, move E onto a platform, or replace a pair of blocks with / and \ and compare the collision outline.


## Sprite animation and a flying enemy

E spawns a ground slime; B spawns a type A shooting bee; C spawns a type B charging bee. All reset on restart. Stomp enemies twice from above to defeat them; other contact damages the player. The bee is kinematic: enemies.js chooses its horizontal patrol position and a sine-wave bob directly, without gravity or terrain collisions. Its path is clamped to the world boundaries. Put B in open air when editing a level.

Each enemy uses two downloaded PNG frames from Kenney's New Platformer Pack. game.js swaps slime frames at 6 frames/second and bee wing frames at 12 frames/second; it mirrors the image when patrol direction changes. The goal swaps two yellow-flag frames at 6 frames/second, including after winning. The collision rectangles do not animate; transparent sprite margins are included in these simple rectangular hitboxes.

Assets are in assets/kenney-platformer/ with their original filenames and license. Change the animation rates in game.js or the bee's speed, 80-pixel patrol radius, and 16-pixel bob in enemies.js. No external requests occur while playing.

## Flying enemy attacks

Both variants have a vision radius of 200 pixels from their center to the player center. Show collision boxes and bug vision toggles their visible vision areas; blocks and solid ramp triangles clip those areas and block detection. Type A (gold, labeled A) charges up for 0.6 seconds, then aims at the player's current position when shooting, with a 1.4-second cooldown while in range. Shots expire after 3 seconds and are blocked by terrain. Type B (pink, labeled B) locks its aim, charges up for 0.65 seconds, charges for 0.55 seconds, and recovers for 0.9 seconds. Dodge after the warning or stomp from above. Vision is blocked by terrain; bees collide with walls, ceilings, and ramps. Ground impacts stun either flying variant for one second, shown by circling stars; wall or ceiling impacts stop a charge. Restart clears shots and restores defeated enemies.

Both flying bugs pause during wind-up, with a pulsing glow, a filling ring, converging sparks, and a growing shake before releasing their attack. Their collision boxes stay fixed during the animation.

## Health

The player starts with 3 health, and all slimes and bees start with 2 health. Each landing damages one enemy and bounces the player; enemies disappear only at zero health. Enemy health bars stay visible above their bodies. Contact with enemies, shots, or spikes deals one player damage, followed by one second of flashing invulnerability. Shots disappear on contact. The health counter shows remaining player health. Zero health or falling out of the world restarts the level; restarting or switching levels restores everyone to full health.

Stomps pop the player vertically upward while preserving horizontal speed and normal air steering. Taking damage knocks the player up and away from the enemy, shot, or spike for 0.28 seconds. Movement input resumes after that recoil; terrain collisions still apply. Invulnerable contacts do not trigger another knockback.

## Player momentum

Hold left or right to accelerate from rest to a 320-pixel/second sprint in about 0.76 seconds on the ground. Releasing slows the player with ground friction; reversing brakes before accelerating the other way. In the air, weaker steering and friction preserve momentum. Walls stop horizontal momentum, and stomps preserve horizontal momentum while damage applies knockback. Tune sprintSpeed, acceleration, braking, groundFriction, airAcceleration, and airFriction in physics.js; enemy patrol speeds stay independent.
