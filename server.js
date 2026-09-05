const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const app = express();
app.use(express.static(__dirname));
app.use(express.json({limit: '10mb'})); 

const JWT_SECRET = "RakshitPlus_Enterprise_Secret";

const db = new sqlite3.Database('./rakshitplus.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'patient', specialization TEXT, image_url TEXT, experience TEXT, qualification TEXT, about TEXT, fees INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    // 🚀 UPDATED SCHEMA: Added patient_name, age, gender, contact
    db.run(`CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER, doctor_id INTEGER, patient_name TEXT, age INTEGER, gender TEXT, contact TEXT, symptoms TEXT, department TEXT, appointment_date TEXT, status TEXT DEFAULT 'Pending')`);
    db.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, message TEXT, status TEXT DEFAULT 'Unread')`);

    bcrypt.hash('admin123', 10, (err, hash) => {
        db.run(`INSERT OR IGNORE INTO users (name, email, password, role) VALUES ('System Admin', 'admin@rakshitplus.com', ?, 'admin')`, [hash]);
    });
});

const authenticate = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ error: "Access Denied." });
    try { req.user = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET); next(); } 
    catch (err) { res.status(400).json({ error: "Invalid Token." }); }
};

const upload = multer({ storage: multer.memoryStorage() }); 

function triageEngine(symptoms) {
    const text = symptoms.toLowerCase();
    if (text.includes('chest') || text.includes('heart')) return "Cardiology";
    if (text.includes('bone') || text.includes('fracture')) return "Orthopedics";
    if (text.includes('brain') || text.includes('headache')) return "Neurology";
    if (text.includes('stomach') || text.includes('food')) return "Gastroenterology";
    return "General Medicine";
}

// APIs (Auth, Admin, Doctors)
app.post('/api/auth/register', async (req, res) => {
    try {
        const hash = await bcrypt.hash(req.body.password, 10);
        db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`, [req.body.name, req.body.email, hash], function(err) {
            if (err) return res.status(400).json({ error: "Email exists!" }); res.status(201).json({ message: "Registered!" });
        });
    } catch (error) { res.status(500).json({ error: "Server Error" }); }
});

app.post('/api/auth/login', (req, res) => {
    db.get(`SELECT * FROM users WHERE email = ?`, [req.body.email], async (err, user) => {
        if (!user) return res.status(400).json({ error: "Account not found." });
        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Incorrect password." });
        res.json({ token: jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' }), role: user.role });
    });
});

app.get('/api/admin/stats', authenticate, (req, res) => {
    let stats = { patients: 0, doctors: 0, appointments: 0 };
    db.get("SELECT COUNT(*) as count FROM users WHERE role='patient'", (err, row) => { stats.patients = row ? row.count : 0;
        db.get("SELECT COUNT(*) as count FROM users WHERE role='doctor'", (err, row) => { stats.doctors = row ? row.count : 0;
            db.get("SELECT COUNT(*) as count FROM appointments", (err, row) => { stats.appointments = row ? row.count : 0; res.json(stats); });
        });
    });
});

app.post('/api/admin/doctors', authenticate, async (req, res) => {
    const hash = await bcrypt.hash(req.body.password, 10);
    const img = req.body.image_url || "https://cdn-icons-png.flaticon.com/512/3774/3774299.png"; 
    db.run(`INSERT INTO users (name, email, password, role, specialization, image_url, experience, qualification, about, fees) VALUES (?, ?, ?, 'doctor', ?, ?, ?, ?, ?, ?)`, 
    [req.body.name, req.body.email, hash, req.body.specialization, img, req.body.experience, req.body.qualification, req.body.about, req.body.fees], () => res.status(201).json({message: "Doctor Added!"}));
});

// 🚀 UPDATED APPOINTMENT SYSTEM (Accepts Full Details)
app.post('/api/appointments', authenticate, (req, res) => {
    const { patient_name, age, gender, contact, symptoms, date, doctor_id } = req.body;

    if (doctor_id) {
        db.get(`SELECT id, specialization FROM users WHERE id = ? AND role = 'doctor'`, [doctor_id], (err, doc) => {
            if (!doc) return res.status(400).json({ error: "Doctor not found" });
            db.run(`INSERT INTO appointments (patient_id, doctor_id, patient_name, age, gender, contact, symptoms, department, appointment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [req.user.id, doc.id, patient_name, age, gender, contact, symptoms, doc.specialization, date], function() {
                res.status(201).json({ message: "Booked!", id: this.lastID, dept: doc.specialization });
            });
        });
    } else {
        const dept = triageEngine(symptoms);
        db.get(`SELECT id FROM users WHERE role = 'doctor' AND specialization = ? LIMIT 1`, [dept], (err, doc) => {
            const docId = doc ? doc.id : 1; 
            db.run(`INSERT INTO appointments (patient_id, doctor_id, patient_name, age, gender, contact, symptoms, department, appointment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [req.user.id, docId, patient_name, age, gender, contact, symptoms, dept, date], function() {
                res.status(201).json({ message: "Booked!", id: this.lastID, dept: dept });
            });
        });
    }
});

app.get('/api/queue/:appointmentId', (req, res) => {
    db.get(`SELECT doctor_id, appointment_date, status FROM appointments WHERE id = ?`, [req.params.appointmentId], (err, currentAppt) => {
        if (!currentAppt) return res.status(404).json({error: "Not found"});
        db.get(`SELECT COUNT(*) as patientsAhead FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status = 'Pending' AND id < ?`, [currentAppt.doctor_id, currentAppt.appointment_date, req.params.appointmentId], (err, row) => {
            res.json({ patientsAhead: row.patientsAhead || 0, estimatedWaitTime: (row.patientsAhead || 0) * 15, status: currentAppt.status });
        });
    });
});

app.get('/api/doctors', (req, res) => { db.all(`SELECT id, name, specialization, email, image_url, experience, qualification, about, fees FROM users WHERE role = 'doctor'`, [], (err, rows) => res.json(rows)); });
app.get('/api/doctors/:id', (req, res) => { db.get(`SELECT * FROM users WHERE role = 'doctor' AND id = ?`, [req.params.id], (err, row) => res.json(row)); });

app.listen(3000, () => console.log('RakshitPlus Enterprise Backend Live on Port 3000!'));