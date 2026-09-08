require('dotenv').config(); 
const express = require('express');
const { Pool } = require('pg'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();
app.use(express.static(__dirname));
app.use(express.json({ limit: '15mb' })); 

const JWT_SECRET = process.env.JWT_SECRET || "RakshitPlus_Enterprise_Secret";

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

// 🧠 IN-HOUSE SMART DECISION TREE (Offline Finite State Machine)
const symptomTree = {
    "start": {
        msg: "Hello! I am RakshitPlus AI. Aapko kis hisse mein problem feel ho rahi hai?",
        options: ["🤕 Head/Brain", "🫀 Chest/Heart", "🍕 Stomach/Digestion", "🦴 Bones/Joints", "🤒 Fever/General"]
    },
    // Level 1 Branches
    "🤕 Head/Brain": {
        msg: "Sir (Head) mein exactly kaisa feel ho raha hai?",
        options: ["Severe Headache", "Dizziness/Fainting", "Ear/Eye Pain", "🔙 Go Back"]
    },
    "🫀 Chest/Heart": {
        msg: "Chest mein exactly kaisa feel ho raha hai?",
        options: ["Pain or Tightness", "Cough/Breathing issue", "Heartburn/Acidity", "🔙 Go Back"]
    },
    "🍕 Stomach/Digestion": {
        msg: "Pet (Stomach) mein kya problem ho rahi hai?",
        options: ["Stomach Ache/Cramps", "Vomiting/Nausea", "Loose Motions", "🔙 Go Back"]
    },
    "🦴 Bones/Joints": {
        msg: "Haddiyo ya jodo mein kya dikkat hai?",
        options: ["Joint Pain", "Back Pain", "Injury/Fracture", "🔙 Go Back"]
    },
    "🤒 Fever/General": {
        msg: "Bataiye general kya problem hai?",
        options: ["High Fever", "Cold/Flu", "Skin Rash", "🔙 Go Back"]
    },

    // Level 2 Final Leaves (Diagnosis)
    "Severe Headache": { msg: "Aapke symptoms ke hisaab se aapko Neurology mein dikhana chahiye.", dept: "Neurology", options: ["🔄 Start Over"] },
    "Dizziness/Fainting": { msg: "Aapko Neurologist se consult karna chahiye.", dept: "Neurology", options: ["🔄 Start Over"] },
    "Ear/Eye Pain": { msg: "Aapko ENT specialist se milna chahiye.", dept: "ENT", options: ["🔄 Start Over"] },
    
    "Pain or Tightness": { msg: "Chest pain ko serious lein. Aapko turant Cardiology department mein dikhana chahiye.", dept: "Cardiology", options: ["🔄 Start Over"] },
    "Cough/Breathing issue": { msg: "Aapko Pulmonology ya General Medicine mein dikhana chahiye.", dept: "Pulmonology", options: ["🔄 Start Over"] },
    "Heartburn/Acidity": { msg: "Aapko Gastroenterology department mein dikhana chahiye.", dept: "Gastroenterology", options: ["🔄 Start Over"] },
    
    "Stomach Ache/Cramps": { msg: "Aapko Gastroenterology mein dikhana chahiye.", dept: "Gastroenterology", options: ["🔄 Start Over"] },
    "Vomiting/Nausea": { msg: "Aapko General Medicine ya Gastroenterology mein dikhana chahiye.", dept: "General Medicine", options: ["🔄 Start Over"] },
    "Loose Motions": { msg: "Aapko General Medicine mein dikhana chahiye.", dept: "General Medicine", options: ["🔄 Start Over"] },
    
    "Joint Pain": { msg: "Aapko Orthopedics department mein dikhana chahiye.", dept: "Orthopedics", options: ["🔄 Start Over"] },
    "Back Pain": { msg: "Aapko Orthopedics ya Physiotherapy mein dikhana chahiye.", dept: "Orthopedics", options: ["🔄 Start Over"] },
    "Injury/Fracture": { msg: "Aapko turant Orthopedics department mein jana chahiye.", dept: "Orthopedics", options: ["🔄 Start Over"] },
    
    "High Fever": { msg: "Aapko General Medicine department mein checkup karwana chahiye.", dept: "General Medicine", options: ["🔄 Start Over"] },
    "Cold/Flu": { msg: "Aapko General Medicine mein dikhana chahiye.", dept: "General Medicine", options: ["🔄 Start Over"] },
    "Skin Rash": { msg: "Aapko Dermatology (Skin Specialist) se milna chahiye.", dept: "Dermatology", options: ["🔄 Start Over"] },
    
    "🔙 Go Back": { msg: "Chaliye shuru se dekhte hain. Kis hisse mein problem hai?", options: ["🤕 Head/Brain", "🫀 Chest/Heart", "🍕 Stomach/Digestion", "🦴 Bones/Joints", "🤒 Fever/General"] },
    "🔄 Start Over": { msg: "Naya symptom check shuru karein. Kahan problem hai?", options: ["🤕 Head/Brain", "🫀 Chest/Heart", "🍕 Stomach/Digestion", "🦴 Bones/Joints", "🤒 Fever/General"] }
};

// 🤖 🌟 CLICK-BASED CHAT ENGINE
app.post('/api/ai-chat', (req, res) => {
    let { message } = req.body;
    
    // Fallback if message is empty or unrecognized
    if (!message || !symptomTree[message]) {
        message = "start";
    }

    const responseNode = symptomTree[message];
    
    return res.json({ 
        reply: responseNode.msg, 
        options: responseNode.options || [], 
        department: responseNode.dept || null 
    });
});

async function aiTriageEngine(symptoms) {
    const deptMap = { "Head": "Neurology", "Chest": "Cardiology", "Stomach": "Gastroenterology", "Pain": "Orthopedics", "Fever": "General Medicine", "Skin": "Dermatology" };
    for(let key in deptMap) { if(symptoms.toLowerCase().includes(key.toLowerCase())) return deptMap[key]; }
    return "General Medicine";
}

// 🚀 LAB REPORT ANALYZER (Mocked for offline stability)
app.post('/api/upload-pdf', authenticate, upload.single('reportPdf'), (req, res) => {
    res.json({ score: 100, biomarkers: [{name: "Offline Check", val: "N/A", status: "Manual System Active", color: "blue"}], insights: ["Automated PDF scanning is disabled. Please consult the doctor directly."], diet: [] });
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