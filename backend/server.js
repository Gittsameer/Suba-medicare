const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");

const authRoutes = require("./routes/auth");
const doctorRoutes = require("./routes/doctorRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


// =====================================================
// PATIENT API
// =====================================================

app.use(
    "/api/auth",
    authRoutes
);


// =====================================================
// DOCTOR API
// =====================================================

app.use(
    "/api/doctor",
    doctorRoutes
);


// =====================================================
// ADMIN API
// =====================================================
app.use("/api/admin", adminRoutes);


// =====================================================
// AUTH TEST
// =====================================================

app.get(
    "/auth-test",
    (req, res) => {

        res.json({

            success: true,

            message: "Auth test from server.js"

        });

    }
);


// =====================================================
// BACKEND TEST
// =====================================================

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            message:
                "Suba Medicare Backend is running"

        });

    }
);


// =====================================================
// MYSQL TEST
// =====================================================

app.get(
    "/api/test-db",
    (req, res) => {

        db.query(
            "SELECT 1 AS test",
            (err, result) => {

                if (err) {

                    console.error(
                        "MySQL test failed:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "MySQL connection failed"

                    });

                }


                res.json({

                    success: true,

                    message:
                        "Suba Medicare MySQL database connected",

                    result: result

                });

            }
        );

    }
);


// =====================================================
// START SERVER
// =====================================================

module.exports = app;
