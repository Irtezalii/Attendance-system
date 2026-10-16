import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import type { Role } from "../../shared/api";
import { useAuth } from "../lib/auth";
import { branding } from "../lib/branding";

interface NavItem {
  to: string;
  label: string;
  /** Which paths highlight this item. Defaults to `to` and everything below it. */
  match?: (pathname: string) => boolean;
}

const isNewClass = (p: string) => /^\/faculty\/offerings\/\d+\/sessions\/new$/.test(p);

const NAV: Record<Role, NavItem[]> = {
  student: [
    { to: "/student", label: "Dashboard", match: (p) => p === "/student" },
    { to: "/student/courses", label: "My Courses" },
    { to: "/student/history", label: "Attendance History" },
    { to: "/student/profile", label: "My Profile" },
  ],
  faculty: [
    { to: "/faculty", label: "Dashboard", match: (p) => p === "/faculty" },
    {
      to: "/faculty/courses",
      label: "My Courses",
      match: (p) => p.startsWith("/faculty/courses") || (p.startsWith("/faculty/offerings/") && !isNewClass(p)),
    },
    { to: "/faculty/take-attendance", label: "Take Attendance", match: (p) => p.startsWith("/faculty/take-attendance") || isNewClass(p) },
    { to: "/faculty/records", label: "Attendance Records", match: (p) => p.startsWith("/faculty/records") || p.startsWith("/faculty/sessions/") },
    { to: "/faculty/profile", label: "My Profile" },
  ],
};

function isActive(item: NavItem, pathname: string): boolean {
  return item.match ? item.match(pathname) : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function Layout() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!me) return null;

  const items = NAV[me.user.role];
  const home = items[0].to;
  const roleLabel =
    me.profile.kind === "student"
      ? `${me.profile.programme.code} · ${me.profile.rollNumber}`
      : (me.profile.designation ?? "Faculty");

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-ku-maroon-700 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to={home} className="flex min-w-0 items-center gap-3" onClick={() => setMenuOpen(false)}>
            <img src={branding.logo.src} alt={branding.logo.alt} className="size-10 shrink-0 rounded-full bg-white p-0.5" />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-serif text-base font-semibold sm:text-lg">
                {branding.instituteShort} · <span className="sm:hidden">Attendance</span>
                <span className="hidden sm:inline">{branding.appName}</span>
              </p>
              <p className="hidden truncate text-xs text-ku-maroon-100 sm:block">
                {branding.universityName} · {branding.departmentName}
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-4 md:flex">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium">{me.profile.name}</p>
              <p className="text-xs text-ku-maroon-100">{roleLabel}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-white/40 px-3 py-1.5 text-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ku-gold-400"
            >
              Sign out
            </button>
          </div>

          <button
            className="rounded-lg p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ku-gold-400 md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>

        {/* Desktop navigation */}
        <nav aria-label="Main" className="hidden border-t border-white/10 md:block">
          <ul className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-6">
            {items.map((item) => {
              const active = isActive(item, pathname);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={`-mb-px inline-block border-b-2 px-3 py-2.5 text-sm font-medium ${
                      active ? "border-ku-gold-500 text-white" : "border-transparent text-ku-maroon-100 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Mobile navigation */}
        {menuOpen && (
          <nav id="mobile-menu" aria-label="Main" className="border-t border-white/10 md:hidden">
            <div className="px-4 py-3">
              <p className="text-sm font-medium">{me.profile.name}</p>
              <p className="text-xs text-ku-maroon-100">{roleLabel}</p>
            </div>
            <ul className="border-t border-white/10 py-1">
              {items.map((item) => {
                const active = isActive(item, pathname);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`block border-l-4 px-4 py-2.5 text-sm ${
                        active ? "border-ku-gold-500 bg-white/10 font-medium" : "border-transparent text-ku-maroon-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-white/10 px-4 py-3">
              <button onClick={handleLogout} className="w-full rounded-lg border border-white/40 px-3 py-2 text-sm hover:bg-white/10">
                Sign out
              </button>
            </div>
          </nav>
        )}
        <div className="h-1 bg-ku-gold-500" aria-hidden />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-500 sm:px-6">
          {branding.universityName} · {branding.instituteName} ({branding.instituteShort}) · {branding.departmentName}
        </div>
      </footer>
    </div>
  );
}
