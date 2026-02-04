/* script.js - RatioGlide v5.0 */
const state = {
    targetWPM: 250, words: [], originalText: "", currentWordIndex: 0, intervalId: null, startTime: 0, endTime: 0, quizData: null, userAnswers: {}, userSequence: [], correctSequence: [], selectedTopic: ""
};

const getEl = (id) => document.getElementById(id);

/* --- TOPIC GENERATION --- */
window.selectTopic = (topic) => {
    state.selectedTopic = topic;
    getEl('custom-topic-input').value = "";
    document.querySelectorAll('.topic-btn').forEach(btn => btn.classList.remove('selected'));
    event.target.classList.add('selected');
    triggerGeneration(topic);
};

getEl('ai-generate-btn').addEventListener('click', () => {
    const custom = getEl('custom-topic-input').value.trim();
    if(custom) triggerGeneration(custom);
});

async function triggerGeneration(topic) {
    const status = getEl('status-msg');
    const startBtn = getEl('start-btn');
    status.style.opacity = 1;
    status.textContent = `AI is writing about "${topic}"...`;
    startBtn.disabled = true;

    try {
        const res = await fetch('/api/generate-text', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: topic })
        });
        if(!res.ok) throw new Error("Generation Failed");
        const data = await res.json();
        state.originalText = data.text;
        status.textContent = "Passage Ready! Click Initialize.";
        status.style.color = "var(--accent)";
        startBtn.disabled = false;
    } catch (err) {
        status.textContent = "Error: " + err.message;
    }
}

/* --- READER --- */
getEl('start-btn').addEventListener('click', () => {
    if (!state.originalText) { alert("Please select a topic."); return; }
    state.targetWPM = parseInt(getEl('speed-slider').value);
    state.words = state.originalText.trim().split(/\s+/);
    state.currentWordIndex = 0;
    getEl('text-container').innerHTML = state.words.map((w, i) => `<span id="word-${i}" class="word-span">${w} </span>`).join('');
    switchView('reader-view');
    state.startTime = Date.now();
    state.intervalId = setInterval(pacerLoop, 60000 / state.targetWPM);
});

function pacerLoop() {
    if (state.currentWordIndex >= state.words.length) {
        clearInterval(state.intervalId);
        state.endTime = Date.now();
        switchView('quiz-view');
        generateDeepQuiz();
        return;
    }
    const curr = getEl(`word-${state.currentWordIndex}`);
    const prev = getEl(`word-${state.currentWordIndex - 1}`);
    if(curr) { curr.classList.add('active-word'); curr.scrollIntoView({behavior: "smooth", block: "center"}); }
    if(prev) { prev.classList.remove('active-word'); prev.classList.add('read-word'); }
    state.currentWordIndex++;
}

/* --- QUIZ --- */
async function generateDeepQuiz() {
    getEl('ai-loader').classList.remove('hidden');
    getEl('quiz-content').classList.add('hidden');
    try {
        const res = await fetch('/api/generate-quiz', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: state.originalText })
        });
        state.quizData = await res.json();
        state.correctSequence = [...state.quizData.sequence];
        renderQuiz();
    } catch (err) { alert("Quiz Failed"); }
}

function renderQuiz() {
    getEl('ai-loader').classList.add('hidden');
    getEl('quiz-content').classList.remove('hidden');
    getEl('question-container').innerHTML = state.quizData.questions.map(q => `
        <div class="question-block"><span class="q-badge">${q.type}</span><h3>${q.questionText}</h3>
        <div class="options">${q.options.map(opt => `<button onclick="selectAnswer(${q.id}, '${opt.replace(/'/g, "\\'")}', this)">${opt}</button>`).join('')}</div></div>
    `).join('') + `<button class="primary-btn" onclick="startSequencePhase()">Next: Logic Chain</button>`;
}

window.selectAnswer = (id, ans, btn) => {
    state.userAnswers[id] = ans;
    Array.from(btn.parentElement.children).forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
};

/* --- LOGIC CHAIN --- */
window.startSequencePhase = () => {
    switchView('sequence-view');
    state.userSequence = [];
    const shuffled = [...state.correctSequence].sort(() => 0.5 - Math.random());
    getEl('sequence-container').innerHTML = shuffled.map(t => `<div class="seq-btn" onclick="addToSequence('${t.replace(/'/g, "\\'")}', this)">${t}</div>`).join('');
    getEl('finish-seq-btn').classList.add('hidden');
};

window.addToSequence = (text, btn) => {
    if (btn.classList.contains('correct-order') || btn.classList.contains('wrong-order')) return;
    const idx = state.userSequence.length;
    if (text === state.correctSequence[idx]) {
        btn.classList.add('correct-order');
        btn.innerHTML = `<span class="seq-badge">${idx + 1}</span> ${text}`;
        state.userSequence.push(text);
        if (state.userSequence.length === state.correctSequence.length) getEl('finish-seq-btn').classList.remove('hidden');
    } else {
        btn.classList.add('wrong-order');
        setTimeout(() => btn.classList.remove('wrong-order'), 500);
    }
};

/* --- RESULTS & HIGHLIGHTING --- */
getEl('finish-seq-btn').onclick = () => {
    // Scoring
    const timeMinutes = (state.endTime - state.startTime) / 60000;
    const rawWPM = Math.round(state.words.length / timeMinutes);
    let mcqCorrect = 0;
    state.quizData.questions.forEach(q => { if (state.userAnswers[q.id] === q.correctAnswer) mcqCorrect++; });
    const mcqScore = (mcqCorrect / state.quizData.questions.length) * 100;
    const finalAccuracy = (mcqScore * 0.6) + (100 * 0.4); 
    const effectiveWPM = Math.round(rawWPM * (finalAccuracy / 100));

    // Render Stats
    getEl('final-raw').textContent = rawWPM;
    getEl('final-acc').textContent = Math.round(finalAccuracy) + "%";
    getEl('final-ers').textContent = effectiveWPM;
    getEl('coach-feedback').innerHTML = `<b>Analysis:</b> MCQ Accuracy: ${Math.round(mcqScore)}% | Logic Chain: Completed`;

    // Render Vocab
    const vocabContainer = getEl('vocab-container');
    if (state.quizData.vocabulary && state.quizData.vocabulary.length > 0) {
        vocabContainer.innerHTML = state.quizData.vocabulary.map(v => `
            <div class="vocab-card">
                <span class="vocab-word">${v.word}</span>
                ${v.definition}
            </div>
        `).join('');
    } else {
        vocabContainer.innerHTML = "<p style='opacity:0.6'>No complex words detected.</p>";
    }

    // Render Review Text
    getEl('review-text-container').innerHTML = state.originalText;
    
    switchView('results-view');
};

/* --- HIGHLIGHTING LOGIC --- */
const tooltip = getEl('lookup-tooltip');
document.addEventListener('mouseup', async () => {
    const sel = window.getSelection();
    const txt = sel.toString().trim();
    if (!txt) { tooltip.classList.remove('visible'); return; }
    
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + window.scrollY + 10}px`;
    tooltip.classList.add('visible');
    
    getEl('tt-word').textContent = txt;
    getEl('tt-def').textContent = "Loading...";
    
    if(txt.split(' ').length > 2) {
        getEl('tt-def').textContent = "Phrase selected.";
        getEl('tt-link').href = `https://www.google.com/search?q=${encodeURIComponent(txt)}`;
    } else {
        try {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${txt}`);
            const data = await res.json();
            getEl('tt-def').textContent = data[0].meanings[0].definitions[0].definition;
            getEl('tt-link').href = `https://www.google.com/search?q=define+${txt}`;
        } catch(e) {
            getEl('tt-def').textContent = "Def not found.";
            getEl('tt-link').href = `https://www.google.com/search?q=define+${txt}`;
        }
    }
});

function switchView(id) {
    ['config-panel', 'reader-view', 'quiz-view', 'sequence-view', 'results-view'].forEach(i => {
        getEl(i).classList.add('hidden'); getEl(i).classList.remove('active');
    });
    const t = getEl(id); t.classList.remove('hidden'); setTimeout(() => t.classList.add('active'), 50);
}

getEl('speed-slider').oninput = (e) => getEl('slider-val').textContent = e.target.value;
getEl('restart-btn').onclick = () => location.reload();
getEl('theme-btn').onclick = () => {
    const el = document.documentElement;
    el.setAttribute('data-theme', el.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
};