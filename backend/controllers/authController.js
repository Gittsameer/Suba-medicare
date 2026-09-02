const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

// ===============================
// PATIENT REGISTRATION
// ===============================
const registerPatient = async (req, res) => {
    try {
        const {
            email,
            password,
            first_name,
            last_name,
            address,
            nic,
            dob,
            phone
        } = req.body || {};

        // Check required fields
        if (!email || !password || !first_name || !last_name) {
            return res.status(400).json({
                success: false,
                message:
                    "Email, password, first name and last name are required"
            });
        }

        const normalizedEmail =
            String(email).trim().toLowerCase();

        // Check if email already exists
        const [existingUser] = await db.promise().query(
            `SELECT *
             FROM webuser
             WHERE LOWER(email) = ?`,
            [normalizedEmail]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        // Hash password
        const hashedPassword =
            await bcrypt.hash(password, 12);

        // Insert patient
        await db.promise().query(
            `INSERT INTO patient
            (
                pemail,
                pname,
                ppassword,
                paddress,
                pnic,
                pdob,
                ptel
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                normalizedEmail,
                `${first_name} ${last_name}`,
                hashedPassword,
                address || null,
                nic || null,
                dob || null,
                phone || null
            ]
        );

        // Insert patient role
        await db.promise().query(
            `INSERT INTO webuser
             (email, usertype)
             VALUES (?, 'p')`,
            [normalizedEmail]
        );

        return res.status(201).json({
            success: true,
            message: "Patient registered successfully"
        });

    } catch (error) {

        console.error(
            "Patient registration error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error during registration"
        });
    }
};


// ===============================
// LOGIN
// ===============================
const loginUser = async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body || {};


        // -------------------------------
        // Validate input
        // -------------------------------

        if (!email || !password) {

            return res.status(400).json({
                success: false,
                message:
                    "Email and password are required"
            });
        }


        // -------------------------------
        // IMPORTANT:
        // Declare loginEmail BEFORE using it
        // -------------------------------

        const loginEmail =
            String(email)
                .trim()
                .toLowerCase();


        // -------------------------------
        // Find user role
        // -------------------------------

        const [users] =
            await db.promise().query(
                `SELECT
                    email,
                    usertype
                 FROM webuser
                 WHERE LOWER(email) = ?`,
                [loginEmail]
            );


        if (users.length === 0) {

            return res.status(401).json({
                success: false,
                message:
                    "Invalid email or password"
            });
        }


        const user = users[0];


        // -------------------------------
        // Validate role
        // -------------------------------

        if (
            user.usertype !== "p" &&
            user.usertype !== "d" &&
            user.usertype !== "a"
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "Invalid user role"
            });
        }


        let storedPassword = null;


        // ===============================
        // PATIENT
        // ===============================

        if (user.usertype === "p") {

            const [rows] =
                await db.promise().query(
                    `SELECT
                        ppassword AS password
                     FROM patient
                     WHERE LOWER(pemail) = ?`,
                    [loginEmail]
                );


            if (rows.length > 0) {

                storedPassword =
                    rows[0].password;

            }
        }


        // ===============================
        // DOCTOR
        // ===============================

        else if (user.usertype === "d") {

            const [rows] =
                await db.promise().query(
                    `SELECT
                        docpassword AS password
                     FROM doctor
                     WHERE LOWER(docemail) = ?`,
                    [loginEmail]
                );


            if (rows.length > 0) {

                storedPassword =
                    rows[0].password;

            }
        }


        // ===============================
        // ADMIN
        // ===============================

        else if (user.usertype === "a") {

            const [rows] =
                await db.promise().query(
                    `SELECT
                        apassword AS password
                     FROM admin
                     WHERE LOWER(aemail) = ?`,
                    [loginEmail]
                );


            if (rows.length > 0) {

                storedPassword =
                    rows[0].password;

            }
        }


        // -------------------------------
        // Password missing
        // -------------------------------

        if (!storedPassword) {

            return res.status(401).json({
                success: false,
                message:
                    "Account credentials are not configured"
            });
        }


        // -------------------------------
        // Compare bcrypt password
        // -------------------------------

        const passwordMatch =
            await bcrypt.compare(
                password,
                storedPassword
            );


        if (!passwordMatch) {

            return res.status(401).json({
                success: false,
                message:
                    "Invalid email or password"
            });
        }


        // -------------------------------
        // JWT secret check
        // -------------------------------

        if (!process.env.JWT_SECRET) {

            console.error(
                "JWT_SECRET is missing from .env"
            );

            return res.status(500).json({
                success: false,
                message:
                    "JWT secret is not configured"
            });
        }


        // -------------------------------
        // Create JWT
        // -------------------------------

        const token =
            jwt.sign(
                {
                    email: loginEmail,
                    role: user.usertype
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "1h"
                }
            );


        // -------------------------------
        // Login successful
        // -------------------------------

        return res.json({

            success: true,

            message:
                "Login successful",

            token,

            role:
                user.usertype,

            email:
                loginEmail

        });


    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Server error during login"

        });
    }
};


// ===============================
// EXPORT
// ===============================

module.exports = {

    registerPatient,

    loginUser

};