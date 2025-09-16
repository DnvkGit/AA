const REFDT = 45884;
// Change this start date Excel number as needed
//   For Puzzle No1 REFDT must be todays ExcelDt
let currentSet = null;
let currentWord = null;
let offsetS = null;
let pool = [];
let answer = [];
let solvedWords = new Set();
let collectedHL = [];
let captionAttempts = 0;
const MAX_CAPTION_ATTEMPTS = 6;

function $(sel) { return document.querySelector(sel) }
function $all(sel) { return Array.from(document.querySelectorAll(sel)) }

async function loadSet(puzzleset) {
  let today = new Date();   // if no override, use current date

  // convert to Excel date
  //const excelDate = Math.floor((today - new Date(1899, 11, 30)) / (1000 * 60 * 60 * 24));
	today.setHours(0,0,0,0);
  // Calculate days since 1970-01-01- Javascript start Dt 
  const daysSince1970 = Math.floor(today.getTime() / (1000 * 60 * 60 * 24));
  // Add the offset for Excel's 1900 epoch 
  const excelT = daysSince1970 + 25569 + 1;  //to get excel Nbr for today 

  const offset = (excelT -REFDT + 1 ) % 365;  //offset to access the json & images -
  // - offset further modified to suit rollover after 365 days
  const offsetS = String(1000+offset).substring(1,4);
  filename="data/sets/d"+offsetS+".json"
  console.log("**",REFDT,excelT,offsetS,filename);
  let isRandom = false;

  let res;
  try {
    res = await fetch(filename);
	
	console.log("res",res);
    if (!res.ok) throw new Error();
  } catch {
    isRandom = true;
    //const rand = Math.floor(Math.random() * 5) + 1; // adjust max when adding more files 
	rand = Math.floor(Math.random() * 22) + 1
    filename = `data/sets/d${String(rand).padStart(3,'0')}.json`;
	console.log(filename);
    res = await fetch(filename);
	document.getElementById('randomLabel').textContent = "Random";
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
  let isDragging = false;

  img.addEventListener('click', () => {
    // Create overlay for fullscreen view
    overlay = document.createElement('div');
    overlay.className = 'cartoon-overlay';
    overlayImg = document.createElement('img');
    overlayImg.src = img.src;
    overlayImg.className = 'cartoon-overlay-img';

    overlay.appendChild(overlayImg);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden'; // prevent background scroll

    // Drag to pan
    overlayImg.addEventListener('mousedown', startDrag);
    overlayImg.addEventListener('touchstart', startDrag, { passive: false });

    // Exit fullscreen on click/tap if not dragging
    overlay.addEventListener('click', e => {
      if (!isDragging) closeOverlay();
    });
  });

  function startDrag(e) {
    e.preventDefault();
    isDragging = false;
    const evt = e.type.startsWith('touch') ? e.touches[0] : e;
    startX = evt.clientX - panX;
    startY = evt.clientY - panY;

    document.addEventListener(e.type.startsWith('touch') ? 'touchmove' : 'mousemove', onDrag, { passive: false });
    document.addEventListener(e.type.startsWith('touch') ? 'touchend' : 'mouseup', stopDrag);
  }

  function onDrag(e) {
    e.preventDefault();
    isDragging = true;
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
    setTimeout(() => { isDragging = false; }, 50);
  }

  function closeOverlay() {
    document.body.removeChild(overlay);
    document.body.style.overflow = '';
    document.body.style.overflow = '';
    overlay = null;
    panX = panY = 0;
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
  currentWord = currentSet.words.find(w => w.word_index === wordIndex);

  // ✅ get HL positions from jumble data if available
  const jum = currentSet.jumbles.find(j => j.word_index === wordIndex);
  if (jum.hl_positions) {
    currentWord.hl_positions = jum.hl_positions;
  }

  pool = [];
  let idc = 1;
  jum.jumble_seq.forEach(idx => {
    pool.push({ id: idc++, text: currentWord.syllables[idx - 1], sourceIndex: idx - 1, used: false });
  });
  answer = new Array(currentWord.length).fill(null);
  renderWorkArea();
  $('#workArea').hidden = false;
  showInfo('Solving Word ' + wordIndex + ' (length ' + currentWord.length + ')');
  updateHint('');
}


function renderWorkArea() {
  const poolEl = $('#pool'); 
  poolEl.innerHTML = '';
  pool.forEach(cell => {
    if (!cell.used) {
      const b = document.createElement('button');
      b.className = 'cell';
      b.textContent = cell.text;
      b.dataset.id = cell.id;
      b.addEventListener('click', () => onPoolTap(cell.id));
      poolEl.appendChild(b);
    }
  });

  const ansEl = $('#answerRow'); 
  ansEl.innerHTML = '';

  for (let i = 0; i < answer.length; i++) {
    const a = document.createElement('div');
    a.className = 'cell';
    a.dataset.pos = i;

    // ✅ Highlight HL cells based on hl_positions (1-based)
    if (
      currentWord &&
      Array.isArray(currentWord.hl_positions) &&
      currentWord.hl_positions.includes(i + 1)
    ) {
      a.classList.add('hl-cell');
    }

    a.textContent = answer[i] ? answer[i].text : '';
    a.addEventListener('click', () => onAnswerTap(i));
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
	  window.scrollTo({ top: 0, behavior: 'smooth' }); //Added on 31 Aug 
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
    b.className = 'cell hl-cell'; // ✅ always orange border
    b.textContent = s;
    b.dataset.idx = i;

    if (currentSet.reusable_syllables &&
      currentSet.reusable_syllables.some(rs => rs.normalize('NFC') === s.normalize('NFC'))) {
      b.classList.add('reusable'); // ✅ green bg + orange border
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
	captionAttempts = 0; // reset for next puzzle  
    updateHint('');
    showInfo('🎉 Congratulations! — Caption matched!');
    $('#captionCells').style.background = '#eaffef';
    showCongrats();


	// NEW: Build final caption with pre/inter/post + spaces[]
      
    let comments = currentSet.caption_comments || {};
    let spaces = (currentSet.caption && currentSet.caption.spaces) || []; // fix here
    let finalParts = [];

    if (comments.pre) {
      finalParts.push(`<span class="comment-part">${comments.pre}</span>`);
    }

    got.forEach((syll, idx) => {
      // Basic syllable
      finalParts.push(`<span class="caption-part">${syll}</span>`);

      // Insert a space if spaces[] contains this position (1-based index)
      if (Array.isArray(spaces) && spaces.includes(idx + 1)) {
        finalParts.push('&nbsp;');
      }

      // Insert inter-comments if any match this position
      if (Array.isArray(comments.inter)) {
        comments.inter
          .filter(c => c.pos === idx + 1) // 1-based index match
          .forEach(c => finalParts.push(`<span class="comment-part">${c.text}</span>`));
      }
    });

    if (comments.post) {
      finalParts.push(`<span class="comment-part">${comments.post}</span>`);
    }

    let finalMessage = finalParts.join('');


    // New code of Aug16th ends here
    // Display it under caption
    let finalEl = document.querySelector('.final-caption');
    if (!finalEl) {
      finalEl = document.createElement('div');
      finalEl.className = 'final-caption';
      document.getElementById('captionArea').appendChild(finalEl);
    }
	// ✅ Hide Reset / Confirm Caption buttons
	const resetBtn = document.getElementById('resetCaption');
	if (resetBtn) resetBtn.style.display = 'none';

	const confirmBtn = document.getElementById('confirmCaption');
	if (confirmBtn) confirmBtn.style.display = 'none';
	const capControls = document.getElementById('captionControls');
	if (capControls) capControls.style.display = 'none';

	// ✅ Clear HL area
	const hlArea = document.querySelector('.hlArea');
	if (hlArea) {
		/* // hlArea.innerHTML = ''; // remove collected syllables & title */
		hlArea.style.transition = 'opacity 0.5s ease';
		hlArea.style.opacity = '0';
		setTimeout(() => hlArea.innerHTML = '', 500);

	}
  // ✅ Show solved words in place of jumbled area
	const workArea = document.getElementById('workArea');
	// Find a place right below the caption
	// ✅ Show solved words below caption
	// ✅ Show solved words below caption
	const captionArea = document.getElementById('captionArea');
	if (captionArea) {
		// Remove old solved words summary if any
		const oldSummary = document.getElementById('solvedWordsSummary');
		if (oldSummary) oldSummary.remove();

			// Create solved words summary
		  const solvedList = document.createElement('div');
		  solvedList.id = 'solvedWordsSummary';
		  solvedList.innerHTML = '<h3>Solved Words</h3>' + renderAllSolvedWords();

		  // Insert after captionArea
		  captionArea.insertAdjacentElement('afterend', solvedList);
	}


    /* finalEl.textContent = finalMessage; */
	finalEl.innerHTML = finalMessage;
   /* document.getElementById('cartoonBox').scrollIntoView({ behavior: 'smooth', block: 'start' }); */
    window.scrollTo({ top: 0, behavior: 'smooth' });

	} else {
	  captionAttempts++ ;
// -----------------------
		if (captionAttempts >= MAX_CAPTION_ATTEMPTS) {
		// Show final caption anyway
			let comments = currentSet.caption_comments || {};
			let spaces = (currentSet.caption && currentSet.caption.spaces) || [];
			let finalParts = [];

			if (comments.pre) {
				finalParts.push(`<span class="comment-part">${comments.pre}</span>`);
			}

			capSyllables.forEach((syll, idx) => {
			finalParts.push(`<span class="caption-part">${syll}</span>`);
			if (spaces.includes(idx+1)) finalParts.push('&nbsp;');
			if (Array.isArray(comments.inter)) {
				comments.inter
				.filter(c => c.pos === idx + 1)
				.forEach(c => finalParts.push(`<span class="comment-part">${c.text}</span>`));
				}
			});

			if (comments.post) {
				finalParts.push(`<span class="comment-part">${comments.post}</span>`);
			}

			let finalEl = document.querySelector('.final-caption');
			if (!finalEl) {
				finalEl = document.createElement('div');
				finalEl.className = 'final-caption';
				document.getElementById('captionArea').appendChild(finalEl);
			}
			finalEl.innerHTML = `<div>❌ Attempts over (6). Caption:</div>` + finalParts.join('');

			// Hide buttons and clean HL area
			$('#captionControls').style.display = 'none';
			const hlArea = document.querySelector('.hlArea');
			if (hlArea) hlArea.style.display = 'none';

				// Show solved words too
			const captionArea = document.getElementById('captionArea');
			const solvedList = document.createElement('div');
			solvedList.id = 'solvedWordsSummary';
			solvedList.innerHTML = '<h3>Solved Words</h3>' + renderAllSolvedWords();
			captionArea.insertAdjacentElement('afterend', solvedList);

			showInfo("❌ Caption failed — solution revealed.");
			captionAttempts = 0; // reset
		} else {
			updateHint(`Caption attempt ${captionAttempts}/${MAX_CAPTION_ATTEMPTS} failed.`);
    }
  

		// -----------------------	  
	  
		// updateHint('Caption does not match yet.');
  }
}


function showInfo(s){ $('#info').textContent = s; }
function showCongrats(){
  const popup = $('#congratsPopup');
  popup.style.display = 'flex';
  setTimeout(()=> popup.style.display = 'none', 2000);
}

function showJCongrats(){
  const popup = $('#congratsJPopup');
  popup.style.display = 'flex';
  setTimeout(()=> popup.style.display = 'none', 2000);
}

function renderAllSolvedWords() {
  let html = '<div class="solved-words-grid">';
  currentSet.words.forEach((w) => {
    html += '<div class="solved-word-row">';
    
    w.syllables.forEach((s, idx) => {
      const isHL = w.hl_positions && w.hl_positions.includes(idx + 1);
	  html += `<div class="cell solved${isHL ? ' hl-cell' : ''}">${s}</div>`;

    });

    if (w.meaning) {
      html += `<span class="word-meaning">– ${w.meaning}</span>`;
    }

    html += '</div>';
  });
  html += '</div>';
  return html;
}


document.getElementById('resetBtn').addEventListener('click', ()=> resetPool());
document.getElementById('confirmBtn').addEventListener('click', ()=> confirmAnswer());


enableImageZoomPan();
loadSet();

document.addEventListener('DOMContentLoaded', () => {
  const helpBtn = document.getElementById('helpBtn');
  const helpOverlay = document.getElementById('helpOverlay');
  const closeHelpBtn = document.getElementById('closeHelp');

  if (helpBtn && helpOverlay) {
    helpBtn.addEventListener('click', () => {
      helpOverlay.style.display = 'flex';
    });

    // Click outside to close
    helpOverlay.addEventListener('click', (e) => {
      if (e.target.id === 'helpOverlay') {
        helpOverlay.style.display = 'none';
      }
    });

    // Close button to close
    if (closeHelpBtn) {
      closeHelpBtn.addEventListener('click', () => {
        helpOverlay.style.display = 'none';
      });
    }
  }
});

// ==========================
// Secret long-press header test mode
// ==========================
const header = document.querySelector('header');
let pressTimer;

// desktop long press
header.addEventListener('mousedown', () => {
  pressTimer = setTimeout(triggerSecretPrompt, 1500); // 1.5 sec hold
});
header.addEventListener('mouseup', () => clearTimeout(pressTimer));
header.addEventListener('mouseleave', () => clearTimeout(pressTimer));

// mobile long press
header.addEventListener('touchstart', () => {
  pressTimer = setTimeout(triggerSecretPrompt, 1500);
}, { passive: true }); // we can safely use passive here
header.addEventListener('touchend', () => clearTimeout(pressTimer));

function triggerSecretPrompt() {
  const puzzleNum = prompt("🔑 Enter puzzle number (e.g., 23):");
  if (puzzleNum) {
    const padded = puzzleNum.padStart(3, '0');
    fetch(`data/sets/d${padded}.json`)
      .then(r => {
        if (!r.ok) throw new Error("Puzzle not found");
        return r.json();
      })
      .then(set => {
        currentSet = set;
        renderJumblesList();
		showInfo('Loaded test set: ' + currentSet.title + ' ' +padded);
        $('#cartoonImg').src = currentSet.image;
        renderCaptionSkeleton();
      })
      .catch(err => {
        console.error("Load failed:", err);
        showInfo("⚠️ Puzzle not found");
      });
  }
}



