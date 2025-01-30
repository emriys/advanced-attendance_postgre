from flask import Flask,request,Response,render_template,session,redirect,url_for,jsonify,send_file,flash,Blueprint
from flask_session import Session
from flask_socketio import emit, send
import pandas as pd
from datetime import datetime,time,timedelta
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from models import *
from blueprints import forms
import csv
from io import BytesIO
from fpdf import FPDF
from flask import make_response
import xlsxwriter
import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.units import inch
from sqlalchemy import or_
from werkzeug.security import check_password_hash
from functools import wraps
from extensions import socketio, logging

# Create a blueprint
routes = Blueprint('routes', __name__)

# Initialize admin authentication
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if ('admin_logged_in' not in session) or (not session['admin_logged_in']):
            flash("You must be logged in as an admin to access this page.", "warning")
            return redirect(url_for('routes.admin'))
        return f(*args, **kwargs)
    return decorated_function

# ---------------- WebSockets ---------------- #

@socketio.on("connect")
def handle_connect():
    logging.info("Admin connected")
    
@socketio.on('disconnect')
def handle_disconnect():
    logging.info("Admin Disconnected.")

# For LateLog updates on Admin Dashboard
@socketio.on('update_latelog')
def send_latelog_updates():
    # """Emit live attendance logs to connected clients."""
    logs = LateLog.query.all()
    pending_requests = [
        {
            'transaction_date': log.transaction_date.strftime('%Y-%m-%d'),
            'state_code': log.state_code,
            'request_type': log.request_type,
            'amount': log.amount,
            'status': log.status
        }
        for log in logs
    ]
    # print(pending_requests)
    socketio.emit('late_log_update', pending_requests)

def new_attendance_record():
    send_latelog_updates()


# For Payment status on paymentpage
@socketio.on("check_payment_status")
def check_payment_status(statecode):
    statecode = statecode.upper()
    
    # Validate 'statecode' input
    if not statecode:
        emit("payment_status_update", {"error": "Statecode is required"}, broadcast=True)
        # return jsonify({"error": "Statecode is required"}), 400

    try:
        latecomer = LateLog.query.filter_by(state_code=statecode).first()

        if latecomer:
            # print(latecomer.status)
            socketio.emit('payment_status_update', {'status': latecomer.status})  # Send status update
        else:
            emit("payment_status_update", {"error": "Statecode not found"}, broadcast=True)
    except Exception as e:
        emit("payment_status_update", {"error": str(e)}, broadcast=True)
    finally:
        db.session.close()

def approve_payment(new_status):
    socketio.emit('payment_status_update', {'status': new_status})  # Send new status update

# For settings preview on Admin Settings page
@socketio.on('fetch_admin_settings')
def fetch_admin_settings():
    """Send updated admin settings to connected clients."""
    settings = getSettings()
    # print(settings)
    socketio.emit('admin_settings_update', settings) # Emit the updated settings to all clients

def update_admin_settings(new_settings):
    """Save settings and notify clients."""
    admin_settings = AdminSettings.query.first()
    if not admin_settings:
        admin_settings = AdminSettings()
        db.session.add(admin_settings)

    for key, value in new_settings.items():
        setattr(admin_settings, key, value)

    db.session.commit()
    fetch_admin_settings()  # Emit the updated settings



# ---------------- ROUTES ---------------- #

@routes.route('/')
@routes.route('/home')
def index():
    return render_template("index.html")

@routes.route('/history')
def history():
    return render_template ("error.html")
    return render_template ("history.html")

@routes.route('/register', methods=['GET','POST'])
def register():
    from blueprints.forms import MemberRegisterForm 
    form = MemberRegisterForm()
    if form.validate_on_submit():
        user = Users.query.filter_by(state_code=form.state_code.data.upper()).first()
        if user :
            return jsonify({'success':False,"message":'User already exists'})
        else:
            user_data = {
                'first_name':form.first_name.data.capitalize().strip(),
                'middle_name':form.middle_name.data.capitalize().strip(),
                'last_name':form.last_name.data.upper().strip(),
                'gender':form.gender.data.capitalize().strip(),
                'local_gov':form.local_gov_area.data.capitalize().strip(),
                'state_code':form.state_code.data.upper().strip()
            }
        
            confirm = check_user_reg_exists(user_data=user_data)
            if confirm :
                return jsonify({'success':True,"message":'Registration successful',"redirect":"/signin"})
            else :
                return jsonify({'success':False,"message":'Server Error: Could not add user'})
        
    return render_template('register.html', title='Register', form=form)

@routes.route('/signin', methods=['GET', 'POST'])
def signin():
    # Sign in clicked 
    # colllect details 
    # check if user registered 
    from blueprints.forms import SigninForm
    form = SigninForm()
    
    if request.method=="POST":
        settings = AdminSettings.query.first()
        if settings.allow_attendance == "Disabled":
            return jsonify({'success':False,'message':'Attendance Function Disabled!'})
        elif request.method == "POST" and form.validate_on_submit():
            # Define attendance time ranges
            settings = AdminSettings.query.first()
            early_start = settings.early_arrival_start
            late_start = settings.late_arrival_start
            late_end = settings.late_arrival_end
            
            if not all([early_start, late_start, late_end]) :
                return jsonify({'success':False,"message":'Meeting Time not set.'})
            
            last_name = form.last_name.data.upper() # Last name
            statecode = form.state_code.data.upper()
            device_id = form.deviceId.data
            ip_address = form.Ip.data
            
            confirm_reg = check_user_reg_exists(statecode=statecode, last_name=last_name)
            if not confirm_reg :
                return jsonify({'success':False,"message":'Not A Registered Member'})
            else :
                # Check if user attendance is registered already
                attendanceStatus = check_user_attendance_exists(statecode)

                if attendanceStatus != "":
                    return jsonify({'success':False,"message":attendanceStatus})
                    
                else:
                    # If late, handle late sign-in
                    current_time = datetime.now().time()
                    
                    if late_start <= current_time <= late_end:
                        amount = settings.lateness_fine
                        
                        # Check if user already in late list
                        late_status = check_latefile(statecode)
                        if not late_status:
                            new_entry = LateLog(
                                transaction_date=datetime.now().date(),
                                state_code=statecode,
                                request_type="Late Sign-In",
                                amount=amount,
                                status="Pending"
                            )
                            db.session.add(new_entry)
                            db.session.commit()
                            # Notify WebSocket clients about the update
                            send_latelog_updates()
                        # Pass deviceId to the payment page
                        return redirect(url_for('routes.payment', statecode=statecode, device_id=device_id))
                        # return payment(statecode,device_id)
                    
                    elif early_start <= current_time < late_start:
                        # Regular sign-in (early sign-in)
                        confirm_attendance = record_attendance(confirm_reg)
            
                        if confirm_attendance:
                            # Log device in the database
                            # new_device = DeviceLog(device_id=device_id, timestamp=datetime.utcnow())
                            # db.session.add(new_device)
                            # db.session.commit()
                            return render_template("thankyouregister.html")
                        else:
                            return """<h1>Server Error!</h1> <h4><p>Failed to log attendance</p></h4>""", 500
                    
                    else:
                        regErrorMsg = "Sign-in time elapsed or not yet reached!"
                        return jsonify({'success':False,"message":regErrorMsg})

    return render_template("signin.html", form=form)

@routes.route('/late/signin', methods=['GET', 'POST'])
def late_reg():
    if request.method == 'POST':
        statecode = request.form['statecode']
        
        # Check user in database
        user = Users.query.filter_by(state_code=statecode).first()
        
        # Check if user attendance is registered already
        attendanceStatus = check_user_attendance_exists(statecode)
        if attendanceStatus != "":
            return jsonify({'success':False,"message":attendanceStatus})
        
        # Add late attendnace to database
        if user:
            confirm_attendance = record_attendance(user)
        
        if confirm_attendance:
            # Remove the user from the LateLog database
            pop_latecomer(statecode)
            
            return render_template("thankyouregister.html")
        else:
            return """<h1>Server Error!</h1> <h4><p>Failed to log attendance</p></h4>""", 500

@routes.route('/admin', methods=['GET', 'POST'])
def admin():
    if ('admin_logged_in' in session) :
        return redirect(url_for('routes.admindash'))
    
    if request.method == "POST":
        username = request.form['adminusr'].strip().lower()
        password = request.form['adminpwd']
        
        # Fetch the stored admin credentials
        admin_settings = AdminSettings.query.first()
        
        if not admin_settings:
            return jsonify({'error': 'Server Error.'}), 500
        
        # Verify the username and password
        if username == admin_settings.admin_username and check_password_hash(admin_settings.admin_password, password):
            session.permanent = True
            session['admin_logged_in'] = True
            return jsonify({"success":True, "message":"Login successful!"}), 200  # Response with success status
        else:
            return jsonify({"success":False, "message":"Invalid credentials!"}), 200  # Response with failure status

    return render_template('adminlogin.html')

@routes.route('/admin/dashboard', methods=['GET', 'POST'])
@admin_required
def admindash():
    
    if 'admin_logged_in' not in session:
        flash("Session expired. Please log in again.", "warning")
        return redirect(url_for('routes.admin'))

    # Send existing late logs when the admin dashboard loads
    send_latelog_updates()

    return render_template('admindashboard.html')

@routes.route('/admin/settings', methods=['GET', 'POST'])
@admin_required
def admin_settings():
    if 'admin_logged_in' not in session:
        flash("Session expired. Please log in again.", "warning")
        return redirect(url_for('routes.admin'))

    return render_template ("adminsettings.html")

@routes.route('/admin/attendance_logs', methods=['GET', 'POST'])
@admin_required
def attendance_logs():
    if 'admin_logged_in' not in session:
        flash("Session expired. Please log in again.", "warning")
        return redirect(url_for('routes.admin'))
    
    # Check if the request is an AJAX request by inspecting headers
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    
    if is_ajax:
        # Get the date from the query parameter (default to today's date if not provided)
        meeting_date = request.args.get('start_date')
        meeting_date2 = request.args.get('end_date')
        
        # If no date is provided, default to today's date
        if not all([meeting_date, meeting_date2]):
            meeting_date = meeting_date2 = datetime.now().date()
            # Query the attendance logs for the given date and respond to the AJAX request
            attendance_request = get_attendance_data(meeting_date)
        
        if meeting_date == meeting_date2:
            attendance_request = get_attendance_data(meeting_date)
        
        # If a date range is provided, get data across the range
        if meeting_date != meeting_date2:
            attendance_request= collect_attendance_data_for_range(meeting_date, meeting_date2)
            
            # Sort data for easier readability
            # attendance_request = sort_by_batch_year_and_state_code(attendance_data)
        
        if len(attendance_request) <= 0:
            return jsonify({"success": False, "message": "No attendance records found for this date range."}), 200

        return jsonify(attendance_request)

    # If the request is not an AJAX request, return attendance for the day
    meeting_date = datetime.now().date()
    attendance_today = get_attendance_data(meeting_date)

    return render_template('view_attendance.html', attendance_data=attendance_today)

@routes.route('/logout')
@admin_required
def logout():
    session.pop('admin_logged_in', None)
    flash("You have been logged out.", "info")
    return redirect(url_for('routes.admin'))

@routes.route('/admin/clear_latelog', methods=['GET', 'POST'])
@admin_required
def clearLatelog():
    if 'admin_logged_in' not in session:
        flash("Session expired. Please log in again.", "warning")
        return redirect(url_for('routes.admin'))
    
    # action = request.args.get('statecodeSelect')
    if request.method == "POST":
        statecode = request.form["statecode"]
        # print(statecode)
        if statecode == "All":
            try:
                db.session.query(LateLog).delete()  # Deletes all rows
                db.session.commit()  # Commit the transaction
                # print("All LateLog entries have been cleared.")
                return jsonify({"message":"All LateLog entries cleared."}), 200
            except Exception as e:
                db.session.rollback()  # Roll back in case of an error
                return jsonify({"message":f"An error occurred: {e}"}), 200
                # print(f"An error occurred: {e}")
        
        elif statecode :
            try:
                # Clear specific state code entries
                deleted_rows = LateLog.query.filter_by(state_code=statecode).delete()
                db.session.commit()

                if deleted_rows > 0:
                    return jsonify({"message": f"LateLogs for state code {statecode} cleared successfully."}), 200
                else:
                    return jsonify({"message": f"No records found for state code {statecode}."}), 200
            except Exception as e:
                db.session.rollback()  # Roll back in case of an error
                # print(f"An error occurred: {e}")
                return jsonify(message="Invalid request."), 400

    return render_template("clearLateLog.html")

@routes.route('/admin/clear-user', methods=["GET", 'POST'])
@admin_required
def clear_user_logs():
    if 'admin_logged_in' not in session:
        flash("Session expired. Please log in again.", "warning")
        return redirect(url_for('routes.admin'))
    
    if request.method == "POST":
        action = request.form["action"]
        statecode = request.form["statecode"].upper()
        last_name = request.form["last_name"]

        if statecode and last_name:
            try:
                # Query for the user
                user = Users.query.filter(
                    Users.state_code == statecode,  # Case-insensitive
                    Users.last_name.ilike(last_name)
                ).first()
                
                if not user:
                    return jsonify({"success":False, "message":"User not found"}), 200
                
                elif action =='attendance':
                    # Delete all associated attendance logs
                    deleted_rows = AttendanceLog.query.filter_by(user_id=user.id).delete()
                    db.session.commit()
                    
                    if deleted_rows > 0:
                        return jsonify({"message":f"All Attendance entries cleared for {statecode}."}), 200
                    else:
                        return jsonify({"message": f"No records found for state code {statecode}."}), 200
                    
                elif action == "delete":
                    # Delete all associated attendance logs
                    attd_deleted_rows = AttendanceLog.query.filter_by(user_id=user.id).delete()
                    db.session.commit()
                    
                     # Delete all associated late logs
                    late_deleted_rows = LateLog.query.filter_by(state_code=statecode).delete()
                    db.session.commit()
                    
                    # Delete user record
                    deleted_rows = Users.query.filter(
                        Users.state_code == statecode,  # Case-insensitive
                        Users.last_name.ilike(last_name)
                    ).delete()
                    db.session.commit()
                    
                    if deleted_rows > 0  or attd_deleted_rows > 0 or late_deleted_rows > 0:
                        return jsonify({"message":f"All records of {statecode} deleted successfully."}), 200
                    else:
                        return jsonify({"message": f"No records found for state code {statecode}."}), 200
                    
            except Exception as e:
                db.session.rollback()
                return jsonify(success=False, message=f"An error occurred: {str(e)}"), 500

    return render_template("clearuser.html")

@routes.route('/admin/clear_devicelog', methods=['GET', 'POST'])
@admin_required
def clearDevicelog():
    if 'admin_logged_in' not in session:
        flash("Session expired. Please log in again.", "warning")
        return redirect(url_for('routes.admin'))
    
    # action = request.args.get('statecodeSelect')
    # if request.method == "POST":
    #     statecode = request.form["statecode"]
    #     print(statecode)
    #     if statecode == "All":
    try:
        db.session.query(DeviceLog).delete()  # Deletes all rows
        db.session.commit()  # Commit the transaction
        # print("All Device Logs have been cleared.")
        # return jsonify({"message":"All Device Log entries cleared."}), 200
    except Exception as e:
        db.session.rollback()  # Roll back in case of an error
        return jsonify({"message":f"An error occurred: {e}"}), 200
        # print(f"An error occurred: {e}")
                
    return """<html>Device Log Cleared</html>"""
        
    #     elif statecode :
            # try:
            #     # Clear specific state code entries
            #     deleted_rows = LateLog.query.filter_by(state_code=statecode).delete()
            #     db.session.commit()

            #     if deleted_rows > 0:
            #         return jsonify({"message": f"LateLogs for state code {statecode} cleared successfully."}), 200
            #     else:
            #         return jsonify({"message": f"No records found for state code {statecode}."}), 200
            # except Exception as e:
            #     db.session.rollback()  # Roll back in case of an error
            #     print(f"An error occurred: {e}")
            #     return jsonify(message="Invalid request."), 400

    # return render_template("clearLateLog.html")

@routes.route('/get_details', methods=['GET'])
@admin_required
def getDetails():
    # GETS THE AMOUNT FROM THE USER DATABASE AND 
    # UPDATES THE ADMIN DASHBOARD REQUESTS TABLE
    
    # Get the user status from the query parameters
    stateCode = request.args.get('stateCode').upper()
    latecomer_details = LateLog.query.filter_by(state_code=stateCode).first()
    
    if latecomer_details:
        amount = latecomer_details.amount
        return jsonify({'success': True, 'message': amount}), 200
    
    return jsonify({'success': False, 'message': 'User not found'}), 404

@routes.route('/status_update', methods=['POST'])
@admin_required
def update_latecomer():
    statecode = request.form['state_code'].upper()
    status = request.form['status'].capitalize()
    amount = request.form['amount']
        
    if not statecode:
        return jsonify({'success': False, 'message': 'State code is required'}), 400
    
    try:
        # Query the LateLog table to find the user
        latecomer = LateLog.query.filter_by(state_code=statecode, status="Pending").first()

        if not latecomer:
            return jsonify({'success': False, 'message': 'User not found'}), 404

        # Update the status of payment in the LateLog table
        if latecomer and status=="Approved" and amount != "":
            latecomer.status = status
            latecomer.amount = 0
            db.session.commit()
            approve_payment(latecomer.status)
            #socketio.emit('payment_status_update', {'status': latecomer.status})  # Send status update
            return jsonify({'success': True, 'message': f'Approved'}), 200
        elif status == "Pending" :
            return jsonify({'success': True, 'message': f'Still Pending'}), 200
 
    except Exception as e:
        db.session.rollback()  # Rollback in case of error
        return jsonify({'success': False, 'message': f'An error occurred: {str(e)}'}), 500
    
    
    return redirect(url_for('routes.admindash'))

@routes.route('/payment/late-signin', methods=['GET', 'POST'])
def payment():
    statecode = request.args.get('statecode')

    # Check Latecomer
    latecomer = LateLog.query.filter_by(state_code=statecode).first()
    
    # Check admin settings for payment details
    settings = AdminSettings.query.first()

    # Check if the statecode exists in the database
    if latecomer:
        amount = latecomer.amount
        # return jsonify({"success":True,"message":"Sent latecomer"})
        return render_template("paymentpage.html", 
                               statecode=statecode, 
                               amount=amount, 
                               bankname=settings.bank_name,
                               acctname=settings.account_name, 
                               acctnum=settings.account_number)
    else :
        return jsonify({"success":False,"message":"Couldn't find latecomer"}) # Failure status error

@routes.route('/check_status', methods=['GET'])
def check_status():
    # Get 'statecode' from query parameters
    statecode = request.args.get('statecode').upper()

    # Validate 'statecode' input
    if not statecode:
        return jsonify({"error": "Statecode is required"}), 400

    try:
        # Query the database for the status
        latecomer = LateLog.query.filter_by(state_code=statecode).first()

        # Check if the statecode exists in the database
        if latecomer:
            return jsonify({"status": latecomer.status}), 200
        else:
            return jsonify({"error": "Statecode not found"}), 404

    except SQLAlchemyError as e:
        # Handle database connection or query errors
        return jsonify({"error": str(e)}), 500
    
    finally:
        db.session.close() # Closes the session to avoid open queries from piling up

# Use this to handle Monthly Due requests
@routes.route('/admin/pending_due_requests', methods=['GET'])
def pending_due_requests():
    pending_requests = LateSignIn.query.filter_by(status="Pending").all()
    return jsonify([{
        "state_code": req.state_code,
        "date": req.date,
        "amount": req.amount,
        "status": req.status
    } for req in pending_requests])

@routes.route('/payment/monthly-due')
def pay_monthly_due():
    return render_template ("error.html")

@routes.route('/export_attendance', methods=['GET', 'POST'])
@admin_required
def export_attendance():

    format = request.args.get('format')
    meeting_date = request.args.get('start_date')
    meeting_date2 = request.args.get('end_date')
    # print("Received: ")
    # print(format)
    # print(meeting_date)
    # print(meeting_date2)
    
    if not all([format, meeting_date, meeting_date2]):
        return jsonify({'error': 'Missing required parameters'}), 400

    if format not in ['xlsx', 'pdf']:
        return jsonify({'error': 'Invalid format selected. Allowed formats are xlsx, pdf'}), 400

    # Get the set meeting day from AdminSettings then collect attendance
    settings = AdminSettings.query.first()
    meeting_day = settings.meeting_day
    # print(f"Set Meeting Day 2: {meeting_day}")
    if meeting_day is None:
        return jsonify({"success": False, "message": "No meeting day has been set."}), 200
    
    attendance_data = collect_attendance_data_for_range(meeting_date, meeting_date2, meeting_day)
    # Sort data for easier readability
    attendance_data = sort_by_batch_year_and_state_code(attendance_data)
    # print('Collect')
    # print(attendance_data)
    date_range = get_date_range(meeting_date, meeting_date2, meeting_day)
    data = preprocess_attendance_data_for_range(attendance_data,date_range)
    # print("Data")
    # print(data)
        
    if meeting_date != meeting_date2:
        meeting_date=f"{meeting_date}_to_{meeting_date2}"
    else : meeting_date = meeting_date
    
    # Generate the file in the requested format
    if format == 'xlsx':
        file_buffer = generate_xlsx_range(data, meeting_date)
        mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        extension = 'xlsx'
    elif format == 'pdf':
        return generate_pdf_with_wrapping_range(data, meeting_date)
        mimetype = 'application/pdf'
        extension = 'pdf'
    else:
        return jsonify({'error': 'Invalid format selected'}), 400

    # For BytesIO and io.BytesIO, send directly from memory
    return send_file(
        file_buffer,
        mimetype=mimetype,
        as_attachment=True,
        download_name=f"NIESAT_attendance_{meeting_date}.{extension}"
    )

@routes.route('/user_attendance_log', methods=['POST'])
def user_logs():
    user_logs = user.attendance_logs  # `user` is an instance of Users
    for log in user_logs:
        print(log.meeting_date, log.sign_in_time, log.ip_address)

@routes.route('/thankyou')
def thankyou():
    return render_template('thankyouregister.html')

@routes.route('/validate-device', methods=['POST'])
def validate_device():
    data = request.get_json()
    device_id = data.get('deviceId')
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    # print(f"Device ID: {device_id}")
    # print(f"Latitude: {latitude}")
    # print(f"Longitude: {longitude}")

    if not all([device_id, latitude, longitude]):
        return jsonify({'success': False, 'message': 'Missing required parameters.'}), 400

    # Retrieve admin-configured location (example)
    # admin_settings = AdminSettings.query.first()
    # required_latitude = admin_settings.required_latitude
    # required_longitude = admin_settings.required_longitude
    # location_tolerance = admin_settings.location_tolerance  # in degrees

    # Verify location
    # if abs(required_latitude - latitude) > location_tolerance or abs(required_longitude - longitude) > location_tolerance:
    #     return jsonify({'success': False, 'message': 'Location does not match the required area.'}), 403

    # Check if the device is already logged
    existing_device = DeviceLog.query.filter_by(device_id=device_id).first()
    if existing_device:
        return jsonify({'success': False, 'message': 'Device already used to sign-in today.'}), 403

    return jsonify({'success': True, 'message': 'Validation successful.'})


# ---------------- FUNCTIONS ---------------- #

def check_user_reg_exists(user_data=None,statecode=None,last_name=None, **kwargs):
    if statecode and last_name :
        # print(last_name)
        # print(statecode)
        try:
            # Query for the user
            user = Users.query.filter_by(
                state_code=statecode,
                last_name=last_name
            ).first()

            # RETURN RESPONSE
            if not user:
                # print("None")
                return False
            else:
                return user

        except IntegrityError:
            db.session.rollback()  # Rollback the transaction
            # print("IntegrityError: User might already exist. Querying again...")
            # Re-query the user in case of integrity error, 
            # check again using case-insensitive format
            return Users.query.filter(
                Users.state_code == user_data['state_code'],
                Users.first_name.ilike(user_data['first_name']),  # Case-insensitive
                Users.last_name.ilike(user_data['last_name'])
            ).first()
    
    if user_data :
        # Normalize input for consistent comparison
        # print(user_data['first_name'])
        # print(user_data['middle_name'])
        # print(user_data['last_name'])
        # print(user_data['gender'])
        # print(user_data['local_gov'])
        # print(user_data['state_code'])
        try:
            # Query for the user
            new_user = Users.query.filter_by(
                state_code=user_data['state_code'],
                first_name=user_data['first_name'],
                last_name=user_data['last_name']
            ).first()

            # If the user does not exist, create a new one
            if not new_user:
                new_user = Users(
                    first_name=user_data['first_name'],
                    middle_name=user_data['middle_name'],
                    last_name=user_data['last_name'],
                    gender=user_data['gender'],
                    local_gov=user_data['local_gov'],
                    state_code=user_data['state_code'],
                    registration_date=datetime.now().date()
                )
                db.session.add(new_user)
                db.session.commit()
                # print("New User Added.")
            return new_user

        except IntegrityError:
            db.session.rollback()  # Rollback the transaction
            # print("IntegrityError: User might already exist. Querying again...")
            # Re-query the user in case of integrity error, 
            # check again using case-insensitive format
            return Users.query.filter(
                Users.state_code == user_data['state_code'],
                Users.first_name.ilike(user_data['first_name']),  # Case-insensitive
                Users.last_name.ilike(user_data['last_name'])
            ).first()

        except Exception as e:
            # print(f"An unexpected error occurred: {str(e)}")
            db.session.rollback()
            return None

def check_user_attendance_exists(statecode):
    # Check if the state code is already in the day's attendance
    
    meeting_date = datetime.now().date()  # Default to today's date
    user_exists = Users.query.filter_by(state_code=statecode).first()
    if user_exists:
        attendance_logged = AttendanceLog.query.filter_by(user_id=user_exists.id, meeting_date=meeting_date).first()
        if attendance_logged:
            return f"StateCode, {statecode}, already logged for today!"
    
    return ""

def record_attendance(user):
    # print(f"Record ID: {user.id}")
    # Record user attendance for the day
    new_attendance = AttendanceLog(
        user_id=user.id,  # Assuming `user` is an instance of Users
        sign_in_time=datetime.now().time(),
        # ip_address=request.remote_addr,
        meeting_date=datetime.now().date()
    )
    db.session.add(new_attendance)
    db.session.commit()
    # print("User attendance added.")
    
    return True
    
def update_latecomer_status(stateCode):
    # Find the late log for the state code
    late_log = LateLog.query.filter_by(state_code=stateCode).first()
    print(late_log)
    
    if late_log:
        late_log.amount = 0
        late_log.status = "Approved"
        db.session.commit()

def check_latefile(statecode):
    # Check if statecode is in the LateLog table
    late_log = LateLog.query.filter_by(state_code=statecode).first()
    
    if late_log:
        return True
    return False

def get_client_IP():
    # global client_ip
    if request.headers.getlist("X-Forwarded-For") :
        client_ip = request.headers.getlist("X-Forwarded-For")[0]
        # print(1)
        return client_ip
    else :
        client_ip = request.remote_addr
        # print(2)
        return client_ip

def pop_latecomer(statecode):
    # Remove user from LateLog after fine fee payment is confirmed
    Latecomer = LateLog.query.filter_by(state_code=statecode, status="Approved").first()
    db.session.delete(Latecomer)
    db.session.commit()
    # Notify WebSocket clients about the update
    send_latelog_updates()

def get_attendance_data(meeting_date):
    # Get attendance data for one particular day
    meeting_date = meeting_date
    # meeting_date = datetime.now().date()
    
    if not meeting_date:
        meeting_date = datetime.now().date()
        
    log_query = AttendanceLog.query.join(Users).add_columns(
        Users.first_name, Users.middle_name, Users.last_name, Users.state_code, Users.gender,
        AttendanceLog.meeting_date
    )
    
    if meeting_date:
        log_query = log_query.filter(AttendanceLog.meeting_date == meeting_date)

    logs = log_query.all()

    attendance_data = [
        {
            'first_name': log.first_name,
            'middle_name': log.middle_name,
            'last_name': log.last_name,
            'state_code': log.state_code,
            'meeting_date': log.meeting_date.strftime('%Y-%m-%d'),
            # 'gender': log.gender,
            'gender': getattr(log, 'gender', 'N/A')  # Provide a fallback value
        }
        for log in logs
    ]
    # print(attendance_data)
    
    return attendance_data



def getSettings():
    # Get Admin Settings
    settings = AdminSettings.query.first()
    if not settings:
        return {}  # Return empty dict if no settings exist
    settings_data = {
        "lateness_fine": settings.lateness_fine,
        "monthly_due": settings.monthly_due,
        "account_name": settings.account_name,
        "account_number": settings.account_number,
        "bank_name": settings.bank_name,
        "admin_username": settings.admin_username,
        "meeting_day": settings.meeting_day,
        "allow_attendance": settings.allow_attendance
    }
    
    return settings_data

def preprocess_data(data):
    # Preprocess Data for pdf generation
    formatted_data = []
    for i, record in enumerate(data, start=1):
        full_name = f"{record['first_name']} {record['middle_name']} {record['last_name']}"
        state_code = record.get('state_code', 'N/A')
        gender = record.get('gender', 'N/A')
        formatted_data.append({
            'S/N': i,
            'NAME': full_name,
            'STATE CODE': state_code,
            'SEX': gender
        })
    return formatted_data

def generate_xlsx_range(data, meeting_date):
    # Create an in-memory buffer for the Excel file
    excel_buffer = BytesIO()
    
    # Add the serial number column to the data
    data = [{"S/N": i + 1, **record} for i, record in enumerate(data)]
    
    with pd.ExcelWriter(excel_buffer, engine='xlsxwriter') as writer:
        df = pd.DataFrame(data)
        df.to_excel(writer, index=False, startrow=4, sheet_name='Attendance')

        # Access the workbook and worksheet
        workbook = writer.book
        worksheet = writer.sheets['Attendance']

        # Add a title and merge cells for it
        title = (f"NIGERIA INNOVATIVE ENGINEERS SCIENTIST AND APPLIED TECHNOLOGIST (NIESAT)"
                 f"\nCOMMUNITY DEVELOPMENT SERVICE GROUP ATTENDANCE for {meeting_date}")
        worksheet.merge_range("A1:R3", title, workbook.add_format({
            'align': 'center', 'valign': 'vcenter', 'bold': True, 'font_size': 18, 'text_wrap':True
        }))
        
        # Write the headers manually below the title
        # for col_num, col_name in enumerate(df.columns):
        #     worksheet.write(2, col_num, col_name, workbook.add_format({'font_size': 12,'bold': True,'align': 'center', 'valign': 'vcenter'}))

        # Adjust column widths dynamically
        for col_num, col_name in enumerate(df.columns):
            max_length = max(df[col_name].astype(str).apply(len).max(), len(col_name)) + 2
            worksheet.set_column(col_num, col_num, max_length)

        # Wrap text for the "NAME" column
        name_format = workbook.add_format({'font': 'Book Antiqua', 'font_size':11})
        worksheet.set_column('C:C', 20, name_format)

    excel_buffer.seek(0)
    return excel_buffer

def generate_pdf_with_wrapping_range(data, meeting_date):
    # Create a BytesIO buffer
    pdf_buffer = BytesIO()

    # Initialize the document
    doc = SimpleDocTemplate(pdf_buffer, pagesize=letter)

    # Define styles
    styles = getSampleStyleSheet()
    normal_style = styles["Normal"]

    # Extract dynamic dates from the data
    dynamic_dates = sorted({key for record in data for key in record.keys() if key not in ["NAME", "STATE CODE", "GENDER"]})

    # Prepare table headers
    headers = ["S/N", "NAME", "STATE CODE", "SEX"] + dynamic_dates
    table_data = [headers]  # Add headers

    # Add data rows
    for index, record in enumerate(data, start=1):
        row = [
            str(index),  # Serial number
            Paragraph(record["NAME"], normal_style),  # Name
            record["STATE CODE"],  # State code
            record["GENDER"],  # Gender
        ] + [record.get(date, "N/A") for date in dynamic_dates]  # Dynamic dates
        table_data.append(row)
    
    # Create the table
    col_widths = [0.5 * inch, 2.5 * inch, 1.5 * inch, 1 * inch] + [1 * inch] * len(dynamic_dates)
    table = Table(table_data, colWidths=col_widths)

    # Style the table
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),  # Header background
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),  # Header text color
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),  # Center align all cells
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),  # Header font
        ('FONTSIZE', (0, 0), (-1, -1), 10),  # Font size for all cells
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),  # Padding for header row
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),  # Row background
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),  # Grid lines
    ]))

    # Build the document
    elements = [
        Paragraph(f"""NIGERIA INNOVATIVE ENGINEERS SCIENTIST AND APPLIED TECHNOLOGIST (NIESAT)
             <br/>COMMUNITY DEVELOPMENT SERVICE GROUP ATTENDANCE for {meeting_date}""", styles['Title']),
        table
    ]
    doc.build(elements)

    # Rewind the buffer
    pdf_buffer.seek(0)

    # Return the PDF as a response
    return Response(
        pdf_buffer,
        mimetype='application/pdf',
        headers={
            "Content-Disposition": f"attachment; filename=NIESAT_attendance_log_{meeting_date}.pdf"
        }
    )

def collect_attendance_data_for_range(date1=None,date2=None,meeting_day=None, **kwargs):
    # def collect_attendance_data_for_range(date1, date2, meeting_day):
    if meeting_day is None:
        # Generate the date range for specific day
        date_range = get_date_range(date1, date2)
        
    else: 
        # Generate the date range for everyday
        date_range = get_date_range(date1, date2, meeting_day)

    # print("Date Range:", date_range)
    all_attendance_data = []

    # Loop through each date and fetch attendance logs
    for date in date_range:
        logs = AttendanceLog.query.join(Users).add_columns(
            Users.first_name, Users.middle_name, Users.last_name, Users.gender,
            Users.state_code, AttendanceLog.meeting_date
        ).filter(AttendanceLog.meeting_date == date).all()
        
        # Append logs to attendance data
        for log in logs:
            try:
                all_attendance_data.append({
                    "first_name": log.first_name,
                    "middle_name": log.middle_name or "",  # Handle missing middle name
                    "last_name": log.last_name,
                    "state_code": log.state_code,
                    "gender": log.gender,
                    "meeting_date": log.meeting_date.strftime("%Y-%m-%d")
                })
            except AttributeError as e:
                print(f"Error processing log: {log}. Error: {e}")

    # print("Collected Attendance Data:", all_attendance_data)
    return all_attendance_data
        

def get_date_range(date1=None,date2=None,meeting_day=None, **kwargs):
    # def get_date_range(date1, date2, meeting_day):
    start_date = datetime.strptime(date1, "%Y-%m-%d")
    end_date = datetime.strptime(date2, "%Y-%m-%d")
    
    if meeting_day is None:
        # Generate all dates in the range for everyday
        date_range = [(start_date + timedelta(days=i)).strftime("%Y-%m-%d") 
                    for i in range((end_date - start_date).days + 1)]
        
    else:
        # Map meeting day to Python's weekday numbering (0=Monday, ..., 6=Sunday)
        day_mapping = {
            "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
            "Friday": 4, "Saturday": 5, "Sunday": 6
        }
        
        # Set target day to admin meeting day
        target_day = day_mapping.get(meeting_day)
        
        if target_day is None:
            raise ValueError(f"Invalid meeting day: {meeting_day}")

        # Generate all dates in the range that match the target day
        date_range = [
            (start_date + timedelta(days=i)).strftime("%Y-%m-%d") 
                      for i in range((end_date - start_date).days + 1)
                      if (start_date + timedelta(days=i)).weekday() == target_day
                  ]
    
    return date_range

def preprocess_attendance_data_for_range(attendance_data, date_range):
    # Dictionary to store users and their attendance
    users = {}
    for record in attendance_data:
        user_key = f"{record['first_name']} {record['middle_name']} {record['last_name']}"
        if user_key not in users:
            users[user_key] = {
                # "S/N": serial_number,
                "NAME": user_key,
                "STATE CODE": record["state_code"],
                "GENDER": record["gender"],
                **{date: "A" for date in date_range}  # Default to "A" (Absent)
            }
        # Mark present for the specific date
        users[user_key][record["meeting_date"]] = "P"

    # Convert dictionary to list of dictionaries
    return list(users.values())

def sort_by_batch_year_and_state_code(data):
    # Define a custom sorting key
    def extract_sort_key(item):
        state_code = item['state_code']
        # Extract components: batch letter, year, last 4 digits
        batch_letter = state_code.split('/')[1][-1]  # Last character of the middle section
        year = int(state_code.split('/')[1][:2])    # First 2 digits of the middle section
        last_digits = int(state_code.split('/')[-1])  # Last 4 digits of the state code
        # Return sorting key: Batch (A, B, C), Year (descending), Last digits (ascending)
        return batch_letter, -year, last_digits

    # Sort the data using the custom key
    sorted_data = sorted(data, key=extract_sort_key)
    return sorted_data

