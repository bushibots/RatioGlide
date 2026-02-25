/* RatioGlide v7.6 - Career Mode Fixed */
const state = {
    targetWPM: 250, words: [], originalText: "", currentWordIndex: 0, intervalId: null, 
    startTime: 0, endTime: 0, quizData: null, userAnswers: {}, userSequence: [], correctSequence: [],
    isPaperMode: false, isFocusBlur: false
};

const getEl = (id) => document.getElementById(id);

// --- CAREER MANAGER ---
const Career = {
    save: (wpm, acc, missedTypes) => {
        const history = JSON.parse(localStorage.getItem('ratioglide_history') || '[]');
        history.push({ 
            date: new Date().toISOString(), 
            wpm, 
            acc,
            missed: missedTypes || []
        });
        localStorage.setItem('ratioglide_history', JSON.stringify(history));
        Career.updateUI();
    },
    
    getStats: () => {
        const history = JSON.parse(localStorage.getItem('ratioglide_history') || '[]');
        if (!history.length) return { total: 0, avg: 0, best: 0, weakness: "None" };
        const avg = Math.round(history.reduce((a, b) => a + b.wpm, 0) / history.length);
        const best = Math.max(...history.map(s => s.acc));
        
        const typeCounts = {};
        history.forEach(session => {
            if(session.missed) {
                session.missed.forEach(type => {
                    typeCounts[type] = (typeCounts[type] || 0) + 1;
                });
            }
        });

        let weakness = "None";
        let maxCount = 0;
        for (const [type, count] of Object.entries(typeCounts)) {
            if (count > maxCount) {
                maxCount = count;
                weakness = type;
            }
        }
        return { total: history.length, avg, best, weakness };
    },

    updateUI: () => {
        const s = Career.getStats();
        if(getEl('stat-total')) getEl('stat-total').textContent = s.total;
        if(getEl('stat-avg')) getEl('stat-avg').textContent = s.avg;
        if(getEl('stat-best')) getEl('stat-best').textContent = s.best + '%';
        if(getEl('stat-weakness')) getEl('stat-weakness').textContent = s.weakness;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Career.updateUI();
});

function switchView(viewId) {
    document.querySelectorAll('.card').forEach(el => el.classList.remove('active'));
    const target = getEl(viewId);
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.selectTopic = (topic, btnElement) => {
    document.querySelectorAll('.chip').forEach(btn => btn.classList.remove('selected'));
    if (btnElement) btnElement.classList.add('selected');
    getEl('custom-topic-input').value = topic;
    const genBtn = getEl('ai-generate-btn');
    genBtn.style.transform = "scale(1.1)";
    setTimeout(() => genBtn.style.transform = "scale(1)", 200);
};

getEl('ai-generate-btn').addEventListener('click', () => {
    const val = getEl('custom-topic-input').value.trim();
    if(val) triggerGeneration(val);
});

getEl('file-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    getEl('file-status').textContent = file.name;
    const reader = new FileReader();
    reader.onload = (evt) => {
        getEl('manual-text-input').value = evt.target.result;
    };
    reader.readAsText(file);
});

window.togglePaperMode = () => {
    state.isPaperMode = !state.isPaperMode;
    document.body.classList.toggle('paper-mode', state.isPaperMode);
    getEl('paper-mode-btn').classList.toggle('active', state.isPaperMode);
};

window.toggleFocusBlur = () => {
    state.isFocusBlur = !state.isFocusBlur;
    getEl('focus-blur-btn').classList.toggle('active', state.isFocusBlur);
};

async function triggerGeneration(topic) {
    const status = getEl('status-msg');
    const country = getEl('country-select').value;
    const btn = getEl('ai-generate-btn');
    status.style.opacity = 1;
    status.textContent = `Drafting "${topic}"...`;
    btn.disabled = true;

    try {
        const res = await fetch('/api/generate-text', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, country })
        });
        const data = await res.json();
        state.originalText = data.text;
        getEl('manual-text-input').value = "";
        status.textContent = "Content Ready.";
        btn.disabled = false;
    } catch (e) {
        status.textContent = "Error: Check Server.";
        btn.disabled = false;
    }
}

getEl('start-btn').addEventListener('click', () => {
    // 1. Clear any existing timer
    if (state.intervalId) clearInterval(state.intervalId);

    // 2. Capture and validate text
    const manual = getEl('manual-text-input').value.trim();
    if (manual.length > 0) state.originalText = manual;
    if (!state.originalText) { alert("Please provide text."); return; }

    // 3. Prepare Content (Neural Chunking vs Single Word)
    const rawWords = state.originalText.trim().split(/\s+/);
    
    if (state.isChunkMode) {
        // Smart Chunking: Groups up to 3 words, but breaks early at natural punctuation
        state.words = [];
        let currentChunk = [];
        for (let w of rawWords) {
            currentChunk.push(w);
            // Break chunk if we hit 3 words OR if the word ends with punctuation
            if (currentChunk.length >= 3 || /[.,!?;:]$/.test(w) || w.includes('-')) {
                state.words.push(currentChunk.join(' '));
                currentChunk = [];
            }
        }
        // Push any remaining words
        if (currentChunk.length > 0) state.words.push(currentChunk.join(' '));
    } else {
        state.words = rawWords;
    }

    state.currentWordIndex = 0;
    state.targetWPM = parseInt(getEl('speed-slider').value);
    
    // 4. Render to Container
    const container = getEl('text-container');
    container.innerHTML = state.words.map((w, i) => 
        `<span id="word-${i}" class="word">${w} </span>`
    ).join('');
    
    // 5. Apply Mode Classes
    if (state.isFocusBlur) container.classList.add('blur-active');
    else container.classList.remove('blur-active');

    // 6. Start Session
    switchView('reader-view');
    state.startTime = Date.now();
    updateWordHighlight(0); 
    
    // 7. Dynamic Interval (Adjusts speed for chunks so WPM remains accurate)
    const multiplier = state.isChunkMode ? 3 : 1;
    state.intervalId = setInterval(tick, (60000 / state.targetWPM) * multiplier);
});

window.toggleChunkMode = () => {
    state.isChunkMode = !state.isChunkMode;
    const btn = getEl('chunk-mode-btn');
    
    if (state.isChunkMode) {
        btn.classList.add('active');
        btn.innerHTML = "🧩 Chunk Mode: ON";
        btn.style.backgroundColor = "var(--primary)";
        btn.style.color = "white";
    } else {
        btn.classList.remove('active');
        btn.innerHTML = "🧩 Chunk Mode: OFF";
        btn.style.backgroundColor = "";
        btn.style.color = "";
    }
};

function tick() {
    state.currentWordIndex++;
    if (state.currentWordIndex >= state.words.length) {
        clearInterval(state.intervalId);
        state.endTime = Date.now();
        switchView('quiz-view');
        generateQuiz();
        return;
    }
    updateWordHighlight(state.currentWordIndex);
}

function updateWordHighlight(index) {
    const curr = getEl(`word-${index}`);
    if (curr) {
        curr.classList.add('highlight'); // Matches the consolidated CSS
        curr.scrollIntoView({behavior:'auto', block:'nearest', inline:'center'});
    }
    if (index > 0) {
        const prev = getEl(`word-${index-1}`);
        if (prev) {
            prev.classList.remove('highlight');
            if(state.isFocusBlur) prev.style.opacity = 0.3;
            else prev.style.opacity = 1;
        }
    }
}

async function generateQuiz() {
    try {
        const res = await fetch('/api/generate-quiz', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: state.originalText })
        });
        state.quizData = await res.json();
        state.correctSequence = [...state.quizData.sequence];
        renderQuiz();
    } catch (e) { console.error("Quiz Error", e); }
}

function renderQuiz() {
    getEl('ai-loader').style.display = 'none';
    getEl('quiz-content').style.display = 'block';
    getEl('question-container').innerHTML = state.quizData.questions.map(q => `
        <div class="question-card">
            <h3>${q.questionText}</h3>
            ${q.options.map(opt => `<button class="option-btn" onclick="selAns(${q.id}, '${opt.replace(/'/g, "\\'")}', this)">${opt}</button>`).join('')}
        </div>
    `).join('') + `<button class="btn-full" onclick="startSeq()">Next Phase</button>`;
}

window.selAns = (id, ans, btn) => {
    state.userAnswers[id] = ans;
    Array.from(btn.parentElement.children).forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
};

window.startSeq = () => {
    switchView('sequence-view');
    state.userSequence = [];
    const shuf = [...state.correctSequence].sort(() => 0.5 - Math.random());
    getEl('sequence-container').innerHTML = shuf.map(t => `<div class="seq-item" onclick="clickSeq('${t.replace(/'/g, "\\'")}', this)">${t}<div class="seq-num"></div></div>`).join('');
    getEl('finish-seq-btn').style.display = 'none';
};

window.clickSeq = (txt, el) => {
    if (el.classList.contains('correct') || el.classList.contains('wrong')) return;
    const idx = state.userSequence.length;
    if (txt === state.correctSequence[idx]) {
        el.classList.add('correct');
        el.querySelector('.seq-num').textContent = idx + 1;
        state.userSequence.push(txt);
        if (state.userSequence.length === state.correctSequence.length) {
            getEl('sequence-feedback').textContent = "Complete!";
            getEl('finish-seq-btn').style.display = 'block';
        }
    } else {
        el.classList.add('wrong');
        setTimeout(() => el.classList.remove('wrong'), 500);
    }
};

getEl('finish-seq-btn').onclick = () => {
    const timeMs = Math.max(state.endTime - state.startTime, 1000);
    const timeMinutes = timeMs / 60000;
    const totalChars = state.originalText.length;
    const stdWords = totalChars / 5;
    let raw = Math.round(stdWords / timeMinutes);
    if (raw > state.targetWPM * 1.5) raw = state.targetWPM;

    let corr = 0;
    let missedTypes = [];
    state.quizData.questions.forEach(q => { 
        if(state.userAnswers[q.id] === q.correctAnswer) corr++; 
        else missedTypes.push(q.type || "General");
    });

    const acc = (corr / state.quizData.questions.length) * 100;
    const final = (acc * 0.6) + 40; 
    const ers = Math.round(raw * (final/100));

    Career.save(ers, Math.round(final), missedTypes);

    getEl('final-raw').textContent = raw;
    getEl('final-acc').textContent = Math.round(final) + "%";
    getEl('final-ers').textContent = ers;
    getEl('coach-feedback').innerHTML = `Session Recorded. Weakness Updated.`;
    getEl('vocab-container').innerHTML = (state.quizData.vocabulary || []).map(v => `<div class="vocab-item"><span class="vocab-term">${v.word}</span>${v.definition}</div>`).join('');
    getEl('review-text-container').innerHTML = state.originalText;
    switchView('results-view');
};

const tt = getEl('lookup-tooltip');
document.addEventListener('mouseup', async () => {
    const sel = window.getSelection();
    const txt = sel.toString().trim();
    const reviewBox = getEl('review-text-container');
    
    // Only trigger if text is selected inside the Review Box
    if (!txt || !sel.anchorNode || !sel.anchorNode.parentElement || !reviewBox.contains(sel.anchorNode.parentElement)) {
        tt.classList.remove('visible'); 
        return;
    }
    
    // Position Tooltip
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const scrollY = window.scrollY;
    
    tt.style.left = `${rect.left + (rect.width / 2) - 125}px`;
    tt.style.top = `${rect.top + scrollY - 110}px`; // Positions above the text
    tt.classList.add('visible');
    
    getEl('tt-word').textContent = txt;
    getEl('tt-def').textContent = "Searching...";
    getEl('tt-link').href = `https://www.google.com/search?q=define+${encodeURIComponent(txt)}`;
    
    // Dictionary API for single words
    if(txt.split(' ').length === 1) {
        try {
            const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${txt.toLowerCase()}`);
            if(!r.ok) throw new Error();
            const d = await r.json();
            getEl('tt-def').textContent = d[0].meanings[0].definitions[0].definition;
        } catch(e) { 
            getEl('tt-def').textContent = "Definition not found. Try the search icon."; 
        }
    } else {
        getEl('tt-def').textContent = "Phrase selected. Use the search icon for full context.";
    }
});

getEl('speed-slider').oninput = (e) => {
    getEl('target-wpm-disp').textContent = e.target.value;
    const sliderDisp = getEl('slider-wpm-disp');
    if(sliderDisp) sliderDisp.textContent = e.target.value;
};
getEl('restart-btn').onclick = () => location.reload();
getEl('theme-btn').onclick = () => {
    const r = document.documentElement;
    const n = r.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    r.setAttribute('data-theme', n);
};

getEl('country-select').addEventListener('change', (e) => {
    const val = e.target.value;
    const overlay = getEl('flag-overlay');
    overlay.className = 'flag-overlay'; 
    void overlay.offsetWidth; 
    if (val === 'India') overlay.classList.add('bg-india');
    else if (val === 'USA') overlay.classList.add('bg-usa');
    else if (val === 'UK') overlay.classList.add('bg-uk');
    else overlay.classList.add('bg-global');
    overlay.classList.add('flag-trigger');
});

function createChunks(words, size = 3) {
    let chunks = [];
    for (let i = 0; i < words.length; i += size) {
        chunks.push(words.slice(i, i + size).join(' '));
    }
    return chunks;
}

