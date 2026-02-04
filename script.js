/* =========================================
   RatioGlide v7.0 - Core Engine
   ========================================= */

const state = {
    // Config
    targetWPM: 250,
    isPaperMode: false,
    isFocusBlur: false,
    
    // Data
    words: [],
    originalText: "",
    quizData: null,
    
    // Runtime
    currentWordIndex: 0,
    intervalId: null,
    startTime: 0,
    endTime: 0,
    userAnswers: {},
    userSequence: [],
    correctSequence: []
};

// --- DOM UTILS ---
const getEl = (id) => document.getElementById(id);
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- VIEW CONTROLLER ---
function switchView(viewId) {
    const views = ['config-panel', 'reader-view', 'quiz-view', 'sequence-view', 'results-view'];
    
    // Hide all
    views.forEach(id => {
        const el = getEl(id);
        if (el) {
            el.classList.remove('active');
            el.classList.add('hidden');
        }
    });

    // Show target with animation delay
    const target = getEl(viewId);
    if (target) {
        target.classList.remove('hidden');
        // Force reflow
        void target.offsetWidth;
        target.classList.add('active');
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* =========================================
   1. INPUT & CONFIGURATION
   ========================================= */

// Country/Context Selector
const countrySelect = getEl('country-select');

// Topic Chips
window.selectTopic = (topic) => {
    // Visual Feedback
    document.querySelectorAll('.chip-btn').forEach(btn => btn.classList.remove('selected'));
    event.target.classList.add('selected');
    
    // Clear manual inputs
    getEl('custom-topic-input').value = "";
    getEl('manual-text-input').value = "";
    
    triggerGeneration(topic);
};

// Custom Topic
getEl('ai-generate-btn').addEventListener('click', () => {
    const topic = getEl('custom-topic-input').value.trim();
    if (!topic) {
        shakeElement(getEl('custom-topic-input'));
        return;
    }
    triggerGeneration(topic);
});

// File Import
getEl('file-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    getEl('file-status').textContent = `Loaded: ${file.name}`;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
        getEl('manual-text-input').value = evt.target.result;
        state.originalText = ""; // Clear AI text
        updateStatus("File loaded. Ready to start.", "var(--primary)");
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

// Speed Control
getEl('speed-slider').addEventListener('input', (e) => {
    const val = e.target.value;
    getEl('target-wpm-disp').textContent = val;
    state.targetWPM = parseInt(val);
});

// Theme Toggle
getEl('theme-btn').addEventListener('click', () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    getEl('theme-btn').querySelector('.icon').textContent = next === 'light' ? '🌙' : '☀️';
});

/* =========================================
   2. API & GENERATION
   ========================================= */
async function triggerGeneration(topic) {
    const status = getEl('status-msg');
    const btn = getEl('ai-generate-btn');
    const country = countrySelect.value;

    updateStatus(`AI Agent drafting "${topic}" for context: ${country}...`, "var(--text-muted)");
    btn.disabled = true;
    btn.textContent = "⏳";

    try {
        const res = await fetch('/api/generate-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: topic, country: country })
        });

        if (!res.ok) throw new Error("API Error");

        const data = await res.json();
        state.originalText = data.text;
        
        // Clear manual to ensure AI text is used
        getEl('manual-text-input').value = "";
        
        updateStatus("Content Generated successfully.", "#10b981");
        btn.disabled = false;
        btn.textContent = "✨ Generate";

    } catch (err) {
        console.error(err);
        updateStatus("Connection Failed. Check Server.", "#ef4444");
        btn.disabled = false;
        btn.textContent = "❌ Retry";
    }
}

function updateStatus(msg, color) {
    const el = getEl('status-msg');
    el.textContent = msg;
    el.style.color = color;
    el.style.opacity = 1;
}

function shakeElement(el) {
    el.style.transform = "translateX(5px)";
    setTimeout(() => el.style.transform = "translateX(-5px)", 100);
    setTimeout(() => el.style.transform = "none", 200);
}

/* =========================================
   3. READING ENGINE
   ========================================= */
getEl('start-btn').addEventListener('click', () => {
    // 1. Prioritize Manual Input
    const manual = getEl('manual-text-input').value.trim();
    if (manual.length > 20) state.originalText = manual;

    // 2. Validation
    if (!state.originalText || state.originalText.length < 20) {
        alert("Please generate content or paste text first.");
        return;
    }

    // 3. Prep
    state.words = state.originalText.trim().split(/\s+/);
    state.currentWordIndex = 0;
    
    const container = getEl('text-container');
    container.innerHTML = state.words.map((w, i) => `<span id="word-${i}" class="word-span">${w} </span>`).join('');
    
    // Apply Focus Blur Class
    if (state.isFocusBlur) container.classList.add('blur-mode');
    else container.classList.remove('blur-mode');

    // 4. Launch
    switchView('reader-view');
    
    // Countdown or instant start? Let's do instant for responsiveness
    state.startTime = Date.now();
    const interval = 60000 / state.targetWPM;
    
    state.intervalId = setInterval(pacerTick, interval);
});

function pacerTick() {
    if (state.currentWordIndex >= state.words.length) {
        finishReading();
        return;
    }

    const idx = state.currentWordIndex;
    
    // Highlight Current
    const curr = getEl(`word-${idx}`);
    if (curr) {
        curr.classList.add('active-word');
        curr.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }

    // Dim Previous
    if (idx > 0) {
        const prev = getEl(`word-${idx - 1}`);
        if (prev) {
            prev.classList.remove('active-word');
            prev.classList.add('read-word');
        }
    }

    state.currentWordIndex++;
}

function finishReading() {
    clearInterval(state.intervalId);
    state.endTime = Date.now();
    switchView('quiz-view');
    generateQuiz();
}

/* =========================================
   4. QUIZ LOGIC
   ========================================= */
async function generateQuiz() {
    // No Manual fallback for quiz yet, requires AI
    try {
        const res = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: state.originalText })
        });

        if (!res.ok) throw new Error("Quiz Gen Failed");

        const data = await res.json();
        state.quizData = data;
        state.correctSequence = [...data.sequence]; // Copy array
        
        renderQuiz();

    } catch (err) {
        alert("Could not generate quiz. Check server console.");
        // Fallback to results if quiz fails
        switchView('results-view');
    }
}

function renderQuiz() {
    getEl('ai-loader').classList.add('hidden');
    getEl('quiz-content').classList.remove('hidden');
    
    const container = getEl('question-container');
    container.innerHTML = state.quizData.questions.map(q => {
        // Shuffle
        const opts = [...q.options].sort(() => 0.5 - Math.random());
        
        return `
            <div class="question-block">
                <span class="q-badge">${q.type}</span>
                <h3>${q.questionText}</h3>
                ${opts.map(opt => `
                    <button class="quiz-opt-btn" onclick="selectAnswer(${q.id}, '${opt.replace(/'/g, "\\'")}', this)">
                        ${opt}
                    </button>
                `).join('')}
            </div>
        `;
    }).join('');

    container.innerHTML += `<button class="cta-btn" onclick="startSequencePhase()">Proceed to Phase 2 &rarr;</button>`;
}

window.selectAnswer = (qId, ans, btn) => {
    state.userAnswers[qId] = ans;
    // UI Update
    const siblings = btn.parentElement.children;
    for (let sib of siblings) sib.classList.remove('selected');
    btn.classList.add('selected');
};

/* =========================================
   5. SEQUENCE LOGIC
   ========================================= */
window.startSequencePhase = () => {
    switchView('sequence-view');
    state.userSequence = [];
    
    const container = getEl('sequence-container');
    const shuffled = [...state.correctSequence].sort(() => 0.5 - Math.random());
    
    container.innerHTML = shuffled.map(txt => `
        <div class="seq-item" onclick="handleSequenceClick('${txt.replace(/'/g, "\\'")}', this)">
            ${txt}
        </div>
    `).join('');
    
    getEl('finish-seq-btn').classList.add('hidden');
    getEl('sequence-feedback').textContent = "Select the first logical step...";
};

window.handleSequenceClick = (text, el) => {
    if (el.classList.contains('correct') || el.classList.contains('wrong')) return;

    const currentStep = state.userSequence.length;
    const correctText = state.correctSequence[currentStep];

    if (text === correctText) {
        // Correct
        el.classList.add('correct');
        el.innerHTML = `<span class="seq-number">${currentStep + 1}</span> ${text}`;
        state.userSequence.push(text);
        
        if (state.userSequence.length === state.correctSequence.length) {
            getEl('sequence-feedback').textContent = "Sequence Complete!";
            getEl('finish-seq-btn').classList.remove('hidden');
        } else {
            getEl('sequence-feedback').textContent = "Correct. Find the next step.";
        }
    } else {
        // Wrong
        el.classList.add('wrong');
        getEl('sequence-feedback').textContent = "Incorrect step order.";
        setTimeout(() => el.classList.remove('wrong'), 500);
    }
};

/* =========================================
   6. RESULTS & ANALYSIS
   ========================================= */
getEl('finish-seq-btn').addEventListener('click', calculateResults);

function calculateResults() {
    // 1. WPM
    const minutes = (state.endTime - state.startTime) / 60000;
    const rawWPM = Math.round(state.words.length / minutes) || 0;

    // 2. Accuracy
    let correct = 0;
    state.quizData.questions.forEach(q => {
        if (state.userAnswers[q.id] === q.correctAnswer) correct++;
    });
    const mcqAcc = (correct / state.quizData.questions.length) * 100;
    
    // Weighted: 60% MCQ, 40% Logic (assumed 100% if finished)
    const finalAcc = (mcqAcc * 0.6) + (100 * 0.4);
    const effWPM = Math.round(rawWPM * (finalAcc / 100));

    // Render Stats
    getEl('final-raw').textContent = rawWPM;
    getEl('final-acc').textContent = Math.round(finalAcc) + "%";
    getEl('final-ers').textContent = effWPM;
    
    getEl('coach-feedback').textContent = `Assessment: You demonstrated ${Math.round(finalAcc)}% comprehension at ${rawWPM} words per minute.`;

    // Render Vocab
    const vocabBox = getEl('vocab-container');
    if (state.quizData.vocabulary) {
        vocabBox.innerHTML = state.quizData.vocabulary.map(v => `
            <div class="vocab-card">
                <span class="vocab-word">${v.word}</span>
                ${v.definition}
            </div>
        `).join('');
    }

    // Render Review Text
    getEl('review-text-container').innerHTML = state.originalText;

    switchView('results-view');
}

getEl('restart-btn').onclick = () => location.reload();

/* =========================================
   7. TOOLTIP & HIGHLIGHTING
   ========================================= */
const tooltip = getEl('lookup-tooltip');

document.addEventListener('mouseup', async (e) => {
    const sel = window.getSelection();
    const txt = sel.toString().trim();
    const reviewBox = getEl('review-text-container');

    // Only show if selection is inside review box
    if (!txt || !reviewBox.contains(sel.anchorNode.parentElement)) {
        tooltip.classList.remove('visible');
        return;
    }

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    
    // Position Calculation
    const left = rect.left + (rect.width / 2) - 130; // 130 is half tooltip width
    const top = rect.bottom + window.scrollY + 10;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add('visible');

    getEl('tt-word').textContent = txt.length > 20 ? "Phrase" : txt;
    getEl('tt-def').textContent = "Searching...";
    
    // Link generation
    const isPhrase = txt.split(' ').length > 2;
    getEl('tt-link').href = isPhrase 
        ? `https://www.google.com/search?q=${encodeURIComponent(txt)}` 
        : `https://www.google.com/search?q=define+${txt}`;

    if (!isPhrase) {
        try {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${txt}`);
            const data = await res.json();
            if (data.title) throw new Error(); // API returns title on error
            getEl('tt-def').textContent = data[0].meanings[0].definitions[0].definition;
        } catch (e) {
            getEl('tt-def').textContent = "Definition unavailable. Click arrow to search.";
        }
    } else {
        getEl('tt-def').textContent = "Phrase selected. Search web for context.";
    }
});