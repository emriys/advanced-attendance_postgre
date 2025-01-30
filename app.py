from flask import Flask,session,request
from flask_session import Session
import socket
from datetime import timedelta
from blueprints import register_blueprints
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate, upgrade
from dotenv import load_dotenv
import os
from models import *
from initializeDatabase import initialize_admin_settings
from flask import make_response
from routes import routes
from flask_cors import CORS
from extensions import socketio, logging


# Setup Flask app
app = Flask(__name__)
CORS(app)

# Load environment variables from .env file
load_dotenv()

# Configure application
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY')
app.permanent_session_lifetime = timedelta(minutes=5) # Set session timeout
app.config['SESSION_COOKIE_SECURE'] = False  # Only send cookies over HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True  # Prevent JavaScript access to cookies
app.config['WTF_CSRF_ENABLED'] = False # For cross-device access

# Initialize the database POSTGRESQL
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('SQLALCHEMY_DATABASE_URI')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False  # To disable unnecessary tracking

# Create queue pool to handle connections to database by reusing
# instead of closing and reopening new ones for each query
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = { 
    "pool_pre_ping": True,      # Ensures broken connections are detected by checking if a connection is alive before using it.
    "pool_recycle": 900,        # Recycles connections every 15 mins to prevent stale connections
    "pool_size": 10,            # Number of persistent connections in the pool ready to use
    "max_overflow": 20,         # Additional connections allowed beyond pool_size for when traffic spikes
    "pool_timeout": 30          # Wait time, in seconds, for a connection before throwing an error
}
# db = SQLAlchemy(app, session_options={"autocommit": False, "autoflush": False})

logging.info("Database URI:", os.getenv('SQLALCHEMY_DATABASE_URI'))

# Initialize SQLAlchemy and Migrate
db.init_app(app)
migrate = Migrate(app, db)

# Database Initialization
with app.app_context():
    db.create_all()  # Create tables if they don't exist
    initialize_admin_settings()  # Initialize AdminSettings
    upgrade() # This applies migrations automatically

# Keeps connections open but removes sessions after each request
# to prevent memory buildup
@app.teardown_appcontext
def shutdown_session(exception=None):
    db.session.remove()  # Closes sessions properly

# Register Blueprints
register_blueprints(app)
app.register_blueprint(routes)

# Session refresh for admin
@app.before_request
def refresh_session():
    if request.path.startswith('/admin') and 'admin_logged_in' in session:
        # print(f"{session['admin_logged_in']}: Refreshing admin")
        session.modified = True  # Refresh session timeout


# ---------------- RUN APPLICATION ---------------- #

if __name__ == "__main__":
    socketio.init_app(app)
    socketio.run(app,host="0.0.0.0", port=5000, debug=True)
