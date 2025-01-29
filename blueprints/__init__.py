from .forms import forms_bp

def register_blueprints(app):
    app.register_blueprint(forms_bp, url_prefix='/forms')