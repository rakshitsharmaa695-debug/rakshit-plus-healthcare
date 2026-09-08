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

// 🧠 ULTIMATE DEEP DIAGNOSIS TREE
const symptomTree = {
    "start": { msg: "Welcome to RakshitPlus AI. I am your virtual doctor. 👨‍⚕️<br><br>Please choose your language / Apni bhasha chunein:", options: ["🇬🇧 English", "🇮🇳 Hindi / Hinglish"] },
    
    "🇬🇧 English": { msg: "Where are you experiencing discomfort?", options: ["🤕 Head", "🫀 Chest", "🍕 Stomach", "🤒 Fever"] },
    "🤕 Head": { msg: "Can you describe the headache?", options: ["Throbbing (Like a heartbeat)", "Sharp pain / Tight band"] },
    "Throbbing (Like a heartbeat)": { msg: "How long have you had this throbbing pain?", options: ["Just started today", "For a few days now"] },
    "Sharp pain / Tight band": { msg: "How long have you had this sharp/tight pain?", options: ["Just started today", "For a few days now"] },
    "Just started today": { msg: "<b>🩺 Detailed Analysis:</b> This appears to be a budding Migraine or a Dehydration headache.<br><br><b>💡 Immediate Relief:</b> Drink 2 glasses of water, dim the lights, and rest for 30 minutes.", dept: "Neurology", options: ["🔄 Start Over"] },
    "For a few days now": { msg: "<b>🩺 Detailed Analysis:</b> Experiencing this pain for days indicates a persistent Tension Headache or Chronic Migraine.<br><br><b>💡 Immediate Relief:</b> Apply a cold compress to your forehead.", dept: "Neurology", options: ["🔄 Start Over"] },
    "🫀 Chest": { msg: "What exactly are you feeling?", options: ["Heavy tightness / Pressure", "Burning sensation (Heartburn)"] },
    "Heavy tightness / Pressure": { msg: "Does the pain spread anywhere else?", options: ["Radiates to Left Arm / Jaw", "Stays in the center"] },
    "Radiates to Left Arm / Jaw": { msg: "<b>🩺 Detailed Analysis:</b> Pain radiating to the left arm or jaw is a classic sign of Cardiac Distress (Angina/Heart Attack).<br><br><b>🚨 IMMEDIATE ACTION:</b> Go to the nearest Emergency Room (ER) immediately.", dept: "Cardiology", options: ["🔄 Start Over"] },
    "Stays in the center": { msg: "<b>🩺 Detailed Analysis:</b> Central chest pressure could be early Angina or panic/anxiety attack.<br><br><b>💡 Immediate Relief:</b> Sit down, loosen your clothes, and take slow, deep breaths.", dept: "Cardiology", options: ["🔄 Start Over"] },
    "Burning sensation (Heartburn)": { msg: "<b>🩺 Detailed Analysis:</b> This sounds like severe Acid Reflux (GERD).<br><br><b>💡 Immediate Relief:</b> Drink a glass of cold milk or take an antacid. Sit upright.", dept: "Gastroenterology", options: ["🔄 Start Over"] },
    "🍕 Stomach": { msg: "What is your primary stomach issue?", options: ["Severe Cramps / Pain", "Nausea, Vomiting & Diarrhea"] },
    "Severe Cramps / Pain": { msg: "Where exactly is the pain located?", options: ["Lower Right Side", "Upper / Central Stomach"] },
    "Lower Right Side": { msg: "<b>🩺 Detailed Analysis:</b> Sharp pain in the lower right abdomen is highly suspicious for Appendicitis.<br><br><b>🚨 Red Flags:</b> If the pain is unbearable, rush to the ER.", dept: "Gastroenterology", options: ["🔄 Start Over"] },
    "Upper / Central Stomach": { msg: "<b>🩺 Detailed Analysis:</b> This indicates Gastritis or Peptic Ulcers.<br><br><b>💡 Immediate Relief:</b> Drink warm water and eat something very light.", dept: "Gastroenterology", options: ["🔄 Start Over"] },
    "Nausea, Vomiting & Diarrhea": { msg: "<b>🩺 Detailed Analysis:</b> This is a classic case of Gastroenteritis (Food Poisoning).<br><br><b>💡 Immediate Relief:</b> Sip on ORS (Oral Rehydration Solution) continuously.", dept: "General Medicine", options: ["🔄 Start Over"] },
    "🤒 Fever": { msg: "What is your temperature like?", options: ["Around 100°F (Mild) with Chills", "Over 102°F (High) with Body Ache"] },
    "Around 100°F (Mild) with Chills": { msg: "<b>🩺 Detailed Analysis:</b> A mild fever with chills usually points to a common Viral Infection.<br><br><b>💡 Immediate Relief:</b> Get plenty of rest and stay warm.", dept: "General Medicine", options: ["🔄 Start Over"] },
    "Over 102°F (High) with Body Ache": { msg: "<b>🩺 Detailed Analysis:</b> High fever accompanied by severe muscle pain indicates Dengue or Typhoid.<br><br><b>🚨 Red Flags:</b> DO NOT take Ibuprofen without a doctor's advice. Get a blood test ASAP.", dept: "General Medicine", options: ["🔄 Start Over"] },

    "🇮🇳 Hindi / Hinglish": { msg: "Aapko kis hisse mein pareshani mehsoos ho rahi hai?", options: ["🤕 Sir (Head)", "🫀 Chaati (Chest)", "🍕 Pet (Stomach)", "🤒 Bukhar (Fever)"] },
    "🤕 Sir (Head)": { msg: "Sir ka dard kaisa mehsoos ho raha hai?", options: ["Dhak-dhak wala tez dard", "Chakkar aana (Spinning)"] },
    "Dhak-dhak wala tez dard": { msg: "Yeh dard kab se ho raha hai?", options: ["Aaj hi shuru hua", "Kuch dino se hai"] },
    "Aaj hi shuru hua": { msg: "<b>🩺 Detailed Analysis:</b> Yeh shuruaati Migraine ya paani ki kami (Dehydration) lag raha hai.<br><br><b>💡 Immediate Relief:</b> 2 glass paani piyein aur shant kamre mein aaram karein.", dept: "Neurology", options: ["🔄 Naya Checkup"] },
    "Kuch dino se hai": { msg: "<b>🩺 Detailed Analysis:</b> Lagaatar dard rehna Chronic Tension Headache hai.<br><br><b>💡 Immediate Relief:</b> Maathe par halka thanda kapda rakhein aur thoda aaram karein.", dept: "Neurology", options: ["🔄 Naya Checkup"] },
    "Chakkar aana (Spinning)": { msg: "<b>🩺 Detailed Analysis:</b> Yeh Vertigo (chakkar) ya Low BP ki wajah se ho sakta hai.<br><br><b>💡 Immediate Relief:</b> Turant baith jayein ya let jayein taaki aap girein nahi.", dept: "Neurology", options: ["🔄 Naya Checkup"] },
    "🫀 Chaati (Chest)": { msg: "Chaati mein exactly kya ho raha hai?", options: ["Bhaari-pan aur Jakdan (Pressure)", "Seene mein Jalan (Heartburn)"] },
    "Bhaari-pan aur Jakdan (Pressure)": { msg: "Kya yeh dard kahin aur bhi fail raha hai?", options: ["Bayein (Left) haath ya jabde mein", "Sirf beecho-beech hai"] },
    "Bayein (Left) haath ya jabde mein": { msg: "<b>🩺 Detailed Analysis:</b> Agar chaati ka dard left haath tak jaaye, toh yeh Heart Attack (Angina) ho sakta hai.<br><br><b>🚨 IMMEDIATE ACTION:</b> Turant kisi ko bulayein aur Hospital (Emergency Room) mein jaayein.", dept: "Cardiology", options: ["🔄 Naya Checkup"] },
    "Sirf beecho-beech hai": { msg: "<b>🩺 Detailed Analysis:</b> Yeh early angina ya gas ka dabaav ho sakta hai.<br><br><b>💡 Immediate Relief:</b> Araam se baith jayein aur lambi saansein lein.", dept: "Cardiology", options: ["🔄 Naya Checkup"] },
    "Seene mein Jalan (Heartburn)": { msg: "<b>🩺 Detailed Analysis:</b> Yeh severe Acid Reflux (Acidity) hai.<br><br><b>💡 Immediate Relief:</b> Thanda doodh piyein ya koi antacid lein. Lete nahi, seedhe baithe rahein.", dept: "Gastroenterology", options: ["🔄 Naya Checkup"] },
    "🍕 Pet (Stomach)": { msg: "Pet mein kya dikkat aa rahi hai?", options: ["Tez Dard ya Marod (Cramps)", "Ulti aur Dast (Vomiting/Loose Motions)"] },
    "Tez Dard ya Marod (Cramps)": { msg: "Dard pet ke kis hisse mein hai?", options: ["Neeche Right side mein", "Upar ya beecho-beech"] },
    "Neeche Right side mein": { msg: "<b>🩺 Detailed Analysis:</b> Pet ke neeche right side mein tez dard Appendix ka lakshan hota hai.<br><br><b>🚨 Red Flags:</b> Agar dard bardaasht na ho, turant Ultrasound karwayein.", dept: "Gastroenterology", options: ["🔄 Naya Checkup"] },
    "Upar ya beecho-beech": { msg: "<b>🩺 Detailed Analysis:</b> Yeh Gastritis, Ulcer ya gas ka dard ho sakta hai.<br><br><b>💡 Immediate Relief:</b> Gunguna paani piyein aur halka khana khayein.", dept: "Gastroenterology", options: ["🔄 Naya Checkup"] },
    "Ulti aur Dast (Vomiting/Loose Motions)": { msg: "<b>🩺 Detailed Analysis:</b> Yeh Food Poisoning ya viral infection hai.<br><br><b>💡 Immediate Relief:</b> ORS ka ghol ya Nimbu paani peete rahein taaki paani ki kami na ho.", dept: "General Medicine", options: ["🔄 Naya Checkup"] },
    "🤒 Bukhar (Fever)": { msg: "Bukhar kitna tez hai?", options: ["100°F ke aas-paas aur sardi", "102°F se upar aur badan dard"] },
    "100°F ke aas-paas aur sardi": { msg: "<b>🩺 Detailed Analysis:</b> Halka bukhar aur sardi normal Viral Fever hai.<br><br><b>💡 Immediate Relief:</b> Kapde pehan kar aaram karein aur garam soop piyein.", dept: "General Medicine", options: ["🔄 Naya Checkup"] },
    "102°F se upar aur badan dard": { msg: "<b>🩺 Detailed Analysis:</b> Itna tez bukhar aur jodon mein dard Dengue ya Malaria ka lakshan hai.<br><br><b>🚨 Red Flags:</b> Bina Blood Test karwaye Ibuprofen bilkul NA khayein.", dept: "General Medicine", options: ["🔄 Naya Checkup"] },

    "🔄 Start Over": { msg: "Let's start over. Please choose your language:", options: ["🇬🇧 English", "🇮🇳 Hindi / Hinglish"] },
    "🔄 Naya Checkup": { msg: "Chaliye dobara shuru karte hain. Apni bhasha chunein:", options: ["🇬🇧 English", "🇮🇳 Hindi / Hinglish"] }
};

app.post('/api/ai-chat', authenticate, (req, res) => {
    let { message } = req.body;
    if (!message || !symptomTree[message]) message = "start";
    const responseNode = symptomTree[message];
    return res.json({ reply: responseNode.msg, options: responseNode.options || [], department: responseNode.dept || null });
});

async function aiTriageEngine(symptoms) {
    const deptMap = { "Head": "Neurology", "Chest": "Cardiology", "Stomach": "Gastroenterology", "Pain": "Orthopedics", "Fever": "General Medicine", "Skin": "Dermatology" };
    for(let key in deptMap) { if(symptoms.toLowerCase().includes(key.toLowerCase())) return deptMap[key]; }
    return "General Medicine";
}

app.post('/api/upload-pdf', authenticate, upload.single('reportPdf'), (req, res) => {
    res.json({ score: 100, biomarkers: [{name: "Offline Check", val: "N/A", status: "Manual System Active", color: "blue"}], insights: ["Automated PDF scanning disabled."], diet: [] });
});

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

// 🌟 ADMIN ROUTES (CREATE, READ, DELETE)
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
        if (req.file) {
            imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }
        await pool.query(
            `INSERT INTO users (name, email, password, role, specialization, qualification, experience, fees, about, image_url) 
             VALUES ($1, $2, $3, 'doctor', $4, $5, $6, $7, $8, $9)`, 
            [req.body.name, req.body.email, hash, req.body.specialization, req.body.qualification, req.body.experience, req.body.fees, req.body.about, imageUrl]
        );
        res.status(201).json({ message: "Doctor added successfully!" });
    } catch (error) { res.status(400).json({ error: "Email already exists or invalid data!" }); }
});

// 🌟 NEW: DELETE DOCTOR ROUTE
app.delete('/api/admin/doctor/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({error: "Access Denied"});
    try {
        await pool.query(`DELETE FROM users WHERE id = $1 AND role = 'doctor'`, [req.params.id]);
        res.json({ message: "Doctor removed successfully" });
    } catch(e) { res.status(500).json({error: "Server Error"}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RakshitPlus Backend Live on Port ${PORT}!`));