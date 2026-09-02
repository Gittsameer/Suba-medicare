// =====================================================
// backend/routes/auth.js
// Patient API routes
// =====================================================

const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../config/db");

const {
    registerPatient,
    loginUser
} = require("../controllers/authController");

const authenticateToken =
    require("../middleware/authMiddleware");

const router = express.Router();


// =====================================================
// HELPER: PATIENT ONLY
// =====================================================

function requirePatient(req, res) {

    if (!req.user || req.user.role !== "p") {

        res.status(403).json({
            success: false,
            message: "Patient access only"
        });

        return false;
    }

    return true;
}


// =====================================================
// HELPER: GET LOGGED-IN PATIENT
// =====================================================

async function getPatient(req) {

    const [patients] =
        await db.promise().query(
            `SELECT
                pid,
                pemail,
                pname,
                paddress,
                pnic,
                pdob,
                ptel,
                ppassword
             FROM patient
             WHERE pemail = ?`,
            [req.user.email]
        );

    return patients[0] || null;
}


// =====================================================
// HELPER: SERVER ERROR
// =====================================================

function serverError(res, error) {

    console.error(error);

    return res.status(500).json({
        success: false,
        message: "Server error"
    });
}


// =====================================================
// 1. REGISTER
// POST /api/auth/register
// =====================================================

router.post(
    "/register",
    registerPatient
);


// =====================================================
// 2. LOGIN
// POST /api/auth/login
// =====================================================

router.post(
    "/login",
    loginUser
);


// =====================================================
// 3. PROTECTED TEST
// GET /api/auth/protected
// =====================================================

router.get(
    "/protected",
    authenticateToken,
    (req, res) => {

        res.json({
            success: true,
            message: "Protected route working",
            user: req.user
        });

    }
);


// =====================================================
// 4. PATIENT PROFILE
// GET /api/auth/profile
// =====================================================

router.get(
    "/profile",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requirePatient(req, res)) return;

            const patient =
                await getPatient(req);

            if (!patient) {

                return res.status(404).json({
                    success: false,
                    message: "Patient not found"
                });
            }

            delete patient.ppassword;

            res.json({
                success: true,
                patient
            });

        } catch (error) {

            serverError(res, error);
        }
    }
);


// =====================================================
// 5. DASHBOARD STATISTICS
// GET /api/auth/dashboard-stats
// =====================================================

router.get(
    "/dashboard-stats",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requirePatient(req, res)) return;

            const patient =
                await getPatient(req);

            if (!patient) {

                return res.status(404).json({
                    success: false,
                    message: "Patient not found"
                });
            }

            const [[doctorCount]] =
                await db.promise().query(
                    `SELECT COUNT(*) AS total
                     FROM doctor`
                );

            const [[patientCount]] =
                await db.promise().query(
                    `SELECT COUNT(*) AS total
                     FROM patient`
                );

            const [[bookingCount]] =
                await db.promise().query(
                    `SELECT COUNT(*) AS total
                     FROM appointment
                     WHERE pid = ?`,
                    [patient.pid]
                );

            const [[todaySessions]] =
                await db.promise().query(
                    `SELECT COUNT(*) AS total
                     FROM schedule
                     WHERE scheduledate = CURDATE()`
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
// 6. UPCOMING APPOINTMENTS
// GET /api/auth/upcoming-appointments
// =====================================================

router.get(
    "/upcoming-appointments",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requirePatient(req, res)) return;

            const patient =
                await getPatient(req);

            if (!patient) {

                return res.status(404).json({
                    success: false,
                    message: "Patient not found"
                });
            }

            const [appointments] =
                await db.promise().query(
                    `SELECT
                        a.appoid,
                        a.apponum,
                        a.appodate,
                        s.title,
                        s.scheduledate,
                        s.scheduletime,
                        d.docname,
                        sp.sname AS specialty
                     FROM appointment a
                     JOIN schedule s
                       ON a.scheduleid = s.scheduleid
                     LEFT JOIN doctor d
                       ON s.docid = d.docid
                     LEFT JOIN specialties sp
                       ON d.specialties = sp.id
                     WHERE a.pid = ?
                       AND s.scheduledate >= CURDATE()
                     ORDER BY
                        s.scheduledate ASC,
                        s.scheduletime ASC`,
                    [patient.pid]
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
// 7. ALL DOCTORS
// GET /api/auth/doctors
// =====================================================

router.get(
    "/doctors",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requirePatient(req, res)) return;

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
// 8. AVAILABLE SESSIONS
// GET /api/auth/sessions
// =====================================================

router.get(
    "/sessions",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requirePatient(req, res)) return;

            const [sessions] =
                await db.promise().query(
                    `SELECT
                        s.scheduleid,
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
                       ON s.docid = d.docid
                     LEFT JOIN specialties sp
                       ON d.specialties = sp.id
                     LEFT JOIN appointment a
                       ON a.scheduleid = s.scheduleid
                     WHERE s.scheduledate >= CURDATE()
                     GROUP BY
                        s.scheduleid,
                        s.title,
                        s.scheduledate,
                        s.scheduletime,
                        s.nop,
                        d.docname,
                        d.docemail,
                        sp.sname
                     ORDER BY
                        s.scheduledate ASC,
                        s.scheduletime ASC`
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
// 9. BOOK APPOINTMENT
// POST /api/auth/book-appointment
// =====================================================

router.post(
    "/book-appointment",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requirePatient(req, res)) return;

            const scheduleid =
                Number(req.body.scheduleid);

            if (
                !Number.isInteger(scheduleid) ||
                scheduleid <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "A valid schedule ID is required"
                });
            }

            const patient =
                await getPatient(req);

            if (!patient) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Patient not found"
                });
            }

            const [sessions] =
                await db.promise().query(
                    `SELECT
                        scheduleid,
                        nop,
                        scheduledate
                     FROM schedule
                     WHERE scheduleid = ?
                       AND scheduledate >= CURDATE()`,
                    [scheduleid]
                );

            if (!sessions.length) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Session not found or expired"
                });
            }

            const [[existingBooking]] =
                await db.promise().query(
                    `SELECT appoid
                     FROM appointment
                     WHERE pid = ?
                       AND scheduleid = ?
                     LIMIT 1`,
                    [
                        patient.pid,
                        scheduleid
                    ]
                );

            if (existingBooking) {

                return res.status(409).json({
                    success: false,
                    message:
                        "You have already booked this session"
                });
            }

            const [[bookingCount]] =
                await db.promise().query(
                    `SELECT COUNT(*) AS total
                     FROM appointment
                     WHERE scheduleid = ?`,
                    [scheduleid]
                );

            if (
                sessions[0].nop !== null &&
                bookingCount.total >= sessions[0].nop
            ) {

                return res.status(409).json({
                    success: false,
                    message:
                        "This session is fully booked"
                });
            }

            const [[lastAppointment]] =
                await db.promise().query(
                    `SELECT MAX(apponum) AS maxNumber
                     FROM appointment
                     WHERE scheduleid = ?`,
                    [scheduleid]
                );

            const apponum =
                Number(
                    lastAppointment.maxNumber || 0
                ) + 1;

            const [result] =
                await db.promise().query(
                    `INSERT INTO appointment
                        (
                            pid,
                            apponum,
                            scheduleid,
                            appodate
                        )
                     VALUES (?, ?, ?, CURDATE())`,
                    [
                        patient.pid,
                        apponum,
                        scheduleid
                    ]
                );

            res.status(201).json({
                success: true,
                message:
                    "Appointment booked successfully",
                appoid: result.insertId,
                apponum,
                scheduleid
            });

        } catch (error) {

            serverError(res, error);
        }
    }
);


// =====================================================
// 10. MY APPOINTMENTS
// GET /api/auth/my-appointments
// =====================================================

router.get(
    "/my-appointments",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requirePatient(req, res)) return;

            const patient =
                await getPatient(req);

            if (!patient) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Patient not found"
                });
            }

            const [appointments] =
                await db.promise().query(
                    `SELECT
                        a.appoid,
                        a.apponum,
                        a.appodate,
                        s.scheduleid,
                        s.title,
                        s.scheduledate,
                        s.scheduletime,
                        d.docname,
                        sp.sname AS specialty
                     FROM appointment a
                     JOIN schedule s
                       ON a.scheduleid = s.scheduleid
                     LEFT JOIN doctor d
                       ON s.docid = d.docid
                     LEFT JOIN specialties sp
                       ON d.specialties = sp.id
                     WHERE a.pid = ?
                     ORDER BY
                        s.scheduledate DESC,
                        s.scheduletime DESC`,
                    [patient.pid]
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
// 11. CANCEL APPOINTMENT
// DELETE /api/auth/cancel-appointment/:appoid
// =====================================================

router.delete(
    "/cancel-appointment/:appoid",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requirePatient(req, res)) return;

            const patient =
                await getPatient(req);

            const appoid =
                Number(req.params.appoid);

            if (!patient) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Patient not found"
                });
            }

            if (
                !Number.isInteger(appoid) ||
                appoid <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid appointment ID"
                });
            }

            const [result] =
                await db.promise().query(
                    `DELETE FROM appointment
                     WHERE appoid = ?
                       AND pid = ?`,
                    [
                        appoid,
                        patient.pid
                    ]
                );

            if (!result.affectedRows) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Appointment not found"
                });
            }

            res.json({
                success: true,
                message:
                    "Appointment cancelled successfully"
            });

        } catch (error) {

            serverError(res, error);
        }
    }
);


// =====================================================
// 12. MY ACCOUNT
// GET /api/auth/my-account
// =====================================================

router.get(
    "/my-account",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requirePatient(req, res)) return;

            const patient =
                await getPatient(req);

            if (!patient) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Patient not found"
                });
            }

            delete patient.ppassword;

            res.json({
                success: true,
                patient
            });

        } catch (error) {

            serverError(res, error);
        }
    }
);


// =====================================================
// 13. UPDATE ACCOUNT
// PUT /api/auth/update-account
// =====================================================

router.put(
    "/update-account",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requirePatient(req, res)) return;

            const {
                pname,
                paddress,
                pnic,
                pdob,
                ptel
            } = req.body || {};

            if (
                !pname ||
                !paddress ||
                !pnic ||
                !pdob ||
                !ptel
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "All account fields are required"
                });
            }

            const [result] =
                await db.promise().query(
                    `UPDATE patient
                     SET
                        pname = ?,
                        paddress = ?,
                        pnic = ?,
                        pdob = ?,
                        ptel = ?
                     WHERE pemail = ?`,
                    [
                        String(pname).trim(),
                        String(paddress).trim(),
                        String(pnic).trim(),
                        pdob,
                        String(ptel).trim(),
                        req.user.email
                    ]
                );

            if (!result.affectedRows) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Patient not found"
                });
            }

            res.json({
                success: true,
                message:
                    "Account updated successfully"
            });

        } catch (error) {

            serverError(res, error);
        }
    }
);


// =====================================================
// 14. CHANGE PASSWORD
// PUT /api/auth/change-password
// =====================================================

router.put(
    "/change-password",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requirePatient(req, res)) return;

            const {
                currentPassword,
                newPassword
            } = req.body || {};

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

            if (newPassword.length < 6) {

                return res.status(400).json({
                    success: false,
                    message:
                        "New password must be at least 6 characters"
                });
            }

            const patient =
                await getPatient(req);

            if (!patient) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Patient not found"
                });
            }

            const passwordMatches =
                await bcrypt.compare(
                    currentPassword,
                    patient.ppassword
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
                `UPDATE patient
                 SET ppassword = ?
                 WHERE pid = ?`,
                [
                    hashedPassword,
                    patient.pid
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
// 15. GET DEPENDENTS
// GET /api/auth/dependents
//
// DATABASE:
// dependent
// ├── patientid
// └── dependentname
//
// PRIMARY KEY:
// (patientid, dependentname)
//
// patientid refers to patient.pid
// =====================================================

router.get(
    "/dependents",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requirePatient(req, res)) return;

            const patient =
                await getPatient(req);

            if (!patient) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Patient not found"
                });
            }

            const [dependents] =
                await db.promise().query(
                    `SELECT
                        patientid,
                        dependentname
                     FROM dependent
                     WHERE patientid = ?
                     ORDER BY dependentname ASC`,
                    [patient.pid]
                );

            res.json({
                success: true,
                dependents
            });

        } catch (error) {

            serverError(res, error);
        }
    }
);


// =====================================================
// 16. ADD DEPENDENT
// POST /api/auth/add-dependent
// =====================================================

router.post(
    "/add-dependent",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requirePatient(req, res)) return;

            const dependentname =
                typeof req.body?.dependentname === "string"
                    ? req.body.dependentname.trim()
                    : "";

            if (!dependentname) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Dependent name is required"
                });
            }

            const patient =
                await getPatient(req);

            if (!patient) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Patient not found"
                });
            }

            const [existing] =
                await db.promise().query(
                    `SELECT
                        patientid,
                        dependentname
                     FROM dependent
                     WHERE patientid = ?
                       AND dependentname = ?`,
                    [
                        patient.pid,
                        dependentname
                    ]
                );

            if (existing.length > 0) {

                return res.status(409).json({
                    success: false,
                    message:
                        "This dependent already exists"
                });
            }

            await db.promise().query(
                `INSERT INTO dependent
                    (
                        patientid,
                        dependentname
                    )
                 VALUES (?, ?)`,
                [
                    patient.pid,
                    dependentname
                ]
            );

            res.status(201).json({
                success: true,
                message:
                    "Dependent added successfully"
            });

        } catch (error) {

            if (error.code === "ER_DUP_ENTRY") {

                return res.status(409).json({
                    success: false,
                    message:
                        "This dependent already exists"
                });
            }

            serverError(res, error);
        }
    }
);


// =====================================================
// 17. UPDATE OR REMOVE DEPENDENT
// PUT /api/auth/update-dependent
//
// Empty name:
//     Delete all dependents.
//
// No dependent:
//     Add new dependent.
//
// Existing dependent:
//     Update first dependent.
//
// No dependentid is used.
// =====================================================

router.put(
    "/update-dependent",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requirePatient(req, res)) return;

            const dependentname =
                typeof req.body?.dependentname === "string"
                    ? req.body.dependentname.trim()
                    : "";

            const patient =
                await getPatient(req);

            if (!patient) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Patient not found"
                });
            }

            const [dependents] =
                await db.promise().query(
                    `SELECT
                        patientid,
                        dependentname
                     FROM dependent
                     WHERE patientid = ?
                     ORDER BY dependentname ASC`,
                    [patient.pid]
                );


            // =========================================
            // EMPTY NAME = DELETE ALL
            // =========================================

            if (!dependentname) {

                if (dependents.length > 0) {

                    await db.promise().query(
                        `DELETE FROM dependent
                         WHERE patientid = ?`,
                        [patient.pid]
                    );

                    return res.json({
                        success: true,
                        message:
                            "Dependent removed successfully"
                    });
                }

                return res.json({
                    success: true,
                    message:
                        "No dependent to remove"
                });
            }


            // =========================================
            // NO EXISTING DEPENDENT = ADD
            // =========================================

            if (dependents.length === 0) {

                await db.promise().query(
                    `INSERT INTO dependent
                        (
                            patientid,
                            dependentname
                        )
                     VALUES (?, ?)`,
                    [
                        patient.pid,
                        dependentname
                    ]
                );

                return res.json({
                    success: true,
                    message:
                        "Dependent added successfully"
                });
            }


            // =========================================
            // EXISTING DEPENDENT = UPDATE
            // =========================================

            const oldName =
                dependents[0].dependentname;


            // Same name

            if (oldName === dependentname) {

                return res.json({
                    success: true,
                    message:
                        "Dependent unchanged"
                });
            }


            // Check duplicate

            const [duplicate] =
                await db.promise().query(
                    `SELECT
                        patientid,
                        dependentname
                     FROM dependent
                     WHERE patientid = ?
                       AND dependentname = ?`,
                    [
                        patient.pid,
                        dependentname
                    ]
                );

            if (duplicate.length > 0) {

                return res.status(409).json({
                    success: false,
                    message:
                        "This dependent already exists"
                });
            }


            // Update using composite key

            const [result] =
                await db.promise().query(
                    `UPDATE dependent
                     SET dependentname = ?
                     WHERE patientid = ?
                       AND dependentname = ?`,
                    [
                        dependentname,
                        patient.pid,
                        oldName
                    ]
                );


            if (!result.affectedRows) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Dependent not found"
                });
            }


            res.json({
                success: true,
                message:
                    "Dependent updated successfully"
            });

        } catch (error) {

            if (error.code === "ER_DUP_ENTRY") {

                return res.status(409).json({
                    success: false,
                    message:
                        "This dependent already exists"
                });
            }

            serverError(res, error);
        }
    }
);


// =====================================================
// 18. DELETE ONE DEPENDENT
// DELETE /api/auth/delete-dependent/:dependentName
// =====================================================

router.delete(
    "/delete-dependent/:dependentName",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requirePatient(req, res)) return;

            const patient =
                await getPatient(req);

            if (!patient) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Patient not found"
                });
            }

            const dependentName =
                decodeURIComponent(
                    req.params.dependentName
                ).trim();

            if (!dependentName) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Dependent name is required"
                });
            }

            const [result] =
                await db.promise().query(
                    `DELETE FROM dependent
                     WHERE patientid = ?
                       AND dependentname = ?`,
                    [
                        patient.pid,
                        dependentName
                    ]
                );

            if (!result.affectedRows) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Dependent not found"
                });
            }

            res.json({
                success: true,
                message:
                    "Dependent deleted successfully"
            });

        } catch (error) {

            serverError(res, error);
        }
    }
);


// =====================================================
// 19. DELETE PATIENT ACCOUNT
// DELETE /api/auth/delete-account
// =====================================================

router.delete(
    "/delete-account",
    authenticateToken,
    async (req, res) => {

        try {

            if (!requirePatient(req, res)) return;

            const patient =
                await getPatient(req);

            if (!patient) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Patient not found"
                });
            }


            // Delete appointments

            await db.promise().query(
                `DELETE FROM appointment
                 WHERE pid = ?`,
                [patient.pid]
            );


            // Delete dependents

            await db.promise().query(
                `DELETE FROM dependent
                 WHERE patientid = ?`,
                [patient.pid]
            );


            // Delete patient

            await db.promise().query(
                `DELETE FROM patient
                 WHERE pid = ?`,
                [patient.pid]
            );


            // Delete login record

            await db.promise().query(
                `DELETE FROM webuser
                 WHERE email = ?`,
                [req.user.email]
            );


            res.json({
                success: true,
                message:
                    "Account deleted successfully"
            });

        } catch (error) {

            serverError(res, error);
        }
    }
);


// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;