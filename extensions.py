from flask_socketio import SocketIO, emit
import logging
import pytz

# Initialize WebSocket without attaching it to `app` yet
socketio = SocketIO(async_mode="eventlet", cors_allowed_origins="*")

# Configure logging
logging.basicConfig(level=logging.WARNING)  # Logs infos, warnings and errors

# Define time zones
nigeria_tz = pytz.timezone("Africa/Lagos")  # Nigeria is UTC+1