import { Link, Outlet, useNavigate } from "react-router";
import { useAuth } from "../lib/auth";

export function Layout() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  if (!me) return null;

  const home = me.user.role === "student" ? "/student" : "/faculty";
  const subtitle =
    me.profile.kind === "student"
      ? `${me.profile.rollNumber} · Semester ${me.profile.currentSemester}`
      : `${me.profile.designation} · ${me.profile.employeeId}`;

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to={home} className="flex items-center gap-2 font-semibold text-slate-900">
            <img src="/favicon.svg" alt="" className="size-7" />
            <span>College Attendance</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{me.profile.name}</p>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
