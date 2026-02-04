/* server.js - v4.1 (Smart Contextual Generation) */
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const API_KEYS = (process.env.GEMINI_KEYS || "").split(',');
let currentKeyIndex = 0;

// --- HELPER: ROTATION ---
async function withKeyRotation(apiCallFn) {
    let success = false;
    let attempts = 0;
    let result;
    while (!success && attempts < API_KEYS.length) {
        const key = API_KEYS[currentKeyIndex];
        try {
            result = await apiCallFn(key);
            success = true;
        } catch (error) {
            console.error(`Key #${currentKeyIndex} failed. Rotating...`);
            currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
            attempts++;
        }
    }
    if (!success) throw new Error("All AI keys exhausted.");
    return result;
}

// --- ENDPOINTS ---
app.post('/api/generate-quiz', async (req, res) => {
    const { text } = req.body;
    try {
        const data = await withKeyRotation((key) => callGeminiHybrid(key, text));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/generate-text', async (req, res) => {
    const { topic } = req.body;
    try {
        const passage = await withKeyRotation((key) => callGeminiText(key, topic));
        res.json({ text: passage });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- AI LOGIC (FIXED) ---

async function callGeminiText(key, category) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    
    // SMART PROMPT MAPPING
    let specificInstruction = "";
    
    if (category.includes("Legal")) {
        specificInstruction = "Write a mock 'Legal Reasoning' passage. Invent a complex legal principle (e.g., regarding Data Privacy or Tort Law) and describe a factual situation involving it. Do NOT define legal terms; apply them.";
    } else if (category.includes("Logical")) {
        specificInstruction = "Write a dense 'Logical Reasoning' opinion piece. Argue strongly for a specific stance on a controversial topic (e.g., Crypto Regulation, Urban Sprawl, or Bio-ethics). The logic should be flawed or complex to test inference.";
    } else if (category.includes("Economy")) {
        specificInstruction = "Write an 'Economics' passage from a fictitious financial journal. Discuss a specific market phenomenon (e.g., Hyperinflation in a specific region) and its global ripple effects.";
    } else {
        // Fallback or Custom Topic
        specificInstruction = `Write a dense, academic passage focused on "${category}". If "${category}" is a general subject, pick a specific niche sub-topic to write about.`;
    }

    const prompt = `
        ACT AS AN EXAM SETTER (CLAT/GMAT).
        ${specificInstruction}
        
        Constraints:
        - Length: 350-400 words.
        - Tone: Academic, objective, and dense.
        - NO Title. NO Introduction (e.g. "Here is a passage"). Just the raw text.
    `;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!response.ok) throw new Error("Gemini Text Error");
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function callGeminiHybrid(key, text) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    
    // UPDATED PROMPT: Now asks for Vocabulary too
    const prompt = `
        Read this text: "${text.substring(0, 1500)}"
        
        Task 1: Generate 4 multiple choice questions (Main Idea, Detail, Inference, Critical).
        Task 2: Generate 4 summary sentences in CHRONOLOGICAL ORDER for a logic chain test.
        Task 3: Identify 4-6 difficult or academic words used in the text and provide their standard dictionary definitions.
        
        Return JSON structure:
        {
            "questions": [
                {"id": 1, "type": "Main Idea", "questionText": "...", "options": ["..."], "correctAnswer": "..."}
            ],
            "sequence": ["Step 1", "Step 2", "Step 3", "Step 4"],
            "vocabulary": [
                {"word": "Esoteric", "definition": "Intended for or likely to be understood by only a small number of people with specialized knowledge."},
                {"word": "Paradigm", "definition": "A typical example or pattern of something; a model."}
            ]
        }
    `;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) throw new Error("Gemini Quiz Error");
    const data = await response.json();
    const cleanJson = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
}

const PORT = 3000;
app.listen(PORT, () => console.log(`RatioGlide v4.1 running at http://localhost:${PORT}`));