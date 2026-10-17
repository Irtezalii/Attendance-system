import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
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
  ],
};

// My Profile lives in the header's account area (not the nav); signing out happens there.
const PROFILE_PATH: Record<Role, string> = { student: "/student/profile", faculty: "/faculty/profile" };

/** Scroll distance after which the compact bar slides in (roughly the full header's height). */
const COMPACT_AFTER_PX = 140;

function isActive(item: NavItem, pathname: string): boolean {
  return item.match ? item.match(pathname) : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function useScrolledPast(px: number): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > px);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [px]);
  return past;
}

export function Layout() {
  const { me } = useAuth();
  const scrolled = useScrolledPast(COMPACT_AFTER_PX);
  if (!me) return null;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Full header in normal page flow. */}
      <HeaderBar compact={false} />
      {/*
        Compact bar, like uok.edu.pk: once the full header has scrolled away, a single-row
        bar slides down from the top (animate-header-in), and goes away again near the top.
      */}
      {scrolled && <HeaderBar compact />}

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

function HeaderBar({ compact }: { compact: boolean }) {
  const { me } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!me) return null;

  const items = NAV[me.user.role];
  const home = items[0].to;
  const profilePath = PROFILE_PATH[me.user.role];
  const onProfile = pathname === profilePath;
  const menuId = compact ? "mobile-menu-compact" : "mobile-menu";
  const roleLabel =
    me.profile.kind === "student"
      ? `${me.profile.programme.code} · ${me.profile.rollNumber}`
      : (me.profile.designation ?? "Faculty");

  const navLinks = (
    <ul className={`flex gap-1 ${compact ? "" : "w-full px-4 sm:px-6 lg:px-10"}`}>
      {items.map((item) => {
        const active = isActive(item, pathname);
        return (
          <li key={item.to}>
            <Link
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={`inline-block border-b-2 px-3 text-sm font-medium whitespace-nowrap ${compact ? "py-1.5" : "-mb-px py-2.5"} ${
                active ? "border-ku-gold-500 text-white" : "border-transparent text-ku-maroon-100 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const profileButton = (
    <Link
      to={profilePath}
      aria-current={onProfile ? "page" : undefined}
      className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ku-gold-400 ${
        compact ? "" : "lg:px-4 lg:py-2"
      } ${onProfile ? "border-ku-gold-500 bg-white/10" : "border-white/40 hover:bg-white/10"}`}
    >
      My Profile
    </Link>
  );

  return (
    <header
      className={
        compact
          ? "fixed inset-x-0 top-0 z-40 origin-top bg-ku-maroon-700 text-white shadow-lg motion-safe:animate-header-in"
          : "relative z-30 bg-ku-maroon-700 text-white"
      }
    >
      <div
        className={`flex w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-10 ${
          compact ? "py-2" : "py-3 lg:py-4"
        }`}
      >
        <Link to={home} className="flex min-w-0 items-center gap-3" onClick={() => setMenuOpen(false)}>
          <img
            src={branding.logo.src}
            alt={branding.logo.alt}
            className={`shrink-0 rounded-full bg-white object-contain p-1 ${compact ? "size-9" : "size-10 lg:size-14 lg:p-1.5"}`}
          />
          <div className="min-w-0 leading-tight">
            <p className={`truncate font-serif font-semibold ${compact ? "text-base" : "text-base sm:text-lg lg:text-2xl"}`}>
              {branding.instituteShort} · <span className={compact ? "" : "sm:hidden"}>Attendance</span>
              {!compact && <span className="hidden sm:inline">{branding.appName}</span>}
            </p>
            {!compact && (
              <p className="hidden truncate text-xs text-ku-maroon-100 sm:block lg:mt-0.5 lg:text-sm">
                {branding.universityName} · {branding.departmentName}
              </p>
            )}
          </div>
        </Link>

        {/* Compact bar: links sit in the same row as the brand. */}
        {compact && (
          <nav aria-label="Main (compact)" className="hidden min-w-0 flex-1 justify-center md:flex">
            {navLinks}
          </nav>
        )}

        <div className="hidden shrink-0 items-center gap-4 md:flex lg:gap-5">
          {!compact && (
            <div className="text-right leading-tight">
              <p className="text-sm font-medium lg:text-base">{me.profile.name}</p>
              <p className="text-xs text-ku-maroon-100 lg:text-sm">{roleLabel}</p>
            </div>
          )}
          {profileButton}
        </div>

        <button
          className="rounded-lg p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ku-gold-400 md:hidden"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {/* Full header: links on their own row. */}
      {!compact && (
        <nav aria-label="Main" className="hidden border-t border-white/10 md:block">
          {navLinks}
        </nav>
      )}

      {/* Mobile navigation */}
      {menuOpen && (
        <nav id={menuId} aria-label="Main" className="border-t border-white/10 md:hidden">
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
            <Link
              to={profilePath}
              onClick={() => setMenuOpen(false)}
              aria-current={onProfile ? "page" : undefined}
              className={`block w-full rounded-lg border px-3 py-2 text-center text-sm ${
                onProfile ? "border-ku-gold-500 bg-white/10" : "border-white/40 hover:bg-white/10"
              }`}
            >
              My Profile
            </Link>
          </div>
        </nav>
      )}
      <div className={`bg-ku-gold-500 ${compact ? "h-0.5" : "h-1"}`} aria-hidden />
    </header>
  );
}
