import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { Spinner } from "../components/ui";
import { ApiRequestError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { branding } from "../lib/branding";
import { buttonStyles, inputStyles } from "../lib/styles";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function LoginPage() {
  const { me, login, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The role comes from the account on the server; there is nothing to choose here.
  if (me) return <Navigate to={me.user.role === "student" ? "/student" : "/faculty"} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter the email address of your university account.";
    if (!password) errors.password = "Enter your password.";
    setFieldErrors(errors);
    setError(null);
    if (errors.email || errors.password) return;

    setSubmitting(true);
    try {
      const current = await login(email.trim(), password);
      navigate(current.user.role === "student" ? "/student" : "/faculty", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiRequestError && err.status === 401
          ? "The email or password is incorrect, or this account is not active."
          : err instanceof Error
            ? err.message
            : "Sign-in failed.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Institutional panel with campus photograph */}
      <section
        className="relative flex flex-col justify-between overflow-hidden bg-ku-navy-900 bg-cover bg-center px-6 py-8 text-white sm:px-10 lg:w-1/2 lg:py-12"
        style={{ backgroundImage: `url("${branding.loginBackground.src}")` }}
      >
        <div className="absolute inset-0 bg-linear-to-br from-ku-maroon-900/95 via-ku-maroon-800/85 to-ku-navy-900/90" aria-hidden />
        <div className="relative flex items-center gap-4">
          <img src={branding.logo.src} alt={branding.logo.alt} className="size-16 shrink-0 rounded-full bg-white object-contain p-2 shadow-md sm:size-20" />
          <div>
            <p className="font-serif text-xl font-semibold sm:text-2xl">{branding.universityName}</p>
            <p className="text-sm text-ku-maroon-100">{branding.departmentName}</p>
          </div>
        </div>
        <div className="relative mt-8 lg:mt-0">
          <div className="mb-4 h-1 w-16 bg-ku-gold-500" aria-hidden />
          <h1 className="font-serif text-3xl font-semibold leading-tight text-white sm:text-4xl">{branding.appName}</h1>
          <p className="mt-3 max-w-md text-ku-maroon-100">
            {branding.instituteName} ({branding.instituteShort})
          </p>
          <p className="mt-6 hidden max-w-md text-sm text-ku-maroon-100/90 lg:block">
            Students can follow their attendance in every enrolled course. Faculty record attendance for the classes they
            teach.
          </p>
        </div>
      </section>

      {/* Sign-in form */}
      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Students and faculty sign in with their university account.</p>

          {sessionExpired && !error && (
            <p role="status" className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Your session has ended. Please sign in again.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
                className={inputStyles}
              />
              {fieldErrors.email && (
                <p id="email-error" className="mt-1 text-xs text-red-700">
                  {fieldErrors.email}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={fieldErrors.password ? true : undefined}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
                  className={`${inputStyles} pr-16`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-slate-500 hover:text-ku-maroon-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="password-error" className="mt-1 text-xs text-red-700">
                  {fieldErrors.password}
                </p>
              )}
            </div>
            <button type="submit" disabled={submitting} className={`${buttonStyles.primary} w-full py-2.5`}>
              {submitting && <Spinner className="size-4 border-white/40 border-t-white" />}
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-xs leading-relaxed text-slate-500">
            Accounts are issued by the {branding.departmentName}. If you cannot sign in, contact the {branding.instituteShort}{" "}
            office.
          </p>
        </div>
      </section>
    </div>
  );
}
