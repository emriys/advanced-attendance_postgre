from models import AdminSettings

def getSettings():
    # Get Admin Settings
    settings = AdminSettings.query.first()
    if not settings:
        return {}  # Return empty dict if no settings exist
    return {
        "lateness_fine": settings.lateness_fine,
        "monthly_due": settings.monthly_due,
        "account_name": settings.account_name,
        "account_number": settings.account_number,
        "bank_name": settings.bank_name,
        "admin_username": settings.admin_username,
        "meeting_day": settings.meeting_day,
        "allow_attendance": settings.allow_attendance
    }