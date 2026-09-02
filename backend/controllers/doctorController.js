const bcrypt = require("bcrypt");
const db = require("../config/db");

const query = (sql, values = []) => db.promise().query(sql, values);
const error = (res, err) => {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
};

async function currentDoctor(email) {
    const [rows] = await query(
        `SELECT d.docid, d.docemail, d.docname, d.docnic, d.doctel, d.specialties,
                d.docpassword, sp.sname AS specialty
         FROM doctor d LEFT JOIN specialties sp ON sp.id = d.specialties
         WHERE d.docemail = ?`, [email]
    );
    return rows[0] || null;
}

async function ownSession(doctorId, scheduleId) {
    const [rows] = await query("SELECT * FROM schedule WHERE scheduleid = ? AND docid = ?", [scheduleId, doctorId]);
    return rows[0] || null;
}

exports.profile = async (req, res) => {
    try {
        const doctor = await currentDoctor(req.user.email);
        if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });
        delete doctor.docpassword;
        res.json({ success: true, doctor });
    } catch (err) { error(res, err); }
};

exports.dashboard = async (req, res) => {
    try {
        const doctor = await currentDoctor(req.user.email);
        if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });
        const [[sessions]] = await query("SELECT COUNT(*) AS total FROM schedule WHERE docid = ? AND scheduledate >= CURDATE()", [doctor.docid]);
        const [[appointments]] = await query(`SELECT COUNT(*) AS total FROM appointment a JOIN schedule s ON s.scheduleid = a.scheduleid WHERE s.docid = ? AND s.scheduledate >= CURDATE()`, [doctor.docid]);
        const [[patients]] = await query(`SELECT COUNT(DISTINCT a.pid) AS total FROM appointment a JOIN schedule s ON s.scheduleid = a.scheduleid WHERE s.docid = ?`, [doctor.docid]);
        res.json({ success: true, sessions: sessions.total, appointments: appointments.total, patients: patients.total });
    } catch (err) { error(res, err); }
};

exports.sessions = async (req, res) => {
    try {
        const doctor = await currentDoctor(req.user.email);
        if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });
        const [sessions] = await query(`SELECT s.scheduleid, s.title, s.scheduledate, s.scheduletime, s.nop, COUNT(a.appoid) AS bookedSeats
            FROM schedule s LEFT JOIN appointment a ON a.scheduleid = s.scheduleid
            WHERE s.docid = ? GROUP BY s.scheduleid ORDER BY s.scheduledate DESC, s.scheduletime DESC`, [doctor.docid]);
        res.json({ success: true, sessions });
    } catch (err) { error(res, err); }
};

exports.createSession = async (req, res) => {
    try {
        const { title, scheduledate, scheduletime, nop } = req.body;
        const capacity = Number(nop);
        if (!title?.trim() || !scheduledate || !scheduletime || !Number.isInteger(capacity) || capacity < 1)
            return res.status(400).json({ success: false, message: "title, scheduledate, scheduletime and a positive nop are required" });
        const doctor = await currentDoctor(req.user.email);
        if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });
        const [result] = await query("INSERT INTO schedule (docid, title, scheduledate, scheduletime, nop) VALUES (?, ?, ?, ?, ?)", [doctor.docid, title.trim(), scheduledate, scheduletime, capacity]);
        res.status(201).json({ success: true, message: "Session created", scheduleid: result.insertId });
    } catch (err) { error(res, err); }
};

exports.updateSession = async (req, res) => {
    try {
        const id = Number(req.params.id), { title, scheduledate, scheduletime, nop } = req.body, capacity = Number(nop);
        if (!Number.isInteger(id) || !title?.trim() || !scheduledate || !scheduletime || !Number.isInteger(capacity) || capacity < 1)
            return res.status(400).json({ success: false, message: "Valid session data is required" });
        const doctor = await currentDoctor(req.user.email);
        const session = doctor && await ownSession(doctor.docid, id);
        if (!session) return res.status(404).json({ success: false, message: "Session not found" });
        const [[bookings]] = await query("SELECT COUNT(*) AS total FROM appointment WHERE scheduleid = ?", [id]);
        if (capacity < bookings.total) return res.status(409).json({ success: false, message: "Capacity cannot be below existing bookings" });
        await query("UPDATE schedule SET title = ?, scheduledate = ?, scheduletime = ?, nop = ? WHERE scheduleid = ?", [title.trim(), scheduledate, scheduletime, capacity, id]);
        res.json({ success: true, message: "Session updated" });
    } catch (err) { error(res, err); }
};

exports.deleteSession = async (req, res) => {
    try {
        const id = Number(req.params.id), doctor = await currentDoctor(req.user.email);
        const session = doctor && await ownSession(doctor.docid, id);
        if (!session) return res.status(404).json({ success: false, message: "Session not found" });
        await query("DELETE FROM appointment WHERE scheduleid = ?", [id]);
        await query("DELETE FROM schedule WHERE scheduleid = ?", [id]);
        res.json({ success: true, message: "Session and its appointments deleted" });
    } catch (err) { error(res, err); }
};

exports.appointments = async (req, res) => {
    try {
        const doctor = await currentDoctor(req.user.email);
        if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });
        const [appointments] = await query(`SELECT a.appoid, a.apponum, a.appodate, s.scheduleid, s.title, s.scheduledate, s.scheduletime,
            p.pid, p.pname, p.pemail, p.ptel FROM appointment a JOIN schedule s ON s.scheduleid = a.scheduleid
            JOIN patient p ON p.pid = a.pid WHERE s.docid = ? ORDER BY s.scheduledate DESC, s.scheduletime DESC, a.apponum ASC`, [doctor.docid]);
        res.json({ success: true, appointments });
    } catch (err) { error(res, err); }
};

exports.patients = async (req, res) => {
    try {
        const doctor = await currentDoctor(req.user.email);
        if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });
        const [patients] = await query(`SELECT DISTINCT p.pid, p.pname, p.pemail, p.pnic, p.pdob, p.ptel, p.paddress
            FROM patient p JOIN appointment a ON a.pid = p.pid JOIN schedule s ON s.scheduleid = a.scheduleid
            WHERE s.docid = ? ORDER BY p.pname`, [doctor.docid]);
        res.json({ success: true, patients });
    } catch (err) { error(res, err); }
};

exports.updateProfile = async (req, res) => {
    try {
        const { docname, docnic, doctel, specialties } = req.body;
        const specialtyId = specialties === null || specialties === "" ? null : Number(specialties);
        if (!docname?.trim() || (specialtyId !== null && !Number.isInteger(specialtyId))) return res.status(400).json({ success: false, message: "A valid doctor name and specialty are required" });
        const doctor = await currentDoctor(req.user.email);
        if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });
        await query("UPDATE doctor SET docname = ?, docnic = ?, doctel = ?, specialties = ? WHERE docid = ?", [docname.trim(), docnic?.trim() || null, doctel?.trim() || null, specialtyId, doctor.docid]);
        res.json({ success: true, message: "Profile updated" });
    } catch (err) { error(res, err); }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword || newPassword.length < 6) return res.status(400).json({ success: false, message: "Current password and a new password of at least 6 characters are required" });
        const doctor = await currentDoctor(req.user.email);
        if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });
        if (!(await bcrypt.compare(currentPassword, doctor.docpassword))) return res.status(401).json({ success: false, message: "Current password is incorrect" });
        await query("UPDATE doctor SET docpassword = ? WHERE docid = ?", [await bcrypt.hash(newPassword, 12), doctor.docid]);
        res.json({ success: true, message: "Password changed" });
    } catch (err) { error(res, err); }
};
