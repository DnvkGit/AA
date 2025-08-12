const REFDT = 45880; // Change this start date Excel number as needed
let currentSet = null;
let currentWord = null;
let pool = [];
let answer = [];
let solvedWords = new Set();
let collectedHL = [];

function $(sel) { return document.querySelector(sel) }
function $all(sel) { return Array.from(document.querySelectorAll(sel)) }

async function loadSet() {
  const today = new Date();
  today.setHours(0,0,0,0);
  const excelNum = Math.floor((today - new Date(1899, 11, 30)) / (1000*60*60*24));
  const offset = excelNum - REFDT;
  let fileName = `data/sets/d${String(offset).padStart(3,'0')}.json`;
  let isRandom = false;

  let res;
  try {
    res = await fetch(fileName);
    if (!res.ok) throw new Error();
  } catch {
    isRandom = true;
    const rand = Math.floor(Math.random() * 5) + 1; // adjust max when adding more files
    fileName = `data/sets/d${String(rand).padStart(3,'0')}.json`;
    res = await fetch(fileName);
    $("#randomLabel").style.display = "block";
  }

  currentSet = await res.json();
  renderJumblesList();
  showInfo('Loaded set: ' + currentSet.title);
  $('#cartoonImg').src = currentSet.image;
  renderCaptionSkeleton();
}

function enableImageZoomPan() {
  const img = $('#cartoonImg');
  let overlay, overlayImg;
  let startX = 0, startY = 0, panX = 0, panY = 0;

  img.addEventListener('click', () => {
    // Create overlay for fullscreen view
    overlay = document.createElement('div');
    overlay.className = 'cartoon-overlay';
    overlayImg = document.createElement('img');
    overlayImg.src = img.src;
    overlayImg.className = 'cartoon-overlay-img';

    overlay.appendChild(overlayImg);
    document.body.appendChild(overlay);

    // Drag to pan
    overlayImg.addEventListener('mousedown', startDrag);
    overlayImg.addEventListener('touchstart', startDrag, { passive: false });

    // Exit fullscreen on click/tap
    overlay.addEventListener('click', closeOverlay);
  });

  function startDrag(e) {
    e.preventDefault();
    const evt = e.type.startsWith('touch') ? e.touches[0] : e;
    startX = evt.clientX - panX;
    startY = evt.clientY - panY;

    document.addEventListener(e.type.startsWith('touch') ? 'touchmove' : 'mousemove', onDrag, { passive: false });
    document.addEventListener(e.type.startsWith('touch') ? 'touchend' : 'mouseup', stopDrag);
  }

  function onDrag(e) {
    e.preventDefault();
    const evt = e.type.startsWith('touch') ? e.touches[0] : e;
    panX = evt.clientX - startX;
    panY = evt.clientY - startY;
    overlayImg.style.transform = `translate(${panX}px, ${panY}px) scale(2)`;
  }

  function stopDrag(e) {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', stopDrag);
  }

  function closeOverlay(e) {
    e.stopPropagation();
    document.body.removeChild(overlay);
    overlay = null;
  }
}

function renderCaptionSkeleton() {
  const captionCells = $('#captionCells');
  captionCells.innerHTML = '';
  const capSyllables = currentSet.caption.syllables;
  const capSpaces = currentSet.caption.spaces || [];

  capSyllables.forEach((_, i) => {
    const el = document.createElement('div');
    el.className = 'cell';
    el.dataset.pos = i;
    el.textContent = '_';
    captionCells.appendChild(el);

    if (capSpaces.includes(i+1)) {
      const gap = document.createElement('div');
      gap.style.width = '12px';
      captionCells.appendChild(gap);
    }
  });
}

function renderJumblesList() {
  const list = $('#jumblesList'); list.innerHTML='';
  currentSet.words.forEach(w=>{
    const item = document.createElement('div');
    item.className='jumbleItem';
    if(solvedWords.has(w.word_index)) item.classList.add('solved');
    item.dataset.index = w.word_index;
    const left = document.createElement('div');
    left.className='jumblePreview';
    const jum = currentSet.jumbles.find(j=>j.word_index===w.word_index);
    jum.jumble_seq.forEach(idx=>{
      const c = document.createElement('div');
      c.className='cell';
      c.textContent = w.syllables[idx-1];
      left.appendChild(c);
    });
    const right = document.createElement('div');
    right.style.marginLeft='auto';
    right.textContent = 'Word ' + w.word_index;
    item.appendChild(left);
    item.appendChild(right);
    item.addEventListener('click', ()=> {
      selectJumble(w.word_index);
      document.getElementById('workArea').scrollIntoView({behavior: 'smooth'});
    });
    list.appendChild(item);
  });
}

function selectJumble(wordIndex) {
  currentWord = currentSet.words.find(w=>w.word_index===wordIndex);
  pool = [];
  const jum = currentSet.jumbles.find(j=>j.word_index===wordIndex);
  let idc=1;
  jum.jumble_seq.forEach(idx=>{
    pool.push({id:idc++, text: currentWord.syllables[idx-1], sourceIndex: idx-1, used:false});
  });
  answer = new Array(currentWord.length).fill(null);
  renderWorkArea();
  $('#workArea').hidden = false;
  showInfo('Solving Word ' + wordIndex + ' (length ' + currentWord.length + ')');
  updateHint('');
}

function renderWorkArea() {
  const poolEl = $('#pool'); poolEl.innerHTML='';
  pool.forEach(cell=>{
    if(!cell.used){
      const b = document.createElement('button');
      b.className='cell';
      b.textContent = cell.text;
      b.dataset.id = cell.id;
      b.addEventListener('click', ()=> onPoolTap(cell.id));
      poolEl.appendChild(b);
    }
  });
  const ansEl = $('#answerRow'); ansEl.innerHTML='';
  for(let i=0;i<answer.length;i++){
    const a = document.createElement('div');
    a.className='cell';
    a.dataset.pos = i;
    a.textContent = answer[i]? answer[i].text : '';
    a.addEventListener('click', ()=> onAnswerTap(i));
    ansEl.appendChild(a);
  }
  renderHLPool();
}

function onPoolTap(id) {
  const cell = pool.find(c=>c.id==id && !c.used);
  if(!cell) return;
  const idx = answer.findIndex(x=>x===null);
  if(idx===-1) return;
  answer[idx]=cell;
  cell.used=true;
  renderWorkArea();
}

function onAnswerTap(pos) {
  const cell = answer[pos];
  if(!cell) return;
  const p = pool.find(c=>c.id===cell.id);
  if(p) p.used=false;
  answer[pos]=null;
  renderWorkArea();
}

function updateHint(msg){ $('#hint').textContent = msg || '' }
function resetPool(){ pool.forEach(c=>c.used=false); answer = new Array(currentWord.length).fill(null); renderWorkArea(); }

function confirmAnswer(){
  const seq = answer.map(a=> a? a.text : '');
  if(seq.includes('')){ updateHint('Complete the word before confirming'); return; }
  const target = currentWord.syllables.slice();
  const ok = arraysEqual(seq, target);
  if(ok){
    solvedWords.add(currentWord.word_index);
    renderJumblesList();
    if(currentWord.hl_positions && currentWord.hl_positions.length){
      currentWord.hl_positions.forEach(pos=>{
        const syl = currentWord.syllables[pos-1];
        collectedHL.push(syl);
      });
    }
    renderHLPool();
    $('#workArea').hidden = true;
    showInfo('Correct! HL syllables collected (if any).');
    if(solvedWords.size === currentSet.words.length){
      startCaptionAssembly();
      document.getElementById('jumblesList').scrollIntoView({behavior: 'smooth'});
	  showInfo('🎉 Jumbles Done! Go for Caption!');
      showJCongrats();
    }
  } else {
    updateHint('Incorrect — try again');
  }
}

function arraysEqual(a,b){
  if(a.length!==b.length) return false;
  for(let i=0;i<a.length;i++){
    if(a[i]!==b[i]) return false;
  }
  return true;
}

function renderHLPool(){
  const el = $('#hlPool'); el.innerHTML = '';
  collectedHL.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'cell';
    b.textContent = s;
    b.dataset.idx = i;
    if (currentSet.reusable_syllables &&
      currentSet.reusable_syllables.some(rs => rs.normalize('NFC') === s.normalize('NFC'))) {
      b.style.backgroundColor = 'lightgreen';
      b.dataset.reusable = 'true';
    }
    b.addEventListener('click', () => {
      const captionCells = Array.from($('#captionCells').children)
        .filter(c => c.classList.contains('cell'));
      const empty = captionCells.find(c => c.textContent === '_');
      if (empty) {
        empty.textContent = s;
        if (!b.dataset.reusable) {
          b.style.visibility = 'hidden';
        }
      }
    });
    el.appendChild(b);
  });
}

function startCaptionAssembly(){
  showInfo('All words solved! Assemble the caption.');
  $('#hlArea').style.borderColor = 'var(--green)';
  updateHint('Click HL syllables to fill caption cells.');
  $('#captionControls').style.display = 'flex';
  $('#resetCaptionBtn').onclick = resetCaption;
  $('#confirmCaptionBtn').onclick = checkCaption;
}

function resetCaption(){
  const captionCells = Array.from($('#captionCells').children)
    .filter(c => c.classList.contains('cell'));
  captionCells.forEach(c => c.textContent = '_');
  document.querySelectorAll('#hlPool .cell').forEach(btn => {
    btn.style.visibility = 'visible';
  });
  updateHint('Caption reset. Click HL letters again.');
}

function checkCaption(){
  const capSyllables = currentSet.caption.syllables;
  const got = Array.from($('#captionCells').children)
                   .filter(c=>c.classList.contains('cell'))
                   .map(c=> c.textContent==='_'? '' : c.textContent);
  if(arraysEqual(got, capSyllables)){
    updateHint('');
    showInfo('🎉 Congratulations! — Caption matched!');
	showCongrats();
    $('#captionCells').style.background = '#eaffef';
  } else {
    updateHint('Caption does not match yet.');
  }
}

function showInfo(s){ $('#info').textContent = s; }
function showCongrats(){
  const popup = $('#congratsPopup');
  popup.style.display = 'flex';
  setTimeout(()=> popup.style.display = 'none', 3000);
}

function showJCongrats(){
  const popup = $('#congratsJPopup');
  popup.style.display = 'flex';
  setTimeout(()=> popup.style.display = 'none', 3000);
}
document.getElementById('resetBtn').addEventListener('click', ()=> resetPool());
document.getElementById('confirmBtn').addEventListener('click', ()=> confirmAnswer());

enableImageZoomPan();
loadSet();
