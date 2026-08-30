import React, { useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Download, Eye, EyeOff, FileText, KeyRound, LockKeyhole, Play, Save, ShieldCheck, UserRound, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const WORKSPACES = {
  reports: {
    eyebrow: "Quality intelligence",
    title: "Reports",
    description: "Turn completed analyses into review-ready quality summaries.",
  },
  templates: {
    eyebrow: "Reusable assessment design",
    title: "Templates & TOS",
    description: "Keep institutional TOS layouts ready for the next analysis.",
  },
  settings: {
    eyebrow: "Workspace preferences",
    title: "Settings",
    description: "Control the defaults that shape your assessment workflow.",
  },
};

const templates = [
  { name: "Standard Course Assessment", detail: "Balanced Bloom levels for a regular examination.", meta: "6 topics · 50 items" },
  { name: "Midterm Examination", detail: "A compact blueprint with stronger application coverage.", meta: "4 topics · 40 items" },
  { name: "Department Master TOS", detail: "Your institution-wide starting point for new courses.", meta: "8 topics · 60 items" },
];

const UserWorkspacePage = ({ section }) => {
  const navigate = useNavigate();
  const workspace = WORKSPACES[section] || WORKSPACES.reports;
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [saveResult, setSaveResult] = useState({ type: "", message: "" });
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordStep, setPasswordStep] = useState("form");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswordValues, setShowPasswordValues] = useState(false);

  const [settings, setSettings] = useState(() => {
    try {
      return {
        fullName: localStorage.getItem("name") || "Dr. Reyes",
        department: localStorage.getItem("department") || "Faculty",
        role: localStorage.getItem("role") || "Faculty",
      };
    } catch {
      return { fullName: "Dr. Reyes", department: "Faculty", role: "Faculty" };
    }
  });

  const updateField = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const handleSaveClick = () => {
    setConfirmSaveOpen(true);
  };

  const confirmSaveSettings = () => {
    if (!settings.fullName.trim()) {
      setSaveResult({ type: "error", message: "Please enter your full name before saving." });
      setConfirmSaveOpen(false);
      return;
    }

    localStorage.setItem("bloomquest-settings", JSON.stringify(settings));
    localStorage.setItem("name", settings.fullName);
    localStorage.setItem("department", settings.department);
    window.dispatchEvent(new CustomEvent("profile-updated"));
    setSaved(true);
    setSaveMessage("Changes saved successfully.");
    setSaveResult({ type: "success", message: "Your profile changes were saved successfully." });
    setConfirmSaveOpen(false);
  };

  const getPasswordStrength = (value) => {
    if (!value) return { score: 0, label: "" };
    let score = 0;
    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value)) score += 1;
    if (/[0-9]/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    const labelMap = ["Very weak", "Weak", "Fair", "Good", "Strong"];
    return { score, label: labelMap[Math.min(score, 4)] };
  };

  const passwordRules = [
    { label: "At least 8 characters", met: newPassword.length >= 8 },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "Contains number", met: /[0-9]/.test(newPassword) },
    { label: "Contains symbol", met: /[^A-Za-z0-9]/.test(newPassword) },
    { label: "Passwords match", met: Boolean(newPassword && confirmPassword && newPassword === confirmPassword) },
  ];

  const allPasswordRequirementsMet = passwordRules.every((rule) => rule.met);
  const passwordStrength = getPasswordStrength(newPassword);

  const resetPasswordModal = () => {
    setPasswordModalOpen(false);
    setPasswordStep("form");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordLoading(false);
    setShowPasswordValues(false);
  };

  const sendPasswordOtp = async () => {
    const email = localStorage.getItem("email") || "";

    if (!currentPassword.trim()) {
      setPasswordError("Please enter your current password.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setPasswordError("Please enter your new password and confirm it.");
      return;
    }

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setPasswordError("Use at least 8 characters, including an uppercase letter, a number, and a symbol.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError("Your new password must differ from your current password.");
      return;
    }

    if (!email) {
      setPasswordError("Your account email could not be loaded. Please sign in again.");
      return;
    }

    await updateUserPassword();
  };

  const getFriendlyErrorMessage = (payload) => {
    if (!payload) return "We could not update your password. Please review the details and try again.";
    if (typeof payload === "string") return payload;
    if (Array.isArray(payload)) {
      const firstMessage = payload[0];
      if (typeof firstMessage === "string") return firstMessage;
      if (firstMessage && typeof firstMessage.msg === "string") return firstMessage.msg;
      return "We could not update your password. Please review the details and try again.";
    }
    if (typeof payload?.detail === "string") return payload.detail;
    if (Array.isArray(payload?.detail)) {
      const first = payload.detail[0];
      if (first && typeof first.msg === "string") return first.msg;
    }
    if (typeof payload?.message === "string") return payload.message;
    return "We could not update your password. Please review the details and try again.";
  };

  const updateUserPassword = async () => {
    const email = localStorage.getItem("email") || "";

    const isNewPasswordValid = newPassword && confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword);

    if (!isNewPasswordValid) {
      setPasswordError("Please confirm a valid new password before updating.");
      return;
    }

    setPasswordError("");
    setPasswordLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/user/change-password/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setPasswordError(getFriendlyErrorMessage(data));
        return;
      }

      setPasswordStep("success");
    } catch {
      setPasswordError("The password update did not complete. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const passwordFieldClass = "mt-2 w-full rounded-lg border bg-white px-3 py-2.5 pr-10 text-sm font-normal outline-none transition focus:border-[#B4454A]";

  return (
    <div className="min-h-full p-6" style={{ backgroundColor: "#F5F7FB" }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "#B4454A" }}>{workspace.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold" style={{ color: "#0F172A" }}>{workspace.title}</h1>
          <p className="mt-2 text-sm" style={{ color: "#64748B" }}>{workspace.description}</p>
        </div>

        {section === "reports" && (
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Quality overview", "Compare Bloom alignment, coverage gaps, and issue counts.", "Open overview"],
              ["Analysis history", "Review completed assessments and reopen their source files.", "View history"],
              ["Export center", "Prepare a PDF or DOCX report for faculty review.", "Export report"],
            ].map(([title, detail, action]) => (
              <div key={title} className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(180,69,74,0.1)", color: "#B4454A" }}>
                  <Download size={18} />
                </div>
                <h2 className="mt-5 font-semibold" style={{ color: "#0F172A" }}>{title}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6" style={{ color: "#64748B" }}>{detail}</p>
                <button
                  type="button"
                  onClick={() => navigate(title === "Quality overview" ? "/dashboard" : "/history")}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold"
                  style={{ color: "#B4454A" }}
                >
                  {action} <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {section === "templates" && (
          <div className="grid gap-4 lg:grid-cols-3">
            {templates.map((template) => (
              <div key={template.name} className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "#FFF2D9", color: "#D97706" }}>
                    <FileText size={18} />
                  </div>
                  <span className="text-xs font-semibold" style={{ color: "#64748B" }}>{template.meta}</span>
                </div>
                <h2 className="mt-5 font-semibold" style={{ color: "#0F172A" }}>{template.name}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6" style={{ color: "#64748B" }}>{template.detail}</p>
                <button
                  type="button"
                  onClick={() => navigate("/input")}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: "#B4454A" }}
                >
                  <Play size={14} /> Use template
                </button>
              </div>
            ))}
          </div>
        )}

        {section === "settings" && (
          <div className="grid max-w-5xl gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <UserRound size={18} style={{ color: "#B4454A" }} />
                <div>
                  <h2 className="font-semibold" style={{ color: "#0F172A" }}>Profile</h2>
                  <p className="text-sm" style={{ color: "#64748B" }}>Your account details are synced to your role and department.</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold" style={{ color: "#0F172A" }}>
                    Full name
                    <input
                      value={settings.fullName}
                      onChange={(event) => updateField("fullName", event.target.value)}
                      className="mt-2 w-full rounded-lg border px-3 py-2 text-sm font-normal outline-none transition focus:border-[#B4454A]"
                      style={{ borderColor: "rgba(15,23,42,0.12)", color: "#0F172A" }}
                    />
                  </label>

                  <label className="text-sm font-semibold" style={{ color: "#0F172A" }}>
                    Department
                    <input
                      value={settings.department}
                      readOnly
                      className="mt-2 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm font-normal text-slate-600 outline-none"
                      style={{ borderColor: "rgba(15,23,42,0.12)" }}
                    />
                  </label>
                </div>

                <div className="flex justify-end pt-1">
                  <button type="button" onClick={handleSaveClick} className="bq-primary-button"><Save size={15} /> {saved ? "Saved" : "Save changes"}</button>
                </div>

                {saveMessage && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {saveMessage}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <LockKeyhole size={18} style={{ color: "#B4454A" }} />
                <div>
                  <h2 className="font-semibold" style={{ color: "#0F172A" }}>Security</h2>
                  <p className="text-sm" style={{ color: "#64748B" }}>Manage your account access.</p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border p-4" style={{ borderColor: "rgba(15,23,42,0.08)", backgroundColor: "#F8FAFC" }}>
                <p className="text-sm font-medium" style={{ color: "#0F172A" }}>Password</p>
                <p className="mt-1 text-sm" style={{ color: "#64748B" }}>Keep your account secure with a recent password update.</p>
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(true)}
                  className="mt-4 inline-flex items-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors hover:bg-slate-50"
                  style={{ borderColor: "rgba(15,23,42,0.12)", color: "#0F172A" }}
                >
                  Change password
                </button>
              </div>
            </div>

          </div>
        )}
      </div>

      {confirmSaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl border bg-white p-5 shadow-2xl" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <h3 className="text-lg font-semibold" style={{ color: "#0F172A" }}>Confirm changes</h3>
            <p className="mt-2 text-sm" style={{ color: "#64748B" }}>Are you sure you want to save the updated profile details?</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmSaveOpen(false)}
                className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-slate-50"
                style={{ borderColor: "rgba(15,23,42,0.12)", color: "#0F172A" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSaveSettings}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                style={{ backgroundColor: "#B4454A" }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {saveResult.type && (
        <div className="fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4">
          <div
            className="max-w-md rounded-xl border px-4 py-3 text-sm shadow-lg"
            style={{
              borderColor: saveResult.type === "success" ? "rgba(34,197,94,0.35)" : "rgba(180,69,74,0.3)",
              backgroundColor: saveResult.type === "success" ? "rgba(34,197,94,0.08)" : "rgba(180,69,74,0.08)",
              color: saveResult.type === "success" ? "#166534" : "#991B1B",
            }}
          >
            {saveResult.message}
          </div>
        </div>
      )}

      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-[440px] max-h-[82vh] overflow-y-auto rounded-2xl border bg-white p-5 shadow-2xl" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="flex items-start justify-between gap-4 border-b pb-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(180,69,74,0.12)", color: "#B4454A" }}>
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: "#0F172A" }}>Update password</h3>
                  <p className="text-sm" style={{ color: "#64748B" }}>
                    {passwordStep === "form" && "Confirm your current password and choose a secure new one."}
                    {passwordStep === "success" && "Your password has been updated."}
                  </p>
                </div>
              </div>
              <button type="button" onClick={resetPasswordModal} className="rounded-lg p-1.5 transition-colors hover:bg-slate-100" style={{ color: "#64748B" }} aria-label="Close password change modal">
                <X size={18} />
              </button>
            </div>

            {passwordError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{passwordError}</div>
            )}

            {passwordStep === "form" && (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-sm font-semibold" style={{ color: "#0F172A" }}>
                    Current password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordValues ? "text" : "password"}
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      placeholder="Enter your current password"
                      className={`${passwordFieldClass} ${passwordError ? "border-red-300" : "border-slate-200"}`}
                      style={{ borderColor: "rgba(15,23,42,0.12)" }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold" style={{ color: "#0F172A" }}>
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordValues ? "text" : "password"}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="Create a strong new password"
                      className={`${passwordFieldClass} ${passwordError ? "border-red-300" : "border-slate-200"}`}
                      style={{ borderColor: "rgba(15,23,42,0.12)" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordValues((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                      aria-label={showPasswordValues ? "Hide password" : "Show password"}
                    >
                      {showPasswordValues ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {newPassword && (
                    <div className="mt-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((stepIndex) => (
                          <div
                            key={stepIndex}
                            className="h-1.5 flex-1 rounded-full"
                            style={{ backgroundColor: passwordStrength.score >= stepIndex ? "#B4454A" : "#E2E8F0" }}
                          />
                        ))}
                      </div>
                      <p className="mt-1 text-xs" style={{ color: "#64748B" }}>{passwordStrength.label || "Strength"}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold" style={{ color: "#0F172A" }}>
                    Re-enter new password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordValues ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter your new password"
                      className={`${passwordFieldClass} ${passwordError ? "border-red-300" : allPasswordRequirementsMet ? "border-emerald-300" : "border-slate-200"}`}
                      style={{ borderColor: allPasswordRequirementsMet ? "rgba(34,197,94,0.7)" : confirmPassword && newPassword && confirmPassword !== newPassword ? "rgba(180,69,74,0.7)" : "rgba(15,23,42,0.12)" }}
                    />
                  </div>

                  {(newPassword || confirmPassword) && (
                    <div
                      className="mt-2 rounded-lg border px-3 py-2"
                      style={{
                        borderColor: allPasswordRequirementsMet ? "rgba(34,197,94,0.35)" : "rgba(180,69,74,0.25)",
                        backgroundColor: allPasswordRequirementsMet ? "rgba(34,197,94,0.04)" : "rgba(180,69,74,0.04)",
                      }}
                    >
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: allPasswordRequirementsMet ? "#15803D" : "#B4454A" }}>
                        {allPasswordRequirementsMet ? "Password requirements met" : "Password requirements"}
                      </p>
                      <div className="space-y-1.5">
                        {passwordRules.map((rule) => (
                          <div key={rule.label} className="flex items-center gap-2 text-xs" style={{ color: rule.met ? "#15803D" : "#B4454A" }}>
                            <span
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                              style={{ backgroundColor: rule.met ? "rgba(34,197,94,0.13)" : "rgba(180,69,74,0.12)", color: rule.met ? "#15803D" : "#B4454A" }}
                            >
                              {rule.met ? "✓" : "•"}
                            </span>
                            <span>{rule.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {confirmPassword && newPassword && confirmPassword !== newPassword && (
                    <p className="mt-1 text-xs" style={{ color: "#B4454A" }}>Passwords do not match.</p>
                  )}
                  {confirmPassword && newPassword && confirmPassword === newPassword && (
                    <p className="mt-1 text-xs" style={{ color: "#15803D" }}>Passwords match.</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={sendPasswordOtp}
                  disabled={passwordLoading}
                  className="inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                  style={{ backgroundColor: "#B4454A" }}
                >
                  {passwordLoading ? "Updating password..." : "Update password"}
                </button>
              </div>
            )}

            {passwordStep === "success" && (
              <div className="mt-5 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(34,197,94,0.12)", color: "#15803D" }}>
                  <CheckCircle2 size={28} />
                </div>
                <h4 className="mt-4 text-xl font-semibold" style={{ color: "#0F172A" }}>Password updated</h4>
                <p className="mt-2 text-sm" style={{ color: "#64748B" }}>Your password was successfully changed. Please use it the next time you sign in.</p>
                <button
                  type="button"
                  onClick={resetPasswordModal}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95"
                  style={{ backgroundColor: "#B4454A" }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserWorkspacePage;
