(() => {

  // ====== Canvas & Responsive Setup ======
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  
  // ====== Background Music Setup ======
  // Simple and reliable music handling (same as folder 2)
  window.addEventListener('load', () => {
    const music = document.getElementById('bgMusic');
    
    if (music) {
      music.muted = false; // Unmute the audio (it's muted in HTML)
      music.volume = 0.3;
      
      // Try to play music on load
      const playMusic = () => {
        music.play().catch(error => {
          // Autoplay blocked by browser - will play on user interaction
        });
      };
      
      playMusic();
      
      // Fallback: Play on any user interaction (bypasses autoplay restrictions)
      document.addEventListener('click', () => {
        if (music.paused) {
          music.muted = false; // Ensure it's unmuted
          music.play();
        }
      });
      
      // Also try on touch for mobile
      document.addEventListener('touchstart', () => {
        if (music.paused) {
          music.muted = false; // Ensure it's unmuted
          music.play();
        }
      });
    }
  });

  // ====== Game State ======
  const state = {
    running: false, paused: false, gameOver: false,
    score: 0, high: Number(localStorage.cartRunner_high || 0),
    gameTime: 30, timeLeft: 30, lastTs: 0,
    scrollSpeed: 316, // increased scroll speed for faster map movement
    scrollOffset: 0,
    mapScrollOffset: 0, // for side-scrolling map background
    showFinishLine: false,
    collectibles: [], // changed from obstacles to collectibles
    nextCollectibleSpawn: 800, // Much reduced initial delay for more boxes
    gravity: 1200, // reduced gravity for better jump control
    jumpVelocity: -700, // increased jump strength for higher jumps (legacy)
    flapVelocity: -700, // Flappy Bird style: upward boost velocity (smaller than jumpVelocity)
    groundY: 1870, // will be updated by resizeCanvas() based on actual canvas height
    micEnabled: false,
    gameStartTime: 0, // track when game started for 30-second limit
    currentScreen: 'splash', // 'splash', 'game', 'win', 'lose', 'final'
    gameEnded: false,
    selectedProduct: 0, // stores the randomly selected product number (1-15)
    showingConfetti: false,
    confettiFrame: 0,
    confettiStartTime: 0
  };

  function resizeCanvas() {
    // Set canvas to exact 9:16 ratio optimized for 1080x1920
    const targetWidth = 1080;
    const targetHeight = 1920;
    const aspectRatio = targetWidth / targetHeight; // 9:16 ratio (0.5625)
    
    // Store original target size for scaling calculations
    window.targetCanvasWidth = targetWidth;
    window.targetCanvasHeight = targetHeight;
    
    const maxWidth = window.innerWidth;
    const maxHeight = window.innerHeight;
    const windowAspectRatio = maxWidth / maxHeight;
    
    // Calculate dimensions while maintaining exact 9:16 aspect ratio
    let canvasWidth, canvasHeight;
    
    if (windowAspectRatio > aspectRatio) {
      // Window is wider than our target ratio - fit to height
      canvasHeight = Math.min(maxHeight, targetHeight);
      canvasWidth = Math.round(canvasHeight * aspectRatio);
    } else {
      // Window is taller than our target ratio - fit to width  
      canvasWidth = Math.min(maxWidth, targetWidth);
      canvasHeight = Math.round(canvasWidth / aspectRatio);
    }
    
    // Ensure minimum playable size
    if (canvasWidth < 300) {
      canvasWidth = 300;
      canvasHeight = Math.round(canvasWidth / aspectRatio);
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Update ground position - proportional to canvas height
    state.groundY = canvas.height - Math.max(50, canvas.height * 0.026); // ~2.6% from bottom
    
    // Store scale factor for responsive elements
    window.gameScale = canvasWidth / targetWidth;
    
    // Update responsive physics based on scale (mobile devices get adjusted physics)
    const baseGravity = 1200;
    const baseJumpVelocity = -700;
    const baseFlapVelocity = -700; // Flappy Bird style boost
    const baseScrollSpeed = 316;
    
    // Scale physics to match canvas size for consistent gameplay feel
    state.gravity = baseGravity * window.gameScale;
    state.jumpVelocity = baseJumpVelocity * window.gameScale;
    state.flapVelocity = baseFlapVelocity * window.gameScale;
    state.scrollSpeed = baseScrollSpeed * window.gameScale;
    
    // Update existing game elements if they exist
    if (window.cart && typeof window.cart.reset === 'function') {
      window.cart.reset();
      const groundOffset = canvas.height * 0.052; // ~5.2% from ground (responsive)
      window.cart.y = state.groundY - groundOffset - window.cart.h;
    }
    
  }
  
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  
  // Make sure canvas can receive keyboard events
  canvas.focus();

  // ====== Front Screen Management (Same as Folder 2) ======
  let frontScreenElement;
  let gameScreenElement;
  let openingScreenElement;
  
  function initFrontScreen() {
    frontScreenElement = document.getElementById('frontScreen');
    gameScreenElement = document.getElementById('gameScreen');
    openingScreenElement = document.getElementById('openingScreen');
    
    // Add click event to opening screen image
    if (openingScreenElement) {
      openingScreenElement.addEventListener('click', startGameTransition);
    }
    
    // Keyboard support
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        const frontScreen = document.getElementById('frontScreen');
        if (frontScreen && window.getComputedStyle(frontScreen).display !== 'none') {
          e.preventDefault();
          startGameTransition();
        }
      }
    });
  }
  
  function startGameTransition() {
    // Hide front screen
    if (frontScreenElement) {
      frontScreenElement.style.display = 'none';
    }
    
    // Show game screen
    if (gameScreenElement) {
      gameScreenElement.style.display = 'block';
      gameScreenElement.classList.remove('hidden');
    }
    
    // Unmute and play background music
    const music = document.getElementById('bgMusic');
    if (music) {
      music.muted = false;
      music.play().catch(err => { /* Audio autoplay prevented */ });
    }
    
    // Reset timing to prevent lag/delay after idle on splash screen
    state.lastTs = 0;
    
    // Focus canvas and start game
    canvas.focus();
    state.currentScreen = 'game';
    startGame();
  }

  // Load images
  const images = {};
  const imagePromises = [];
  
  function loadImage(name, src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        images[name] = img;
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  imagePromises.push(loadImage('cart', 'Assets/Cart.png'));
  imagePromises.push(loadImage('box', 'Assets/Box.png')); // boxes will be obstacles
  // Load multiple maps for sequential progression
  imagePromises.push(loadImage('map', 'Assets/Maps_Merged.png')); // map
  imagePromises.push(loadImage('winScreen', 'Assets/Reference_004.1.png')); // win screen
  imagePromises.push(loadImage('loseScreen', 'Assets/Reference_004.2.png')); // lose screen
  imagePromises.push(loadImage('finalScreen', 'Assets/SceneProduct.png')); // final screen
  
  // Load product images 1-15
  for (let i = 1; i <= 15; i++) {
    if (i <= 3) imagePromises.push(loadImage(`product${i}`, `Assets/${i}_Brand.jpeg`));
    else imagePromises.push(loadImage(`product${i}`, `Assets/${i}_Brand.png`));
  }
  
  // Load QR code images 1-15
  for (let i = 1; i <= 15; i++) {
    imagePromises.push(loadImage(`qr${i}`, `Assets/${i}_Qrcode.png`));
  }
  
  // Load confetti animation frames 0-21
  for (let i = 0; i <= 21; i++) {
    imagePromises.push(loadImage(`confetti${i}`, `Confetti/${i}.png`));
  }

  // Load sound effects
  const sounds = {};
  
  function loadSound(name, src) {
    const audio = new Audio();
    audio.src = src;
    audio.preload = 'auto';
    sounds[name] = audio;
    return new Promise(resolve => {
      audio.oncanplaythrough = () => resolve(audio);
      audio.onerror = () => {
        console.warn(`Failed to load sound: ${src}`);
        resolve(null);
      };
    });
  }
  
  // Load all sound effects
  const soundPromises = [];
  soundPromises.push(loadSound('jump', 'Sounds/Jump.mp3'));
  soundPromises.push(loadSound('getbox', 'Sounds/GetBox.mp3'));
  soundPromises.push(loadSound('win', 'Sounds/Win.mp3'));
  soundPromises.push(loadSound('lose', 'Sounds/Lose.mp3'));

  // Function to play sounds
  function playSound(name) {
    if (sounds[name]) {
      try {
        sounds[name].currentTime = 0; // Reset to beginning
        sounds[name].play().catch(e => {
          console.warn(`Could not play sound ${name}:`, e);
        });
      } catch (e) {
        console.warn(`Error playing sound ${name}:`, e);
      }
    }
  }

  class Cart {
    constructor() {
      this.reset();
    }
    
    reset() {
      // Responsive cart size based on canvas dimensions (percentage-based for better scaling)
      // Cart is ~46% of canvas width and ~26% of canvas height for good proportions
      this.w = Math.round(canvas.width * 0.46);
      this.h = Math.round(canvas.height * 0.26);
      
      // Center the cart horizontally in the canvas
      this.x = Math.round((canvas.width / 2) - (this.w / 2)); // Center horizontally
      
      // Position cart on the ground (matching update method's calculation)
      const groundOffset = canvas.height * 0.052;
      this.y = state.groundY - groundOffset - this.h;
      this.vy = 0; // vertical velocity
      this.onGround = true;
      this.animTime = 0; // for running animation
    }
    
    jump() {
      // Flappy Bird style: Apply upward boost anytime (no ground check)
      // Set velocity to flap strength (negative = upward)
      this.vy = state.flapVelocity;
      this.onGround = false;
      playSound('jump'); // Play jump sound
    }
    
    jumpWithStrength(strength) {
      // Flappy Bird style: Apply custom strength boost anytime
      this.vy = strength;
      this.onGround = false;
      playSound('jump'); // Play jump sound
    }
    
    update(dt) {
      // Apply gravity
      this.vy += state.gravity * dt;
      this.y += this.vy * dt;
      
      // Check ceiling collision - prevent cart from going above screen
      if (this.y <= 0) {
        this.y = 0; // Keep cart at top of screen
        // Only stop upward velocity, allow cart to fall back down
        if (this.vy < 0) {
          this.vy = 0; // Stop moving up
        }
      }
      
      // Check ground collision (accounting for higher cart position)
      // Responsive ground offset (~5.2% of canvas height)
      const groundOffset = canvas.height * 0.052;
      const cartGroundLevel = state.groundY - groundOffset;
      if (this.y + this.h >= cartGroundLevel) {
        this.y = cartGroundLevel - this.h;
        // In Flappy Bird style, just stop downward movement but allow flapping up anytime
        if (this.vy > 0) {
          this.vy = 0; // Stop falling through ground
        }
        this.onGround = true;
      } else {
        this.onGround = false;
      }
      
      // Update animation
      this.animTime += dt * 8;
    }
    
    draw() {
      if (images.cart) {
        ctx.drawImage(images.cart, this.x, this.y, this.w, this.h);
      } else {
        // Fallback drawing - animated cart
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.fillStyle = '#654321';
        ctx.fillRect(this.x + 10, this.y + 10, this.w - 20, this.h - 20);
        
        // Simple wheel animation when on ground
        if (this.onGround) {
          const wheelOffset = Math.sin(this.animTime) * 2;
          ctx.fillStyle = '#333';
          ctx.beginPath();
          ctx.arc(this.x + 20, this.y + this.h + wheelOffset, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(this.x + this.w - 20, this.y + this.h - wheelOffset, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  class Collectible {
    constructor(x) {
      // Responsive collectible size based on canvas dimensions (~18.5% of canvas width/height)
      this.w = Math.round(canvas.width * 0.185);
      this.h = Math.round(canvas.height * 0.104);
      this.x = x;
      
      // Random height - spawn boxes at different heights (percentage of canvas height)
      const highHeight1 = canvas.height * 0.8; // Higher than cart
      const highHeight4 = canvas.height * 0.5; // Moderately high
      const heights = [
        state.groundY - this.h - highHeight1,
        state.groundY - this.h - highHeight4
      ];
      this.baseY = heights[Math.floor(Math.random() * heights.length)];
      this.y = this.baseY;
      this.vx = -state.scrollSpeed; // move left with ground speed
      this.collected = false;
      this.sparkleTime = 0; // for visual effects
      this.floatTime = Math.random() * Math.PI * 2; // random starting phase for floating
      this.floatSpeed = 2 + Math.random() * 2; // random floating speed
      this.floatAmplitude = Math.round((20 + Math.random() * 30) * (canvas.width / 1080)); // scaled floating height
      this.rotation = 0;
      this.rotationSpeed = (Math.random() - 0.5) * 2; // slower rotation speed
      this.maxRotation = (20 * Math.PI) / 180; // 20 degrees in radians
    }
    
    update(dt) {
      this.x += this.vx * dt;
      this.sparkleTime += dt * 5; // animation timer
      
      // Floating movement
      this.floatTime += dt * this.floatSpeed;
      this.y = this.baseY + Math.sin(this.floatTime) * this.floatAmplitude;
      
      // Limited rotation between -20 and +20 degrees
      this.rotation += this.rotationSpeed * dt;
      // Clamp rotation to -20 to +20 degrees
      this.rotation = Math.max(-this.maxRotation, Math.min(this.maxRotation, this.rotation));
      
      // Reverse rotation direction when hitting limits
      if (this.rotation >= this.maxRotation || this.rotation <= -this.maxRotation) {
        this.rotationSpeed *= -1;
      }
    }
    
    offscreen() {
      return this.x + this.w < -50;
    }
    
    draw() {
      if (this.collected) return; // Don't draw if collected
      
      // Add sparkle effect
      const sparkle = Math.sin(this.sparkleTime) * 0.1 + 1;
      ctx.save();
      ctx.globalAlpha = sparkle;
      
      // Apply rotation
      ctx.translate(this.x + this.w/2, this.y + this.h/2);
      ctx.rotate(this.rotation);
      ctx.translate(-this.w/2, -this.h/2);
      
      if (images.box) {
        ctx.drawImage(images.box, 0, 0, this.w, this.h);
      } else {
        // Fallback drawing - collectible box with sparkle
        ctx.fillStyle = '#FFD700'; // Gold color for collectibles
        ctx.fillRect(0, 0, this.w, this.h);
        ctx.fillStyle = '#FF6B6B';
        ctx.fillRect(5, 5, this.w - 10, 12);
        ctx.fillRect(this.w/2 - 6, 5, 12, this.h - 10);
        
        // Sparkle effect
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(this.w/2 - 2, this.h/2 - 2, 4, 4);
      }
      
      ctx.restore();
    }
  }

  const cart = new Cart();
  window.cart = cart; // Make cart globally accessible for resize function

  // ====== Audio / Voice Detection ======

  const audio = {
    ctx: null, analyser: null, data: null, enabled: false,
    lastTrigger: 0, smoothing: 0.2,
    smoothedLevel: 0, // For exponential smoothing
    wasAboveThreshold: false // Track if we were already above threshold (edge detection)
  };

  async function enableMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});
      audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = audio.ctx.createMediaStreamSource(stream);
      audio.analyser = audio.ctx.createAnalyser();
      audio.analyser.fftSize = 1024;
      audio.analyser.smoothingTimeConstant = 0.8; // Balanced smoothing (was 0.8) - smooths peaks but allows drops between words
      src.connect(audio.analyser);
      audio.data = new Uint8Array(audio.analyser.frequencyBinCount);
      audio.enabled = true;
      state.micEnabled = true;
    } catch(e) {
      console.error('Microphone access denied:', e);
      state.micEnabled = false;
    }
  }

  function getLoudness() {
    if (!audio.enabled) return 0;
    audio.analyser.getByteTimeDomainData(audio.data);
    let maxDev = 0;
    for (let i = 0; i < audio.data.length; i++) {
      const dev = Math.abs(audio.data[i] - 128);
      if (dev > maxDev) maxDev = dev;
    }
    const rawLevel = maxDev / 128;
    
    // Apply exponential smoothing to reduce jitter and multiple peaks
    const smoothingFactor = 0.3; // More responsive (was 0.3) - balances smoothing with responsiveness
    audio.smoothedLevel = (smoothingFactor * rawLevel) + ((1 - smoothingFactor) * audio.smoothedLevel);
    
    return audio.smoothedLevel;
  }

  function handleVoiceJump(level) {
    const now = performance.now();
    const threshold = 0.25; // Higher threshold - less sensitive
    const cooldown = 300; // Shorter cooldown for faster response (was 600ms)
    
    const isAboveThreshold = level >= threshold;
    
    // Rising edge detection: Only trigger when crossing from below to above threshold
    // AND cooldown has passed
    if (isAboveThreshold && !audio.wasAboveThreshold && (now - audio.lastTrigger) > cooldown) {
      audio.lastTrigger = now;
      
      // Flappy Bird style: Use consistent flap velocity
      cart.jump();
      
    }
    
    // Update threshold state for next frame
    audio.wasAboveThreshold = isAboveThreshold;
  }

  // ====== Controls ======
  // Canvas click handler for different screens
  // Handle screen navigation and interactions
  function handleCanvasInteraction() {
    if (state.currentScreen === 'win') {
      // Go to final screen when win screen is clicked
      // Randomize product selection (1-15)
      state.selectedProduct = Math.floor(Math.random() * 15) + 1;
      state.currentScreen = 'final';
      draw(getLoudness()); // Force redraw the final screen immediately
    } else if (state.currentScreen === 'final') {
      // Restart game when final screen is clicked
      restartGame();
    } else if (state.currentScreen === 'lose') {
      // Restart game when lose screen is clicked
      restartGame();
    } else if (state.currentScreen === 'game' && state.running && !state.paused) {
      // Jump during gameplay
      cart.jump();
    } else {
      canvas.focus();
    }
  }

  canvas.addEventListener('click', handleCanvasInteraction);
  
  // Touch event for mobile - use touchend for better reliability
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault(); // Prevent click event from also firing
    handleCanvasInteraction();
  }, { passive: false });
  
  // Global keyboard event listener (backup)
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') {
      e.preventDefault();
      enableMic();
    }
    if (e.code === 'Space') { 
      e.preventDefault();
      if (!state.running) {
        startGame();
      } else if (!state.paused) {
        cart.jump();
      }
    }
    if (e.code === 'KeyR') {
      e.preventDefault();
      startGame();
    }
    if (e.code === 'KeyP') {
      e.preventDefault();
      if (state.running) {
        state.paused = !state.paused;
      }
    }
  });

  // ====== Game Loop ======
  function startGame() {
    state.running = true; state.paused = false; state.gameOver = false;
    state.score = 0; state.timeLeft = 30; state.scrollOffset = 0;
    state.mapScrollOffset = 0; // Reset map scroll
    state.showFinishLine = false; state.collectibles.length = 0;
    state.nextCollectibleSpawn = 800; // Start with 0.8 second delay
    state.gameStartTime = performance.now(); // Record game start time
    state.gameEnded = false; // Reset game ended flag
    
    // Calculate scroll speed for proper finish line timing
    // calculateScrollSpeed(); // Commented out to use manual scroll speed setting
    
    // Set ground level (matching resizeCanvas formula)
    state.groundY = canvas.height - Math.max(50, canvas.height * 0.026);
    
    // Reset cart (which also positions it on the ground)
    cart.reset();
    
  }

  function calculateScrollSpeed() {
    // Calculate scroll speed for exactly 2x looping in 30 seconds
    const mapWidth = canvas.width;
    const totalDistance = mapWidth * 2; // Exactly 2 complete loops
    const gameTime = 30; // seconds
    state.scrollSpeed = totalDistance / gameTime; // pixels per second
    
  }

  function restartGame() {
    window.location.reload();
  }

  function spawnCollectible() {
    // Responsive spawn position (~46% + random 28% of canvas width)
    const baseOffset = canvas.width * 0.46;
    const randomOffset = Math.random() * canvas.width * 0.28;
    const x = canvas.width + 500 + baseOffset + randomOffset;
    state.collectibles.push(new Collectible(x));
    // Set next spawn time - much more frequent spawning
    state.nextCollectibleSpawn = 3000 + Math.random() * 1000; // 1-2.5 seconds
  }

  function checkCollisions() {
    for (let i = state.collectibles.length - 1; i >= 0; i--) {
      const collectible = state.collectibles[i];
      if (!collectible.collected && rectsOverlap(
        cart.x, cart.y, cart.w, cart.h,
        collectible.x, collectible.y, collectible.w, collectible.h
      )) {
        collectible.collected = true;
        state.score += 50; // Points for collecting
        state.collectibles.splice(i, 1); // Remove collected item
        playSound('getbox'); // Play collection sound
      }
    }
  }

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ====== Background Drawing ======
  function drawBackground() {
    // First draw sky background color
    ctx.fillStyle = '#f9f0d3'; // Sky background color
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw sequential maps (maps_01 first, then maps_02)
    drawSequentialMaps();
  }
  
  // Cache map dimensions to avoid recalculating every frame
  let cachedMapDimensions = null;
  let lastCanvasSize = { width: 0, height: 0 };

  function drawSequentialMaps() {
    if (!images.map) return;
    
    // Recalculate dimensions only if canvas size changed
    if (!cachedMapDimensions || 
        lastCanvasSize.width !== canvas.width || 
        lastCanvasSize.height !== canvas.height) {
      
      const targetHeight = canvas.height * 0.8; // Use 80% of canvas height
      const mapScale = targetHeight / images.map.height;
      
      cachedMapDimensions = {
        width: images.map.width * mapScale,
        height: targetHeight,
        y: canvas.height - targetHeight,
        cyclesNeeded: Math.ceil(canvas.width / (images.map.width * mapScale)) + 1
      };
      
      lastCanvasSize = { width: canvas.width, height: canvas.height };
    }
    
    const { width: mapScaledWidth, height: mapScaledHeight, y, cyclesNeeded } = cachedMapDimensions;
    
    // Draw multiple cycles of the combined maps
    // Use bitwise OR for faster modulo with power-of-2-like behavior
    const scrollOffset = state.mapScrollOffset % mapScaledWidth;
    
    for (let cycle = 0; cycle < cyclesNeeded; cycle++) {
      const cycleOffset = cycle * mapScaledWidth;
      const mapX = cycleOffset - scrollOffset;
      
      // Only draw if visible on screen
      if (mapX + mapScaledWidth > 0 && mapX < canvas.width) {
        ctx.drawImage(images.map, mapX, y, mapScaledWidth, mapScaledHeight);
      }
    }
  }

  function update(ts) {
    // Skip all game logic if on splash screen (performance optimization)
    if (state.currentScreen === 'splash') {
      requestAnimationFrame(update);
      return;
    }
    
    if (!state.lastTs) state.lastTs = ts;
    
    // Better deltaTime handling to prevent stuttering
    const rawDt = (ts - state.lastTs) / 1000;
    // Cap deltaTime more aggressively to prevent large jumps after tab switches
    // Also set a minimum to prevent too-small values
    const dt = Math.max(0.008, Math.min(rawDt, 0.025)); // Between 8ms and 25ms
    state.lastTs = ts;

    // Voice jump detection
    const level = getLoudness();
    if (audio.enabled && state.running && !state.paused) {
      handleVoiceJump(level);
    }

    // Keep animating if confetti is showing, even when game is not running
    if (state.showingConfetti) {
      draw(level);
      requestAnimationFrame(update);
      return;
    }
    
    // Handle paused/stopped game (without confetti)
    if (!state.running || state.paused) { 
      draw(level);
      requestAnimationFrame(update); 
      return; 
    }

    // Game timer
    state.timeLeft -= dt;
    if (state.timeLeft <= 0 && !state.gameEnded) {
      // Game ends after 30 seconds
      state.running = false;
      state.gameEnded = true;
      state.high = Math.max(state.high, state.score);
      localStorage.cartRunner_high = state.high;

      state.showingConfetti = true;
      state.confettiFrame = 0;
      state.confettiStartTime = Date.now();
      
      // Play appropriate sound
      if (state.score > 0) {
        playSound('win'); // Got at least one box
      } else {
        playSound('lose'); // Got no boxes
      }

      draw(level);
      requestAnimationFrame(update);
      
      // Confetti will automatically transition to win/lose screen when complete
      return;
    }

    // Show finish line at 28 seconds (2 seconds remaining)
    if (state.timeLeft <= 2) {
      state.showFinishLine = true;
    }

    // Update scroll offset for background
    state.scrollOffset += state.scrollSpeed * dt;
    
    // Keep map scrolling continuously for smooth visual experience
    // (No longer stopping at 30 seconds to prevent stuttering)
    state.mapScrollOffset += state.scrollSpeed * dt;

    // Update cart
    cart.update(dt);

    // Spawn collectibles
    state.nextCollectibleSpawn -= dt * 1000;
    if (state.nextCollectibleSpawn <= 0) {
      spawnCollectible();
      // Note: spawn interval is now set in spawnCollectible() function
    }

    // Update collectibles
    for (let i = state.collectibles.length - 1; i >= 0; i--) {
      const collectible = state.collectibles[i];
      collectible.update(dt);
      if (collectible.offscreen()) {
        state.collectibles.splice(i, 1);
      }
    }

    // Check collisions
    checkCollisions();

    draw(level);
    requestAnimationFrame(update);
  }


  function draw(level) {
    const W = canvas.width, H = canvas.height;

    // Skip drawing if on splash screen (save performance)
    if (state.currentScreen === 'splash') {
      return; // Don't clear or draw anything on splash screen
    }

    // Clear canvas
    ctx.clearRect(0, 0, W, H);
    
    // Draw the current screen
    if (state.currentScreen === 'game') {
      drawGameScreen(level, W, H);
    } else if (state.currentScreen === 'win') {
      drawWinScreen(W, H);
    } else if (state.currentScreen === 'lose') {
      drawLoseScreen(W, H);
    } else if (state.currentScreen === 'final') {
      drawFinalScreen(W, H);
    }
    
    // Then overlay confetti on top if it's playing
    if (state.showingConfetti) {
      drawConfettiOverlay(W, H);
    }
  }

  function drawGameScreen(level, W, H) {
    // Draw background
    drawBackground();

    // Draw collectibles
    state.collectibles.forEach(collectible => collectible.draw());

    // Draw cart
    cart.draw();
    
    // Draw score at top left
    drawScore(W, H);
    
    if (state.paused) {
      // Show paused overlay (text removed)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, W, H);
    }
  }
  
  function drawScore(W, H) {
    // Responsive font size based on canvas width
    const fontSize = Math.max(32, W * 0.04);
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    // Draw shadow for better visibility
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(`Score: ${state.score}`, W * 0.05 + 3, H * 0.04 + 3);
    
    // Draw main text
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`Score: ${state.score}`, W * 0.05, H * 0.04);
  }

  function drawWinScreen(W, H) {
    if (images.winScreen) {
      // Scale image to fit canvas while maintaining aspect ratio
      const imgAspect = images.winScreen.width / images.winScreen.height;
      const canvasAspect = W / H;
      
      let drawWidth, drawHeight, drawX, drawY;
      
      if (imgAspect > canvasAspect) {
        drawWidth = W;
        drawHeight = W / imgAspect;
        drawX = 0;
        drawY = (H - drawHeight) / 2;
      } else {
        drawWidth = H * imgAspect;
        drawHeight = H;
        drawX = (W - drawWidth) / 2;
        drawY = 0;
      }
      
      ctx.drawImage(images.winScreen, drawX, drawY, drawWidth, drawHeight);
    } else {
      // Fallback win screen (text removed)
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawLoseScreen(W, H) {
    if (images.loseScreen) {
      // Scale image to fit canvas while maintaining aspect ratio
      const imgAspect = images.loseScreen.width / images.loseScreen.height;
      const canvasAspect = W / H;
      
      let drawWidth, drawHeight, drawX, drawY;
      
      if (imgAspect > canvasAspect) {
        drawWidth = W;
        drawHeight = W / imgAspect;
        drawX = 0;
        drawY = (H - drawHeight) / 2;
      } else {
        drawWidth = H * imgAspect;
        drawHeight = H;
        drawX = (W - drawWidth) / 2;
        drawY = 0;
      }
      
      ctx.drawImage(images.loseScreen, drawX, drawY, drawWidth, drawHeight);
    } else {
      // Fallback lose screen (text removed)
      ctx.fillStyle = '#F44336';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawConfettiOverlay(W, H) {
    // Confetti animation plays at ~30fps (22 frames total)
    const confettiFrameDuration = 1000 / 30; // ~33ms per frame
    const elapsed = Date.now() - state.confettiStartTime;
    state.confettiFrame = Math.floor(elapsed / confettiFrameDuration);

    if (state.score <= 0) {
      state.showingConfetti = false;
      state.currentScreen = 'lose';
      return;
    }
    
    // Check if animation is complete (22 frames: 0-21)
    if (state.confettiFrame > 21) {
      state.showingConfetti = false;
      state.currentScreen = 'win';
      return;
    }
    
    // Draw confetti overlay on top of whatever is currently on screen
    const confettiKey = `confetti${state.confettiFrame}`;
    if (images[confettiKey]) {
      // Draw confetti to fill entire screen
      const imgAspect = images[confettiKey].width / images[confettiKey].height;
      const canvasAspect = W / H;
      
      let drawWidth, drawHeight, drawX, drawY;
      
      if (imgAspect > canvasAspect) {
        // Image is wider - fit height and crop width
        drawHeight = H;
        drawWidth = H * imgAspect;
        drawX = (W - drawWidth) / 2;
        drawY = 0;
      } else {
        // Image is taller - fit width and crop height
        drawWidth = W;
        drawHeight = W / imgAspect;
        drawX = 0;
        drawY = (H - drawHeight) / 2;
      }
      
      ctx.drawImage(images[confettiKey], drawX, drawY, drawWidth, drawHeight);
    }
  }

  function drawFinalScreen(W, H) {
    
    // Draw background template
    if (images.finalScreen) {
      // Scale background to cover entire canvas (like object-fit: cover)
      const imgAspect = images.finalScreen.width / images.finalScreen.height;
      const canvasAspect = W / H;
      
      let drawWidth, drawHeight, drawX, drawY;
      
      if (imgAspect > canvasAspect) {
        // Image is wider than canvas - fit height and crop width
        drawHeight = H;
        drawWidth = H * imgAspect;
        drawX = (W - drawWidth) / 2;
        drawY = 0;
      } else {
        // Image is taller than canvas - fit width and crop height
        drawWidth = W;
        drawHeight = W / imgAspect;
        drawX = 0;
        drawY = (H - drawHeight) / 2;
      }
      
      ctx.drawImage(images.finalScreen, drawX, drawY, drawWidth, drawHeight);
    } else {
      // Fallback background
      ctx.fillStyle = '#F5F5DC'; // Beige background like in the image
      ctx.fillRect(0, 0, W, H);
    }
    
    // Draw selected product image in center area
    const productKey = `product${state.selectedProduct}`;
    if (images[productKey]) {
      // Product image positioning (center area based on the template)
      const productMaxWidth = W * 0.5; // 40% of canvas width
      const productMaxHeight = H * 0.4; // 30% of canvas height
      const productCenterX = W / 2;
      const productCenterY = H * 0.48; // Position in center area
      
      // Scale product image to fit within bounds while maintaining aspect ratio
      const productImg = images[productKey];
      const productAspect = productImg.width / productImg.height;
      
      let productWidth, productHeight;
      
      if (productAspect > productMaxWidth / productMaxHeight) {
        // Product is wider - fit to width
        productWidth = productMaxWidth;
        productHeight = productMaxWidth / productAspect;
      } else {
        // Product is taller - fit to height
        productHeight = productMaxHeight;
        productWidth = productMaxHeight * productAspect;
      }
      
      const productX = productCenterX - productWidth / 2;
      const productY = productCenterY - productHeight / 2;
      
      ctx.drawImage(productImg, productX, productY, productWidth, productHeight);
    } else {
      // Fallback - draw a placeholder
      ctx.fillStyle = '#FF6B6B';
      ctx.fillRect(W * 0.3, H * 0.3, W * 0.4, H * 0.3);
      ctx.fillStyle = 'white';
      ctx.font = `${Math.max(18, W * 0.022)}px Arial`; // Responsive font size
      ctx.textAlign = 'center';
      ctx.fillText(`Product ${state.selectedProduct}`, W / 2, H * 0.45);
    }
    
    // Draw QR code in bottom area
    const qrKey = `qr${state.selectedProduct}`;
    if (images[qrKey]) {
      // QR code positioning (bottom area based on the template)
      const qrSize = Math.min(W * 0.22, H * 0.12);
      const qrCenterX = W / 2;
      const qrCenterY = H * 0.785; // Position in bottom area where QR should be
      
      const qrX = qrCenterX - qrSize / 2;
      const qrY = qrCenterY - qrSize / 2;
      
      ctx.drawImage(images[qrKey], qrX, qrY, qrSize, qrSize);
    } else {
      // Fallback - draw a placeholder QR
      const qrSize = Math.min(W * 0.25, H * 0.15);
      const qrX = W / 2 - qrSize / 2;
      const qrY = H * 0.78 - qrSize / 2;
      
      ctx.fillStyle = '#333';
      ctx.fillRect(qrX, qrY, qrSize, qrSize);
      ctx.fillStyle = 'white';
      ctx.font = `${Math.max(14, W * 0.015)}px Arial`; // Responsive font size
      ctx.textAlign = 'center';
      ctx.fillText(`QR ${state.selectedProduct}`, W / 2, H * 0.78);
    }
  }

  // Initialize game
  let gameInitialized = false;
  async function initGame() {
    if (gameInitialized) {
      return;
    }
    gameInitialized = true;
    
    
    // Set initial ground position (matching resizeCanvas formula)
    state.groundY = canvas.height - Math.max(50, canvas.height * 0.026);
    // Update cart position (cart was already created with correct position from resizeCanvas)
    const groundOffset = canvas.height * 0.052;
    cart.y = state.groundY - groundOffset - cart.h;
    
    // Auto-enable microphone
    try {
      await enableMic();
    } catch (e) {
      console.warn('Could not auto-enable microphone:', e);
    }
    
    // Start the game loop
    requestAnimationFrame(update);
  }

  // Debug helper - call from console if needed
  window.forceStartGame = function() {
    startGameTransition();
  };

  // Wait for images and sounds to load before starting
  Promise.all([...imagePromises, ...soundPromises]).then(() => {
    initGame();
  }).catch(err => {
    console.warn('Some assets failed to load, using fallbacks:', err);
    initGame();
  });

  // Keep canvas responsive
  const ro = new ResizeObserver(() => { 
    resizeCanvas();
    // Update cart position if it exists and game is running
    if (cart && state.running) {
      // Use the same positioning logic as in Cart.reset()
      const groundOffset = canvas.height * 0.052;
      cart.y = state.groundY - groundOffset - cart.h;
    }
  });

  // Handle page visibility changes to prevent timing issues
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Reset lastTs when tab becomes hidden to prevent large deltaTime jump
      state.lastTs = 0;
    } else {
      // Reset lastTs when tab becomes visible again
      state.lastTs = 0;
    }
  });

  // Handle window blur/focus for better cross-browser support
  window.addEventListener('blur', () => {
    state.lastTs = 0;
  });

  window.addEventListener('focus', () => {
    state.lastTs = 0;
  });

  // Initialize front screen and game loop when page loads (same as folder 2)
  document.addEventListener('DOMContentLoaded', function() {
    initFrontScreen();
    initGame(); // Start game loop immediately
  });

})();
