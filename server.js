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
        const result = await pool.query(
            `SELECT id, name, email, role, specialization, image_url, experience, qualification, about, fees, created_at FROM users WHERE id = $1`, [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: "Server Error" }); }
});

// ==========================================
// 🧠 ULTRA-SMART NLP DIAGNOSIS ENGINE
// ==========================================

const activeChats = {}; 

// 🔥 Gibberish (Kachra Data) Detector Function
function isGibberish(text) {
    if (text.length < 3) return true; // Too short to be a real symptom
    if (/\d{4,}/.test(text)) return true; // Contains random long numbers like 34478578
    if (/(.)\1{3,}/i.test(text)) return true; // Repeating characters like 'yyyy' or 'hhhh'
    if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(text)) return true; // 5 consonants in a row like 'tjftrst'
    return false;
}

async function getDeepAIResponse(userMessage, userId) {
    const msg = userMessage.toLowerCase().trim();
    
    // 1. Initial State / Reset
    if (!activeChats[userId] || msg === 'start' || msg === '🔄 start over' || msg === 'hi' || msg === 'hello') {
        activeChats[userId] = { step: 'ASK_SYMPTOM', collectedDept: null };
        return { 
            reply: "Hello! I am SmartCare's Virtual Doctor. 👨‍⚕️<br><br>Let's do a proper checkup. Please describe your symptoms clearly in words. What exactly are you feeling right now?", 
            options: ["I have a severe headache", "My chest feels heavy", "My stomach hurts"] 
        };
    }

    let session = activeChats[userId];
    
    if (msg.includes('book') || msg.includes('appointment')) {
        delete activeChats[userId];
        return { reply: "Great! Let's get you connected with a specialist right away.", options: ["📅 Book Appointment"] };
    }

    // ==========================================
    // STEP 1: GATHER & VALIDATE INITIAL SYMPTOMS
    // ==========================================
    if (session.step === 'ASK_SYMPTOM') {
        
        // 🛡️ BLOCKER 1: Gibberish Logic
        if (isGibberish(msg)) {
            return { reply: "Hmm, that doesn't look like a valid symptom description to me. 🤔<br><br>Please type properly using normal words so I can understand and help you." };
        }
        
        const depts = {
            "Cardiology": ['chest', 'heart', 'palpitation', 'breath', 'jaw', 'arm', 'sweating', 'seene', 'dil', 'bp', 'pain', 'heavy', 'tight'],
            "Neurology": ['headache', 'dizzy', 'faint', 'numb', 'migraine', 'spin', 'head', 'seizure', 'sir', 'chakkar', 'vision', 'brain'],
            "Gastroenterology": ['stomach', 'belly', 'nausea', 'vomit', 'diarrhea', 'acid', 'pain', 'burn', 'pet', 'ulti', 'gas', 'digestion', 'food'],
            "Orthopedics": ['bone', 'joint', 'muscle', 'back', 'knee', 'fracture', 'sprain', 'ache', 'haddi', 'kamar', 'dard', 'neck', 'shoulder', 'leg'],
            "General Medicine": ['fever', 'cold', 'cough', 'weak', 'tired', 'chills', 'sick', 'throat', 'bukhar', 'khasi', 'infection', 'body', 'temperature']
        };

        let matchedDept = null;
        let maxMatches = 0;
        
        for (let [dept, kwList] of Object.entries(depts)) {
            let matches = kwList.filter(kw => msg.includes(kw)).length;
            if (matches > maxMatches) { maxMatches = matches; matchedDept = dept; }
        }
        
        // 🛡️ BLOCKER 2: No real medical keywords found (Blocks random valid words like 'ytuituttui')
        if (!matchedDept) {
            return { reply: "I didn't detect any specific medical symptoms in your message. 🧐<br><br>Could you please clarify which body part is affected or what exactly hurts? (e.g., 'My back hurts a lot' or 'I have a high fever')" };
        }
        
        session.collectedDept = matchedDept;
        session.step = 'ASK_DURATION_SEVERITY';
        
        return { 
            reply: `I understand. These symptoms usually indicate an issue related to <b>${matchedDept}</b>.<br><br>To help me analyze the risk properly, <b>how long have you been experiencing this</b>, and how <b>severe</b> is the pain?`,
            options: ["Just started today", "For a few days", "It's highly severe"]
        };
    }
    
    // ==========================================
    // STEP 2: ANALYZE DURATION/SEVERITY & CONCLUDE
    // ==========================================
    if (session.step === 'ASK_DURATION_SEVERITY') {
        
        // 🛡️ BLOCKER 3: Stop gibberish in Step 2
        if (isGibberish(msg)) {
            return { reply: "I couldn't process that. Please tell me in clear words: How many days has this been happening, or how severe is the pain?" };
        }

        const isSevere = ['severe', 'unbearable', 'extreme', 'blood', 'sudden', 'worst', 'emergency', 'tez', 'buhut', 'high', 'lot', 'very'].some(w => msg.includes(w));
        const isLong = ['days', 'weeks', 'month', 'din', 'purana', 'lamba', 'long', 'time'].some(w => msg.includes(w));
        
        let replyText = `<b>🩺 Comprehensive AI Analysis:</b><br>Suggested Department: <b>${session.collectedDept}</b><br><br>`;
        
        if (isSevere || session.collectedDept === 'Cardiology') {
            replyText += `<span style="color:#ef4444; font-weight:900; font-size:14px;">🚨 HIGH RISK DETECTED</span><br>Because your symptoms sound severe (or related to heart health), this could be a medical emergency. Do not wait or rely on home remedies. Please visit an Emergency Room (ER) immediately.`;
        } else if (isLong) {
            replyText += `💡 <b>Assessment:</b> Since this has been persisting for a while, it may be turning into a chronic condition. Please do not ignore it. It is highly advised to book a proper medical checkup.`;
        } else {
            replyText += `💡 <b>Assessment:</b> This appears to be an acute (recent) issue. Take proper rest, stay hydrated, and monitor your symptoms closely. If they worsen, consult a specialist.`;
        }
        
        replyText += `<br><br><i>Would you like to connect with one of our top specialists now?</i>`;
        
        delete activeChats[userId];
        
        return { reply: replyText, dept: session.collectedDept, options: ["📅 Book Appointment", "🔄 Start Over"] };
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

// ==========================================

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