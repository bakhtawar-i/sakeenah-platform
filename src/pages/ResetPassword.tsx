import { useState, useEffect } from "react";
import ScreenFrame from "@/components/layout/ScreenFrame";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AUTH_HEADING, AUTH_SUBLINE, AuthField } from "@/components/auth/AuthParts";
import { PRIMARY } from "@/components/reflection/styles";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (!password || loading) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => navigate("/"), 2000);
  };

  // This route sits outside the app's header, so the column starts with the same 96px of space above the heading.
  return (
    <ScreenFrame art="home" contentClassName="px-5 pt-[96px]">
      {!isRecovery ? (
        <p className="text-[15px] leading-[1.5] text-clay-deep">Invalid or expired reset link.</p>
      ) : (
        <div className="animate-fade-in">
          <h1 className={AUTH_HEADING}>Set new password</h1>

          {success ? (
            <p role="status" className={AUTH_SUBLINE}>
              Password updated. Redirecting...
            </p>
          ) : (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
            >
              <p className={AUTH_SUBLINE}>Enter your new password below.</p>
              <AuthField
                className="mt-[30px]"
                label="New password"
                type="password"
                autoComplete="new-password"
                hint="At least 8 characters."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <AuthField
                className="mt-[22px]"
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={error || undefined}
              />
              <button type="submit" disabled={!password || loading} className={`mt-[26px] ${PRIMARY}`}>
                {loading ? "Updating..." : "Update password"}
              </button>
            </form>
          )}
        </div>
      )}
    </ScreenFrame>
  );
}
