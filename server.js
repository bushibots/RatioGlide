/* server.js - RatioGlide v7.0 (Jurisdiction-Aware) */
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

// --- HELPER: KEY ROTATION ---
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
    if (!success) throw new Error("All AI keys exhausted. Please check .env file.");
    return result;
}

// --- ENDPOINTS ---

// 1. Generate Quiz & Analysis
app.post('/api/generate-quiz', async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    try {
        const data = await withKeyRotation((key) => callGeminiHybrid(key, text));
        res.json(data);
    } catch (err) {
        console.error("Quiz Error:", err.message);
        res.status(500).json({ error: "Failed to generate quiz." });
    }
});

// 2. Generate Passage (Jurisdiction Aware)
app.post('/api/generate-text', async (req, res) => {
    const { topic, country } = req.body;
    if (!topic) return res.status(400).json({ error: "No topic provided" });

    try {
        const passage = await withKeyRotation((key) => callGeminiText(key, topic, country));
        res.json({ text: passage });
    } catch (err) {
        console.error("Text Gen Error:", err.message);
        res.status(500).json({ error: "Failed to generate text." });
    }
});

// --- AI LOGIC ---

async function callGeminiText(key, category, country) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    
    // SMART CONTEXT MAPPING
    let context = "";
    if (country === "India") context = "under the Indian Penal Code (IPC), Constitution of India, or Indian Contract Act";
    else if (country === "USA") context = "under US Federal Law, the Constitution, or relevant SCOTUS precedents";
    else if (country === "UK") context = "under English Common Law and UK Statutes";
    else context = "in a general international context";

    let specificInstruction = "";
    
    if (category.includes("Legal")) {
        specificInstruction = `Write a 'Legal Reasoning' passage ${context}. Cite real or realistic sections/articles relevant to ${country}. Focus on a complex legal principle.`;
    } else if (category.includes("Logical")) {
        specificInstruction = `Write a dense 'Logical Reasoning' editorial about a sociopolitical issue in ${country}. The argument should be nuanced and contain subtle flaws for analysis.`;
    } else if (category.includes("Econ")) {
        specificInstruction = `Write an 'Economics' analysis regarding ${country}'s market or a global financial trend affecting ${country}.`;
    } else {
        specificInstruction = `Write a dense, academic passage about "${category}" in the context of ${country}.`;
    }

    const prompt = `
        ACT AS AN EXAM SETTER (CLAT/LSAT level).
        ${specificInstruction}
        
        Constraints:
        - Length: 350-450 words.
        - Tone: Academic, objective, and dense.
        - NO Title. NO Intro. NO "Here is the passage". Just the raw text.
    `;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) throw new Error(`Gemini API Error: ${response.statusText}`);
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function callGeminiHybrid(key, text) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    
    const prompt = `
        Read this text: "${text.substring(0, 2000)}"
        
        Task 1: Generate 4 MCQs (Main Idea, Detail, Inference, Critical Thinking).
        Task 2: Generate 4 summary sentences in CHRONOLOGICAL ORDER for a logic reconstruction task.
        Task 3: Identify 4-6 difficult/academic words from the text and provide definitions.
        
        Return STRICT JSON format:
        {
            "questions": [
                {"id": 1, "type": "Main Idea", "questionText": "...", "options": ["..."], "correctAnswer": "..."}
            ],
            "sequence": ["Step 1", "Step 2", "Step 3", "Step 4"],
            "vocabulary": [
                {"word": "Example", "definition": "Definition here."}
            ]
        }
    `;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) throw new Error("Gemini Quiz API Error");
    
    const data = await response.json();
    let textData = data.candidates[0].content.parts[0].text;
    
    // Cleanup JSON markdown if present
    textData = textData.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(textData);
}

const PORT = 3000;
app.listen(PORT, () => console.log(`RatioGlide v7.0 running at http://localhost:${PORT}`));