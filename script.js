/* RatioGlide v7.5 - Stable Core */
const state = {
    targetWPM: 250, words: [], originalText: "", currentWordIndex: 0, intervalId: null, 
    startTime: 0, endTime: 0, quizData: null, userAnswers: {}, userSequence: [], correctSequence: [],
    isPaperMode: false, isFocusBlur: false
};

const getEl = (id) => document.getElementById(id);

// --- VIEW CONTROLLER ---
function switchView(viewId) {
    document.querySelectorAll('.card').forEach(el => el.classList.remove('active'));
    const target = getEl(viewId);
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- CONFIGURATION ---
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
    getEl('file-status').style.color = "var(--primary)";
    
    const reader = new FileReader();
    reader.onload = (evt) => {
        getEl('manual-text-input').value = evt.target.result;
        state.originalText = ""; 
    };
    reader.readAsText(file);
});

// Toggles
window.togglePaperMode = () => {
    state.isPaperMode = !state.isPaperMode;
    document.body.classList.toggle('paper-mode', state.isPaperMode);
};
window.toggleFocusBlur = () => {
    state.isFocusBlur = !state.isFocusBlur;
    const btn = getEl('focus-blur-btn');
    btn.style.backgroundColor = state.isFocusBlur ? "var(--primary)" : "";
    btn.style.color = state.isFocusBlur ? "white" : "";
};

// --- API ---
async function triggerGeneration(topic) {
    const status = getEl('status-msg');
    const country = getEl('country-select').value;
    const btn = getEl('ai-generate-btn');

    status.style.opacity = 1;
    status.textContent = `Writing "${topic}" (${country})...`;
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
        
        status.textContent = "Content Generated Successfully.";
        btn.textContent = "Generate";
        btn.disabled = false;
    } catch (e) {
        status.textContent = "Server Error. Check console.";
        status.style.color = "red";
        btn.textContent = "Retry";
        btn.disabled = false;
    }
}

// --- READER ---
getEl('start-btn').addEventListener('click', () => {
    const manual = getEl('manual-text-input').value.trim();
    if (manual.length > 20) state.originalText = manual;
    if (!state.originalText) { alert("Please provide text first."); return; }

    state.words = state.originalText.trim().split(/\s+/);
    state.currentWordIndex = 0;
    state.targetWPM = parseInt(getEl('speed-slider').value);
    
    const container = getEl('text-container');
    container.innerHTML = state.words.map((w,i) => `<span id="word-${i}" class="word">${w} </span>`).join('');
    
    if(state.isFocusBlur) container.classList.add('blur-active');
    else container.classList.remove('blur-active');

    switchView('reader-view');
    state.startTime = Date.now();
    
    // Highlight First Word Immediately
    updateHighlight(0);
    
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
    updateHighlight(state.currentWordIndex);
}

function updateHighlight(index) {
    const curr = getEl(`word-${index}`);
    if (curr) {
        curr.classList.add('highlight');
        curr.scrollIntoView({behavior:'smooth', block:'center'});
    }
    if (index > 0) {
        getEl(`word-${index-1}`).classList.remove('highlight');
    }
}

// --- QUIZ ---
async function generateQuiz() {
    try {
        const res = await fetch('/api/generate-quiz', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: state.originalText })
        });
        state.quizData = await res.json();
        state.correctSequence = [...state.quizData.sequence];
        renderQuiz();
    } catch (e) { alert("Quiz Failed to Load"); }
}

function renderQuiz() {
    getEl('ai-loader').style.display = 'none';
    getEl('quiz-content').style.display = 'block';
    
    getEl('question-container').innerHTML = state.quizData.questions.map(q => `
        <div class="question-card">
            <h3 style="margin-top:0">${q.questionText}</h3>
            ${q.options.map(opt => `<button class="option-btn" onclick="selAns(${q.id}, '${opt.replace(/'/g, "\\'")}', this)">${opt}</button>`).join('')}
        </div>
    `).join('') + `<button class="btn-full" onclick="startSeq()">Next Phase</button>`;
}

window.selAns = (id, ans, btn) => {
    state.userAnswers[id] = ans;
    Array.from(btn.parentElement.children).forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
};

// --- SEQUENCE ---
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

// --- RESULTS ---
getEl('finish-seq-btn').onclick = () => {
    const mins = (state.endTime - state.startTime) / 60000;
    const raw = Math.round(state.words.length / mins) || 0;
    
    let corr = 0;
    state.quizData.questions.forEach(q => { if(state.userAnswers[q.id] === q.correctAnswer) corr++; });
    const acc = (corr / state.quizData.questions.length) * 100;
    const ers = Math.round(raw * (acc/100));

    getEl('final-raw').textContent = raw;
    getEl('final-acc').textContent = Math.round(acc) + "%";
    getEl('final-ers').textContent = ers;
    
    getEl('vocab-container').innerHTML = (state.quizData.vocabulary || []).map(v => `
        <div class="vocab-item">
            <span class="vocab-term">${v.word}</span>
            ${v.definition}
        </div>
    `).join('');
    
    getEl('review-text-container').innerHTML = state.originalText;
    switchView('results-view');
};

// --- TOOLTIP ---
const tt = getEl('lookup-tooltip');
document.addEventListener('mouseup', async () => {
    const sel = window.getSelection();
    const txt = sel.toString().trim();
    if (!txt || !getEl('review-text-container').contains(sel.anchorNode.parentElement)) {
        tt.classList.remove('visible'); return;
    }
    
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    tt.style.left = `${rect.left + (rect.width/2) - 125}px`;
    tt.style.top = `${rect.bottom + window.scrollY + 10}px`;
    tt.classList.add('visible');
    
    getEl('tt-word').textContent = txt;
    getEl('tt-def').textContent = "...";
    getEl('tt-link').href = `https://www.google.com/search?q=${encodeURIComponent(txt)}`;
    
    if(txt.split(' ').length < 3) {
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