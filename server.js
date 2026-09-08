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

// 🚀 DATABASE CONNECTION (SAFE)
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

// 🔒 AUTHENTICATION MIDDLEWARE
const authenticate = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ error: "Access Denied. Please Login." });
    try { 
        req.user = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET); 
        next(); 
    } catch (err) { return res.status(401).json({ error: "Session expired. Please Login again." }); }
};

const upload = multer({ storage: multer.memoryStorage() }); 

// 🧠 ADVANCED BILINGUAL DIAGNOSTIC ENGINE (SAFE)
const symptomTree = {
    "start": {
        msg: "Welcome to RakshitPlus AI. Please choose your language. <br><br> Kripya apni bhasha chunein:",
        options: ["🇬🇧 English", "🇮🇳 Hindi/Hinglish"]
    },

    "🇬🇧 English": { msg: "Where are you experiencing discomfort?", options: ["🤕 Head", "🫀 Chest", "🍕 Stomach", "🤒 General Fever"] },
    "🤕 Head": { msg: "Please select your specific symptom:", options: ["Severe throbbing pain", "Dizziness/Spinning"] },
    "Severe throbbing pain": { msg: "<b>🩺 Probable Diagnosis:</b> Symptoms suggest a Migraine or Tension Headache.<br><br><b>💡 Advice:</b> Rest in a quiet, dark room and stay hydrated.", dept: "Neurology", options: ["🔄 Restart"] },
    "Dizziness/Spinning": { msg: "<b>🩺 Probable Diagnosis:</b> Symptoms point towards Vertigo, weakness, or low blood pressure.<br><br><b>💡 Advice:</b> Sit or lie down immediately to avoid falling.", dept: "Neurology", options: ["🔄 Restart"] },
    "🫀 Chest": { msg: "What kind of chest issue are you facing?", options: ["Heavy tightness/Pain", "Continuous Cough"] },
    "Heavy tightness/Pain": { msg: "<b>🩺 Probable Diagnosis:</b> This could be Angina (Cardiac issue) or severe Acid Reflux. Chest pain should never be ignored.<br><br><b>🚨 Advice:</b> Seek medical attention immediately.", dept: "Cardiology", options: ["🔄 Restart"] },
    "Continuous Cough": { msg: "<b>🩺 Probable Diagnosis:</b> Symptoms indicate Bronchitis, Asthma, or a Respiratory Infection.<br><br><b>💡 Advice:</b> Avoid cold drinks, take steam inhalation, and keep warm.", dept: "Pulmonology", options: ["🔄 Restart"] },
    "🍕 Stomach": { msg: "What is your primary stomach issue?", options: ["Severe Cramps/Pain", "Nausea & Diarrhea"] },
    "Severe Cramps/Pain": { msg: "<b>🩺 Probable Diagnosis:</b> Could be Gastritis, Appendicitis, or Kidney Stones.<br><br><b>💡 Advice:</b> Drink warm water and strictly avoid spicy/oily food.", dept: "Gastroenterology", options: ["🔄 Restart"] },
    "Nausea & Diarrhea": { msg: "<b>🩺 Probable Diagnosis:</b> Highly likely to be Food Poisoning or an intestinal infection.<br><br><b>💡 Advice:</b> Keep yourself hydrated with ORS (Electrolytes).", dept: "General Medicine", options: ["🔄 Restart"] },
    "🤒 General Fever": { msg: "How high is your fever?", options: ["Low grade & Chills", "High fever with body ache"] },
    "Low grade & Chills": { msg: "<b>🩺 Probable Diagnosis:</b> Likely a common Viral infection or Seasonal Cold.<br><br><b>💡 Advice:</b> Get plenty of rest and monitor your temperature.", dept: "General Medicine", options: ["🔄 Restart"] },
    "High fever with body ache": { msg: "<b>🩺 Probable Diagnosis:</b> Could be Dengue, Malaria, or severe Typhoid.<br><br><b>💡 Advice:</b> Do not take antibiotics without a proper blood test.", dept: "General Medicine", options: ["🔄 Restart"] },

    "🇮🇳 Hindi/Hinglish": { msg: "Aapko kis hisse mein pareshani mehsoos ho rahi hai?", options: ["🤕 Sir (Head)", "🫀 Chaati (Chest)", "🍕 Pet (Stomach)", "🤒 Bukhar (Fever)"] },
    "🤕 Sir (Head)": { msg: "Sir mein exactly kaisa feel ho raha hai?", options: ["Tez dard (Throbbing)", "Chakkar aana (Dizziness)"] },
    "Tez dard (Throbbing)": { msg: "<b>🩺 Probable Diagnosis:</b> Yeh Migraine ya Tension Headache ho sakta hai.<br><br><b>💡 Advice:</b> Shanti wale andhere kamre mein aaram karein aur paani piyein.", dept: "Neurology", options: ["🔄 Naya Checkup"] },
    "Chakkar aana (Dizziness)": { msg: "<b>🩺 Probable Diagnosis:</b> Yeh Vertigo (chakkar) ya Low BP ki wajah se ho sakta hai.<br><br><b>💡 Advice:</b> Turant baith jayein ya let jayein taaki aap girein nahi.", dept: "Neurology", options: ["🔄 Naya Checkup"] },
    "🫀 Chaati (Chest)": { msg: "Chaati (Chest) mein kya problem ho rahi hai?", options: ["Dard ya Jakdan (Tightness)", "Lagaatar Khansi (Cough)"] },
    "Dard ya Jakdan (Tightness)": { msg: "<b>🩺 Probable Diagnosis:</b> Yeh Angina (Heart issue) ya severe Acidity ho sakti hai. Isko halke mein na lein.<br><br><b>🚨 Advice:</b> Kripya turant doctor se sampark karein.", dept: "Cardiology", options: ["🔄 Naya Checkup"] },
    "Lagaatar Khansi (Cough)": { msg: "<b>🩺 Probable Diagnosis:</b> Yeh Bronchitis, Asthma ya chhati ka infection ho sakta hai.<br><br><b>💡 Advice:</b> Thandi cheezein na khayein aur bhaap (steam) lein.", dept: "Pulmonology", options: ["🔄 Naya Checkup"] },
    "🍕 Pet (Stomach)": { msg: "Pet mein kya dikkat aa rahi hai?", options: ["Tez Dard ya Marod", "Ulti aur Dast (Diarrhea)"] },
    "Tez Dard ya Marod": { msg: "<b>🩺 Probable Diagnosis:</b> Yeh Gastritis, Appendix, ya Pathri (Kidney Stone) ka dard ho sakta hai.<br><br><b>💡 Advice:</b> Gunguna paani piyein aur bahar ka masaledar khana chhod dein.", dept: "Gastroenterology", options: ["🔄 Naya Checkup"] },
    "Ulti aur Dast (Diarrhea)": { msg: "<b>🩺 Probable Diagnosis:</b> Yeh pakka Food Poisoning ya pet ka infection hai.<br><br><b>💡 Advice:</b> ORS ka ghol piyein taaki body mein paani ki kami (dehydration) na ho.", dept: "General Medicine", options: ["🔄 Naya Checkup"] },
    "🤒 Bukhar (Fever)": { msg: "Bukhar kaisa hai?", options: ["Halka Bukhar aur Sardi", "Tez Bukhar aur Badan Dard"] },
    "Halka Bukhar aur Sardi": { msg: "<b>🩺 Probable Diagnosis:</b> Yeh normal Viral Fever ya Sardi-Zukam ho sakta hai.<br><br><b>💡 Advice:</b> Aaram karein aur apna temperature check karte rahein.", dept: "General Medicine", options: ["🔄 Naya Checkup"] },
    "Tez Bukhar aur Badan Dard": { msg: "<b>🩺 Probable Diagnosis:</b> Yeh Dengue, Malaria ya Typhoid ke lakshan ho sakte hain.<br><br><b>💡 Advice:</b> Bina Blood Test ke koi heavy dawai/antibiotic khud se na lein.", dept: "General Medicine", options: ["🔄 Naya Checkup"] },

    "🔄 Restart": { msg: "Let's start over. Please choose your language:", options: ["🇬🇧 English", "🇮🇳 Hindi/Hinglish"] },
    "🔄 Naya Checkup": { msg: "Chaliye dobara shuru karte hain. Apni bhasha chunein:", options: ["🇬🇧 English", "🇮🇳 Hindi/Hinglish"] }
};

// 🤖 🌟 SECURE CLICK-BASED CHAT ENGINE (Added authenticate middleware)
app.post('/api/ai-chat', authenticate, (req, res) => {
    let { message } = req.body;
    
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

// 🚀 LAB REPORT ANALYZER
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