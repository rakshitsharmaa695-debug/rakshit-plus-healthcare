const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

    // Default Root Admin
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

function triageEngine(symptoms) {
    const text = symptoms.toLowerCase();
    if (text.includes('chest') || text.includes('heart')) return "Cardiology";
    if (text.includes('bone') || text.includes('fracture')) return "Orthopedics";
    if (text.includes('brain') || text.includes('headache')) return "Neurology";
    return "General Medicine";
}

// --- Auth APIs ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const hash = await bcrypt.hash(req.body.password, 10);
        db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`, [req.body.name, req.body.email, hash], function(err) {
            if (err) return res.status(400).json({ error: "Email already exists!" });
            res.status(201).json({ message: "Registered!" });
        });
    } catch (error) { res.status(500).json({ error: "Server Error" }); }
});

app.post('/api/auth/login', (req, res) => {
    try {
        db.get(`SELECT * FROM users WHERE email = ?`, [req.body.email], async (err, user) => {
            if (err) return res.status(500).json({ error: "Database error occurred." });
            if (!user) return res.status(400).json({ error: "Account not found. Please register." });
            
            const isMatch = await bcrypt.compare(req.body.password, user.password);
            if (!isMatch) return res.status(400).json({ error: "Incorrect password." });
            
            const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ token, role: user.role });
        });
    } catch (error) {
        res.status(500).json({ error: "Server crashed internally." });
    }
});

// --- Admin APIs ---
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
    if (req.user.role !== 'admin') return res.status(403).json({error: "Admin Clearance Required"});
    const hash = await bcrypt.hash(req.body.password, 10);
    const img = req.body.image_url || "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=500&q=80";
    db.run(`INSERT INTO users (name, email, password, role, specialization, image_url) VALUES (?, ?, ?, 'doctor', ?, ?)`, 
    [req.body.name, req.body.email, hash, req.body.specialization, img], (err) => {
        if (err) return res.status(400).json({error: "Email already registered"});
        res.status(201).json({message: "Doctor Added!"});
    });
});

app.delete('/api/admin/doctors/:id', authenticate, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({error: "Admin Only"});
    db.run(`DELETE FROM users WHERE id = ? AND role = 'doctor'`, [req.params.id], () => res.json({message: "Removed"}));
});

// --- Patient/Dashboard APIs ---
app.post('/api/appointments', authenticate, (req, res) => {
    const dept = triageEngine(req.body.symptoms);
    db.get(`SELECT id FROM users WHERE role = 'doctor' AND specialization = ? LIMIT 1`, [dept], (err, doc) => {
        const doctorId = doc ? doc.id : 1; 
        db.run(`INSERT INTO appointments (patient_id, doctor_id, symptoms, department, appointment_date) VALUES (?, ?, ?, ?, ?)`, 
        [req.user.id, doctorId, req.body.symptoms, dept, req.body.date], function(err) {
            res.status(201).json({ message: "Booked!", id: this.lastID, dept: dept });
        });
    });
});

app.get('/api/queue/:appointmentId', authenticate, (req, res) => {
    db.get(`SELECT doctor_id, appointment_date, status FROM appointments WHERE id = ?`, [req.params.appointmentId], (err, currentAppt) => {
        if (!currentAppt) return res.status(404).json({error: "Not found"});
        db.get(`SELECT COUNT(*) as patientsAhead FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status = 'Pending' AND id < ?`, 
        [currentAppt.doctor_id, currentAppt.appointment_date, req.params.appointmentId], (err, row) => {
            res.json({ patientsAhead: row.patientsAhead || 0, estimatedWaitTime: (row.patientsAhead || 0) * 15, status: currentAppt.status });
        });
    });
});

app.get('/api/patient/dashboard', authenticate, (req, res) => {
    if (req.user.role !== 'patient') return res.status(403).json({error: "Patients only."});
    db.all(`SELECT a.id, u.name as doctor_name, a.department, a.appointment_date, a.status, a.symptoms 
            FROM appointments a LEFT JOIN users u ON a.doctor_id = u.id 
            WHERE a.patient_id = ? ORDER BY a.id DESC`, [req.user.id], (err, rows) => {
        res.json(rows || []);
    });
});

// 🧠 Advanced Conversational AI Diagnostics
app.post('/api/diagnostics', authenticate, (req, res) => {
    const text = req.body.symptoms.toLowerCase();
    let result = { conditions: [], urgency: "Normal", dept: "General Medicine" };

    if (text.includes('chest') || text.includes('heart') || text.includes('breath') || text.includes('heavy')) {
        result = { conditions: ["Coronary Artery Disease", "Myocardial Infarction warning", "Angina"], urgency: "CRITICAL", dept: "Cardiology" };
    } else if (text.includes('head') || text.includes('blur') || text.includes('faint') || text.includes('dizzy') || text.includes('migraine')) {
        result = { conditions: ["Severe Migraine", "Vertigo", "Neurological Stress"], urgency: "High", dept: "Neurology" };
    } else if (text.includes('stomach') || text.includes('pain') && (text.includes('vomit') || text.includes('nausea') || text.includes('food'))) {
        result = { conditions: ["Food Poisoning", "Acute Gastritis", "Appendicitis Risk"], urgency: "High", dept: "Gastroenterology" };
    } else if (text.includes('bone') || text.includes('joint') || text.includes('knee') || text.includes('fall') || text.includes('fracture')) {
        result = { conditions: ["Arthritis", "Ligament Tear", "Hairline Fracture"], urgency: "Medium", dept: "Orthopedics" };
    } else if (text.includes('fever') || text.includes('cold') || text.includes('cough') || text.includes('throat')) {
        result = { conditions: ["Viral Infection", "Seasonal Flu", "Strep Throat"], urgency: "Low", dept: "General Medicine" };
    } else {
        result = { conditions: ["General Fatigue", "Dehydration", "Nutritional Deficiency"], urgency: "Low", dept: "General Medicine" };
    }
    res.json(result);
});

// --- Doctor APIs ---
app.get('/api/doctor/queue', authenticate, (req, res) => {
    if (req.user.role !== 'doctor') return res.status(403).json({error: "Doctor Access Only"});
    db.all(`SELECT a.id, u.name, a.symptoms, a.appointment_date, a.status FROM appointments a JOIN users u ON a.patient_id = u.id WHERE a.doctor_id = ? AND a.status = 'Pending' ORDER BY a.id ASC`, [req.user.id], (err, rows) => res.json(rows));
});

app.put('/api/doctor/appointments/:id/complete', authenticate, (req, res) => {
    if (req.user.role !== 'doctor') return res.status(403).json({error: "Doctor Access Only"});
    db.run(`UPDATE appointments SET status = 'Completed' WHERE id = ? AND doctor_id = ?`, [req.params.id, req.user.id], () => res.json({message: "Checked!"}));
});

// --- Public APIs ---
app.get('/api/doctors', (req, res) => {
    db.all(`SELECT id, name, specialization, email, image_url FROM users WHERE role = 'doctor'`, [], (err, rows) => res.json(rows));
});

app.post('/api/contact', (req, res) => {
    db.run(`INSERT INTO messages (name, email, message) VALUES (?, ?, ?)`, [req.body.name, req.body.email, req.body.message], () => res.status(201).json({ message: "Message sent!" }));
});

app.listen(3000, () => console.log('RakshitPlus Enterprise Backend Live on Port 3000!'));