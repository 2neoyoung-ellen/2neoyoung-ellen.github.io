/* ============================================
   Game Dialogue Engine
   InYoung Choi Portfolio
   ============================================ */

const Engine = (() => {
  // ── State ──────────────────────────────────
  let script        = null;
  let currentScene  = null;
  let isTyping      = false;
  let typingTimer   = null;
  let lang          = 'kr';

  // ── DOM refs ───────────────────────────────
  const dialogueText   = document.getElementById('dialogueText');
  const dialogueName   = document.getElementById('dialogueName');
  const dialogueCursor = document.getElementById('dialogueCursor');
  const tapHint        = document.getElementById('tapHint');
  const choiceMenu     = document.getElementById('choiceMenu');
  const choiceList     = document.getElementById('choiceList');
  const skipBtn        = document.getElementById('skipBtn');
  const dialogueBox    = document.getElementById('dialogueBox');

  // ── Audio ──────────────────────────────────
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new AudioCtx();
    return audioCtx;
  }

  function playBlip() {
    try {
      const ctx = getAudioCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.04);
    } catch (_) {}
  }

  function playSelect() {
    try {
      const ctx = getAudioCtx();
      [440, 660].forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.start(t);
        osc.stop(t + 0.12);
      });
    } catch (_) {}
  }

  // ── Load script ────────────────────────────
  async function loadScript() {
    const res = await fetch('script.json');
    script = await res.json();
  }

  // ── Background swap on expression ──────────
  const BG_MAP = {
    neutral:  'assets/npc_backgroud2.png',
    smile:    'assets/npc_backgroud1.jpg',
    thinking: 'assets/npc_backgroud2.png',
  };

  function setCharacter(expression = 'neutral') {
    const el  = document.getElementById('sceneBg');
    if (!el) return;
    const src = BG_MAP[expression] || BG_MAP.neutral;
    el.style.backgroundImage = `url('${src}')`;
  }

  // ── Typewriter ─────────────────────────────
  // Types `fullText` character by character.
  // `onDone` fires when complete.
  function typeText(fullText, onDone) {
    clearInterval(typingTimer);
    dialogueText.textContent = '';
    dialogueCursor.classList.add('hidden');
    tapHint.classList.remove('hidden');

    isTyping = true;
    let i = 0;
    let blipCount = 0;
    const hasKorean = /[\uAC00-\uD7A3]/.test(fullText);
    const speed = hasKorean ? 50 : 38;

    typingTimer = setInterval(() => {
      if (i < fullText.length) {
        dialogueText.textContent += fullText[i];
        i++;
        blipCount++;
        if (blipCount % 3 === 0 && fullText[i - 1] !== ' ' && fullText[i - 1] !== '\n') {
          playBlip();
        }
      } else {
        clearInterval(typingTimer);
        isTyping = false;
        tapHint.classList.add('hidden');
        if (onDone) onDone();
      }
    }, speed);
  }

  function skipTyping(fullText) {
    if (!isTyping) return;
    clearInterval(typingTimer);
    isTyping = false;
    dialogueText.textContent = fullText;
    tapHint.classList.add('hidden');
  }

  // ── Screen flash ───────────────────────────
  function flashScreen() {
    const el = document.getElementById('flashOverlay');
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  // ── Scene navigation ───────────────────────
  function goToScene(sceneId) {
    const scene = script.scenes[sceneId];
    if (!scene) return;

    currentScene = sceneId;
    choiceMenu.classList.add('hidden');
    dialogueCursor.classList.add('hidden');

    // Card entrance animation
    dialogueBox.classList.remove('scene-enter');
    void dialogueBox.offsetWidth;
    dialogueBox.classList.add('scene-enter');

    // Update background
    setCharacter(scene.character || 'neutral');

    // Redirect-only scenes
    if (!scene.lines || scene.lines.length === 0) {
      if (scene.action === 'redirect') {
        setTimeout(() => { window.location.href = scene.url; }, 800);
      }
      return;
    }

    // Collect ALL lines into one block of text
    const fullText = scene.lines
      .map(l => lang === 'en' ? l.en : l.kr)
      .join('\n\n');

    // Type them all at once
    typeText(fullText, () => {
      // After typing completes…
      if (scene.action === 'redirect') {
        setTimeout(() => { window.location.href = scene.url; }, 1400);
      } else if (scene.choices && scene.choices.length > 0) {
        // Small pause then show choices automatically
        setTimeout(() => showChoices(scene.choices), 600);
      } else {
        // Show click-to-continue cue
        dialogueCursor.classList.remove('hidden');
      }
    });
  }

  // ── Choices ────────────────────────────────
  function showChoices(choices) {
    choiceList.innerHTML = '';
    choices.forEach((choice, idx) => {
      const btn = document.createElement('button');
      btn.className   = 'choice-btn';
      btn.dataset.num = idx + 1;
      btn.innerHTML   = `
        <span class="kr-text">${choice.kr}</span>
        <span class="en-text">${choice.en}</span>
      `;
      btn.addEventListener('click', () => {
        playSelect();
        flashScreen();
        goToScene(choice.next);
      });
      btn.dataset.index = idx;
      choiceList.appendChild(btn);
    });

    choiceMenu.classList.remove('hidden');
    applyLang();
    // Hide the click-to-continue cursor (choices are now shown)
    dialogueCursor.classList.add('hidden');
    // Focus first choice for keyboard nav
    setTimeout(() => choiceList.querySelector('.choice-btn')?.focus(), 50);
  }

  // ── Skip ───────────────────────────────────
  function handleSkip() {
    const scene = script?.scenes[currentScene];
    if (!scene) return;

    if (isTyping) {
      // Skip to end of current text
      const fullText = scene.lines
        .map(l => lang === 'en' ? l.en : l.kr)
        .join('\n\n');
      skipTyping(fullText);

      // Then show choices or redirect
      if (scene.action === 'redirect') {
        setTimeout(() => { window.location.href = scene.url; }, 1200);
      } else if (scene.choices && scene.choices.length > 0) {
        setTimeout(() => showChoices(scene.choices), 400);
      } else {
        dialogueCursor.classList.remove('hidden');
      }
      return;
    }

    // Already done typing — skip to first scene with choices
    if (!choiceMenu.classList.contains('hidden')) return;

    // Jump to intro choices
    const intro = script.scenes['intro'];
    if (intro?.choices) {
      currentScene = 'intro';
      setCharacter('neutral');
      const fullText = intro.lines.map(l => lang === 'en' ? l.en : l.kr).join('\n\n');
      dialogueText.textContent = fullText;
      showChoices(intro.choices);
    }
  }

  // ── Language toggle ─────────────────────────
  function applyLang() {
    document.body.className = 'lang-' + lang;
    dialogueName.textContent = lang === 'en' ? 'InYoung' : '최인영 / InYoung';

    // Re-render current text in new language
    if (!isTyping && script && currentScene) {
      const scene = script.scenes[currentScene];
      if (scene?.lines) {
        const fullText = scene.lines
          .map(l => lang === 'en' ? l.en : l.kr)
          .join('\n\n');
        dialogueText.textContent = fullText;
      }
    }
  }

  // ── Events ─────────────────────────────────
  function setupEvents() {
    // Click dialogue box → skip typing
    dialogueBox.addEventListener('click', () => {
      if (!isTyping) return;
      const scene = script?.scenes[currentScene];
      if (!scene) return;
      const fullText = scene.lines.map(l => lang === 'en' ? l.en : l.kr).join('\n\n');
      skipTyping(fullText);
      if (scene.action === 'redirect') {
        setTimeout(() => { window.location.href = scene.url; }, 1000);
      } else if (scene.choices?.length) {
        setTimeout(() => showChoices(scene.choices), 300);
      } else {
        dialogueCursor.classList.remove('hidden');
      }
    });

    // Keyboard: Space/Enter = skip; numbers = choices
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (!choiceMenu.classList.contains('hidden')) return;
        if (isTyping) dialogueBox.click();
      }
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1) {
        const btn = choiceList.querySelector(`[data-index="${num - 1}"]`);
        if (btn) btn.click();
      }
    });

    // Language buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        lang = btn.dataset.lang;
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyLang();
      });
    });

    // Skip button
    skipBtn.addEventListener('click', handleSkip);
  }

  // ── Init ───────────────────────────────────
  async function init() {
    // Set language from browser preference
    if (navigator.language && !navigator.language.startsWith('ko')) {
      lang = 'en';
      document.querySelector('[data-lang="en"]')?.classList.add('active');
      document.querySelector('[data-lang="kr"]')?.classList.remove('active');
    }

    await loadScript();
    applyLang();
    setupEvents();
    goToScene('intro');
  }

  return { init };
})();

Engine.init();
