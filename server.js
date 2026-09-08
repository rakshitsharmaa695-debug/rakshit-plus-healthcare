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
    if (!token) return res.status(401).json({ error: "Access Denied. Please Login." });
    try { req.user = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET); next(); } 
    catch (err) { return res.status(401).json({ error: "Session expired. Please Login again." }); }
};

const upload = multer({ storage: multer.memoryStorage() }); 

// 🧠 ULTIMATE DEEP DIAGNOSIS TREE (Bilingual & Multi-level)
const symptomTree = {
    "start": {
        msg: "Welcome to RakshitPlus AI. I am your virtual doctor. 👨‍⚕️<br><br>Please choose your language / Apni bhasha chunein:",
        options: ["🇬🇧 English", "🇮🇳 Hindi / Hinglish"]
    },

    // ================= ENGLISH BRANCH =================
    "🇬🇧 English": { msg: "Where are you experiencing discomfort?", options: ["🤕 Head", "🫀 Chest", "🍕 Stomach", "🤒 Fever"] },
    
    // --- HEAD ---
    "🤕 Head": { msg: "Can you describe the headache?", options: ["Throbbing (Like a heartbeat)", "Sharp pain / Tight band"] },
    "Throbbing (Like a heartbeat)": { msg: "How long have you had this throbbing pain?", options: ["Just started today", "For a few days now"] },
    "Sharp pain / Tight band": { msg: "How long have you had this sharp/tight pain?", options: ["Just started today", "For a few days now"] },
    
    "Just started today": {
        msg: "<b>🩺 Detailed Analysis:</b> This appears to be a budding Migraine or a Dehydration headache. It is common but manageable.<br><br><b>⚠️ Causes:</b> Lack of water, poor sleep, or excessive screen time.<br><b>💡 Immediate Relief:</b> Drink 2 glasses of water, dim the lights, and rest for 30 minutes away from screens.<br><b>🚨 Red Flags:</b> If you experience blurred vision or vomiting, consult a doctor immediately.",
        dept: "Neurology", options: ["🔄 Start Over"]
    },
    "For a few days now": {
        msg: "<b>🩺 Detailed Analysis:</b> Experiencing this pain for days indicates a persistent Tension Headache or Chronic Migraine.<br><br><b>⚠️ Causes:</b> High stress, chronic sleep deprivation, or blood pressure issues.<br><b>💡 Immediate Relief:</b> Apply a cold/warm compress to your forehead and neck. Consider a mild pain reliever after eating.<br><b>🚨 Red Flags:</b> Sudden numbness, slurred speech, or unendurable pain require immediate emergency care.",
        dept: "Neurology", options: ["🔄 Start Over"]
    },

    // --- CHEST ---
    "🫀 Chest": { msg: "Chest issues need careful attention. What exactly are you feeling?", options: ["Heavy tightness / Pressure", "Burning sensation (Heartburn)"] },
    "Heavy tightness / Pressure": { msg: "Does the pain spread anywhere else?", options: ["Radiates to Left Arm / Jaw", "Stays in the center"] },
    
    "Radiates to Left Arm / Jaw": {
        msg: "<b>🩺 Detailed Analysis:</b> This is a highly critical symptom pattern. Pain radiating to the left arm or jaw is a classic sign of Cardiac Distress (Angina or Heart Attack).<br><br><b>⚠️ Causes:</b> Blocked arteries or severe cardiac stress.<br><b>🚨 IMMEDIATE ACTION:</b> Do not wait. Chew an Aspirin (if not allergic) and go to the nearest Emergency Room (ER) immediately.",
        dept: "Cardiology", options: ["🔄 Start Over"]
    },
    "Stays in the center": {
        msg: "<b>🩺 Detailed Analysis:</b> Central chest pressure could be early Angina, severe Muscular spasm, or panic/anxiety attack.<br><br><b>⚠️ Causes:</b> Heavy lifting, high stress, or underlying heart conditions.<br><b>💡 Immediate Relief:</b> Sit down, loosen your clothes, and take slow, deep breaths.<br><b>🚨 Red Flags:</b> If it lasts more than 15 minutes or causes sweating/dizziness, rush to the hospital.",
        dept: "Cardiology", options: ["🔄 Start Over"]
    },
    "Burning sensation (Heartburn)": {
        msg: "<b>🩺 Detailed Analysis:</b> This sounds like severe Acid Reflux (GERD). Stomach acid is pushing up into your esophagus, mimicking chest pain.<br><br><b>⚠️ Causes:</b> Spicy food, eating too late at night, or empty stomach.<br><b>💡 Immediate Relief:</b> Drink a glass of cold milk or take an antacid. Sit upright (do not lie down).<br><b>🚨 Red Flags:</b> If antacids don't work and pain increases with breathing, consult a doctor.",
        dept: "Gastroenterology", options: ["🔄 Start Over"]
    },

    // --- STOMACH ---
    "🍕 Stomach": { msg: "What is your primary stomach issue?", options: ["Severe Cramps / Pain", "Nausea, Vomiting & Diarrhea"] },
    "Severe Cramps / Pain": { msg: "Where exactly is the pain located?", options: ["Lower Right Side", "Upper / Central Stomach"] },
    
    "Lower Right Side": {
        msg: "<b>🩺 Detailed Analysis:</b> Sharp pain in the lower right abdomen is highly suspicious for Appendicitis.<br><br><b>⚠️ Causes:</b> Inflammation or infection of the appendix.<br><b>💡 Immediate Relief:</b> Do NOT eat or drink anything right now, and avoid painkillers as they may hide symptoms.<br><b>🚨 Red Flags:</b> If the pain is unbearable or accompanied by fever, rush to the ER for an ultrasound.",
        dept: "Gastroenterology", options: ["🔄 Start Over"]
    },
    "Upper / Central Stomach": {
        msg: "<b>🩺 Detailed Analysis:</b> This indicates Gastritis, Peptic Ulcers, or Indigestion.<br><br><b>⚠️ Causes:</b> High acid levels, bacterial infection (H. Pylori), or spicy food.<br><b>💡 Immediate Relief:</b> Drink warm water, eat something very light (like plain rice or toast), and rest.<br><b>🚨 Red Flags:</b> Black stool or vomiting blood requires immediate emergency care.",
        dept: "Gastroenterology", options: ["🔄 Start Over"]
    },
    "Nausea, Vomiting & Diarrhea": {
        msg: "<b>🩺 Detailed Analysis:</b> This is a classic case of Gastroenteritis (Food Poisoning or Stomach Bug).<br><br><b>⚠️ Causes:</b> Consuming contaminated food or water.<br><b>💡 Immediate Relief:</b> The biggest risk is dehydration. Sip on ORS (Oral Rehydration Solution) or electrolyte water continuously.<br><b>🚨 Red Flags:</b> If you cannot keep fluids down for 12 hours or feel extremely weak, get an IV drip.",
        dept: "General Medicine", options: ["🔄 Start Over"]
    },

    // --- FEVER ---
    "🤒 Fever": { msg: "What is your temperature like?", options: ["Around 100°F (Mild) with Chills", "Over 102°F (High) with Body Ache"] },
    "Around 100°F (Mild) with Chills": {
        msg: "<b>🩺 Detailed Analysis:</b> A mild fever with chills usually points to a common Viral Infection or Seasonal Cold.<br><br><b>⚠️ Causes:</b> Exposure to viruses or changing weather.<br><b>💡 Immediate Relief:</b> Get plenty of rest, stay warm, and drink warm fluids (like herbal tea or soup).<br><b>🚨 Red Flags:</b> If it persists beyond 3 days or you develop a severe cough, see a doctor.",
        dept: "General Medicine", options: ["🔄 Start Over"]
    },
    "Over 102°F (High) with Body Ache": {
        msg: "<b>🩺 Detailed Analysis:</b> High fever accompanied by severe muscle/joint pain is a strong indicator of Dengue, Malaria, or severe Typhoid.<br><br><b>⚠️ Causes:</b> Mosquito-borne viruses or severe bacterial infections.<br><b>💡 Immediate Relief:</b> Use a cold, wet cloth on the forehead to bring the temperature down. Take Paracetamol (if previously prescribed).<br><b>🚨 Red Flags:</b> DO NOT take Ibuprofen or Aspirin without a doctor's advice (can be dangerous in Dengue). Get a blood test ASAP.",
        dept: "General Medicine", options: ["🔄 Start Over"]
    },


    // ================= HINGLISH BRANCH =================
    "🇮🇳 Hindi / Hinglish": { msg: "Aapko kis hisse mein pareshani mehsoos ho rahi hai?", options: ["🤕 Sir (Head)", "🫀 Chaati (Chest)", "🍕 Pet (Stomach)", "🤒 Bukhar (Fever)"] },
    
    // --- HEAD (Hindi) ---
    "🤕 Sir (Head)": { msg: "Sir ka dard kaisa mehsoos ho raha hai?", options: ["Dhak-dhak wala tez dard", "Chakkar aana (Spinning)"] },
    "Dhak-dhak wala tez dard": { msg: "Yeh dard kab se ho raha hai?", options: ["Aaj hi shuru hua", "Kuch dino se hai"] },
    
    "Aaj hi shuru hua": {
        msg: "<b>🩺 Detailed Analysis:</b> Yeh shuruaati Migraine ya paani ki kami (Dehydration) ka dard lag raha hai.<br><br><b>⚠️ Causes:</b> Kam paani peena, neend poori na hona ya screen par zyada time bitana.<br><b>💡 Immediate Relief:</b> 2 glass paani piyein, light band karke shant kamre mein 30 minute aaram karein.<br><b>🚨 Red Flags:</b> Agar aankhon ke aage dhundla dikhe ya ulti (vomiting) aaye, toh turant doctor ko dikhayein.",
        dept: "Neurology", options: ["🔄 Naya Checkup"]
    },
    "Kuch dino se hai": {
        msg: "<b>🩺 Detailed Analysis:</b> Lagaatar dard rehna Chronic Tension Headache ya Migraine ka sanket hai.<br><br><b>⚠️ Causes:</b> Bahut zyada stress, Blood pressure ki dikkat, ya lagaatar neend na aana.<br><b>💡 Immediate Relief:</b> Maathe (forehead) par halka thanda ya garam kapda rakhein aur thoda aaram karein.<br><b>🚨 Red Flags:</b> Agar bolne mein dikkat ho ya dard bardaasht ke bahar ho, toh turant Emergency mein jaayein.",
        dept: "Neurology", options: ["🔄 Naya Checkup"]
    },

    // --- CHEST (Hindi) ---
    "🫀 Chaati (Chest)": { msg: "Chaati mein exactly kya ho raha hai?", options: ["Bhaari-pan aur Jakdan (Pressure)", "Seene mein Jalan (Heartburn)"] },
    "Bhaari-pan aur Jakdan (Pressure)": { msg: "Kya yeh dard kahin aur bhi fail raha hai?", options: ["Bayein (Left) haath ya jabde mein", "Sirf beecho-beech hai"] },
    
    "Bayein (Left) haath ya jabde mein": {
        msg: "<b>🩺 Detailed Analysis:</b> Yeh ek bahut hi SERIOUS lakshan hai. Agar chaati ka dard left haath ya jabde (jaw) tak jaaye, toh yeh Heart Attack (Angina) ho sakta hai.<br><br><b>⚠️ Causes:</b> Heart ki nasso (arteries) mein blockage ya dabaav.<br><b>🚨 IMMEDIATE ACTION:</b> Bilkul intezaar na karein. Turant kisi ko bulayein aur nazdeeki Hospital (Emergency Room) mein jaayein.",
        dept: "Cardiology", options: ["🔄 Naya Checkup"]
    },
    "Sirf beecho-beech hai": {
        msg: "<b>🩺 Detailed Analysis:</b> Yeh early angina, gas ka dabaav ya panic/anxiety attack ho sakta hai.<br><br><b>⚠️ Causes:</b> Bhari saaman uthana, bahut stress, ya heart ki koi pehle ki condition.<br><b>💡 Immediate Relief:</b> Araam se baith jayein, apne kapde halke dheele karein aur lambi saansein lein.<br><b>🚨 Red Flags:</b> Agar paseena aaye ya chakkar aaye, toh turant doctor ke paas bhagein.",
        dept: "Cardiology", options: ["🔄 Naya Checkup"]
    },
    "Seene mein Jalan (Heartburn)": {
        msg: "<b>🩺 Detailed Analysis:</b> Yeh severe Acid Reflux (Acidity/GERD) hai. Pet ka acid upar aakar chaati mein jalan paida kar raha hai.<br><br><b>⚠️ Causes:</b> Bahut masaledar khana, khaali pet rehna, ya raat ko late khana.<br><b>💡 Immediate Relief:</b> Thanda doodh piyein ya koi antacid (Digene/Eno) lein. Lete nahi, seedhe baithe rahein.<br><b>🚨 Red Flags:</b> Agar dawai se bhi aaram na mile aur saans lene mein takleef ho, toh doctor ko dikhayein.",
        dept: "Gastroenterology", options: ["🔄 Naya Checkup"]
    },

    // --- STOMACH (Hindi) ---
    "🍕 Pet (Stomach)": { msg: "Pet mein kya dikkat aa rahi hai?", options: ["Tez Dard ya Marod (Cramps)", "Ulti aur Dast (Vomiting/Loose Motions)"] },
    "Tez Dard ya Marod (Cramps)": { msg: "Dard pet ke kis hisse mein hai?", options: ["Neeche Right side mein", "Upar ya beecho-beech"] },
    
    "Neeche Right side mein": {
        msg: "<b>🩺 Detailed Analysis:</b> Pet ke neeche right side mein tez dard Appendix ke infection ka lakshan hota hai.<br><br><b>⚠️ Causes:</b> Appendix mein sujan (inflammation).<br><b>💡 Immediate Relief:</b> Abhi kuch bhi khayein piyein NAHI aur na hi dard ki dawa khud se lein (warna asli dard chhip jayega).<br><b>🚨 Red Flags:</b> Agar dard bardaasht na ho aur bukhar bhi aa jaye, turant Ultrasound ke liye aspatal jayein.",
        dept: "Gastroenterology", options: ["🔄 Naya Checkup"]
    },
    "Upar ya beecho-beech": {
        msg: "<b>🩺 Detailed Analysis:</b> Yeh Gastritis, Ulcer ya gas ka dard ho sakta hai.<br><br><b>⚠️ Causes:</b> Khali pet rehna, acid zyada banna ya galat khana.<br><b>💡 Immediate Relief:</b> Gunguna paani piyein, sirf halka khana (khichdi/daliya) khayein.<br><b>🚨 Red Flags:</b> Agar potty mein khoon aaye ya dard ki wajah se paseene chootein, toh Emergency mein dikhayein.",
        dept: "Gastroenterology", options: ["🔄 Naya Checkup"]
    },
    "Ulti aur Dast (Vomiting/Loose Motions)": {
        msg: "<b>🩺 Detailed Analysis:</b> Yeh Food Poisoning ya pet ka viral infection (Gastroenteritis) hai.<br><br><b>⚠️ Causes:</b> Kharab khana ya ganda paani peena.<br><b>💡 Immediate Relief:</b> Body ka paani kam nahi hona chahiye. Thodi-thodi der mein ORS ka ghol ya Nimbu paani peete rahein.<br><b>🚨 Red Flags:</b> Agar 12 ghante baad bhi paani na pache aur chakkar aane lagein, toh Glucose (IV Drip) chadwane ke liye hospital jayein.",
        dept: "General Medicine", options: ["🔄 Naya Checkup"]
    },

    // --- FEVER (Hindi) ---
    "🤒 Bukhar (Fever)": { msg: "Bukhar kitna tez hai?", options: ["100°F ke aas-paas aur sardi", "102°F se upar aur badan dard"] },
    "100°F ke aas-paas aur sardi": {
        msg: "<b>🩺 Detailed Analysis:</b> Halka bukhar aur sardi (chills) normal Viral Fever ya mausam badalne ka asar hai.<br><br><b>⚠️ Causes:</b> Viral infection ya sardi lagna.<br><b>💡 Immediate Relief:</b> Kapde pehan kar aaram karein, garam soop ya haldi wala doodh piyein.<br><b>🚨 Red Flags:</b> Agar bukhar 3 din se zyada rahe ya khansi rukne ka naam na le, toh doctor se milein.",
        dept: "General Medicine", options: ["🔄 Naya Checkup"]
    },
    "102°F se upar aur badan dard": {
        msg: "<b>🩺 Detailed Analysis:</b> Itna tez bukhar aur jodon/badan mein hadd-tod dard Dengue, Malaria ya Typhoid ka sabse bada lakshan hai.<br><br><b>⚠️ Causes:</b> Machhar ke kaatne (Mosquito bite) ya infection se.<br><b>💡 Immediate Relief:</b> Bukhar kam karne ke liye maathe par thande paani ki patti rakhein. Paracetamol le sakte hain.<br><b>🚨 Red Flags:</b> Bina Blood Test karwaye Ibuprofen ya Aspirin bilkul NA khayein (Dengue mein yeh jaanleva ho sakti hain). Turant checkup karwayein.",
        dept: "General Medicine", options: ["🔄 Naya Checkup"]
    },

    // ================= RESTART LOGIC =================
    "🔄 Start Over": { msg: "Let's start over. Please choose your language:", options: ["🇬🇧 English", "🇮🇳 Hindi / Hinglish"] },
    "🔄 Naya Checkup": { msg: "Chaliye dobara shuru karte hain. Apni bhasha chunein:", options: ["🇬🇧 English", "🇮🇳 Hindi / Hinglish"] }
};

// 🤖 🌟 SECURE & DEEP CHAT ENGINE
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