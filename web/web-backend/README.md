# BloomQuest Backend Setup

The backend runs on Windows and Linux. It requires a reachable PostgreSQL database configured with `DATABASE_URL` in `database.env`.

## OTP Email Delivery

For Railway deployments, configure a transactional email API because outbound SMTP is disabled on Free, Trial, and Hobby plans. The backend supports Resend over HTTPS:

- `RESEND_API_KEY`: Resend API key, stored as a secret in the hosting provider's environment variables.
- `EMAIL_FROM`: sender identity on a domain verified with Resend, for example `BloomQuest <no-reply@example.com>`.

Verify the sender domain with Resend before deploying, then add both variables to the backend service and redeploy. The existing Gmail SMTP settings (`SMTP_SERVER`, `SMTP_PORT`, `SENDER_EMAIL`, and `SENDER_PASSWORD`) remain available for local development and Railway Pro deployments. Never commit API keys or SMTP passwords.

## Windows

From this directory, create and install into a virtual environment:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

PDF export uses Microsoft Word automation on Windows, so desktop Microsoft Word must be installed for that feature. Other backend routes do not require Word.

## Linux

On Debian/Ubuntu, install Python and LibreOffice, then set up and run the virtual environment (use your distribution's package manager elsewhere):

```bash
sudo apt-get update
sudo apt-get install -y python3 python3-venv libreoffice
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

LibreOffice is used for PDF export on Linux. DOCX export does not require LibreOffice.

## Web Frontend

Run the React frontend separately from `web/web-frontend` with Node.js installed:

```bash
npm install
npm start
```

The frontend expects the backend at `http://localhost:8000` by default. Set `REACT_APP_API_BASE_URL` when using another backend URL.

## Flutter Desktop App

The Flutter app is in `mobile/mob_frontend` and includes Windows and Linux desktop targets.

On Windows, install the Flutter SDK and Visual Studio's Desktop development with C++ workload. Then run:

```powershell
flutter pub get
flutter run -d windows
```

On Debian/Ubuntu Linux, install the Flutter Linux build prerequisites, including the system keyring library used by secure storage:

```bash
sudo apt-get install -y clang cmake ninja-build pkg-config libgtk-3-dev liblzma-dev libsecret-1-dev
flutter pub get
flutter run -d linux
```
