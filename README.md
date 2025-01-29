# Attendance Logging Webapp

## Overview
The purpose of this project is to develop a system that makes taking attendance of NYSC corp members as seamless as possible. The web application allows users to log their attendance, pay lateness fine, pay monthly dues, and view attendance history.
This webapp was built with Flask and Bootstrap.

## Screenshots

### Home Page

![Index Page](https://github.com/emriys/CDS_Advanced_Attendance_System/blob/master/screenshots/Indexpage.png)

### Sign-In Page

![Sign-In Page](https://github.com/emriys/CDS_Advanced_Attendance_System/blob/master/screenshots/SignInPage.png)

### Late Fine Payment Page

![Late Fine Payment Page](https://github.com/emriys/CDS_Advanced_Attendance_System/blob/master/screenshots/LateFinePaymentPage.png)

![Late Fine Payment Page](https://github.com/emriys/CDS_Advanced_Attendance_System/blob/master/screenshots/LateFinePaymentPageApproved.png)

### Admin Login Page

![Admin Login Page](https://github.com/emriys/CDS_Advanced_Attendance_System/blob/master/screenshots/AdminLoginPage.png)

### Admin Dashboard Page

![Admin Dashboard Page](https://github.com/emriys/CDS_Advanced_Attendance_System/blob/master/screenshots/AdminDashboardPage.png)

### Admin Settings Page

![Admin Settings Page](https://github.com/emriys/CDS_Advanced_Attendance_System/blob/master/screenshots/AdminSettingsPage.png)

## Features

- Attendee sign-in
- View attendance history
- Lateness Fee payment
- User request approval by Admin.

## Installation

1. Clone the repository: `git clone <repository-url>`
2. Create the virtual environment using the venv module
3. Install the dependencies: `pip install -r requirements.txt`
4. Initialize the database:
   `flask db init`
   `flask db migrate -m "Initial migration"`
   `flask db upgrade`
4. Run the application: `python app.py`

## Usage

1. Open your web browser and go to `http://localhost:80` to access the web application.
2. Sign-in attendance for the day.
3. Use the admin dashboard to view payment approval requests and approve payments.

## Contributing

If you would like to contribute to this project, please follow the steps below:

1. Fork the repository
2. Create a new branch for your feature or bugfix
3. Make your changes and test thoroughly
4. Submit a pull request with a descriptive title and detailed description of your changes