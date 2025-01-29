from flask_socketio import SocketIO

# Initialize WebSocket without attaching it to `app` yet
socketio = SocketIO(async_mode="eventlet", cors_allowed_origins="*")
