const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const app = express();
app.use(express.static(__dirname));
app.use(express.json());

const JWT_SECRET = "RakshitPlus_Enterprise_Secret";

// 🗄️ Database Setup
const db = new sqlite3.Database('./rakshitplus.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'patient', specialization TEXT, image_url TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER, doctor_id INTEGER, symptoms TEXT, department TEXT, appointment_date TEXT, status TEXT DEFAULT 'Pending')`);
    db.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, message TEXT, status TEXT DEFAULT 'Unread')`);

    bcrypt.hash('admin123', 10, (err, hash) => {
        db.run(`INSERT OR IGNORE INTO users (name, email, password, role) VALUES ('System Admin', 'admin@rakshitplus.com', ?, 'admin')`, [hash]);
    });
});

// 🛡️ Middleware
const authenticate = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ error: "Access Denied." });
    try {
        req.user = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET);
        next();
    } catch (err) { res.status(400).json({ error: "Invalid Token." }); }
};

const upload = multer({ storage: multer.memoryStorage() }); // Process PDF in RAM (Fast & Cloud-safe)

function triageEngine(symptoms) {
    const text = symptoms.toLowerCase();
    if (text.includes('chest') || text.includes('heart')) return "Cardiology";
    if (text.includes('bone') || text.includes('fracture')) return "Orthopedics";
    if (text.includes('brain') || text.includes('headache')) return "Neurology";
    return "General Medicine";
}

// 🧠 Core AI Biomarker Logic (Used by both Text & PDF)
function processLabReport(rawText) {
    const text = rawText.toLowerCase();
    let score = 100;
    let biomarkers = [];
    let insights = [];
    let diet = [];

    // 1. Check Sugar
    if (text.includes('sugar') || text.includes('glucose')) {
        const match = text.match(/(?:sugar|glucose).*?(\d{2,3})/);
        if (match && match[1]) {
            const val = parseInt(match[1]);
            if (val > 140) { biomarkers.push({ name: 'Blood Sugar', val: val + ' mg/dL', status: 'High', color: 'red', width: '85%' }); score -= 15; insights.push("Elevated blood sugar detected."); diet.push("Avoid refined carbs and sugar."); } 
            else if (val < 70) { biomarkers.push({ name: 'Blood Sugar', val: val + ' mg/dL', status: 'Low', color: 'orange', width: '20%' }); score -= 10; insights.push("Low blood sugar detected."); } 
            else { biomarkers.push({ name: 'Blood Sugar', val: val + ' mg/dL', status: 'Normal', color: 'green', width: '50%' }); }
        }
    }

    // 2. Check Hemoglobin
    if (text.includes('hemoglobin') || text.includes('hb')) {
        const match = text.match(/(?:hemoglobin|hb).*?(\d{1,2}(?:\.\d)?)/);
        if (match && match[1]) {
            const val = parseFloat(match[1]);
            if (val < 12) { biomarkers.push({ name: 'Hemoglobin', val: val + ' g/dL', status: 'Low', color: 'orange', width: '30%' }); score -= 15; insights.push("Low hemoglobin indicates possible Anemia."); diet.push("Increase iron-rich foods like Spinach and Beetroot."); } 
            else { biomarkers.push({ name: 'Hemoglobin', val: val + ' g/dL', status: 'Normal', color: 'green', width: '60%' }); }
        }
    }

    // 3. Check Cholesterol
    if (text.includes('cholesterol') || text.includes('lipid')) {
        const match = text.match(/(?:cholesterol|lipid).*?(\d{3})/);
        if (match && match[1]) {
            const val = parseInt(match[1]);
            if (val > 200) { biomarkers.push({ name: 'Cholesterol', val: val + ' mg/dL', status: 'High', color: 'red', width: '90%' }); score -= 20; insights.push("High cholesterol levels."); diet.push("Reduce saturated fats. Add walnuts and almonds."); } 
            else { biomarkers.push({ name: 'Cholesterol', val: val + ' mg/dL', status: 'Normal', color: 'green', width: '45%' }); }
        }
    }

    if (biomarkers.length === 0) {
        if (text.includes('positive') || text.includes('infection')) { score -= 30; insights.push("Medical terms indicating active infection detected."); diet.push("Stay highly hydrated. Consume Vitamin C."); } 
        else { insights.push("No critical numeric anomalies detected."); diet.push("Maintain a balanced diet and regular exercise."); }
    }

    return { score: Math.max(10, Math.min(100, score)), biomarkers, insights, diet };
}

// --- Auth & Admin APIs ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const hash = await bcrypt.hash(req.body.password, 10);
        db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`, [req.body.name, req.body.email, hash], function(err) {
            if (err) return res.status(400).json({ error: "Email exists!" });
            res.status(201).json({ message: "Registered!" });
        });
    } catch (error) { res.status(500).json({ error: "Server Error" }); }
});

app.post('/api/auth/login', (req, res) => {
    try {
        db.get(`SELECT * FROM users WHERE email = ?`, [req.body.email], async (err, user) => {
            if (err) return res.status(500).json({ error: "Database error." });
            if (!user) return res.status(400).json({ error: "Account not found." });
            const isMatch = await bcrypt.compare(req.body.password, user.password);
            if (!isMatch) return res.status(400).json({ error: "Incorrect password." });
            res.json({ token: jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' }), role: user.role });
        });
    } catch (error) { res.status(500).json({ error: "Server crashed." }); }
});

app.get('/api/admin/stats', authenticate, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({error: "Admin Only"});
    let stats = { patients: 0, doctors: 0, appointments: 0 };
    db.get("SELECT COUNT(*) as count FROM users WHERE role='patient'", (err, row) => {
        stats.patients = row ? row.count : 0;
        db.get("SELECT COUNT(*) as count FROM users WHERE role='doctor'", (err, row) => {
            stats.doctors = row ? row.count : 0;
            db.get("SELECT COUNT(*) as count FROM appointments", (err, row) => {
                stats.appointments = row ? row.count : 0;
                res.json(stats);
            });
        });
    });
});

app.post('/api/admin/doctors', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({error: "Admin Only"});
    const hash = await bcrypt.hash(req.body.password, 10);
    const img = req.body.image_url || "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=500&q=80";
    db.run(`INSERT INTO users (name, email, password, role, specialization, image_url) VALUES (?, ?, ?, 'doctor', ?, ?)`, [req.body.name, req.body.email, hash, req.body.specialization, img], () => res.status(201).json({message: "Doctor Added!"}));
});

app.delete('/api/admin/doctors/:id', authenticate, (req, res) => {
    db.run(`DELETE FROM users WHERE id = ? AND role = 'doctor'`, [req.params.id], () => res.json({message: "Removed"}));
});

// --- Patient & Triage APIs ---
app.post('/api/appointments', authenticate, (req, res) => {
    const dept = triageEngine(req.body.symptoms);
    db.get(`SELECT id FROM users WHERE role = 'doctor' AND specialization = ? LIMIT 1`, [dept], (err, doc) => {
        db.run(`INSERT INTO appointments (patient_id, doctor_id, symptoms, department, appointment_date) VALUES (?, ?, ?, ?, ?)`, [req.user.id, doc ? doc.id : 1, req.body.symptoms, dept, req.body.date], function() {
            res.status(201).json({ message: "Booked!", id: this.lastID, dept: dept });
        });
    });
});

app.get('/api/queue/:appointmentId', (req, res) => {
    db.get(`SELECT doctor_id, appointment_date, status FROM appointments WHERE id = ?`, [req.params.appointmentId], (err, currentAppt) => {
        if (!currentAppt) return res.status(404).json({error: "Not found"});
        db.get(`SELECT COUNT(*) as patientsAhead FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status = 'Pending' AND id < ?`, [currentAppt.doctor_id, currentAppt.appointment_date, req.params.appointmentId], (err, row) => {
            res.json({ patientsAhead: row.patientsAhead || 0, estimatedWaitTime: (row.patientsAhead || 0) * 15, status: currentAppt.status });
        });
    });
});

app.get('/api/patient/dashboard', authenticate, (req, res) => {
    db.all(`SELECT a.id, u.name as doctor_name, a.department, a.appointment_date, a.status, a.symptoms FROM appointments a LEFT JOIN users u ON a.doctor_id = u.id WHERE a.patient_id = ? ORDER BY a.id DESC`, [req.user.id], (err, rows) => res.json(rows || []));
});

// 🧪 NEW: AI Lab Report Endpoints
app.post('/api/analyze-report', authenticate, (req, res) => {
    res.json(processLabReport(req.body.reportText));
});

app.post('/api/upload-pdf', authenticate, upload.single('reportPdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({error: "No file uploaded"});
        const pdfData = await pdfParse(req.file.buffer);
        res.json(processLabReport(pdfData.text)); // Reads PDF and passes text to AI Engine
    } catch (err) { res.status(500).json({error: "Failed to read PDF file."}); }
});

// --- Doctor APIs ---
app.get('/api/doctor/queue', authenticate, (req, res) => {
    db.all(`SELECT a.id, u.name, a.symptoms, a.appointment_date, a.status FROM appointments a JOIN users u ON a.patient_id = u.id WHERE a.doctor_id = ? AND a.status = 'Pending' ORDER BY a.id ASC`, [req.user.id], (err, rows) => res.json(rows));
});
app.put('/api/doctor/appointments/:id/complete', authenticate, (req, res) => {
    db.run(`UPDATE appointments SET status = 'Completed' WHERE id = ? AND doctor_id = ?`, [req.params.id, req.user.id], () => res.json({message: "Checked!"}));
});
app.get('/api/doctors', (req, res) => { db.all(`SELECT id, name, specialization, email, image_url FROM users WHERE role = 'doctor'`, [], (err, rows) => res.json(rows)); });
app.post('/api/contact', (req, res) => { db.run(`INSERT INTO messages (name, email, message) VALUES (?, ?, ?)`, [req.body.name, req.body.email, req.body.message], () => res.status(201).json({ message: "Sent" })); });

app.listen(3000, () => console.log('RakshitPlus Enterprise Backend Live on Port 3000!'));