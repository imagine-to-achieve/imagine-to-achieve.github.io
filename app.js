'use strict';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---------------------------------------------------------------------------
   Task definitions.
   `rates` are NOT stored here on purpose: the per-task success numbers are read
   straight out of the Table I markup in index.html (the [data-m][data-t] cells),
   so the table stays the single source of truth for every number on the page.
   Clip ids map to media/<id>.mp4 and assets/<id>.jpg.
--------------------------------------------------------------------------- */
const TASKS = [
  {
    id: 'laptop',
    tab: 'Close the laptop',
    title: 'Close the laptop',
    blurb: 'The robot rotates the open lid until the laptop is fully shut without displacing the base.',
    demos: '40 demonstrations',
    clips: { sft: null, pi: 'pi-laptop', rl: 'rl-laptop' },
    acceleratedRl: true
  },
  {
    id: 'duck',
    tab: 'Place the duck',
    title: 'Place the specified duck into the basket',
    blurb: 'The robot grasps the colour named in the instruction from four candidates on the table and places it into the basket.',
    demos: '200 demonstrations · 50 per colour',
    variants: [
      { id: 'yellow', label: 'Yellow', clips: { sft: 'sft-duck-yellow', pi: 'pi-duck-yellow', rl: 'rl-duck-yellow' } },
      { id: 'red', label: 'Red', clips: { sft: 'sft-duck-red', pi: 'pi-duck-red', rl: 'rl-duck-red' } },
      { id: 'brown', label: 'Brown', clips: { sft: 'sft-duck-brown', pi: 'pi-duck-brown', rl: 'rl-duck-brown' } },
      { id: 'white', label: 'White', clips: { sft: 'sft-duck-white', pi: 'pi-duck-white', rl: 'rl-duck-white' } }
    ],
    rateNote: 'across all four colours'
  },
  {
    id: 'push',
    tab: 'Push-T',
    title: 'Push the T-shaped block to a target pose',
    blurb: 'The robot translates and reorients a T-shaped block to match a target pose.',
    demos: '150 demonstrations',
    clips: { sft: 'sft-push-1', pi: 'pi-push-1', rl: 'rl-push' }
  },
  {
    id: 'cup',
    tab: 'Nest four cups',
    title: 'Nest four cups into one stack',
    blurb: 'The robot stacks four cups into a single column through four successive grasp-and-place motions, without disturbing the partial stack.',
    demos: '100 demonstrations · longest horizon',
    clips: { sft: 'sft-cups', pi: 'pi-cups', rl: 'rl-cups' }
  }
];

const MODELS = [
  { key: 'sft', label: 'Ours (SFT)', tag: 'Before RL' },
  { key: 'pi', label: 'π₀.₅', tag: 'Baseline' },
  { key: 'rl', label: 'Ours (RL)', tag: 'After RL' }
];

const tabStrip = document.querySelector('#task-tabs');
const chipStrip = document.querySelector('#variant-chips');
const panelHead = document.querySelector('#panel-head');
const comparison = document.querySelector('#comparison');
const playButton = document.querySelector('#play-all');
const playStatus = document.querySelector('#play-status');

let activeTask = TASKS[0];
let activeVariant = 0;

/* Read a success rate out of the Table I markup. */
function rate(taskId, modelKey) {
  const cell = document.querySelector(`#table-i [data-m="${modelKey}"][data-t="${taskId}"]`);
  return cell ? cell.textContent.trim() : null;
}

function currentClips() {
  return activeTask.variants ? activeTask.variants[activeVariant].clips : activeTask.clips;
}

/* --------------------------------- tabs --------------------------------- */
function buildTabs() {
  TASKS.forEach((task, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tab';
    tab.textContent = task.tab;
    tab.id = `tab-${task.id}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'comparison');
    tab.addEventListener('click', () => selectTask(index));
    tabStrip.append(tab);
  });
  tabStrip.addEventListener('keydown', event => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = TASKS.indexOf(activeTask);
    selectTask((index + step + TASKS.length) % TASKS.length);
    tabStrip.children[TASKS.indexOf(activeTask)].focus();
  });
}

function syncTabs() {
  [...tabStrip.children].forEach((tab, index) => {
    const selected = TASKS[index] === activeTask;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    tab.classList.toggle('is-active', selected);
  });
}

/* -------------------------------- chips --------------------------------- */
function renderChips() {
  chipStrip.replaceChildren();
  if (!activeTask.variants) {
    chipStrip.hidden = true;
    return;
  }
  chipStrip.hidden = false;
  const legend = document.createElement('span');
  legend.className = 'chips-legend';
  legend.textContent = 'Duck colour';
  chipStrip.append(legend);
  activeTask.variants.forEach((variant, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = variant.label;
    chip.setAttribute('aria-pressed', String(index === activeVariant));
    chip.classList.toggle('is-active', index === activeVariant);
    chip.addEventListener('click', () => {
      activeVariant = index;
      renderChips();
      renderPanelHead();
      renderComparison();
    });
    chipStrip.append(chip);
  });
}

/* ------------------------------ panel head ------------------------------- */
function renderPanelHead() {
  panelHead.replaceChildren();

  const text = document.createElement('div');
  text.className = 'panel-text';
  const heading = document.createElement('h3');
  heading.textContent = activeTask.title;
  const blurb = document.createElement('p');
  blurb.textContent = activeTask.blurb;
  const demos = document.createElement('p');
  demos.className = 'panel-demos';
  demos.textContent = activeTask.demos;
  text.append(heading, blurb, demos);

  const tiles = document.createElement('div');
  tiles.className = 'stat-tiles';
  MODELS.forEach(model => {
    const value = rate(activeTask.id, model.key);
    if (value === null) return;
    const tile = document.createElement('div');
    tile.className = `stat-tile${model.key === 'rl' ? ' ours' : ''}`;
    const label = document.createElement('span');
    label.textContent = model.label;
    const strong = document.createElement('strong');
    strong.textContent = `${value}%`;
    tile.append(label, strong);
    tiles.append(tile);
  });
  const note = document.createElement('p');
  note.className = 'stat-note';
  note.textContent = `Real-robot success rate${activeTask.rateNote ? ' ' + activeTask.rateNote : ''} (Table I).`;

  const stats = document.createElement('div');
  stats.className = 'panel-stats';
  stats.append(tiles, note);

  panelHead.append(text, stats);
}

/* ------------------------------ comparison ------------------------------- */
function renderComparison() {
  comparison.querySelectorAll('video').forEach(video => video.pause());
  comparison.replaceChildren();
  comparison.setAttribute('role', 'tabpanel');
  comparison.setAttribute('aria-labelledby', `tab-${activeTask.id}`);
  playButton.textContent = 'Play available videos';
  playStatus.textContent = '';

  const clips = currentClips();
  // Models without a clip are left out entirely rather than shown as an empty
  // placeholder, so laptop simply renders two columns.
  const available = MODELS.filter(model => clips[model.key]);
  comparison.style.setProperty('--model-count', available.length);

  available.forEach(model => {
    const clip = clips[model.key];
    const card = document.createElement('article');
    card.className = `comparison-card${model.key === 'rl' ? ' ours' : ''}`;

    const heading = document.createElement('h4');
    heading.textContent = model.label;
    const badge = document.createElement('span');
    badge.className = 'model-tag';
    badge.textContent = model.tag;
    heading.append(badge);
    card.append(heading);

    const video = document.createElement('video');
    video.src = `media/${clip}.mp4`;
    video.poster = `assets/${clip}.jpg`;
    video.controls = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.loop = true;
    video.autoplay = !reducedMotion.matches;
    video.setAttribute('aria-label', `${model.label}: ${activeTask.title}`);
    video.addEventListener('error', () => {
      playStatus.textContent = 'A video could not be loaded. Please reload the page or open another task.';
    });
    video.addEventListener('ended', updatePlayLabel);
    card.append(video);

    const note = document.createElement('p');
    note.textContent = activeTask.acceleratedRl && model.key === 'rl'
      ? 'Accelerated recording; speed factor unspecified.'
      : 'Original timing · audio removed';
    card.append(note);

    comparison.append(card);
    if (video.autoplay) video.play().catch(updatePlayLabel);
  });
}

function selectTask(index) {
  activeTask = TASKS[index];
  activeVariant = 0;
  syncTabs();
  renderChips();
  renderPanelHead();
  renderComparison();
}

function updatePlayLabel() {
  const playing = [...comparison.querySelectorAll('video')].some(video => !video.paused && !video.ended);
  playButton.textContent = playing ? 'Pause all videos' : 'Play available videos';
}

playButton.addEventListener('click', async () => {
  const videos = [...comparison.querySelectorAll('video')];
  if (videos.some(video => !video.paused && !video.ended)) {
    videos.forEach(video => video.pause());
  } else {
    const results = await Promise.allSettled(videos.map(video => {
      if (video.ended) video.currentTime = 0;
      return video.play();
    }));
    playStatus.textContent = results.some(result => result.status === 'rejected')
      ? 'Use the individual video controls if your browser blocks simultaneous playback.'
      : '';
  }
  updatePlayLabel();
});

comparison.addEventListener('play', updatePlayLabel, true);
comparison.addEventListener('pause', updatePlayLabel, true);

buildTabs();
selectTask(0);

/* ------------------------------- code link ------------------------------- */
// Add the repository URL to data-repository-url in index.html when available.
const codeLink = document.querySelector('#code-link');
const repositoryUrl = codeLink.dataset.repositoryUrl.trim();
if (repositoryUrl.startsWith('https://')) {
  codeLink.href = repositoryUrl;
  codeLink.target = '_blank';
  codeLink.rel = 'noopener noreferrer';
  codeLink.removeAttribute('aria-disabled');
  codeLink.removeAttribute('title');
} else {
  codeLink.addEventListener('click', event => event.preventDefault());
}

/* ----------------------------- highlight reel ---------------------------- */
document.querySelectorAll('.hero-films video').forEach(video => {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'film-toggle';
  const taskName = video.closest('figure').querySelector('figcaption span').textContent;
  const updateToggle = () => {
    toggle.textContent = video.paused ? 'Play' : 'Pause';
    toggle.setAttribute('aria-label', `${video.paused ? 'Play' : 'Pause'} ${taskName.toLowerCase()} video`);
    toggle.classList.toggle('needs-play', video.paused);
  };
  toggle.addEventListener('click', () => {
    if (video.paused) video.play().catch(updateToggle);
    else video.pause();
  });
  video.addEventListener('play', updateToggle);
  video.addEventListener('pause', updateToggle);
  video.closest('figure').append(toggle);
  video.muted = true;
  if (reducedMotion.matches) {
    video.autoplay = false;
    video.pause();
  } else {
    video.play().catch(updateToggle);
  }
  updateToggle();
});
