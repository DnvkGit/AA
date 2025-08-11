
// Minimal prototype script for Jumble puzzle with caption syllables support
let currentSet = null;
let currentWord = null;
let pool = [];
let answer = [];
let solvedWords = new Set();
let collectedHL = [];

function $(sel){return document.querySelector(sel)}
function $all(sel){return Array.from(document.querySelectorAll(sel))}

async function loadSet(){
  const res = await fetch('data/sets/d001.json');
  currentSet = await res.json();
  renderJumblesList();
  showInfo('Loaded set: ' + currentSet.title);
  document.getElementById('cartoonImg').src = currentSet.image;
  renderCaptionSkeleton();
}

function renderCaptionSkeleton(){
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

function renderJumblesList(){
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
    item.addEventListener('click', ()=> selectJumble(w.word_index));
    list.appendChild(item);
  });
}

function selectJumble(wordIndex){
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

function renderWorkArea(){
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

function onPoolTap(id){
  const cell = pool.find(c=>c.id==id && !c.used);
  if(!cell) return;
  const idx = answer.findIndex(x=>x===null);
  if(idx===-1) return;
  answer[idx]=cell;
  cell.used=true;
  renderWorkArea();
}

function onAnswerTap(pos){
  const cell = answer[pos];
  if(!cell) return;
  const p = pool.find(c=>c.id===cell.id);
  if(p) p.used=false;
  answer[pos]=null;
  renderWorkArea();
}

function updateHint(msg){ $('#hint').textContent = msg || '' }

function resetPool(){
  pool.forEach(c=>c.used=false);
  answer = new Array(currentWord.length).fill(null);
  renderWorkArea();
}

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
  const el = $('#hlPool'); 
  el.innerHTML = '';

  collectedHL.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'cell';
    b.textContent = s;
    b.dataset.idx = i;

    // Normalize to NFC before comparison
    if (
      currentSet.reusable_syllables &&
      currentSet.reusable_syllables.some(rs => rs.normalize('NFC') === s.normalize('NFC'))
    ) {
      b.style.backgroundColor = 'lightgreen';
      b.dataset.reusable = 'true';
    }

    b.addEventListener('click', () => {
      const captionCells = Array.from($('#captionCells').children)
        .filter(c => c.classList.contains('cell'));
      const empty = captionCells.find(c => c.textContent === '_');
      if (empty) {
        empty.textContent = s;
        // Hide only if not reusable
        if (!b.dataset.reusable) {
          b.style.visibility = 'hidden';
        }
      }
    });

    el.appendChild(b);
  });
}



function onHLTap(i){
  const captionCells = Array.from($('#captionCells').children).filter(c=>c.classList.contains('cell'));
  const empty = captionCells.find(c=>c.textContent==='_');
  if(!empty) return;
  empty.textContent = collectedHL[i];
}

function startCaptionAssembly(){
  showInfo('All words solved! Assemble the caption.');
  $('#hlArea').style.borderColor = 'var(--green)';
  updateHint('Click HL syllables to fill caption cells.');
  
  // Show controls for caption
  $('#captionControls').style.display = 'flex';
  $('#resetCaptionBtn').onclick = resetCaption;
  $('#confirmCaptionBtn').onclick = checkCaption;

}

function resetCaption(){
  const captionCells = Array.from($('#captionCells').children)
    .filter(c => c.classList.contains('cell'));
  captionCells.forEach(c => c.textContent = '_');

  // Restore all HL buttons visibility
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
    showInfo('🎉 Congratulations — caption matched!');
    $('#captionCells').style.background = '#eaffef';
  } else {
    updateHint('Caption does not match yet.');
  }
}




function showInfo(s){ $('#info').textContent = s; }

document.getElementById('resetBtn').addEventListener('click', ()=> resetPool());
document.getElementById('confirmBtn').addEventListener('click', ()=> confirmAnswer());

loadSet();
