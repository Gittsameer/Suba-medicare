const express = require("express");
const bcrypt = require("bcrypt");

const db = require("../config/db");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();


// =====================================================
// HELPER: ONLY DOCTORS
// =====================================================

function requireDoctor(req, res) {

    if (req.user.role !== "d") {

        res.status(403).json({
            success: false,
            message: "Doctor access only"
        });

        return false;
    }

    return true;
}


// =====================================================
// HELPER: GET LOGGED-IN DOCTOR
// =====================================================

async function getDoctor(req) {

    const [doctors] = await db.promise().query(
        `SELECT
            docid,
            docemail,
            docname,
            docpassword,
            docnic,
            doctel,
            specialties
         FROM doctor
         WHERE docemail = ?`,
        [req.user.email]
    );

    return doctors[0] || null;
}


// =====================================================
// HELPER: SERVER ERROR
// =====================================================

function serverError(res, error) {

    console.error("Doctor API error:", error);

    return res.status(500).json({
        success: false,
        message: "Server error"
    });
}


// =====================================================
// 1. DOCTOR PROFILE
// GET /api/doctor/profile
// =====================================================

router.get(
    "/profile",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requireDoctor(req, res)) return;

            const doctor = await getDoctor(req);

            if (!doctor) {

                return res.status(404).json({
                    success: false,
                    message: "Doctor not found"
                });

            }

            delete doctor.docpassword;

            res.json({
                success: true,
                doctor
            });

        } catch (error) {

            serverError(res, error);

        }

    }
);


// =====================================================
// 2. DOCTOR DASHBOARD STATISTICS
// GET /api/doctor/dashboard-stats
// =====================================================

router.get(
    "/dashboard-stats",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requireDoctor(req, res)) return;

            const doctor = await getDoctor(req);

            if (!doctor) {

                return res.status(404).json({
                    success: false,
                    message: "Doctor not found"
                });

            }


            // Total doctors

            const [[doctorCount]] =
                await db.promise().query(
                    `SELECT COUNT(*) AS total
                     FROM doctor`
                );


            // Total patients

            const [[patientCount]] =
                await db.promise().query(
                    `SELECT COUNT(*) AS total
                     FROM patient`
                );


            // Total bookings for this doctor

            const [[bookingCount]] =
                await db.promise().query(
                    `SELECT COUNT(*) AS total
                     FROM appointment a
                     INNER JOIN schedule s
                        ON a.scheduleid = s.scheduleid
                     WHERE s.docid = ?`,
                    [doctor.docid]
                );


            // Today's sessions

            const [[todaySessions]] =
                await db.promise().query(
                    `SELECT COUNT(*) AS total
                     FROM schedule
                     WHERE docid = ?
                     AND scheduledate = CURDATE()`,
                    [doctor.docid]
                );


            res.json({

                success: true,

                doctors: doctorCount.total,

                patients: patientCount.total,

                bookings: bookingCount.total,

                todaySessions: todaySessions.total

            });


        } catch (error) {

            serverError(res, error);

        }

    }
);


// =====================================================
// 3. UPCOMING DOCTOR SESSIONS
// GET /api/doctor/upcoming-sessions
// =====================================================

router.get(
    "/upcoming-sessions",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requireDoctor(req, res)) return;

            const doctor = await getDoctor(req);

            if (!doctor) {

                return res.status(404).json({
                    success: false,
                    message: "Doctor not found"
                });

            }


            const [sessions] =
                await db.promise().query(
                    `SELECT
                        s.scheduleid,
                        s.title,
                        s.scheduledate,
                        s.scheduletime,
                        s.nop,
                        COUNT(a.appoid) AS bookedSeats
                     FROM schedule s
                     LEFT JOIN appointment a
                        ON s.scheduleid = a.scheduleid
                     WHERE s.docid = ?
                     AND s.scheduledate >= CURDATE()
                     AND s.scheduledate <= DATE_ADD(
                         CURDATE(),
                         INTERVAL 7 DAY
                     )
                     GROUP BY
                        s.scheduleid,
                        s.title,
                        s.scheduledate,
                        s.scheduletime,
                        s.nop
                     ORDER BY
                        s.scheduledate ASC,
                        s.scheduletime ASC`,
                    [doctor.docid]
                );


            res.json({
                success: true,
                sessions
            });


        } catch (error) {

            serverError(res, error);

        }

    }
);


// =====================================================
// 4. DOCTOR APPOINTMENTS
// GET /api/doctor/appointments
// =====================================================

router.get(
    "/appointments",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requireDoctor(req, res)) return;

            const doctor = await getDoctor(req);

            if (!doctor) {

                return res.status(404).json({
                    success: false,
                    message: "Doctor not found"
                });

            }


            const date =
                req.query.date || "";


            let sql = `
                SELECT
                    a.appoid,
                    a.apponum,
                    a.appodate,

                    p.pid,
                    p.pname,
                    p.pemail,
                    p.pnic,
                    p.ptel,
                    p.pdob,

                    s.scheduleid,
                    s.title,
                    s.scheduledate,
                    s.scheduletime

                FROM appointment a

                INNER JOIN schedule s
                    ON a.scheduleid = s.scheduleid

                INNER JOIN patient p
                    ON a.pid = p.pid

                WHERE s.docid = ?
            `;


            const params = [doctor.docid];


            if (date) {

                sql += `
                    AND s.scheduledate = ?
                `;

                params.push(date);

            }


            sql += `
                ORDER BY
                    s.scheduledate DESC,
                    s.scheduletime DESC
            `;


            const [appointments] =
                await db.promise().query(
                    sql,
                    params
                );


            res.json({
                success: true,
                appointments
            });


        } catch (error) {

            serverError(res, error);

        }

    }
);


// =====================================================
// 5. DOCTOR SESSIONS
// GET /api/doctor/schedules
// =====================================================

router.get(
    "/schedules",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requireDoctor(req, res)) return;

            const doctor = await getDoctor(req);

            if (!doctor) {

                return res.status(404).json({
                    success: false,
                    message: "Doctor not found"
                });

            }


            const date =
                req.query.date || "";


            let sql = `
                SELECT
                    s.scheduleid,
                    s.docid,
                    s.title,
                    s.scheduledate,
                    s.scheduletime,
                    s.nop,

                    COUNT(a.appoid) AS bookedSeats

                FROM schedule s

                LEFT JOIN appointment a
                    ON s.scheduleid = a.scheduleid

                WHERE s.docid = ?
            `;


            const params = [doctor.docid];


            if (date) {

                sql += `
                    AND s.scheduledate = ?
                `;

                params.push(date);

            }


            sql += `
                GROUP BY
                    s.scheduleid,
                    s.docid,
                    s.title,
                    s.scheduledate,
                    s.scheduletime,
                    s.nop

                ORDER BY
                    s.scheduledate DESC,
                    s.scheduletime DESC
            `;


            const [schedules] =
                await db.promise().query(
                    sql,
                    params
                );


            res.json({
                success: true,
                schedules
            });


        } catch (error) {

            serverError(res, error);

        }

    }
);


// =====================================================
// 6. CREATE SESSION
// POST /api/doctor/schedules
// =====================================================

router.post(
    "/schedules",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requireDoctor(req, res)) return;

            const doctor = await getDoctor(req);

            if (!doctor) {

                return res.status(404).json({
                    success: false,
                    message: "Doctor not found"
                });

            }


            const {
                title,
                scheduledate,
                scheduletime,
                nop
            } = req.body;


            if (
                !title ||
                !scheduledate ||
                !scheduletime ||
                nop === undefined ||
                nop === null
            ) {

                return res.status(400).json({
                    success: false,
                    message: "All session fields are required"
                });

            }


            const maxPatients =
                Number(nop);


            if (
                !Number.isInteger(maxPatients) ||
                maxPatients <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Maximum bookings must be a positive number"
                });

            }


            const [result] =
                await db.promise().query(
                    `INSERT INTO schedule
                    (
                        docid,
                        title,
                        scheduledate,
                        scheduletime,
                        nop
                    )
                    VALUES (?, ?, ?, ?, ?)`,
                    [
                        doctor.docid,
                        title.trim(),
                        scheduledate,
                        scheduletime,
                        maxPatients
                    ]
                );


            res.status(201).json({

                success: true,

                message: "Session created successfully",

                scheduleid:
                    result.insertId

            });


        } catch (error) {

            serverError(res, error);

        }

    }
);


// =====================================================
// 7. UPDATE SESSION
// PUT /api/doctor/schedules/:scheduleid
// =====================================================

router.put(
    "/schedules/:scheduleid",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requireDoctor(req, res)) return;

            const doctor = await getDoctor(req);

            if (!doctor) {

                return res.status(404).json({
                    success: false,
                    message: "Doctor not found"
                });

            }


            const scheduleid =
                Number(req.params.scheduleid);


            const {
                title,
                scheduledate,
                scheduletime,
                nop
            } = req.body;


            if (
                !Number.isInteger(scheduleid) ||
                scheduleid <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Invalid schedule ID"
                });

            }


            if (
                !title ||
                !scheduledate ||
                !scheduletime ||
                nop === undefined
            ) {

                return res.status(400).json({
                    success: false,
                    message: "All session fields are required"
                });

            }


            const maxPatients =
                Number(nop);


            if (
                !Number.isInteger(maxPatients) ||
                maxPatients <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Maximum bookings must be a positive number"
                });

            }


            const [result] =
                await db.promise().query(
                    `UPDATE schedule
                     SET
                        title = ?,
                        scheduledate = ?,
                        scheduletime = ?,
                        nop = ?
                     WHERE scheduleid = ?
                     AND docid = ?`,
                    [
                        title.trim(),
                        scheduledate,
                        scheduletime,
                        maxPatients,
                        scheduleid,
                        doctor.docid
                    ]
                );


            if (!result.affectedRows) {

                return res.status(404).json({
                    success: false,
                    message: "Session not found"
                });

            }


            res.json({
                success: true,
                message: "Session updated successfully"
            });


        } catch (error) {

            serverError(res, error);

        }

    }
);


// =====================================================
// 8. DELETE SESSION
// DELETE /api/doctor/schedules/:scheduleid
// =====================================================

router.delete(
    "/schedules/:scheduleid",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requireDoctor(req, res)) return;

            const doctor = await getDoctor(req);

            if (!doctor) {

                return res.status(404).json({
                    success: false,
                    message: "Doctor not found"
                });

            }


            const scheduleid =
                Number(req.params.scheduleid);


            if (
                !Number.isInteger(scheduleid) ||
                scheduleid <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Invalid schedule ID"
                });

            }


            // Check whether this doctor's session exists.

            const [sessions] =
                await db.promise().query(
                    `SELECT scheduleid
                     FROM schedule
                     WHERE scheduleid = ?
                     AND docid = ?`,
                    [
                        scheduleid,
                        doctor.docid
                    ]
                );


            if (!sessions.length) {

                return res.status(404).json({
                    success: false,
                    message: "Session not found"
                });

            }


            // Delete appointments belonging
            // to this session first.

            await db.promise().query(
                `DELETE FROM appointment
                 WHERE scheduleid = ?`,
                [scheduleid]
            );


            // Delete session.

            await db.promise().query(
                `DELETE FROM schedule
                 WHERE scheduleid = ?
                 AND docid = ?`,
                [
                    scheduleid,
                    doctor.docid
                ]
            );


            res.json({
                success: true,
                message: "Session deleted successfully"
            });


        } catch (error) {

            serverError(res, error);

        }

    }
);


// =====================================================
// 9. DOCTOR PATIENTS
// GET /api/doctor/patients
// =====================================================

router.get(
    "/patients",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requireDoctor(req, res)) return;

            const doctor = await getDoctor(req);

            if (!doctor) {

                return res.status(404).json({
                    success: false,
                    message: "Doctor not found"
                });

            }


            const search =
                String(
                    req.query.search || ""
                ).trim();


            let sql = `
                SELECT DISTINCT
                    p.pid,
                    p.pname,
                    p.pemail,
                    p.pnic,
                    p.ptel,
                    p.pdob

                FROM patient p

                INNER JOIN appointment a
                    ON p.pid = a.pid

                INNER JOIN schedule s
                    ON a.scheduleid = s.scheduleid

                WHERE s.docid = ?
            `;


            const params =
                [doctor.docid];


            if (search) {

                sql += `
                    AND (
                        p.pname LIKE ?
                        OR p.pemail LIKE ?
                        OR p.pnic LIKE ?
                        OR p.ptel LIKE ?
                    )
                `;


                const searchValue =
                    `%${search}%`;


                params.push(
                    searchValue,
                    searchValue,
                    searchValue,
                    searchValue
                );

            }


            sql += `
                ORDER BY p.pname ASC
            `;


            const [patients] =
                await db.promise().query(
                    sql,
                    params
                );


            res.json({
                success: true,
                patients
            });


        } catch (error) {

            serverError(res, error);

        }

    }
);


// =====================================================
// 10. ALL DOCTORS
// GET /api/doctor/doctors
// =====================================================

router.get(
    "/doctors",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requireDoctor(req, res)) return;


            const [doctors] =
                await db.promise().query(
                    `SELECT
                        d.docid,
                        d.docname,
                        d.docemail,
                        sp.sname AS specialty

                     FROM doctor d

                     LEFT JOIN specialties sp
                        ON d.specialties = sp.id

                     ORDER BY d.docname ASC`
                );


            res.json({
                success: true,
                doctors
            });


        } catch (error) {

            serverError(res, error);

        }

    }
);


// =====================================================
// 11. GET DOCTOR ACCOUNT
// GET /api/doctor/my-account
// =====================================================

router.get(
    "/my-account",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requireDoctor(req, res)) return;

            const doctor =
                await getDoctor(req);


            if (!doctor) {

                return res.status(404).json({
                    success: false,
                    message: "Doctor not found"
                });

            }


            delete doctor.docpassword;


            res.json({
                success: true,
                doctor
            });


        } catch (error) {

            serverError(res, error);

        }

    }
);


// =====================================================
// 12. UPDATE DOCTOR ACCOUNT
// PUT /api/doctor/update-account
// =====================================================

router.put(
    "/update-account",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requireDoctor(req, res)) return;


            const doctor =
                await getDoctor(req);


            if (!doctor) {

                return res.status(404).json({
                    success: false,
                    message: "Doctor not found"
                });

            }


            const {
                docname,
                docnic,
                doctel
            } = req.body;


            if (
                !docname ||
                !docnic ||
                !doctel
            ) {

                return res.status(400).json({
                    success: false,
                    message: "All account fields are required"
                });

            }


            await db.promise().query(
                `UPDATE doctor

                 SET
                    docname = ?,
                    docnic = ?,
                    doctel = ?

                 WHERE docid = ?`,
                [
                    docname.trim(),
                    docnic.trim(),
                    doctel.trim(),
                    doctor.docid
                ]
            );


            res.json({
                success: true,
                message: "Account updated successfully"
            });


        } catch (error) {

            serverError(res, error);

        }

    }
);


// =====================================================
// 13. CHANGE DOCTOR PASSWORD
// PUT /api/doctor/change-password
// =====================================================

router.put(
    "/change-password",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requireDoctor(req, res)) return;


            const {
                currentPassword,
                newPassword
            } = req.body;


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


            const doctor =
                await getDoctor(req);


            if (!doctor) {

                return res.status(404).json({
                    success: false,
                    message: "Doctor not found"
                });

            }


            const passwordMatches =
                await bcrypt.compare(
                    currentPassword,
                    doctor.docpassword
                );


            if (!passwordMatches) {

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
                `UPDATE doctor
                 SET docpassword = ?
                 WHERE docid = ?`,
                [
                    hashedPassword,
                    doctor.docid
                ]
            );


            res.json({
                success: true,
                message:
                    "Password changed successfully"
            });


        } catch (error) {

            serverError(res, error);

        }

    }
);


// =====================================================
// 14. DELETE DOCTOR ACCOUNT
// DELETE /api/doctor/delete-account
// =====================================================

router.delete(
    "/delete-account",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requireDoctor(req, res)) return;


            const doctor =
                await getDoctor(req);


            if (!doctor) {

                return res.status(404).json({
                    success: false,
                    message: "Doctor not found"
                });

            }


            // Get doctor's sessions.

            const [sessions] =
                await db.promise().query(
                    `SELECT scheduleid
                     FROM schedule
                     WHERE docid = ?`,
                    [doctor.docid]
                );


            // Delete appointments for
            // doctor's sessions.

            for (
                const session of sessions
            ) {

                await db.promise().query(
                    `DELETE FROM appointment
                     WHERE scheduleid = ?`,
                    [session.scheduleid]
                );

            }


            // Delete sessions.

            await db.promise().query(
                `DELETE FROM schedule
                 WHERE docid = ?`,
                [doctor.docid]
            );


            // Delete doctor.

            await db.promise().query(
                `DELETE FROM doctor
                 WHERE docid = ?`,
                [doctor.docid]
            );


            // Delete login record.

            await db.promise().query(
                `DELETE FROM webuser
                 WHERE email = ?`,
                [req.user.email]
            );


            res.json({
                success: true,
                message:
                    "Doctor account deleted successfully"
            });


        } catch (error) {

            serverError(res, error);

        }

    }
);


// =====================================================
// EXPORT
// =====================================================

module.exports = router;