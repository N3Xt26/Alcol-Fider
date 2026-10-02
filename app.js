// --- STATO ---
let currentMode = "NEAR",
  appState = "IDLE",
  isCalibrating = false,
  calibrationResolver = null;
let userCoords = null,
  deviceHeading = 0,
  currentSpeed = 0,
  currentCompassAccuracy = -1;
let hasCalibratedOnce = false;
let targetCoords = null,
  targetPlaceData = null,
  routePath = [],
  nextWaypoint = null;
let currentCandidates = [],
  currentCandidateIndex = 0;
let watchId = null;

const radiuses = [500, 1000, 2500, 5000];
let cachedPlaces = [],
  lastCacheCoords = null,
  lastCacheRadius = 0;
let hasVibrated = false;

let angle = 0,
  velocity = 0,
  lastTime = performance.now();
const SPIN_SPEED = -35,
  FRICTION = 0.94,
  SPRING_STIFF = 0.08,
  SPRING_SOFT = 0.02;

// Audio & Ticks Tracking in Physics Loop
let lastTickAngle = 0;
let lastTickTime = 0;

const bottleImg = document.getElementById("bottle-img");
const compassBox = document.getElementById("compass-box");
const iconSpin = document.getElementById("icon-spin");
const statusText = document.getElementById("status");
const targetText = document.getElementById("target-name");
const openingStatusEl = document.getElementById("opening-status");
const radiusCard = document.getElementById("radius-card");
const errorBox = document.getElementById("error-box");
const shareBtn = document.getElementById("btn-share");
const discardBtn = document.getElementById("btn-discard");
const mainBtn = document.getElementById("main-btn");

const soundBtn = document.getElementById("btn-sound");
const iconSound = document.getElementById("icon-sound");
const partyBtn = document.getElementById("btn-party");

const categoryChip = document.getElementById("btn-category");
const categoryChipIcon = document.getElementById("category-chip-icon");
const categoryChipLabel = document.getElementById("category-chip-label");
const categoryModal = document.getElementById("category-modal");
const closeCategoryBtn = document.getElementById("btn-close-category");
const categoryOptionBtns = document.querySelectorAll(".category-option-btn");

const drinkCounterBtn = document.getElementById("btn-drink-counter");
const drinkChipIcon = document.getElementById("drink-chip-icon");
const drinkChipCount = document.getElementById("drink-chip-count");

const drunkModal = document.getElementById("drunk-modal");
const closeDrunkBtn = document.getElementById("btn-close-drunk");
const drunkTapBtn = document.getElementById("btn-drunk-tap");
const drunkCountDisplay = document.getElementById("drunk-count-display");
const drunkLevelBadge = document.getElementById("drunk-level-badge");
const drunkMinusBtn = document.getElementById("btn-drunk-minus");
const drunkPlusBtn = document.getElementById("btn-drunk-plus");
const drunkResetBtn = document.getElementById("btn-drunk-reset");
const drunkToggleFxBtn = document.getElementById("btn-drunk-toggle-fx");

const partyModal = document.getElementById("party-modal");
const closePartyBtn = document.getElementById("btn-close-party");
const partyNameInput = document.getElementById("party-name-input");
const partyChipsList = document.getElementById("party-chips-list");
const partyWheelCanvas = document.getElementById("party-wheel-canvas");
const partyWinnerBanner = document.getElementById("party-winner-banner");
const partyWinnerName = document.getElementById("party-winner-name");
const spinWheelBtn = document.getElementById("btn-spin-wheel");
const partyDoneBtn = document.getElementById("btn-party-done");
const partyActionsRow = document.getElementById("party-actions-row");

const calibOverlay = document.getElementById("calibration-overlay");
const calibTitle = document.getElementById("calib-title");
const calibIconContainer = document.getElementById(
  "calib-icon-container",
);
const calibManualBtn = document.getElementById("calib-manual-btn");

// --- NUOVI STATI (Audio, Filtri, Blacklist, Party, Ubriacometro) ---
let isAudioMuted = localStorage.getItem("alcol_muted") === "true";
let currentCategory = "all";
const sessionBlacklist = new Set();

let drinkCount = parseInt(localStorage.getItem("alcol_drink_count") || "0", 10);
if (isNaN(drinkCount) || drinkCount < 0) drinkCount = 0;
let drunkEffectsEnabled = localStorage.getItem("alcol_drunk_effects") !== "false";

// --- SOUND ENGINE (Web Audio API) ---
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function updateSoundBtnUI() {
  if (!soundBtn) return;
  const toggleUI = document.getElementById("sound-toggle-ui");
  if (toggleUI) toggleUI.classList.toggle("active", !isAudioMuted);
  if (iconSound) {
    iconSound.setAttribute("data-lucide", isAudioMuted ? "volume-x" : "volume-2");
    lucide.createIcons();
  }
}

function toggleSound() {
  isAudioMuted = !isAudioMuted;
  localStorage.setItem("alcol_muted", isAudioMuted ? "true" : "false");
  updateSoundBtnUI();
  if (!isAudioMuted) {
    playTickSound(1.2);
  }
}

function playTickSound(pitchMultiplier = 1.0) {
  if (isAudioMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(650 * pitchMultiplier, now);
    osc.frequency.exponentialRampToValueAtTime(180 * pitchMultiplier, now + 0.03);
    
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.035);
  } catch (e) {}
}

function playWhooshSound() {
  if (isAudioMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.35);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.36);
  } catch (e) {}
}

function playSuccessChime() {
  if (isAudioMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.085;
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(start);
      osc.stop(start + 0.36);
    });
  } catch (e) {}
}

function playDiscardSound() {
  if (isAudioMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const notes = [420, 210];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.07;
      
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(start);
      osc.stop(start + 0.13);
    });
  } catch (e) {}
}

function playDrinkSound() {
  if (isAudioMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // Glass clink
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1400, now);
    osc1.frequency.exponentialRampToValueAtTime(700, now + 0.15);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.16);

    // Pop bubble
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(320, now + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(820, now + 0.14);
    gain2.gain.setValueAtTime(0.18, now + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.15);
  } catch (e) {}
}

function playSoberSound() {
  if (isAudioMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const notes = [659.25, 880, 1174.66]; // E5, A5, D6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + i * 0.08;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch (e) {}
}

function playCheersClinkSound() {
  if (isAudioMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // Crystal high-resonant glass bell clink (triad: 2250Hz, 3920Hz, 5874Hz)
    [2250, 3920, 5874].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.985, now + 0.85);
      const initialVol = idx === 0 ? 0.30 : (idx === 1 ? 0.16 : 0.08);
      gain.gain.setValueAtTime(initialVol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75 + idx * 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.85 + idx * 0.1);
    });
  } catch (e) {}
}

// --- FILTRO CATEGORIA ---
const categoryData = {
  all: { icon: "🍹", label: "Tutti i locali" },
  pub: { icon: "🍺", label: "Birrerie & Pub" },
  cocktail: { icon: "🍸", label: "Cocktail & Bar" },
  wine: { icon: "🍷", label: "Vinerie & Enoteche" },
  club: { icon: "🪩", label: "Club & Serata" }
};

function openCategoryModal() {
  if (categoryModal) categoryModal.classList.add("open");
}

function closeCategoryModal() {
  if (categoryModal) categoryModal.classList.remove("open");
}

function selectCategory(cat) {
  if (!categoryData[cat]) return;
  currentCategory = cat;
  if (categoryChipIcon) categoryChipIcon.innerText = categoryData[cat].icon;
  if (categoryChipLabel) categoryChipLabel.innerText = categoryData[cat].label;
  
  categoryOptionBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.cat === cat);
  });
  
  closeCategoryModal();

  if (appState === "TRACKING" && currentCandidates && currentCandidates.length > 0) {
    const currentValid = targetPlaceData && isCandidateValid(targetPlaceData);
    if (!currentValid) {
      selectNextPlace();
    }
  }
}

function matchesCategory(place, cat) {
  if (!cat || cat === "all") return true;
  const name = (place.name || (place.tags && place.tags.name) || "").toLowerCase();
  const amenity = (place.amenity || (place.tags && place.tags.amenity) || "").toLowerCase();
  const cuisine = ((place.tags && place.tags.cuisine) || "").toLowerCase();
  const fullText = `${name} ${amenity} ${cuisine}`;

  if (cat === "pub") {
    return (
      amenity === "pub" ||
      amenity === "biergarten" ||
      /pub|birr|brew|craft|spina|beer|ale|irish|tavern/i.test(fullText)
    );
  } else if (cat === "cocktail") {
    return (
      amenity === "bar" ||
      amenity === "cafe" ||
      /cocktail|lounge|mixolog|aperitiv|bistrot|bar|drink|spritz/i.test(fullText)
    );
  } else if (cat === "wine") {
    return (
      /enotec|vin[io]|wine|cantina|mescita|bottigli|calic|osteria/i.test(fullText)
    );
  } else if (cat === "club") {
    return (
      amenity === "nightclub" ||
      /club|disco|dancing|night|musica|dance|serata/i.test(fullText)
    );
  }
  return true;
}

function getPlaceUniqueId(place) {
  if (!place) return "";
  if (place.id) return String(place.id);
  const name = (place.name || (place.tags && place.tags.name) || "").toLowerCase().trim();
  const lat = Number(place.lat).toFixed(4);
  const lon = Number(place.lon).toFixed(4);
  return `${name}_${lat}_${lon}`;
}

function isCandidateValid(place) {
  if (!place) return false;
  const uid = getPlaceUniqueId(place);
  if (sessionBlacklist.has(uid)) return false;
  return matchesCategory(place, currentCategory);
}

// --- BLACKLIST TEMPORANEA (Scarta per stasera) ---
function discardCurrentPlace() {
  if (!targetPlaceData) return;
  const uid = getPlaceUniqueId(targetPlaceData);
  sessionBlacklist.add(uid);
  playDiscardSound();
  if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
  selectNextPlace();
}

// --- PARTY WHEEL (Chi Paga il Primo Giro?) ---
let partyFriends = ["Io", "Amico 1", "Amico 2"];
try {
  const savedFriends = localStorage.getItem("alcol_party_friends");
  if (savedFriends) {
    const parsed = JSON.parse(savedFriends);
    if (Array.isArray(parsed) && parsed.length >= 2) {
      partyFriends = parsed;
    }
  }
} catch (e) {}

let wheelAngle = 0;
let wheelVelocity = 0;
let isWheelSpinning = false;
let lastWheelTickIndex = -1;

const WHEEL_COLORS = [
  "#e07c6a", // Terracotta (Accent)
  "#85b494", // Sage Green (Green-med)
  "#e59866", // Warm Amber
  "#8eb05a", // Olive Green (Green-dark)
  "#c06c84", // Dusty Rose
  "#578e87", // Soft Slate Teal
  "#d4a373", // Warm Ochre Sand
  "#4b6584"  // Warm Slate Grey
];

function openPartyModal() {
  if (partyModal) {
    partyModal.classList.add("open");
    renderPartyChips();
    drawPartyWheel();
    if (partyWinnerBanner) partyWinnerBanner.classList.remove("visible");
    if (partyActionsRow) partyActionsRow.classList.remove("has-winner");
    if (partyDoneBtn) partyDoneBtn.style.display = "none";
    if (spinWheelBtn) {
      spinWheelBtn.innerHTML = '<i data-lucide="sparkles" width="16" height="16"></i> GIRA LA RUOTA!';
      lucide.createIcons();
    }
  }
}

function closePartyModal() {
  if (partyModal) partyModal.classList.remove("open");
}

function savePartyFriends() {
  try {
    localStorage.setItem("alcol_party_friends", JSON.stringify(partyFriends));
  } catch (e) {}
}

function renderPartyChips() {
  if (!partyChipsList) return;
  partyChipsList.innerHTML = "";
  partyFriends.forEach((friend, idx) => {
    const chip = document.createElement("div");
    chip.className = "party-chip";
    chip.innerHTML = `
      <span>${escapeHtml(friend)}</span>
      <button type="button" class="party-chip-del" onclick="removePartyFriend(${idx})" aria-label="Rimuovi">&times;</button>
    `;
    partyChipsList.appendChild(chip);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function addFriendFromInput() {
  if (!partyNameInput) return;
  const name = partyNameInput.value.trim();
  if (!name) return;
  if (partyFriends.length >= 16) {
    alert("Massimo 16 amici per la ruota!");
    return;
  }
  partyFriends.push(name);
  partyNameInput.value = "";
  savePartyFriends();
  renderPartyChips();
  drawPartyWheel();
}

function removePartyFriend(idx) {
  if (partyFriends.length <= 2) {
    alert("Servono almeno 2 amici per girare la ruota!");
    return;
  }
  partyFriends.splice(idx, 1);
  savePartyFriends();
  renderPartyChips();
  drawPartyWheel();
}

window.addFriendFromInput = addFriendFromInput;
window.removePartyFriend = removePartyFriend;

function drawPartyWheel() {
  if (!partyWheelCanvas) return;
  const ctx = partyWheelCanvas.getContext("2d");
  const width = partyWheelCanvas.width;
  const height = partyWheelCanvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) - 5;
  const numSlices = partyFriends.length;
  const sliceAngle = (2 * Math.PI) / numSlices;

  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(wheelAngle);

  for (let i = 0; i < numSlices; i++) {
    const startA = i * sliceAngle;
    const endA = startA + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, startA, endA);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.save();
    ctx.rotate(startA + sliceAngle / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 3;

    let label = partyFriends[i];
    if (label.length > 9) label = label.substring(0, 8) + "…";
    ctx.fillText(label, radius - 12, 0);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#f8f6f4";
  ctx.stroke();

  ctx.font = "15px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 0;
  ctx.fillText("🍻", 0, 1);

  ctx.restore();
}

function spinPartyWheel() {
  if (isWheelSpinning || partyFriends.length < 2) return;
  isWheelSpinning = true;
  if (spinWheelBtn) spinWheelBtn.disabled = true;
  if (partyWinnerBanner) partyWinnerBanner.classList.remove("visible");
  if (partyActionsRow) partyActionsRow.classList.remove("has-winner");
  if (partyDoneBtn) partyDoneBtn.style.display = "none";

  playWhooshSound();
  if (navigator.vibrate) navigator.vibrate(30);

  wheelVelocity = 0.35 + Math.random() * 0.25;
  lastWheelTickIndex = -1;

  function animateWheel() {
    wheelAngle += wheelVelocity;
    wheelVelocity *= 0.983;

    const numSlices = partyFriends.length;
    const sliceAngle = (2 * Math.PI) / numSlices;
    const pointerAngle = (3 * Math.PI / 2 - (wheelAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const currentSlice = Math.floor(pointerAngle / sliceAngle) % numSlices;

    if (currentSlice !== lastWheelTickIndex) {
      lastWheelTickIndex = currentSlice;
      playTickSound(1.1);
      if (navigator.vibrate && wheelVelocity > 0.04) navigator.vibrate(6);
    }

    drawPartyWheel();

    if (wheelVelocity > 0.002) {
      requestAnimationFrame(animateWheel);
    } else {
      isWheelSpinning = false;
      if (spinWheelBtn) spinWheelBtn.disabled = false;

      const winnerIndex = currentSlice;
      const winner = partyFriends[winnerIndex];

      if (partyWinnerName) partyWinnerName.innerText = winner;
      if (partyWinnerBanner) partyWinnerBanner.classList.add("visible");
      if (partyActionsRow) partyActionsRow.classList.add("has-winner");
      if (partyDoneBtn) partyDoneBtn.style.display = "inline-flex";
      if (spinWheelBtn) {
        spinWheelBtn.innerHTML = '<i data-lucide="rotate-cw" width="16" height="16"></i> RIGIRA';
        lucide.createIcons();
      }

      playSuccessChime();
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
    }
  }

  requestAnimationFrame(animateWheel);
}

// --- UBRIACOMETRO & DRUNK UI (BUMP STYLE) ---
const drunkMilestones = [
  { max: 0, text: "Sobrio 😇", color: "#2f3542", bg: "#f1f2f6", icon: "🍺" },
  { max: 2, text: "Un po' brillo ✨", color: "#d35400", bg: "#fef5e7", icon: "🍻" },
  { max: 4, text: "Bello allegro 🥳", color: "#c0392b", bg: "#fdedec", icon: "🍹" },
  { max: 6, text: "Molto sbronzo 😵‍💫", color: "#8e44ad", bg: "#f4ecf7", icon: "🍾" },
  { max: 9999, text: "In orbita 🚀", color: "#2c3e50", bg: "#ebedef", icon: "🛸" },
];

function getDrunkMilestone(count) {
  for (const m of drunkMilestones) {
    if (count <= m.max) return m;
  }
  return drunkMilestones[drunkMilestones.length - 1];
}

let bumpShakeTimer = null;
function triggerBumpShake() {
  document.body.classList.remove("bump-shake-active");
  void document.body.offsetWidth; // force reflow
  document.body.classList.add("bump-shake-active");
  if (bumpShakeTimer) clearTimeout(bumpShakeTimer);
  bumpShakeTimer = setTimeout(() => {
    document.body.classList.remove("bump-shake-active");
  }, 340);
}

function updateDrunkUI() {
  const milestone = getDrunkMilestone(drinkCount);

  // Update Header Chip
  if (drinkChipCount) {
    drinkChipCount.innerText = `${drinkCount} drink`;
  }
  if (drinkChipIcon) {
    drinkChipIcon.innerText = milestone.icon;
  }
  if (drinkCounterBtn) {
    drinkCounterBtn.classList.toggle("drunk-active", drinkCount > 0);
  }

  // Update Modal elements
  if (drunkCountDisplay) {
    drunkCountDisplay.innerText = drinkCount;
  }
  if (drunkLevelBadge) {
    drunkLevelBadge.innerText = milestone.text;
    drunkLevelBadge.style.color = milestone.color;
    drunkLevelBadge.style.backgroundColor = milestone.bg;
  }
  if (drunkToggleFxBtn) {
    drunkToggleFxBtn.classList.toggle("active", drunkEffectsEnabled);
    drunkToggleFxBtn.setAttribute("aria-checked", drunkEffectsEnabled ? "true" : "false");
  }

  // Update Drunk Classes on Body
  document.body.classList.remove("drunk-lvl-1", "drunk-lvl-2", "drunk-lvl-3", "drunk-lvl-4");
  if (drunkEffectsEnabled && drinkCount > 0) {
    if (drinkCount <= 2) {
      document.body.classList.add("drunk-lvl-1");
    } else if (drinkCount <= 4) {
      document.body.classList.add("drunk-lvl-2");
    } else if (drinkCount <= 6) {
      document.body.classList.add("drunk-lvl-3");
    } else {
      document.body.classList.add("drunk-lvl-4");
    }
  }
}

let diplopiaActive = false;
let diplopiaTimer = null;
let ghostBottleImg = null;

function initDiplopiaGhost() {
  const ghost = document.getElementById("drunk-diplopia-ghost");
  const ghostCompass = document.getElementById("drunk-ghost-compass");
  if (ghost && ghostCompass && !ghostBottleImg) {
    const liveImg = document.getElementById("bottle-img");
    if (liveImg) {
      ghostBottleImg = document.createElement("img");
      ghostBottleImg.src = liveImg.src;
      ghostBottleImg.className = liveImg.className || "";
      ghostBottleImg.alt = "";
      ghostBottleImg.setAttribute("aria-hidden", "true");
      ghostCompass.appendChild(ghostBottleImg);
    }
  }
}

function syncDiplopiaContent() {
  const ghost = document.getElementById("drunk-diplopia-ghost");
  const liveHeader = document.querySelector("#section-stage header");
  if (!ghost || !liveHeader) return;

  let ghostHeader = ghost.querySelector(".drunk-ghost-header");
  if (!ghostHeader) {
    ghostHeader = document.createElement("header");
    ghostHeader.className = "drunk-ghost-header";
    ghost.insertBefore(ghostHeader, ghost.firstChild);
  }
  ghostHeader.innerHTML = liveHeader.innerHTML;
  ghostHeader.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
}

function triggerDiplopia() {
  if (!drunkEffectsEnabled || drinkCount <= 0) {
    clearDiplopia();
    return;
  }
  initDiplopiaGhost();
  syncDiplopiaContent();

  const ghost = document.getElementById("drunk-diplopia-ghost");
  if (!ghost) return;

  const effective = Math.min(drinkCount, 8);

  const shiftX = -Math.round(2 + effective * 0.8);
  const shiftY = Math.round(3 + effective * 1.0);
  const rotDeg = -(0.3 + effective * 0.12).toFixed(2);

  const opacityVal = Math.min(0.62, 0.36 + effective * 0.045).toFixed(2);

  ghost.style.setProperty("--diplopia-x", `${shiftX}px`);
  ghost.style.setProperty("--diplopia-y", `${shiftY}px`);
  ghost.style.setProperty("--diplopia-rot", `${rotDeg}deg`);
  ghost.style.setProperty("--diplopia-opacity", opacityVal);

  ghost.classList.remove("diplopia-active");
  void ghost.offsetWidth; // force reflow
  ghost.classList.add("diplopia-active");
  diplopiaActive = true;

  if (diplopiaTimer) clearTimeout(diplopiaTimer);
  diplopiaTimer = setTimeout(() => {
    diplopiaActive = false;
    ghost.classList.remove("diplopia-active");
  }, 4200);
}

function clearDiplopia() {
  diplopiaActive = false;
  if (diplopiaTimer) clearTimeout(diplopiaTimer);
  const ghost = document.getElementById("drunk-diplopia-ghost");
  if (ghost) {
    ghost.classList.remove("diplopia-active");
  }
}

function triggerModalDiplopia() {
  const drunkHero = document.querySelector(".drunk-main-hero");
  if (drunkHero) {
    drunkHero.classList.remove("modal-diplopia-active");
    void drunkHero.offsetWidth;
    drunkHero.classList.add("modal-diplopia-active");
  }
}

function openDrunkModal() {
  if (drunkModal) drunkModal.classList.add("open");
}

function closeDrunkModal() {
  if (drunkModal) drunkModal.classList.remove("open");
  if (drunkEffectsEnabled && drinkCount > 0) {
    targetBeerLevel = getBeerTargetLevel(drinkCount);
    beerLevel = targetBeerLevel; // La birra deve già essere stata versata alla chiusura del pannello!
    beerState = "SETTLED";
    sloshImpulse = Math.max(sloshImpulse, 14);
    beerPourTimer = 5000;
    startBeerLoop();
    triggerDiplopia();
  }
}

function addDrink() {
  drinkCount++;
  localStorage.setItem("alcol_drink_count", drinkCount);
  playDrinkSound();
  triggerBumpShake();
  if (navigator.vibrate) navigator.vibrate(35);
  updateDrunkUI();
  if (drunkEffectsEnabled) {
    triggerBeerPour(drinkCount);
  }
}

function removeDrink() {
  if (drinkCount > 0) {
    drinkCount--;
    localStorage.setItem("alcol_drink_count", drinkCount);
    if (navigator.vibrate) navigator.vibrate(15);
    updateDrunkUI();
    if (drunkEffectsEnabled) {
      triggerBeerPour(drinkCount);
    }
  }
}

function resetDrinks() {
  drinkCount = 0;
  localStorage.setItem("alcol_drink_count", "0");
  playSoberSound();
  if (navigator.vibrate) navigator.vibrate([40, 30, 80]);
  updateDrunkUI();
  drainBeerImmediate();
  clearDiplopia();
}

function toggleDrunkEffects() {
  drunkEffectsEnabled = !drunkEffectsEnabled;
  localStorage.setItem("alcol_drunk_effects", drunkEffectsEnabled ? "true" : "false");
  if (navigator.vibrate) navigator.vibrate(20);
  updateDrunkUI();
  if (!drunkEffectsEnabled) {
    drainBeerImmediate();
    clearDiplopia();
  }
}

// --- SIMULAZIONE LIQUIDO BIRRA PREMIUM (HYPER-REACTIVE TILT & 3D ARTISANAL BEER) ---
const beerCanvas = document.getElementById("beer-canvas");
const beerCtx = beerCanvas ? beerCanvas.getContext("2d") : null;

let beerState = "IDLE"; // 'IDLE' | 'POURING' | 'SETTLED' | 'DRAINING'
let beerLevel = 0; // Livello liquido (0.0 to 1.0)
let targetBeerLevel = 0; // Livello desiderato
let beerPourTimer = 0; // Timer prima dello svuotamento
let beerDeviceRoll = 0; // Roll inclinazione laterale (-90 a +90)
let prevDeviceRoll = 0;
let rollVelocity = 0; // Velocità di inclinazione (per slosh impulse)
let sloshImpulse = 0; // Impulso turbolenza da scuotimento
let liquidTilt = 0; // Inclinazione superficie (radianti)
let liquidTiltVel = 0; // Velocità angolare
let waveTime = 0;
let beerBubbles = []; // Bollicine perlage con highlight 3D
let beerCondensation = []; // Goccioline di condensa sul vetro
let lastBeerTime = performance.now();
let beerAnimationId = null;

// Inizializzazione perlage (colonne di bollicine che salgono dai punti di nucleazione)
function initBeerBubbles(count = 46) {
  beerBubbles = [];
  const nucleationPoints = [0.12, 0.28, 0.45, 0.62, 0.78, 0.90];
  for (let i = 0; i < count; i++) {
    const nuc = nucleationPoints[i % nucleationPoints.length] + (Math.random() * 0.08 - 0.04);
    beerBubbles.push({
      nucX: Math.max(0.04, Math.min(0.96, nuc)),
      y: Math.random(),
      radius: 0.9 + Math.random() * 2.4,
      speed: 0.16 + Math.random() * 0.28,
      swaySpeed: 1.8 + Math.random() * 3.2,
      swayAmp: 1.8 + Math.random() * 3.6,
      opacity: 0.45 + Math.random() * 0.45,
      seed: Math.random() * 50,
    });
  }
}

// Inizializzazione goccioline di condensa sul vetro (effetto bicchiere ghiacciato)
function initBeerCondensation(count = 32) {
  beerCondensation = [];
  for (let i = 0; i < count; i++) {
    beerCondensation.push({
      x: 0.03 + Math.random() * 0.94,
      y: 0.05 + Math.random() * 0.90,
      r: 1.2 + Math.random() * 2.8,
      opacity: 0.25 + Math.random() * 0.45,
    });
  }
}

function resizeBeerCanvas() {
  if (!beerCanvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  beerCanvas.width = Math.round(w * dpr);
  beerCanvas.height = Math.round(h * dpr);
  if (beerCtx) {
    beerCtx.setTransform(1, 0, 0, 1, 0, 0);
    beerCtx.scale(dpr, dpr);
  }
}

window.addEventListener("resize", resizeBeerCanvas, { passive: true });
window.addEventListener("orientationchange", () => setTimeout(resizeBeerCanvas, 150), { passive: true });
resizeBeerCanvas();
initBeerBubbles();
initBeerCondensation();

// Rilevamento orientamento ad altissima reattività
window.addEventListener(
  "deviceorientation",
  (e) => {
    if (typeof e.gamma === "number") {
      const now = performance.now();
      const dt = Math.max(0.008, (now - lastBeerTime) / 1000);
      prevDeviceRoll = beerDeviceRoll;
      beerDeviceRoll = e.gamma;
      rollVelocity = (beerDeviceRoll - prevDeviceRoll) / dt;
      sloshImpulse = Math.min(18, sloshImpulse + Math.abs(rollVelocity) * 0.012);
    }
  },
  true,
);

// Supporto interattivo anche da desktop muovendo il mouse
let lastMouseX = null;
let lastMouseTime = performance.now();
window.addEventListener(
  "mousemove",
  (e) => {
    if (!window.DeviceOrientationEvent || !("ontouchstart" in window)) {
      const now = performance.now();
      const dt = Math.max(0.01, (now - lastMouseTime) / 1000);
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      prevDeviceRoll = beerDeviceRoll;
      beerDeviceRoll = normX * 48;
      if (lastMouseX !== null) {
        const mouseVel = (e.clientX - lastMouseX) / dt;
        sloshImpulse = Math.min(18, sloshImpulse + Math.abs(mouseVel) * 0.008);
      }
      lastMouseX = e.clientX;
      lastMouseTime = now;
    }
  },
  { passive: true },
);

function getBeerTargetLevel(drinks) {
  if (!drunkEffectsEnabled || drinks <= 0) return 0;
  const levels = [0, 0.24, 0.40, 0.55, 0.68, 0.80, 0.90, 0.96];
  return drinks < levels.length ? levels[drinks] : 0.96;
}

function triggerBeerPour(drinks) {
  if (!drunkEffectsEnabled || drinks <= 0) {
    drainBeerImmediate();
    return;
  }
  targetBeerLevel = getBeerTargetLevel(drinks);
  beerState = "POURING";
  sloshImpulse = Math.max(sloshImpulse, 14);
  beerPourTimer = 4500;
  startBeerLoop();
}

function drainBeerImmediate() {
  targetBeerLevel = 0;
  beerState = "DRAINING";
  startBeerLoop();
}

function startBeerLoop() {
  if (!beerAnimationId) {
    lastBeerTime = performance.now();
    beerAnimationId = requestAnimationFrame(renderBeerFrame);
  }
}

function renderBeerFrame(now) {
  const dt = Math.min((now - lastBeerTime) / 1000, 0.08);
  lastBeerTime = now;
  waveTime += dt;

  const w = window.innerWidth;
  const h = window.innerHeight;

  // Gestione stati del liquido
  if (beerState === "POURING") {
    beerLevel += (targetBeerLevel - beerLevel) * Math.min(1, 4.2 * dt);
    if (Math.abs(targetBeerLevel - beerLevel) < 0.012) {
      beerLevel = targetBeerLevel;
      beerState = "SETTLED";
    }
  } else if (beerState === "SETTLED") {
    beerPourTimer -= dt * 1000;
    if (beerPourTimer <= 0) {
      beerState = "DRAINING";
      targetBeerLevel = 0;
    }
  } else if (beerState === "DRAINING") {
    const drainSpeed = Math.max(0.09, beerLevel * 0.36);
    beerLevel -= drainSpeed * dt;
    if (beerLevel <= 0.005) {
      beerLevel = 0;
      beerState = "IDLE";
    }
  }

  // Se vuoto e a riposo, ferma il loop
  if (beerState === "IDLE" && beerLevel <= 0) {
    if (beerCtx) beerCtx.clearRect(0, 0, w, h);
    beerAnimationId = null;
    return;
  }

  // --- FISICA REATTIVA DI INCLINAZIONE & SLOSH (MOLTO PIÙ REATTIVA) ---
  const maxTiltRad = 1.11; // ~64 gradi
  const targetTilt = -Math.max(-maxTiltRad, Math.min(maxTiltRad, (beerDeviceRoll || 0) * (Math.PI / 180)));
  const tiltDiff = targetTilt - liquidTilt;

  liquidTiltVel += (tiltDiff * 28.0 + rollVelocity * 0.08) * dt;
  liquidTiltVel *= Math.pow(0.79, dt * 60);
  liquidTilt += liquidTiltVel * dt;

  sloshImpulse *= Math.pow(0.92, dt * 60);

  if (beerCtx) {
    beerCtx.clearRect(0, 0, w, h);

    const baseY = h * (1.0 - beerLevel);
    const tanTilt = Math.tan(liquidTilt);
    const baseWaveAmp = ((beerState === "POURING" ? 14 : 7) + sloshImpulse * 0.8) * Math.min(1, beerLevel * 2.2);

    const numPoints = 36;
    const stepX = w / numPoints;

    const frontPoints = [];
    const backPoints = [];

    for (let i = 0; i <= numPoints; i++) {
      const x = i * stepX;
      const normX = (x - w / 2);
      const tiltOffset = normX * tanTilt;
      const wallClimb = Math.pow(Math.abs(normX) / (w / 2), 2) * (liquidTilt * (normX > 0 ? -12 : 12));

      const fWave1 = Math.sin(x * 0.016 + waveTime * 3.6) * baseWaveAmp;
      const fWave2 = Math.cos(x * 0.034 - waveTime * 2.4) * (baseWaveAmp * 0.45);
      const frontY = Math.max(-30, Math.min(h + 30, baseY + tiltOffset + fWave1 + fWave2 + wallClimb));
      frontPoints.push({ x, y: frontY });

      const bWave1 = Math.sin(x * 0.016 + waveTime * 3.6 + 1.25) * (baseWaveAmp * 0.85);
      const bWave2 = Math.cos(x * 0.034 - waveTime * 2.4 + 0.9) * (baseWaveAmp * 0.4);
      const backY = Math.max(-30, Math.min(h + 30, baseY + tiltOffset - 10 + bWave1 + bWave2));
      backPoints.push({ x, y: backY });
    }

    beerCtx.save();

    // 1. ONDA POSTERIORE (3D DEPTH LAYER)
    beerCtx.beginPath();
    beerCtx.moveTo(0, h);
    beerCtx.lineTo(backPoints[0].x, backPoints[0].y);
    for (let i = 1; i < backPoints.length; i++) {
      const prev = backPoints[i - 1];
      const curr = backPoints[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      beerCtx.quadraticCurveTo(prev.x, prev.y, midX, midY);
    }
    beerCtx.lineTo(w, backPoints[backPoints.length - 1].y);
    beerCtx.lineTo(w, h);
    beerCtx.closePath();

    const backBeerGrad = beerCtx.createLinearGradient(0, baseY - 40, 0, h);
    backBeerGrad.addColorStop(0, "rgba(215, 120, 10, 0.22)");
    backBeerGrad.addColorStop(1, "rgba(175, 75, 5, 0.35)");
    beerCtx.fillStyle = backBeerGrad;
    beerCtx.fill();

    beerCtx.lineWidth = 4;
    beerCtx.strokeStyle = "rgba(255, 245, 215, 0.40)";
    beerCtx.stroke();

    // 2. ONDA ANTERIORE (CORPO BIRRA AMBRATO CRISTALLINO)
    beerCtx.beginPath();
    beerCtx.moveTo(0, h);
    beerCtx.lineTo(frontPoints[0].x, frontPoints[0].y);
    for (let i = 1; i < frontPoints.length; i++) {
      const prev = frontPoints[i - 1];
      const curr = frontPoints[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      beerCtx.quadraticCurveTo(prev.x, prev.y, midX, midY);
    }
    beerCtx.lineTo(w, frontPoints[frontPoints.length - 1].y);
    beerCtx.lineTo(w, h);
    beerCtx.closePath();

    const frontBeerGrad = beerCtx.createLinearGradient(0, baseY - 60, 0, h);
    frontBeerGrad.addColorStop(0, "rgba(255, 225, 75, 0.32)");
    frontBeerGrad.addColorStop(0.3, "rgba(245, 175, 22, 0.36)");
    frontBeerGrad.addColorStop(0.7, "rgba(228, 135, 12, 0.40)");
    frontBeerGrad.addColorStop(1, "rgba(195, 95, 5, 0.45)");
    beerCtx.fillStyle = frontBeerGrad;
    beerCtx.fill();

    // Lustro / riflesso caustico della luce interna
    const causticX = w * (0.5 - liquidTilt * 0.35);
    const causticGrad = beerCtx.createRadialGradient(causticX, baseY + 60, 10, causticX, baseY + 90, w * 0.65);
    causticGrad.addColorStop(0, "rgba(255, 240, 150, 0.18)");
    causticGrad.addColorStop(0.6, "rgba(255, 210, 80, 0.06)");
    causticGrad.addColorStop(1, "rgba(255, 180, 20, 0)");
    beerCtx.fillStyle = causticGrad;
    beerCtx.fill();

    // 3. PERLAGE EFFERVESCENTE 3D (BOLLICINE REALISTICHE)
    for (let b of beerBubbles) {
      b.y -= b.speed * dt;
      if (b.y < 0) b.y = 1.0;

      const bx = (b.nucX * w + Math.sin(waveTime * b.swaySpeed + b.seed) * b.swayAmp);
      const by = baseY + (h - baseY) * b.y;
      const surfY = baseY + (bx - w / 2) * tanTilt;

      if (by > surfY + 8 && by < h) {
        beerCtx.beginPath();
        beerCtx.arc(bx, by, b.radius, 0, Math.PI * 2);
        beerCtx.fillStyle = `rgba(255, 242, 200, ${b.opacity * 0.7})`;
        beerCtx.fill();

        beerCtx.beginPath();
        beerCtx.arc(bx - b.radius * 0.35, by - b.radius * 0.35, b.radius * 0.42, 0, Math.PI * 2);
        beerCtx.fillStyle = `rgba(255, 255, 255, ${b.opacity * 0.95})`;
        beerCtx.fill();
      }
    }

    // 4. CORONA DI SCHIUMA CREMOSA ARTIGIANALE (FOAM HEAD)
    const foamThickness = 14 + Math.min(10, beerLevel * 10) + (beerState === "POURING" ? 8 : 0);

    beerCtx.beginPath();
    beerCtx.moveTo(frontPoints[0].x, frontPoints[0].y);
    for (let i = 1; i < frontPoints.length; i++) {
      const prev = frontPoints[i - 1];
      const curr = frontPoints[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      beerCtx.quadraticCurveTo(prev.x, prev.y, midX, midY);
    }
    for (let i = frontPoints.length - 1; i >= 0; i--) {
      const pt = frontPoints[i];
      beerCtx.lineTo(pt.x, Math.min(h, pt.y + foamThickness));
    }
    beerCtx.closePath();

    const foamGrad = beerCtx.createLinearGradient(0, baseY - 15, 0, baseY + foamThickness + 10);
    foamGrad.addColorStop(0, "rgba(255, 255, 252, 0.88)");
    foamGrad.addColorStop(0.35, "rgba(255, 250, 230, 0.72)");
    foamGrad.addColorStop(0.75, "rgba(255, 240, 195, 0.42)");
    foamGrad.addColorStop(1, "rgba(245, 220, 150, 0.08)");
    beerCtx.fillStyle = foamGrad;
    beerCtx.fill();

    beerCtx.beginPath();
    beerCtx.moveTo(frontPoints[0].x, frontPoints[0].y);
    for (let i = 1; i < frontPoints.length; i++) {
      const prev = frontPoints[i - 1];
      const curr = frontPoints[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      beerCtx.quadraticCurveTo(prev.x, prev.y, midX, midY);
    }
    beerCtx.lineWidth = 2.5;
    beerCtx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    beerCtx.stroke();

    for (let i = 0; i < frontPoints.length; i += 2) {
      const pt = frontPoints[i];
      const r = 3.0 + Math.sin(i * 1.5 + waveTime * 2.5) * 1.8 + Math.cos(i * 0.8) * 1.2;
      beerCtx.beginPath();
      beerCtx.arc(pt.x, pt.y - 1, Math.max(1.5, r), 0, Math.PI * 2);
      beerCtx.fillStyle = "rgba(255, 255, 250, 0.88)";
      beerCtx.fill();

      beerCtx.beginPath();
      beerCtx.arc(pt.x, pt.y + r * 0.6, r * 0.7, 0, Math.PI * 2);
      beerCtx.fillStyle = "rgba(240, 215, 160, 0.35)";
      beerCtx.fill();
    }

    // 5. GOCCE DI CONDENSA SUL VETRO (FROSTED GLASS EFFECT)
    if (beerLevel > 0.1) {
      for (let c of beerCondensation) {
        const cx = c.x * w;
        const cy = c.y * h;
        const localSurfY = baseY + (cx - w / 2) * tanTilt;
        if (cy > localSurfY - 140 && cy < h - 40) {
          beerCtx.beginPath();
          beerCtx.arc(cx + 0.8, cy + 0.8, c.r, 0, Math.PI * 2);
          beerCtx.fillStyle = `rgba(0, 0, 0, ${c.opacity * 0.15})`;
          beerCtx.fill();

          beerCtx.beginPath();
          beerCtx.arc(cx, cy, c.r, 0, Math.PI * 2);
          beerCtx.fillStyle = `rgba(255, 255, 255, ${c.opacity * 0.40})`;
          beerCtx.fill();

          beerCtx.beginPath();
          beerCtx.arc(cx - c.r * 0.35, cy - c.r * 0.35, c.r * 0.35, 0, Math.PI * 2);
          beerCtx.fillStyle = `rgba(255, 255, 255, ${c.opacity * 0.85})`;
          beerCtx.fill();
        }
      }
    }

    beerCtx.restore();
  }

  beerAnimationId = requestAnimationFrame(renderBeerFrame);
}

// --- SENSORI ---
let compassNeedsCalib = false;
window.addEventListener("compassneedscalibration", (e) => {
  compassNeedsCalib = true;
});

if (window.DeviceOrientationEvent && "ontouchstart" in window) {
  window.addEventListener(
    "deviceorientationabsolute",
    (e) => {
      if (e.alpha !== null && currentSpeed < 1)
        deviceHeading = 360 - e.alpha;
    },
    true,
  );

  window.addEventListener(
    "deviceorientation",
    (e) => {
      if (typeof e.webkitCompassAccuracy === "number" && e.webkitCompassAccuracy >= 0) {
        currentCompassAccuracy = e.webkitCompassAccuracy;
        if (currentCompassAccuracy > 25) {
          compassNeedsCalib = true;
        } else if (currentCompassAccuracy <= 15) {
          compassNeedsCalib = false;
          if (isCalibrating) completeCalibrationSuccess();
        }
      }
      if (currentSpeed > 1) return;
      if (!e.absolute && e.webkitCompassHeading)
        deviceHeading = e.webkitCompassHeading;
      else if (!e.absolute && e.alpha) deviceHeading = 360 - e.alpha;
    },
    true,
  );
}

// --- EVENTI UI ---
document
  .getElementById("btn-near")
  .addEventListener("click", () => setMode("NEAR"));
document
  .getElementById("btn-random")
  .addEventListener("click", () => setMode("RANDOM"));

function handleMainAction() {
  if (mainBtn.disabled) return;
  getAudioContext();
  requestMotionPermission();
  if (appState === "TRACKING" && currentCandidates && currentCandidates.length > 0) {
    selectNextPlace();
  } else {
    startFlow();
  }
}

mainBtn.addEventListener("click", handleMainAction);
compassBox.addEventListener("click", handleMainAction);
calibManualBtn.addEventListener("click", completeCalibrationSuccess);

shareBtn.addEventListener("click", () => {
  if (!targetPlaceData) return;
  const name = (targetPlaceData.tags && targetPlaceData.tags.name) || targetPlaceData.name || "Locale misterioso";
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${targetPlaceData.lat},${targetPlaceData.lon}`;
  const msg = `La bottiglia ha parlato! Andiamo qui: ${name} 🍻 ${mapUrl}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
});

if (discardBtn) discardBtn.addEventListener("click", discardCurrentPlace);
if (soundBtn) soundBtn.addEventListener("click", toggleSound);

// Menu interactions
const btnMenu = document.getElementById("btn-menu");
const sideMenu = document.getElementById("side-menu");
const sideMenuOverlay = document.getElementById("side-menu-overlay");
const btnCloseMenu = document.getElementById("btn-close-menu");

function openSideMenu() {
  if(sideMenu) sideMenu.classList.add("open");
  if(sideMenuOverlay) sideMenuOverlay.classList.add("open");
}
function closeSideMenu() {
  if(sideMenu) sideMenu.classList.remove("open");
  if(sideMenuOverlay) sideMenuOverlay.classList.remove("open");
}
if(btnMenu) btnMenu.addEventListener("click", openSideMenu);
if(btnCloseMenu) btnCloseMenu.addEventListener("click", closeSideMenu);
if(sideMenuOverlay) sideMenuOverlay.addEventListener("click", closeSideMenu);

if (partyBtn) partyBtn.addEventListener("click", openPartyModal);
if (closePartyBtn) closePartyBtn.addEventListener("click", closePartyModal);
if (partyModal) {
  partyModal.addEventListener("click", (e) => {
    if (e.target === partyModal) closePartyModal();
  });
}
if (spinWheelBtn) spinWheelBtn.addEventListener("click", spinPartyWheel);
if (partyDoneBtn) {
  partyDoneBtn.addEventListener("click", () => {
    closePartyModal();
    handleMainAction();
  });
}

if (categoryChip) categoryChip.addEventListener("click", openCategoryModal);
if (closeCategoryBtn) closeCategoryBtn.addEventListener("click", closeCategoryModal);
if (categoryModal) {
  categoryModal.addEventListener("click", (e) => {
    if (e.target === categoryModal) closeCategoryModal();
  });
}
categoryOptionBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectCategory(btn.dataset.cat);
  });
});

if (drinkCounterBtn) drinkCounterBtn.addEventListener("click", openDrunkModal);
if (closeDrunkBtn) closeDrunkBtn.addEventListener("click", closeDrunkModal);
if (drunkModal) {
  drunkModal.addEventListener("click", (e) => {
    if (e.target === drunkModal) closeDrunkModal();
  });
}
if (drunkTapBtn) drunkTapBtn.addEventListener("click", addDrink);
if (drunkPlusBtn) drunkPlusBtn.addEventListener("click", addDrink);
if (drunkMinusBtn) drunkMinusBtn.addEventListener("click", removeDrink);
if (drunkResetBtn) drunkResetBtn.addEventListener("click", resetDrinks);
if (drunkToggleFxBtn) drunkToggleFxBtn.addEventListener("click", toggleDrunkEffects);

updateSoundBtnUI();
updateDrunkUI();
drawPartyWheel();
lucide.createIcons();
requestAnimationFrame(physicsLoop);

// --- LOGICA DI FLUSSO ---

async function startFlow() {
  if (mainBtn.disabled) return;
  resetUI();
  mainBtn.disabled = true;

  getAudioContext();
  playWhooshSound();

  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    try {
      await DeviceOrientationEvent.requestPermission();
    } catch (e) {}
  }
  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
    try {
      await DeviceMotionEvent.requestPermission();
      initDeviceMotionListener();
    } catch (e) {}
  }

  targetText.innerHTML = "Controllo sensori...";

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      userCoords = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      };
      const needsCalib = compassNeedsCalib && !hasCalibratedOnce;
      if (needsCalib) await showCalibrationScreen();
      executeSearch();
    },
    () => showError("Attiva il GPS."),
    { enableHighAccuracy: true, timeout: 5000 },
  );
}

function showCalibrationScreen() {
  return new Promise((resolve) => {
    isCalibrating = true;
    calibrationResolver = resolve;
    calibOverlay.style.display = "flex";
    calibTitle.innerText = "Calibrazione...";
    calibManualBtn.classList.remove("visible");
    calibIconContainer.innerHTML =
      '<i data-lucide="rotate-3d" class="calib-icon spinning" width="64" height="64"></i>';
    lucide.createIcons();
    setTimeout(() => {
      if (isCalibrating) calibManualBtn.classList.add("visible");
    }, 3000);
  });
}

function completeCalibrationSuccess() {
  if (!isCalibrating) return;
  calibIconContainer.innerHTML =
    '<i data-lucide="check-circle" class="calib-icon success" width="64" height="64"></i>';
  lucide.createIcons();
  calibTitle.innerText = "Calibrata!";
  calibManualBtn.classList.remove("visible");
  playSuccessChime();
  if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
  setTimeout(() => {
    isCalibrating = false;
    hasCalibratedOnce = true;
    calibOverlay.style.display = "none";
    if (calibrationResolver) {
      calibrationResolver();
      calibrationResolver = null;
    }
  }, 1200);
}

async function executeSearch() {
  appState = "SEARCHING";
  iconSpin.classList.add("searching-anim");
  targetText.innerHTML = "Cerco locali...";
  playWhooshSound();
  velocity = SPIN_SPEED;
  fetchPlaces();
}

function setMode(mode) {
  currentMode = mode;
  cachedPlaces = [];
  lastCacheCoords = null;
  document
    .getElementById("btn-near")
    .classList.toggle("active", mode === "NEAR");
  document
    .getElementById("btn-random")
    .classList.toggle("active", mode === "RANDOM");
  radiusCard.classList.toggle("active", mode === "RANDOM");
  resetUI();
}

function resetUI() {
  appState = "IDLE";
  velocity = 0;
  nextWaypoint = null;
  routePath = [];
  targetPlaceData = null;
  targetText.innerHTML = "Hai sete?";
  statusText.innerHTML =
    currentMode === "NEAR"
      ? "Troverò il locale più vicino."
      : "Troverò un locale a sorpresa.";
  iconSpin.classList.remove("searching-anim");
  if (openingStatusEl) openingStatusEl.innerHTML = "";
  shareBtn.classList.remove("visible");
  if (discardBtn) discardBtn.classList.remove("visible");
  compassBox.style.boxShadow = "0 10px 40px rgba(0, 0, 0, 0.04)";
  compassBox.style.borderColor = "white";
  mainBtn.disabled = false;
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

async function fetchWithTimeout(resource, options = {}, timeoutMs = 3500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function fetchPlaces() {
  const radiusIndex = document.getElementById("radius-slider").value;
  const radius = currentMode === "NEAR" ? 2000 : radiuses[radiusIndex];

  let useCache = false;
  if (
    cachedPlaces.length > 0 &&
    lastCacheCoords &&
    lastCacheRadius === radius
  ) {
    const distFromCache = getDist(
      userCoords.lat,
      userCoords.lon,
      lastCacheCoords.lat,
      lastCacheCoords.lon,
    );
    if (distFromCache < 100) useCache = true;
  }

  let places = [];
  if (useCache) {
    places = cachedPlaces;
  } else {
    try {
      places = await queryAllPOIs(userCoords.lat, userCoords.lon, radius);

      // Se a 2000m non trova nulla in modalità NEAR, espandi la ricerca a 4000m
      if (places.length === 0 && currentMode === "NEAR") {
        places = await queryAllPOIs(userCoords.lat, userCoords.lon, 4000);
      }

      if (places.length > 0) {
        cachedPlaces = places;
        lastCacheCoords = { ...userCoords };
        lastCacheRadius = radius;
      }
    } catch (e) {
      showError("Errore connessione.");
      return;
    }
  }

  if (places.length > 0) {
    finalizeSelection(places, radius);
  } else showError("Nessun locale nel raggio.");
}

async function queryAllPOIs(lat, lon, radius) {
  const dLat = (radius * 1.15) / 111139;
  const dLon =
    (radius * 1.15) /
    (111139 * Math.cos((lat * Math.PI) / 180));
  const minLat = lat - dLat;
  const maxLat = lat + dLat;
  const minLon = lon - dLon;
  const maxLon = lon + dLon;

  // 1. Nominatim per tag OSM (identifica bar, pub, caffè, birrerie e locali indipendentemente dal nome)
  const nomAmenities = ["bar", "pub", "cafe", "biergarten", "nightclub"];
  const nomPromises = nomAmenities.map(async (amenity) => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&extratags=1&amenity=${encodeURIComponent(amenity)}&bounded=1&viewbox=${minLon.toFixed(5)},${maxLat.toFixed(5)},${maxLon.toFixed(5)},${minLat.toFixed(5)}&limit=50`;
      const res = await fetchWithTimeout(url, {}, 4000);
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).map((item) => ({
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        name: item.name || (item.display_name && item.display_name.split(",")[0]),
        amenity: item.type || amenity,
        opening_hours: (item.extratags && item.extratags.opening_hours) || null,
      }));
    } catch (e) {
      return [];
    }
  });

  // 2. Photon per parole chiave e POI complementari
  const photonQueries = ["bar", "pub", "birreria", "discoteca"];
  const photonPromises = photonQueries.map(async (q) => {
    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${lat}&lon=${lon}&bbox=${minLon.toFixed(5)},${minLat.toFixed(5)},${maxLon.toFixed(5)},${maxLat.toFixed(5)}&limit=35`;
      const res = await fetchWithTimeout(url, {}, 4000);
      if (!res.ok) return [];
      const data = await res.json();
      const list = [];
      for (const f of data.features || []) {
        const coords = f.geometry && f.geometry.coordinates;
        if (!coords || coords.length < 2) continue;
        const name = f.properties && (f.properties.name || f.properties.street);
        if (!name) continue;
        list.push({
          lat: coords[1],
          lon: coords[0],
          name: name,
          amenity: (f.properties && f.properties.osm_value) || q,
          opening_hours: (f.properties && (f.properties.opening_hours || f.properties.osm_value_opening_hours)) || null,
        });
      }
      return list;
    } catch (e) {
      return [];
    }
  });

  // Esegui tutte le chiamate contemporaneamente in parallelo
  const responses = await Promise.allSettled([...nomPromises, ...photonPromises]);
  const allPlaces = [];
  const seenLocations = [];

  for (const r of responses) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) {
      for (const item of r.value) {
        if (!item.name || isNaN(item.lat) || isNaN(item.lon)) continue;
        const dist = getDist(lat, lon, item.lat, item.lon);
        if (dist <= radius) {
          const normName = item.name.toLowerCase().trim();
          const isDuplicate = seenLocations.some(
            (seen) =>
              getDist(seen.lat, seen.lon, item.lat, item.lon) < 15 ||
              (seen.name === normName && getDist(seen.lat, seen.lon, item.lat, item.lon) < 100),
          );

          if (!isDuplicate) {
            seenLocations.push({ lat: item.lat, lon: item.lon, name: normName });
            allPlaces.push({
              lat: item.lat,
              lon: item.lon,
              name: item.name,
              dist: dist,
              opening_hours: item.opening_hours || null,
              tags: {
                name: item.name,
                amenity: item.amenity || "bar",
                opening_hours: item.opening_hours || null,
              },
            });
          }
        }
      }
    }
  }

  // Ordina rigorosamente dal più vicino al più lontano
  allPlaces.sort((a, b) => a.dist - b.dist);
  return allPlaces;
}

async function finalizeSelection(places, radiusLimit) {
  let validPlaces = places.filter(isCandidateValid);
  if (validPlaces.length === 0) {
    if (currentCategory !== "all") {
      showError("Nessun locale per la categoria selezionata nel raggio.");
    } else if (sessionBlacklist.size > 0) {
      showError("Hai scartato tutti i locali vicini per stasera!");
    } else {
      showError("Nessun locale disponibile nel raggio.");
    }
    return;
  }

  if (currentMode === "NEAR") {
    currentCandidates = validPlaces;
    currentCandidateIndex = 0;
    let place = currentCandidates[0];
    normalizePlace(place);
    targetPlaceData = place;
    calculateRoute(place);
  } else {
    let candidates = validPlaces.filter((p) => p.dist <= radiusLimit);
    if (candidates.length === 0) candidates = [...validPlaces];
    currentCandidates = candidates;
    currentCandidateIndex = Math.floor(Math.random() * candidates.length);
    let place = currentCandidates[currentCandidateIndex];
    normalizePlace(place);
    targetPlaceData = place;
    calculateRoute(place);
  }
}

async function getRouteData(place) {
  const routers = [
    // Router pedonale ufficiale OSM FOSSGIS (calcola marciapiedi e percorsi a piedi)
    `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${userCoords.lon},${userCoords.lat};${place.lon},${place.lat}?overview=full&geometries=geojson`,
    // Router secondario ciclabile OSM FOSSGIS
    `https://routing.openstreetmap.de/routed-bike/route/v1/driving/${userCoords.lon},${userCoords.lat};${place.lon},${place.lat}?overview=full&geometries=geojson`,
    // Router demo OSRM
    `https://router.project-osrm.org/route/v1/driving/${userCoords.lon},${userCoords.lat};${place.lon},${place.lat}?overview=full&geometries=geojson`,
  ];

  for (const url of routers) {
    try {
      const res = await fetchWithTimeout(url, {}, 2500);
      if (!res.ok) continue;
      const json = await res.json();
      if (json.routes && json.routes.length > 0) {
        return {
          route: json.routes[0].geometry.coordinates,
          dist: Math.round(json.routes[0].distance),
          time: Math.max(1, Math.round(json.routes[0].duration / 60)),
          isFallback: false,
        };
      }
    } catch (e) {}
  }

  // Fallback locale immediato (distanza in linea d'aria e stima a piedi ~75 m/min)
  const straightDist = Math.round(
    getDist(userCoords.lat, userCoords.lon, place.lat, place.lon),
  );
  const estMinutes = Math.max(1, Math.round(straightDist / 75));
  return {
    route: [
      [userCoords.lon, userCoords.lat],
      [place.lon, place.lat],
    ],
    dist: straightDist,
    time: estMinutes,
    isFallback: true,
  };
}

function applyRouteToUI(place, data) {
  routePath = data.route;
  const name =
    (place.tags && place.tags.name) ||
    place.name ||
    "Locale misterioso";

  // Indicazioni a piedi verso la destinazione usando le API di Maps:
  const mapsLink = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}&travelmode=walking`;

  targetText.innerHTML = `<a href="${mapsLink}" target="_blank" class="result-link">${name} <i data-lucide="external-link" width="14"></i></a>`;
  statusText.innerHTML = data.isFallback
    ? `Distanza: <b>${data.dist}m</b> (~${data.time} min in linea d'aria).<br>Segui la bottiglia!`
    : `Distanza: <b>${data.dist}m</b> (${data.time} min).<br>Segui la bottiglia!`;

  // Verifica stato apertura e orari
  const ohInfo = checkOpeningHours(place.opening_hours);
  if (openingStatusEl) {
    openingStatusEl.innerHTML = `<span class="opening-badge ${ohInfo.badgeClass}"><i data-lucide="${ohInfo.icon}" width="14" height="14"></i> ${ohInfo.message}</span>`;
  }

  // --- AUDIO & HAPTIC SUCCESS ---
  playSuccessChime();
  if (navigator.vibrate) navigator.vibrate([50, 50, 150]);

  targetCoords = { lat: place.lat, lon: place.lon };
  shareBtn.classList.add("visible");
  if (discardBtn) discardBtn.classList.add("visible");
  lucide.createIcons();

  updateNavigation(userCoords);
  startTracking();
  appState = "TRACKING";
  iconSpin.classList.remove("searching-anim");
  mainBtn.disabled = false;
}

async function calculateRoute(place, minSpinTimeMs = 1300) {
  targetText.innerHTML = "Calcolo percorso...";
  targetCoords = { lat: place.lat, lon: place.lon };
  const [data] = await Promise.all([
    getRouteData(place),
    new Promise((resolve) => setTimeout(resolve, minSpinTimeMs)),
  ]);
  if (data) applyRouteToUI(place, data);
  else displayFallback(place);
}

function displayFallback(place) {
  nextWaypoint = { lat: place.lat, lon: place.lon };
  targetCoords = { lat: place.lat, lon: place.lon };
  const name =
    (place.tags && place.tags.name) || place.name || "Locale trovato";
  const dist = Math.round(
    getDist(userCoords.lat, userCoords.lon, place.lat, place.lon),
  );
  const time = Math.max(1, Math.round(dist / 75));
  const mapsLink = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}&travelmode=walking`;

  targetText.innerHTML = `<a href="${mapsLink}" target="_blank" class="result-link">${name} <i data-lucide="external-link" width="14"></i></a>`;
  statusText.innerHTML = `Distanza: <b>${dist}m</b> (~${time} min in linea d'aria).<br>Segui la bottiglia!`;

  // Verifica stato apertura e orari
  const ohInfo = checkOpeningHours(place.opening_hours);
  if (openingStatusEl) {
    openingStatusEl.innerHTML = `<span class="opening-badge ${ohInfo.badgeClass}"><i data-lucide="${ohInfo.icon}" width="14" height="14"></i> ${ohInfo.message}</span>`;
  }

  // --- AUDIO & HAPTIC SUCCESS ---
  playSuccessChime();
  if (navigator.vibrate) navigator.vibrate([50, 50, 150]);

  routePath = [
    [userCoords.lon, userCoords.lat],
    [place.lon, place.lat],
  ];
  shareBtn.classList.add("visible");
  if (discardBtn) discardBtn.classList.add("visible");
  lucide.createIcons();

  appState = "TRACKING";
  iconSpin.classList.remove("searching-anim");
  mainBtn.disabled = false;
}

function normalizePlace(place) {
  place.lat = parseFloat(
    place.lat ??
      (place.center && place.center.lat) ??
      (place.geometry && place.geometry.coordinates[1]),
  );
  place.lon = parseFloat(
    place.lon ??
      (place.center && place.center.lon) ??
      (place.geometry && place.geometry.coordinates[0]),
  );
  if (!place.tags) place.tags = {};
  if (!place.tags.name)
    place.tags.name = place.name || "Locale misterioso";
  if (place.opening_hours === undefined) {
    place.opening_hours =
      (place.tags && place.tags.opening_hours) || null;
  }
}

function checkOpeningHours(ohStr, dt = new Date()) {
  if (!ohStr || typeof ohStr !== "string" || !ohStr.trim()) {
    return {
      status: "UNKNOWN",
      message: "Orari non disponibili",
      badgeClass: "badge-unknown",
      icon: "alert-triangle",
    };
  }

  const s = ohStr.trim();
  if (s === "24/7") {
    return {
      status: "OPEN",
      message: "Aperto 24/7",
      badgeClass: "badge-open",
      icon: "check-circle-2",
    };
  }

  // JS getDay(): 0 is Sunday, 1 is Monday ... 6 is Saturday
  // In OSM: Mo=0, Tu=1, We=2, Th=3, Fr=4, Sa=5, Su=6
  const jsDay = dt.getDay();
  const dayIdx = (jsDay + 6) % 7;
  const currentMinutes = dt.getHours() * 60 + dt.getMinutes();
  const daysMap = { mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6 };

  const rules = s.split(";");
  let isOpen = false;
  let applicableRuleFound = false;

  for (let rule of rules) {
    rule = rule.trim();
    if (!rule) continue;

    const parts = rule.split(/\s+(.+)/);
    let dayPart = "mo-su";
    let timePart = rule;
    if (parts.length >= 2 && parts[1]) {
      dayPart = parts[0].toLowerCase();
      timePart = parts[1];
    } else {
      const firstToken = rule.split(" ")[0].toLowerCase();
      if (Object.keys(daysMap).some((d) => firstToken.includes(d))) {
        dayPart = firstToken;
        timePart = rule.substring(firstToken.length).trim();
      }
    }

    // Parse dayPart e.g. "mo-fr", "sa,su", "mo-sa"
    const ruleDays = [];
    for (let dp of dayPart.split(",")) {
      dp = dp.trim();
      if (dp.includes("-")) {
        const [dStart, dEnd] = dp.split("-");
        if (daysMap[dStart] !== undefined && daysMap[dEnd] !== undefined) {
          const sI = daysMap[dStart];
          const eI = daysMap[dEnd];
          if (sI <= eI) {
            for (let i = sI; i <= eI; i++) ruleDays.push(i);
          } else {
            for (let i = sI; i <= 6; i++) ruleDays.push(i);
            for (let i = 0; i <= eI; i++) ruleDays.push(i);
          }
        }
      } else if (daysMap[dp] !== undefined) {
        ruleDays.push(daysMap[dp]);
      }
    }

    // If dayPart had no recognized day token (e.g. just hours "18:00-02:00"), assume all days
    if (ruleDays.length === 0) {
      for (let i = 0; i < 7; i++) ruleDays.push(i);
    }

    const yesterdayIdx = (dayIdx + 6) % 7;

    for (let interval of timePart.split(",")) {
      interval = interval.trim().toLowerCase();
      if (interval === "off" || interval === "closed") {
        if (ruleDays.includes(dayIdx)) {
          applicableRuleFound = true;
        }
        continue;
      }

      const match = interval.match(
        /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/,
      );
      if (!match) continue;

      const h1 = parseInt(match[1], 10);
      const m1 = parseInt(match[2], 10);
      const h2 = parseInt(match[3], 10);
      const m2 = parseInt(match[4], 10);

      const startM = h1 * 60 + m1;
      const endM = h2 * 60 + m2;

      if (ruleDays.includes(dayIdx)) {
        applicableRuleFound = true;
        if (endM > startM) {
          if (currentMinutes >= startM && currentMinutes < endM) {
            isOpen = true;
          }
        } else {
          // e.g. 18:00 - 02:00
          if (currentMinutes >= startM) {
            isOpen = true;
          }
        }
      }

      // Past midnight interval from yesterday (e.g. opened yesterday at 18:00 and closes at 02:00 or 04:00 today)
      if (ruleDays.includes(yesterdayIdx) && endM < startM) {
        if (currentMinutes < endM) {
          isOpen = true;
          applicableRuleFound = true;
        }
      }
    }
  }

  if (isOpen) {
    return {
      status: "OPEN",
      message: `Aperto ora (${s})`,
      badgeClass: "badge-open",
      icon: "check-circle-2",
    };
  } else if (applicableRuleFound) {
    return {
      status: "CLOSED",
      message: `Attualmente chiuso (${s})`,
      badgeClass: "badge-closed",
      icon: "clock",
    };
  } else {
    return {
      status: "UNKNOWN",
      message: `Orari (${s})`,
      badgeClass: "badge-unknown",
      icon: "alert-triangle",
    };
  }
}

async function selectNextPlace() {
  const pool = (cachedPlaces && cachedPlaces.length > 0) ? cachedPlaces : currentCandidates;
  const validCandidates = (pool || []).filter(isCandidateValid);

  if (validCandidates.length === 0) {
    if (sessionBlacklist.size > 0 && currentCategory === "all") {
      statusText.innerHTML = "Tutti i locali vicini sono stati scartati per stasera!";
    } else if (currentCategory !== "all") {
      statusText.innerHTML = "Nessun altro locale trovato per questa categoria!";
    } else {
      statusText.innerHTML = "Nessun altro locale trovato nelle vicinanze!";
    }
    if (discardBtn) discardBtn.classList.remove("visible");
    if (shareBtn) shareBtn.classList.remove("visible");
    return;
  }

  currentCandidates = validCandidates;

  if (currentCandidates.length === 1 && targetPlaceData && getPlaceUniqueId(currentCandidates[0]) === getPlaceUniqueId(targetPlaceData)) {
    statusText.innerHTML =
      "È l'unico locale valido trovato nelle vicinanze!<br>Segui la bottiglia!";
    velocity = SPIN_SPEED * 0.6;
    playWhooshSound();
    return;
  }

  mainBtn.disabled = true;
  appState = "SEARCHING";
  iconSpin.classList.add("searching-anim");
  playWhooshSound();
  velocity = SPIN_SPEED;
  targetText.innerHTML = "Cerco un altro locale...";
  if (openingStatusEl) openingStatusEl.innerHTML = "";
  shareBtn.classList.remove("visible");
  if (discardBtn) discardBtn.classList.remove("visible");

  if (currentMode === "NEAR") {
    currentCandidateIndex++;
    if (currentCandidateIndex >= currentCandidates.length) {
      currentCandidateIndex = 0; // ricomincia dal più vicino
    }
  } else {
    let nextIdx = currentCandidateIndex;
    let attempts = 0;
    while (nextIdx === currentCandidateIndex && attempts < 10 && currentCandidates.length > 1) {
      nextIdx = Math.floor(Math.random() * currentCandidates.length);
      attempts++;
    }
    currentCandidateIndex = nextIdx;
  }

  const nextPlace = currentCandidates[currentCandidateIndex];
  normalizePlace(nextPlace);
  targetPlaceData = nextPlace;
  await calculateRoute(nextPlace);
  mainBtn.disabled = false;
}

function updateNavigation(currentPos) {
  if (!routePath || routePath.length === 0) return;
  let minDist = Infinity;
  let closestIdx = 0;
  for (let i = 0; i < routePath.length; i++) {
    const d = getDist(
      currentPos.lat,
      currentPos.lon,
      routePath[i][1],
      routePath[i][0],
    );
    if (d < minDist) {
      minDist = d;
      closestIdx = i;
    }
  }
  let lookAheadIdx = closestIdx;
  for (let i = closestIdx; i < routePath.length; i++) {
    const d = getDist(
      currentPos.lat,
      currentPos.lon,
      routePath[i][1],
      routePath[i][0],
    );
    lookAheadIdx = i;
    if (d > 25) break;
  }
  nextWaypoint = {
    lat: routePath[lookAheadIdx][1],
    lon: routePath[lookAheadIdx][0],
  };
}

function startTracking() {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      userCoords = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      };
      currentSpeed = pos.coords.speed || 0;
      const gpsHeading = pos.coords.heading;

      if (currentSpeed > 1 && gpsHeading !== null && !isNaN(gpsHeading))
        deviceHeading = gpsHeading;

      if (appState === "TRACKING") {
        updateNavigation(userCoords);
        const d = getDist(
          userCoords.lat,
          userCoords.lon,
          targetCoords.lat,
          targetCoords.lon,
        );
        updateVisualFeedback(d);
        if (d < 15) {
          statusText.innerHTML = "Sei arrivato! 🍻";
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }
      }
    },
    null,
    { enableHighAccuracy: true },
  );
}

function updateVisualFeedback(distance) {
  compassBox.style.boxShadow = "0 10px 40px rgba(0, 0, 0, 0.04)";
  compassBox.style.borderColor = "white";
}

function physicsLoop(currentTime) {
  const dt = Math.min((currentTime - lastTime) / (1000 / 60), 2);
  lastTime = currentTime;

  const isDrunkActive = drunkEffectsEnabled && drinkCount > 0;
  // Limite alla crescita degli effetti fisici: bloccato a un massimo di 8 drink
  const effectiveDrunk = isDrunkActive ? Math.min(drinkCount, 8) : 0;

  if (appState === "SEARCHING") {
    let currentSpinSpeed = SPIN_SPEED;
    if (isDrunkActive) {
      const slowFactor = Math.max(0.48, 1 - (effectiveDrunk * 0.065));
      currentSpinSpeed = SPIN_SPEED * slowFactor;
    }
    velocity =
      velocity * Math.pow(0.98, dt) +
      currentSpinSpeed * (1 - Math.pow(0.98, dt));
  } else if (appState === "TRACKING" && nextWaypoint && targetCoords) {
    const compassModeSelect = document.getElementById("compass-mode-select");
    const isStepByStep = compassModeSelect && compassModeSelect.value === "step";
    const targetLat = isStepByStep ? nextWaypoint.lat : targetCoords.lat;
    const targetLon = isStepByStep ? nextWaypoint.lon : targetCoords.lon;
    const bearing = calcBearing(
      userCoords.lat,
      userCoords.lon,
      targetLat,
      targetLon,
    );
    let diff = bearing - deviceHeading - angle;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;

    let springMultiplier = 1;
    let currentFriction = FRICTION;
    if (isDrunkActive) {
      springMultiplier = Math.max(0.45, 1 - (effectiveDrunk * 0.07));
      currentFriction = Math.max(0.90, FRICTION - effectiveDrunk * 0.005);
    }

    const currentSpring = (Math.abs(diff) < 5 ? SPRING_SOFT : SPRING_STIFF) * springMultiplier;
    velocity =
      (velocity + diff * currentSpring * dt) * Math.pow(currentFriction, dt);

    if (Math.abs(diff) < 5 && Math.abs(velocity) < 0.5 && !hasVibrated) {
      if (navigator.vibrate) navigator.vibrate(20);
      hasVibrated = true;
    }
    if (Math.abs(diff) > 20) hasVibrated = false;
  } else {
    velocity *= Math.pow(0.92, dt);
  }
  angle += velocity * dt;

  let displayAngle = angle;
  if (isDrunkActive) {
    // Raggio orbitale limitato a 10px max per un'orbita elegante e contenuta
    const orbitRadius = Math.min(10, 2.5 + effectiveDrunk * 0.95);
    const orbitSpeed = 0.0020;
    const orbitAngle = currentTime * orbitSpeed + (angle * (Math.PI / 180) * 0.25);
    const orbitX = Math.cos(orbitAngle) * orbitRadius;
    const orbitY = Math.sin(orbitAngle) * orbitRadius;

    // Ampiezza sbandamento limitata a 8 gradi max
    const wobbleAmp = Math.min(8, effectiveDrunk * 1.0);
    displayAngle += Math.sin(currentTime * 0.0028) * wobbleAmp;

    bottleImg.style.transform = `translate(${orbitX.toFixed(2)}px, ${orbitY.toFixed(2)}px) rotate(${displayAngle.toFixed(2)}deg)`;
  } else {
    bottleImg.style.transform = `rotate(${displayAngle.toFixed(2)}deg)`;
  }

  if (diplopiaActive && ghostBottleImg) {
    ghostBottleImg.style.transform = bottleImg.style.transform;
  }

  // --- AUDIO & HAPTIC TICKS ---
  const speed = Math.abs(velocity);
  if (speed > 1.2) {
    const degDiff = Math.abs(angle - lastTickAngle);
    if (degDiff >= 36 && currentTime - lastTickTime > 40) {
      lastTickAngle = angle;
      lastTickTime = currentTime;
      playTickSound(Math.min(1.4, 0.8 + speed * 0.02));
      if (navigator.vibrate && speed < 12 && speed > 2) {
        navigator.vibrate(5);
      }
    }
  }

  requestAnimationFrame(physicsLoop);
}

function getDist(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcBearing(lat1, lon1, lat2, lon2) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function getClosest(elements) {
  if (!elements || elements.length === 0) return null;
  let closest = elements[0];
  let minDist = getDist(
    userCoords.lat,
    userCoords.lon,
    parseFloat(
      closest.lat ??
        (closest.center && closest.center.lat) ??
        (closest.geometry && closest.geometry.coordinates[1]),
    ),
    parseFloat(
      closest.lon ??
        (closest.center && closest.center.lon) ??
        (closest.geometry && closest.geometry.coordinates[0]),
    ),
  );
  for (let i = 1; i < elements.length; i++) {
    const el = elements[i];
    const elLat = parseFloat(
      el.lat ??
        (el.center && el.center.lat) ??
        (el.geometry && el.geometry.coordinates[1]),
    );
    const elLon = parseFloat(
      el.lon ??
        (el.center && el.center.lon) ??
        (el.geometry && el.geometry.coordinates[0]),
    );
    const d = getDist(userCoords.lat, userCoords.lon, elLat, elLon);
    if (d < minDist) {
      minDist = d;
      closest = el;
    }
  }
  return closest;
}

function showError(msg) {
  document.getElementById("error-msg").innerText = msg;
  errorBox.style.display = "block";
  resetUI();
}

function closeError() {
  errorBox.style.display = "none";
  resetUI();
}

// =========================================================================
// --- BUMP / CIN-CIN TRA DUE SMARTPHONE VICINI (FIREBASE REALTIME DB) ---
// =========================================================================

const firebaseConfig = {
  apiKey: "AIzaSyBARmUF5r1CqVyKx_wLHTyE1QV4cMuiVR0",
  authDomain: "alcol-finder.firebaseapp.com",
  databaseURL: "https://alcol-finder-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "alcol-finder",
  storageBucket: "alcol-finder.firebasestorage.app",
  messagingSenderId: "683272550925",
  appId: "1:683272550925:web:42a8e317ec35334f8e7344",
  measurementId: "G-MRZ8RY0JRF"
};

let firebaseApp = null;
let firebaseDb = null;
let activeBumpsRef = null;
const myClientId = "bump_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now();
let lastShakeTimestamp = 0;
const SHAKE_THRESHOLD = 20;
let lastMotionTotal = 0;
let isMotionListening = false;
let cheersCloseTimer = null;

// Gestione del ring radar attorno allo schermo e stato attivo dello shake
let isLocalShakeActive = false;
let localShakeActiveTimer = null;
const BUMP_ACTIVE_WINDOW = 3500; // Finestra di 3.5s in cui il dispositivo è in ascolto attivo durante lo shake
let lastFirebaseBumpTime = 0;
const FIREBASE_BUMP_THROTTLE = 900; // Pubblica su Firebase al massimo ogni 0.9s se lo shake continua
let myCurrentBumpRef = null;

function showBumpActiveRing() {
  const ring = document.getElementById("bump-active-ring");
  if (ring) ring.classList.add("active");

  isLocalShakeActive = true;
  if (localShakeActiveTimer) clearTimeout(localShakeActiveTimer);
  localShakeActiveTimer = setTimeout(() => {
    stopLocalShakeWindow();
  }, BUMP_ACTIVE_WINDOW);
}

function stopLocalShakeWindow() {
  isLocalShakeActive = false;
  if (localShakeActiveTimer) {
    clearTimeout(localShakeActiveTimer);
    localShakeActiveTimer = null;
  }
  const ring = document.getElementById("bump-active-ring");
  if (ring) ring.classList.remove("active");

  // Rimuove immediatamente il proprio record per chiudere la finestra di tolleranza
  if (myCurrentBumpRef) {
    myCurrentBumpRef.off();
    myCurrentBumpRef.remove().catch(() => {});
    myCurrentBumpRef = null;
  }
}

function hideBumpActiveRing() {
  stopLocalShakeWindow();
}

function initFirebaseBump() {
  try {
    if (typeof firebase !== "undefined" && firebase.initializeApp) {
      firebaseApp = firebase.apps && firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(firebaseConfig);
      firebaseDb = firebase.app().database(firebaseConfig.databaseURL);
      activeBumpsRef = firebaseDb.ref("active_bumps");

      // Listener in tempo reale per convalidare i bump di altri client
      activeBumpsRef.on("child_added", (snapshot) => {
        const bump = snapshot.val();
        if (!bump || !bump.id || bump.id === myClientId) return;

        // 1. ENTRAMBI I TELEFONI DEVONO ESSERE SCUOTUTI:
        // Se questo telefono NON sta scuotendo (isLocalShakeActive è false), ignora il bump!
        if (!isLocalShakeActive) return;

        // 2. Se l'animazione o il cooldown è in corso, non accettare altri bump
        if (isCheersInProgress) return;

        const now = Date.now();
        const timeDelta = Math.abs(now - (bump.t || 0));

        // 3. Verifica finestra temporale attiva
        if (timeDelta > BUMP_ACTIVE_WINDOW) return;

        // 4. Verifica prossimità GPS entro 100 metri
        const hasMyGps = userCoords && typeof userCoords.lat === "number" && typeof userCoords.lon === "number" && (userCoords.lat !== 0 || userCoords.lon !== 0);
        const hasPeerGps = typeof bump.lat === "number" && typeof bump.lon === "number" && (bump.lat !== 0 || bump.lon !== 0);

        if (!hasMyGps || !hasPeerGps) return;

        const dist = getDist(userCoords.lat, userCoords.lon, bump.lat, bump.lon);
        const MAX_BUMP_DIST = 100; // Cin-Cin consentito solo entro 100 metri
        if (dist > MAX_BUMP_DIST && window.DEBUG_IGNORE_BUMP_DISTANCE !== true) return;

        // ENTRAMBI I TELEFONI STANNO SCUOTENDO E SONO VICINI ENTRO 100M!
        // Interrompi immediatamente la finestra di tolleranza locale
        stopLocalShakeWindow();

        // Notifica istantanea all'altro dispositivo scrivendo sul suo nodo
        snapshot.ref.child("matched").set(myClientId).catch(() => {});

        // Rimuovi il record dell'altro peer dopo 1.2s per lasciare il tempo all'altro di confermare
        setTimeout(() => {
          snapshot.ref.remove().catch(() => {});
        }, 1200);

        triggerCheersAnimation();
      });
    }
  } catch (e) {
    console.warn("Inizializzazione Firebase Bump:", e.message);
  }
}

function publishBumpEvent() {
  showBumpActiveRing();

  // Feedback aptico leggero immediato sullo shake
  if (navigator.vibrate) navigator.vibrate(35);

  const lat = (userCoords && typeof userCoords.lat === "number") ? userCoords.lat : 0;
  const lon = (userCoords && typeof userCoords.lon === "number") ? userCoords.lon : 0;

  if (activeBumpsRef) {
    try {
      if (myCurrentBumpRef) {
        myCurrentBumpRef.off();
        myCurrentBumpRef.remove().catch(() => {});
      }

      const newBumpRef = activeBumpsRef.push();
      myCurrentBumpRef = newBumpRef;

      newBumpRef.set({
        id: myClientId,
        lat: lat,
        lon: lon,
        t: Date.now()
      });

      // Ascolta se l'altro dispositivo convalida il nostro bump (handshake bidirezionale)
      newBumpRef.child("matched").on("value", (snap) => {
        const matchedPeer = snap.val();
        if (matchedPeer) {
          // Interrompi immediatamente la finestra di tolleranza locale
          stopLocalShakeWindow();
          triggerCheersAnimation();
        }
      });

      // Auto-rimozione su disconnessione
      newBumpRef.onDisconnect().remove();

      // Timeout di pulizia locale a BUMP_ACTIVE_WINDOW
      setTimeout(() => {
        if (myCurrentBumpRef === newBumpRef) {
          newBumpRef.off();
          newBumpRef.remove().catch(() => {});
        }
      }, BUMP_ACTIVE_WINDOW);
    } catch (err) {
      console.warn("Errore pubblicazione bump su Firebase:", err);
    }
  } else {
    // Se Firebase è offline, mostra la demo locale del Cin-Cin
    triggerCheersAnimation();
  }
}

window.publishBumpEvent = publishBumpEvent;

function handleDeviceMotion(e) {
  let ax = 0, ay = 0, az = 0;
  let isShake = false;

  if (e.acceleration && (e.acceleration.x !== null || e.acceleration.y !== null)) {
    ax = e.acceleration.x || 0;
    ay = e.acceleration.y || 0;
    az = e.acceleration.z || 0;
    const mag = Math.sqrt(ax * ax + ay * ay + az * az);
    if (mag >= SHAKE_THRESHOLD) {
      isShake = true;
    }
  } else if (e.accelerationIncludingGravity) {
    const gx = e.accelerationIncludingGravity.x || 0;
    const gy = e.accelerationIncludingGravity.y || 0;
    const gz = e.accelerationIncludingGravity.z || 0;
    const total = Math.sqrt(gx * gx + gy * gy + gz * gz);
    const delta = Math.abs(total - (lastMotionTotal || 9.8));
    lastMotionTotal = total;
    if (delta >= SHAKE_THRESHOLD * 0.8) {
      isShake = true;
    }
  }

  if (isShake) {
    // Mostra il ring dorato attorno allo schermo per tutta la durata dello shake
    showBumpActiveRing();

    const now = Date.now();
    if (now - lastFirebaseBumpTime >= FIREBASE_BUMP_THROTTLE) {
      lastFirebaseBumpTime = now;
      publishBumpEvent();
    }
  }
}

function initDeviceMotionListener() {
  if (isMotionListening) return;
  if (window.DeviceMotionEvent) {
    window.addEventListener("devicemotion", handleDeviceMotion, true);
    isMotionListening = true;
    try {
      sessionStorage.setItem("alcol_motion_granted", "true");
    } catch (e) {}
  }
}

function requestMotionPermission() {
  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
    DeviceMotionEvent.requestPermission()
      .then((res) => {
        if (res === "granted") {
          initDeviceMotionListener();
        }
      })
      .catch(() => {});
  } else {
    initDeviceMotionListener();
  }
}

let isCheersInProgress = false;
function triggerCheersAnimation() {
  if (isCheersInProgress) return;
  isCheersInProgress = true;
  
  // Rimuove immediatamente il record per evitare altri match, ma lascia la wave
  if (myCurrentBumpRef) {
    myCurrentBumpRef.off();
    myCurrentBumpRef.remove().catch(() => {});
    myCurrentBumpRef = null;
  }

  setTimeout(() => {
    setTimeout(() => { isCheersInProgress = false; }, 3500);

    // Interrompi la finestra di ascolto dello shake
    stopLocalShakeWindow();

    const modal = document.getElementById("bump-cheers-modal");
    if (!modal) return;

    // Reset animazioni
    modal.classList.remove("open", "closing", "impact-active");
    void modal.offsetWidth; // forza reflow
    modal.classList.add("open");

    // Al momento dello scontro (270ms: calici inclinati al centro)
    setTimeout(() => {
      modal.classList.add("impact-active");
      triggerBumpShake(); // applica classe bump-shake-active per impatto fisico
      playCheersClinkSound(); // suono cristallino "clink" via getAudioContext()
      if (navigator.vibrate) navigator.vibrate([60, 40, 100]); // aptico
      addDrink(); // incrementa ubriacometro e versa birra
    }, 270);

    // Mostra per 2.5 secondi e poi chiudi con dissolvenza fluida
    if (cheersCloseTimer) clearTimeout(cheersCloseTimer);
    cheersCloseTimer = setTimeout(() => {
      modal.classList.add("closing");
      setTimeout(() => {
        modal.classList.remove("open", "closing", "impact-active");
      }, 400);
    }, 2500);
  }, 1500);
}

// Esponi per test e debug manuale
window.triggerCheersAnimation = triggerCheersAnimation;
window.testBumpCinCin = triggerCheersAnimation;
window.testBumpIgnoreDistance = function() {
  window.DEBUG_IGNORE_BUMP_DISTANCE = true;
  console.log("Distanza GPS ignorata. I telefoni si connetteranno col prossimo shake, indipendentemente dalla distanza!");
};

// Inizializzazione motion banner e permessi su iOS / Streamlit
window.addEventListener("DOMContentLoaded", () => {
  initFirebaseBump();

  // Acquisizione automatica iniziale posizione per il Bump
  if (navigator.geolocation && !userCoords) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userCoords = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        };
        console.log("[GPS] Posizione acquisita per Bump Cin-Cin:", userCoords);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }

  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
    let alreadyGranted = false;
    try {
      alreadyGranted = sessionStorage.getItem("alcol_motion_granted") === "true";
    } catch (e) {}
    if (alreadyGranted) {
      initDeviceMotionListener();
    }
  } else {
    initDeviceMotionListener();
  }
});

// Ascolta primo tocco per registrare i sensori su Safari/WebKit
window.addEventListener("pointerdown", () => requestMotionPermission(), { once: true });
