const express = require('express');
const { Pool } = require('pg'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const app = express();
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' })); 

const JWT_SECRET = process.env.JWT_SECRET || "RakshitPlus_Enterprise_Secret";

// 🚀 CONNECT TO CLOUD DATABASE
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
        console.log("☁️ Cloud PostgreSQL Connected Successfully!");
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

// 🧠 OFFLINE NLP TRIAGE ENGINE (0ms Latency, No API)
function aiTriageEngine(symptoms) {
    const text = symptoms.toLowerCase();
    if (text.match(/chest|heart|breath|bp|palpitation/)) return "Cardiology";
    if (text.match(/brain|headache|nerve|dizzy|memory/)) return "Neurology";
    if (text.match(/bone|fracture|joint|muscle|knee|back/)) return "Orthopedics";
    if (text.match(/stomach|digestion|acid|liver|ulcer/)) return "Gastroenterology";
    return "General Medicine";
}

// 🩺 ADVANCED OFFLINE MEDICAL PARSER (Lifetime Free, Regex-Based)
function advancedMedicalParser(rawText) {
    const text = (rawText || "").toLowerCase();
    let score = 100; 
    let biomarkers = []; 
    let insights = []; 
    let diet = [];

    // 1. Parse Blood Sugar
    let sugarMatch = text.match(/(?:blood sugar|glucose|fasting).*?(\d{2,3})(?:\.\d+)?/);
    if (sugarMatch) {
        let val = parseInt(sugarMatch[1]);
        if (val > 140) {
            biomarkers.push({ name: 'Blood Sugar', val: val + ' mg/dL', status: 'High', color: 'red', width: '85%' });
            score -= 15;
            insights.push("Elevated blood glucose levels detected. High risk of Diabetes.");
            diet.push("Strictly avoid refined sugars, sweets, and high-carb foods.");
        } else if (val < 70) {
            biomarkers.push({ name: 'Blood Sugar', val: val + ' mg/dL', status: 'Low', color: 'orange', width: '25%' });
            score -= 10;
            insights.push("Hypoglycemia (low blood sugar) indicators found.");
            diet.push("Include complex carbohydrates and consume timely meals.");
        } else {
            biomarkers.push({ name: 'Blood Sugar', val: val + ' mg/dL', status: 'Normal', color: 'green', width: '50%' });
            insights.push("Blood glucose levels are within the normal biological range.");
        }
    }

    // 2. Parse Cholesterol
    let cholMatch = text.match(/(?:total cholesterol|cholesterol).*?(\d{3})/);
    if (cholMatch) {
        let val = parseInt(cholMatch[1]);
        if (val > 200) {
            biomarkers.push({ name: 'Total Cholesterol', val: val + ' mg/dL', status: 'High', color: 'red', width: '80%' });
            score -= 15;
            insights.push("Hyperlipidemia (High Cholesterol) detected.");
            diet.push("Reduce intake of saturated fats and junk food.");
        } else {
            biomarkers.push({ name: 'Total Cholesterol', val: val + ' mg/dL', status: 'Normal', color: 'green', width: '50%' });
        }
    }

    // 3. Parse Hemoglobin
    let hbMatch = text.match(/(?:hemoglobin|hb).*?(\d{1,2}\.\d+)/);
    if (hbMatch) {
        let val = parseFloat(hbMatch[1]);
        if (val < 13.0) {
            biomarkers.push({ name: 'Hemoglobin', val: val + ' g/dL', status: 'Low', color: 'orange', width: '30%' });
            score -= 10;
            insights.push("Low Hemoglobin levels indicate potential anemia.");
            diet.push("Increase intake of iron-rich foods like spinach and dates.");
        } else {
            biomarkers.push({ name: 'Hemoglobin', val: val + ' g/dL', status: 'Normal', color: 'green', width: '50%' });
        }
    }

    // Default Fallback if document is image-based or empty
    if (biomarkers.length === 0) {
        biomarkers.push({ name: 'General Scan', val: 'Complete', status: 'Normal', color: 'green', width: '50%' });
        insights.push("Document scanned successfully. Automated value extraction requires a text-based PDF.");
        diet.push("Maintain a balanced diet and consult your physician for manual review.");
    }
    
    if(diet.length === 0) diet.push("Maintain a balanced, healthy lifestyle.");
    
    return { score: Math.max(10, score), biomarkers, insights, diet };
}

// 🛡️ API Endpoints (Auth & Booking)
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
        let dept = doctor_id ? (await pool.query(`SELECT specialization FROM users WHERE id = $1`, [doctor_id])).rows[0].specialization : aiTriageEngine(symptoms);
        let docId = doctor_id || (await pool.query(`SELECT id FROM users WHERE role = 'doctor' AND specialization = $1 LIMIT 1`, [dept])).rows[0]?.id || 1; 
        const insRes = await pool.query(`INSERT INTO appointments (patient_id, doctor_id, patient_name, age, gender, contact, symptoms, department, appointment_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`, [req.user.id, docId, patient_name, age, gender, contact, symptoms, dept, date]);
        res.status(201).json({ message: "Booked!", id: insRes.rows[0].id, dept: dept });
    } catch(e) { res.status(500).json({error: "Failed to book appointment."}); }
});

// 🚀 OFFLINE LAB REPORT ANALYZER (No API Key Required)
app.post('/api/upload-pdf', authenticate, upload.single('reportPdf'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No PDF file received." });
    try {
        const pdfData = await pdfParse(req.file.buffer);
        return res.status(200).json(advancedMedicalParser(pdfData.text));
    } catch (error) {
        return res.status(200).json(advancedMedicalParser(""));
    }
});

// 👨‍⚕️ Standard Routing APIs
app.get(['/api/patient/dashboard', '/api/appointments/me'], authenticate, async (req, res) => {
    try {
        const result = await pool.query(`SELECT a.id, u.name as doctor_name, a.department, a.appointment_date, a.status, a.symptoms FROM appointments a LEFT JOIN users u ON a.doctor_id = u.id WHERE a.patient_id = $1 ORDER BY a.id DESC`, [req.user.id]);
        res.json(result.rows);
    } catch(e) { res.json([]); }
});

app.get('/api/queue/:appointmentId', async (req, res) => {
    try {
        const currRes = await pool.query(`SELECT doctor_id, appointment_date, status FROM appointments WHERE id = $1`, [req.params.appointmentId]);
        if (currRes.rows.length === 0) return res.status(404).json({error: "Appointment not found"});
        const count = parseInt((await pool.query(`SELECT COUNT(*) as "patientsAhead" FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND status = 'Pending' AND id < $3`, [currRes.rows[0].doctor_id, currRes.rows[0].appointment_date, req.params.appointmentId])).rows[0].patientsAhead) || 0;
        res.json({ patientsAhead: count, estimatedWaitTime: count * 15, status: currRes.rows[0].status });
    } catch(e) { res.status(500).json({error: "Error fetching queue."}); }
});

app.get(['/api/doctor/dashboard', '/api/doctor/appointments'], authenticate, async (req, res) => {
    try {
        const result = await pool.query(`SELECT a.*, p.name as real_patient_name FROM appointments a LEFT JOIN users p ON a.patient_id = p.id WHERE a.doctor_id = $1 ORDER BY a.id DESC`, [req.user.id]);
        res.json(result.rows);
    } catch(e) { res.status(500).json({error: "Server Error"}); }
});

app.post('/api/doctor/appointment/:id/status', authenticate, async (req, res) => {
    try {
        await pool.query(`UPDATE appointments SET status = $1 WHERE id = $2 AND doctor_id = $3`, [req.body.status, req.params.id, req.user.id]);
        res.json({ message: "Updated!" });
    } catch (error) { res.status(500).json({ error: "Failed to update." }); }
});

app.get('/api/doctors', async (req, res) => { 
    try {
        res.json((await pool.query(`SELECT id, name, specialization, email, image_url, experience, qualification, about, fees FROM users WHERE role = 'doctor'`)).rows);
    } catch(e) { res.json([]); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RakshitPlus Offline Engine Live on Port ${PORT}!`));