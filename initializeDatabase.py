from models import AdminSettings, db
from werkzeug.security import generate_password_hash

def initialize_admin_settings():
    # Check if an AdminSettings record already exists
    if not AdminSettings.query.first():
        # Create a default AdminSettings record
        admin_settings = AdminSettings(
            admin_username="admin",  # Default username
            admin_password=generate_password_hash("password", method="scrypt"),  # Hashed default password
            early_arrival_start=None,
            late_arrival_start=None,
            late_arrival_end=None,
            lateness_fine=0.0,
            monthly_due=0.0,
            account_name=None,
            account_number=None,
            bank_name=None,
            meeting_day=None,
            allow_attendance=None
        )
        # Add and commit the record
        db.session.add(admin_settings)
        db.session.commit()
        # print("AdminSettings table initialized with default values.")
    else:
        pass
        # print("AdminSettings table already initialized.")