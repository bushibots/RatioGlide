/* =========================================
   RatioGlide v6.1 - The Ultimate Engine
   ========================================= */

const state = {
    targetWPM: 250,
    words: [],
    originalText: "",
    currentWordIndex: 0,
    intervalId: null,
    startTime: 0,
    endTime: 0,
    quizData: null,
    userAnswers: {},
    userSequence: [],
    correctSequence: [],
    selectedTopic: "",
    // Feature Flags
    isPaperMode: false,
    isFocusBlur: false
};

// --- DOM UTILITIES ---
const getEl = (id) => {
    const el = document.getElementById(id);
    if (!el) console.error(`Missing Element: ${id}`);
    return el;
};

// --- VIEW MANAGEMENT ---
function switchView(viewId) {
    const views = ['config-panel', 'reader-view', 'quiz-view', 'sequence-view', 'results-view'];
    
    views.forEach(id => {
        const el = getEl(id);
        if (el) {
            el.classList.remove('active');
            // Small delay to allow fade out animation if we were using it
            el.classList.add('hidden');
        }
    });

    const target = getEl(viewId);
    if (target) {
        target.classList.remove('hidden');
        // Small timeout to allow browser to register 'block' before adding opacity class
        setTimeout(() => target.classList.add('active'), 50);
    }
    
    // Auto-scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* =========================================
   1. CONFIGURATION & INPUTS
   ========================================= */

// Topic Buttons
window.selectTopic = (topic) => {
    state.selectedTopic = topic;
    getEl('custom-topic-input').value = ""; // clear custom
    
    // Visual Selection
    document.querySelectorAll('.topic-btn').forEach(btn => btn.classList.remove('selected'));
    event.target.classList.add('selected'); // event is global here
    
    // Trigger
    triggerGeneration(topic);
};

// Generate Button
getEl('ai-generate-btn').addEventListener('click', () => {
    const custom = getEl('custom-topic-input').value.trim();
    if (custom) triggerGeneration(custom);
    else alert("Please type a topic first!");
});

// File Upload Import
getEl('file-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    getEl('file-name-disp').textContent = file.name;

    const reader = new FileReader();
    reader.onload = (evt) => {
        getEl('manual-text-input').value = evt.target.result;
        getEl('status-msg').textContent = "File Loaded. Click Initialize.";
        getEl('status-msg').style.color = "var(--success)";
        state.originalText = ""; // Reset AI text so manual takes precedence
    };
    reader.onerror = () => alert("Error reading file");
    reader.readAsText(file);
});

// Settings Toggles
window.togglePaperMode = () => {
    state.isPaperMode = !state.isPaperMode;
    document.body.classList.toggle('paper-active', state.isPaperMode);
    getEl('paper-mode-btn').classList.toggle('active', state.isPaperMode);
};

window.toggleFocusBlur = () => {
    state.isFocusBlur = !state.isFocusBlur;
    getEl('focus-blur-btn').classList.toggle('active', state.isFocusBlur);
};

// Speed Slider
getEl('speed-slider').addEventListener('input', (e) => {
    const val = e.target.value;
    getEl('slider-val').textContent = val;
    getEl('target-wpm-disp').textContent = val;
    state.targetWPM = parseInt(val);
});

/* =========================================
   2. AI API HANDLER
   ========================================= */
async function triggerGeneration(topic) {
    const status = getEl('status-msg');
    const startBtn = getEl('start-btn');
    const country = getEl('country-select').value;

    status.style.opacity = 1;
    status.textContent = `AI Agent writing about "${topic}" (${country})...`;
    status.style.color = "var(--text-secondary)";
    startBtn.disabled = true;

    try {
        const response = await fetch('/api/generate-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: topic, country: country })
        });

        if (!response.ok) throw new Error("Server Error");

        const data = await response.json();
        state.originalText = data.text;
        
        // Clear manual input to avoid confusion
        getEl('manual-text-input').value = ""; 
        
        status.textContent = "Passage Ready! Click Initialize Session.";
        status.style.color = "var(--success)";
        startBtn.disabled = false;

    } catch (err) {
        console.error(err);
        status.textContent = "Error: Check if Server is Running.";
        status.style.color = "var(--error)";
    }
}

/* =========================================
   3. READER ENGINE (The Core)
   ========================================= */
getEl('start-btn').addEventListener('click', () => {
    // Priority: Manual Input > AI Text
    const manualText = getEl('manual-text-input').value.trim();
    if (manualText.length > 20) {
        state.originalText = manualText;
    }

    if (!state.originalText) {
        alert("No content found. Please generate text or paste your own.");
        return;
    }

    // Prep State
    state.targetWPM = parseInt(getEl('speed-slider').value);
    state.words = state.originalText.trim().split(/\s+/);
    state.currentWordIndex = 0;
    state.userAnswers = {}; // Reset previous
    state.userSequence = [];

    // Render Words
    const container = getEl('text-container');
    container.innerHTML = state.words.map((w, i) => 
        `<span id="word-${i}" class="word-span">${w} </span>`
    ).join('');

    // Apply Focus Blur?
    if (state.isFocusBlur) container.classList.add('blur-active');
    else container.classList.remove('blur-active');

    // Start
    switchView('reader-view');
    state.startTime = Date.now();
    
    // Pacer Loop
    const msPerWord = 60000 / state.targetWPM;
    state.intervalId = setInterval(pacerLoop, msPerWord);
});

function pacerLoop() {
    if (state.currentWordIndex >= state.words.length) {
        finishReading();
        return;
    }

    const currentIndex = state.currentWordIndex;
    const prevIndex = state.currentWordIndex - 1;

    // Highlight Current
    const currEl = getEl(`word-${currentIndex}`);
    if (currEl) {
        currEl.classList.add('active-word');
        currEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // Dim Previous
    if (prevIndex >= 0) {
        const prevEl = getEl(`word-${prevIndex}`);
        if (prevEl) {
            prevEl.classList.remove('active-word');
            prevEl.classList.add('read-word');
        }
    }

    state.currentWordIndex++;
}

function finishReading() {
    clearInterval(state.intervalId);
    state.endTime = Date.now();
    switchView('quiz-view');
    generateDeepQuiz(); // Auto-start quiz generation
}

/* =========================================
   4. QUIZ & SEQUENCE LOGIC
   ========================================= */
async function generateDeepQuiz() {
    getEl('ai-loader').classList.remove('hidden');
    getEl('quiz-content').classList.add('hidden');

    try {
        const res = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: state.originalText })
        });
        
        if (!res.ok) throw new Error("Quiz Gen Failed");

        state.quizData = await res.json();
        state.correctSequence = [...state.quizData.sequence];
        
        renderQuiz();

    } catch (err) {
        console.error(err);
        getEl('ai-loader').innerHTML = "<h3>Error Generating Quiz</h3><p>Please check server console.</p>";
    }
}

function renderQuiz() {
    getEl('ai-loader').classList.add('hidden');
    getEl('quiz-content').classList.remove('hidden');
    
    const container = getEl('question-container');
    
    container.innerHTML = state.quizData.questions.map(q => {
        // Shuffle Options (Simple shuffle)
        const shuffled = [...q.options].sort(() => 0.5 - Math.random());
        
        return `
            <div class="question-block">
                <span class="q-badge">${q.type}</span>
                <h3>${q.questionText}</h3>
                <div class="options">
                    ${shuffled.map(opt => `
                        <button onclick="selectAnswer(${q.id}, '${opt.replace(/'/g, "\\'")}', this)">
                            ${opt}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML += `<button class="primary-btn" onclick="startSequencePhase()">Proceed to Logic Chain &rarr;</button>`;
}

window.selectAnswer = (qId, answer, btn) => {
    state.userAnswers[qId] = answer;
    // Visually update selection
    Array.from(btn.parentElement.children).forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
};

// --- SEQUENCE PHASE ---
window.startSequencePhase = () => {
    switchView('sequence-view');
    state.userSequence = [];
    
    const container = getEl('sequence-container');
    // Shuffle correct sequence
    const shuffled = [...state.correctSequence].sort(() => 0.5 - Math.random());
    
    container.innerHTML = shuffled.map(text => `
        <div class="seq-btn" onclick="addToSequence('${text.replace(/'/g, "\\'")}', this)">
            ${text}
        </div>
    `).join('');
    
    getEl('finish-seq-btn').classList.add('hidden');
    getEl('sequence-feedback').textContent = "Select the FIRST step of the argument...";
};

window.addToSequence = (text, btn) => {
    if (btn.classList.contains('correct-order') || btn.classList.contains('wrong-order')) return;

    const currentStepIndex = state.userSequence.length;
    const correctText = state.correctSequence[currentStepIndex];

    if (text === correctText) {
        // Correct
        btn.classList.add('correct-order');
        btn.innerHTML = `<span class="seq-badge">${currentStepIndex + 1}</span> ${text}`;
        state.userSequence.push(text);
        
        if (state.userSequence.length === state.correctSequence.length) {
            getEl('sequence-feedback').textContent = "Logic Chain Complete!";
            getEl('finish-seq-btn').classList.remove('hidden');
        } else {
            getEl('sequence-feedback').textContent = "Correct! Find the next step...";
        }
    } else {
        // Wrong
        btn.classList.add('wrong-order');
        getEl('sequence-feedback').textContent = "Incorrect! That is not the next step.";
        setTimeout(() => btn.classList.remove('wrong-order'), 600);
    }
};

/* =========================================
   5. RESULTS & REPORTING
   ========================================= */
getEl('finish-seq-btn').onclick = () => {
    // 1. Calc Speed
    const timeMinutes = (state.endTime - state.startTime) / 60000;
    const rawWPM = Math.round(state.words.length / timeMinutes) || 0;

    // 2. Calc MCQ Accuracy
    let mcqCorrect = 0;
    state.quizData.questions.forEach(q => {
        if (state.userAnswers[q.id] === q.correctAnswer) mcqCorrect++;
    });
    const mcqScore = (mcqCorrect / state.quizData.questions.length) * 100;

    // 3. Final Weighted Score (60% MCQ, 40% Logic Chain)
    // Assuming if they finished Logic Chain, they get full points there
    const finalAccuracy = (mcqScore * 0.6) + (100 * 0.4); 
    const effectiveWPM = Math.round(rawWPM * (finalAccuracy / 100));

    // 4. Render
    getEl('final-raw').textContent = rawWPM;
    getEl('final-acc').textContent = Math.round(finalAccuracy) + "%";
    getEl('final-ers').textContent = effectiveWPM;
    
    getEl('coach-feedback').innerHTML = `
        <strong>Performance Analysis:</strong><br>
        MCQ Accuracy: ${Math.round(mcqScore)}%<br>
        Logic Reconstruction: 100%<br>
        True Speed (ERS): ${effectiveWPM} WPM
    `;

    // 5. Render Vocabulary
    const vocabContainer = getEl('vocab-container');
    if (state.quizData.vocabulary && state.quizData.vocabulary.length > 0) {
        vocabContainer.innerHTML = state.quizData.vocabulary.map(v => `
            <div class="vocab-card">
                <span class="vocab-word">${v.word}</span>
                ${v.definition}
            </div>
        `).join('');
    } else {
        vocabContainer.innerHTML = "<p style='opacity:0.6'>No advanced vocabulary detected.</p>";
    }

    // 6. Render Review Text (For Highlighting)
    getEl('review-text-container').innerHTML = state.originalText;

    switchView('results-view');
};

/* =========================================
   6. HIGHLIGHTING / DICTIONARY TOOLTIP
   ========================================= */
const tooltip = getEl('lookup-tooltip');

document.addEventListener('mouseup', async () => {
    const sel = window.getSelection();
    const txt = sel.toString().trim();
    
    // Hide if empty or not in review box
    const reviewBox = getEl('review-text-container');
    if (!txt || !reviewBox.contains(sel.anchorNode.parentElement)) {
        tooltip.classList.remove('visible');
        return;
    }

    // Position Tooltip
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + window.scrollY + 10}px`;
    tooltip.classList.add('visible');

    getEl('tt-word').textContent = txt;
    getEl('tt-def').textContent = "Searching Dictionary...";
    
    // Logic: If multiple words -> Google Search Phrase
    if (txt.split(' ').length > 2) {
        getEl('tt-def').textContent = "Phrase selected.";
        getEl('tt-link').href = `https://www.google.com/search?q=${encodeURIComponent(txt)}`;
    } else {
        // Single word -> Dictionary API
        try {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${txt}`);
            if (!res.ok) throw new Error("Not Found");
            const data = await res.json();
            
            // Extract first definition
            const def = data[0].meanings[0].definitions[0].definition;
            getEl('tt-def').textContent = def;
            getEl('tt-link').href = `https://www.google.com/search?q=define+${txt}`;
        } catch (e) {
            getEl('tt-def').textContent = "Definition not found in free DB.";
            getEl('tt-link').href = `https://www.google.com/search?q=define+${txt}`;
        }
    }
});

/* =========================================
   7. THEME & GLOBAL EVENTS
   ========================================= */
getEl('restart-btn').onclick = () => location.reload();

getEl('theme-btn').onclick = () => {
    const el = document.documentElement;
    const current = el.getAttribute('data-theme');
    el.setAttribute('data-theme', current === 'light' ? 'dark' : 'light');
};