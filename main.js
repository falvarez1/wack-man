const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const tileSize = 24;
const rows = 30;
const cols = 28;
const baseSpeed = 120; // px per second
const ghostSpeed = 105;
let lastTime = 0;
let paused = true;
let lives = 3;
let level = 1;
let gameStarted = false;

// Ghost house configuration
const ghostHouseExit = { x: 13.5, y: 11 }; // Exit point above the gate
const ghostHouseCenter = { x: 13.5, y: 14 }; // Center of ghost house

const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'W............WW............W',
  'W.WWWW.WWWWW.WW.WWWWW.WWWW.W',
  'WoWWWW.WWWWW.WW.WWWWW.WWWWoW',
  'W.WWWW.WWWWW.WW.WWWWW.WWWW.W',
  'W..........................W',
  'W.WWWW.WW.WWWWWWWW.WW.WWWW.W',
  'W......WW....WW....WW......W',
  'WWWWWW.WWWWW WW WWWWW.WWWWWW',
  '     W.WWWWW WW WWWWW.W     ',
  '     W.WW          WW.W     ',
  '     W.WW WWW--WWW WW.W     ',
  'WWWWWW.WW W      W WW.WWWWWW',
  '      .   W GGGG W   .      ',
  'WWWWWW.WW W      W WW.WWWWWW',
  '     W.WW WWWWWWWW WW.W     ',
  '     W.WW          WW.W     ',
  '     W.WW WWWWWWWW WW.W     ',
  'WWWWWW.WW WWWWWWWW WW.WWWWWW',
  'W............WW............W',
  'W.WWWW.WWWWW.WW.WWWWW.WWWW.W',
  'W.WWWW.WWWWW.WW.WWWWW.WWWW.W',
  'Wo..WW................WW..oW',
  'WWW.WW.WW.WWWWWWWW.WW.WW.WWW',
  'W......WW....WW....WW......W',
  'W.WWWWWWWWWW.WW.WWWWWWWWWW.W',
  'W..........................W',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWW'
];

const directions = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyW: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

const pellets = new Set();
const powerPellets = new Set();
const fruitTimers = [];

// Ghost scatter corners (each ghost has a preferred corner)
const scatterTargets = [
  { x: cols - 3, y: 1 },   // Pink - top right
  { x: 2, y: 1 },          // Blue - top left
  { x: cols - 3, y: rows - 2 }, // Orange - bottom right
  { x: 2, y: rows - 2 },   // Fourth ghost if added - bottom left
];

// Player starting positions - row 22 has open space
const playerStartRow = 22;

const players = [
  createPlayer(cols / 2 - 1.5, playerStartRow, '#f6d646', ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']),
  createPlayer(cols / 2 + 0.5, playerStartRow, '#6ef5c6', ['KeyW', 'KeyA', 'KeyS', 'KeyD'])
];

// Ghost AI modes
const GHOST_MODE = {
  SCATTER: 'scatter',
  CHASE: 'chase',
  FRIGHTENED: 'frightened',
  EATEN: 'eaten',
  EXITING: 'exiting'
};

const ghosts = [
  createGhost(cols / 2 - 0.5, 13, '#ff4b8b', 0), // Blinky - chases directly
  createGhost(cols / 2 - 1.5, 14, '#53a4ff', 1), // Inky - targets ahead of player
  createGhost(cols / 2 + 0.5, 14, '#ff8c42', 2), // Clyde - random/shy behavior
];

let frightenedTimer = 0;
let scatterTimer = 0;
let scatterMode = true; // Start in scatter mode
let ghostMultiplier = 1; // For consecutive ghost eating
let musicMuted = false;
let readyTimer = 0; // Ready screen timer

// Audio setup
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let musicInterval;

function createPlayer(col, row, color, keys) {
  return {
    x: col * tileSize + tileSize / 2,
    y: row * tileSize + tileSize / 2,
    dir: { x: 0, y: 0 },
    queued: { x: 0, y: 0 },
    color,
    keys,
    score: 0,
    alive: true,
    mouth: 0,
  };
}

function createGhost(col, row, color, personality) {
  return {
    x: col * tileSize + tileSize / 2,
    y: row * tileSize + tileSize / 2,
    startX: col * tileSize + tileSize / 2,
    startY: row * tileSize + tileSize / 2,
    dir: { x: 0, y: -1 }, // Start moving up
    color,
    home: { x: col, y: row },
    eaten: false,
    inHouse: true, // Track if ghost is in the house
    exitDelay: personality * 2, // Stagger ghost exits
    personality, // 0=Blinky, 1=Inky, 2=Clyde
    mode: GHOST_MODE.EXITING,
  };
}

function resetBoard() {
  pellets.clear();
  powerPellets.clear();
  fruitTimers.length = 0;

  layout.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === '.') pellets.add(`${x},${y}`);
      if (cell === 'o') powerPellets.add(`${x},${y}`);
    });
  });
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  layout.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      const px = x * tileSize;
      const py = y * tileSize;
      if (cell === 'W') {
        ctx.fillStyle = 'rgba(45, 45, 90, 0.85)';
        ctx.fillRect(px, py, tileSize, tileSize);
        ctx.strokeStyle = '#0ef3ff33';
        ctx.strokeRect(px + 4, py + 4, tileSize - 8, tileSize - 8);
      }
      // Draw ghost house gate
      if (cell === '-') {
        ctx.fillStyle = '#ff9cce';
        ctx.fillRect(px, py + tileSize / 2 - 2, tileSize, 4);
      }
    });
  });

  pellets.forEach((key) => {
    const [x, y] = key.split(',').map(Number);
    ctx.fillStyle = '#f6d646';
    ctx.beginPath();
    ctx.arc(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  powerPellets.forEach((key) => {
    const [x, y] = key.split(',').map(Number);
    ctx.fillStyle = '#6ef5c6';
    ctx.beginPath();
    const pulse = 4 + Math.sin(Date.now() / 200) * 2;
    ctx.arc(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2, pulse, 0, Math.PI * 2);
    ctx.fill();
  });

  fruitTimers.forEach((fruit) => {
    const { x, y } = fruit;
    ctx.fillStyle = '#ff5dd9';
    ctx.beginPath();
    ctx.arc(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#34d1ff';
    ctx.fillRect(x * tileSize + tileSize / 2 - 1, y * tileSize + tileSize / 2 - 8, 2, 6);
  });
}

function drawPlayers() {
  players.forEach((p) => {
    if (!p.alive) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    const angle = Math.atan2(p.dir.y, p.dir.x) || 0;
    ctx.rotate(angle);
    const mouthOpen = (Math.sin(Date.now() / 120) + 1) * 0.15;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, tileSize / 2 - 3, mouthOpen, Math.PI * 2 - mouthOpen);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  });
}

function drawGhosts() {
  ghosts.forEach((g) => {
    ctx.save();
    ctx.translate(g.x, g.y);

    // Ghost color based on state
    let ghostColor = g.color;
    if (g.eaten) {
      ghostColor = '#9ea0ff44'; // Transparent when eaten
    } else if (frightenedTimer > 0) {
      // Flash white when frightened timer is low
      if (frightenedTimer < 2 && Math.floor(Date.now() / 200) % 2) {
        ghostColor = '#ffffff';
      } else {
        ghostColor = '#2121de'; // Blue when frightened
      }
    }

    ctx.fillStyle = ghostColor;
    ctx.beginPath();
    ctx.arc(0, -4, tileSize / 2 - 4, Math.PI, Math.PI * 2);
    ctx.rect(-tileSize / 2 + 4, -4, tileSize - 8, tileSize / 2 + 6);
    ctx.fill();

    // Wavy bottom
    if (!g.eaten) {
      const waveOffset = Date.now() / 100;
      for (let i = 0; i < 3; i++) {
        const wx = -tileSize / 2 + 4 + i * ((tileSize - 8) / 3);
        const wy = tileSize / 2 + 2 + Math.sin(waveOffset + i) * 2;
        ctx.beginPath();
        ctx.arc(wx + (tileSize - 8) / 6, wy, (tileSize - 8) / 6, 0, Math.PI);
        ctx.fill();
      }
    }

    // Eyes
    if (!g.eaten || g.mode === GHOST_MODE.EATEN) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-6, -2, 5, 0, Math.PI * 2);
      ctx.arc(6, -2, 5, 0, Math.PI * 2);
      ctx.fill();

      // Pupils - look in direction of movement
      const pupilOffsetX = g.dir.x * 2;
      const pupilOffsetY = g.dir.y * 2;
      ctx.fillStyle = frightenedTimer > 0 && !g.eaten ? '#0b0b3b' : '#111';
      ctx.beginPath();
      ctx.arc(-6 + pupilOffsetX, -2 + pupilOffsetY, 2.5, 0, Math.PI * 2);
      ctx.arc(6 + pupilOffsetX, -2 + pupilOffsetY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });
}

function drawReadyScreen() {
  if (readyTimer > 0) {
    ctx.fillStyle = '#f6d646';
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('READY!', canvas.width / 2, canvas.height / 2);
  }
}

function drawLevelIndicator() {
  ctx.fillStyle = '#ff5dd9';
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`LVL ${level}`, 10, canvas.height - 10);
}

// Check if a position is inside the ghost house
function isInGhostHouse(x, y) {
  const tileX = Math.floor(x / tileSize);
  const tileY = Math.floor(y / tileSize);
  return tileY >= 12 && tileY <= 15 && tileX >= 10 && tileX <= 17;
}

// Check if tile is passable (for ghosts - can pass through gate)
function isPassable(nx, ny, isGhost = false, isExiting = false) {
  if (nx < 0) nx = cols - 1;
  if (nx >= cols) nx = 0;
  const row = layout[ny];
  if (!row) return false;
  const cell = row[nx];
  if (cell === undefined) return false;
  if (cell === 'W') return false;
  // Ghosts can pass through gate when exiting or eaten
  if (cell === '-' && isGhost && (isExiting)) return true;
  if (cell === '-' && !isGhost) return false;
  return true;
}

function isWall(nx, ny) {
  return !isPassable(nx, ny, false, false);
}

function wrapPosition(entity) {
  if (entity.x < 0) entity.x = canvas.width + entity.x;
  if (entity.x > canvas.width) entity.x = entity.x - canvas.width;
}

function tryTurn(player) {
  if (player.queued.x === 0 && player.queued.y === 0) return;
  const nx = Math.floor((player.x + player.queued.x * tileSize / 2) / tileSize);
  const ny = Math.floor((player.y + player.queued.y * tileSize / 2) / tileSize);
  if (!isWall(nx, ny)) {
    player.dir = { ...player.queued };
  }
}

function movePlayer(player, dt) {
  tryTurn(player);
  const speed = baseSpeed + (level - 1) * 5; // Slightly faster each level
  const nextX = player.x + player.dir.x * speed * dt;
  const nextY = player.y + player.dir.y * speed * dt;
  const tileX = Math.floor(nextX / tileSize);
  const tileY = Math.floor(nextY / tileSize);
  if (!isWall(tileX, tileY)) {
    player.x = nextX;
    player.y = nextY;
  } else {
    player.dir = { x: 0, y: 0 };
  }
  wrapPosition(player);
  eatPellet(player);
  eatFruit(player);
}

function getGhostTarget(ghost, players) {
  const personality = ghost.personality;
  const target = players.reduce((best, p) => {
    if (!p.alive) return best;
    const dist = Math.hypot(p.x - ghost.x, p.y - ghost.y);
    if (!best || dist < best.dist) return { dist, p };
    return best;
  }, null)?.p;

  if (!target) return null;

  switch (personality) {
    case 0: // Blinky - direct chase
      return { x: target.x, y: target.y };
    case 1: // Inky - target 4 tiles ahead of player
      return {
        x: target.x + target.dir.x * tileSize * 4,
        y: target.y + target.dir.y * tileSize * 4
      };
    case 2: // Clyde - chase when far, scatter when close
      const distToPlayer = Math.hypot(target.x - ghost.x, target.y - ghost.y);
      if (distToPlayer < tileSize * 8) {
        return scatterTargets[ghost.personality];
      }
      return { x: target.x, y: target.y };
    default:
      return { x: target.x, y: target.y };
  }
}

function moveGhost(ghost, dt) {
  // Handle exit delay for staggered ghost exits
  if (ghost.exitDelay > 0) {
    ghost.exitDelay -= dt;
    // Bounce up and down while waiting
    ghost.y = ghost.startY + Math.sin(Date.now() / 200) * 3;
    return;
  }

  const currentSpeed = ghost.eaten ? ghostSpeed * 2 :
                       (frightenedTimer > 0 ? ghostSpeed * 0.6 :
                        ghostSpeed + (level - 1) * 3);
  const speed = currentSpeed * dt;

  // Determine ghost mode
  if (ghost.eaten) {
    ghost.mode = GHOST_MODE.EATEN;
  } else if (ghost.inHouse) {
    ghost.mode = GHOST_MODE.EXITING;
  } else if (frightenedTimer > 0) {
    ghost.mode = GHOST_MODE.FRIGHTENED;
  } else if (scatterMode) {
    ghost.mode = GHOST_MODE.SCATTER;
  } else {
    ghost.mode = GHOST_MODE.CHASE;
  }

  let target;

  // Determine target based on mode
  switch (ghost.mode) {
    case GHOST_MODE.EATEN:
      // Return to ghost house
      target = { x: ghostHouseCenter.x * tileSize, y: ghostHouseCenter.y * tileSize };
      break;
    case GHOST_MODE.EXITING:
      // Exit the ghost house
      target = { x: ghostHouseExit.x * tileSize, y: ghostHouseExit.y * tileSize };
      break;
    case GHOST_MODE.FRIGHTENED:
      // Random movement when frightened
      target = null;
      break;
    case GHOST_MODE.SCATTER:
      // Go to corner
      target = {
        x: scatterTargets[ghost.personality].x * tileSize,
        y: scatterTargets[ghost.personality].y * tileSize
      };
      break;
    case GHOST_MODE.CHASE:
    default:
      // Chase player with personality-based targeting
      target = getGhostTarget(ghost, players);
      break;
  }

  const options = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ].filter((d) => !(d.x === -ghost.dir.x && d.y === -ghost.dir.y && !ghost.inHouse));

  const isExitingOrEaten = ghost.mode === GHOST_MODE.EXITING || ghost.mode === GHOST_MODE.EATEN;

  const validOptions = options.filter((d) => {
    const checkX = Math.floor((ghost.x + d.x * tileSize / 2) / tileSize);
    const checkY = Math.floor((ghost.y + d.y * tileSize / 2) / tileSize);
    return isPassable(checkX, checkY, true, isExitingOrEaten);
  });

  let bestDir;

  if (ghost.mode === GHOST_MODE.FRIGHTENED) {
    // Random movement when frightened
    bestDir = validOptions[Math.floor(Math.random() * validOptions.length)];
  } else if (target) {
    // Move towards target
    bestDir = validOptions.sort((a, b) => {
      const da = Math.hypot(target.x - (ghost.x + a.x * tileSize), target.y - (ghost.y + a.y * tileSize));
      const db = Math.hypot(target.x - (ghost.x + b.x * tileSize), target.y - (ghost.y + b.y * tileSize));
      return da - db;
    })[0];
  } else {
    bestDir = validOptions[0];
  }

  if (bestDir) ghost.dir = bestDir;

  ghost.x += ghost.dir.x * speed;
  ghost.y += ghost.dir.y * speed;
  wrapPosition(ghost);

  // Check if ghost has exited the house
  if (ghost.mode === GHOST_MODE.EXITING) {
    const exitY = ghostHouseExit.y * tileSize;
    if (ghost.y <= exitY) {
      ghost.inHouse = false;
      ghost.mode = scatterMode ? GHOST_MODE.SCATTER : GHOST_MODE.CHASE;
    }
  }

  // Check if eaten ghost has returned home
  if (ghost.mode === GHOST_MODE.EATEN) {
    const homeX = ghostHouseCenter.x * tileSize;
    const homeY = ghostHouseCenter.y * tileSize;
    if (Math.hypot(homeX - ghost.x, homeY - ghost.y) < tileSize / 2) {
      ghost.eaten = false;
      ghost.inHouse = true;
      ghost.mode = GHOST_MODE.EXITING;
    }
  }
}

function collide(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) < tileSize / 1.5;
}

function eatPellet(player) {
  const key = `${Math.floor(player.x / tileSize)},${Math.floor(player.y / tileSize)}`;
  if (pellets.delete(key)) {
    addScore(player, 10);
    playSound(620, 0.05, 0.1);
  }
  if (powerPellets.delete(key)) {
    frightenedTimer = Math.max(8 - level * 0.5, 3); // Shorter frightened time at higher levels
    ghostMultiplier = 1; // Reset multiplier
    addScore(player, 50);
    playSound(220, 0.2, 0.3);

    // Reverse ghost directions when frightened
    ghosts.forEach(g => {
      if (!g.inHouse && !g.eaten) {
        g.dir = { x: -g.dir.x, y: -g.dir.y };
      }
    });
  }
  if (pellets.size === 0 && powerPellets.size === 0) {
    nextLevel();
  }
}

function addScore(player, points) {
  player.score += points;

  // Extra life at 10000 points
  const totalScore = players[0].score + players[1].score;
  const prevScore = totalScore - points;
  if (prevScore < 10000 && totalScore >= 10000) {
    lives += 1;
    playSound(880, 0.3, 0.2);
    playSound(1100, 0.3, 0.2);
  }

  updateHud();
}

function eatFruit(player) {
  const key = `${Math.floor(player.x / tileSize)},${Math.floor(player.y / tileSize)}`;
  const idx = fruitTimers.findIndex((f) => `${f.x},${f.y}` === key);
  if (idx >= 0) {
    fruitTimers.splice(idx, 1);
    addScore(player, 100 + level * 50); // More points at higher levels
    playSound(880, 0.2, 0.2);
  }
}

function nextLevel() {
  level += 1;
  resetBoard();
  resetPositions();
  fruitTimers.length = 0;
  readyTimer = 2;
  paused = true;
  setTimeout(() => {
    paused = false;
    readyTimer = 0;
    spawnFruit();
  }, 2000);
}

function update(dt) {
  if (paused) return;
  if (readyTimer > 0) {
    readyTimer -= dt;
    return;
  }

  frightenedTimer = Math.max(0, frightenedTimer - dt);
  if (frightenedTimer === 0) {
    ghostMultiplier = 1; // Reset multiplier when frightened ends
  }

  // Toggle scatter/chase mode periodically
  scatterTimer += dt;
  const scatterDuration = Math.max(7 - level, 3);
  const chaseDuration = 20 + level * 2;
  const cycleDuration = scatterDuration + chaseDuration;
  const cyclePos = scatterTimer % cycleDuration;
  scatterMode = cyclePos < scatterDuration;

  players.forEach((p) => p.alive && movePlayer(p, dt));
  ghosts.forEach((g) => moveGhost(g, dt));
  checkCollisions();
  fruitTimers.forEach((f) => (f.time -= dt));
  for (let i = fruitTimers.length - 1; i >= 0; i -= 1) {
    if (fruitTimers[i].time <= 0) fruitTimers.splice(i, 1);
  }

  // Spawn fruit periodically
  if (Math.random() < 0.001 && fruitTimers.length < 2) {
    spawnFruit();
  }
}

function checkCollisions() {
  ghosts.forEach((g) => {
    players.forEach((p) => {
      if (!p.alive || g.eaten || g.inHouse) return;
      if (collide(g, p)) {
        if (frightenedTimer > 0) {
          g.eaten = true;
          addScore(p, 200 * ghostMultiplier);
          ghostMultiplier *= 2; // Double points for each consecutive ghost
          playSound(440, 0.2, 0.2);
          playSound(660, 0.15, 0.2);
        } else {
          loseLife();
        }
      }
    });
  });
}

function loseLife() {
  lives -= 1;
  updateHud();
  playSound(120, 0.35, 0.4);
  playSound(80, 0.4, 0.3);
  if (lives <= 0) {
    paused = true;
    showGameOver();
    return;
  }
  resetPositions();
  readyTimer = 1.5;
}

function resetPositions() {
  players[0] = { ...createPlayer(cols / 2 - 1.5, playerStartRow, '#f6d646', ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']), score: players[0].score };
  players[1] = { ...createPlayer(cols / 2 + 0.5, playerStartRow, '#6ef5c6', ['KeyW', 'KeyA', 'KeyS', 'KeyD']), score: players[1].score };
  ghosts.forEach((g, idx) => {
    const colors = ['#ff4b8b', '#53a4ff', '#ff8c42'];
    const cols2 = [cols / 2 - 0.5, cols / 2 - 1.5, cols / 2 + 0.5];
    const rows2 = [13, 14, 14];
    const fresh = createGhost(cols2[idx], rows2[idx], colors[idx], idx);
    ghosts[idx] = fresh;
  });
  frightenedTimer = 0;
  ghostMultiplier = 1;
}

function showGameOver() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ff4b8b';
  ctx.font = '24px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);

  const totalScore = players[0].score + players[1].score;
  ctx.fillStyle = '#f6d646';
  ctx.font = '14px "Press Start 2P", monospace';
  ctx.fillText(`Total: ${totalScore}`, canvas.width / 2, canvas.height / 2 + 20);

  ctx.fillStyle = '#c5d4ff';
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillText('Press Start to restart', canvas.width / 2, canvas.height / 2 + 50);
}

function spawnFruit() {
  const emptyTiles = [];
  layout.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === '.' && !isInGhostHouse(x * tileSize, y * tileSize)) {
        emptyTiles.push({ x, y });
      }
    });
  });
  if (emptyTiles.length) {
    const choice = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
    fruitTimers.push({ ...choice, time: 10 + Math.random() * 5 });
  }
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // Cap dt to prevent large jumps
  lastTime = timestamp;
  update(dt);
  drawGrid();
  drawPlayers();
  drawGhosts();
  drawReadyScreen();
  drawLevelIndicator();
  requestAnimationFrame(loop);
}

function updateHud() {
  document.getElementById('p1-score').textContent = players[0].score;
  document.getElementById('p2-score').textContent = players[1].score;
  document.getElementById('lives').textContent = lives;
}

// Audio helpers
function playSound(frequency, duration = 0.1, gain = 0.15) {
  if (musicMuted) return;
  try {
    const now = audioCtx.currentTime;
    const oscillator = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = 'triangle';
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(g).connect(audioCtx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
  } catch (e) {
    // Audio context may not be available
  }
}

function playMusic() {
  if (musicMuted) return;
  const melody = [440, 523, 659, 523, 392, 330, 392, 523];
  let idx = 0;
  clearInterval(musicInterval);
  musicInterval = setInterval(() => {
    if (musicMuted || paused) return;
    playSound(melody[idx % melody.length], 0.2, 0.05);
    idx += 1;
  }, 280);
}

// Input
window.addEventListener('keydown', (e) => {
  const dir = directions[e.code];
  if (!dir) return;

  players.forEach((p) => {
    if (p.keys.includes(e.code)) {
      e.preventDefault();
      p.queued = { ...dir };
      if (paused && gameStarted) {
        paused = false;
        if (readyTimer <= 0) readyTimer = 0;
      }
      if (!gameStarted) {
        startGame();
      }
    }
  });
});

// Prevent arrow key scrolling
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
});

function startGame() {
  gameStarted = true;
  readyTimer = 2;
  setTimeout(() => {
    paused = false;
    readyTimer = 0;
  }, 2000);
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (!musicMuted) playMusic();
}

document.getElementById('start').addEventListener('click', () => {
  if (lives <= 0) {
    lives = 3;
    level = 1;
    players[0].score = 0;
    players[1].score = 0;
    scatterTimer = 0;
    resetBoard();
    resetPositions();
    updateHud();
  }
  if (!gameStarted) {
    startGame();
  } else {
    paused = false;
  }
});

document.getElementById('mute').addEventListener('click', () => {
  musicMuted = !musicMuted;
  document.getElementById('mute').textContent = musicMuted ? 'Unmute' : 'Mute';
  if (musicMuted) {
    clearInterval(musicInterval);
  } else {
    playMusic();
  }
});

resetBoard();
updateHud();
requestAnimationFrame(loop);
