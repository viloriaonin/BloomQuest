import React, { useState } from "react";
import { CheckCircle2, Eye, EyeOff, LockKeyhole, Save, UserRound } from "lucide-react";
import { createPortal } from "react-dom";
import { usePopup } from "../../components/PopupProvider";
import { API_URL } from "../../config/api";

const PasswordField = ({ label, value, onChange, visible, onToggle, autoComplete }) => (
  <label className="block text-sm font-semibold text-[#ECEDEF]">
    {label}
    <span className="relative mt-1 block">
      <input
        required
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        className="bq-field w-full px-3 py-2 pr-11"
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-slate-400 transition hover:text-slate-200"
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </span>
  </label>
);

const AdminSettings = ({ theme, onThemeChange, departmentAdmin = false, superAdmin = false }) => {
  const { showAlert, showConfirm } = usePopup();
  const [settings, setSettings] = useState(() => ({
    fullName: localStorage.getItem("name") || "Admin",
    department: localStorage.getItem("department") || "Administration",
    role: localStorage.getItem("role") || "Administrator",
  }));
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordOtp, setPasswordOtp] = useState("");
  const [passwordStep, setPasswordStep] = useState("request");
  const [passwordOtpMessage, setPasswordOtpMessage] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const email = localStorage.getItem("email") || "admin@bloomquest.edu";
  const [profileEmail, setProfileEmail] = useState(email);
  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const [emailChangeStep, setEmailChangeStep] = useState("request");
  const [emailChangeForm, setEmailChangeForm] = useState({
    newEmail: "",
    currentPassword: "",
    currentEmailConfirmationCode: "",
    newEmailOtp: "",
  });
  const [emailChangeError, setEmailChangeError] = useState("");
  const [emailChangeMessage, setEmailChangeMessage] = useState("");
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);

  const changeTheme = (nextTheme) => {
    localStorage.setItem("bloomquest-admin-theme", nextTheme);
    localStorage.setItem("bloomquest-theme", nextTheme);
    window.dispatchEvent(new CustomEvent("theme-updated", { detail: { theme: nextTheme } }));
    onThemeChange(nextTheme);
  };

  const updateField = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setSaveMessage("");
    setSaveError("");
  };

  const saveSettings = async () => {
    if (!settings.fullName.trim()) {
      await showAlert(`Please enter the ${departmentAdmin ? "Department Admin" : "administrator"} name before saving.`, "Invalid profile");
      return;
    }
    if (!(await showConfirm(`Are you sure you want to save the updated ${departmentAdmin ? "Department Admin" : "administrator"} profile?`, "Confirm changes"))) return;
    setSaveError("");
    try {
      let savedSettings = { ...settings, fullName: settings.fullName.trim() };
      if (departmentAdmin) {
        const response = await fetch(`${API_URL}/user/profile`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ full_name: savedSettings.fullName }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.detail || "Could not save your profile.");
        }
        savedSettings = {
          ...savedSettings,
          fullName: result.full_name || savedSettings.fullName,
          department: result.department || savedSettings.department,
        };
        setSettings(savedSettings);
      }
      localStorage.setItem("bloomquest-settings", JSON.stringify(savedSettings));
      localStorage.setItem("name", savedSettings.fullName);
      localStorage.setItem("department", savedSettings.department);
      window.dispatchEvent(new CustomEvent("profile-updated"));
      setSaved(true);
      setSaveMessage("Changes saved successfully.");
    } catch (error) {
      setSaveError(error.message || "Could not save your profile.");
    }
  };

  const requestEmailChangeConfirmation = async (event) => {
    event.preventDefault();
    setEmailChangeError("");
    setEmailChangeMessage("");
    setEmailChangeLoading(true);
    try {
      const response = await fetch(`${API_URL}/super-admin/email-change/request-otp`, {
        method: "POST",
        headers: {
          Authorization: `******"token") || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          new_email: emailChangeForm.newEmail.trim(),
          current_password: emailChangeForm.currentPassword,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = typeof result.detail === "string"
          ? result.detail
          : Array.isArray(result.detail)
            ? result.detail.map((issue) => issue.msg).filter(Boolean).join(" ")
            : "";
        throw new Error(detail || "Could not send an email change confirmation code.");
      }
      setEmailChangeForm((current) => ({ ...current, currentPassword: "" }));
      setEmailChangeStep("confirmCurrentEmail");
      setEmailChangeMessage("A separate confirmation code was sent to your current email address.");
    } catch (error) {
      setEmailChangeError(error.message || "Could not send an email change confirmation code.");
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const confirmCurrentEmail = async (event) => {
    event.preventDefault();
    setEmailChangeError("");
    setEmailChangeLoading(true);
    try {
      const response = await fetch(`${API_URL}/super-admin/email-change/confirm-current-email`, {
        method: "POST",
        headers: {
          Authorization: `******"token") || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_email_confirmation_code: emailChangeForm.currentEmailConfirmationCode,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = typeof result.detail === "string"
          ? result.detail
          : Array.isArray(result.detail)
            ? result.detail.map((issue) => issue.msg).filter(Boolean).join(" ")
            : "";
        throw new Error(detail || "Could not confirm the email change request.");
      }
      setEmailChangeStep("verifyNewEmail");
      setEmailChangeMessage("Your current email is confirmed. A verification code was sent to the new email address.");
    } catch (error) {
      setEmailChangeError(error.message || "Could not confirm the email change request.");
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const confirmEmailChange = async (event) => {
    event.preventDefault();
    setEmailChangeError("");
    setEmailChangeLoading(true);
    try {
      const response = await fetch(`${API_URL}/super-admin/email-change/confirm`, {
        method: "POST",
        headers: {
          Authorization: `******"token") || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          new_email_otp: emailChangeForm.newEmailOtp,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = typeof result.detail === "string"
          ? result.detail
          : Array.isArray(result.detail)
            ? result.detail.map((issue) => issue.msg).filter(Boolean).join(" ")
            : "";
        throw new Error(detail || "Could not verify the email change.");
      }
      if (typeof result.email !== "string" || !result.email) {
        throw new Error("The server did not return the updated email address.");
      }
      localStorage.setItem("email", result.email);
      setProfileEmail(result.email);
      window.dispatchEvent(new CustomEvent("profile-updated"));
      setEmailChangeOpen(false);
      setEmailChangeStep("request");
      setEmailChangeForm({ newEmail: "", currentPassword: "", currentEmailConfirmationCode: "", newEmailOtp: "" });
      setEmailChangeMessage("Email address updated successfully.");
    } catch (error) {
      setEmailChangeError(error.message || "Could not verify the email change.");
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const cancelEmailChange = () => {
    setEmailChangeOpen(false);
    setEmailChangeStep("request");
    setEmailChangeForm({ newEmail: "", currentPassword: "", currentEmailConfirmationCode: "", newEmailOtp: "" });
    setEmailChangeError("");
    setEmailChangeMessage("");
  };

  const togglePasswordVisibility = (field) => {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }));
  };

  const updatePassword = async () => {
    if (passwordStep === "request" && (!passwords.current || !passwords.next || passwords.next !== passwords.confirm)) {
      setPasswordError("Enter the current password and matching new passwords.");
      return;
    }
    if (passwordStep === "request" && (passwords.next.length < 8 || !/[A-Z]/.test(passwords.next) || !/[0-9]/.test(passwords.next) || !/[^A-Za-z0-9]/.test(passwords.next))) {
      setPasswordError("Use at least 8 characters, including an uppercase letter, a number, and a symbol.");
      return;
    }
    if (passwordStep === "request" && passwords.current === passwords.next) {
      setPasswordError("Your new password must be different from the current password.");
      return;
    }
    setPasswordLoading(true);
    setPasswordError("");
    try {
      const response = superAdmin && passwordStep === "request"
        ? await fetch(`${API_URL}/user/change-password/request-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, current_password: passwords.current, new_password: passwords.next }),
        })
        : await fetch(`${API_URL}/user/change-password/update`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            current_password: passwords.current,
            new_password: passwords.next,
            ...(superAdmin ? { otp: passwordOtp } : {}),
          }),
        });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = typeof data.detail === "string"
          ? data.detail
          : Array.isArray(data.detail)
            ? data.detail.map((issue) => issue.msg).filter(Boolean).join(" ")
            : "";
        setPasswordError(detail || (passwordStep === "request"
          ? "Could not send the verification code."
          : "The password could not be updated."));
        return;
      }
      if (superAdmin && passwordStep === "request") {
        setPasswordStep("verify");
        setPasswordOtpMessage(data.message || "A verification code was sent to your email address.");
        return;
      }
      setPasswordOpen(false);
      setPasswordStep("request");
      setPasswordOtp("");
      setPasswordOtpMessage("");
      setPasswords({ current: "", next: "", confirm: "" });
      await showAlert("Password updated successfully.", "Security");
    } catch (error) {
      setPasswordError(error.message || (passwordStep === "request"
        ? "The verification code could not be sent. Please try again."
        : "The password update did not complete. Please try again."));
    } finally {
      setPasswordLoading(false);
    }
  };

  const closePasswordModal = () => {
    setPasswordOpen(false);
    setPasswordStep("request");
    setPasswordOtp("");
    setPasswordOtpMessage("");
    setPasswordError("");
    setPasswords({ current: "", next: "", confirm: "" });
    setVisiblePasswords({});
  };

  return (
    <div className="bq-admin-settings max-w-5xl space-y-4 page-transition">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="bq-admin-panel">
          <div className="flex items-center gap-3 border-b border-[#262A34] pb-4"><UserRound size={18} className="text-[#C4485A]" /><div><h2>Profile</h2><p className="bq-admin-muted mt-1">Update your account details.</p></div></div>
          <div className="mt-5 space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#ECEDEF]">Full name<input value={settings.fullName} onChange={(event) => updateField("fullName", event.target.value)} className="bq-field mt-2 w-full px-3 py-2" /></label><label className="text-sm font-semibold text-[#ECEDEF]">{superAdmin ? "Role" : "Department"}<input value={superAdmin ? "Super administrator" : settings.department} readOnly className="bq-field mt-2 w-full px-3 py-2 opacity-70" /></label>{superAdmin && <label className="text-sm font-semibold text-[#ECEDEF]">Email address<input value={profileEmail} readOnly className="bq-field mt-2 w-full px-3 py-2 opacity-70" /></label>}</div><div className="flex justify-end"><button type="button" onClick={saveSettings} className="bq-admin-action"><Save size={15} /> {saved ? "Saved" : "Save changes"}</button></div>{saveError && <p role="alert" className="text-sm text-red-300">{saveError}</p>}{saveMessage && <div className="flex items-center gap-2 rounded-lg border border-emerald-800/50 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300"><CheckCircle2 size={15} />{saveMessage}</div>}</div>
        </section>

        <section className="bq-admin-panel">
          <div className="flex items-center gap-3 border-b border-[#262A34] pb-4"><LockKeyhole size={18} className="text-[#C4485A]" /><div><h2>Security</h2><p className="bq-admin-muted mt-1">Manage {departmentAdmin ? "Department Admin" : "administrator"} account access.</p></div></div>
          <div className="mt-5 space-y-3 rounded-xl border border-[#262A34] bg-[#1B1E26] p-4">
            <div>
              <p className="text-sm font-medium text-[#ECEDEF]">Password</p>
              <p className="mt-1 text-sm text-[#8B8F99]">Keep your account secure.</p>
              <button type="button" onClick={() => { setPasswordError(""); setPasswordOpen(true); }} className="bq-admin-action mt-4">
                Change password
              </button>
            </div>
            {superAdmin && (
              <div className="border-t border-[#262A34] pt-3">
                <p className="text-sm font-medium text-[#ECEDEF]">Email address</p>
                <p className="mt-1 text-sm text-[#8B8F99]">Confirm your password, approve the request through your current email, and verify the new address before changing your sign-in email.</p>
                <button
                  type="button"
                  onClick={() => {
                    setEmailChangeOpen(true);
                    setEmailChangeMessage("");
                  }}
                  className="bq-admin-action mt-3"
                >
                  Update email address
                </button>
                {emailChangeMessage && !emailChangeOpen && (
                  <p role="status" className="mt-3 text-sm text-emerald-300">{emailChangeMessage}</p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="bq-admin-panel">
        <div className="flex items-center gap-3 border-b border-[#262A34] pb-4"><span className="text-lg">Aa</span><div><h2>Appearance</h2><p className="bq-admin-muted mt-1">Choose the theme for the administrator workspace.</p></div></div>
        <div className="mt-5 grid max-w-md grid-cols-2 gap-3" role="radiogroup" aria-label="Workspace theme">
          {[['dark', 'Dark'], ['light', 'Light']].map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={theme === value} onClick={() => changeTheme(value)} className={`rounded-lg border p-4 text-left transition-colors ${theme === value ? "border-[#C4485A] bg-[#C4485A]/10" : "border-[#262A34] bg-[#1B1E26]"}`}><span className="block text-sm font-semibold text-[#ECEDEF]">{label}</span><span className="mt-1 block text-xs text-[#8B8F99]">{label} {departmentAdmin ? "Department Admin" : "Admin"} workspace theme</span></button>)}
        </div>
      </section>


      {emailChangeOpen && superAdmin && createPortal(
        <div className={theme === "light" ? "bq-admin-light" : "bq-admin-dark"}>
          <div className="bq-modal-overlay fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="update-email-title"
              className="bq-modal-panel my-auto w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 id="update-email-title">Update Email Address</h2>
                <button type="button" onClick={cancelEmailChange} disabled={emailChangeLoading} className="bq-secondary-button px-3 py-1 text-xs">
                  Close
                </button>
              </div>
              <form
                onSubmit={emailChangeStep === "request"
                  ? requestEmailChangeConfirmation
                  : emailChangeStep === "confirmCurrentEmail"
                    ? confirmCurrentEmail
                    : confirmEmailChange}
                className="space-y-3"
              >
                {emailChangeStep === "request" ? (
                  <>
                    <label className="block text-sm font-semibold text-[#ECEDEF]">
                      New email address
                      <input
                        required
                        type="email"
                        maxLength={255}
                        value={emailChangeForm.newEmail}
                        onChange={(event) => setEmailChangeForm((current) => ({ ...current, newEmail: event.target.value }))}
                        className="bq-field mt-1 w-full px-3 py-2"
                        autoComplete="email"
                      />
                    </label>
                    <PasswordField
                      label="Current password"
                      value={emailChangeForm.currentPassword}
                      onChange={(event) => setEmailChangeForm((current) => ({ ...current, currentPassword: event.target.value }))}
                      visible={Boolean(visiblePasswords.emailChangeCurrent)}
                      onToggle={() => togglePasswordVisibility("emailChangeCurrent")}
                      autoComplete="current-password"
                    />
                    <p className="text-xs text-[#8B8F99]">We will first send a separate confirmation code to {profileEmail}. After you confirm the request, a verification code will be sent only to the new address.</p>
                  </>
                ) : emailChangeStep === "confirmCurrentEmail" ? (
                  <>
                    <p className="text-sm text-[#8B8F99]">{emailChangeMessage}</p>
                    <label className="block text-sm font-semibold text-[#ECEDEF]">
                      Current email confirmation code
                      <input
                        required
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={emailChangeForm.currentEmailConfirmationCode}
                        onChange={(event) => setEmailChangeForm((current) => ({ ...current, currentEmailConfirmationCode: event.target.value }))}
                        className="bq-field mt-1 w-full px-3 py-2"
                        autoComplete="one-time-code"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[#8B8F99]">{emailChangeMessage}</p>
                    <label className="block text-sm font-semibold text-[#ECEDEF]">
                      New email verification code
                      <input
                        required
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={emailChangeForm.newEmailOtp}
                        onChange={(event) => setEmailChangeForm((current) => ({ ...current, newEmailOtp: event.target.value }))}
                        className="bq-field mt-1 w-full px-3 py-2"
                        autoComplete="one-time-code"
                      />
                    </label>
                  </>
                )}
                {emailChangeError && <p role="alert" className="text-sm text-red-300">{emailChangeError}</p>}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button type="submit" disabled={emailChangeLoading} className="bq-admin-action disabled:cursor-not-allowed disabled:opacity-60">
                    {emailChangeLoading
                      ? "Please wait..."
                      : emailChangeStep === "request"
                        ? "Send confirmation code"
                        : emailChangeStep === "confirmCurrentEmail"
                          ? "Confirm email change request"
                          : "Verify new email and update"}
                  </button>
                  <button type="button" onClick={cancelEmailChange} disabled={emailChangeLoading} className="bq-secondary-button px-3 py-2 text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>,
        document.body,
      )}
      {passwordOpen && createPortal(
        <div className={theme === "light" ? "bq-admin-light" : "bq-admin-dark"}>
          <div className="bq-modal-overlay fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="change-password-title"
              className="bq-modal-panel my-auto w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 id="change-password-title">Change Password</h2>
                <button type="button" onClick={closePasswordModal} disabled={passwordLoading} className="bq-secondary-button px-3 py-1 text-xs">Close</button>
              </div>
              {superAdmin && passwordStep === "verify" ? (
                <>
                  <p className="text-sm text-[#8B8F99]">{passwordOtpMessage}</p>
                  <label className="mt-4 block text-sm font-semibold text-[#ECEDEF]">
                    Email verification code
                    <input
                      required
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={passwordOtp}
                      onChange={(event) => {
                        setPasswordError("");
                        setPasswordOtp(event.target.value);
                      }}
                      className="bq-field mt-1 w-full px-3 py-2"
                      autoComplete="one-time-code"
                    />
                  </label>
                </>
              ) : (
                ["current", "next", "confirm"].map((field) => {
                  const label = field === "current"
                    ? "Current Password"
                    : field === "next"
                      ? "New Password"
                      : "Confirm New Password";
                  return (
                    <div key={field} className="mt-3">
                      <PasswordField
                        label={label}
                        value={passwords[field]}
                        onChange={(event) => {
                          setPasswordError("");
                          setPasswords((current) => ({ ...current, [field]: event.target.value }));
                        }}
                        visible={Boolean(visiblePasswords[field])}
                        onToggle={() => togglePasswordVisibility(field)}
                      />
                    </div>
                  );
                })
              )}
              {passwordError && <p className="mt-3 text-sm leading-5 text-red-300">{passwordError}</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={updatePassword} disabled={passwordLoading} className="bq-admin-action disabled:cursor-not-allowed disabled:opacity-60">
                  {passwordLoading
                    ? "Please wait..."
                    : superAdmin && passwordStep === "request"
                      ? "Send verification code"
                      : superAdmin
                        ? "Verify and update password"
                        : "Update Password"}
                </button>
                {superAdmin && passwordStep === "verify" && (
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordStep("request");
                      setPasswordOtp("");
                      setPasswordOtpMessage("");
                      setPasswordError("");
                    }}
                    disabled={passwordLoading}
                    className="bq-secondary-button px-3 py-2 text-sm"
                  >
                    Back
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default AdminSettings;
