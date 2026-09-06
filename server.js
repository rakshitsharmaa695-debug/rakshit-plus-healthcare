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

// 🚀 GEMINI VISION ENGINE SETUP (Securely using .env file)
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
        
        const hash = await bcrypt.hash('admin123', 10);
        await pool.query(`INSERT INTO users (name, email, password, role) VALUES ('System Admin', 'admin@rakshitplus.com', $1, 'admin') ON CONFLICT (email) DO NOTHING`, [hash]);
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

// Memory storage zaroori hai taaki PDF Base64 bankar seedha Gemini Vision mein ja sake
const upload = multer({ storage: multer.memoryStorage() }); 

// 🧠 AI TRIAGE ENGINE (Smart routing)
async function aiTriageEngine(symptoms) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const result = await model.generateContent(`Analyze these symptoms and return ONLY the medical department name (e.g., Cardiology, Neurology, Orthopedics, General Medicine, Gastroenterology). Do not explain. Symptoms: "${symptoms}"`);
        let dept = result.response.text().trim();
        
        if(dept.includes("Cardio")) return "Cardiology";
        if(dept.includes("Neuro")) return "Neurology";
        if(dept.includes("Ortho")) return "Orthopedics";
        if(dept.includes("Gastro")) return "Gastroenterology";
        return "General Medicine";
    } catch(err) {
        return "General Medicine";
    }
}

// 🛡️ AUTH & BOOKING APIs
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
        const isMatch = await bcrypt.compare(req.body.password, result.rows[0].password);
        if (!isMatch) return res.status(400).json({ error: "Incorrect password." });
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
    } catch(e) { res.status(500).json({error: "Failed to book appointment."}); }
});

// 🚀 ADVANCED VISION AI LAB REPORT ANALYZER (Reads Scanned Images & Text Perfectly)
app.post('/api/upload-pdf', authenticate, upload.single('reportPdf'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No PDF file received." });
    
    try {
        // Initialize Gemini Vision Model
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        
        // 🧠 MASTER TRICK: Inject PDF directly as Base64 Image Data
        const pdfPart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: "application/pdf"
            }
        };

        const prompt = `You are a Chief Pathologist AI. Read this medical lab report document completely (whether it is text or a scanned image). Extract the exact numerical test values. Return ONLY a valid JSON object matching this EXACT format without any markdown blocks or backticks:
        {"score": 85, "biomarkers": [{"name": "Fasting Blood Sugar", "val": "110 mg/dL", "status": "Normal", "color": "green", "width": "50%"}], "insights": ["Insight 1"], "diet": ["Diet 1"]}. 
        Evaluate high/low status accurately based on standard medical ranges. Ensure the output is raw JSON.`;

        // Send both Prompt and PDF Base64 string to Gemini
        const result = await model.generateContent([prompt, pdfPart]);
        
        // Clean up response to ensure valid JSON
        let aiResponse = result.response.text();
        aiResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const parsedResponse = JSON.parse(aiResponse);
        return res.status(200).json(parsedResponse);
        
    } catch (aiErr) {
        console.error("Gemini Vision API Error:", aiErr.message);
        return res.status(500).json({ 
            error: "Document processing failed. Please ensure the API Key is correct and the file is readable." 
        });
    }
});

// 👨‍⚕️ DASHBOARDS & ROUTING
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
    try {
        await pool.query(`UPDATE appointments SET status = $1 WHERE id = $2 AND doctor_id = $3`, [req.body.status, req.params.id, req.user.id]);
        res.json({ message: "Updated!" });
    } catch (error) { res.status(500).json({ error: "Failed" }); }
});

app.get(['/api/admin/dashboard', '/api/admin/appointments'], authenticate, async (req, res) => {
    try { res.json((await pool.query(`SELECT * FROM appointments ORDER BY id DESC`)).rows); } catch(e) { res.status(500).json({error: "Error"}); }
});

app.get('/api/admin/users', authenticate, async (req, res) => {
    try { res.json((await pool.query(`SELECT id, name, email, role, specialization, fees FROM users ORDER BY id DESC`)).rows); } catch(e) { res.status(500).json({error: "Error"}); }
});

app.post('/api/admin/add-doctor', authenticate, async (req, res) => {
    try {
        const hash = await bcrypt.hash(req.body.password, 10);
        await pool.query(`INSERT INTO users (name, email, password, role, specialization, experience, qualification, fees, about) VALUES ($1, $2, $3, 'doctor', $4, $5, $6, $7, $8)`, [req.body.name, req.body.email, hash, req.body.specialization, req.body.experience, req.body.qualification, req.body.fees, req.body.about]);
        res.status(201).json({ message: "Added!" });
    } catch (error) { res.status(500).json({ error: "Failed" }); }
});

app.get('/api/doctors', async (req, res) => { 
    try { res.json((await pool.query(`SELECT id, name, specialization, email, image_url, experience, qualification, about, fees FROM users WHERE role = 'doctor'`)).rows); } catch(e) { res.json([]); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RakshitPlus Vision AI Backend Live on Port ${PORT}!`));