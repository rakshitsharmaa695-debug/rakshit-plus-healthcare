require('dotenv').config(); 
const express = require('express');
const { Pool } = require('pg'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' })); 

const JWT_SECRET = process.env.JWT_SECRET || "RakshitPlus_Enterprise_Secret";

// 🚀 Google Gemini Setup
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// 🚀 CONNECT TO CLOUD DATABASE
const pool = new Pool({
    connectionString: "postgresql://rakshitplus_db_user:NNn5OEOt6EGL57R3LlFXIYXTV1mxT0hu@dpg-dae3etf40ujc73dlb71g-a.ohio-postgres.render.com/rakshitplus_db",
    ssl: { rejectUnauthorized: false } 
});

const initDB = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'patient', specialization TEXT, image_url TEXT, experience TEXT, qualification TEXT, about TEXT, fees INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS appointments (id SERIAL PRIMARY KEY, patient_id INTEGER, doctor_id INTEGER, patient_name TEXT, age INTEGER, gender TEXT, contact TEXT, symptoms TEXT, department TEXT, appointment_date TEXT, status TEXT DEFAULT 'Pending')`);
        await pool.query(`CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, name TEXT, email TEXT, message TEXT, status TEXT DEFAULT 'Unread')`);

        const hash = await bcrypt.hash('admin123', 10);
        await pool.query(`INSERT INTO users (name, email, password, role) VALUES ('System Admin', 'admin@rakshitplus.com', $1, 'admin') ON CONFLICT (email) DO NOTHING`, [hash]);
        console.log("☁️ Cloud PostgreSQL Connected Successfully!");
    } catch (err) { 
        console.error("DB Connection Error:", err); 
    }
};
initDB();

const authenticate = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ error: "Access Denied." });
    try { 
        req.user = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET); 
        next(); 
    } catch (err) { 
        return res.status(401).json({ error: "Session expired or invalid token." }); 
    }
};

const upload = multer({ storage: multer.memoryStorage() }); 

// 🧠 Smart AI Triage Engine
async function aiTriageEngine(symptoms) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Analyze these patient symptoms and return ONLY the most appropriate medical department name (e.g., Cardiology, Neurology, General Medicine, Orthopedics, Gastroenterology). Do not return any other text. Symptoms: "${symptoms}"`;
        const result = await model.generateContent(prompt);
        let dept = result.response.text().trim();
        
        if(dept.includes("Cardio")) return "Cardiology";
        if(dept.includes("Neuro")) return "Neurology";
        if(dept.includes("Ortho")) return "Orthopedics";
        if(dept.includes("Gastro")) return "Gastroenterology";
        return dept || "General Medicine";
    } catch(err) {
        const text = symptoms.toLowerCase();
        if (text.includes('chest') || text.includes('heart')) return "Cardiology";
        if (text.includes('bone') || text.includes('fracture')) return "Orthopedics";
        if (text.includes('brain') || text.includes('headache')) return "Neurology";
        return "General Medicine";
    }
}

// Fallback Lab Logic
function processLabReport(rawText) {
    const text = rawText.toLowerCase();
    let score = 100; let biomarkers = []; let insights = []; let diet = [];

    if (text.includes('sugar') || text.includes('glucose')) {
        const match = text.match(/(?:sugar|glucose).*?(\d{2,3})/);
        if (match && match[1]) {
            const val = parseInt(match[1]);
            if (val > 140) { biomarkers.push({ name: 'Blood Sugar', val: val + ' mg/dL', status: 'High', color: 'red', width: '85%' }); score -= 15; insights.push("Elevated blood sugar detected."); diet.push("Avoid sugar."); } 
            else if (val < 70) { biomarkers.push({ name: 'Blood Sugar', val: val + ' mg/dL', status: 'Low', color: 'orange', width: '20%' }); score -= 10; insights.push("Low blood sugar detected."); } 
            else { biomarkers.push({ name: 'Blood Sugar', val: val + ' mg/dL', status: 'Normal', color: 'green', width: '50%' }); }
        }
    }
    if (biomarkers.length === 0) { insights.push("No anomalies."); diet.push("Balanced diet."); }
    return { score: Math.max(10, Math.min(100, score)), biomarkers, insights, diet };
}

// 🛡️ API Endpoints (Auth)
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
        if (result.rows.length === 0) return res.status(400).json({ error: "Account not found." });
        
        const user = result.rows[0];
        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Incorrect password." });
        
        res.json({ token: jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' }), role: user.role });
    } catch(e) { res.status(500).json({ error: "Server error." }); }
});

// 🏥 PATIENT APIs
app.post('/api/appointments', authenticate, async (req, res) => {
    const { patient_name, age, gender, contact, symptoms, date, doctor_id } = req.body;
    try {
        if (doctor_id) {
            const docRes = await pool.query(`SELECT id, specialization FROM users WHERE id = $1 AND role = 'doctor'`, [doctor_id]);
            if (docRes.rows.length === 0) return res.status(400).json({ error: "Doctor not found" });
            const doc = docRes.rows[0];
            const insRes = await pool.query(`INSERT INTO appointments (patient_id, doctor_id, patient_name, age, gender, contact, symptoms, department, appointment_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`, [req.user.id, doc.id, patient_name, age, gender, contact, symptoms, doc.specialization, date]);
            res.status(201).json({ message: "Booked!", id: insRes.rows[0].id, dept: doc.specialization });
        } else {
            const dept = await aiTriageEngine(symptoms);
            const docRes = await pool.query(`SELECT id FROM users WHERE role = 'doctor' AND specialization = $1 LIMIT 1`, [dept]);
            const docId = docRes.rows.length > 0 ? docRes.rows[0].id : 1; 
            const insRes = await pool.query(`INSERT INTO appointments (patient_id, doctor_id, patient_name, age, gender, contact, symptoms, department, appointment_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`, [req.user.id, docId, patient_name, age, gender, contact, symptoms, dept, date]);
            res.status(201).json({ message: "Booked!", id: insRes.rows[0].id, dept: dept });
        }
    } catch(e) { res.status(500).json({error: "Failed to book appointment."}); }
});

app.get('/api/queue/:appointmentId', async (req, res) => {
    try {
        const currRes = await pool.query(`SELECT doctor_id, appointment_date, status FROM appointments WHERE id = $1`, [req.params.appointmentId]);
        if (currRes.rows.length === 0) return res.status(404).json({error: "Appointment not found"});
        const currentAppt = currRes.rows[0];
        
        const qRes = await pool.query(`SELECT COUNT(*) as "patientsAhead" FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND status = 'Pending' AND id < $3`, [currentAppt.doctor_id, currentAppt.appointment_date, req.params.appointmentId]);
        const count = parseInt(qRes.rows[0].patientsAhead) || 0;
        
        res.json({ patientsAhead: count, estimatedWaitTime: count * 15, status: currentAppt.status });
    } catch(e) { res.status(500).json({error: "Error fetching queue data."}); }
});

app.get(['/api/patient/dashboard', '/api/appointments/me'], authenticate, async (req, res) => {
    try {
        const result = await pool.query(`SELECT a.id, u.name as doctor_name, a.department, a.appointment_date, a.status, a.symptoms FROM appointments a LEFT JOIN users u ON a.doctor_id = u.id WHERE a.patient_id = $1 ORDER BY a.id DESC`, [req.user.id]);
        res.json(result.rows);
    } catch(e) { res.json([]); }
});

// 👨‍⚕️ DOCTOR DASHBOARD APIs
app.get(['/api/doctor/dashboard', '/api/doctor/appointments'], authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'doctor' && req.user.role !== 'admin') return res.status(403).json({error: "Unauthorized access"});
        const result = await pool.query(`SELECT a.*, p.name as real_patient_name FROM appointments a LEFT JOIN users p ON a.patient_id = p.id WHERE a.doctor_id = $1 ORDER BY a.id DESC`, [req.user.id]);
        res.json(result.rows);
    } catch(e) { res.status(500).json({error: "Server Error"}); }
});

app.post('/api/doctor/appointment/:id/status', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
            return res.status(403).json({error: "Unauthorized action"});
        }
        
        const { status } = req.body;
        
        await pool.query(
            `UPDATE appointments SET status = $1 WHERE id = $2 AND doctor_id = $3`, 
            [status, req.params.id, req.user.id]
        );
        
        res.json({ message: "Appointment updated successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update status." });
    }
});

// 🛡️ ADMIN DASHBOARD APIs 
app.get(['/api/admin/dashboard', '/api/admin/appointments'], authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({error: "Unauthorized access"});
        const result = await pool.query(`SELECT * FROM appointments ORDER BY id DESC`);
        res.json(result.rows);
    } catch(e) { res.status(500).json({error: "Server Error"}); }
});

app.get('/api/admin/users', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({error: "Unauthorized access"});
        const result = await pool.query(`SELECT id, name, email, role, specialization, fees FROM users ORDER BY id DESC`);
        res.json(result.rows);
    } catch(e) { res.status(500).json({error: "Server Error"}); }
});

app.post('/api/admin/add-doctor', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: "Only admins can add doctors." });
        const { name, email, password, specialization, experience, qualification, fees, about } = req.body;
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            `INSERT INTO users (name, email, password, role, specialization, experience, qualification, fees, about) VALUES ($1, $2, $3, 'doctor', $4, $5, $6, $7, $8)`,
            [name, email, hash, specialization, experience, qualification, fees, about]
        );
        res.status(201).json({ message: "Doctor added successfully!" });
    } catch (error) { 
        res.status(500).json({ error: "Failed to add doctor." }); 
    }
});

// 🚀 AI LAB REPORT ANALYZER (Bulletproof Version)
app.post('/api/upload-pdf', authenticate, upload.single('reportPdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        
        let pdfData;
        try {
            pdfData = await pdfParse(req.file.buffer);
            if (!pdfData.text || pdfData.text.trim() === '') {
                 return res.status(400).json({ error: "PDF contains no readable text. Is it an image?" });
            }
        } catch (pdfErr) {
             console.error("PDF Parse Error:", pdfErr);
             return res.status(500).json({ error: "Could not read the PDF file." });
        }
        
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `Analyze this medical lab report text. Return ONLY a valid JSON object (no markdown, no backticks) in this exact format: {"score": 85, "biomarkers": [{"name": "Blood Sugar", "val": "110 mg/dL", "status": "Normal", "color": "green", "width": "50%"}], "insights": ["Insight 1"], "diet": ["Diet 1"]}. Ensure the JSON is perfectly valid. Text: ${pdfData.text}`;
            
            const result = await model.generateContent(prompt);
            let aiResponse = result.response.text();
            
            aiResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            
            let finalJson;
            try {
                finalJson = JSON.parse(aiResponse);
            } catch (parseError) {
                console.error("Failed to parse Gemini output as JSON:", aiResponse);
                finalJson = processLabReport(pdfData.text); 
            }
            
            res.json(finalJson);
            
        } catch (aiError) {
            console.error("Gemini API Error:", aiError.message);
            res.json(processLabReport(pdfData.text)); 
        }
    } catch (err) { 
        console.error("Unexpected Error in upload-pdf:", err);
        res.status(500).json({ error: "An unexpected error occurred." }); 
    }
});

app.get('/api/doctors', async (req, res) => { 
    try {
        const result = await pool.query(`SELECT id, name, specialization, email, image_url, experience, qualification, about, fees FROM users WHERE role = 'doctor'`);
        res.json(result.rows);
    } catch(e) { res.json([]); }
});

app.get('/api/doctors/:id', async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, name, specialization, email, image_url, experience, qualification, about, fees FROM users WHERE role = 'doctor' AND id = $1`, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({error: "Doctor not found"});
        res.json(result.rows[0]);
    } catch(e) { res.status(500).json({error: "Server Error"}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RakshitPlus AI Backend Live on Port ${PORT}!`));