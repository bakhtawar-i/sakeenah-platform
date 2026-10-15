import { useState, useEffect } from "react";
import ScreenFrame from "@/components/layout/ScreenFrame";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

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

  if (!isRecovery) {
    return (
      <ScreenFrame contentClassName="items-center justify-center px-8">
        <p className="font-body" style={{ color: 'hsl(var(--clay))', fontSize: '14px' }}>
          Invalid or expired reset link.
        </p>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame contentClassName="items-center justify-center px-8 py-10">

      <div className="max-w-sm w-full relative z-10 animate-fade-in">
        <h2
          className="font-display text-center"
          style={{ fontSize: '28px', fontWeight: 600, color: 'hsl(var(--maroon))', marginBottom: '16px' }}
        >
          Set new password
        </h2>

        {success ? (
          <p className="font-body text-center" style={{ fontSize: '14px', color: 'hsl(var(--clay))', lineHeight: '1.8' }}>
            Password updated. Redirecting...
          </p>
        ) : (
          <>
            <p
              className="font-body text-center"
              style={{ fontSize: '14px', color: 'hsl(var(--clay))', lineHeight: '1.8', marginBottom: '32px' }}
            >
              Enter your new password below.
            </p>

            {error && (
              <p className="font-body text-center" style={{ fontSize: '12px', color: 'hsl(var(--maroon))', marginBottom: '16px' }}>
                {error}
              </p>
            )}

            <div style={{ marginBottom: '16px' }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (min. 8 characters)"
                className="w-full font-body"
                style={{
                  background: '#FFFFFF',
                  border: '0.5px solid hsl(var(--hairline))',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  fontSize: '14px',
                  color: 'hsl(var(--ink))',
                  outline: 'none',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'hsl(var(--maroon))')}
                onBlur={(e) => (e.target.style.borderColor = 'hsl(var(--hairline))')}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full font-body"
                style={{
                  background: '#FFFFFF',
                  border: '0.5px solid hsl(var(--hairline))',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  fontSize: '14px',
                  color: 'hsl(var(--ink))',
                  outline: 'none',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'hsl(var(--maroon))')}
                onBlur={(e) => (e.target.style.borderColor = 'hsl(var(--hairline))')}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!password || loading}
              className="w-full font-body font-medium"
              style={{
                background: !password || loading ? 'hsl(var(--maroon) / 0.4)' : 'hsl(var(--maroon))',
                color: 'hsl(var(--cream))',
                borderRadius: '100px',
                padding: '14px',
                fontSize: '14px',
                border: 'none',
                cursor: !password || loading ? 'default' : 'pointer',
              }}
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </>
        )}
      </div>
    </ScreenFrame>
  );
}
