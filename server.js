require('dotenv').config(); 
const express = require('express');
const { Pool } = require('pg'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();
app.use(express.static(__dirname));
app.use(express.json({ limit: '15mb' })); 

const JWT_SECRET = process.env.JWT_SECRET || "SmartCare_Enterprise_Secret";

// 🚀 DATABASE CONNECTION
const pool = new Pool({
    connectionString: "postgresql://rakshitplus_db_user:NNn5OEOt6EGL57R3LlFXIYXTV1mxT0hu@dpg-dae3etf40ujc73dlb71g-a.ohio-postgres.render.com/rakshitplus_db",
    ssl: { rejectUnauthorized: false } 
});

const initDB = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'patient', specialization TEXT, image_url TEXT, experience TEXT, qualification TEXT, about TEXT, fees INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS appointments (id SERIAL PRIMARY KEY, patient_id INTEGER, doctor_id INTEGER, patient_name TEXT, age INTEGER, gender TEXT, contact TEXT, symptoms TEXT, department TEXT, appointment_date TEXT, status TEXT DEFAULT 'Pending')`);
        console.log("☁️ SmartCare Cloud DB Connected!");
    } catch (err) { console.error("DB Connection Error:", err); }
};
initDB();

const authenticate = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ error: "Access Denied. Please Login." });
    try { req.user = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET); next(); } 
    catch (err) { return res.status(401).json({ error: "Session expired. Please Login again." }); }
};

const upload = multer({ storage: multer.memoryStorage() }); 

app.get('/api/user/profile', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, name, email, role, specialization, image_url, experience, qualification, about, fees, created_at FROM users WHERE id = $1`, [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: "Server Error" }); }
});

// =======================================================
// 🧠 ULTIMATE DEEP CLINICAL PROFILING ENGINE
// =======================================================

const activeChats = {}; 

function isGibberish(text) {
    if (text.length < 3) return true;
    if (/\d{4,}/.test(text)) return true;
    if (/(.)\1{3,}/i.test(text)) return true;
    if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(text)) return true;
    return false;
}

function getSnippet(text) {
    let words = text.split(' ');
    return words.length > 6 ? words.slice(0, 6).join(' ') + "..." : text;
}

async function getDeepAIResponse(userMessage, userId) {
    const msg = userMessage.toLowerCase().trim();
    
    // 1. Initial State / Reset
    if (!activeChats[userId] || msg === 'start' || msg === '🔄 start over' || msg === 'hi' || msg === 'hello') {
        activeChats[userId] = { step: 'ASK_PRIMARY', data: { primary: '', dept: '', impact: '', triggers: '', associated: '' } };
        return { 
            reply: "Hello! I am SmartCare's Advanced Clinical AI. 👨‍⚕️<br><br>Let's do an in-depth assessment. <b>What brings you here today?</b> Please describe the main symptom you are feeling.", 
            options: ["I have a severe headache", "My chest feels tight", "Stomach ache", "I have a fever"] 
        };
    }

    let session = activeChats[userId];
    
    if (msg.includes('book') || msg.includes('appointment')) {
        delete activeChats[userId];
        return { reply: "Let's get you connected with a specialist to examine this closely.", options: ["📅 Book Appointment"] };
    }

    if (isGibberish(msg)) {
        return { reply: "I couldn't process that. Please use clear, descriptive words so I can accurately assess your health condition." };
    }

    // STEP 1: PRIMARY SYMPTOM -> Ask for Character/Impact (Apostrophes removed to prevent UI click break)
    if (session.step === 'ASK_PRIMARY') {
        const depts = {
            "Cardiology": ['chest', 'heart', 'palpitation', 'breath', 'jaw', 'arm', 'sweating', 'seene', 'dil', 'bp', 'pain', 'heavy', 'tight'],
            "Neurology": ['headache', 'dizzy', 'faint', 'numb', 'migraine', 'spin', 'head', 'seizure', 'sir', 'chakkar', 'vision', 'brain', 'paralysis'],
            "Gastroenterology": ['stomach', 'belly', 'nausea', 'vomit', 'diarrhea', 'acid', 'pain', 'burn', 'pet', 'ulti', 'gas', 'digestion', 'food', 'loose'],
            "Orthopedics": ['bone', 'joint', 'muscle', 'back', 'knee', 'fracture', 'sprain', 'ache', 'haddi', 'kamar', 'dard', 'neck', 'shoulder', 'leg'],
            "General Medicine": ['fever', 'cold', 'cough', 'weak', 'tired', 'chills', 'sick', 'throat', 'bukhar', 'khasi', 'infection', 'body', 'temperature']
        };

        let matchedDept = null;
        let maxMatches = 0;
        
        for (let [dept, kwList] of Object.entries(depts)) {
            let matches = kwList.filter(kw => msg.includes(kw)).length;
            if (matches > maxMatches) { maxMatches = matches; matchedDept = dept; }
        }
        
        if (!matchedDept) {
            return { reply: "I need a bit more detail. Which specific body part is affected or what exact discomfort are you feeling? (e.g., 'My back hurts' or 'I feel nauseous')" };
        }
        
        session.data.dept = matchedDept;
        session.data.primary = msg;
        session.step = 'ASK_IMPACT';
        
        return { 
            reply: `I see. This points to <b>${matchedDept}</b> concerns.<br><br>Let's dive deeper. Tell me about the nature of this discomfort. Is it sharp, dull, throbbing, or burning? And is it stopping you from doing your normal daily tasks?`,
            options: ["Sharp and limits movement", "A dull continuous ache", "Throbbing but manageable"]
        };
    }
    
    // STEP 2: IMPACT -> Ask for Triggers
    if (session.step === 'ASK_IMPACT') {
        session.data.impact = msg;
        session.step = 'ASK_TRIGGERS';
        return { 
            reply: `Understood.<br><br><b>Does anything make it feel better or worse?</b><br>(For example: Does it increase when you eat, lie down, walk, or take a deep breath?)`,
            options: ["Worse when I move", "Lying down helps", "Eating makes it worse", "Nothing changes it"]
        };
    }

    // STEP 3: TRIGGERS -> Ask for Red Flags / Associated Symptoms
    if (session.step === 'ASK_TRIGGERS') {
        session.data.triggers = msg;
        session.step = 'ASK_ASSOCIATED';
        return { 
            reply: `Noted. This helps narrow down the possibilities.<br><br><b>Finally, are you experiencing any other unusual signs?</b><br>(Like sudden sweating, dizziness, blurred vision, or breathing difficulty? If none, just type 'No').`,
            options: ["No other symptoms", "Yes feeling dizzy", "Yes feeling breathless"]
        };
    }

    // STEP 4: FINAL CLINICAL IMPRESSION (Smart Report)
    if (session.step === 'ASK_ASSOCIATED') {
        session.data.associated = msg;
        
        const fullContext = `${session.data.primary} ${session.data.impact} ${session.data.triggers} ${session.data.associated}`;
        const hasCriticalFlags = ['breath', 'faint', 'blood', 'sweat', 'vision', 'numb', 'unbearable', 'can\'t walk', 'paralyze', 'crushing'].some(w => fullContext.includes(w));
        const impactsDailyLife = ['stop', 'limit', 'can\'t', 'bed', 'sleep', 'wake', 'ruk'].some(w => session.data.impact.includes(w));
        
        const differentials = {
            "Cardiology": "Angina Pectoris, Costochondritis, or Arrhythmia",
            "Neurology": "Migraine, Tension Cephalgia, or Vestibular Disturbance",
            "Gastroenterology": "Gastritis, Peptic Ulcer Disease, or Gastroenteritis",
            "Orthopedics": "Musculoskeletal Strain, Ligamentous Injury, or Osteoarthritis Flare",
            "General Medicine": "Viral Prodrome, Acute Infection, or Systemic Inflammatory Response"
        };

        let diagnosisReport = `<div style="background: #1e293b; padding: 12px; border-radius: 8px; border-left: 4px solid #3b82f6;">`;
        diagnosisReport += `<b>📝 Clinical Impression Summary</b><br><hr style="border-color:#334155; margin:8px 0;">`;
        diagnosisReport += `• <b>Focus Area:</b> ${session.data.dept}<br>`;
        diagnosisReport += `• <b>Symptom Character:</b> ${getSnippet(session.data.impact)}<br>`;
        diagnosisReport += `• <b>Modifiers:</b> ${getSnippet(session.data.triggers)}<br>`;
        diagnosisReport += `<hr style="border-color:#334155; margin:8px 0;">`;

        if (hasCriticalFlags || (session.data.dept === 'Cardiology' && impactsDailyLife)) {
            diagnosisReport += `<span style="color:#ef4444; font-weight:900; font-size:13px;">🚨 TRIAGE: EMERGENCY EVALUATION REQUIRED</span><br><span style="font-size:12px; color:#cbd5e1;">The presence of critical signs (e.g., breathlessness, severe daily impact) requires immediate clinical intervention. Please proceed to an ER.</span>`;
        } else if (impactsDailyLife) {
            diagnosisReport += `<span style="color:#f59e0b; font-weight:900; font-size:13px;">⚠️ TRIAGE: URGENT CARE</span><br><span style="font-size:12px; color:#cbd5e1;">Your daily activities are being affected. Prompt physical examination is advised to prevent deterioration.</span>`;
        } else {
            diagnosisReport += `<span style="color:#10b981; font-weight:900; font-size:13px;">ℹ️ TRIAGE: ROUTINE CARE</span><br><span style="font-size:12px; color:#cbd5e1;">Symptoms appear stable. Monitor closely and consult a specialist for a definitive treatment plan.</span>`;
        }
        
        diagnosisReport += `<br><br><span style="color:#94a3b8; font-size:11px;"><b>AI DIFFERENTIAL:</b> Presentation aligns with potential <i>${differentials[session.data.dept]}</i>. A physical examination is required to rule out other pathology.</span>`;
        diagnosisReport += `</div>`;
        
        diagnosisReport += `<br><i>Would you like to book a consultation with our specialist to review this assessment?</i>`;
        
        delete activeChats[userId];
        
        return { reply: diagnosisReport, dept: session.data.dept, options: ["📅 Book Appointment", "🔄 Start Over"] };
    }
}

app.post('/api/ai-chat', authenticate, async (req, res) => {
    let { message } = req.body;
    if (!message) message = "start";
    const responseNode = await getDeepAIResponse(message, req.user.id);
    return res.json(responseNode);
});

async function aiTriageEngine(symptoms) {
    const deptMap = { "Head": "Neurology", "Chest": "Cardiology", "Stomach": "Gastroenterology", "Pain": "Orthopedics", "Fever": "General Medicine", "Skin": "Dermatology" };
    for(let key in deptMap) { if(symptoms.toLowerCase().includes(key.toLowerCase())) return deptMap[key]; }
    return "General Medicine";
}

// =======================================================

app.post('/api/upload-pdf', authenticate, upload.single('reportPdf'), (req, res) => {
    res.json({ score: 100, biomarkers: [{name: "Offline Check", val: "N/A", status: "Manual System Active", color: "blue"}], insights: ["Automated PDF scanning disabled."], diet: [] });
});

// AUTHENTICATION ROUTES
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

// APPOINTMENT ROUTES
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

// 🌟 ADMIN ROUTES
app.get('/api/admin/appointments', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({error: "Access Denied"});
    try { res.json((await pool.query(`SELECT * FROM appointments ORDER BY id DESC`)).rows); } 
    catch(e) { res.status(500).json({error: "Server Error"}); }
});

app.get('/api/admin/users', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({error: "Access Denied"});
    try { res.json((await pool.query(`SELECT id, name, email, role, specialization, fees, image_url FROM users ORDER BY id DESC`)).rows); } 
    catch(e) { res.status(500).json({error: "Server Error"}); }
});

app.post('/api/admin/add-doctor', authenticate, upload.single('doctorPhoto'), async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({error: "Access Denied"});
    try {
        const hash = await bcrypt.hash(req.body.password, 10);
        let imageUrl = "";
        if (req.file) { imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`; }
        await pool.query(
            `INSERT INTO users (name, email, password, role, specialization, qualification, experience, fees, about, image_url) VALUES ($1, $2, $3, 'doctor', $4, $5, $6, $7, $8, $9)`, 
            [req.body.name, req.body.email, hash, req.body.specialization, req.body.qualification, req.body.experience, req.body.fees, req.body.about, imageUrl]
        );
        res.status(201).json({ message: "Doctor added successfully!" });
    } catch (error) { res.status(400).json({ error: "Email already exists or invalid data!" }); }
});

app.delete('/api/admin/doctor/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({error: "Access Denied"});
    try {
        await pool.query(`DELETE FROM users WHERE id = $1 AND role = 'doctor'`, [req.params.id]);
        res.json({ message: "Doctor removed successfully" });
    } catch(e) { res.status(500).json({error: "Server Error"}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SmartCare Backend Live on Port ${PORT}!`));