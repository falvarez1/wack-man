const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ==================== GAME CONFIGURATION ====================
// Board dimensions
const tileSize = 24;
const rows = 30;
const cols = 28;

// Speed configuration
const baseSpeed = 125;
const ghostSpeed = 110;
const SPEED_INCREASE_PER_LEVEL = 5;
const GHOST_SPEED_INCREASE_PER_LEVEL = 4;
const GHOST_EATEN_SPEED_MULTIPLIER = 2.5;
const GHOST_FRIGHTENED_SPEED_MULTIPLIER = 0.5;

// Player configuration
const playerRadius = tileSize / 2 - 3;
const collisionPadding = 2;
const COLLISION_RADIUS_FACTOR = 1.5;
const PLAYER_INVINCIBILITY_DURATION = 2;
const PLAYER_TRAIL_LENGTH = 8;

// Scoring configuration
const PELLET_BASE_SCORE = 10;
const POWER_PELLET_SCORE = 50;
const GHOST_BASE_SCORE = 200;
const MAX_COMBO_MULTIPLIER = 10;
const COMBO_TIMER_DURATION = 0.5;
const COMBO_TOAST_THRESHOLDS = [5, 10, 15, 20];
const EXTRA_LIFE_FIRST_THRESHOLD = 10000;
const EXTRA_LIFE_RECURRING_INTERVAL = 50000;

// Frightened mode configuration
const FRIGHTENED_BASE_DURATION = 8;
const FRIGHTENED_DURATION_DECREASE_PER_LEVEL = 0.5;
const FRIGHTENED_MIN_DURATION = 4;
const FRIGHTENED_WARNING_TIME = 2;

// Scatter/Chase mode timing
const SCATTER_BASE_DURATION = 7;
const SCATTER_MIN_DURATION = 3;
const CHASE_BASE_DURATION = 20;
const CHASE_DURATION_INCREASE_PER_LEVEL = 3;
const LEVEL_COMPLETE_DURATION = 3;

// State transition timers
const READY_STATE_DURATION = 2.5;
const DYING_STATE_DURATION = 1.5;
const DEATH_ANIMATION_DURATION = 1;

// Visual effects
const SCREEN_SHAKE_DECAY_RATE = 5;
const SCREEN_FLASH_DECAY_RATE = 3;
const CRT_SCANLINE_SPACING = 3;
const RETRO_PULSE_DECAY_RATE = 0.8;
const CHROMA_DECAY_RATE = 0.9;
const RETRO_SWEEP_SPEED = 140;
const SCORE_SHAKE_SCALE = 0.002;
const NEAR_MISS_DISTANCE = tileSize * 1.2;
const CLOSE_CALL_COOLDOWN = 1.25;
const RESPAWN_BEAM_DURATION = 1.4;
const RESPAWN_BEAM_SEGMENTS = 8;
const RESPAWN_BEAM_SWAY = 16;
const RESPAWN_BEAM_JITTER = 6;
const RESPAWN_BEAM_FOOT_LIFT = 14;
const COMBO_CALLUPS = [
  { threshold: 5, text: 'AMAZING!' },
  { threshold: 10, text: 'INCREDIBLE!' },
  { threshold: 15, text: 'UNSTOPPABLE!' }
];
const LIFE_SYMBOL = 'ᗧ';

// Fruit configuration
const FRUIT_SPAWN_CHANCE = 0.002;
const FRUIT_MAX_COUNT = 2;
const FRUIT_MIN_TIME = 8;
const FRUIT_MAX_TIME = 12;
const FRUIT_BONUS_PER_LEVEL = 100;

// Ghost AI configuration
const GHOST_INTERSECTION_TOLERANCE = 2;
const GHOST_EXIT_DELAY_MULTIPLIER = 1.5;
const GHOST_RESPAWN_GRACE = 2.5;

// Wrap position edge tolerance
const WRAP_POSITION_TOLERANCE = 0;

// Power-up configuration
const POWERUP_SPAWN_CHANCE = 0.0008;
const POWERUP_DURATION = 8;
const POWERUP_TYPES = {
  SPEED: { color: '#00ff88', name: 'Speed Boost', duration: 10 },
  FREEZE: { color: '#00d4ff', name: 'Freeze Ghosts', duration: 5 },
  SHIELD: { color: '#ff00ff', name: 'Shield', duration: 1 },
  DOUBLE: { color: '#ffaa00', name: '2x Score', duration: 15 },
  HANDS: { color: '#ffd700', name: 'WACKY HANDS!', duration: 6.5 }
};

// Accessibility presets
const COLORBLIND_GHOST_COLORS = ['#ffb000', '#648fff', '#785ef0', '#dc267f'];
const DEFAULT_GHOST_COLORS = ['#ff4b8b', '#53a4ff', '#ff8c42', '#b967ff'];
const SLOW_MODE_SPEED_MULTIPLIER = 0.65;
const DEFAULT_SWIPE_DEADZONE = 30;
const COMBO_TOAST_THRESHOLDS_DESC = [...COMBO_TOAST_THRESHOLDS].sort((a, b) => b - a);
const COMBO_CALLUPS_DESC = [...COMBO_CALLUPS].sort((a, b) => b.threshold - a.threshold);

// Frame timing configuration
const MAX_FRAME_STEP = 1 / 60; // Fixed simulation step (~16.67ms) to avoid hitch-based speed spikes
const MAX_ACCUMULATED_TIME = 0.25; // Cap to avoid spiral of death on long pauses

// Showcase messaging for attract-mode vibes
const ATTRACT_MESSAGES = [
  { title: 'NEON MAZE SHOWDOWN', subtitle: 'Swipe or press start to dive in' },
  { title: 'CHAIN THE CHAOS', subtitle: 'Keep combos alive for bigger juice' },
  { title: 'POWER-UPS DROP IN', subtitle: 'Freeze ghosts or double your score' },
  { title: '2P PARTY READY', subtitle: 'Toggle 1P/2P on the fly for couch co-op' },
];

// ==================== DIFFICULTY SYSTEM ====================
const DIFFICULTY = {
  CASUAL: {
    name: 'Casual',
    ghostSpeedMultiplier: 0.8,
    frightenedDuration: 10,
    livesStart: 5,
    scoreMultiplier: 0.8,
    ghostExitDelay: 2.0
  },
  ARCADE: {
    name: 'Arcade',
    ghostSpeedMultiplier: 1.0,
    frightenedDuration: 8,
    livesStart: 3,
    scoreMultiplier: 1.0,
    ghostExitDelay: 1.5
  },
  TURBO: {
    name: 'Turbo',
    ghostSpeedMultiplier: 1.3,
    frightenedDuration: 5,
    livesStart: 2,
    scoreMultiplier: 1.5,
    ghostExitDelay: 1.0
  }
};

// Game modes
const GAME_MODE = {
  CLASSIC: 'classic',
  TIME_ATTACK: 'time_attack',
  SURVIVAL: 'survival'
};

// ==================== GAME STATE MACHINE ====================
const GAME_STATE = {
  IDLE: 'idle',           // Waiting for player to start
  READY: 'ready',         // "READY!" countdown
  PLAYING: 'playing',     // Active gameplay
  PAUSED: 'paused',       // Game paused
  DYING: 'dying',         // Death animation playing
  LEVEL_COMPLETE: 'level_complete', // End-of-level tally
  GAMEOVER: 'gameover'    // Game over screen
};

let gameState = GAME_STATE.IDLE;
let stateTimer = 0; // Timer for state transitions

// ==================== LOCAL STORAGE HELPERS ====================
/**
 * Safely gets a value from localStorage with error handling
 * @param {string} key - The localStorage key
 * @param {*} defaultValue - Default value if retrieval fails
 * @returns {*} The stored value or default
 */
function getLocalStorage(key, defaultValue) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue;

    // Preserve strings but safely parse numbers
    if (typeof defaultValue === 'number') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : defaultValue;
    }

    return value;
  } catch (e) {
    console.warn(`Failed to read from localStorage: ${e.message}`);
    return defaultValue;
  }
}

/**
 * Safely sets a value in localStorage with error handling
 * @param {string} key - The localStorage key
 * @param {*} value - The value to store
 */
function setLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`Failed to write to localStorage: ${e.message}`);
  }
}

/**
 * Gets JSON object from localStorage
 * @param {string} key - The localStorage key
 * @param {*} defaultValue - Default value if retrieval fails
 * @returns {*} Parsed object or default
 */
function getLocalStorageJSON(key, defaultValue) {
  try {
    const value = localStorage.getItem(key);
    return value !== null ? JSON.parse(value) : defaultValue;
  } catch (e) {
    console.warn(`Failed to read JSON from localStorage: ${e.message}`);
    return defaultValue;
  }
}

/**
 * Sets JSON object in localStorage
 * @param {string} key - The localStorage key
 * @param {*} value - The value to store
 */
function setLocalStorageJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to write JSON to localStorage: ${e.message}`);
  }
}

// ==================== GAME STATE ====================
let lastTime = 0;
let accumulatedTime = 0;
let lives = 3;
let level = 1;
let highScore = getLocalStorage('wackman-highscore', 0);
let comboTimer = 0;
let comboCount = 0;
let lastComboToast = 0;
let screenShake = 0;
let screenFlash = 0;
let retroPulse = 0;
let chromaJitter = 0;
let scanlineOffset = 0;
let totalPellets = 0;
const reduceMotionQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
let reduceMotion = reduceMotionQuery ? reduceMotionQuery.matches : false;
reduceMotionQuery?.addEventListener('change', (event) => {
  reduceMotion = event.matches;
});
if (reduceMotionQuery?.addListener && !reduceMotionQuery.addEventListener) {
  reduceMotionQuery.addListener((event) => {
    reduceMotion = event.matches;
  });
}
let colorblindMode = getLocalStorage('wackman-colorblind', 'false') === 'true';
let slowModeEnabled = getLocalStorage('wackman-slowmode', 'false') === 'true';
let swipeDeadZone = Number.parseInt(getLocalStorage('wackman-swipe-deadzone', DEFAULT_SWIPE_DEADZONE), 10);
if (!Number.isFinite(swipeDeadZone) || swipeDeadZone < 10) swipeDeadZone = DEFAULT_SWIPE_DEADZONE;
let scatterScript = [];
let scatterPhaseIndex = 0;
let scatterPhaseTimer = 0;
let levelStats = {
  pellets: 0,
  ghosts: 0,
  fruit: 0,
  powerUps: 0,
  livesLost: 0,
  startedAt: Date.now(),
  duration: 0
};
let lastLevelSummary = null;
let frameTimeMs = 0;
let frameTime = 0;
const hudElement = document.querySelector('.hud');
const hudToggle = document.getElementById('hud-toggle');
const touchPad = document.getElementById('touch-pad');

/**
 * Transitions game to a new state
 * @param {string} newState - The new game state
 * @param {number} timer - Optional timer for timed states
 */
function setState(newState, timer = 0) {
  gameState = newState;
  stateTimer = timer;
  syncLayoutWithState();
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

// ==================== TOAST NOTIFICATIONS ====================
const MAX_TOASTS = 4;
const TOAST_DURATION_MS = 3400;
let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('role', 'status');
    toastContainer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function dismissToast(toast) {
  if (!toast) return;
  toast.classList.add('is-leaving');
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 420);
}

/**
 * Enqueue a toast notification with neon styling and auto-dismiss
 * @param {string} message - Text to display
 * @param {Object} [options] - Toast options
 * @param {string} [options.variant] - Visual variant (strong|ghostly)
 * @param {string} [options.accent] - Custom accent color
 * @param {number} [options.duration] - Custom duration in ms
 */
function queueToast(message, options = {}) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (options.variant) {
    toast.classList.add(`toast-${options.variant}`);
  }
  if (options.accent) {
    toast.style.setProperty('--toast-accent', options.accent);
  }
  toast.textContent = message;

  if (container.children.length >= MAX_TOASTS) {
    dismissToast(container.firstElementChild);
  }

  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('is-visible'));

  const timeout = setTimeout(() => dismissToast(toast), options.duration || TOAST_DURATION_MS);
  toast.addEventListener('click', () => {
    clearTimeout(timeout);
    dismissToast(toast);
  });
}

function setHudCollapsed(collapsed) {
  if (!hudElement) return;
  hudElement.classList.toggle('hud-collapsed', collapsed);

  if (hudToggle) {
    hudToggle.setAttribute('aria-expanded', (!collapsed).toString());
    hudToggle.setAttribute('aria-label', collapsed ? 'Show game options' : 'Hide game options');
  }
}

function syncLayoutWithState() {
  const isActive = gameState === GAME_STATE.PLAYING ||
    gameState === GAME_STATE.READY ||
    gameState === GAME_STATE.PAUSED ||
    gameState === GAME_STATE.LEVEL_COMPLETE;
  document.body.classList.toggle('game-active', isActive);
}

function buildScatterChaseScript(currentLevel) {
  if (currentLevel === 1) {
    return [
      { mode: 'scatter', duration: 7 },
      { mode: 'chase', duration: 20 },
      { mode: 'scatter', duration: 7 },
      { mode: 'chase', duration: 20 },
      { mode: 'scatter', duration: 5 },
      { mode: 'chase', duration: 20 },
      { mode: 'scatter', duration: 5 },
      { mode: 'chase', duration: Infinity }
    ];
  }

  if (currentLevel <= 4) {
    return [
      { mode: 'scatter', duration: 7 },
      { mode: 'chase', duration: 20 },
      { mode: 'scatter', duration: 7 },
      { mode: 'chase', duration: 20 },
      { mode: 'scatter', duration: 5 },
      { mode: 'chase', duration: 20 },
      { mode: 'scatter', duration: 1 },
      { mode: 'chase', duration: Infinity }
    ];
  }

  return [
    { mode: 'scatter', duration: 5 },
    { mode: 'chase', duration: 20 },
    { mode: 'scatter', duration: 5 },
    { mode: 'chase', duration: 20 },
    { mode: 'scatter', duration: 5 },
    { mode: 'chase', duration: 20 },
    { mode: 'scatter', duration: 1 },
    { mode: 'chase', duration: Infinity }
  ];
}

function resetScatterChaseCycle() {
  scatterScript = buildScatterChaseScript(level);
  scatterPhaseIndex = 0;
  scatterPhaseTimer = scatterScript[0]?.duration || Infinity;
  scatterMode = scatterScript[0]?.mode === 'scatter';
}

function advanceScatterPhase() {
  if (!scatterScript.length) return;
  if (scatterPhaseTimer === Infinity) return;

  scatterPhaseIndex = Math.min(scatterPhaseIndex + 1, scatterScript.length - 1);
  const phase = scatterScript[scatterPhaseIndex];
  scatterMode = phase.mode === 'scatter';
  scatterPhaseTimer = phase.duration;
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

// Ghost house bounds - defines the restricted area that only eaten ghosts can enter
const ghostHouseBounds = {
  minX: 11,
  maxX: 15,
  minY: 12,
  maxY: 15
};

/**
 * Checks if a tile position is inside the ghost house restricted area
 * @param {number} tileX - Tile X coordinate
 * @param {number} tileY - Tile Y coordinate
 * @returns {boolean} True if inside ghost house
 */
function isInsideGhostHouse(tileX, tileY) {
  return tileX >= ghostHouseBounds.minX &&
         tileX <= ghostHouseBounds.maxX &&
         tileY >= ghostHouseBounds.minY &&
         tileY <= ghostHouseBounds.maxY;
}

// ==================== STATIC MAZE CACHE ====================
// Pre-rendered canvas for static maze elements (walls)
let mazeCache = null;
let mazeCacheCtx = null;

function initMazeCache() {
  if (!canvas) {
    console.warn('Canvas element missing; skipping maze cache setup.');
    return;
  }
  mazeCache = document.createElement('canvas');
  mazeCache.width = canvas.width;
  mazeCache.height = canvas.height;
  mazeCacheCtx = mazeCache.getContext('2d');
  renderMazeToCache();
}

function renderMazeToCache() {
  if (!mazeCacheCtx) return;

  mazeCacheCtx.clearRect(0, 0, mazeCache.width, mazeCache.height);
  drawMazeWalls(mazeCacheCtx);
}

function drawMazeWalls(targetCtx) {
  if (!targetCtx) return;

  // Draw walls to cache (without animations)
  layout.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      const px = x * tileSize;
      const py = y * tileSize;
      if (cell === 'W') {
        // Wall base
        targetCtx.fillStyle = '#1a1a3d';
        targetCtx.fillRect(px, py, tileSize, tileSize);

        // Inner glow (static)
        const gradient = targetCtx.createRadialGradient(
          px + tileSize/2, py + tileSize/2, 0,
          px + tileSize/2, py + tileSize/2, tileSize
        );
        gradient.addColorStop(0, 'rgba(30, 60, 120, 0.3)');
        gradient.addColorStop(1, 'rgba(10, 10, 30, 0)');
        targetCtx.fillStyle = gradient;
        targetCtx.fillRect(px, py, tileSize, tileSize);

        // Static border glow (use average alpha)
        targetCtx.strokeStyle = 'rgba(14, 243, 255, 0.15)';
        targetCtx.lineWidth = 1;
        targetCtx.strokeRect(px + 3, py + 3, tileSize - 6, tileSize - 6);
      }
    });
  });
}

function ensureMazeCache() {
  if (!mazeCache || !mazeCacheCtx) {
    try {
      initMazeCache();
    } catch (e) {
      console.warn('Failed to init maze cache, drawing direct each frame', e);
      mazeCache = null;
      mazeCacheCtx = null;
    }
  }
}

// ==================== PARTICLE SYSTEM ====================
const particles = [];
const scorePopups = [];
const floatingTexts = [];
const textSpriteCache = new Map();
let pelletSprite = null;
let powerPelletSprite = null;

function getCachedTextSprite(text, size, color = '#fff', fontWeight = 'bold') {
  const key = `${fontWeight}:${size}:${color}:${text}`;
  if (textSpriteCache.has(key)) return textSpriteCache.get(key);

  const font = `${fontWeight} ${size}px "Press Start 2P", monospace`;
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const padding = 8;
  const canvasEl = document.createElement('canvas');
  canvasEl.width = Math.ceil(metrics.width + padding * 2);
  canvasEl.height = Math.ceil(size * 1.6 + padding * 2);
  const cctx = canvasEl.getContext('2d');
  cctx.font = font;
  cctx.fillStyle = color;
  cctx.textAlign = 'center';
  cctx.textBaseline = 'middle';
  cctx.fillText(text, canvasEl.width / 2, canvasEl.height / 2);
  const sprite = {
    canvas: canvasEl,
    width: canvasEl.width,
    height: canvasEl.height
  };
  textSpriteCache.set(key, sprite);
  return sprite;
}

function createDotSprite(radius, color, shadowBlur) {
  const diameter = radius * 2;
  const padding = shadowBlur * 2;
  const size = Math.ceil(diameter + padding * 2);
  const buffer = document.createElement('canvas');
  buffer.width = size;
  buffer.height = size;
  const bctx = buffer.getContext('2d');
  bctx.fillStyle = color;
  bctx.shadowColor = color;
  bctx.shadowBlur = shadowBlur;
  bctx.beginPath();
  const center = size / 2;
  bctx.arc(center, center, radius, 0, Math.PI * 2);
  bctx.fill();
  return { canvas: buffer, radius, width: size, height: size };
}

function ensurePelletSprites() {
  if (!pelletSprite) {
    pelletSprite = createDotSprite(3, '#f6d646', 4);
  }
  if (!powerPelletSprite) {
    powerPelletSprite = createDotSprite(6, '#6ef5c6', 10);
  }
}

let cachesWarmed = false;
function warmCommonCaches() {
  if (cachesWarmed) return;
  cachesWarmed = true;
  ensurePelletSprites();

  // Pre-bake frequent floating text to avoid per-frame text measurement on first use
  COMBO_CALLUPS.forEach((callup) => {
    getCachedTextSprite(callup.text, 16, '#ff5dd9');
  });
  getCachedTextSprite('READY!', 24, '#f6d646');
  getCachedTextSprite('PAUSED', 24, '#f6d646');
}

if (typeof document !== 'undefined') {
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(warmCommonCaches).catch(() => warmCommonCaches());
  } else {
    warmCommonCaches();
  }
}

function createParticle(x, y, color, type = 'pellet') {
  const count = type === 'death' ? 30 : type === 'ghost' ? 15 : 5;
  const speed = type === 'death' ? 4.5 : type === 'ghost' ? 3 : 2;
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

function createScorePopup(x, y, score, color = '#fff', size = 14) {
  const magnitudeBoost = typeof score === 'number' ? Math.min(10, Math.log10(Math.max(1, score)) * 4) : 0;
  const displayText = `${typeof score === 'number' ? '+' : ''}${score}`;
  scorePopups.push({
    x, y,
    score: displayText,
    life: 1.2,
    color,
    vy: -2,
    size: size + magnitudeBoost
  });
}

function createFloatingText(x, y, text, color = '#fff', life = 1.4) {
  floatingTexts.push({
    x, y,
    text,
    life,
    vy: -1.5,
    color,
    size: 16
  });
}

function createRespawnBeam(x, y) {
  const startY = Math.max(0, tileSize - 20); // Start the bolt slightly higher near the top of the maze
  const endY = Math.max(tileSize, y - RESPAWN_BEAM_FOOT_LIFT);
  const beamHeight = Math.max(endY - startY, canvas.height * 0.4);
  const segmentCount = RESPAWN_BEAM_SEGMENTS;
  const verticalStep = beamHeight / segmentCount;
  const segments = [];

  let currentX = x;
  let currentY = startY;
  segments.push({ x: currentX, y: currentY });

  for (let i = 0; i < segmentCount; i++) {
    currentY += verticalStep;
    const swayScale = 1 - i / segmentCount;
    currentX += (Math.random() - 0.5) * RESPAWN_BEAM_SWAY * swayScale;
    segments.push({ x: currentX, y: currentY });
  }

  respawnBeams.push({
    x,
    y,
    startY,
    endY,
    time: RESPAWN_BEAM_DURATION,
    height: beamHeight,
    segments
  });

  playLightningStrike();
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

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const t = floatingTexts[i];
    t.y += t.vy;
    t.life -= dt;
    if (t.life <= 0) floatingTexts.splice(i, 1);
  }

  for (let i = respawnBeams.length - 1; i >= 0; i--) {
    respawnBeams[i].time -= dt;
    if (respawnBeams[i].time <= 0) respawnBeams.splice(i, 1);
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
    const fontSize = Math.max(12, p.size || 14);
    const sprite = getCachedTextSprite(p.score, fontSize, p.color);
    ctx.drawImage(sprite.canvas, p.x - sprite.width / 2, p.y - sprite.height / 2);
  });

  floatingTexts.forEach(t => {
    const alpha = Math.min(1, t.life * 1.8);
    ctx.globalAlpha = alpha;
    const sprite = getCachedTextSprite(t.text, t.size, t.color);
    ctx.drawImage(sprite.canvas, t.x - sprite.width / 2, t.y - sprite.height / 2);
  });

  ctx.globalAlpha = 1;
}

function drawRespawnBeams() {
  respawnBeams.forEach(beam => {
    const progress = 1 - beam.time / RESPAWN_BEAM_DURATION;
    const alpha = Math.max(0, 1 - progress * 0.8);
    const beamHeight = beam.height || canvas.height * 0.6;
    const startY = beam.startY ?? (beam.y - beamHeight);
    const endY = beam.endY ?? (beam.y - RESPAWN_BEAM_FOOT_LIFT);
    const jitterPhase = frameTimeMs / 30;
    ctx.save();
    ctx.globalAlpha = alpha;
    const gradient = ctx.createLinearGradient(beam.x, startY, beam.x, endY + 10);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.4, 'rgba(110, 245, 198, 0.15)');
    gradient.addColorStop(0.6, 'rgba(255, 93, 217, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    // Flickering jagged bolt
    const jaggedSegments = beam.segments?.map((segment, idx) => {
      const wobble = (Math.sin(jitterPhase + idx) + (Math.random() - 0.5)) * RESPAWN_BEAM_JITTER * (1 - progress * 0.5);
      return {
        x: segment.x + wobble,
        y: segment.y
      };
    }) || [
      { x: beam.x, y: startY },
      { x: beam.x, y: endY }
    ];

    ctx.shadowColor = '#6ef5c6';
    ctx.shadowBlur = 22;
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 8 + 6 * Math.sin(progress * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(jaggedSegments[0].x, jaggedSegments[0].y);
    for (let i = 1; i < jaggedSegments.length; i++) {
      ctx.lineTo(jaggedSegments[i].x, jaggedSegments[i].y);
    }
    ctx.lineTo(beam.x, endY);
    ctx.stroke();

    // Beam core
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(jaggedSegments[0].x, jaggedSegments[0].y);
    for (let i = 1; i < jaggedSegments.length; i++) {
      ctx.lineTo(jaggedSegments[i].x, jaggedSegments[i].y);
    }
    ctx.lineTo(beam.x, endY);
    ctx.stroke();

    // Small side forks for extra energy
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(110, 245, 198, 0.7)';
    jaggedSegments.slice(1, -1).forEach((segment, idx) => {
      if (idx % 2 === 0) {
        const forkLength = 12 + Math.random() * 10;
        const forkDir = idx % 4 === 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(segment.x, segment.y);
        ctx.lineTo(segment.x + forkDir * forkLength, segment.y - forkLength * 0.6);
        ctx.stroke();
      }
    });

    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

// ==================== RETRO OVERLAY SYSTEM ====================
function triggerRetroPulse(amount = 0.6) {
  retroPulse = Math.min(1.6, retroPulse + amount);
  chromaJitter = Math.min(1, chromaJitter + amount * 0.6);
}

function updateRetroEffects(dt) {
  if (reduceMotion) {
    retroPulse = 0;
    chromaJitter = 0;
    scanlineOffset = 0;
    return;
  }
  retroPulse = Math.max(0, retroPulse - dt * RETRO_PULSE_DECAY_RATE);
  chromaJitter = Math.max(0, chromaJitter - dt * CHROMA_DECAY_RATE);
  scanlineOffset = (scanlineOffset + dt * 60) % CRT_SCANLINE_SPACING;
}

function drawRetroOverlay() {
  ctx.save();

  if (reduceMotion) {
    ctx.globalCompositeOperation = 'screen';
    const staticGlow = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, tileSize,
      canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75
    );
    staticGlow.addColorStop(0, 'rgba(110, 245, 198, 0.06)');
    staticGlow.addColorStop(1, 'rgba(3, 3, 10, 0.6)');
    ctx.fillStyle = staticGlow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    return;
  }

  const time = frameTime;
  const sweepX = ((time * RETRO_SWEEP_SPEED) % (canvas.width + 200)) - 200;

  // Neon sweep
  ctx.globalCompositeOperation = 'screen';
  const sweep = ctx.createLinearGradient(sweepX, 0, sweepX + 200, canvas.height);
  sweep.addColorStop(0, 'rgba(83, 164, 255, 0)');
  sweep.addColorStop(0.5, 'rgba(255, 75, 139, 0.12)');
  sweep.addColorStop(1, 'rgba(110, 245, 198, 0)');
  ctx.globalAlpha = 0.08 + retroPulse * 0.08;
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Soft vignette/bloom
  const vignette = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, tileSize * 4,
    canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.9
  );
  vignette.addColorStop(0, `rgba(246, 214, 70, ${0.06 + retroPulse * 0.08})`);
  vignette.addColorStop(0.35, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Scanlines
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.14 + retroPulse * 0.1;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  const offset = scanlineOffset % CRT_SCANLINE_SPACING;
  for (let y = offset; y < canvas.height; y += CRT_SCANLINE_SPACING) {
    ctx.fillRect(0, y, canvas.width, 1);
  }

  // Subtle neon gridlines
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.08 + retroPulse * 0.05;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(110, 245, 198, 0.25)';
  for (let x = 0; x <= canvas.width; x += tileSize * 2) {
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(time + x * 0.01) * 2, 0);
    ctx.lineTo(x - Math.sin(time + x * 0.01) * 2, canvas.height);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 93, 217, 0.18)';
  for (let y = 0; y <= canvas.height; y += tileSize * 2) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y + Math.cos(time + y * 0.01) * 2);
    ctx.stroke();
  }

  // Chromatic edge glow
  if (chromaJitter > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.12 + chromaJitter * 0.3;
    ctx.lineWidth = 2;

    ctx.strokeStyle = 'rgba(255, 75, 139, 0.5)';
    ctx.strokeRect(3 - chromaJitter * 2, 3, canvas.width - 6, canvas.height - 6);

    ctx.strokeStyle = 'rgba(110, 245, 198, 0.4)';
    ctx.strokeRect(3 + chromaJitter * 2, 3, canvas.width - 6, canvas.height - 6);
  }

  ctx.restore();
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

function precomputeGateSegments() {
  gateSegments.length = 0;

  for (let y = 0; y < layout.length; y++) {
    const row = layout[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '-') {
        gateSegments.push({
          x: x * tileSize,
          centerY: y * tileSize + tileSize / 2
        });
      }
    }
  }
}

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
const pelletRenderList = [];
const powerPelletRenderList = [];
const fruitTimers = [];
const gateSegments = [];

function getGhostPalette() {
  return colorblindMode ? COLORBLIND_GHOST_COLORS : DEFAULT_GHOST_COLORS;
}

function applyGhostPalette() {
  const palette = getGhostPalette();
  ghosts?.forEach((g, idx) => {
    g.color = palette[idx % palette.length];
  });
}

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
  createGhost(13, 14, getGhostPalette()[0], 0), // Blinky - direct chaser (red/pink)
  createGhost(12, 14, getGhostPalette()[1], 1), // Inky - ambusher (blue)
  createGhost(14, 14, getGhostPalette()[2], 2), // Clyde - random/shy (orange)
  createGhost(13, 13, getGhostPalette()[3], 3), // Pinky - targets ahead (purple)
];
applyGhostPalette();

let frightenedTimer = 0;
let scatterMode = true;
let ghostMultiplier = 1;
let musicMuted = false;
let sirenSpeed = 1;
let singlePlayerMode = true; // false = 2P mode, true = 1P mode
let closeCallTimers = [0, 0];
const respawnBeams = [];

// ==================== GAME SETTINGS ====================
let currentDifficulty = 'ARCADE';
let currentGameMode = GAME_MODE.CLASSIC;
let masterVolume = 0.5; // 0-1

// ==================== STATISTICS TRACKING ====================
let stats = getLocalStorageJSON('wackman-stats', {
  gamesPlayed: 0,
  totalGhostsEaten: 0,
  totalPelletsEaten: 0,
  totalDeaths: 0,
  highestLevel: 0,
  longestCombo: 0,
  totalPlayTime: 0,
  totalScore: 0,
  perfectLevels: 0,
  powerUpsCollected: 0
});

let sessionStats = {
  ghostsEaten: 0,
  pelletsEaten: 0,
  deaths: 0,
  startTime: Date.now(),
  perfectLevel: true
};

// ==================== ACHIEVEMENTS ====================
const ACHIEVEMENTS = {
  FIRST_BLOOD: { id: 'first_blood', name: 'First Blood', desc: 'Eat your first ghost', icon: '👻' },
  COMBO_MASTER: { id: 'combo_master', name: 'Combo Master', desc: 'Achieve a 20+ pellet combo', icon: '🔥' },
  CENTURION: { id: 'centurion', name: 'Centurion', desc: 'Eat 100 ghosts', icon: '💯' },
  LEVEL_10: { id: 'level_10', name: 'Expert', desc: 'Reach level 10', icon: '⭐' },
  PERFECT: { id: 'perfect', name: 'Perfection', desc: 'Complete a level without dying', icon: '✨' },
  SPEED_DEMON: { id: 'speed_demon', name: 'Speed Demon', desc: 'Collect a speed power-up', icon: '⚡' },
  UNTOUCHABLE: { id: 'untouchable', name: 'Untouchable', desc: 'Complete 3 perfect levels in a row', icon: '🛡️' },
  HIGH_ROLLER: { id: 'high_roller', name: 'High Roller', desc: 'Score 50,000 points', icon: '💎' },
  SURVIVOR: { id: 'survivor', name: 'Survivor', desc: 'Survive for 10 minutes', icon: '⏱️' },
  GHOST_HUNTER: { id: 'ghost_hunter', name: 'Ghost Hunter', desc: 'Eat 4 ghosts in one power-up', icon: '🏹' }
};

let unlockedAchievements = getLocalStorageJSON('wackman-achievements', []);

// ==================== LEADERBOARD ====================
let leaderboard = getLocalStorageJSON('wackman-leaderboard', []);

// ==================== POWER-UPS ====================
const activePowerUps = [];
const powerUpSpawns = [];
let consecutivePerfectLevels = 0;
let ghostsEatenThisPowerUp = 0;
let hasStartedOnce = false;

// ==================== AUDIO SYSTEM ====================
const MUSIC_STATE = {
  NORMAL: 'normal',
  FRIGHTENED: 'frightened',
  GAMEOVER: 'gameover'
};
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let musicInterval;
let sirenInterval;
let frightenedInterval;
let currentMusicState = null;
let lastComboSoundTime = 0;

// ==================== ENTITY CREATION ====================
/**
 * Creates a player entity
 * @param {number} col - Starting column position
 * @param {number} row - Starting row position
 * @param {string} color - Hex color code for the player
 * @param {string[]} keys - Array of key codes for controls
 * @returns {Object} Player object
 */
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
    respawnFx: 0,
  };
}

/**
 * Creates a ghost entity with AI personality
 * @param {number} col - Starting column position
 * @param {number} row - Starting row position
 * @param {string} color - Hex color code for the ghost
 * @param {number} personality - AI personality type (0-3)
 * @returns {Object} Ghost object
 */
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
    exitDelay: personality * GHOST_EXIT_DELAY_MULTIPLIER,
    personality,
    mode: GHOST_MODE.EXITING,
    wobble: Math.random() * Math.PI * 2,
    lastDecisionTile: { x: -1, y: -1 }, // Track last tile where decision was made
    respawnShield: 0,
  };
}

// ==================== BOARD MANAGEMENT ====================
/**
 * Resets the game board, recreating all pellets and power pellets
 */
function resetBoard() {
  pellets.clear();
  powerPellets.clear();
  pelletRenderList.length = 0;
  powerPelletRenderList.length = 0;
  fruitTimers.length = 0;
  totalPellets = 0;
  levelStats = {
    pellets: 0,
    ghosts: 0,
    fruit: 0,
    powerUps: 0,
    livesLost: 0,
    startedAt: Date.now(),
    duration: 0
  };

  for (let y = 0; y < layout.length; y++) {
    const row = layout[y];
    for (let x = 0; x < row.length; x++) {
      const cell = row[x];
      const key = `${x},${y}`;
      if (cell === '.') {
        pellets.add(key);
        pelletRenderList.push({
          key,
          x: x * tileSize + tileSize / 2,
          y: y * tileSize + tileSize / 2,
          phase: x + y
        });
        totalPellets++;
      } else if (cell === 'o') {
        powerPellets.add(key);
        powerPelletRenderList.push({
          key,
          x: x * tileSize + tileSize / 2,
          y: y * tileSize + tileSize / 2
        });
      }
    }
  }
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

  // Prefer cached maze walls on capable devices; fall back to direct draw if cache missing
  ensureMazeCache();
  if (mazeCache) {
    ctx.drawImage(mazeCache, 0, 0);
  } else {
    drawMazeWalls(ctx);
  }

  const nowMs = frameTimeMs;
  ensurePelletSprites();

  // Draw animated elements that aren't cached
  // Ghost house gate (animated)
  const gatePulse = 0.7 + Math.sin(nowMs / 300) * 0.3;
  gateSegments.forEach((gate) => {
    ctx.fillStyle = `rgba(255, 156, 206, ${gatePulse})`;
    ctx.fillRect(gate.x, gate.centerY - 2, tileSize, 4);

    // Gate glow
    ctx.shadowColor = '#ff9cce';
    ctx.shadowBlur = 10;
    ctx.fillRect(gate.x, gate.centerY - 2, tileSize, 4);
    ctx.shadowBlur = 0;
  });

  // Draw pellets with subtle animation
  const pelletBaseRadius = pelletSprite?.radius || 3;
  pelletRenderList.forEach((pellet) => {
    if (!pellets.has(pellet.key)) return;
    const pulse = 1 + Math.sin(nowMs / 500 + pellet.phase) * 0.1;
    if (pelletSprite) {
      const scale = (3 * pulse) / pelletBaseRadius;
      const drawW = pelletSprite.width * scale;
      const drawH = pelletSprite.height * scale;
      ctx.drawImage(
        pelletSprite.canvas,
        pellet.x - drawW / 2,
        pellet.y - drawH / 2,
        drawW,
        drawH
      );
    } else {
      ctx.fillStyle = '#f6d646';
      ctx.shadowColor = '#f6d646';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(pellet.x, pellet.y, 3 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  });

  // Draw power pellets with strong pulse
  const powerPulse = 5 + Math.sin(nowMs / 150) * 3;
  const powerBaseRadius = powerPelletSprite?.radius || 6;
  powerPelletRenderList.forEach((pellet) => {
    if (!powerPellets.has(pellet.key)) return;
    if (powerPelletSprite) {
      const scale = powerPulse / powerBaseRadius;
      const drawW = powerPelletSprite.width * scale;
      const drawH = powerPelletSprite.height * scale;
      ctx.drawImage(
        powerPelletSprite.canvas,
        pellet.x - drawW / 2,
        pellet.y - drawH / 2,
        drawW,
        drawH
      );
    } else {
      ctx.fillStyle = '#6ef5c6';
      ctx.shadowColor = '#6ef5c6';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(pellet.x, pellet.y, powerPulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  });

  // Draw fruits
  fruitTimers.forEach((fruit) => {
    const { x, y, type } = fruit;
    const fruitInfo = fruitTypes[type % fruitTypes.length];
    const bounce = Math.sin(nowMs / 200) * 2;

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

  // Draw power-ups
  powerUpSpawns.forEach((powerUp) => {
    const { x, y, type } = powerUp;
    const powerUpInfo = POWERUP_TYPES[type];
    const pulse = Math.sin(nowMs / 150) * 0.3 + 1;
    const rotation = nowMs / 500;

    ctx.save();
    ctx.translate(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2);
    ctx.rotate(rotation);

    // Draw star shape for power-up
    ctx.fillStyle = powerUpInfo.color;
    ctx.shadowColor = powerUpInfo.color;
    ctx.shadowBlur = 15 * pulse;

    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const outerRadius = 10 * pulse;
      const innerRadius = 5 * pulse;
      const outerX = Math.cos(angle) * outerRadius;
      const outerY = Math.sin(angle) * outerRadius;
      const innerAngle = angle + Math.PI / 5;
      const innerX = Math.cos(innerAngle) * innerRadius;
      const innerY = Math.sin(innerAngle) * innerRadius;

      if (i === 0) {
        ctx.moveTo(outerX, outerY);
      } else {
        ctx.lineTo(outerX, outerY);
      }
      ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  });

  ctx.restore();
}

function drawPlayers() {
  const nowMs = frameTimeMs;

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

    const angle = Math.atan2(p.dir.y, p.dir.x) || 0;
    const strikeActive = p.respawnFx > 0;
    let spriteAlpha = strikeActive ? 0.75 + 0.25 * Math.sin(nowMs / 45) : 1;

    // Shield power-up visual effect
    if (isPowerUpActive('SHIELD')) {
      const shieldPulse = Math.sin(nowMs / 100) * 0.2 + 0.8;
      ctx.strokeStyle = POWERUP_TYPES.SHIELD.color;
      ctx.shadowColor = POWERUP_TYPES.SHIELD.color;
      ctx.shadowBlur = 20 * shieldPulse;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6 * shieldPulse;
      ctx.beginPath();
      ctx.arc(0, 0, (tileSize / 2 + 8) * shieldPulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    // Invincibility flash
    if (p.invincible > 0 && Math.floor(nowMs / 100) % 2) {
      spriteAlpha *= 0.5;
    }

    // Respawn invincibility aura
    if (p.invincible > 0) {
      const auraPulse = 1 + Math.sin(nowMs / 120) * 0.15;
      ctx.save();
      ctx.rotate(-angle); // neutralize rotation for aura symmetry
      const gradient = ctx.createRadialGradient(0, 0, 8, 0, 0, 26 * auraPulse);
      gradient.addColorStop(0, `rgba(255,255,255,0.35)`);
      gradient.addColorStop(1, `${p.color}22`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, (tileSize / 2 + 10) * auraPulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (strikeActive) {
      const strobePulse = 1 + Math.sin(nowMs / 60) * 0.25;
      ctx.save();
      ctx.rotate(-angle);
      ctx.globalCompositeOperation = 'screen';
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 28 * strobePulse;
      ctx.lineWidth = 4 + 2 * strobePulse;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + 0.35 * Math.sin(nowMs / 40)})`;
      ctx.beginPath();
      ctx.arc(0, 0, (tileSize / 2 + 12) * strobePulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(nowMs / 30);
      ctx.fillStyle = `${p.color}33`;
      ctx.beginPath();
      ctx.arc(0, 0, (tileSize / 2 + 6) * strobePulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.globalAlpha = spriteAlpha;
    ctx.rotate(angle);

    // Glow effect
    ctx.shadowColor = p.color;
    ctx.shadowBlur = strikeActive ? 22 : 15;

    const mouthOpen = (Math.sin(nowMs / 80) + 1) * 0.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, tileSize / 2 - 3, mouthOpen, Math.PI * 2 - mouthOpen);
    ctx.fillStyle = p.color;
    ctx.fill();

    // Eye
    const isLeftFacing = p.dir.x < 0 && Math.abs(p.dir.x) >= Math.abs(p.dir.y);
    const eyeYOffset = isLeftFacing ? 5 : -5;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(2, eyeYOffset, 2, 0, Math.PI * 2);
    ctx.fill();

    // Wacky Hands power-up animation
    if (isPowerUpActive('HANDS')) {
      const isMoving = p.dir.x !== 0 || p.dir.y !== 0;
      const baseSpeed = Math.sqrt(p.dir.x * p.dir.x + p.dir.y * p.dir.y);
      const animSpeed = isMoving ? 120 - (baseSpeed * 20) : 150; // Faster animation when moving faster
      const handWave = Math.sin(nowMs / animSpeed) * 15; // Up/down 15px oscillation
      const handOffset = tileSize / 2 + 5;

      // Golden glow effect for hands
      ctx.shadowColor = POWERUP_TYPES.HANDS.color;
      ctx.shadowBlur = 10;

      // Left hand
      ctx.fillStyle = '#ffe4b5'; // Skin tone
      ctx.beginPath();
      ctx.ellipse(-handOffset, handWave, 8, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Left hand details (thumb)
      ctx.beginPath();
      ctx.ellipse(-handOffset - 6, handWave, 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Right hand (opposite motion for running effect)
      ctx.beginPath();
      ctx.ellipse(handOffset, -handWave, 8, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Right hand details (thumb)
      ctx.beginPath();
      ctx.ellipse(handOffset + 6, -handWave, 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Add sparkle particles occasionally
      if (Math.random() < 0.1) {
        const sparkleX = p.x + (Math.random() - 0.5) * 30;
        const sparkleY = p.y + (Math.random() - 0.5) * 30;
        createParticle(sparkleX, sparkleY, POWERUP_TYPES.HANDS.color, 'star');
      }
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

function drawGhosts() {
  const nowMs = frameTimeMs;

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

    // Freeze power-up visual
    const isFrozen = isPowerUpActive('FREEZE') && !g.eaten;

    if (g.eaten) {
      ghostColor = 'rgba(158, 160, 255, 0.3)';
    } else if (isFrozen) {
      // Frozen ghosts are icy blue
      ghostColor = POWERUP_TYPES.FREEZE.color;
      eyeColor = '#ffffff';
      pupilColor = '#00d4ff';
    } else if (frightenedTimer > 0 && !g.inHouse) {
      if (frightenedTimer < FRIGHTENED_WARNING_TIME && Math.floor(nowMs / 150) % 2) {
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
    const waveTime = nowMs / 100;
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

    // Ice crystals for frozen ghosts
    if (isFrozen) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur = 8;

      // Draw ice crystals
      for (let i = 0; i < 3; i++) {
        const crystalX = -8 + i * 8;
        const crystalY = -10 + (i % 2) * 5;
        const size = 4;

        ctx.beginPath();
        ctx.moveTo(crystalX, crystalY - size);
        ctx.lineTo(crystalX, crystalY + size);
        ctx.moveTo(crystalX - size, crystalY);
        ctx.lineTo(crystalX + size, crystalY);
        ctx.moveTo(crystalX - size * 0.7, crystalY - size * 0.7);
        ctx.lineTo(crystalX + size * 0.7, crystalY + size * 0.7);
        ctx.moveTo(crystalX - size * 0.7, crystalY + size * 0.7);
        ctx.lineTo(crystalX + size * 0.7, crystalY - size * 0.7);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    // Scared mouth when frightened
    if (frightenedTimer > 0 && !g.eaten && !g.inHouse && !isFrozen) {
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
  const nowMs = frameTimeMs;

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
    const attractIdx = Math.floor(nowMs / 4000) % ATTRACT_MESSAGES.length;
    const attract = ATTRACT_MESSAGES[attractIdx];

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#f6d646';
    ctx.shadowColor = '#f6d646';
    ctx.shadowBlur = 18;
    ctx.font = '18px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(attract.title, canvas.width / 2, canvas.height / 2 - 16);
    ctx.shadowBlur = 0;

    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#6ef5c6';
    ctx.shadowColor = '#6ef5c6';
    ctx.shadowBlur = 12;
    ctx.fillText(attract.subtitle, canvas.width / 2, canvas.height / 2 + 6);
    ctx.shadowBlur = 0;

    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press start or any movement key', canvas.width / 2, canvas.height / 2 + 30);
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

  if (gameState === GAME_STATE.LEVEL_COMPLETE && lastLevelSummary) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#6ef5c6';
    ctx.shadowColor = '#6ef5c6';
    ctx.shadowBlur = 18;
    ctx.font = '22px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${lastLevelSummary.level} CLEAR`, canvas.width / 2, canvas.height / 2 - 60);
    ctx.shadowBlur = 0;

    ctx.font = '10px "Press Start 2P", monospace';
    const lines = [
      `TIME ${lastLevelSummary.time.toFixed(1)}s`,
      `PELLETS ${lastLevelSummary.pellets}`,
      `GHOSTS ${lastLevelSummary.ghosts}`,
      `FRUIT ${lastLevelSummary.fruit}`,
      `POWER-UPS ${lastLevelSummary.powerUps}`,
      `LIVES LOST ${lastLevelSummary.livesLost}`
    ];
    lines.forEach((line, idx) => {
      ctx.fillText(line, canvas.width / 2, canvas.height / 2 - 20 + idx * 18);
    });
  }

  // Level indicator
  ctx.fillStyle = '#ff5dd9';
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`LVL ${level}`, 10, canvas.height - 10);

  // Combo indicator (text only to reduce visual clutter)
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
    ctx.fillStyle = frightenedTimer < FRIGHTENED_WARNING_TIME ? '#ff0000' : '#2121de';
    ctx.fillRect(x, y, barWidth * progress, barHeight);
  }

  // Active power-ups display
  if (activePowerUps.length > 0) {
    const powerUpY = 50;
    let powerUpX = canvas.width / 2 - (activePowerUps.length * 60) / 2;

    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';

    activePowerUps.forEach((powerUp) => {
      const powerUpInfo = POWERUP_TYPES[powerUp.type];
      const timeLeft = Math.ceil(powerUp.timeLeft);

      // Power-up icon background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(powerUpX - 25, powerUpY - 5, 50, 30);

      // Power-up name
      ctx.fillStyle = powerUpInfo.color;
      ctx.shadowColor = powerUpInfo.color;
      ctx.shadowBlur = 10;
      ctx.fillText(powerUp.type.substring(0, 3), powerUpX, powerUpY + 6);

      // Time remaining
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.fillText(`${timeLeft}s`, powerUpX, powerUpY + 18);

      powerUpX += 60;
    });
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

  // Prevent ghosts from entering the ghost house area unless they're eaten/exiting
  if (isGhost && !isExiting && isInsideGhostHouse(nx, ny)) {
    return false;
  }

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

/**
 * Wraps entity position around screen edges (tunnel effect)
 * @param {Object} entity - Entity with x, y coordinates
 */
function wrapPosition(entity) {
  if (entity.x < -WRAP_POSITION_TOLERANCE) {
    entity.x = canvas.width + entity.x;
  }
  if (entity.x >= canvas.width + WRAP_POSITION_TOLERANCE) {
    entity.x = entity.x - canvas.width;
  }
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

  // Apply SPEED power-up
  const speedMultiplier = isPowerUpActive('SPEED') ? 1.5 : 1.0;
  const slowModeMultiplier = slowModeEnabled ? SLOW_MODE_SPEED_MULTIPLIER : 1;
  const speed = (baseSpeed + (level - 1) * SPEED_INCREASE_PER_LEVEL) * speedMultiplier * slowModeMultiplier;

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
      if (player.trail.length > PLAYER_TRAIL_LENGTH) player.trail.shift();
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
  collectPowerUp(player);
}

/**
 * Calculates target position for ghost AI based on personality
 * @param {Object} ghost - The ghost entity
 * @param {Object[]} players - Array of player entities
 * @returns {Object|null} Target position with x, y coordinates or null
 */
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

  const playerTile = {
    x: Math.floor(target.x / tileSize),
    y: Math.floor(target.y / tileSize)
  };
  const blinky = ghosts[0];
  const blinkyTile = {
    x: Math.floor(blinky.x / tileSize),
    y: Math.floor(blinky.y / tileSize)
  };

  switch (personality) {
    case 0: // Blinky - direct chase
      return { x: playerTile.x * tileSize + tileSize / 2, y: playerTile.y * tileSize + tileSize / 2 };
    case 1: { // Inky - vector from Blinky to a point two tiles ahead of player
      let aheadTile = {
        x: playerTile.x + target.dir.x * 2,
        y: playerTile.y + target.dir.y * 2
      };
      if (target.dir.y === -1) {
        aheadTile = { x: aheadTile.x - 2, y: aheadTile.y - 2 };
      }
      const targetTile = {
        x: aheadTile.x + (aheadTile.x - blinkyTile.x),
        y: aheadTile.y + (aheadTile.y - blinkyTile.y)
      };
      return {
        x: targetTile.x * tileSize + tileSize / 2,
        y: targetTile.y * tileSize + tileSize / 2
      };
    }
    case 2: { // Clyde - shy (scatter when close)
      const distToPlayer = Math.hypot(target.x - ghost.x, target.y - ghost.y);
      if (distToPlayer < tileSize * 8) {
        return scatterTargets[ghost.personality];
      }
      return { x: playerTile.x * tileSize + tileSize / 2, y: playerTile.y * tileSize + tileSize / 2 };
    }
    case 3: { // Pinky - target 4 tiles ahead (with arcade overflow quirk when moving up)
      let offset = { x: target.dir.x * 4, y: target.dir.y * 4 };
      if (target.dir.y === -1) {
        offset = { x: -4, y: -4 };
      }
      const targetTile = {
        x: playerTile.x + offset.x,
        y: playerTile.y + offset.y
      };
      return {
        x: targetTile.x * tileSize + tileSize / 2,
        y: targetTile.y * tileSize + tileSize / 2
      };
    }
    default:
      return { x: playerTile.x * tileSize + tileSize / 2, y: playerTile.y * tileSize + tileSize / 2 };
  }
}

function getTileKey(x, y) {
  return `${x},${y}`;
}

function findDirectionToTarget(startTile, targetTile, allowGate = false) {
  const queue = [];
  const visited = new Set();
  const startKey = getTileKey(startTile.x, startTile.y);
  queue.push({ ...startTile, dirFromStart: null });
  visited.add(startKey);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.x === targetTile.x && current.y === targetTile.y) {
      return current.dirFromStart;
    }

    const neighbors = [
      { x: current.x + 1, y: current.y, dir: { x: 1, y: 0 } },
      { x: current.x - 1, y: current.y, dir: { x: -1, y: 0 } },
      { x: current.x, y: current.y + 1, dir: { x: 0, y: 1 } },
      { x: current.x, y: current.y - 1, dir: { x: 0, y: -1 } }
    ];

    for (const n of neighbors) {
      let nx = n.x;
      let ny = n.y;

      // Wrap tunnels
      if (nx < 0) nx = cols - 1;
      if (nx >= cols) nx = 0;
      if (ny < 0 || ny >= rows) continue;

      const key = getTileKey(nx, ny);
      if (visited.has(key)) continue;
      if (!isPassable(nx, ny, true, allowGate)) continue;

      visited.add(key);
      queue.push({
        x: nx,
        y: ny,
        dirFromStart: current.dirFromStart || n.dir
      });
    }
  }

  return null;
}

function moveGhost(ghost, dt) {
  const nowMs = frameTimeMs;

  // Freeze power-up stops all ghosts
  if (isPowerUpActive('FREEZE') && !ghost.eaten) {
    return;
  }

  if (ghost.respawnShield > 0) {
    ghost.respawnShield = Math.max(0, ghost.respawnShield - dt);
  }

  // While waiting to exit, bob up and down
  if (ghost.exitDelay > 0) {
    ghost.exitDelay -= dt;
    ghost.y = ghost.startY + Math.sin(nowMs / 200) * 3;
    return;
  }

  // Apply difficulty multiplier to ghost speed
  const difficultySettings = DIFFICULTY[currentDifficulty] || DIFFICULTY.ARCADE;
  const baseGhostSpeed = ghostSpeed * difficultySettings.ghostSpeedMultiplier;

  const currentSpeed = ghost.eaten ? baseGhostSpeed * GHOST_EATEN_SPEED_MULTIPLIER :
                       (frightenedTimer > 0 && !ghost.inHouse ? baseGhostSpeed * GHOST_FRIGHTENED_SPEED_MULTIPLIER :
                        baseGhostSpeed + (level - 1) * GHOST_SPEED_INCREASE_PER_LEVEL);
  const speed = currentSpeed * dt * (slowModeEnabled ? SLOW_MODE_SPEED_MULTIPLIER : 1);

  // Special simple movement for ghosts exiting the house
  // Move directly to exit position without complex pathfinding
  if (ghost.inHouse && ghost.mode === GHOST_MODE.EXITING) {
    const exitX = ghostHouseExit.x * tileSize + tileSize / 2;
    const exitY = ghostHouseExit.y * tileSize + tileSize / 2;

    // First, move horizontally to align with exit
    if (Math.abs(ghost.x - exitX) > 2) {
      ghost.dir = ghost.x < exitX ? { x: 1, y: 0 } : { x: -1, y: 0 };
      ghost.x += ghost.dir.x * speed;
    } else {
      // Then move upward to exit
      ghost.x = exitX; // Snap to center
      ghost.dir = { x: 0, y: -1 };
      ghost.y += ghost.dir.y * speed;

      // Check if ghost has exited
      if (ghost.y <= exitY) {
        ghost.inHouse = false;
        ghost.mode = scatterMode ? GHOST_MODE.SCATTER : GHOST_MODE.CHASE;
        ghost.y = exitY;
        ghost.respawnShield = Math.max(ghost.respawnShield, GHOST_RESPAWN_GRACE);
        ghost.lastDecisionTile = { x: -1, y: -1 }; // Reset for fresh decisions
      }
    }
    return;
  }

  // Special simple movement for eaten ghosts returning home
  // Move directly to ghost house without pathfinding or wall collision
  if (ghost.eaten && ghost.mode === GHOST_MODE.EATEN) {
    const currentTile = {
      x: Math.floor(ghost.x / tileSize),
      y: Math.floor(ghost.y / tileSize)
    };
    const targetTile = { ...ghostHouseExit };
    const dirToHome = findDirectionToTarget(currentTile, targetTile, true);

    if (dirToHome) {
      ghost.dir = dirToHome;
    }

    const nextX = ghost.x + ghost.dir.x * speed;
    const nextY = ghost.y + ghost.dir.y * speed;
    const nextTileX = Math.floor(nextX / tileSize);
    const nextTileY = Math.floor(nextY / tileSize);
    if (isPassable(nextTileX, nextTileY, true, true)) {
      ghost.x = nextX;
      ghost.y = nextY;
    } else {
      ghost.x = targetTile.x * tileSize + tileSize / 2;
      ghost.y = targetTile.y * tileSize + tileSize / 2;
    }

    if (currentTile.x === targetTile.x && currentTile.y === targetTile.y) {
      ghost.x = ghostHouseCenter.x * tileSize + tileSize / 2;
      ghost.y = ghostHouseCenter.y * tileSize + tileSize / 2;
      ghost.eaten = false;
      ghost.inHouse = true;
      ghost.mode = GHOST_MODE.EXITING;
      ghost.exitDelay = 0.5;
      ghost.lastDecisionTile = { x: -1, y: -1 };
      ghost.respawnShield = GHOST_RESPAWN_GRACE;
    }
    return;
  }

  // Determine ghost mode
  if (ghost.eaten) {
    ghost.mode = GHOST_MODE.EATEN;
  } else if (ghost.inHouse) {
    ghost.mode = GHOST_MODE.EXITING;
  } else if (ghost.respawnShield > 0) {
    ghost.mode = scatterMode ? GHOST_MODE.SCATTER : GHOST_MODE.CHASE;
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

  // Calculate current tile
  const currentTileX = Math.floor(ghost.x / tileSize);
  const currentTileY = Math.floor(ghost.y / tileSize);
  const tileCenterX = currentTileX * tileSize + tileSize / 2;
  const tileCenterY = currentTileY * tileSize + tileSize / 2;
  const distToCenter = Math.hypot(ghost.x - tileCenterX, ghost.y - tileCenterY);

  // Check if this is a new tile (haven't made a decision here yet)
  const isNewTile = ghost.lastDecisionTile.x !== currentTileX ||
                    ghost.lastDecisionTile.y !== currentTileY;

  // Only make direction decisions at tile centers (intersections) in NEW tiles
  // Use a tolerance that scales with per-frame movement to avoid skipping intersections
  const intersectionTolerance = Math.max(GHOST_INTERSECTION_TOLERANCE, speed * 2);
  const atIntersection = distToCenter <= intersectionTolerance && isNewTile;

  const isExitingOrEaten = ghost.mode === GHOST_MODE.EXITING || ghost.mode === GHOST_MODE.EATEN;

  // Allow reverse direction for eaten ghosts and ghosts in house
  const canReverse = ghost.eaten || ghost.inHouse;

  if (atIntersection) {
    // Mark this tile as processed
    ghost.lastDecisionTile = { x: currentTileX, y: currentTileY };

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
}

/**
 * Checks if two entities are colliding
 * @param {Object} a - First entity with x, y coordinates
 * @param {Object} b - Second entity with x, y coordinates
 * @returns {boolean} True if entities are colliding
 */
function collide(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) < tileSize / COLLISION_RADIUS_FACTOR;
}

// ==================== GAME LOGIC ====================
function eatPellet(player) {
  const key = `${Math.floor(player.x / tileSize)},${Math.floor(player.y / tileSize)}`;

  if (pellets.delete(key)) {
    // Combo system
    comboTimer = COMBO_TIMER_DURATION;
    comboCount++;
    const comboBonus = Math.min(comboCount, MAX_COMBO_MULTIPLIER);
    levelStats.pellets += 1;

    // Apply score multiplier from DOUBLE power-up
    const scoreMultiplier = isPowerUpActive('DOUBLE') ? 2 : 1;
    const points = (PELLET_BASE_SCORE + comboBonus) * scoreMultiplier;

    addScore(player, points);
    createParticle(player.x, player.y, '#f6d646', 'pellet');
    playComboSound(comboCount);

    // Celebrate chain milestones with toasts and extra juice
    const milestone = COMBO_TOAST_THRESHOLDS_DESC.find((m) => comboCount >= m);
    if (milestone && milestone > lastComboToast) {
      queueToast(`${comboCount}x chain — keep it alive!`, { variant: 'strong', accent: '#f6d646' });
      triggerRetroPulse(0.4);
      screenFlash = Math.min(1, screenFlash + 0.18);
      lastComboToast = milestone;

      const callup = COMBO_CALLUPS_DESC.find((c) => comboCount >= c.threshold);
      if (callup) {
        createFloatingText(player.x, player.y - 30, callup.text, '#ff5dd9');
      }
    }

    // Track statistics
    stats.totalPelletsEaten++;
    sessionStats.pelletsEaten++;
    stats.totalScore += points;

    // Update siren speed based on remaining pellets
    sirenSpeed = 1 + (1 - pellets.size / totalPellets) * 0.5;
  }

  if (powerPellets.delete(key)) {
    // Apply difficulty multiplier to frightened duration
    const difficultySettings = DIFFICULTY[currentDifficulty] || DIFFICULTY.ARCADE;
    const baseDuration = Math.max(
      FRIGHTENED_BASE_DURATION - level * FRIGHTENED_DURATION_DECREASE_PER_LEVEL,
      FRIGHTENED_MIN_DURATION
    );
    frightenedTimer = baseDuration * (difficultySettings.frightenedDuration / FRIGHTENED_BASE_DURATION);

    ghostMultiplier = 1;
    ghostsEatenThisPowerUp = 0; // Reset for Ghost Hunter achievement

    const scoreMultiplier = isPowerUpActive('DOUBLE') ? 2 : 1;
    addScore(player, POWER_PELLET_SCORE * scoreMultiplier);
    createParticle(player.x, player.y, '#6ef5c6', 'ghost');
    playSound(150, 0.3, 0.25);
    screenFlash = 0.5;
    triggerRetroPulse(0.7);

    ghosts.forEach(g => {
      if (!g.inHouse && !g.eaten) {
        g.dir = { x: -g.dir.x, y: -g.dir.y };
      }
    });
  }

  if (pellets.size === 0 && powerPellets.size === 0) {
    startLevelComplete();
  }
}

function addScore(player, points) {
  player.score += points;

  const totalScore = players[0].score + players[1].score;
  const prevScore = totalScore - points;

  // Extra life at threshold, then recurring interval
  const getExtraLivesForScore = (score) => {
    if (score < EXTRA_LIFE_FIRST_THRESHOLD) return 0;
    return 1 + Math.floor((score - EXTRA_LIFE_FIRST_THRESHOLD) / EXTRA_LIFE_RECURRING_INTERVAL);
  };

  const prevLives = getExtraLivesForScore(prevScore);
  const newLives = getExtraLivesForScore(totalScore);

  if (newLives > prevLives) {
    lives += (newLives - prevLives);
    playExtraLifeJingle();
    screenFlash = 0.3;
  }

  // Update high score
  if (totalScore > highScore) {
    highScore = totalScore;
    setLocalStorage('wackman-highscore', highScore);
  }

  // Score-based rumble
  const shakeBoost = Math.min(1.25, points * SCORE_SHAKE_SCALE);
  screenShake = Math.max(screenShake, shakeBoost);

  updateHud();
}

function eatFruit(player) {
  const key = `${Math.floor(player.x / tileSize)},${Math.floor(player.y / tileSize)}`;
  const idx = fruitTimers.findIndex((f) => `${f.x},${f.y}` === key);
  if (idx >= 0) {
    const fruit = fruitTimers[idx];
    const fruitInfo = fruitTypes[fruit.type % fruitTypes.length];
    fruitTimers.splice(idx, 1);
    levelStats.fruit += 1;

    const points = fruitInfo.points + level * FRUIT_BONUS_PER_LEVEL;
    addScore(player, points);
    createParticle(player.x, player.y, fruitInfo.color, 'ghost');
    createScorePopup(player.x, player.y - 20, points, fruitInfo.color);
    playSound(880, 0.15, 0.2);
    playSound(1100, 0.15, 0.15);
  }
}

/**
 * Spawns a power-up at a random empty location
 */
function spawnPowerUp() {
  const emptyTiles = [];
  layout.forEach((rowString, y) => {
    [...rowString].forEach((cell, x) => {
      if (isPassable(x, y, false, false) && !isInGhostHouse(x * tileSize, y * tileSize)) {
        emptyTiles.push({ x, y });
      }
    });
  });

  if (emptyTiles.length === 0) return;

  const choice = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
  const powerUpKeys = Object.keys(POWERUP_TYPES);
  const powerUpType = powerUpKeys[Math.floor(Math.random() * powerUpKeys.length)];
  const powerUpTime = 10 + Math.random() * 10; // 10-20 seconds

  powerUpSpawns.push({
    x: choice.x,
    y: choice.y,
    time: powerUpTime,
    type: powerUpType
  });
}

/**
 * Collects a power-up and activates its effect
 * @param {Object} player - The player collecting the power-up
 */
function collectPowerUp(player) {
  const key = `${Math.floor(player.x / tileSize)},${Math.floor(player.y / tileSize)}`;
  const idx = powerUpSpawns.findIndex((p) => `${p.x},${p.y}` === key);

  if (idx >= 0) {
    const powerUp = powerUpSpawns[idx];
    const powerUpInfo = POWERUP_TYPES[powerUp.type];
    powerUpSpawns.splice(idx, 1);
    levelStats.powerUps += 1;

    // Add to active power-ups
    activePowerUps.push({
      type: powerUp.type,
      duration: powerUpInfo.duration,
      timeLeft: powerUpInfo.duration
    });

    // Update statistics
    stats.powerUpsCollected++;
    sessionStats.powerUpsCollected = (sessionStats.powerUpsCollected || 0) + 1;

    // Check achievements
    if (powerUp.type === 'SPEED') {
      unlockAchievement('SPEED_DEMON');
    }

    // Visual feedback
    createParticle(player.x, player.y, powerUpInfo.color, 'star');
    createScorePopup(player.x, player.y - 20, powerUpInfo.name, powerUpInfo.color);
    playPowerUpCollectSound(powerUp.type);
    queueToast(`${powerUpInfo.name} activated`, { accent: powerUpInfo.color, variant: 'strong' });
    triggerRetroPulse(0.8);
    screenFlash = Math.min(1, screenFlash + 0.35);
    screenShake = Math.max(screenShake, 0.35);

    // Apply immediate effects
    if (powerUp.type === 'FREEZE') {
      // Freeze all ghosts for duration
      playSound(220, 0.3, 0.3);
    } else if (powerUp.type === 'SHIELD') {
      // Give invincibility
      player.invincible = powerUpInfo.duration;
      playSound(1320, 0.3, 0.2);
    }
  }
}

/**
 * Updates all active power-ups
 * @param {number} dt - Delta time
 */
function updatePowerUps(dt) {
  // Update power-up spawn timers
  powerUpSpawns.forEach((p) => (p.time -= dt));
  for (let i = powerUpSpawns.length - 1; i >= 0; i--) {
    if (powerUpSpawns[i].time <= 0) {
      powerUpSpawns.splice(i, 1);
    }
  }

  // Update active power-ups
  for (let i = activePowerUps.length - 1; i >= 0; i--) {
    activePowerUps[i].timeLeft -= dt;
    if (activePowerUps[i].timeLeft <= 0) {
      activePowerUps.splice(i, 1);
    }
  }
}

/**
 * Checks if a specific power-up is currently active
 * @param {string} type - Power-up type to check
 * @returns {boolean} True if active
 */
function isPowerUpActive(type) {
  return activePowerUps.some(p => p.type === type);
}

/**
 * Gets the remaining time for a power-up
 * @param {string} type - Power-up type
 * @returns {number} Time remaining in seconds
 */
function getPowerUpTimeLeft(type) {
  const powerUp = activePowerUps.find(p => p.type === type);
  return powerUp ? powerUp.timeLeft : 0;
}

/**
 * Unlocks an achievement
 * @param {string} achievementId - Achievement ID to unlock
 */
function unlockAchievement(achievementId) {
  if (!unlockedAchievements.includes(achievementId)) {
    unlockedAchievements.push(achievementId);
    setLocalStorageJSON('wackman-achievements', unlockedAchievements);

    // Show achievement notification
    const achievement = Object.values(ACHIEVEMENTS).find(a => a.id === achievementId);
    if (achievement) {
      createScorePopup(canvas.width / 2, 100, `${achievement.icon} ${achievement.name}`, '#ffd700');
      playSound(1760, 0.3, 0.15);
      playSound(2200, 0.3, 0.15);
    }
  }
}

/**
 * Checks and unlocks achievements based on current stats
 */
function checkAchievements() {
  const totalScore = players[0].score + players[1].score;

  // First Blood - eat first ghost
  if (stats.totalGhostsEaten >= 1) {
    unlockAchievement('first_blood');
  }

  // Combo Master - 20+ combo
  if (stats.longestCombo >= 20) {
    unlockAchievement('combo_master');
  }

  // Centurion - 100 ghosts
  if (stats.totalGhostsEaten >= 100) {
    unlockAchievement('centurion');
  }

  // Expert - level 10
  if (level >= 10) {
    unlockAchievement('level_10');
  }

  // High Roller - 50k points
  if (totalScore >= 50000) {
    unlockAchievement('high_roller');
  }

  // Survivor - 10 minutes
  const playTime = (Date.now() - sessionStats.startTime) / 1000 / 60;
  if (playTime >= 10) {
    unlockAchievement('survivor');
  }

  // Ghost Hunter - eat 4 ghosts in one power-up
  if (ghostsEatenThisPowerUp >= 4) {
    unlockAchievement('ghost_hunter');
  }

  // Untouchable - 3 perfect levels in a row
  if (consecutivePerfectLevels >= 3) {
    unlockAchievement('untouchable');
  }
}

/**
 * Saves current statistics to localStorage
 */
function saveStats() {
  setLocalStorageJSON('wackman-stats', stats);
}

/**
 * Updates the leaderboard with current score
 */
function updateLeaderboard() {
  const totalScore = players[0].score + players[1].score;
  const entry = {
    score: totalScore,
    level: level,
    difficulty: currentDifficulty,
    gameMode: currentGameMode,
    date: Date.now()
  };

  leaderboard.push(entry);
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 10); // Keep top 10

  setLocalStorageJSON('wackman-leaderboard', leaderboard);
}

function startLevelComplete() {
  if (gameState === GAME_STATE.LEVEL_COMPLETE) return;

  levelStats.duration = (Date.now() - levelStats.startedAt) / 1000;
  lastLevelSummary = {
    level,
    time: levelStats.duration,
    pellets: levelStats.pellets,
    ghosts: levelStats.ghosts,
    fruit: levelStats.fruit,
    powerUps: levelStats.powerUps,
    livesLost: levelStats.livesLost
  };

  playLevelClearFanfare();
  triggerRetroPulse(0.8);
  screenFlash = Math.min(1, screenFlash + 0.5);

  setState(GAME_STATE.LEVEL_COMPLETE, LEVEL_COMPLETE_DURATION);
}

function nextLevel() {
  level += 1;
  resetScatterChaseCycle();

  // Track perfect level achievement
  if (sessionStats.perfectLevel) {
    stats.perfectLevels++;
    consecutivePerfectLevels++;
    unlockAchievement('perfect');
    queueToast('Perfect run! No deaths.', { variant: 'ghostly', accent: '#6ef5c6' });
  } else {
    consecutivePerfectLevels = 0;
  }

  // Update highest level
  if (level > stats.highestLevel) {
    stats.highestLevel = level;
  }

  // Save stats
  saveStats();
  checkAchievements();

  // Reset for next level
  sessionStats.perfectLevel = true;

  resetBoard();
  resetPositions();
  fruitTimers.length = 0;
  powerUpSpawns.length = 0;
  activePowerUps.length = 0;
  particles.length = 0;
  scorePopups.length = 0;
  floatingTexts.length = 0;
  respawnBeams.length = 0;
  closeCallTimers = [0, 0];
  screenFlash = 1;
  triggerRetroPulse(1);

  playSound(440, 0.2, 0.15);
  playSound(550, 0.2, 0.15);
  playSound(660, 0.2, 0.15);
  playSound(880, 0.3, 0.2);

  // Transition to READY state
  setState(GAME_STATE.READY, READY_STATE_DURATION);
  queueToast(`Level ${level} ready`, { variant: 'ghostly' });
}

function update(dt) {
  refreshMusicState();

  // Update screen effects
  screenShake = Math.max(0, screenShake - dt * SCREEN_SHAKE_DECAY_RATE);
  screenFlash = Math.max(0, screenFlash - dt * SCREEN_FLASH_DECAY_RATE);
  updateRetroEffects(dt);

  // Update combo timer
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) {
      comboCount = 0;
      lastComboToast = 0;
    }
  }

  for (let i = 0; i < closeCallTimers.length; i++) {
    closeCallTimers[i] = Math.max(0, closeCallTimers[i] - dt);
  }

  updateParticles(dt);

  // Update death animations
  getActivePlayers().forEach(p => {
    if (!p.alive && p.deathTimer > 0) {
      p.deathTimer -= dt;
    }
  });

  // Decay respawn flash effects
  players.forEach(p => {
    p.respawnFx = Math.max(0, p.respawnFx - dt);
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
          setMusicState(MUSIC_STATE.GAMEOVER);
        } else {
          resetPositions();
          resetScatterChaseCycle();
          setState(GAME_STATE.READY, DYING_STATE_DURATION);
        }
      }
      return;

    case GAME_STATE.LEVEL_COMPLETE:
      stateTimer -= dt;
      if (stateTimer <= 0) {
        nextLevel();
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

  if (!scatterScript.length) {
    resetScatterChaseCycle();
  }

  if (scatterPhaseTimer !== Infinity) {
    scatterPhaseTimer -= dt;
    if (scatterPhaseTimer <= 0) {
      advanceScatterPhase();
    }
  }

  getActivePlayers().forEach((p) => p.alive && movePlayer(p, dt));
  ghosts.forEach((g) => moveGhost(g, dt));
  checkCollisions();

  // Update power-ups
  updatePowerUps(dt);

  // Update fruit timers
  fruitTimers.forEach((f) => (f.time -= dt));
  for (let i = fruitTimers.length - 1; i >= 0; i -= 1) {
    if (fruitTimers[i].time <= 0) fruitTimers.splice(i, 1);
  }

  // Spawn fruit
  if (Math.random() < FRUIT_SPAWN_CHANCE && fruitTimers.length < FRUIT_MAX_COUNT) {
    spawnFruit();
  }

  // Spawn power-ups (less frequent than fruit)
  if (Math.random() < 0.005 && powerUpSpawns.length < 2) {
    spawnPowerUp();
  }

  // Update play time
  const currentPlayTime = (Date.now() - sessionStats.startTime) / 1000;
  stats.totalPlayTime = (stats.totalPlayTime || 0) + dt;

  // Check achievements periodically
  if (Math.random() < 0.01) {
    checkAchievements();
    saveStats();
  }
}

function checkCollisions() {
  const activePlayers = getActivePlayers();
  ghosts.forEach((g) => {
    activePlayers.forEach((p) => {
      if (!p.alive || g.eaten || g.inHouse || p.invincible > 0) return;
      const playerIdx = players.indexOf(p);
      const distance = Math.hypot(g.x - p.x, g.y - p.y);

      if (distance < NEAR_MISS_DISTANCE &&
          distance > tileSize / COLLISION_RADIUS_FACTOR &&
          closeCallTimers[playerIdx] <= 0 &&
          frightenedTimer <= 0) {
        closeCallTimers[playerIdx] = CLOSE_CALL_COOLDOWN;
        createScorePopup(p.x, p.y - 28, 'CLOSE CALL!', '#ff5dd9', 16);
        playWooshSound();
        screenShake = Math.max(screenShake, 0.35);
      }

      if (collide(g, p)) {
        if (frightenedTimer > 0) {
          g.eaten = true;

          // Apply score multiplier from DOUBLE power-up
          const scoreMultiplier = isPowerUpActive('DOUBLE') ? 2 : 1;
          const points = GHOST_BASE_SCORE * ghostMultiplier * scoreMultiplier;

          addScore(p, points);
          createParticle(g.x, g.y, g.color, 'ghost');
          createScorePopup(g.x, g.y - 20, points, '#fff');
          ghostMultiplier *= 2;
          triggerRetroPulse(0.45);
          screenShake = Math.max(screenShake, 0.6);
          screenFlash = Math.min(1, screenFlash + 0.25);

          // Track statistics
          stats.totalGhostsEaten++;
          sessionStats.ghostsEaten++;
          levelStats.ghosts += 1;
          ghostsEatenThisPowerUp++;

          // Update longest combo
          if (comboCount > stats.longestCombo) {
            stats.longestCombo = comboCount;
          }

          // Activate WACKY HANDS after eating 3 ghosts in one power-up!
          if (ghostsEatenThisPowerUp === 3 && !isPowerUpActive('HANDS')) {
            activePowerUps.push({
              type: 'HANDS',
              duration: POWERUP_TYPES.HANDS.duration,
              timeLeft: POWERUP_TYPES.HANDS.duration
            });
            createScorePopup(p.x, p.y - 40, 'WACKY HANDS!', POWERUP_TYPES.HANDS.color);
          }

          // Enhanced ghost eating sound effect (like arcade)
          playGhostEatenSound();
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
  screenFlash = Math.min(1, screenFlash + 0.7);
  triggerRetroPulse(1);

  // Track death statistics
  stats.totalDeaths++;
  sessionStats.deaths++;
  levelStats.livesLost += 1;
  sessionStats.perfectLevel = false;
  consecutivePerfectLevels = 0;

  // Death effects
  deadPlayer.alive = false;
  deadPlayer.deathTimer = DEATH_ANIMATION_DURATION;
  createParticle(deadPlayer.x, deadPlayer.y, deadPlayer.color, 'death');
  createFloatingText(deadPlayer.x, deadPlayer.y - 24, 'KABOOM!', '#ff4b8b');

  playSound(200, 0.3, 0.3);
  playSound(150, 0.3, 0.25);
  playSound(100, 0.4, 0.2);

  // Transition to DYING state - the state machine will handle
  // transitioning to GAMEOVER or READY after the timer expires
  setState(GAME_STATE.DYING, DYING_STATE_DURATION);
}

function resetPositions() {
  // In single-player mode, P1 starts in the center; in 2P mode, players are offset
  const p1Col = singlePlayerMode ? 13 : 11;
  const p2Col = 16;

  players[0] = { ...createPlayer(p1Col, playerStartRow, '#f6d646', ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']), score: players[0].score };
  players[1] = { ...createPlayer(p2Col, playerStartRow, '#6ef5c6', ['KeyW', 'KeyA', 'KeyS', 'KeyD']), score: players[1].score };

  // Only set invincibility for active players
  getActivePlayers().forEach(p => {
    p.invincible = PLAYER_INVINCIBILITY_DURATION;
    p.respawnFx = RESPAWN_BEAM_DURATION;
    createRespawnBeam(p.x, p.y);
  });

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
  lastComboToast = 0;
}

function showGameOver() {
  // Update leaderboard and save stats
  updateLeaderboard();
  saveStats();
  checkAchievements();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let yPos = 60;

  // Title
  ctx.fillStyle = '#ff4b8b';
  ctx.shadowColor = '#ff4b8b';
  ctx.shadowBlur = 30;
  ctx.font = '24px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', canvas.width / 2, yPos);
  yPos += 50;

  // Score
  const totalScore = players[0].score + players[1].score;
  ctx.fillStyle = '#f6d646';
  ctx.shadowColor = '#f6d646';
  ctx.font = '16px "Press Start 2P", monospace';
  ctx.fillText(`SCORE: ${totalScore}`, canvas.width / 2, yPos);
  yPos += 30;

  // Level reached
  ctx.fillStyle = '#6ef5c6';
  ctx.shadowColor = '#6ef5c6';
  ctx.font = '12px "Press Start 2P", monospace';
  ctx.fillText(`LEVEL: ${level}`, canvas.width / 2, yPos);
  yPos += 35;

  // Session Stats Header
  ctx.fillStyle = '#b967ff';
  ctx.shadowBlur = 15;
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillText('SESSION STATS', canvas.width / 2, yPos);
  yPos += 25;

  // Session Stats
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#c5d4ff';
  ctx.font = '9px "Press Start 2P", monospace';
  ctx.fillText(`Ghosts: ${sessionStats.ghostsEaten}  Pellets: ${sessionStats.pelletsEaten}`, canvas.width / 2, yPos);
  yPos += 20;

  const playTime = Math.floor((Date.now() - sessionStats.startTime) / 1000);
  const minutes = Math.floor(playTime / 60);
  const seconds = playTime % 60;
  ctx.fillText(`Time: ${minutes}:${seconds.toString().padStart(2, '0')}  Deaths: ${sessionStats.deaths}`, canvas.width / 2, yPos);
  yPos += 35;

  // Leaderboard Header
  ctx.fillStyle = '#ff8c42';
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#ff8c42';
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillText('TOP 5 SCORES', canvas.width / 2, yPos);
  yPos += 25;

  // Leaderboard
  ctx.shadowBlur = 0;
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  const leftX = canvas.width / 2 - 140;

  leaderboard.slice(0, 5).forEach((entry, i) => {
    const isCurrentGame = entry.score === totalScore && entry.level === level && i === 0;
    ctx.fillStyle = isCurrentGame ? '#ffd700' : '#aab2ff';

    const rank = `${i + 1}.`;
    const score = `${entry.score}`;
    const levelText = `L${entry.level}`;

    ctx.fillText(rank, leftX, yPos);
    ctx.fillText(score, leftX + 30, yPos);
    ctx.fillText(levelText, leftX + 180, yPos);
    yPos += 18;
  });

  // Achievements count
  yPos += 25;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#ffd700';
  ctx.font = '9px "Press Start 2P", monospace';
  const achievementCount = unlockedAchievements.length;
  const totalAchievements = Object.keys(ACHIEVEMENTS).length;
  ctx.fillText(`Achievements: ${achievementCount}/${totalAchievements}`, canvas.width / 2, yPos);

  // Instructions
  yPos += 35;
  ctx.fillStyle = '#c5d4ff';
  ctx.shadowBlur = 0;
  ctx.font = '9px "Press Start 2P", monospace';
  ctx.fillText('Press Start to play again', canvas.width / 2, yPos);
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
    const fruitTime = FRUIT_MIN_TIME + Math.random() * (FRUIT_MAX_TIME - FRUIT_MIN_TIME);
    fruitTimers.push({ ...choice, time: fruitTime, type: fruitType });
  }
}

// ==================== GAME LOOP ====================
function loop(timestamp) {
  try {
    const now = typeof timestamp === 'number'
      ? timestamp
      : (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

    if (!lastTime) lastTime = now;
    frameTimeMs = now;
    frameTime = frameTimeMs / 1000;
    const rawDt = Math.min((now - lastTime) / 1000, 0.12);
    lastTime = now;

    // Fixed-step accumulator: processes all elapsed time in small, even slices
    accumulatedTime = Math.min(accumulatedTime + rawDt, MAX_ACCUMULATED_TIME);
    let steps = 0;

    while (accumulatedTime >= MAX_FRAME_STEP) {
      update(MAX_FRAME_STEP);
      accumulatedTime -= MAX_FRAME_STEP;
      steps += 1;
      if (steps > 10) {
        // Safety break to avoid spiral-of-death in extreme cases
        accumulatedTime = 0;
        break;
      }
    }

    drawGrid();
    drawRespawnBeams();
    drawPlayers();
    drawGhosts();
    drawUI();
    drawRetroOverlay();
  } catch (err) {
    console.error('Game loop error', err);
    setState(GAME_STATE.PAUSED);
  } finally {
    requestAnimationFrame(loop);
  }
}

function renderLivesDisplay(livesCount) {
  const livesEl = document.getElementById('lives');
  if (!livesEl) return;

  livesEl.textContent = '';
  livesEl.setAttribute('aria-label', `${livesCount} lives remaining`);

  if (livesCount <= 0) {
    const icon = document.createElement('span');
    icon.className = 'life-icon';
    icon.textContent = '☠';
    livesEl.appendChild(icon);
    return;
  }

  for (let i = 0; i < livesCount; i++) {
    const icon = document.createElement('span');
    icon.className = 'life-icon';
    icon.textContent = LIFE_SYMBOL;
    livesEl.appendChild(icon);
  }
}

/**
 * Updates the HUD display with current game stats
 */
function updateHud() {
  document.getElementById('p1-score').textContent = players[0].score;
  document.getElementById('p2-score').textContent = players[1].score;
  renderLivesDisplay(lives);

  // Update high score display if it exists
  const highScoreEl = document.getElementById('high-score');
  if (highScoreEl) highScoreEl.textContent = highScore;
}

function updateStartButtonLabel() {
  const startBtn = document.getElementById('start');
  if (!startBtn) return;
  const isRestart = hasStartedOnce;
  startBtn.textContent = isRestart ? '⟳ RESTART' : '▶ START';
  startBtn.setAttribute('aria-label', isRestart ? 'Restart game' : 'Start game');
  startBtn.classList.toggle('is-restart', isRestart);
}

// ==================== AUDIO ====================
const audioBufferCache = new Map();

function getWaveSample(type, phase) {
  const normalizedPhase = phase % (Math.PI * 2);
  switch (type) {
    case 'square':
      return Math.sign(Math.sin(normalizedPhase)) || 1;
    case 'triangle':
      return 2 * Math.asin(Math.sin(normalizedPhase)) / Math.PI;
    case 'sawtooth': {
      const frac = normalizedPhase / (Math.PI * 2);
      return 2 * (frac - Math.floor(frac + 0.5));
    }
    default:
      return Math.sin(normalizedPhase);
  }
}

function getCachedBuffer(type, startFreq, endFreq, duration) {
  const key = `${type}:${startFreq}:${endFreq}:${duration}`;
  if (audioBufferCache.has(key)) return audioBufferCache.get(key);

  const sr = audioCtx.sampleRate || 44100;
  const length = Math.max(1, Math.floor(sr * duration));
  const buffer = audioCtx.createBuffer(1, length, sr);
  const data = buffer.getChannelData(0);
  let phase = 0;
  const freqDelta = endFreq - startFreq;

  for (let i = 0; i < length; i++) {
    const t = i / length;
    const freq = startFreq + freqDelta * t;
    phase += (2 * Math.PI * freq) / sr;
    const envelope = Math.pow(1 - t, 2); // quick decay envelope
    data[i] = getWaveSample(type, phase) * envelope;
  }

  audioBufferCache.set(key, buffer);
  return buffer;
}

function playTone(frequency, duration = 0.1, gain = 0.15, type = 'square', startTime = audioCtx.currentTime, endFrequency = frequency) {
  if (musicMuted) return;
  try {
    const buffer = getCachedBuffer(type, frequency, endFrequency, duration);
    const source = audioCtx.createBufferSource();
    const gainNode = audioCtx.createGain();
    source.buffer = buffer;
    source.connect(gainNode).connect(audioCtx.destination);
    gainNode.gain.setValueAtTime(gain * masterVolume, startTime);
    source.start(startTime);
    source.stop(startTime + duration);
  } catch (e) {
    console.warn(`Failed to play cached sound: ${e.message}`);
  }
}

/**
 * Plays a sound effect using Web Audio API
 * @param {number} frequency - Sound frequency in Hz
 * @param {number} duration - Duration in seconds
 * @param {number} gain - Volume (0-1)
 */
function playSound(frequency, duration = 0.1, gain = 0.15) {
  playTone(frequency, duration, gain, 'square');
}

function playComboSound(combo) {
  if (musicMuted) return;
  const now = audioCtx.currentTime;
  if (now - lastComboSoundTime < 0.05) return;
  lastComboSoundTime = now;
  const scale = [523, 587, 659, 698, 784, 880, 988, 1047, 1175]; // C major-ish
  const note = scale[(combo - 1) % scale.length];
  const duration = 0.09;

  playTone(note, duration, 0.14, 'triangle', now);

  // Add harmony layers as combo climbs
  if (combo >= 5) {
    playTone(note * 1.5, duration + 0.06, 0.08, 'sine', now + 0.02);
  }

  if (combo >= 10) {
    [2, 4].forEach((offset, idx) => {
      const start = now + 0.04 + idx * 0.02;
      playTone(note * Math.pow(2, offset / 12), duration, 0.05, 'square', start);
    });
  }
}

function playWooshSound() {
  if (musicMuted) return;
  const now = audioCtx.currentTime;
  playTone(260, 0.32, 0.2, 'sawtooth', now, 60);
}

function playPowerUpCollectSound(type) {
  if (musicMuted) return;
  const now = audioCtx.currentTime;
  const base = type === 'DOUBLE' ? 494 : 392;
  const chord = [base, base * 1.25, base * 1.5, base * 2];
  chord.forEach((freq, idx) => {
    const start = now + idx * 0.05;
    playTone(freq, 0.18, 0.16, idx % 2 === 0 ? 'square' : 'triangle', start);
  });
}

function playLevelClearFanfare() {
  if (musicMuted) return;
  const now = audioCtx.currentTime;
  const melody = [
    { freq: 523, duration: 0.16, time: 0 },
    { freq: 659, duration: 0.16, time: 0.16 },
    { freq: 784, duration: 0.2, time: 0.32 },
    { freq: 988, duration: 0.24, time: 0.52 },
    { freq: 1175, duration: 0.24, time: 0.76 },
    { freq: 1568, duration: 0.3, time: 1.04 }
  ];

  melody.forEach(note => {
    const start = now + note.time;
    playTone(note.freq, note.duration, 0.22, 'square', start);
  });
}

/**
 * Plays the ghost eaten sound effect (arcade-style rising pitch)
 */
function playGhostEatenSound() {
  if (musicMuted) return;
  try {
    const now = audioCtx.currentTime;

    // Create a series of rising tones like the original arcade game
    const notes = [
      { freq: 523, time: 0.00, duration: 0.08 },  // C5
      { freq: 659, time: 0.08, duration: 0.08 },  // E5
      { freq: 784, time: 0.16, duration: 0.08 },  // G5
      { freq: 1047, time: 0.24, duration: 0.12 }, // C6
    ];

    notes.forEach(note => {
      const startTime = now + note.time;
      playTone(note.freq, note.duration, 0.25, 'sine', startTime);
    });
  } catch (e) {
    console.warn(`Failed to play ghost eaten sound: ${e.message}`);
  }
}

function playLightningStrike() {
  if (musicMuted) return;
  const now = audioCtx.currentTime;

  playTone(80, 0.35, 0.25, 'sawtooth', now);
  playTone(320, 0.22, 0.2, 'square', now + 0.02);
  playTone(1200, 0.08, 0.16, 'triangle', now + 0.04);
}

function playReadyJingle() {
  if (musicMuted) return;
  const now = audioCtx.currentTime;
  const notes = [
    { freq: 523, duration: 0.12, time: 0 },
    { freq: 659, duration: 0.12, time: 0.12 },
    { freq: 784, duration: 0.14, time: 0.24 },
    { freq: 1047, duration: 0.2, time: 0.38 },
  ];
  notes.forEach(note => {
    const start = now + note.time;
    playTone(note.freq, note.duration, 0.18, 'square', start);
  });
}

function playGameOverJingle() {
  if (musicMuted) return;
  const now = audioCtx.currentTime;
  const notes = [
    { freq: 784, duration: 0.22, time: 0 },
    { freq: 740, duration: 0.22, time: 0.22 },
    { freq: 698, duration: 0.22, time: 0.44 },
    { freq: 659, duration: 0.22, time: 0.66 },
    { freq: 622, duration: 0.28, time: 0.9 },
    { freq: 587, duration: 0.35, time: 1.2 },
  ];
  notes.forEach(note => {
    const start = now + note.time;
    playTone(note.freq, note.duration, 0.22, 'square', start);
  });
}

function playExtraLifeJingle() {
  if (musicMuted) return;
  const now = audioCtx.currentTime;
  const notes = [
    { freq: 988, duration: 0.14, time: 0 },
    { freq: 1175, duration: 0.14, time: 0.14 },
    { freq: 1319, duration: 0.18, time: 0.28 },
  ];
  notes.forEach(note => {
    const start = now + note.time;
    playTone(note.freq, note.duration, 0.2, 'triangle', start);
  });
}

/**
 * Starts playing background music melody
 */
function playMusic() {
  if (musicMuted) return;

  // Always clear existing interval to prevent duplicates
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }

  const melody = [392, 440, 494, 523, 494, 440, 392, 330];
  let idx = 0;
  musicInterval = setInterval(() => {
    if (musicMuted || gameState !== GAME_STATE.PLAYING) return;
    playSound(melody[idx % melody.length], 0.15, 0.04);
    idx += 1;
  }, 250);
}

/**
 * Starts playing frightened/safe ghost loop
 */
function playFrightenedTheme() {
  if (musicMuted) return;
  if (frightenedInterval) {
    clearInterval(frightenedInterval);
    frightenedInterval = null;
  }

  let toggle = false;
  frightenedInterval = setInterval(() => {
    if (musicMuted || gameState !== GAME_STATE.PLAYING || frightenedTimer <= 0) return;
    const freq = toggle ? 329 : 294;
    playSound(freq, 0.16, 0.05);
    toggle = !toggle;
  }, 220);
}

/**
 * Starts playing ambient siren sound
 */
function playSiren() {
  if (musicMuted) return;

  // Always clear existing interval to prevent duplicates
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }

  sirenInterval = setInterval(() => {
    if (musicMuted || gameState !== GAME_STATE.PLAYING || frightenedTimer > 0) return;
    const freq = 100 + Math.sin(frameTimeMs / (500 / sirenSpeed)) * 50;
    playSound(freq, 0.1, 0.02);
  }, 150);
}

/**
 * Stops all audio intervals
 */
function stopAudio() {
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
  if (frightenedInterval) {
    clearInterval(frightenedInterval);
    frightenedInterval = null;
  }
}

function setMusicState(nextState) {
  if (currentMusicState === nextState) return;
  stopAudio();
  currentMusicState = nextState;
  if (musicMuted) return;

  switch (nextState) {
    case MUSIC_STATE.NORMAL:
      playMusic();
      playSiren();
      break;
    case MUSIC_STATE.FRIGHTENED:
      playFrightenedTheme();
      break;
    case MUSIC_STATE.GAMEOVER:
      playGameOverJingle();
      break;
    default:
      break;
  }
}

function refreshMusicState() {
  if (musicMuted) {
    stopAudio();
    return;
  }

  if (gameState === GAME_STATE.GAMEOVER) {
    setMusicState(MUSIC_STATE.GAMEOVER);
    return;
  }

  if (gameState !== GAME_STATE.PLAYING && gameState !== GAME_STATE.READY) {
    stopAudio();
    currentMusicState = null;
    return;
  }

  const frightenedActive = frightenedTimer > 0;
  const targetState = frightenedActive ? MUSIC_STATE.FRIGHTENED : MUSIC_STATE.NORMAL;
  setMusicState(targetState);
}

// ==================== INPUT HANDLING ====================
/**
 * Consolidated keyboard input handler
 * Handles both movement and game control keys
 */
const settingsModal = document.getElementById('settings-modal');
const settingsBackdrop = document.getElementById('settings-backdrop');
const settingsButton = document.getElementById('settings');
const closeSettingsButton = document.getElementById('close-settings');

function isSettingsOpen() {
  return settingsModal && settingsModal.classList.contains('open');
}

function openSettings() {
  if (!settingsModal || !settingsBackdrop) return;
  settingsModal.classList.add('open');
  settingsModal.setAttribute('aria-hidden', 'false');
  settingsBackdrop.classList.add('open');
  settingsBackdrop.setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  if (!settingsModal || !settingsBackdrop) return;
  settingsModal.classList.remove('open');
  settingsModal.setAttribute('aria-hidden', 'true');
  settingsBackdrop.classList.remove('open');
  settingsBackdrop.setAttribute('aria-hidden', 'true');
}

if (settingsButton && settingsModal && settingsBackdrop) {
  settingsButton.addEventListener('click', openSettings);
  settingsBackdrop.addEventListener('click', closeSettings);
}

if (closeSettingsButton) {
  closeSettingsButton.addEventListener('click', closeSettings);
}

if (hudToggle && hudElement) {
  hudToggle.addEventListener('click', () => {
    const shouldCollapse = !hudElement.classList.contains('hud-collapsed');
    setHudCollapsed(shouldCollapse);
  });
}

window.addEventListener('keydown', (e) => {
  if (isSettingsOpen()) {
    if (e.code === 'Escape') {
      closeSettings();
    }
    return;
  }

  // Prevent default for arrow keys and space
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }

  // Handle pause toggle with Escape key
  if (e.code === 'Escape') {
    if (gameState === GAME_STATE.PLAYING) {
      setState(GAME_STATE.PAUSED);
      updatePauseButton();
    } else if (gameState === GAME_STATE.PAUSED) {
      setState(GAME_STATE.PLAYING);
      updatePauseButton();
    }
    return;
  }

  // Handle movement keys
  const dir = directions[e.code];
  if (!dir) return;

  players.forEach((p, idx) => {
    // In single-player mode, both arrow keys and WASD control P1
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
        updatePauseButton();
      }
    }
  });
});

// ==================== VISIBILITY CHANGE HANDLER ====================
/**
 * Auto-pause game when tab is hidden to prevent unfair deaths
 */
document.addEventListener('visibilitychange', () => {
  if (document.hidden && gameState === GAME_STATE.PLAYING) {
    setState(GAME_STATE.PAUSED);
    updatePauseButton();
  }
});

// ==================== TOUCH CONTROLS ====================
let touchStartX = 0;
let touchStartY = 0;

function handleTouchStart(e) {
  if (!e.touches.length) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  e.preventDefault();

  if (gameState === GAME_STATE.IDLE) {
    startGame();
  } else if (gameState === GAME_STATE.PAUSED && lives > 0) {
    setState(GAME_STATE.PLAYING);
  }
}

function handleTouchMove(e) {
  e.preventDefault();
}

function handleTouchEnd(e) {
  if (!e.changedTouches.length) return;

  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;

  const dx = touchEndX - touchStartX;
  const dy = touchEndY - touchStartY;

  const minSwipe = swipeDeadZone;

  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minSwipe) {
    // Horizontal swipe
    players[0].queued = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
  } else if (Math.abs(dy) > minSwipe) {
    // Vertical swipe
    players[0].queued = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
  }

  e.preventDefault();
}

function bindSwipeArea(target) {
  if (!target) return;
  target.addEventListener('touchstart', handleTouchStart, { passive: false });
  target.addEventListener('touchmove', handleTouchMove, { passive: false });
  target.addEventListener('touchend', handleTouchEnd, { passive: false });
}

bindSwipeArea(canvas);
bindSwipeArea(touchPad);

// ==================== GAME INITIALIZATION ====================
function startGame() {
  // Start game with READY state countdown
  levelStats.startedAt = Date.now();
  levelStats.duration = 0;
  setState(GAME_STATE.READY, READY_STATE_DURATION);
  setHudCollapsed(true);
  queueToast(`Level ${level} ready`, { variant: 'strong' });
  playReadyJingle();
  hasStartedOnce = true;
  updateStartButtonLabel();

  if (audioCtx.state === 'suspended') audioCtx.resume();
  setMusicState(MUSIC_STATE.NORMAL);
}

function resetGame() {
  // Apply difficulty settings
  const difficultySettings = DIFFICULTY[currentDifficulty] || DIFFICULTY.ARCADE;
  lives = difficultySettings.livesStart;

  level = 1;
  players[0].score = 0;
  players[1].score = 0;
  comboCount = 0;
  lastComboToast = 0;
  frightenedTimer = 0;
  ghostMultiplier = 1;
  consecutivePerfectLevels = 0;
  ghostsEatenThisPowerUp = 0;
  lastLevelSummary = null;
  resetScatterChaseCycle();

  // Reset session statistics
  sessionStats = {
    ghostsEaten: 0,
    pelletsEaten: 0,
    deaths: 0,
    powerUpsCollected: 0,
    startTime: Date.now(),
    perfectLevel: true
  };

  // Increment games played
  stats.gamesPlayed++;
  saveStats();

  // Clear power-ups
  activePowerUps.length = 0;
  powerUpSpawns.length = 0;
  respawnBeams.length = 0;
  floatingTexts.length = 0;
  closeCallTimers = [0, 0];

  resetBoard();
  resetPositions();
  updateHud();
  setState(GAME_STATE.IDLE);
  updateStartButtonLabel();
  setHudCollapsed(false);
}

const startButton = document.getElementById('start');
if (startButton) {
  startButton.addEventListener('click', () => {
    // If we're mid-run (or about to start), treat this as a quick restart
    if (gameState === GAME_STATE.PLAYING || gameState === GAME_STATE.READY || gameState === GAME_STATE.PAUSED) {
      resetGame();
      startGame();
      return;
    }

    // If game over or out of lives, reset then start fresh
    if (gameState === GAME_STATE.GAMEOVER || lives <= 0) {
      resetGame();
      startGame();
      return;
    }

    // Normal idle start
    if (gameState === GAME_STATE.IDLE) {
      startGame();
    }
  });
}

const muteButton = document.getElementById('mute');
if (muteButton) {
  muteButton.textContent = musicMuted ? '🔇' : '🔊';
  muteButton.addEventListener('click', () => {
    musicMuted = !musicMuted;
    muteButton.textContent = musicMuted ? '🔇' : '🔊';
    if (musicMuted) {
      stopAudio();
    } else {
      refreshMusicState();
    }
  });
} else {
  console.warn('Mute button not found; skipping mute toggle binding.');
}

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

// Difficulty toggle button handler
document.getElementById('difficulty').addEventListener('click', () => {
  // Only allow difficulty change when not actively playing
  if (gameState !== GAME_STATE.IDLE && gameState !== GAME_STATE.GAMEOVER) {
    return;
  }

  // Cycle through difficulties: ARCADE -> TURBO -> CASUAL -> ARCADE
  const difficulties = ['ARCADE', 'TURBO', 'CASUAL'];
  const currentIndex = difficulties.indexOf(currentDifficulty);
  const nextIndex = (currentIndex + 1) % difficulties.length;
  currentDifficulty = difficulties[nextIndex];

  // Update button text
  const diffBtn = document.getElementById('difficulty');
  diffBtn.textContent = DIFFICULTY[currentDifficulty]?.name || currentDifficulty;

  // Save to localStorage
  setLocalStorage('wackman-difficulty', currentDifficulty);
});

// Volume slider handler
const volumeSlider = document.getElementById('volume');
const volumeValue = document.getElementById('volume-value');

volumeSlider.addEventListener('input', (e) => {
  masterVolume = parseInt(e.target.value) / 100;
  volumeValue.textContent = `${e.target.value}%`;

  // Save to localStorage
  setLocalStorage('wackman-volume', masterVolume);
});

// Load saved volume on startup
const savedVolume = getLocalStorage('wackman-volume', '0.5');
masterVolume = parseFloat(savedVolume);
volumeSlider.value = Math.round(masterVolume * 100);
volumeValue.textContent = `${Math.round(masterVolume * 100)}%`;

// Accessibility toggles
const colorblindToggle = document.getElementById('colorblind-toggle');
if (colorblindToggle) {
  colorblindToggle.checked = colorblindMode;
  colorblindToggle.addEventListener('change', (e) => {
    colorblindMode = e.target.checked;
    setLocalStorage('wackman-colorblind', colorblindMode ? 'true' : 'false');
    applyGhostPalette();
  });
}

const slowModeToggle = document.getElementById('slowmode-toggle');
if (slowModeToggle) {
  slowModeToggle.checked = slowModeEnabled;
  slowModeToggle.addEventListener('change', (e) => {
    slowModeEnabled = e.target.checked;
    setLocalStorage('wackman-slowmode', slowModeEnabled ? 'true' : 'false');
  });
}

const swipeDeadZoneSlider = document.getElementById('swipe-deadzone');
const swipeDeadZoneValue = document.getElementById('swipe-deadzone-value');
if (swipeDeadZoneSlider) {
  swipeDeadZoneSlider.value = swipeDeadZone;
  if (swipeDeadZoneValue) {
    swipeDeadZoneValue.textContent = `${swipeDeadZone}px`;
  }
  swipeDeadZoneSlider.addEventListener('input', (e) => {
    swipeDeadZone = Number.parseInt(e.target.value, 10) || DEFAULT_SWIPE_DEADZONE;
    setLocalStorage('wackman-swipe-deadzone', swipeDeadZone);
    if (swipeDeadZoneValue) {
      swipeDeadZoneValue.textContent = `${swipeDeadZone}px`;
    }
  });
}

// Load saved difficulty on startup
const savedDifficulty = getLocalStorage('wackman-difficulty', 'ARCADE');
currentDifficulty = DIFFICULTY[savedDifficulty] ? savedDifficulty : 'ARCADE';
if (!DIFFICULTY[savedDifficulty]) {
  setLocalStorage('wackman-difficulty', currentDifficulty);
}
document.getElementById('difficulty').textContent = DIFFICULTY[currentDifficulty]?.name || currentDifficulty;

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
precomputeGateSegments();
initMazeCache();
resetBoard();
setHudCollapsed(false);
updateHud();
updateModeDisplay();
updateStartButtonLabel();
syncLayoutWithState();
resetScatterChaseCycle();
requestAnimationFrame(loop);
