require('dotenv').config(); 
const express = require('express');
const { Pool } = require('pg'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai'); 

const app = express();
app.use(express.static(__dirname));
app.use(express.json({ limit: '15mb' })); 

const JWT_SECRET = process.env.JWT_SECRET || "RakshitPlus_Enterprise_Secret";

// 🚀 GEMINI API SETUP
const apiKeyToUse = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKeyToUse);

// 🚀 DATABASE CONNECTION
const pool = new Pool({
    connectionString: "postgresql://rakshitplus_db_user:NNn5OEOt6EGL57R3LlFXIYXTV1mxT0hu@dpg-dae3etf40ujc73dlb71g-a.ohio-postgres.render.com/rakshitplus_db",
    ssl: { rejectUnauthorized: false } 
});

const initDB = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'patient', specialization TEXT, image_url TEXT, experience TEXT, qualification TEXT, about TEXT, fees INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS appointments (id SERIAL PRIMARY KEY, patient_id INTEGER, doctor_id INTEGER, patient_name TEXT, age INTEGER, gender TEXT, contact TEXT, symptoms TEXT, department TEXT, appointment_date TEXT, status TEXT DEFAULT 'Pending')`);
        console.log("☁️ Cloud PostgreSQL Connected!");
    } catch (err) { console.error("DB Connection Error:", err); }
};
initDB();

const authenticate = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ error: "Access Denied." });
    try { 
        req.user = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET); 
        next(); 
    } catch (err) { return res.status(401).json({ error: "Session expired." }); }
};

const upload = multer({ storage: multer.memoryStorage() }); 

async function aiTriageEngine(symptoms) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`Analyze these symptoms and return ONLY the medical department name (e.g., Cardiology, Neurology, Orthopedics, General Medicine). Symptoms: "${symptoms}"`);
        let dept = result.response.text().trim();
        return ["Cardiology", "Neurology", "Orthopedics", "Gastroenterology"].find(d => dept.includes(d)) || "General Medicine";
    } catch(err) { return "General Medicine"; }
}

// 🤖 🌟 BULLETPROOF REAL-TIME DOCTOR CHAT ENGINE
app.post('/api/ai-chat', async (req, res) => {
    const { history, message } = req.body;
    
    try {
        if (!apiKeyToUse) throw new Error("API Key is missing on the server.");

        // Removed '-latest' to fix the 404 error
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const chat = model.startChat({ history: history || [] });
        
        let prompt = message;
        if (!history || history.length === 0) {
            prompt = `System Persona: You are "RakshitPlus AI", an empathetic, highly skilled virtual medical assistant. Talk exactly like a compassionate real doctor (e.g., "Hello! I am here to help. How are you feeling?"). Ask follow-up clarifying questions if symptoms are vague. Keep replies concise, readable, and structured. Always add a short disclaimer that you are an AI.\n\nPatient says: ${message}`;
        }

        const result = await chat.sendMessage(prompt);
        res.json({ reply: result.response.text() });
        
    } catch (err) {
        console.error("Chat Error 1.5-flash:", err.message);
        
        // SENIOR DEV HACK: Automatic Fallback to standard gemini-pro if 404 happens
        if (err.message.includes("404") || err.message.includes("not found")) {
            try {
                const fallbackModel = genAI.getGenerativeModel({ model: "gemini-pro" });
                const fallbackChat = fallbackModel.startChat({ history: history || [] });
                
                let prompt = message;
                if (!history || history.length === 0) {
                    prompt = `System Persona: You are "RakshitPlus AI", an empathetic virtual medical assistant. Talk like a real doctor.\n\nPatient says: ${message}`;
                }

                const fallbackResult = await fallbackChat.sendMessage(prompt);
                return res.json({ reply: fallbackResult.response.text() });
            } catch (fallbackErr) {
                console.error("Chat Error Pro:", fallbackErr.message);
                return res.status(500).json({ error: `AI System Error: ${fallbackErr.message}` });
            }
        }
        
        res.status(500).json({ error: `AI System Error: ${err.message}` });
    }
});

// 🚀 ADVANCED VISION AI LAB REPORT ANALYZER
app.post('/api/upload-pdf', authenticate, upload.single('reportPdf'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No PDF file received." });
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const pdfPart = { inlineData: { data: req.file.buffer.toString("base64"), mimeType: "application/pdf" } };
        const prompt = `You are a Chief Pathologist AI. Read this medical lab report. Extract numerical test values. Return ONLY raw JSON matching this format: {"score": 85, "biomarkers": [{"name": "Fasting Blood Sugar", "val": "110 mg/dL", "status": "Normal", "color": "green"}], "insights": ["Insight 1"], "diet": ["Diet 1"]}.`;
        const result = await model.generateContent([prompt, pdfPart]);
        let aiResponse = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        res.status(200).json(JSON.parse(aiResponse));
    } catch (aiErr) { 
        res.status(500).json({ error: `Document processing failed: ${aiErr.message}` }); 
    }
});

// 🛡️ AUTH, BOOKING & DASHBOARDS
app.post('/api/auth/register', async (req, res) => {
    try {
        const hash = await bcrypt.hash(req.body.password, 10);
        await pool.query(`INSERT INTO users (name, email, password) VALUES ($1, $2, $3)`, [req.body.name, req.body.email, hash]);
        res.status(201).json({ message: "Registered Successfully!" });
    } catch (error) { res.status(400).json({ error: "Email already exists!" }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [req.body.email]);
        if (result.rows.length === 0 || !(await bcrypt.compare(req.body.password, result.rows[0].password))) 
            return res.status(400).json({ error: "Invalid credentials." });
        res.json({ token: jwt.sign({ id: result.rows[0].id, role: result.rows[0].role }, JWT_SECRET, { expiresIn: '24h' }), role: result.rows[0].role });
    } catch(e) { res.status(500).json({ error: "Server error." }); }
});

app.post('/api/appointments', authenticate, async (req, res) => {
    const { patient_name, age, gender, contact, symptoms, date, doctor_id } = req.body;
    try {
        let dept = doctor_id ? (await pool.query(`SELECT specialization FROM users WHERE id = $1`, [doctor_id])).rows[0].specialization : await aiTriageEngine(symptoms);
        let docId = doctor_id || (await pool.query(`SELECT id FROM users WHERE role = 'doctor' AND specialization = $1 LIMIT 1`, [dept])).rows[0]?.id || 1; 
        const insRes = await pool.query(`INSERT INTO appointments (patient_id, doctor_id, patient_name, age, gender, contact, symptoms, department, appointment_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`, [req.user.id, docId, patient_name, age, gender, contact, symptoms, dept, date]);
        res.status(201).json({ message: "Booked!", id: insRes.rows[0].id, dept: dept });
    } catch(e) { res.status(500).json({error: "Failed"}); }
});

app.get(['/api/patient/dashboard', '/api/appointments/me'], authenticate, async (req, res) => {
    try { res.json((await pool.query(`SELECT a.id, u.name as doctor_name, a.department, a.appointment_date, a.status, a.symptoms FROM appointments a LEFT JOIN users u ON a.doctor_id = u.id WHERE a.patient_id = $1 ORDER BY a.id DESC`, [req.user.id])).rows); } catch(e) { res.json([]); }
});

app.get('/api/queue/:appointmentId', async (req, res) => {
    try {
        const currRes = await pool.query(`SELECT doctor_id, appointment_date, status FROM appointments WHERE id = $1`, [req.params.appointmentId]);
        if (currRes.rows.length === 0) return res.status(404).json({error: "Not found"});
        const count = parseInt((await pool.query(`SELECT COUNT(*) as "patientsAhead" FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND status = 'Pending' AND id < $3`, [currRes.rows[0].doctor_id, currRes.rows[0].appointment_date, req.params.appointmentId])).rows[0].patientsAhead) || 0;
        res.json({ patientsAhead: count, estimatedWaitTime: count * 15, status: currRes.rows[0].status });
    } catch(e) { res.status(500).json({error: "Error"}); }
});

app.get(['/api/doctor/dashboard', '/api/doctor/appointments'], authenticate, async (req, res) => {
    try { res.json((await pool.query(`SELECT a.*, p.name as real_patient_name FROM appointments a LEFT JOIN users p ON a.patient_id = p.id WHERE a.doctor_id = $1 ORDER BY a.id DESC`, [req.user.id])).rows); } catch(e) { res.status(500).json({error: "Error"}); }
});

app.post('/api/doctor/appointment/:id/status', authenticate, async (req, res) => {
    try { await pool.query(`UPDATE appointments SET status = $1 WHERE id = $2 AND doctor_id = $3`, [req.body.status, req.params.id, req.user.id]); res.json({ message: "Updated!" });
    } catch (error) { res.status(500).json({ error: "Failed" }); }
});

app.get('/api/doctors', async (req, res) => { 
    try { res.json((await pool.query(`SELECT id, name, specialization, email, image_url, experience, qualification, about, fees FROM users WHERE role = 'doctor'`)).rows); } catch(e) { res.json([]); }
});

app.get(['/api/doctor/:id', '/api/doctors/:id'], async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, name, specialization, email, image_url, experience, qualification, about, fees FROM users WHERE id = $1 AND role = 'doctor'`, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Doctor not found" });
        res.json(result.rows[0]);
    } catch(e) { res.status(500).json({ error: "Server error" }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RakshitPlus Backend Live on Port ${PORT}!`));