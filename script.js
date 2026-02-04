/* RatioGlide v7.6 - Career Mode */
const state = {
    targetWPM: 250, words: [], originalText: "", currentWordIndex: 0, intervalId: null, 
    startTime: 0, endTime: 0, quizData: null, userAnswers: {}, userSequence: [], correctSequence: [],
    isPaperMode: false, isFocusBlur: false
};

const getEl = (id) => document.getElementById(id);

// --- CAREER MANAGER (New Feature) ---
const Career = {
    save: (wpm, acc, missedTypes) => {
        const history = JSON.parse(localStorage.getItem('ratioglide_history') || '[]');
        // Save session + missed question types
        history.push({ 
            date: new Date().toISOString(), 
            wpm, 
            acc,
            missed: missedTypes || [] // Store array of strings like ["Inference", "Main Idea"]
        });
        localStorage.setItem('ratioglide_history', JSON.stringify(history));
        Career.updateUI();
    },
    
    getStats: () => {
        const history = JSON.parse(localStorage.getItem('ratioglide_history') || '[]');
        if (!history.length) return { total: 0, avg: 0, best: 0, weakness: "None" };

        const avg = Math.round(history.reduce((a, b) => a + b.wpm, 0) / history.length);
        const best = Math.max(...history.map(s => s.acc));
        
        // Calculate Weakness Frequency
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

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    Career.updateUI(); // Load stats on startup
});

// --- VIEW NAV ---
function switchView(viewId) {
    document.querySelectorAll('.glass-card').forEach(el => {
        el.classList.remove('active');
        setTimeout(() => el.style.display = 'none', 400); 
    });
    const target = getEl(viewId);
    target.style.display = 'block';
    void target.offsetWidth;
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- CONFIG ---
window.selectTopic = (topic) => {
    // 1. Visual Selection
    document.querySelectorAll('.chip').forEach(btn => btn.classList.remove('selected'));
    event.target.classList.add('selected');
    
    // 2. Fill Input ONLY (Do not generate yet)
    getEl('custom-topic-input').value = topic;
    
    // 3. Optional: Highlight the Generate button to show it's next
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
    getEl('file-status').style.color = "var(--success)";
    
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
        status.style.color = "#10b981"; 
        btn.textContent = "✨ Generate";
        btn.disabled = false;
    } catch (e) {
        status.textContent = "Error: Check Server.";
        status.style.color = "red";
        btn.textContent = "❌ Retry";
        btn.disabled = false;
    }
}

// READER 
getEl('start-btn').addEventListener('click', () => {
    // FIX: Clear old timer to prevent double-speed bug
    if (state.intervalId) clearInterval(state.intervalId);

    const manual = getEl('manual-text-input').value.trim();
    
    // FIX: Allow text > 0 (was > 20), so short sentences work
    if (manual.length > 0) state.originalText = manual;
    
    if (!state.originalText) { alert("Please provide text."); return; }

    state.words = state.originalText.trim().split(/\s+/);
    state.currentWordIndex = 0;
    state.targetWPM = parseInt(getEl('speed-slider').value);
    
    // 5. RENDER TEXT
    const container = getEl('text-container');
    container.innerHTML = state.words.map((w, i) => 
        `<span id="word-${i}" class="word">${w} </span>`
    ).join('');
    
    // 6. APPLY MODES
    if (state.isFocusBlur) container.classList.add('blur-active');
    else container.classList.remove('blur-active');

    // 7. START SESSION
    switchView('reader-view');
    state.startTime = Date.now();
    
    // 8. IMMEDIATE HIGHLIGHT (Fixes "Disappearing First Word")
    updateWordHighlight(0); 
    
    // 9. START TICKER
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

/* REPLACE updateWordHighlight FUNCTION */
function updateWordHighlight(index) {
    const curr = getEl(`word-${index}`);
    if (curr) {
        // FIX: Use 'highlight' to match CSS, not 'active-word'
        curr.classList.add('highlight'); 
        // FIX: Use 'auto' to prevent jitter at high speeds
        curr.scrollIntoView({behavior:'auto', block:'center'});
    }
    if (index > 0) {
        const prev = getEl(`word-${index-1}`);
        if (prev) {
            // FIX: Remove 'highlight' class
            prev.classList.remove('highlight');
            // FIX: Handle focus blur opacity
            if(state.isFocusBlur) {
                prev.style.opacity = 0.4;
            } else {
                prev.style.opacity = 1; 
            }
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

// RESULTS (WITH CAREER SAVE)
getEl('finish-seq-btn').onclick = () => {
    const timeMs = Math.max(state.endTime - state.startTime, 1000);
    const timeMinutes = timeMs / 60000;
    const totalChars = state.originalText.length;
    const stdWords = totalChars / 5;
    
    let raw = Math.round(stdWords / timeMinutes);
    if (raw > state.targetWPM * 1.5) raw = state.targetWPM; // Sanity Cap

    // 1. Calculate Accuracy & Track Missed Types
    let corr = 0;
    let missedTypes = [];
    
    state.quizData.questions.forEach(q => { 
        if(state.userAnswers[q.id] === q.correctAnswer) {
            corr++; 
        } else {
            // Log the type of the wrong answer
            missedTypes.push(q.type || "General");
        }
    });

    const acc = (corr / state.quizData.questions.length) * 100;
    const final = (acc * 0.6) + 40; 
    const ers = Math.round(raw * (final/100));

    // 2. SAVE STATS (With Weakness Data)
    Career.save(ers, Math.round(final), missedTypes);

    // 3. Render UI
    getEl('final-raw').textContent = raw;
    getEl('final-acc').textContent = Math.round(final) + "%";
    getEl('final-ers').textContent = ers;
    
    getEl('coach-feedback').innerHTML = `Session Recorded. Weakness Updated.`;

    getEl('vocab-container').innerHTML = (state.quizData.vocabulary || []).map(v => `
        <div class="vocab-item">
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

getEl('country-select').addEventListener('change', (e) => {
    const val = e.target.value;
    const overlay = getEl('flag-overlay');

    // 1. Reset Animation (Force Reflow)
    overlay.className = 'flag-overlay'; 
    void overlay.offsetWidth; 

    // 2. Apply Country Gradient
    if (val === 'India') overlay.classList.add('bg-india');
    else if (val === 'USA') overlay.classList.add('bg-usa');
    else if (val === 'UK') overlay.classList.add('bg-uk');
    else overlay.classList.add('bg-global');

    // 3. Trigger Flash
    overlay.classList.add('flag-trigger');
});