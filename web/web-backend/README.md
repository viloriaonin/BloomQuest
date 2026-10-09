# BloomQuest Backend Setup

The backend runs on Windows and Linux. It requires a reachable PostgreSQL database configured with `DATABASE_URL` in `database.env`.

## Railway Deployment

Configure the Railway backend service root directory as `web/web-backend`. Railway uses the `railway.json` in that directory to build with Nixpacks, start Uvicorn on Railway's assigned `$PORT`, and health-check the existing `/` route. Set `DATABASE_URL` in the service variables to a reachable PostgreSQL database before deployment.

The frontend is a separate service/build from `web/web-frontend`; set `REACT_APP_API_BASE_URL` to the deployed backend URL when building it.

After saving an assessment in New Analysis, faculty can download the Table of Specifications as Excel or PDF, and the test as DOCX or PDF. The PDF TOS export is served by `GET /api/questions/export/tos/pdf` and uses the saved assessment record.

## Department Dean Accounts

A campus administrator can create a Department Dean account from Academic Management by opening the department's Leadership section. The account is assigned to that department and campus, and its generated initial password is sent to the dean's email using the configured Resend or SMTP delivery settings. This provisions the account only; a dean-specific dashboard and additional permissions are managed separately.

## OTP Email Delivery

For Railway deployments, configure a transactional email API because outbound SMTP is disabled on Free, Trial, and Hobby plans. The backend supports Resend over HTTPS:

- `RESEND_API_KEY`: Resend API key, stored as a secret in the hosting provider's environment variables.
- `EMAIL_FROM`: sender identity on a domain verified with Resend, for example `BloomQuest <no-reply@example.com>`.

Verify the sender domain with Resend before deploying, then add both variables to the backend service and redeploy. The existing Gmail SMTP settings (`SMTP_SERVER`, `SMTP_PORT`, `SENDER_EMAIL`, and `SENDER_PASSWORD`) remain available for local development and Railway Pro deployments. Never commit API keys or SMTP passwords.

## Department Subjects and Course Information Sheets

Department Admins must provide a readable Course Information Sheet (PDF, DOCX, or XLSX; maximum 10 MB) and assign a subject code and program when creating a subject. From the program's subject list, they can preview the current CIS, download the original, replace it without changing subject details, and add one when the subject has none. CIS metadata and file access are restricted to the Department Admin's assigned department. Faculty select a subject with a CIS on file and upload only the module; BloomQuest uses the department-managed CIS during analysis. Subjects without a CIS remain unavailable for faculty module analysis until the Department Admin adds one.

### Capstone demo without email delivery

For a temporary demonstration only, set `DEMO_EMAIL_VERIFICATION=true` in the backend service environment. Contact Admin OTPs will still be generated, stored, expire after 10 minutes, and be validated normally, but they will not be emailed. The generated OTP is written to the backend logs. Anyone with log access can see these temporary codes, so disable this setting after the demo by setting it to `false` or removing it, then redeploy.

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

Department Admin accounts are created and assigned to one department by a Super Admin from **Admin Management**. Their shared admin dashboard provides department-scoped Dashboard, Leadership Management, Faculty Management, Academic Management, Question Bank, and Settings tools. Question Bank reuses the academic hierarchy and faculty question browser, and its API limits subjects and questions to the Department Admin’s assigned department. In their assigned department they maintain programs and subjects, assign department faculty to programs and subjects, and manage the department dean and program chairs. Department Admins can directly add faculty accounts for programs in their department, and Campus Admins can add faculty accounts to programs across their assigned campus. Both workflows require a faculty number, stored as text so leading zeroes are preserved. BloomQuest emails the temporary password and a one-time, 24-hour password-setup link. Faculty must enter the temporary password from the email when choosing a permanent password. Campus Admins can also create a dean login from User Management; it is assigned the Department Admin role for the selected department and becomes that department’s dean. Settings allow a Department Admin to update their own display name and password, but not their department assignment or role.

The Faculty Management view shows only Active and Archived faculty accounts, and allows Department Admins to archive or restore accounts within their department. The program chair account flow is limited to creating a faculty account directly assigned as an unfilled program chair. Department Admins can also submit academic change requests involving another department. Campus Admins can review requests within their campus, while Super Admins can review all requests. Academic change requests record a status and reviewer response and do not apply cross-department changes automatically.

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
