import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import PublicNav from "../../components/PublicNav";
import { API_URL } from "../../config/api";

const SetPassword = () => {
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token") || "");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (token) window.history.replaceState({}, document.title, window.location.pathname);
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This password setup link is missing or invalid. Ask your department administrator to create a new account invitation.");
      return;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError("Choose a password with at least 8 characters, one uppercase letter, one number, and one symbol.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/set-initial-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          temporary_password: temporaryPassword,
          new_password: password,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not set your password. Please try again.");
      setComplete(true);
    } catch (requestError) {
      setError(requestError.message || "Unable to connect to BloomQuest. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f6f3] text-slate-900">
      <PublicNav />
      <main className="mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl items-center justify-center px-4 py-12 sm:px-6">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-10">
          <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-[#7b1113]">
            {complete ? <ShieldCheck aria-hidden="true" size={24} /> : <KeyRound aria-hidden="true" size={24} />}
          </div>
          {complete ? (
            <div role="status">
              <h1 className="text-2xl font-bold tracking-tight">Password set successfully</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Your temporary password has been replaced. You can now sign in with your new password.
              </p>
              <Link
                className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-[#7b1113] px-5 py-3 font-semibold text-white transition hover:bg-[#641012]"
                to="/login"
              >
                Go to sign in
              </Link>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b1113]">Secure account setup</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">Set your permanent password</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Enter the temporary password from your BloomQuest email, then choose a new password for your account.
                This one-time setup link expires after 24 hours.
              </p>
              {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <label className="block text-sm font-medium text-slate-700">
                  Temporary password
                  <span className="relative mt-2 block">
                    <input
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 outline-none transition focus:border-[#7b1113] focus:ring-4 focus:ring-rose-100"
                      onChange={(event) => setTemporaryPassword(event.target.value)}
                      required
                      type={showTemporaryPassword ? "text" : "password"}
                    />
                    <button
                      aria-label={showTemporaryPassword ? "Hide temporary password" : "Show temporary password"}
                      aria-pressed={showTemporaryPassword}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 transition hover:text-[#7b1113] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7b1113]"
                      onClick={() => setShowTemporaryPassword((visible) => !visible)}
                      type="button"
                    >
                      {showTemporaryPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                    </button>
                  </span>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  New password
                  <span className="relative mt-2 block">
                    <input
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 outline-none transition focus:border-[#7b1113] focus:ring-4 focus:ring-rose-100"
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      type={showPassword ? "text" : "password"}
                    />
                    <button
                      aria-label={showPassword ? "Hide new password" : "Show new password"}
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 transition hover:text-[#7b1113] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7b1113]"
                      onClick={() => setShowPassword((visible) => !visible)}
                      type="button"
                    >
                      {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                    </button>
                  </span>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Confirm new password
                  <span className="relative mt-2 block">
                    <input
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 outline-none transition focus:border-[#7b1113] focus:ring-4 focus:ring-rose-100"
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                      type={showConfirmPassword ? "text" : "password"}
                    />
                    <button
                      aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}
                      aria-pressed={showConfirmPassword}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 transition hover:text-[#7b1113] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7b1113]"
                      onClick={() => setShowConfirmPassword((visible) => !visible)}
                      type="button"
                    >
                      {showConfirmPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                    </button>
                  </span>
                </label>
                <p className="text-xs leading-5 text-slate-500">Use at least 8 characters, including an uppercase letter, a number, and a symbol.</p>
                <button
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#7b1113] px-5 py-3 font-semibold text-white transition hover:bg-[#641012] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading}
                  type="submit"
                >
                  {loading ? "Setting password…" : "Set password"}
                </button>
              </form>
              <p className="mt-6 text-center text-sm text-slate-500">
                Already set it? <Link className="font-semibold text-[#7b1113] hover:underline" to="/login">Sign in</Link>
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default SetPassword;
