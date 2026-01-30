/* =========================================
   1. STATE MANAGEMENT & DATA
   ========================================= */
const state = {
    targetWPM: 200,
    words: [],          // The text split into an array
    currentWordIndex: 0,
    intervalId: null,
    startTime: 0,
    endTime: 0,
    questions: [],      // Stores the quiz questions
    userAnswers: {},    // Stores user selections
    isRunning: false
};

// DOM Elements
const els = {
    configPanel: document.getElementById('config-panel'),
    readerView: document.getElementById('reader-view'),
    quizView: document.getElementById('quiz-view'),
    resultsView: document.getElementById('results-view'),
    textContainer: document.getElementById('text-container'),
    inputArea: document.getElementById('custom-text-area'), // We will add this to HTML
    questionContainer: document.getElementById('question-container'),
    
    // Stats Displays
    wpmDisplay: document.getElementById('target-wpm-disp'),
    finalErs: document.getElementById('final-ers'),
    finalRaw: document.getElementById('final-raw'),
    finalAcc: document.getElementById('final-acc'),
    feedback: document.getElementById('coach-feedback')
};

/* =========================================
   2. INITIALIZATION & SETUP
   ========================================= */

// Event Listener: Slider Change
document.getElementById('speed-slider').addEventListener('input', (e) => {
    state.targetWPM = parseInt(e.target.value);
    document.getElementById('slider-val').textContent = state.targetWPM;
    els.wpmDisplay.textContent = state.targetWPM;
});

// Event Listener: Start Button
document.getElementById('start-btn').addEventListener('click', () => {
    const customText = document.getElementById('custom-input').value.trim();
    
    if (customText.length > 50) {
        // If user pasted text, use it
        setupReader(customText);
    } else {
        // Default CLAT Practice Text
        const defaultText = `The doctrine of Basic Structure is a judicial innovation in Indian constitutional law. It was solidified in the Kesavananda Bharati case of 1973. The Supreme Court held that while Parliament has the power to amend the Constitution, it cannot alter its basic features. These features include secularism, democracy, and the separation of powers. This judgment curbed the absolute power of the Parliament and established the supremacy of the Constitution. Critics argue it leads to judicial overreach, while supporters view it as a necessary check against authoritarianism.`;
        setupReader(defaultText);
    }
});

/* =========================================
   3. THE READING ENGINE (CORE LOGIC)
   ========================================= */

function setupReader(text) {
    // 1. Clean and split text
    state.words = text.split(/\s+/);
    state.currentWordIndex = 0;
    
    // 2. Render Words into the DOM
    els.textContainer.innerHTML = state.words
        .map((word, index) => `<span id="word-${index}" class="word-span">${word} </span>`)
        .join('');

    // 3. Switch Views
    switchView('readerView');
    
    // 4. Start Countdown then Pacer
    startPacer();
}

function startPacer() {
    state.isRunning = true;
    state.startTime = Date.now();

    // Calculate Milliseconds per Word (60,000 ms / WPM)
    const msPerWord = 60000 / state.targetWPM;

    state.intervalId = setInterval(() => {
        if (state.currentWordIndex >= state.words.length) {
            finishReading();
            return;
        }

        const prevIndex = state.currentWordIndex - 1;
        const currIndex = state.currentWordIndex;

        // VISUAL LOGIC:
        // 1. Highlight Current Word
        const currEl = document.getElementById(`word-${currIndex}`);
        if(currEl) currEl.classList.add('active-word');

        // 2. Grey Out Previous Word (Anti-Regression)
        if (prevIndex >= 0) {
            const prevEl = document.getElementById(`word-${prevIndex}`);
            if(prevEl) {
                prevEl.classList.remove('active-word');
                prevEl.classList.add('read-word'); // Adds opacity: 0.3
            }
        }

        // Auto-scroll logic: Keep active word in center
        if(currEl) {
             currEl.scrollIntoView({behavior: "smooth", block: "center"});
        }

        state.currentWordIndex++;

    }, msPerWord);
}

function finishReading() {
    clearInterval(state.intervalId);
    state.isRunning = false;
    state.endTime = Date.now();
    
    // Generate AI Questions (Mock logic for now)
    generateQuiz();
    switchView('quizView');
}

/* =========================================
   4. THE QUIZ SYSTEM
   ========================================= */

function generateQuiz() {
    // NOTE: In a real app, this would use Gemini API to generate questions based on the text.
    // For this prototype, we use a Logic Check to simulate comprehension.
    
    els.questionContainer.innerHTML = `
        <div class="question-block">
            <h3>1. What is the core subject of the text?</h3>
            <div class="options">
                <button onclick="selectAnswer(1, 'A')">A) Judicial Overreach</button>
                <button onclick="selectAnswer(1, 'B')">B) Basic Structure Doctrine</button>
                <button onclick="selectAnswer(1, 'C')">C) Parliamentary Sovereignty</button>
            </div>
        </div>
        <div class="question-block">
            <h3>2. How did the reading pace feel?</h3>
            <div class="options">
                <button onclick="selectAnswer(2, 'A')">A) Too Fast (Guessed words)</button>
                <button onclick="selectAnswer(2, 'B')">B) Comfortable (Understood all)</button>
                <button onclick="selectAnswer(2, 'C')">C) Too Slow (Subvocalized)</button>
            </div>
        </div>
    `;
    
    // Add Submit Button
    const btn = document.createElement('button');
    btn.className = 'primary-btn';
    btn.innerText = 'Calculate Score';
    btn.onclick = calculateResults;
    els.questionContainer.appendChild(btn);
}

window.selectAnswer = (qId, answer) => {
    state.userAnswers[qId] = answer;
    // Visual feedback for selection would go here
};

/* =========================================
   5. SCORING ALGORITHM (THE RATIO)
   ========================================= */

function calculateResults() {
    // 1. Calculate Real Time taken
    const timeMinutes = (state.endTime - state.startTime) / 60000;
    const rawWPM = Math.round(state.words.length / timeMinutes);

    // 2. Calculate Accuracy (Mock Logic for Prototype)
    // If they chose 'B' for Q1 (Correct) -> 100%
    // If they chose 'A' or 'C' -> 0%
    let correctCount = 0;
    if (state.userAnswers[1] === 'B') correctCount++;
    
    // Self-report logic (Q2)
    // If they said "Too Fast", we penalize the score slightly
    let confidencePenalty = state.userAnswers[2] === 'A' ? 0.8 : 1.0;

    let accuracy = (correctCount / 1) * 100; // Only 1 real question in demo
    
    // 3. THE RATIO FORMULA: Effective Reading Speed (ERS)
    // ERS = Raw WPM * (Accuracy %) * Confidence
    let effectiveWPM = Math.round(rawWPM * (accuracy / 100) * confidencePenalty);

    // 4. Render Results
    els.finalRaw.textContent = rawWPM;
    els.finalAcc.textContent = accuracy + "%";
    els.finalErs.textContent = effectiveWPM;

    // 5. Coach Feedback
    if (effectiveWPM < 100) {
        els.feedback.textContent = "Coach: The speed was too high for your comprehension. Lower the target by 50 WPM.";
    } else if (effectiveWPM > 300) {
        els.feedback.textContent = "Coach: Excellent. You are reading at a CLAT topper level.";
    } else {
        els.feedback.textContent = "Coach: Good balance. Try to maintain this speed but improve focus.";
    }

    switchView('resultsView');
}

/* =========================================
   UTILITIES
   ========================================= */

function switchView(viewName) {
    // Hide all
    els.configPanel.classList.add('hidden');
    els.configPanel.classList.remove('active');
    els.readerView.classList.add('hidden');
    els.quizView.classList.add('hidden');
    els.resultsView.classList.add('hidden');

    // Show One
    const target = els[viewName];
    target.classList.remove('hidden');
    setTimeout(() => target.classList.add('active'), 50);
}

// Theme Toggle Logic (From previous step)
const themeBtn = document.getElementById('theme-btn');
const htmlEl = document.documentElement;
themeBtn.addEventListener('click', () => {
    const current = htmlEl.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    htmlEl.setAttribute('data-theme', next);
    themeBtn.textContent = next === 'light' ? '🌙 Dark' : '☀️ Light';
});