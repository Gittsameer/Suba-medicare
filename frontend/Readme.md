# Suba Medicare – Frontend

Suba Medicare is a web-based medical appointment management system.  
The frontend provides separate interfaces for **Patients, Doctors, and Administrators** to manage appointments, sessions, patients, doctors, and account settings.

---

## 1. Project Overview

The frontend is built using:

- HTML5
- CSS3
- JavaScript
- Fetch API
- LocalStorage
- REST API integration

The frontend communicates with the backend through HTTP requests and displays the data dynamically.

---

## 2. User Roles

The system contains three main user roles:

### Patient

Patients can:

- Register an account
- Login
- View doctors
- View available sessions
- Book appointments
- View their appointments
- Manage their profile
- Change their password
- Logout

### Doctor

Doctors can:

- Login
- View their dashboard
- View their appointments
- Create and manage sessions
- View patients
- Manage their account
- Change their password
- Logout

### Administrator

Administrators can:

- Login
- View dashboard statistics
- View doctors
- Add doctors
- Manage doctors
- View schedules
- Manage appointments
- View patients
- View patient information
- Change administrator password
- Logout

---

## 3. Frontend Structure

The frontend is organized into different folders based on functionality.

```text
Frontend/
│
├── index.html
├── login.html
├── signup.html
│
├── admin/
│   ├── index.html
│   ├── doctors.html
│   ├── add-new.html
│   ├── schedule.html
│   ├── appointment.html
│   ├── patient.html
│   └── admin-common.js
│
├── doctor/
│   ├── index.html
│   ├── appointment.html
│   ├── schedule.html
│   ├── patient.html
│   └── settings.html
│
├── patient/
│   ├── index.html
│   ├── appointment.html
│   ├── doctors.html
│   ├── schedule.html
│   └── settings.html
│
├── css/
│   ├── main.css
│   ├── admin.css
│   └── animations.css
│
└── img/
    ├── icons/
    ├── calendar.svg
    ├── user.png
    └── ...Learn more about New+ by visiting https://aka.ms/PowerToysOverview_NewPlus