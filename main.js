const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ==================== CONFIGURATION ====================
const tileSize = 24;
const rows = 30;
const cols = 28;
const baseSpeed = 125;
const ghostSpeed = 110;
const playerRadius = tileSize / 2 - 3; // Visual radius of player
const collisionPadding = 2; // Extra padding to prevent wall clipping

// ==================== GAME STATE MACHINE ====================
const GAME_STATE = {
  IDLE: 'idle',           // Waiting for player to start
  READY: 'ready',         // "READY!" countdown
  PLAYING: 'playing',     // Active gameplay
  PAUSED: 'paused',       // Game paused
  DYING: 'dying',         // Death animation playing
  GAMEOVER: 'gameover'    // Game over screen
};

let gameState = GAME_STATE.IDLE;
let stateTimer = 0; // Timer for state transitions

// ==================== GAME STATE ====================
let lastTime = 0;
let lives = 3;
let level = 1;
let highScore = parseInt(localStorage.getItem('wackman-highscore')) || 0;
let comboTimer = 0;
let comboCount = 0;
let screenShake = 0;
let screenFlash = 0;
let totalPellets = 0;

// State transition helper
function setState(newState, timer = 0) {
  gameState = newState;
  stateTimer = timer;
}

function isPlaying() {
  return gameState === GAME_STATE.PLAYING;
}

function isPaused() {
  return gameState === GAME_STATE.PAUSED;
}

function isIdle() {
  return gameState === GAME_STATE.IDLE;
}

function isGameOver() {
  return gameState === GAME_STATE.GAMEOVER;
}

// Get the active players based on game mode
function getActivePlayers() {
  return singlePlayerMode ? [players[0]] : players;
}

// Check if a player index is active
function isPlayerActive(index) {
  return index === 0 || !singlePlayerMode;
}

// Ghost house configuration
const ghostHouseExit = { x: 13, y: 11 };
const ghostHouseCenter = { x: 13, y: 14 };

// ==================== STATIC MAZE CACHE ====================
// Pre-rendered canvas for static maze elements (walls)
let mazeCache = null;
let mazeCacheCtx = null;

function initMazeCache() {
  mazeCache = document.createElement('canvas');
  mazeCache.width = canvas.width;
  mazeCache.height = canvas.height;
  mazeCacheCtx = mazeCache.getContext('2d');
  renderMazeToCache();
}

function renderMazeToCache() {
  if (!mazeCacheCtx) return;

  // Clear the cache
  mazeCacheCtx.clearRect(0, 0, mazeCache.width, mazeCache.height);

  // Draw walls to cache (without animations)
  layout.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      const px = x * tileSize;
      const py = y * tileSize;
      if (cell === 'W') {
        // Wall base
        mazeCacheCtx.fillStyle = '#1a1a3d';
        mazeCacheCtx.fillRect(px, py, tileSize, tileSize);

        // Inner glow (static)
        const gradient = mazeCacheCtx.createRadialGradient(
          px + tileSize/2, py + tileSize/2, 0,
          px + tileSize/2, py + tileSize/2, tileSize
        );
        gradient.addColorStop(0, 'rgba(30, 60, 120, 0.3)');
        gradient.addColorStop(1, 'rgba(10, 10, 30, 0)');
        mazeCacheCtx.fillStyle = gradient;
        mazeCacheCtx.fillRect(px, py, tileSize, tileSize);

        // Static border glow (use average alpha)
        mazeCacheCtx.strokeStyle = 'rgba(14, 243, 255, 0.15)';
        mazeCacheCtx.lineWidth = 1;
        mazeCacheCtx.strokeRect(px + 3, py + 3, tileSize - 6, tileSize - 6);
      }
    });
  });
}

// ==================== PARTICLE SYSTEM ====================
const particles = [];
const scorePopups = [];

function createParticle(x, y, color, type = 'pellet') {
  const count = type === 'death' ? 20 : type === 'ghost' ? 15 : 5;
  const speed = type === 'death' ? 4 : type === 'ghost' ? 3 : 2;
  const life = type === 'death' ? 1.5 : type === 'ghost' ? 1 : 0.5;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed * (0.5 + Math.random()),
      vy: Math.sin(angle) * speed * (0.5 + Math.random()),
      life,
      maxLife: life,
      color,
      size: type === 'death' ? 4 : type === 'ghost' ? 3 : 2,
      type
    });
  }
}

function createScorePopup(x, y, score, color = '#fff') {
  scorePopups.push({
    x, y,
    score,
    life: 1.2,
    color,
    vy: -2
  });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15; // gravity
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (let i = scorePopups.length - 1; i >= 0; i--) {
    const p = scorePopups[i];
    p.y += p.vy;
    p.life -= dt;
    if (p.life <= 0) scorePopups.splice(i, 1);
  }
}

function drawParticles() {
  particles.forEach(p => {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  scorePopups.forEach(p => {
    const alpha = Math.min(1, p.life * 2);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.font = 'bold 14px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`+${p.score}`, p.x, p.y);
  });
  ctx.globalAlpha = 1;
}

// ==================== LAYOUT ====================
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

// ==================== INPUT MAPPING ====================
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

// ==================== GAME OBJECTS ====================
const pellets = new Set();
const powerPellets = new Set();
const fruitTimers = [];

// Ghost scatter corners
const scatterTargets = [
  { x: cols - 3, y: 1 },
  { x: 2, y: 1 },
  { x: cols - 3, y: rows - 2 },
  { x: 2, y: rows - 2 },
];

// Fruit types with different values and colors
const fruitTypes = [
  { color: '#ff5dd9', points: 100, name: 'cherry' },
  { color: '#ff9933', points: 300, name: 'orange' },
  { color: '#00ff88', points: 500, name: 'melon' },
  { color: '#ffff00', points: 700, name: 'galaxian' },
  { color: '#00ffff', points: 1000, name: 'bell' },
];

const playerStartRow = 22;

const players = [
  createPlayer(11, playerStartRow, '#f6d646', ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']),
  createPlayer(16, playerStartRow, '#6ef5c6', ['KeyW', 'KeyA', 'KeyS', 'KeyD'])
];

// Ghost AI modes
const GHOST_MODE = {
  SCATTER: 'scatter',
  CHASE: 'chase',
  FRIGHTENED: 'frightened',
  EATEN: 'eaten',
  EXITING: 'exiting'
};

// Four ghosts with unique personalities
const ghosts = [
  createGhost(13, 14, '#ff4b8b', 0), // Blinky - direct chaser (red/pink)
  createGhost(12, 14, '#53a4ff', 1), // Inky - ambusher (blue)
  createGhost(14, 14, '#ff8c42', 2), // Clyde - random/shy (orange)
  createGhost(13, 13, '#b967ff', 3), // Pinky - targets ahead (purple)
];

let frightenedTimer = 0;
let scatterTimer = 0;
let scatterMode = true;
let ghostMultiplier = 1;
let musicMuted = false;
let sirenSpeed = 1;
let singlePlayerMode = false; // false = 2P mode, true = 1P mode

// ==================== AUDIO SYSTEM ====================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let musicInterval;
let sirenInterval;

// ==================== ENTITY CREATION ====================
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
    deathTimer: 0,
    invincible: 0,
    trail: [],
  };
}

function createGhost(col, row, color, personality) {
  return {
    x: col * tileSize + tileSize / 2,
    y: row * tileSize + tileSize / 2,
    startX: col * tileSize + tileSize / 2,
    startY: row * tileSize + tileSize / 2,
    dir: { x: 0, y: -1 },
    color,
    home: { x: col, y: row },
    eaten: false,
    inHouse: true,
    exitDelay: personality * 1.5,
    personality,
    mode: GHOST_MODE.EXITING,
    wobble: Math.random() * Math.PI * 2,
  };
}

// ==================== BOARD MANAGEMENT ====================
function resetBoard() {
  pellets.clear();
  powerPellets.clear();
  fruitTimers.length = 0;
  totalPellets = 0;

  layout.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === '.') {
        pellets.add(`${x},${y}`);
        totalPellets++;
      }
      if (cell === 'o') powerPellets.add(`${x},${y}`);
    });
  });
}

// ==================== RENDERING ====================
function drawGrid() {
  // Apply screen shake
  ctx.save();
  if (screenShake > 0) {
    const shakeX = (Math.random() - 0.5) * screenShake * 10;
    const shakeY = (Math.random() - 0.5) * screenShake * 10;
    ctx.translate(shakeX, shakeY);
  }

  ctx.clearRect(-10, -10, canvas.width + 20, canvas.height + 20);

  // Screen flash effect
  if (screenFlash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${screenFlash * 0.3})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Draw cached maze (walls) - much faster than redrawing every frame
  if (mazeCache) {
    ctx.drawImage(mazeCache, 0, 0);
  }

  // Draw animated elements that aren't cached
  // Ghost house gate (animated)
  layout.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === '-') {
        const px = x * tileSize;
        const py = y * tileSize;
        const pulse = 0.7 + Math.sin(Date.now() / 300) * 0.3;
        ctx.fillStyle = `rgba(255, 156, 206, ${pulse})`;
        ctx.fillRect(px, py + tileSize / 2 - 2, tileSize, 4);

        // Gate glow
        ctx.shadowColor = '#ff9cce';
        ctx.shadowBlur = 10;
        ctx.fillRect(px, py + tileSize / 2 - 2, tileSize, 4);
        ctx.shadowBlur = 0;
      }
    });
  });

  // Draw pellets with subtle animation
  pellets.forEach((key) => {
    const [x, y] = key.split(',').map(Number);
    const pulse = 1 + Math.sin(Date.now() / 500 + x + y) * 0.1;
    ctx.fillStyle = '#f6d646';
    ctx.shadowColor = '#f6d646';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2, 3 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // Draw power pellets with strong pulse
  powerPellets.forEach((key) => {
    const [x, y] = key.split(',').map(Number);
    const pulse = 5 + Math.sin(Date.now() / 150) * 3;
    ctx.fillStyle = '#6ef5c6';
    ctx.shadowColor = '#6ef5c6';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // Draw fruits
  fruitTimers.forEach((fruit) => {
    const { x, y, type } = fruit;
    const fruitInfo = fruitTypes[type % fruitTypes.length];
    const bounce = Math.sin(Date.now() / 200) * 2;

    ctx.fillStyle = fruitInfo.color;
    ctx.shadowColor = fruitInfo.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2 + bounce, 8, 0, Math.PI * 2);
    ctx.fill();

    // Stem
    ctx.fillStyle = '#34d1ff';
    ctx.fillRect(x * tileSize + tileSize / 2 - 1, y * tileSize + tileSize / 2 - 10 + bounce, 2, 6);
    ctx.shadowBlur = 0;
  });

  ctx.restore();
}

function drawPlayers() {
  players.forEach((p, idx) => {
    // Skip P2 in single-player mode
    if (!isPlayerActive(idx)) return;

    if (!p.alive) {
      // Death animation
      if (p.deathTimer > 0) {
        ctx.save();
        ctx.translate(p.x, p.y);
        const progress = 1 - p.deathTimer;
        const segments = 8;
        for (let i = 0; i < segments; i++) {
          const angle = (Math.PI * 2 * i) / segments;
          const dist = progress * 30;
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.deathTimer;
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 4 * p.deathTimer, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      return;
    }

    // Draw trail
    p.trail.forEach((t, i) => {
      const alpha = (i / p.trail.length) * 0.3;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(t.x, t.y, (tileSize / 2 - 3) * (i / p.trail.length), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Invincibility flash
    if (p.invincible > 0 && Math.floor(Date.now() / 100) % 2) {
      ctx.globalAlpha = 0.5;
    }

    const angle = Math.atan2(p.dir.y, p.dir.x) || 0;
    ctx.rotate(angle);

    // Glow effect
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 15;

    const mouthOpen = (Math.sin(Date.now() / 80) + 1) * 0.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, tileSize / 2 - 3, mouthOpen, Math.PI * 2 - mouthOpen);
    ctx.fillStyle = p.color;
    ctx.fill();

    // Eye
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(2, -5, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

function drawGhosts() {
  ghosts.forEach((g) => {
    ctx.save();
    ctx.translate(g.x, g.y);

    // Wobble animation
    g.wobble += 0.1;
    const wobbleX = Math.sin(g.wobble) * 1;
    ctx.translate(wobbleX, 0);

    // Ghost color based on state
    let ghostColor = g.color;
    let eyeColor = '#fff';
    let pupilColor = '#111';

    if (g.eaten) {
      ghostColor = 'rgba(158, 160, 255, 0.3)';
    } else if (frightenedTimer > 0 && !g.inHouse) {
      if (frightenedTimer < 2 && Math.floor(Date.now() / 150) % 2) {
        ghostColor = '#ffffff';
        eyeColor = '#ff0000';
      } else {
        ghostColor = '#2121de';
        pupilColor = '#ff0000';
      }
    }

    // Ghost glow
    if (!g.eaten) {
      ctx.shadowColor = ghostColor;
      ctx.shadowBlur = 12;
    }

    ctx.fillStyle = ghostColor;

    // Ghost body
    ctx.beginPath();
    ctx.arc(0, -4, tileSize / 2 - 4, Math.PI, Math.PI * 2);
    ctx.lineTo(tileSize / 2 - 4, tileSize / 2);

    // Wavy bottom
    const waveTime = Date.now() / 100;
    const waveCount = 4;
    for (let i = waveCount; i >= 0; i--) {
      const wx = (tileSize / 2 - 4) - (i * (tileSize - 8) / waveCount);
      const wy = tileSize / 2 + Math.sin(waveTime + i * 1.5) * 3;
      ctx.lineTo(wx, wy);
    }
    ctx.lineTo(-tileSize / 2 + 4, -4);
    ctx.closePath();
    ctx.fill();

    // Eyes (always visible)
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.ellipse(-5, -3, 5, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(5, -3, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils - look in direction of movement
    const pupilOffsetX = g.dir.x * 2;
    const pupilOffsetY = g.dir.y * 2;
    ctx.fillStyle = pupilColor;
    ctx.beginPath();
    ctx.arc(-5 + pupilOffsetX, -3 + pupilOffsetY, 2.5, 0, Math.PI * 2);
    ctx.arc(5 + pupilOffsetX, -3 + pupilOffsetY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Scared mouth when frightened
    if (frightenedTimer > 0 && !g.eaten && !g.inHouse) {
      ctx.strokeStyle = eyeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, 6);
      for (let i = 0; i < 5; i++) {
        ctx.lineTo(-6 + i * 3, 6 + (i % 2 === 0 ? 0 : 3));
      }
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

function drawUI() {
  // Ready screen
  if (gameState === GAME_STATE.READY) {
    ctx.fillStyle = '#f6d646';
    ctx.shadowColor = '#f6d646';
    ctx.shadowBlur = 20;
    ctx.font = '24px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('READY!', canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
  }

  // Idle screen - show instructions
  if (gameState === GAME_STATE.IDLE) {
    ctx.fillStyle = '#6ef5c6';
    ctx.shadowColor = '#6ef5c6';
    ctx.shadowBlur = 15;
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PRESS START', canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText('or press any movement key', canvas.width / 2, canvas.height / 2 + 25);
  }

  // Paused indicator
  if (gameState === GAME_STATE.PAUSED) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f6d646';
    ctx.shadowColor = '#f6d646';
    ctx.shadowBlur = 20;
    ctx.font = '24px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
  }

  // Level indicator
  ctx.fillStyle = '#ff5dd9';
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`LVL ${level}`, 10, canvas.height - 10);

  // Combo indicator
  if (comboCount > 1) {
    ctx.fillStyle = `rgba(255, 200, 50, ${Math.min(1, comboTimer)})`;
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${comboCount}x COMBO!`, canvas.width - 10, canvas.height - 10);
  }

  // Ghost multiplier when active
  if (frightenedTimer > 0 && ghostMultiplier > 1) {
    ctx.fillStyle = '#2121de';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`GHOST x${ghostMultiplier}`, canvas.width / 2, 20);
  }

  // Frightened timer bar
  if (frightenedTimer > 0) {
    const barWidth = 100;
    const barHeight = 6;
    const x = canvas.width / 2 - barWidth / 2;
    const y = 28;
    const progress = frightenedTimer / 8;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = frightenedTimer < 2 ? '#ff0000' : '#2121de';
    ctx.fillRect(x, y, barWidth * progress, barHeight);
  }

  // Draw particles and popups
  drawParticles();
}

// ==================== COLLISION & MOVEMENT ====================
function isInGhostHouse(x, y) {
  const tileX = Math.floor(x / tileSize);
  const tileY = Math.floor(y / tileSize);
  return tileY >= 12 && tileY <= 15 && tileX >= 10 && tileX <= 17;
}

function isPassable(nx, ny, isGhost = false, isExiting = false) {
  if (nx < 0) nx = cols - 1;
  if (nx >= cols) nx = 0;
  const row = layout[ny];
  if (!row) return false;
  const cell = row[nx];
  if (cell === undefined) return false;
  if (cell === 'W') return false;
  if (cell === '-' && isGhost && isExiting) return true;
  if (cell === '-' && !isGhost) return false;
  return true;
}

function isWall(nx, ny) {
  return !isPassable(nx, ny, false, false);
}

// Check if a circle at (x, y) with given radius would collide with any wall
function wouldCollideWithWall(x, y, radius) {
  // Check the four corners of the bounding box plus cardinal points
  const checkPoints = [
    { x: x - radius, y: y },           // Left
    { x: x + radius, y: y },           // Right
    { x: x, y: y - radius },           // Top
    { x: x, y: y + radius },           // Bottom
    { x: x - radius * 0.7, y: y - radius * 0.7 }, // Top-left
    { x: x + radius * 0.7, y: y - radius * 0.7 }, // Top-right
    { x: x - radius * 0.7, y: y + radius * 0.7 }, // Bottom-left
    { x: x + radius * 0.7, y: y + radius * 0.7 }, // Bottom-right
  ];

  for (const point of checkPoints) {
    const tileX = Math.floor(point.x / tileSize);
    const tileY = Math.floor(point.y / tileSize);
    if (isWall(tileX, tileY)) {
      return true;
    }
  }
  return false;
}

// Calculate the maximum distance player can move before hitting a wall
function getMaxMoveDistance(x, y, dirX, dirY, speed, radius) {
  // If not moving, no distance
  if (dirX === 0 && dirY === 0) return 0;

  // Binary search for the maximum safe distance
  let lo = 0;
  let hi = speed;
  const epsilon = 0.5;

  // First check if full movement is safe
  const fullX = x + dirX * speed;
  const fullY = y + dirY * speed;
  if (!wouldCollideWithWall(fullX, fullY, radius)) {
    return speed;
  }

  // Binary search for max safe distance
  while (hi - lo > epsilon) {
    const mid = (lo + hi) / 2;
    const testX = x + dirX * mid;
    const testY = y + dirY * mid;
    if (wouldCollideWithWall(testX, testY, radius)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return lo;
}

function wrapPosition(entity) {
  if (entity.x < 0) entity.x = canvas.width + entity.x;
  if (entity.x > canvas.width) entity.x = entity.x - canvas.width;
}

function tryTurn(player) {
  if (player.queued.x === 0 && player.queued.y === 0) return;

  // Check if the queued direction is valid from current tile
  const currentTileX = Math.floor(player.x / tileSize);
  const currentTileY = Math.floor(player.y / tileSize);
  const nextTileX = currentTileX + player.queued.x;
  const nextTileY = currentTileY + player.queued.y;

  if (!isWall(nextTileX, nextTileY)) {
    // Valid turn - change direction
    player.dir = { ...player.queued };
  }
}

function movePlayer(player, dt) {
  if (player.invincible > 0) player.invincible -= dt;

  tryTurn(player);
  const speed = baseSpeed + (level - 1) * 5;

  // Calculate tile center for snapping
  const tileCenterX = Math.floor(player.x / tileSize) * tileSize + tileSize / 2;
  const tileCenterY = Math.floor(player.y / tileSize) * tileSize + tileSize / 2;

  // Always snap to center of lane perpendicular to movement direction
  // This prevents drifting and the "wall stopping" bug
  const snapSpeed = 0.5;

  if (player.dir.x !== 0) {
    // Moving horizontally - snap Y to center
    player.y += (tileCenterY - player.y) * snapSpeed;
  }
  if (player.dir.y !== 0) {
    // Moving vertically - snap X to center
    player.x += (tileCenterX - player.x) * snapSpeed;
  }

  // Calculate next position
  const nextX = player.x + player.dir.x * speed * dt;
  const nextY = player.y + player.dir.y * speed * dt;

  // Check collision at the next tile (not using radius-based collision for movement)
  const nextTileX = Math.floor(nextX / tileSize);
  const nextTileY = Math.floor(nextY / tileSize);

  if (!isWall(nextTileX, nextTileY)) {
    // Update trail
    if (player.dir.x !== 0 || player.dir.y !== 0) {
      player.trail.push({ x: player.x, y: player.y });
      if (player.trail.length > 8) player.trail.shift();
    }
    player.x = nextX;
    player.y = nextY;
  } else {
    // Hit a wall - snap to tile center to prevent getting stuck
    if (player.dir.x !== 0) {
      // Moving horizontally, hit wall - snap X to center of current tile
      player.x = tileCenterX;
    }
    if (player.dir.y !== 0) {
      // Moving vertically, hit wall - snap Y to center of current tile
      player.y = tileCenterY;
    }
    player.dir = { x: 0, y: 0 };
  }

  wrapPosition(player);
  eatPellet(player);
  eatFruit(player);
}

function getGhostTarget(ghost, players) {
  const personality = ghost.personality;
  const alivePlayers = players.filter(p => p.alive);
  if (alivePlayers.length === 0) return null;

  // Find closest player
  const target = alivePlayers.reduce((best, p) => {
    const dist = Math.hypot(p.x - ghost.x, p.y - ghost.y);
    if (!best || dist < best.dist) return { dist, p };
    return best;
  }, null)?.p;

  if (!target) return null;

  switch (personality) {
    case 0: // Blinky - direct chase
      return { x: target.x, y: target.y };
    case 1: // Inky - ambush (target 4 tiles ahead)
      return {
        x: target.x + target.dir.x * tileSize * 4,
        y: target.y + target.dir.y * tileSize * 4
      };
    case 2: // Clyde - shy (scatter when close)
      const distToPlayer = Math.hypot(target.x - ghost.x, target.y - ghost.y);
      if (distToPlayer < tileSize * 8) {
        return scatterTargets[ghost.personality];
      }
      return { x: target.x, y: target.y };
    case 3: // Pinky - target 2 tiles ahead
      return {
        x: target.x + target.dir.x * tileSize * 2,
        y: target.y + target.dir.y * tileSize * 2
      };
    default:
      return { x: target.x, y: target.y };
  }
}

function moveGhost(ghost, dt) {
  if (ghost.exitDelay > 0) {
    ghost.exitDelay -= dt;
    ghost.y = ghost.startY + Math.sin(Date.now() / 200) * 3;
    return;
  }

  const currentSpeed = ghost.eaten ? ghostSpeed * 2.5 :
                       (frightenedTimer > 0 && !ghost.inHouse ? ghostSpeed * 0.5 :
                        ghostSpeed + (level - 1) * 4);
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

  switch (ghost.mode) {
    case GHOST_MODE.EATEN:
      // Target the gate entrance first, then the center
      const gateY = ghostHouseExit.y * tileSize + tileSize;
      if (ghost.y < gateY - tileSize / 2) {
        // Above the gate - target the gate position
        target = { x: ghostHouseExit.x * tileSize + tileSize / 2, y: gateY };
      } else {
        // At or below gate level - target center
        target = { x: ghostHouseCenter.x * tileSize + tileSize / 2, y: ghostHouseCenter.y * tileSize + tileSize / 2 };
      }
      break;
    case GHOST_MODE.EXITING:
      target = { x: ghostHouseExit.x * tileSize + tileSize / 2, y: ghostHouseExit.y * tileSize + tileSize / 2 };
      break;
    case GHOST_MODE.FRIGHTENED:
      target = null;
      break;
    case GHOST_MODE.SCATTER:
      target = {
        x: scatterTargets[ghost.personality % 4].x * tileSize,
        y: scatterTargets[ghost.personality % 4].y * tileSize
      };
      break;
    case GHOST_MODE.CHASE:
    default:
      target = getGhostTarget(ghost, getActivePlayers());
      break;
  }

  // Calculate tile center
  const tileCenterX = Math.floor(ghost.x / tileSize) * tileSize + tileSize / 2;
  const tileCenterY = Math.floor(ghost.y / tileSize) * tileSize + tileSize / 2;
  const distToCenter = Math.hypot(ghost.x - tileCenterX, ghost.y - tileCenterY);

  // Only make direction decisions at tile centers (intersections)
  const atIntersection = distToCenter < speed * 2;

  const isExitingOrEaten = ghost.mode === GHOST_MODE.EXITING || ghost.mode === GHOST_MODE.EATEN;

  // Allow reverse direction for eaten ghosts and ghosts in house
  const canReverse = ghost.eaten || ghost.inHouse;

  if (atIntersection) {
    // Snap to center before making decision
    ghost.x = tileCenterX;
    ghost.y = tileCenterY;

    const options = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ].filter((d) => {
      // Don't allow 180 turn unless we can reverse
      if (!canReverse && d.x === -ghost.dir.x && d.y === -ghost.dir.y) {
        return false;
      }
      return true;
    });

    const currentTileX = Math.floor(ghost.x / tileSize);
    const currentTileY = Math.floor(ghost.y / tileSize);

    const validOptions = options.filter((d) => {
      const nextTileX = currentTileX + d.x;
      const nextTileY = currentTileY + d.y;
      return isPassable(nextTileX, nextTileY, true, isExitingOrEaten);
    });

    let bestDir;

    if (validOptions.length === 0) {
      // No valid options - allow any direction including reverse
      const allOptions = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];
      const fallbackOptions = allOptions.filter((d) => {
        const nextTileX = currentTileX + d.x;
        const nextTileY = currentTileY + d.y;
        return isPassable(nextTileX, nextTileY, true, isExitingOrEaten);
      });
      bestDir = fallbackOptions[0] || ghost.dir;
    } else if (ghost.mode === GHOST_MODE.FRIGHTENED) {
      bestDir = validOptions[Math.floor(Math.random() * validOptions.length)];
    } else if (target) {
      bestDir = validOptions.sort((a, b) => {
        const nextAX = (currentTileX + a.x) * tileSize + tileSize / 2;
        const nextAY = (currentTileY + a.y) * tileSize + tileSize / 2;
        const nextBX = (currentTileX + b.x) * tileSize + tileSize / 2;
        const nextBY = (currentTileY + b.y) * tileSize + tileSize / 2;
        const da = Math.hypot(target.x - nextAX, target.y - nextAY);
        const db = Math.hypot(target.x - nextBX, target.y - nextBY);
        return da - db;
      })[0];
    } else {
      bestDir = validOptions[0];
    }

    if (bestDir) ghost.dir = bestDir;
  }

  // Continue moving in current direction
  const nextX = ghost.x + ghost.dir.x * speed;
  const nextY = ghost.y + ghost.dir.y * speed;

  // Check if we can continue in current direction
  const nextTileX = Math.floor(nextX / tileSize);
  const nextTileY = Math.floor(nextY / tileSize);

  if (isPassable(nextTileX, nextTileY, true, isExitingOrEaten)) {
    ghost.x = nextX;
    ghost.y = nextY;
  } else {
    // Hit a wall - snap to center and try to find new direction
    ghost.x = tileCenterX;
    ghost.y = tileCenterY;
  }

  wrapPosition(ghost);

  if (ghost.mode === GHOST_MODE.EXITING) {
    const exitY = ghostHouseExit.y * tileSize;
    if (ghost.y <= exitY) {
      ghost.inHouse = false;
      ghost.mode = scatterMode ? GHOST_MODE.SCATTER : GHOST_MODE.CHASE;
    }
  }

  if (ghost.mode === GHOST_MODE.EATEN) {
    const homeX = ghostHouseCenter.x * tileSize + tileSize / 2;
    const homeY = ghostHouseCenter.y * tileSize + tileSize / 2;
    // Check if ghost has reached the ghost house area (more generous check)
    if (ghost.y >= ghostHouseCenter.y * tileSize && Math.abs(ghost.x - homeX) < tileSize) {
      ghost.eaten = false;
      ghost.inHouse = true;
      ghost.mode = GHOST_MODE.EXITING;
      ghost.exitDelay = 0.5;
      // Reset position to center
      ghost.x = homeX;
      ghost.y = homeY;
    }
  }
}

function collide(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) < tileSize / 1.5;
}

// ==================== GAME LOGIC ====================
function eatPellet(player) {
  const key = `${Math.floor(player.x / tileSize)},${Math.floor(player.y / tileSize)}`;

  if (pellets.delete(key)) {
    // Combo system
    comboTimer = 0.5;
    comboCount++;
    const comboBonus = Math.min(comboCount, 10);
    const points = 10 + comboBonus;

    addScore(player, points);
    createParticle(player.x, player.y, '#f6d646', 'pellet');
    playSound(520 + comboCount * 20, 0.04, 0.08);

    // Update siren speed based on remaining pellets
    sirenSpeed = 1 + (1 - pellets.size / totalPellets) * 0.5;
  }

  if (powerPellets.delete(key)) {
    frightenedTimer = Math.max(8 - level * 0.5, 4);
    ghostMultiplier = 1;
    addScore(player, 50);
    createParticle(player.x, player.y, '#6ef5c6', 'ghost');
    playSound(150, 0.3, 0.25);
    screenFlash = 0.5;

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

  const totalScore = players[0].score + players[1].score;
  const prevScore = totalScore - points;

  // Extra life at 10000 first, then every 50000 after (10k, 60k, 110k, 160k...)
  const getExtraLivesForScore = (score) => {
    if (score < 10000) return 0;
    return 1 + Math.floor((score - 10000) / 50000);
  };

  const prevLives = getExtraLivesForScore(prevScore);
  const newLives = getExtraLivesForScore(totalScore);

  if (newLives > prevLives) {
    lives += (newLives - prevLives);
    playSound(880, 0.3, 0.2);
    playSound(1100, 0.2, 0.2);
    playSound(1320, 0.2, 0.2);
    screenFlash = 0.3;
  }

  // Update high score
  if (totalScore > highScore) {
    highScore = totalScore;
    localStorage.setItem('wackman-highscore', highScore);
  }

  updateHud();
}

function eatFruit(player) {
  const key = `${Math.floor(player.x / tileSize)},${Math.floor(player.y / tileSize)}`;
  const idx = fruitTimers.findIndex((f) => `${f.x},${f.y}` === key);
  if (idx >= 0) {
    const fruit = fruitTimers[idx];
    const fruitInfo = fruitTypes[fruit.type % fruitTypes.length];
    fruitTimers.splice(idx, 1);

    const points = fruitInfo.points + level * 100;
    addScore(player, points);
    createParticle(player.x, player.y, fruitInfo.color, 'ghost');
    createScorePopup(player.x, player.y - 20, points, fruitInfo.color);
    playSound(880, 0.15, 0.2);
    playSound(1100, 0.15, 0.15);
  }
}

function nextLevel() {
  level += 1;
  resetBoard();
  resetPositions();
  fruitTimers.length = 0;
  particles.length = 0;
  scorePopups.length = 0;
  screenFlash = 1;

  playSound(440, 0.2, 0.15);
  playSound(550, 0.2, 0.15);
  playSound(660, 0.2, 0.15);
  playSound(880, 0.3, 0.2);

  // Transition to READY state with 2.5 second timer
  setState(GAME_STATE.READY, 2.5);
}

function update(dt) {
  // Update screen effects
  screenShake = Math.max(0, screenShake - dt * 5);
  screenFlash = Math.max(0, screenFlash - dt * 3);

  // Update combo timer
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) comboCount = 0;
  }

  updateParticles(dt);

  // Update death animations
  getActivePlayers().forEach(p => {
    if (!p.alive && p.deathTimer > 0) {
      p.deathTimer -= dt;
    }
  });

  // Handle state machine
  switch (gameState) {
    case GAME_STATE.IDLE:
    case GAME_STATE.PAUSED:
    case GAME_STATE.GAMEOVER:
      return;

    case GAME_STATE.READY:
      stateTimer -= dt;
      if (stateTimer <= 0) {
        setState(GAME_STATE.PLAYING);
        spawnFruit();
      }
      return;

    case GAME_STATE.DYING:
      stateTimer -= dt;
      if (stateTimer <= 0) {
        if (lives <= 0) {
          setState(GAME_STATE.GAMEOVER);
          showGameOver();
        } else {
          resetPositions();
          setState(GAME_STATE.READY, 1.5);
        }
      }
      return;

    case GAME_STATE.PLAYING:
      // Continue with normal gameplay below
      break;
  }

  frightenedTimer = Math.max(0, frightenedTimer - dt);
  if (frightenedTimer === 0) {
    ghostMultiplier = 1;
  }

  // Toggle scatter/chase mode
  scatterTimer += dt;
  const scatterDuration = Math.max(7 - level, 3);
  const chaseDuration = 20 + level * 3;
  const cycleDuration = scatterDuration + chaseDuration;
  const cyclePos = scatterTimer % cycleDuration;
  scatterMode = cyclePos < scatterDuration;

  getActivePlayers().forEach((p) => p.alive && movePlayer(p, dt));
  ghosts.forEach((g) => moveGhost(g, dt));
  checkCollisions();

  // Update fruit timers
  fruitTimers.forEach((f) => (f.time -= dt));
  for (let i = fruitTimers.length - 1; i >= 0; i -= 1) {
    if (fruitTimers[i].time <= 0) fruitTimers.splice(i, 1);
  }

  // Spawn fruit
  if (Math.random() < 0.002 && fruitTimers.length < 2) {
    spawnFruit();
  }
}

function checkCollisions() {
  const activePlayers = getActivePlayers();
  ghosts.forEach((g) => {
    activePlayers.forEach((p) => {
      if (!p.alive || g.eaten || g.inHouse || p.invincible > 0) return;
      if (collide(g, p)) {
        if (frightenedTimer > 0) {
          g.eaten = true;
          const points = 200 * ghostMultiplier;
          addScore(p, points);
          createParticle(g.x, g.y, g.color, 'ghost');
          createScorePopup(g.x, g.y - 20, points, '#fff');
          ghostMultiplier *= 2;
          playSound(440, 0.15, 0.2);
          playSound(660, 0.1, 0.15);
          playSound(880, 0.1, 0.1);
        } else {
          loseLife(p);
        }
      }
    });
  });
}

function loseLife(deadPlayer) {
  lives -= 1;
  updateHud();
  screenShake = 1;

  // Death effects
  deadPlayer.alive = false;
  deadPlayer.deathTimer = 1;
  createParticle(deadPlayer.x, deadPlayer.y, deadPlayer.color, 'death');

  playSound(200, 0.3, 0.3);
  playSound(150, 0.3, 0.25);
  playSound(100, 0.4, 0.2);

  // Transition to DYING state - the state machine will handle
  // transitioning to GAMEOVER or READY after the timer expires
  setState(GAME_STATE.DYING, 1.5);
}

function resetPositions() {
  // In single-player mode, P1 starts in the center; in 2P mode, players are offset
  const p1Col = singlePlayerMode ? 13 : 11;
  const p2Col = 16;

  players[0] = { ...createPlayer(p1Col, playerStartRow, '#f6d646', ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']), score: players[0].score };
  players[1] = { ...createPlayer(p2Col, playerStartRow, '#6ef5c6', ['KeyW', 'KeyA', 'KeyS', 'KeyD']), score: players[1].score };

  // Only set invincibility for active players
  getActivePlayers().forEach(p => p.invincible = 2);

  ghosts.forEach((g, idx) => {
    const colors = ['#ff4b8b', '#53a4ff', '#ff8c42', '#b967ff'];
    const ghostCols = [13, 12, 14, 13];
    const ghostRows = [14, 14, 14, 13];
    const fresh = createGhost(ghostCols[idx], ghostRows[idx], colors[idx], idx);
    ghosts[idx] = fresh;
  });
  frightenedTimer = 0;
  ghostMultiplier = 1;
  comboCount = 0;
}

function showGameOver() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ff4b8b';
  ctx.shadowColor = '#ff4b8b';
  ctx.shadowBlur = 30;
  ctx.font = '28px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);

  const totalScore = players[0].score + players[1].score;
  ctx.fillStyle = '#f6d646';
  ctx.shadowColor = '#f6d646';
  ctx.font = '16px "Press Start 2P", monospace';
  ctx.fillText(`SCORE: ${totalScore}`, canvas.width / 2, canvas.height / 2 + 10);

  ctx.fillStyle = '#6ef5c6';
  ctx.shadowColor = '#6ef5c6';
  ctx.font = '12px "Press Start 2P", monospace';
  ctx.fillText(`HIGH SCORE: ${highScore}`, canvas.width / 2, canvas.height / 2 + 40);

  ctx.fillStyle = '#c5d4ff';
  ctx.shadowBlur = 0;
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillText('Press Start to play again', canvas.width / 2, canvas.height / 2 + 80);
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
    const fruitType = Math.min(level - 1, fruitTypes.length - 1);
    fruitTimers.push({ ...choice, time: 8 + Math.random() * 4, type: fruitType });
  }
}

// ==================== GAME LOOP ====================
function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  update(dt);
  drawGrid();
  drawPlayers();
  drawGhosts();
  drawUI();

  requestAnimationFrame(loop);
}

function updateHud() {
  document.getElementById('p1-score').textContent = players[0].score;
  document.getElementById('p2-score').textContent = players[1].score;
  document.getElementById('lives').textContent = lives;

  // Update high score display if it exists
  const highScoreEl = document.getElementById('high-score');
  if (highScoreEl) highScoreEl.textContent = highScore;
}

// ==================== AUDIO ====================
function playSound(frequency, duration = 0.1, gain = 0.15) {
  if (musicMuted) return;
  try {
    const now = audioCtx.currentTime;
    const oscillator = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = 'square';
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(g).connect(audioCtx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
  } catch (e) {}
}

function playMusic() {
  if (musicMuted) return;
  const melody = [392, 440, 494, 523, 494, 440, 392, 330];
  let idx = 0;
  clearInterval(musicInterval);
  musicInterval = setInterval(() => {
    if (musicMuted || gameState !== GAME_STATE.PLAYING) return;
    playSound(melody[idx % melody.length], 0.15, 0.04);
    idx += 1;
  }, 250);
}

function playSiren() {
  if (musicMuted) return;
  clearInterval(sirenInterval);
  sirenInterval = setInterval(() => {
    if (musicMuted || gameState !== GAME_STATE.PLAYING || frightenedTimer > 0) return;
    const freq = 100 + Math.sin(Date.now() / (500 / sirenSpeed)) * 50;
    playSound(freq, 0.1, 0.02);
  }, 150);
}

// ==================== INPUT HANDLING ====================
window.addEventListener('keydown', (e) => {
  const dir = directions[e.code];
  if (!dir) return;

  players.forEach((p, idx) => {
    // In single-player mode, both arrow keys and WASD control P1
    const isP1Key = players[0].keys.includes(e.code);
    const isP2Key = players[1].keys.includes(e.code);
    const shouldControl = p.keys.includes(e.code) ||
      (singlePlayerMode && idx === 0 && isP2Key);

    if (shouldControl && isPlayerActive(idx)) {
      e.preventDefault();
      p.queued = { ...dir };

      // Handle state transitions based on input
      if (gameState === GAME_STATE.IDLE) {
        startGame();
      } else if (gameState === GAME_STATE.PAUSED && lives > 0) {
        setState(GAME_STATE.PLAYING);
      }
    }
  });
});

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }

  // Toggle pause with Escape key
  if (e.code === 'Escape' && gameState === GAME_STATE.PLAYING) {
    setState(GAME_STATE.PAUSED);
    updatePauseButton();
  } else if (e.code === 'Escape' && gameState === GAME_STATE.PAUSED) {
    setState(GAME_STATE.PLAYING);
    updatePauseButton();
  }
});

// ==================== TOUCH CONTROLS ====================
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  e.preventDefault();

  if (gameState === GAME_STATE.IDLE) {
    startGame();
  } else if (gameState === GAME_STATE.PAUSED && lives > 0) {
    setState(GAME_STATE.PLAYING);
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;

  const dx = touchEndX - touchStartX;
  const dy = touchEndY - touchStartY;

  const minSwipe = 30;

  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minSwipe) {
    // Horizontal swipe
    players[0].queued = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
  } else if (Math.abs(dy) > minSwipe) {
    // Vertical swipe
    players[0].queued = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
  }

  e.preventDefault();
}, { passive: false });

// ==================== GAME INITIALIZATION ====================
function startGame() {
  // Start game with READY state and 2.5 second countdown
  setState(GAME_STATE.READY, 2.5);

  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (!musicMuted) {
    playMusic();
    playSiren();
  }
}

function resetGame() {
  lives = 3;
  level = 1;
  players[0].score = 0;
  players[1].score = 0;
  scatterTimer = 0;
  comboCount = 0;
  frightenedTimer = 0;
  ghostMultiplier = 1;
  resetBoard();
  resetPositions();
  updateHud();
  setState(GAME_STATE.IDLE);
}

document.getElementById('start').addEventListener('click', () => {
  if (gameState === GAME_STATE.GAMEOVER || lives <= 0) {
    resetGame();
    startGame();
  } else if (gameState === GAME_STATE.IDLE) {
    startGame();
  } else if (gameState === GAME_STATE.PAUSED) {
    setState(GAME_STATE.PLAYING);
  }
});

document.getElementById('mute').addEventListener('click', () => {
  musicMuted = !musicMuted;
  document.getElementById('mute').textContent = musicMuted ? '🔇' : '🔊';
  if (musicMuted) {
    clearInterval(musicInterval);
    clearInterval(sirenInterval);
  } else {
    playMusic();
    playSiren();
  }
});

// Pause button handler
document.getElementById('pause').addEventListener('click', () => {
  const pauseBtn = document.getElementById('pause');

  if (gameState === GAME_STATE.PLAYING) {
    setState(GAME_STATE.PAUSED);
    pauseBtn.textContent = '▶';
    pauseBtn.classList.add('is-paused');
  } else if (gameState === GAME_STATE.PAUSED) {
    setState(GAME_STATE.PLAYING);
    pauseBtn.textContent = '⏸';
    pauseBtn.classList.remove('is-paused');
  }
});

// Update pause button when state changes via keyboard
function updatePauseButton() {
  const pauseBtn = document.getElementById('pause');
  if (gameState === GAME_STATE.PAUSED) {
    pauseBtn.textContent = '▶';
    pauseBtn.classList.add('is-paused');
  } else {
    pauseBtn.textContent = '⏸';
    pauseBtn.classList.remove('is-paused');
  }
}

// Mode toggle button handler
document.getElementById('mode').addEventListener('click', () => {
  // Only allow mode change when not actively playing
  if (gameState !== GAME_STATE.IDLE && gameState !== GAME_STATE.GAMEOVER) {
    return;
  }

  singlePlayerMode = !singlePlayerMode;
  const modeBtn = document.getElementById('mode');
  modeBtn.textContent = singlePlayerMode ? '1P' : '2P';
  modeBtn.classList.toggle('single-player', singlePlayerMode);

  // Update P2 visibility in HUD
  updateModeDisplay();

  // Reset positions for the new mode
  if (gameState === GAME_STATE.IDLE) {
    resetPositions();
  }
});

function updateModeDisplay() {
  // Hide/show P2 controls info
  const p2ControlGroup = document.querySelector('.control-group:nth-child(2)');
  if (p2ControlGroup) {
    p2ControlGroup.style.display = singlePlayerMode ? 'none' : 'flex';
  }

  // Hide/show P2 score box
  const p2StatBox = document.querySelector('.stat-box:nth-child(2)');
  if (p2StatBox) {
    p2StatBox.style.display = singlePlayerMode ? 'none' : 'flex';
  }
}

// Initialize
initMazeCache();
resetBoard();
updateHud();
updateModeDisplay();
requestAnimationFrame(loop);
