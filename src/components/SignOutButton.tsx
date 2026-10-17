import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../lib/auth";
import { buttonStyles } from "../lib/styles";
import { Spinner } from "./ui";

/** Ends the session and returns to the login page. Shown on the profile pages. */
export function SignOutButton() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={busy} className={buttonStyles.danger}>
      {busy && <Spinner className="size-4" />}
      Sign out
    </button>
  );
}
