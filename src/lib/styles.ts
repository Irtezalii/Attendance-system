// Shared Tailwind class strings for form controls (KU maroon as the action colour).

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ku-maroon-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const buttonStyles = {
  primary: `${base} bg-ku-maroon-700 text-white hover:bg-ku-maroon-800`,
  secondary: `${base} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`,
  danger: `${base} border border-red-300 bg-white text-red-700 hover:bg-red-50`,
};

export const inputStyles =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-ku-maroon-500 focus:outline-none focus:ring-2 focus:ring-ku-maroon-100 disabled:bg-slate-50 disabled:text-slate-500";

export const linkStyles = "font-medium text-ku-maroon-700 hover:text-ku-maroon-900 hover:underline";
