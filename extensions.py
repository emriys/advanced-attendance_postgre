from flask_socketio import SocketIO
import logging

# Initialize WebSocket without attaching it to `app` yet
socketio = SocketIO(async_mode="eventlet", cors_allowed_origins="*")

# Configure logging
logging.basicConfig(level=logging.WARNING)  # Logs infos, warnings and errors