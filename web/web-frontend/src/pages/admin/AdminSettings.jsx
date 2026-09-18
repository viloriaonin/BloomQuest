import React, { useState } from "react";
import { CheckCircle2, LockKeyhole, Save, UserRound } from "lucide-react";
import { createPortal } from "react-dom";
import { usePopup } from "../../components/PopupProvider";

const AdminSettings = ({ theme, onThemeChange }) => {
  const { showAlert, showConfirm } = usePopup();
  const [settings, setSettings] = useState(() => ({
    fullName: localStorage.getItem("name") || "Admin",
    department: localStorage.getItem("department") || "Administration",
    role: localStorage.getItem("role") || "Administrator",
  }));
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const email = localStorage.getItem("email") || "admin@bloomquest.edu";

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
  };

  const saveSettings = async () => {
    if (!settings.fullName.trim()) {
      await showAlert("Please enter the administrator name before saving.", "Invalid profile");
      return;
    }
    if (!(await showConfirm("Are you sure you want to save the updated administrator profile?", "Confirm changes"))) return;
    localStorage.setItem("bloomquest-settings", JSON.stringify(settings));
    localStorage.setItem("name", settings.fullName.trim());
    localStorage.setItem("department", settings.department);
    window.dispatchEvent(new CustomEvent("profile-updated"));
    setSaved(true);
    setSaveMessage("Changes saved successfully.");
  };

  const updatePassword = async () => {
    if (!passwords.current || !passwords.next || passwords.next !== passwords.confirm) {
      setPasswordError("Enter the current password and matching new passwords.");
      return;
    }
    if (passwords.next.length < 8 || !/[A-Z]/.test(passwords.next) || !/[0-9]/.test(passwords.next) || !/[^A-Za-z0-9]/.test(passwords.next)) {
      setPasswordError("Use at least 8 characters, including an uppercase letter, a number, and a symbol.");
      return;
    }
    if (passwords.current === passwords.next) {
      setPasswordError("Your new password must be different from the current password.");
      return;
    }
    setPasswordLoading(true);
    setPasswordError("");
    try {
      const response = await fetch("/api/user/change-password/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, current_password: passwords.current, new_password: passwords.next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPasswordError(typeof data.detail === "string" ? data.detail : "The password could not be updated.");
        return;
      }
      setPasswordOpen(false);
      setPasswords({ current: "", next: "", confirm: "" });
      await showAlert("Password updated successfully.", "Security");
    } catch {
      setPasswordError("The password update did not complete. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="bq-admin-settings max-w-5xl space-y-4 page-transition">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="bq-admin-panel">
          <div className="flex items-center gap-3 border-b border-[#262A34] pb-4"><UserRound size={18} className="text-[#C4485A]" /><div><h2>Profile</h2><p className="bq-admin-muted mt-1">Update the administrator account details.</p></div></div>
          <div className="mt-5 space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#ECEDEF]">Full name<input value={settings.fullName} onChange={(event) => updateField("fullName", event.target.value)} className="bq-field mt-2 w-full px-3 py-2" /></label><label className="text-sm font-semibold text-[#ECEDEF]">Department<input value={settings.department} readOnly className="bq-field mt-2 w-full px-3 py-2 opacity-70" /></label></div><div className="flex justify-end"><button type="button" onClick={saveSettings} className="bq-admin-action"><Save size={15} /> {saved ? "Saved" : "Save changes"}</button></div>{saveMessage && <div className="flex items-center gap-2 rounded-lg border border-emerald-800/50 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300"><CheckCircle2 size={15} />{saveMessage}</div>}</div>
        </section>

        <section className="bq-admin-panel">
          <div className="flex items-center gap-3 border-b border-[#262A34] pb-4"><LockKeyhole size={18} className="text-[#C4485A]" /><div><h2>Security</h2><p className="bq-admin-muted mt-1">Manage administrator account access.</p></div></div>
          <div className="mt-5 rounded-xl border border-[#262A34] bg-[#1B1E26] p-4"><p className="text-sm font-medium text-[#ECEDEF]">Password</p><p className="mt-1 text-sm text-[#8B8F99]">Keep the administrator account secure.</p><button type="button" onClick={() => setPasswordOpen(true)} className="bq-secondary-button mt-4 px-3 py-2 text-sm">Change password</button></div>
        </section>
      </div>

      <section className="bq-admin-panel">
        <div className="flex items-center gap-3 border-b border-[#262A34] pb-4"><span className="text-lg">Aa</span><div><h2>Appearance</h2><p className="bq-admin-muted mt-1">Choose the theme for the administrator workspace.</p></div></div>
        <div className="mt-5 grid max-w-md grid-cols-2 gap-3" role="radiogroup" aria-label="Admin theme">
          {[['dark', 'Dark', 'Admin workspace theme'], ['light', 'Light', 'User workspace theme']].map(([value, label, detail]) => <button key={value} type="button" role="radio" aria-checked={theme === value} onClick={() => changeTheme(value)} className={`rounded-lg border p-4 text-left transition-colors ${theme === value ? "border-[#C4485A] bg-[#C4485A]/10" : "border-[#262A34] bg-[#1B1E26]"}`}><span className="block text-sm font-semibold text-[#ECEDEF]">{label}</span><span className="mt-1 block text-xs text-[#8B8F99]">{detail}</span></button>)}
        </div>
      </section>


      {passwordOpen && createPortal(<div className={theme === "light" ? "bq-admin-light" : "bq-admin-dark"}><div className="bq-modal-overlay fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:items-center"><section className="bq-modal-panel my-auto w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto p-6"><div className="mb-4 flex items-center justify-between"><h2>Change Password</h2><button type="button" onClick={() => setPasswordOpen(false)} className="bq-secondary-button px-3 py-1 text-xs">Close</button></div>{["current", "next", "confirm"].map((field) => <label key={field} className="mt-3 block text-sm font-semibold text-[#ECEDEF]">{field === "current" ? "Current Password" : field === "next" ? "New Password" : "Confirm New Password"}<input type="password" value={passwords[field]} onChange={(event) => { setPasswordError(""); setPasswords((current) => ({ ...current, [field]: event.target.value })); }} className="bq-field mt-1 w-full px-3 py-2" /></label>)}{passwordError && <p className="mt-3 text-sm leading-5 text-red-300">{passwordError}</p>}<button type="button" onClick={updatePassword} disabled={passwordLoading} className="bq-admin-action mt-5 disabled:cursor-not-allowed disabled:opacity-60">{passwordLoading ? "Updating password..." : "Update Password"}</button></section></div></div>, document.body)}
    </div>
  );
};

export default AdminSettings;
