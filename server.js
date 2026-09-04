const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.static(__dirname));
app.use(express.json());

const JWT_SECRET = "RakshitPlus_Enterprise_Secret";

const db = new sqlite3.Database('./rakshitplus.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'patient', specialization TEXT, image_url TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER, doctor_id INTEGER, symptoms TEXT, department TEXT, appointment_date TEXT, status TEXT DEFAULT 'Pending')`);
    
    bcrypt.hash('admin123', 10, (err, hash) => {
        db.run(`INSERT OR IGNORE INTO users (name, email, password, role) VALUES ('System Admin', 'admin@rakshitplus.com', ?, 'admin')`, [hash]);
    });
});

const authenticate = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ error: "Access Denied." });
    try {
        req.user = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET);
        next();
    } catch (err) { res.status(400).json({ error: "Invalid Token." }); }
};

// Admin: Add Doctor (With Custom Image)
app.post('/api/admin/doctors', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({error: "Admin Only"});
    const hash = await bcrypt.hash(req.body.password, 10);
    const img = req.body.image_url || "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=500&q=80";
    
    db.run(`INSERT INTO users (name, email, password, role, specialization, image_url) VALUES (?, ?, ?, 'doctor', ?, ?)`, 
    [req.body.name, req.body.email, hash, req.body.specialization, img], (err) => {
        if (err) return res.status(400).json({error: "Email registered"});
        res.status(201).json({message: "Doctor Added!"});
    });
});

// Doctor: Mark Patient as Checked
app.put('/api/doctor/appointments/:id/complete', authenticate, (req, res) => {
    if (req.user.role !== 'doctor') return res.status(403).json({error: "Doctor Access Only"});
    db.run(`UPDATE appointments SET status = 'Completed' WHERE id = ? AND doctor_id = ?`, [req.params.id, req.user.id], function(err) {
        res.json({message: "Patient Checked. Next Patient Called!"});
    });
});

// Patient: Book Appointment
app.post('/api/appointments', authenticate, (req, res) => {
    const dept = "General Medicine"; // Simplified Triage
    db.get(`SELECT id FROM users WHERE role = 'doctor' LIMIT 1`, [], (err, doc) => {
        const doctorId = doc ? doc.id : 1; 
        db.run(`INSERT INTO appointments (patient_id, doctor_id, symptoms, department, appointment_date) VALUES (?, ?, ?, ?, ?)`, 
        [req.user.id, doctorId, req.body.symptoms, dept, req.body.date], function(err) {
            res.status(201).json({ message: "Booked!", id: this.lastID, dept: dept });
        });
    });
});

// Patient Tracking Engine (Includes Status)
app.get('/api/queue/:appointmentId', authenticate, (req, res) => {
    db.get(`SELECT doctor_id, appointment_date, status FROM appointments WHERE id = ?`, [req.params.appointmentId], (err, currentAppt) => {
        if (!currentAppt) return res.status(404).json({error: "Not found"});
        db.get(`SELECT COUNT(*) as patientsAhead FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status = 'Pending' AND id < ?`, 
        [currentAppt.doctor_id, currentAppt.appointment_date, req.params.appointmentId], (err, row) => {
            res.json({ patientsAhead: row.patientsAhead || 0, status: currentAppt.status });
        });
    });
});

// Auth & Public APIs
app.post('/api/auth/register', async (req, res) => {
    const hash = await bcrypt.hash(req.body.password, 10);
    db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`, [req.body.name, req.body.email, hash], () => res.status(201).json({ message: "Registered!" }));
});
app.post('/api/auth/login', (req, res) => {
    db.get(`SELECT * FROM users WHERE email = ?`, [req.body.email], async (err, user) => {
        if (!user || !(await bcrypt.compare(req.body.password, user.password))) return res.status(400).json({ error: "Invalid" });
        res.json({ token: jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' }), role: user.role });
    });
});
app.get('/api/doctor/queue', authenticate, (req, res) => {
    db.all(`SELECT a.id, u.name, a.symptoms, a.appointment_date, a.status FROM appointments a JOIN users u ON a.patient_id = u.id WHERE a.doctor_id = ? AND a.status = 'Pending' ORDER BY a.id ASC`, [req.user.id], (err, rows) => res.json(rows));
});
app.get('/api/doctors', (req, res) => {
    db.all(`SELECT id, name, specialization, image_url FROM users WHERE role = 'doctor'`, [], (err, rows) => res.json(rows));
});

app.listen(3000, () => console.log('Backend Live!'));