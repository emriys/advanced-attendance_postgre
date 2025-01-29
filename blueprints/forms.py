from flask import Blueprint, request, jsonify
from models import AdminSettings, db, Users
from extensions import socketio
from routes import getSettings
from datetime import datetime
import bcrypt
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField,SubmitField,FloatField,DateField,SelectField
from wtforms.validators import DataRequired,Length,EqualTo,ValidationError,NumberRange,Regexp,Optional
from werkzeug.security import generate_password_hash, check_password_hash

# Create a Blueprint
forms_bp = Blueprint('forms', __name__)


class MemberRegisterForm(FlaskForm):
    first_name = StringField('First Name',
                             validators=[DataRequired(),Length(min=2,max=30),
                                         Regexp(
                                                regex=r'^[A-Za-z]+(-[A-Za-z]+)?$',
                                                message="First Name must contain only letters"
                                            )
                                        ])
    middle_name = StringField('Middle Name',
                              validators=[Optional(), Length(min=0,max=30),
                                          Regexp(
                                                regex=r'^[A-Za-z]+(-[A-Za-z]+)?$',
                                                message="Middle Name must contain only letters"
                                            )
                                          ])
    last_name = StringField('Surname',
                            validators=[DataRequired(), Length(min=2,max=30),
                                        Regexp(
                                                regex=r'^[A-Za-z]+(-[A-Za-z]+)?$',
                                                message="Surname must contain only letters"
                                            )
                                        ])
    local_gov_area = SelectField('Local Goverment Area',
                                 choices=[('','Select LGA'),
                                          ('ilorin-west','ILORIN WEST'),
                                          ('ilorin-south', 'ILORIN SOUTH')],
                                 validators=[DataRequired()],
                                  render_kw={'class':'form-select','id':'local_gov'})
    gender = SelectField('Gender',
                                choices=[('','Select Gender'),
                                        ('M','Male'),
                                        ('F', 'Female')],
                                validators=[DataRequired()],
                                render_kw={'class':'form-select'})
    state_code = StringField('State Code',
                             validators=[
                                 DataRequired(),
                                 Length(min=2,max=11),
                                 Regexp(
                                     regex=r'^[Kk][Ww]/\d{2}[a-cA-C]/\d{4}$',
                                     message="State code must follow the format: KW/XX/A/XXXX"
                                )
                            ])
    submit = SubmitField('Register',
                         render_kw={'class': 'button', 'type':'submit'})
    
    def validate_user(self,first_name,last_name,statecode):
        user = Users.query.filter_by(first_name=first_name,
                                     last_name=last_name,
                                     state_code=statecode
                                     ).first()
        if user:
            raise ValidationError(f"Member with statecode {state_code} already exists")

class SigninForm(FlaskForm):
        state_code = StringField('State Code',
                             validators=[
                                 DataRequired(),
                                 Length(min=2,max=11),
                                 Regexp(
                                     regex=r'^[Kk][Ww]/\d{2}[a-cA-C]/\d{4}$',
                                     message="State code must follow the format: KW/XX/A/XXXX"
                                    )
                                ])
        last_name = StringField('Surname',
                        validators=[DataRequired(), Length(min=2,max=30),
                                    Regexp(
                                     regex=r'^[A-Za-z]+(-[A-Za-z]+)?$',
                                     message="Surname must contain only letters"
                                )
                            ])
        deviceId = StringField('deviceId')
        
        submit = SubmitField('Sign-In')

#----------------- ADMIN SETTINGS FORMS --------------------#

@forms_bp.route('/change_login', methods=['GET', 'POST'])
def change_login():
    if request.method == "POST" :
        username = request.form['username'].lower()
        password = request.form['passwd']
        # print(username)
        # print(password)
        if not username or not password:
            return jsonify(success=False, message="Missing username or password!")
        
        # Query database
        settings = AdminSettings.query.first()
        
        # Hash password for data protection
        hashed_password = hash_password(password)
        
        # Save received details to database
        settings.admin_username = username
        settings.admin_password = hashed_password
        
        db.session.commit()
        
        # Emit WebSocket event to update settings page
        socketio.emit('admin_settings_update', getSettings())
        
        # Process feedback
        return jsonify(success=True, message="Login details updated successfully!")
    
    else:
        return 405
    
@forms_bp.route('/attend_time_update', methods=['GET', 'POST'])
def attend_time_update():
    if request.method == "POST" :
        early_start = request.form['early_start']
        late_start = request.form['late_start']
        late_end = request.form['late_end']
        # print(early_start)
        # print(late_start)
        # print(late_end)
        
        if not all([early_start, late_start, late_end]):
            return jsonify(success=False, message="Missing a key field!")
        
        try:
            # Convert string times to Python time objects
            early_start = datetime.strptime(early_start, "%H:%M").time()
            late_start = datetime.strptime(late_start, "%H:%M").time()
            late_end = datetime.strptime(late_end, "%H:%M").time()
            # print(early_start)
            # print(late_start)
            # print(late_end)

        except ValueError as e:
            # print(f"Error parsing time string: {e}")
            raise
        
        # Save received info to database
        settings = AdminSettings.query.first()
        settings.early_arrival_start = early_start
        settings.late_arrival_start = late_start
        settings.late_arrival_end = late_end
        db.session.commit()
        
        # Emit WebSocket event to update settings page
        socketio.emit('admin_settings_update', getSettings())
    
        # Process feedback
        return jsonify(success=True, message="Time updated successfully!")
    
    else:
        return """<html>NOT POST METHOD</html>"""
    
@forms_bp.route('/late_fee_update', methods=['GET', 'POST'])
def late_fee_update():
    if request.method == "POST" :
        late_fee = request.form['late-fee']
        if not late_fee:
            return jsonify(success=False, message="Missing a key field!")
        
        # Save received details to database
        settings = AdminSettings.query.first()
        settings.lateness_fine = late_fee
        db.session.commit()
        
        # Emit WebSocket event to update settings page
        socketio.emit('admin_settings_update', getSettings())
        
        # Process feedback
        return jsonify(success=True, message="Fee updated successfully!")
    
    else:
        return """<html>NOT POST METHOD</html>"""
    
@forms_bp.route('/due_amount_update', methods=['GET', 'POST'])
def due_amount_update():
    if request.method == "POST" :
        due_fee = request.form['due-fee']
        if not due_fee:
            return jsonify(success=False, message="Missing a key field!")
        
        # Save received details to database
        settings = AdminSettings.query.first()
        settings.monthly_due = due_fee
        db.session.commit()
        
        # Emit WebSocket event to update settings page
        socketio.emit('admin_settings_update', getSettings())
        
        # Process feedback
        return jsonify(success=True, message="Due amount updated successfully!")
    
    else:
        return """<html>NOT POST METHOD</html>"""
    
@forms_bp.route('/account_details', methods=['GET', 'POST'])
def account_details():
    if request.method == "POST" :
        acct_num = request.form['acct-num']
        acct_name = request.form['acct-name']
        bank_name = request.form['bank-name']

        if not all([acct_num, acct_name, bank_name]):
            return jsonify(success=False, message="Missing a key field!")
        
        # Save received info to database
        settings = AdminSettings.query.first()
        settings.account_name = acct_name
        settings.account_number = acct_num
        settings.bank_name = bank_name
        db.session.commit()
        
        # Emit WebSocket event to update settings page
        socketio.emit('admin_settings_update', getSettings())
        
        # Process feedback
        return jsonify(success=True, message="Account Details updated successfully!")
    
    else:
        return """<html>NOT POST METHOD</html>"""

@forms_bp.route('/meeting_day_update', methods=['GET', 'POST'])
def meeting_day_update():
    if request.method == "POST" :
        meeting_day = request.form['meeting_day'].capitalize()
        # print(meeting_day)
        if not meeting_day:
            return jsonify(success=False, message="Missing a key field!")
        
        # Save received details to database
        settings = AdminSettings.query.first()
        settings.meeting_day = meeting_day
        db.session.commit()
        
        # Emit WebSocket event to update settings page
        socketio.emit('admin_settings_update', getSettings())
        
        # Process feedback
        return jsonify(success=True, message="Meeting Day updated successfully!")
    
    else:
        return """<html>NOT POST METHOD</html>"""
    
@forms_bp.route('/allow_attendance', methods=['GET', 'POST'])
def allow_attendance():
    if request.method == "POST" :
        allow_attendance = request.form['allow_attendance'].capitalize()
        # print(allow_attendance)
        if not allow_attendance:
            return jsonify(success=False, message="Missing a key field!")
        
        # Save received details to database
        settings = AdminSettings.query.first()
        settings.allow_attendance = allow_attendance
        db.session.commit()
        
        # Emit WebSocket event to update settings page
        socketio.emit('admin_settings_update', getSettings())
        
        # Process feedback
        return jsonify(success=True, message=f"Attendance Collection {allow_attendance}!")
    
    else:
        return """<html>NOT POST METHOD</html>"""

#-------------------FUNCTIONS------------------#
    
# Function to hash a password
def hash_password(password):
    # Hash the password with scrypt
    hashed_password = generate_password_hash(password, method="scrypt")
    return hashed_password

# Function to verify a password
def check_password(password, hashed_password):
    return scrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

# Function to ensure database record exists
def get_or_create_admin_settings():
    settings = AdminSettings.query.first()
    if not settings:
        settings = AdminSettings()  # Create default settings if none exist
        db.session.add(settings)
        db.session.commit()
    return settings
