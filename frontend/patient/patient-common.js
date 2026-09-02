(() => {
    "use strict";

    const API_BASE_URL = "http://localhost:5000/api/auth";


    // =====================================================
    // GET TOKEN
    // =====================================================

    function getToken() {
        return localStorage.getItem("token");
    }


    // =====================================================
    // LOAD PATIENT PROFILE FROM BACKEND
    // =====================================================

    async function setProfile() {

        const token = getToken();

        if (!token) {
            return;
        }

        try {

            const response = await fetch(
                `${API_BASE_URL}/profile`,
                {
                    method: "GET",
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                }
            );

            const data = await response.json();

            console.log("Patient profile:", data);


            // Token expired / invalid
            if (response.status === 401 ||
                response.status === 403) {

                localStorage.removeItem("token");
                localStorage.removeItem("userRole");
                localStorage.removeItem("userEmail");
                localStorage.removeItem("patientName");
                localStorage.removeItem("patientEmail");

                window.location.href = "../login.html";

                return;
            }


            if (!response.ok ||
                !data.success ||
                !data.patient) {

                console.error(
                    "Unable to load patient profile:",
                    data
                );

                return;
            }


            const patient = data.patient;


            // Get actual values from database
            const name =
                patient.pname || "Patient";

            const email =
                patient.pemail || "";


            // Save them locally for other pages
            localStorage.setItem(
                "patientName",
                name
            );

            localStorage.setItem(
                "patientEmail",
                email
            );

            localStorage.setItem(
                "userEmail",
                email
            );


            // =================================================
            // PROFILE NAME
            // =================================================

            document
                .querySelectorAll(".profile-title")
                .forEach((element) => {

                    element.textContent = name;

                });


            // =================================================
            // PROFILE EMAIL
            // =================================================

            document
                .querySelectorAll(".profile-subtitle")
                .forEach((element) => {

                    element.textContent = email;

                });


            // =================================================
            // SUPPORT ID BASED ELEMENTS
            // =================================================

            const profileName =
                document.getElementById("profileName");

            if (profileName) {
                profileName.textContent = name;
            }


            const profileEmail =
                document.getElementById("profileEmail");

            if (profileEmail) {
                profileEmail.textContent = email;
            }


        } catch (error) {

            console.error(
                "Patient profile error:",
                error
            );

        }
    }


    // =====================================================
    // TODAY'S DATE
    // =====================================================

    function setTodayDate() {

        const today =
            new Date().toLocaleDateString("en-GB");


        const targets =
            new Set(
                document.querySelectorAll("#todayDate")
            );


        // Find "Today's Date" labels
        document.querySelectorAll("p").forEach((label) => {

            const text =
                label.textContent
                    .trim()
                    .replace(/\s+/g, " ");


            if (text === "Today's Date") {

                const dateElement =
                    label.nextElementSibling;


                if (
                    dateElement &&
                    dateElement.tagName === "P"
                ) {

                    targets.add(dateElement);

                }
            }

        });


        targets.forEach((element) => {

            element.textContent = today;

        });

    }


    // =====================================================
    // REPAIR MENU LINKS
    // =====================================================

    function repairMenuLinks() {

        document
            .querySelectorAll(".menu-btn")
            .forEach((cell) => {

                const oldLink =
                    cell.querySelector("a");

                const label =
                    cell.querySelector(".menu-text");


                if (!oldLink || !label) {
                    return;
                }


                const link =
                    document.createElement("a");


                link.href =
                    oldLink.getAttribute("href") || "#";


                link.className =
                    oldLink.className;


                const wrapper =
                    document.createElement("div");


                wrapper.appendChild(
                    label.cloneNode(true)
                );


                link.appendChild(wrapper);


                cell.replaceChildren(link);

            });

    }


    // =====================================================
    // LOGOUT
    // =====================================================

    function bindLogout() {

        document
            .querySelectorAll(".logout-btn")
            .forEach((button) => {

                const link =
                    button.closest("a");


                // If button is inside <a>
                if (link) {

                    link.addEventListener(
                        "click",
                        () => {

                            localStorage.removeItem("token");
                            localStorage.removeItem("userRole");
                            localStorage.removeItem("userEmail");
                            localStorage.removeItem("patientName");
                            localStorage.removeItem("patientEmail");

                        }
                    );

                    return;
                }


                // If it is a standalone button
                button.addEventListener(
                    "click",
                    () => {

                        localStorage.removeItem("token");
                        localStorage.removeItem("userRole");
                        localStorage.removeItem("userEmail");
                        localStorage.removeItem("patientName");
                        localStorage.removeItem("patientEmail");

                        window.location.href =
                            "../login.html";

                    }
                );

            });

    }


    // =====================================================
    // CHECK LOGIN
    // =====================================================

    function checkLogin() {

        const token =
            localStorage.getItem("token");

        const role =
            localStorage.getItem("userRole");


        if (!token) {

            window.location.href =
                "../login.html";

            return false;

        }


        if (role && role !== "p") {

            window.location.href =
                "../login.html";

            return false;

        }


        return true;

    }


    // =====================================================
    // INITIALIZE
    // =====================================================

    async function initialise() {

        if (!checkLogin()) {
            return;
        }


        repairMenuLinks();


        // Load actual patient name/email
        await setProfile();


        // Set today's date
        setTodayDate();


        // Logout
        bindLogout();

    }


    // =====================================================
    // START
    // =====================================================

    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialise
        );

    } else {

        initialise();

    }

})();