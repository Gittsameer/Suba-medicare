(function () {
    "use strict";

    // =====================================================
    // CONFIGURATION
    // =====================================================

    const API_BASE = "http://localhost:5000/api/admin";
    const token = localStorage.getItem("token");


    // =====================================================
    // LOGOUT
    // =====================================================

    function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("userRole");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userName");
        localStorage.removeItem("adminName");
        localStorage.removeItem("adminEmail");

        window.location.replace("../login.html");
    }


    // =====================================================
    // AUTH CHECK
    // =====================================================

    if (!token) {
        window.location.replace("../login.html");
        return;
    }


    // =====================================================
    // API HELPER
    // =====================================================

    async function fetchJSON(url, options = {}) {

        const requestOptions = {
            ...options,
            headers: {
                ...(options.headers || {}),
                Authorization: "Bearer " + token
            }
        };

        // If body is an object, convert it to JSON.
        if (
            requestOptions.body &&
            typeof requestOptions.body !== "string"
        ) {
            requestOptions.headers["Content-Type"] =
                "application/json";

            requestOptions.body =
                JSON.stringify(requestOptions.body);
        }

        const response =
            await fetch(url, requestOptions);

        let data = {};

        try {
            data = await response.json();
        } catch (error) {
            data = {};
        }


        // -------------------------------------------------
        // SESSION EXPIRED
        // -------------------------------------------------

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            alert(
                data.message ||
                "Session expired. Please login again."
            );

            logout();

            throw new Error("AUTH");
        }


        return {
            response,
            data
        };
    }


    // =====================================================
    // EXPOSE ADMIN API
    // =====================================================

    window.adminApi = {
        API_BASE,
        token,
        logout,
        fetchJSON
    };


    // =====================================================
    // CHANGE PASSWORD MODAL
    // =====================================================

    function createPasswordModal() {

        // Do not create it twice.
        if (
            document.getElementById(
                "adminPasswordModal"
            )
        ) {
            return;
        }


        const modal =
            document.createElement("div");

        modal.id =
            "adminPasswordModal";


        modal.innerHTML = `

            <div class="admin-password-overlay">

                <div class="admin-password-modal">

                    <button
                        type="button"
                        id="closePasswordModal"
                        class="admin-password-close"
                        aria-label="Close">
                        &times;
                    </button>


                    <h2>
                        Change Password
                    </h2>


                    <p class="admin-password-subtitle">
                        Change your administrator account password
                    </p>


                    <form id="adminPasswordForm">

                        <label for="adminCurrentPassword">
                            Current Password
                        </label>

                        <input
                            type="password"
                            id="adminCurrentPassword"
                            class="input-text"
                            placeholder="Enter current password"
                            autocomplete="current-password"
                            required
                        >


                        <label for="adminNewPassword">
                            New Password
                        </label>

                        <input
                            type="password"
                            id="adminNewPassword"
                            class="input-text"
                            placeholder="Enter new password"
                            minlength="6"
                            autocomplete="new-password"
                            required
                        >


                        <label for="adminConfirmPassword">
                            Confirm New Password
                        </label>

                        <input
                            type="password"
                            id="adminConfirmPassword"
                            class="input-text"
                            placeholder="Confirm new password"
                            minlength="6"
                            autocomplete="new-password"
                            required
                        >


                        <button
                            type="submit"
                            id="adminChangePasswordButton"
                            class="login-btn btn-primary btn">

                            Change Password

                        </button>

                    </form>

                </div>

            </div>
        `;


        document.body.appendChild(modal);


        // =================================================
        // MODAL CSS
        // =================================================

        const style =
            document.createElement("style");

        style.id =
            "admin-password-modal-style";


        style.textContent = `

            .admin-password-overlay {

                position: fixed;

                top: 0;
                left: 0;

                width: 100%;
                height: 100%;

                background: rgba(0, 0, 0, 0.45);

                display: flex;

                justify-content: center;

                align-items: center;

                z-index: 99999;

            }


            .admin-password-modal {

                position: relative;

                width: 450px;

                max-width: 90%;

                background: white;

                border-radius: 12px;

                padding: 35px;

                box-shadow:
                    0 15px 50px
                    rgba(0, 0, 0, 0.25);

                animation:
                    adminPasswordPopup
                    0.25s ease;

                box-sizing: border-box;

            }


            .admin-password-modal h2 {

                margin:
                    0 0 8px 0;

                text-align: center;

                font-size: 24px;

            }


            .admin-password-subtitle {

                text-align: center;

                color: #777;

                margin-bottom: 25px;

            }


            .admin-password-modal label {

                display: block;

                margin-top: 15px;

                margin-bottom: 7px;

                font-weight: 600;

            }


            .admin-password-modal .input-text {

                width: 100%;

                box-sizing: border-box;

                margin: 0;

            }


            #adminChangePasswordButton {

                display: block;

                width: 100%;

                margin-top: 25px;

                padding: 12px;

                box-sizing: border-box;

            }


            .admin-password-close {

                position: absolute;

                top: 10px;

                right: 15px;

                border: none;

                background: transparent;

                font-size: 30px;

                cursor: pointer;

                color: #777;

                line-height: 1;

            }


            .admin-password-close:hover {

                color: #ff5050;

            }


            @keyframes adminPasswordPopup {

                from {

                    opacity: 0;

                    transform:
                        translateY(-20px)
                        scale(0.96);

                }

                to {

                    opacity: 1;

                    transform:
                        translateY(0)
                        scale(1);

                }

            }

        `;


        document.head.appendChild(style);


        // =================================================
        // BUTTONS
        // =================================================

        document
            .getElementById("closePasswordModal")
            .addEventListener(
                "click",
                closePasswordModal
            );


        // =================================================
        // FORM
        // =================================================

        document
            .getElementById("adminPasswordForm")
            .addEventListener(
                "submit",
                changeAdminPassword
            );


        // =================================================
        // CLICK OUTSIDE
        // =================================================

        modal
            .querySelector(
                ".admin-password-overlay"
            )
            .addEventListener(
                "click",
                function (event) {

                    if (
                        event.target ===
                        this
                    ) {
                        closePasswordModal();
                    }

                }
            );
    }


    // =====================================================
    // OPEN PASSWORD MODAL
    // =====================================================

    function openPasswordModal() {

        createPasswordModal();


        const modal =
            document.getElementById(
                "adminPasswordModal"
            );


        const current =
            document.getElementById(
                "adminCurrentPassword"
            );

        const newPassword =
            document.getElementById(
                "adminNewPassword"
            );

        const confirmPassword =
            document.getElementById(
                "adminConfirmPassword"
            );


        current.value = "";
        newPassword.value = "";
        confirmPassword.value = "";


        modal.style.display = "flex";


        current.focus();
    }


    // =====================================================
    // CLOSE PASSWORD MODAL
    // =====================================================

    function closePasswordModal() {

        const modal =
            document.getElementById(
                "adminPasswordModal"
            );


        if (!modal) {
            return;
        }


        modal.style.display = "none";


        const form =
            document.getElementById(
                "adminPasswordForm"
            );


        if (form) {
            form.reset();
        }
    }


    // =====================================================
    // CHANGE ADMIN PASSWORD
    // =====================================================

    async function changeAdminPassword(event) {

        event.preventDefault();


        const currentPassword =
            document.getElementById(
                "adminCurrentPassword"
            ).value;


        const newPassword =
            document.getElementById(
                "adminNewPassword"
            ).value;


        const confirmPassword =
            document.getElementById(
                "adminConfirmPassword"
            ).value;


        // -------------------------------------------------
        // VALIDATION
        // -------------------------------------------------

        if (
            !currentPassword ||
            !newPassword ||
            !confirmPassword
        ) {

            alert(
                "All password fields are required."
            );

            return;
        }


        if (newPassword.length < 6) {

            alert(
                "New password must be at least 6 characters."
            );

            return;
        }


        if (
            newPassword !==
            confirmPassword
        ) {

            alert(
                "New passwords do not match."
            );

            return;
        }


        // -------------------------------------------------
        // SUBMIT BUTTON
        // -------------------------------------------------

        const button =
            document.getElementById(
                "adminChangePasswordButton"
            );


        button.disabled = true;

        button.textContent =
            "Changing...";


        try {

            // IMPORTANT:
            // Send the passwords normally.
            // DO NOT bcrypt/hash them in frontend.
            //
            // Backend compares currentPassword
            // with stored bcrypt hash and hashes
            // the new password before saving.

            const result =
                await fetchJSON(
                    API_BASE +
                    "/change-password",
                    {
                        method: "PUT",

                        body: {
                            currentPassword:
                                currentPassword,

                            newPassword:
                                newPassword
                        }
                    }
                );


            const response =
                result.response;

            const data =
                result.data;


            if (
                !response.ok ||
                !data.success
            ) {

                alert(
                    data.message ||
                    "Unable to change password."
                );

                return;
            }


            alert(
                data.message ||
                "Password changed successfully."
            );


            closePasswordModal();

        } catch (error) {

            console.error(
                "Admin password error:",
                error
            );


            if (
                error.message !==
                "AUTH"
            ) {

                alert(
                    error.message ||
                    "Unable to change password."
                );
            }

        } finally {

            button.disabled = false;

            button.textContent =
                "Change Password";
        }
    }


    // =====================================================
    // LOAD ADMIN PROFILE
    // =====================================================

    async function loadAdminProfile() {

        const name =
            document.getElementById(
                "adminName"
            ) ||
            document.querySelector(
                ".profile-title"
            );


        const email =
            document.getElementById(
                "adminEmail"
            ) ||
            document.querySelector(
                ".profile-subtitle"
            );


        if (
            !name &&
            !email
        ) {
            return;
        }


        try {

            const result =
                await fetchJSON(
                    API_BASE +
                    "/profile"
                );


            const data =
                result.data;


            if (
                result.response.ok &&
                data.success &&
                data.admin
            ) {

                const adminEmail =
                    data.admin.aemail ||
                    "";


                if (name) {

                    name.textContent =
                        adminEmail
                            ? adminEmail
                                .split("@")[0]
                            : "Administrator";
                }


                if (email) {

                    email.textContent =
                        adminEmail;
                }


                // Store profile information
                // for later use if needed.

                if (adminEmail) {

                    localStorage.setItem(
                        "adminEmail",
                        adminEmail
                    );

                    localStorage.setItem(
                        "adminName",
                        adminEmail
                            .split("@")[0]
                    );
                }
            }

        } catch (error) {

            console.error(
                "Admin profile error:",
                error
            );
        }
    }


    // =====================================================
    // LOGOUT BUTTON
    // =====================================================

    function setupLogout() {

        const buttons =
            document.querySelectorAll(
                "#logoutButton, .logout-btn"
            );


        buttons.forEach(function (button) {

            // Prevent duplicate event listeners
            if (
                button.dataset.logoutBound ===
                "true"
            ) {
                return;
            }


            button.dataset.logoutBound =
                "true";


            button.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    logout();
                }
            );

        });
    }


    // =====================================================
    // CHANGE PASSWORD BUTTON
    // =====================================================

    function setupChangePasswordButton() {

        const button =
            document.getElementById(
                "openAdminPasswordModal"
            );


        if (!button) {
            return;
        }


        if (
            button.dataset.passwordBound ===
            "true"
        ) {
            return;
        }


        button.dataset.passwordBound =
            "true";


        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                openPasswordModal();
            }
        );
    }


    // =====================================================
    // ESC KEY
    // =====================================================

    function setupEscapeKey() {

        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }


                const modal =
                    document.getElementById(
                        "adminPasswordModal"
                    );


                if (
                    modal &&
                    modal.style.display ===
                    "flex"
                ) {

                    closePasswordModal();
                }

            }
        );
    }


    // =====================================================
    // TODAY'S DATE
    // =====================================================

    function setTodayDate() {

        const date =
            document.getElementById(
                "todayDate"
            ) ||
            document.querySelector(
                ".heading-sub12"
            );


        if (!date) {
            return;
        }


        date.textContent =
            new Date().toLocaleDateString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                }
            );
    }


    // =====================================================
    // INITIALIZATION
    // =====================================================

    document.addEventListener(
        "DOMContentLoaded",
        async function () {

            setTodayDate();

            setupLogout();

            setupChangePasswordButton();

            setupEscapeKey();

            await loadAdminProfile();

        }
    );

})();