// =====================================================
// backend/routes/admin.js
// =====================================================

const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../config/db");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();


// =====================================================
// ADMIN ACCESS CHECK
// =====================================================

const onlyAdmin = (req, res) => {

    if (req.user?.role !== "a") {

        res.status(403).json({
            success: false,
            message: "Admin access only"
        });

        return false;
    }

    return true;
};


// =====================================================
// COMMON SERVER ERROR
// =====================================================

const fail = (res, error) => {

    console.error("Admin API error:", error);

    return res.status(500).json({
        success: false,
        message: "Server error"
    });
};


// =====================================================
// 1. ADMIN PROFILE
// GET /api/admin/profile
// =====================================================

router.get("/profile", authenticateToken, async (req, res) => {

    try {

        if (!onlyAdmin(req, res)) return;

        const [rows] = await db.promise().query(
            "SELECT aemail FROM admin WHERE aemail = ?",
            [req.user.email]
        );

        if (!rows.length) {

            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        return res.json({
            success: true,
            admin: rows[0]
        });

    } catch (error) {

        return fail(res, error);
    }
});


// =====================================================
// 2. DASHBOARD STATISTICS
// GET /api/admin/dashboard-stats
// =====================================================

router.get("/dashboard-stats", authenticateToken, async (req, res) => {

    try {

        if (!onlyAdmin(req, res)) return;

        const [[doctorCount]] =
            await db.promise().query(
                "SELECT COUNT(*) AS total FROM doctor"
            );

        const [[patientCount]] =
            await db.promise().query(
                "SELECT COUNT(*) AS total FROM patient"
            );

        const [[appointmentCount]] =
            await db.promise().query(
                "SELECT COUNT(*) AS total FROM appointment"
            );

        const [[sessionCount]] =
            await db.promise().query(
                "SELECT COUNT(*) AS total FROM schedule WHERE scheduledate >= CURDATE()"
            );

        return res.json({
            success: true,
            doctors: doctorCount.total,
            patients: patientCount.total,
            appointments: appointmentCount.total,
            sessions: sessionCount.total
        });

    } catch (error) {

        return fail(res, error);
    }
});


// =====================================================
// 3. UPCOMING SESSIONS
// GET /api/admin/upcoming-sessions
// =====================================================

router.get(
    "/upcoming-sessions",
    authenticateToken,
    async (req, res) => {

        try {

            if (!onlyAdmin(req, res)) return;

            const [sessions] = await db.promise().query(`
                SELECT
                    s.scheduleid,
                    s.title,
                    s.scheduledate,
                    s.scheduletime,
                    s.nop,

                    d.docid,
                    d.docname,
                    d.docemail,

                    sp.sname AS specialty,

                    COUNT(a.appoid) AS bookedSeats

                FROM schedule s

                LEFT JOIN doctor d
                    ON d.docid = s.docid

                LEFT JOIN specialties sp
                    ON sp.id = d.specialties

                LEFT JOIN appointment a
                    ON a.scheduleid = s.scheduleid

                WHERE
                    s.scheduledate >= CURDATE()

                GROUP BY
                    s.scheduleid,
                    s.title,
                    s.scheduledate,
                    s.scheduletime,
                    s.nop,
                    d.docid,
                    d.docname,
                    d.docemail,
                    sp.sname

                ORDER BY
                    s.scheduledate ASC,
                    s.scheduletime ASC

                LIMIT 5
            `);

            return res.json({
                success: true,
                sessions
            });

        } catch (error) {

            return fail(res, error);
        }
    }
);


// =====================================================
// 4. UPCOMING APPOINTMENTS
// GET /api/admin/upcoming-appointments
// =====================================================

router.get(
    "/upcoming-appointments",
    authenticateToken,
    async (req, res) => {

        try {

            if (!onlyAdmin(req, res)) return;

            const [appointments] =
                await db.promise().query(`
                    SELECT
                        a.appoid,
                        a.apponum,
                        a.appodate,

                        p.pid,
                        p.pname,
                        p.pemail,

                        s.scheduleid,
                        s.title,
                        s.scheduledate,
                        s.scheduletime,

                        d.docid,
                        d.docname,
                        d.docemail,

                        sp.sname AS specialty

                    FROM appointment a

                    INNER JOIN patient p
                        ON p.pid = a.pid

                    INNER JOIN schedule s
                        ON s.scheduleid = a.scheduleid

                    LEFT JOIN doctor d
                        ON d.docid = s.docid

                    LEFT JOIN specialties sp
                        ON sp.id = d.specialties

                    WHERE
                        s.scheduledate >= CURDATE()

                    ORDER BY
                        s.scheduledate ASC,
                        s.scheduletime ASC,
                        a.apponum ASC

                    LIMIT 5
                `);

            return res.json({
                success: true,
                appointments
            });

        } catch (error) {

            return fail(res, error);
        }
    }
);


// =====================================================
// 5. SPECIALTIES
// GET /api/admin/specialties
// =====================================================

router.get("/specialties", authenticateToken, async (req, res) => {

    try {

        if (!onlyAdmin(req, res)) return;

        const [specialties] =
            await db.promise().query(
                "SELECT id, sname FROM specialties ORDER BY sname"
            );

        return res.json({
            success: true,
            specialties
        });

    } catch (error) {

        return fail(res, error);
    }
});


// =====================================================
// 6. GET DOCTORS
// GET /api/admin/doctors
// =====================================================

router.get("/doctors", authenticateToken, async (req, res) => {

    try {

        if (!onlyAdmin(req, res)) return;

        const q =
            String(req.query.search || "").trim();

        let sql = `
            SELECT
                d.docid,
                d.docemail,
                d.docname,
                d.docnic,
                d.doctel,
                d.specialties,
                sp.sname AS specialty
            FROM doctor d
            LEFT JOIN specialties sp
                ON sp.id = d.specialties
        `;

        const params = [];

        if (q) {

            sql += `
                WHERE
                    d.docname LIKE ?
                    OR d.docemail LIKE ?
                    OR d.docnic LIKE ?
                    OR d.doctel LIKE ?
            `;

            const search = `%${q}%`;

            params.push(
                search,
                search,
                search,
                search
            );
        }

        sql += " ORDER BY d.docname";

        const [doctors] =
            await db.promise().query(
                sql,
                params
            );

        return res.json({
            success: true,
            doctors
        });

    } catch (error) {

        return fail(res, error);
    }
});


// =====================================================
// 7. ADD DOCTOR
// POST /api/admin/doctors
// =====================================================

router.post("/doctors", authenticateToken, async (req, res) => {

    try {

        if (!onlyAdmin(req, res)) return;

        const body = req.body || {};

        const email =
            String(body.docemail || "")
                .trim()
                .toLowerCase();

        const name =
            String(body.docname || "")
                .trim();

        const password =
            String(body.password || "");

        const nic =
            String(body.docnic || "")
                .trim() || null;

        const tel =
            String(body.doctel || "")
                .trim() || null;

        if (!email || !name || !password) {

            return res.status(400).json({
                success: false,
                message:
                    "Doctor email, name and password are required"
            });
        }

        if (password.length < 6) {

            return res.status(400).json({
                success: false,
                message:
                    "Doctor password must be at least 6 characters"
            });
        }

        const [[existingUser]] =
            await db.promise().query(
                "SELECT email FROM webuser WHERE email = ?",
                [email]
            );

        if (existingUser) {

            return res.status(409).json({
                success: false,
                message: "Email already exists"
            });
        }

        let specialtyId = null;

        if (
            body.specialties !== "" &&
            body.specialties !== null &&
            body.specialties !== undefined
        ) {

            specialtyId =
                Number(body.specialties);

            if (!Number.isInteger(specialtyId)) {

                return res.status(400).json({
                    success: false,
                    message: "Invalid specialty"
                });
            }
        }

        const hashedPassword =
            await bcrypt.hash(
                password,
                12
            );

        const [result] =
            await db.promise().query(
                `
                INSERT INTO doctor
                (
                    docemail,
                    docname,
                    docpassword,
                    docnic,
                    doctel,
                    specialties
                )
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                    email,
                    name,
                    hashedPassword,
                    nic,
                    tel,
                    specialtyId
                ]
            );

        await db.promise().query(
            `
            INSERT INTO webuser
            (email, usertype)
            VALUES (?, 'd')
            `,
            [email]
        );

        return res.status(201).json({
            success: true,
            message: "Doctor created successfully",
            docid: result.insertId
        });

    } catch (error) {

        if (error.code === "ER_DUP_ENTRY") {

            return res.status(409).json({
                success: false,
                message: "Doctor/email already exists"
            });
        }

        return fail(res, error);
    }
});


// =====================================================
// 8. UPDATE DOCTOR
// PUT /api/admin/doctors/:docid
// =====================================================

router.put("/doctors/:docid", authenticateToken, async (req, res) => {

    try {

        if (!onlyAdmin(req, res)) return;

        const id =
            Number(req.params.docid);

        const body =
            req.body || {};

        const [[oldDoctor]] =
            await db.promise().query(
                "SELECT * FROM doctor WHERE docid = ?",
                [id]
            );

        if (!oldDoctor) {

            return res.status(404).json({
                success: false,
                message: "Doctor not found"
            });
        }

        const email =
            String(
                body.docemail ||
                oldDoctor.docemail ||
                ""
            )
                .trim()
                .toLowerCase();

        const name =
            String(
                body.docname ||
                ""
            )
                .trim();

        if (!name || !email) {

            return res.status(400).json({
                success: false,
                message:
                    "Doctor name and email are required"
            });
        }

        let specialtyId = null;

        if (
            body.specialties !== "" &&
            body.specialties !== null &&
            body.specialties !== undefined
        ) {

            specialtyId =
                Number(body.specialties);

            if (!Number.isInteger(specialtyId)) {

                return res.status(400).json({
                    success: false,
                    message: "Invalid specialty"
                });
            }
        }

        if (email !== oldDoctor.docemail) {

            const [[taken]] =
                await db.promise().query(
                    "SELECT email FROM webuser WHERE email = ?",
                    [email]
                );

            if (taken) {

                return res.status(409).json({
                    success: false,
                    message: "Email already exists"
                });
            }
        }

        const nic =
            String(
                body.docnic || ""
            )
                .trim() || null;

        const tel =
            String(
                body.doctel || ""
            )
                .trim() || null;

        if (body.password) {

            const newPassword =
                String(body.password);

            if (newPassword.length < 6) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Password must be at least 6 characters"
                });
            }

            const hash =
                await bcrypt.hash(
                    newPassword,
                    12
                );

            await db.promise().query(
                `
                UPDATE doctor
                SET
                    docemail = ?,
                    docname = ?,
                    docpassword = ?,
                    docnic = ?,
                    doctel = ?,
                    specialties = ?
                WHERE docid = ?
                `,
                [
                    email,
                    name,
                    hash,
                    nic,
                    tel,
                    specialtyId,
                    id
                ]
            );

        } else {

            await db.promise().query(
                `
                UPDATE doctor
                SET
                    docemail = ?,
                    docname = ?,
                    docnic = ?,
                    doctel = ?,
                    specialties = ?
                WHERE docid = ?
                `,
                [
                    email,
                    name,
                    nic,
                    tel,
                    specialtyId,
                    id
                ]
            );
        }

        if (email !== oldDoctor.docemail) {

            await db.promise().query(
                `
                UPDATE webuser
                SET email = ?
                WHERE email = ?
                `,
                [
                    email,
                    oldDoctor.docemail
                ]
            );
        }

        return res.json({
            success: true,
            message: "Doctor updated successfully"
        });

    } catch (error) {

        return fail(res, error);
    }
});


// =====================================================
// 9. DELETE DOCTOR
// DELETE /api/admin/doctors/:docid
// =====================================================

router.delete("/doctors/:docid", authenticateToken, async (req, res) => {

    try {

        if (!onlyAdmin(req, res)) return;

        const id =
            Number(req.params.docid);

        const [[doctor]] =
            await db.promise().query(
                "SELECT docemail FROM doctor WHERE docid = ?",
                [id]
            );

        if (!doctor) {

            return res.status(404).json({
                success: false,
                message: "Doctor not found"
            });
        }

        const [schedules] =
            await db.promise().query(
                "SELECT scheduleid FROM schedule WHERE docid = ?",
                [id]
            );

        for (const schedule of schedules) {

            await db.promise().query(
                "DELETE FROM appointment WHERE scheduleid = ?",
                [schedule.scheduleid]
            );
        }

        await db.promise().query(
            "DELETE FROM schedule WHERE docid = ?",
            [id]
        );

        await db.promise().query(
            "DELETE FROM doctor WHERE docid = ?",
            [id]
        );

        await db.promise().query(
            `
            DELETE FROM webuser
            WHERE email = ?
            AND usertype = 'd'
            `,
            [doctor.docemail]
        );

        return res.json({
            success: true,
            message: "Doctor deleted successfully"
        });

    } catch (error) {

        return fail(res, error);
    }
});


// =====================================================
// 10. GET PATIENTS
// GET /api/admin/patients
// =====================================================

router.get("/patients", authenticateToken, async (req, res) => {

    try {

        if (!onlyAdmin(req, res)) return;

        const q =
            String(req.query.search || "").trim();

        let sql = `
            SELECT
                pid,
                pemail,
                pname,
                paddress,
                pnic,
                pdob,
                ptel
            FROM patient
        `;

        const params = [];

        if (q) {

            sql += `
                WHERE
                    pname LIKE ?
                    OR pemail LIKE ?
                    OR pnic LIKE ?
                    OR ptel LIKE ?
            `;

            const search =
                `%${q}%`;

            params.push(
                search,
                search,
                search,
                search
            );
        }

        sql += " ORDER BY pname";

        const [patients] =
            await db.promise().query(
                sql,
                params
            );

        return res.json({
            success: true,
            patients
        });

    } catch (error) {

        return fail(res, error);
    }
});


// =====================================================
// 11. GET APPOINTMENTS
// GET /api/admin/appointments
// =====================================================

router.get("/appointments", authenticateToken, async (req, res) => {

    try {

        if (!onlyAdmin(req, res)) return;

        const date =
            String(req.query.date || "").trim();

        let sql = `
            SELECT
                a.appoid,
                a.apponum,
                a.appodate,

                p.pid,
                p.pname,
                p.pemail,

                s.scheduleid,
                s.title,
                s.scheduledate,
                s.scheduletime,

                d.docid,
                d.docname,
                d.docemail,

                sp.sname AS specialty

            FROM appointment a

            JOIN patient p
                ON p.pid = a.pid

            JOIN schedule s
                ON s.scheduleid = a.scheduleid

            LEFT JOIN doctor d
                ON d.docid = s.docid

            LEFT JOIN specialties sp
                ON sp.id = d.specialties
        `;

        const params = [];

        if (date) {

            sql += `
                WHERE s.scheduledate = ?
            `;

            params.push(date);
        }

        sql += `
            ORDER BY
                s.scheduledate DESC,
                s.scheduletime DESC,
                a.apponum
        `;

        const [appointments] =
            await db.promise().query(
                sql,
                params
            );

        return res.json({
            success: true,
            appointments
        });

    } catch (error) {

        return fail(res, error);
    }
});


// =====================================================
// 12. DELETE APPOINTMENT
// DELETE /api/admin/appointments/:appoid
// =====================================================

router.delete(
    "/appointments/:appoid",
    authenticateToken,
    async (req, res) => {

        try {

            if (!onlyAdmin(req, res)) return;

            const appoid =
                Number(req.params.appoid);

            const [result] =
                await db.promise().query(
                    "DELETE FROM appointment WHERE appoid = ?",
                    [appoid]
                );

            if (!result.affectedRows) {

                return res.status(404).json({
                    success: false,
                    message: "Appointment not found"
                });
            }

            return res.json({
                success: true,
                message: "Appointment deleted successfully"
            });

        } catch (error) {

            return fail(res, error);
        }
    }
);


// =====================================================
// 13. GET SCHEDULES
// GET /api/admin/schedules
// =====================================================

router.get("/schedules", authenticateToken, async (req, res) => {

    try {

        if (!onlyAdmin(req, res)) return;

        const date =
            String(req.query.date || "").trim();

        const docid =
            String(req.query.docid || "").trim();

        let sql = `
            SELECT
                s.scheduleid,
                s.docid,
                s.title,
                s.scheduledate,
                s.scheduletime,
                s.nop,

                d.docname,
                d.docemail,

                sp.sname AS specialty,

                COUNT(a.appoid) AS bookedSeats

            FROM schedule s

            LEFT JOIN doctor d
                ON d.docid = s.docid

            LEFT JOIN specialties sp
                ON sp.id = d.specialties

            LEFT JOIN appointment a
                ON a.scheduleid = s.scheduleid
        `;

        const conditions = [];
        const params = [];

        if (date) {

            conditions.push(
                "s.scheduledate = ?"
            );

            params.push(date);
        }

        if (docid) {

            conditions.push(
                "s.docid = ?"
            );

            params.push(Number(docid));
        }

        if (conditions.length) {

            sql +=
                " WHERE " +
                conditions.join(" AND ");
        }

        sql += `
            GROUP BY
                s.scheduleid,
                s.docid,
                s.title,
                s.scheduledate,
                s.scheduletime,
                s.nop,
                d.docname,
                d.docemail,
                sp.sname

            ORDER BY
                s.scheduledate ASC,
                s.scheduletime ASC
        `;

        const [schedules] =
            await db.promise().query(
                sql,
                params
            );

        return res.json({
            success: true,
            schedules
        });

    } catch (error) {

        return fail(res, error);
    }
});


// =====================================================
// 14. CREATE SCHEDULE
// POST /api/admin/schedules
// =====================================================

router.post("/schedules", authenticateToken, async (req, res) => {

    try {

        if (!onlyAdmin(req, res)) return;

        const body =
            req.body || {};

        const doctorId =
            Number(body.docid);

        const capacity =
            Number(body.nop);

        const title =
            String(body.title || "").trim();

        const scheduledate =
            body.scheduledate;

        const scheduletime =
            body.scheduletime;

        if (
            !Number.isInteger(doctorId) ||
            !title ||
            !scheduledate ||
            !scheduletime ||
            !Number.isInteger(capacity) ||
            capacity < 1
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Doctor, title, date, time and valid capacity are required"
            });
        }

        const [[doctor]] =
            await db.promise().query(
                "SELECT docid FROM doctor WHERE docid = ?",
                [doctorId]
            );

        if (!doctor) {

            return res.status(404).json({
                success: false,
                message: "Doctor not found"
            });
        }

        const [result] =
            await db.promise().query(
                `
                INSERT INTO schedule
                (
                    docid,
                    title,
                    scheduledate,
                    scheduletime,
                    nop
                )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    doctorId,
                    title,
                    scheduledate,
                    scheduletime,
                    capacity
                ]
            );

        return res.status(201).json({
            success: true,
            message: "Schedule created successfully",
            scheduleid: result.insertId
        });

    } catch (error) {

        return fail(res, error);
    }
});


// =====================================================
// 15. UPDATE SCHEDULE
// PUT /api/admin/schedules/:scheduleid
// =====================================================

router.put(
    "/schedules/:scheduleid",
    authenticateToken,
    async (req, res) => {

        try {

            if (!onlyAdmin(req, res)) return;

            const id =
                Number(req.params.scheduleid);

            const body =
                req.body || {};

            const doctorId =
                Number(body.docid);

            const capacity =
                Number(body.nop);

            const title =
                String(body.title || "").trim();

            if (
                !Number.isInteger(id) ||
                !Number.isInteger(doctorId) ||
                !title ||
                !body.scheduledate ||
                !body.scheduletime ||
                !Number.isInteger(capacity) ||
                capacity < 1
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Valid schedule data is required"
                });
            }

            const [[schedule]] =
                await db.promise().query(
                    "SELECT scheduleid FROM schedule WHERE scheduleid = ?",
                    [id]
                );

            if (!schedule) {

                return res.status(404).json({
                    success: false,
                    message: "Schedule not found"
                });
            }

            const [[bookings]] =
                await db.promise().query(
                    `
                    SELECT COUNT(*) AS total
                    FROM appointment
                    WHERE scheduleid = ?
                    `,
                    [id]
                );

            if (
                capacity <
                Number(bookings.total)
            ) {

                return res.status(409).json({
                    success: false,
                    message:
                        "Capacity cannot be below existing bookings"
                });
            }

            await db.promise().query(
                `
                UPDATE schedule
                SET
                    docid = ?,
                    title = ?,
                    scheduledate = ?,
                    scheduletime = ?,
                    nop = ?
                WHERE scheduleid = ?
                `,
                [
                    doctorId,
                    title,
                    body.scheduledate,
                    body.scheduletime,
                    capacity,
                    id
                ]
            );

            return res.json({
                success: true,
                message: "Schedule updated successfully"
            });

        } catch (error) {

            return fail(res, error);
        }
    }
);


// =====================================================
// 16. DELETE SCHEDULE
// DELETE /api/admin/schedules/:scheduleid
// =====================================================

router.delete(
    "/schedules/:scheduleid",
    authenticateToken,
    async (req, res) => {

        try {

            if (!onlyAdmin(req, res)) return;

            const id =
                Number(req.params.scheduleid);

            const [[schedule]] =
                await db.promise().query(
                    "SELECT scheduleid FROM schedule WHERE scheduleid = ?",
                    [id]
                );

            if (!schedule) {

                return res.status(404).json({
                    success: false,
                    message: "Schedule not found"
                });
            }

            await db.promise().query(
                "DELETE FROM appointment WHERE scheduleid = ?",
                [id]
            );

            await db.promise().query(
                "DELETE FROM schedule WHERE scheduleid = ?",
                [id]
            );

            return res.json({
                success: true,
                message: "Schedule deleted successfully"
            });

        } catch (error) {

            return fail(res, error);
        }
    }
);


// =====================================================
// 17. CHANGE ADMIN PASSWORD
// PUT /api/admin/change-password
// =====================================================

router.put(
    "/change-password",
    authenticateToken,
    async (req, res) => {

        try {

            if (!onlyAdmin(req, res)) return;

            const currentPassword =
                String(
                    req.body?.currentPassword || ""
                );

            const newPassword =
                String(
                    req.body?.newPassword || ""
                );

            if (
                !currentPassword ||
                !newPassword
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Current password and new password are required"
                });
            }

            if (
                newPassword.length < 6
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "New password must be at least 6 characters"
                });
            }

            const [admins] =
                await db.promise().query(
                    `
                    SELECT
                        aemail,
                        apassword
                    FROM admin
                    WHERE aemail = ?
                    LIMIT 1
                    `,
                    [
                        req.user.email
                    ]
                );

            if (!admins.length) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Admin account not found"
                });
            }

            const admin =
                admins[0];

            if (!admin.apassword) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Admin password is not configured"
                });
            }

            const passwordMatch =
                await bcrypt.compare(
                    currentPassword,
                    admin.apassword
                );

            if (!passwordMatch) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Current password is incorrect"
                });
            }

            const hashedPassword =
                await bcrypt.hash(
                    newPassword,
                    12
                );

            await db.promise().query(
                `
                UPDATE admin
                SET apassword = ?
                WHERE aemail = ?
                `,
                [
                    hashedPassword,
                    admin.aemail
                ]
            );

            return res.json({
                success: true,
                message:
                    "Password changed successfully"
            });

        } catch (error) {

            console.error(
                "Admin change password error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Server error while changing password"
            });
        }
    }
);


// =====================================================
// EXPORT
// =====================================================

module.exports = router;