/* RatioGlide v7.2 - Logic Patch */
const state = {
    targetWPM: 250, words: [], originalText: "", currentWordIndex: 0, intervalId: null, 
    startTime: 0, endTime: 0, quizData: null, userAnswers: {}, userSequence: [], correctSequence: [],
    isPaperMode: false, isFocusBlur: false
};

const getEl = (id) => document.getElementById(id);

// --- VIEW NAV ---
function switchView(viewId) {
    document.querySelectorAll('.glass-card').forEach(el => {
        el.classList.remove('active');
        setTimeout(() => el.style.display = 'none', 400); // Sync with CSS transition time
    });
    const target = getEl(viewId);
    target.style.display = 'block';
    // Force Reflow
    void target.offsetWidth;
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- CONFIG ---
window.selectTopic = (topic) => {
    document.querySelectorAll('.chip').forEach(btn => btn.classList.remove('selected'));
    event.target.classList.add('selected');
    getEl('custom-topic-input').value = "";
    triggerGeneration(topic);
};

getEl('ai-generate-btn').addEventListener('click', () => {
    const val = getEl('custom-topic-input').value.trim();
    if(val) triggerGeneration(val);
});

getEl('file-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    getEl('file-status').textContent = file.name;
    getEl('file-status').style.color = "var(--success)";
    
    const reader = new FileReader();
    reader.onload = (evt) => {
        getEl('manual-text-input').value = evt.target.result;
        state.originalText = ""; // Clear AI text
    };
    reader.readAsText(file);
});

// Toggles
window.togglePaperMode = () => {
    state.isPaperMode = !state.isPaperMode;
    document.body.classList.toggle('paper-mode', state.isPaperMode);
    getEl('paper-mode-btn').classList.toggle('active', state.isPaperMode);
};
window.toggleFocusBlur = () => {
    state.isFocusBlur = !state.isFocusBlur;
    getEl('focus-blur-btn').classList.toggle('active', state.isFocusBlur);
};

// API
async function triggerGeneration(topic) {
    const status = getEl('status-msg');
    const country = getEl('country-select').value;
    const btn = getEl('ai-generate-btn');

    status.style.opacity = 1;
    status.textContent = `Drafting "${topic}" (${country})...`;
    status.style.color = "var(--text-muted)";
    btn.textContent = "⏳";
    btn.disabled = true;

    try {
        const res = await fetch('/api/generate-text', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, country })
        });
        if(!res.ok) throw new Error("API Error");
        const data = await res.json();
        state.originalText = data.text;
        getEl('manual-text-input').value = "";
        
        status.textContent = "Content Ready.";
        status.style.color = "#10b981"; // Success Green
        btn.textContent = "✨ Generate";
        btn.disabled = false;
    } catch (e) {
        status.textContent = "Error: Check Server.";
        status.style.color = "red";
        btn.textContent = "❌ Retry";
        btn.disabled = false;
    }
}

// READER (FIXED VISIBILITY)
getEl('start-btn').addEventListener('click', () => {
    const manual = getEl('manual-text-input').value.trim();
    if (manual.length > 20) state.originalText = manual;
    if (!state.originalText) { alert("Please provide text."); return; }

    state.words = state.originalText.trim().split(/\s+/);
    state.currentWordIndex = 0;
    state.targetWPM = parseInt(getEl('speed-slider').value);
    
    const container = getEl('text-container');
    container.innerHTML = state.words.map((w,i) => `<span id="word-${i}" class="word-span">${w} </span>`).join('');
    
    if(state.isFocusBlur) container.classList.add('blur-active');
    else container.classList.remove('blur-active');

    switchView('reader-view');
    state.startTime = Date.now();
    
    // IMMEDIATE UPDATE (Fixes "Disappearing Paragraph")
    updateWordHighlight(0); 
    
    state.intervalId = setInterval(tick, 60000 / state.targetWPM);
});

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
        curr.classList.add('active-word');
        curr.scrollIntoView({behavior:'smooth', block:'center'});
    }
    if (index > 0) {
        const prev = getEl(`word-${index-1}`);
        if (prev) {
            prev.classList.remove('active-word');
            prev.style.opacity = 0.4;
        }
    }
}

// QUIZ
async function generateQuiz() {
    try {
        const res = await fetch('/api/generate-quiz', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: state.originalText })
        });
        state.quizData = await res.json();
        state.correctSequence = [...state.quizData.sequence];
        renderQuiz();
    } catch (e) { alert("Quiz Gen Failed"); }
}

function renderQuiz() {
    getEl('ai-loader').style.display = 'none';
    getEl('quiz-content').classList.remove('hidden');
    
    getEl('question-container').innerHTML = state.quizData.questions.map(q => `
        <div class="q-box">
            <h3 style="margin-top:0">${q.questionText}</h3>
            ${q.options.map(opt => `<button class="q-opt" onclick="selAns(${q.id}, '${opt.replace(/'/g, "\\'")}', this)">${opt}</button>`).join('')}
        </div>
    `).join('') + `<button class="cta-btn" onclick="startSeq()">Next Phase &rarr;</button>`;
}

window.selAns = (id, ans, btn) => {
    state.userAnswers[id] = ans;
    Array.from(btn.parentElement.children).forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
};

// SEQUENCE
window.startSeq = () => {
    switchView('sequence-view');
    state.userSequence = [];
    const shuf = [...state.correctSequence].sort(() => 0.5 - Math.random());
    getEl('sequence-container').innerHTML = shuf.map(t => `<div class="seq-item" onclick="clickSeq('${t.replace(/'/g, "\\'")}', this)">${t}<span class="seq-idx"></span></div>`).join('');
    getEl('finish-seq-btn').classList.add('hidden');
};

window.clickSeq = (txt, el) => {
    if (el.classList.contains('correct') || el.classList.contains('wrong')) return;
    const idx = state.userSequence.length;
    if (txt === state.correctSequence[idx]) {
        el.classList.add('correct');
        el.querySelector('.seq-idx').textContent = idx + 1;
        state.userSequence.push(txt);
        if (state.userSequence.length === state.correctSequence.length) {
            getEl('sequence-feedback').textContent = "Complete!";
            getEl('finish-seq-btn').classList.remove('hidden');
        }
    } else {
        el.classList.add('wrong');
        setTimeout(() => el.classList.remove('wrong'), 500);
    }
};

// RESULTS
getEl('finish-seq-btn').onclick = () => {
    const mins = (state.endTime - state.startTime) / 60000;
    const raw = Math.round(state.words.length / mins) || 0;
    
    let corr = 0;
    state.quizData.questions.forEach(q => { if(state.userAnswers[q.id] === q.correctAnswer) corr++; });
    const acc = (corr / state.quizData.questions.length) * 100;
    const final = (acc * 0.6) + 40; // 40pts for sequence
    const ers = Math.round(raw * (final/100));

    getEl('final-raw').textContent = raw;
    getEl('final-acc').textContent = Math.round(final) + "%";
    getEl('final-ers').textContent = ers;
    
    // Grid Vocab
    getEl('vocab-container').innerHTML = (state.quizData.vocabulary || []).map(v => `
        <div class="vocab-card">
            <span class="vocab-term">${v.word}</span>
            ${v.definition}
        </div>
    `).join('');
    
    getEl('review-text-container').innerHTML = state.originalText;
    switchView('results-view');
};

// TOOLTIP
const tt = getEl('lookup-tooltip');
document.addEventListener('mouseup', async () => {
    const sel = window.getSelection();
    const txt = sel.toString().trim();
    if (!txt || !getEl('review-text-container').contains(sel.anchorNode.parentElement)) {
        tt.classList.remove('visible'); return;
    }
    
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const ttW = 260;
    const left = rect.left + (rect.width/2) - (ttW/2);
    
    tt.style.left = `${left}px`;
    tt.style.top = `${rect.bottom + window.scrollY + 10}px`;
    tt.classList.add('visible');
    
    getEl('tt-word').textContent = txt;
    getEl('tt-def').textContent = "...";
    
    const isPhrase = txt.split(' ').length > 2;
    getEl('tt-link').href = `https://www.google.com/search?q=${encodeURIComponent(txt)}`;
    
    if(!isPhrase) {
        try {
            const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${txt}`);
            const d = await r.json();
            getEl('tt-def').textContent = d[0].meanings[0].definitions[0].definition;
        } catch(e) { getEl('tt-def').textContent = "Definition not found."; }
    } else {
        getEl('tt-def').textContent = "Phrase selected.";
    }
});

getEl('speed-slider').oninput = (e) => getEl('target-wpm-disp').textContent = e.target.value;
getEl('restart-btn').onclick = () => location.reload();
getEl('theme-btn').onclick = () => {
    const r = document.documentElement;
    const n = r.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    r.setAttribute('data-theme', n);
};