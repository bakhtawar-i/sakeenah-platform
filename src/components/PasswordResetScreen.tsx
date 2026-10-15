import { useState } from "react";
import ScreenFrame from "@/components/layout/ScreenFrame";
import { resetPassword } from "@/lib/auth";

interface Props {
  onBackToSignIn: () => void;
}

export default function PasswordResetScreen({ onBackToSignIn }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email.trim() || loading) return;
    setLoading(true);
    setError("");

    const { error: resetError } = await resetPassword(email.trim());
    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  return (
    <ScreenFrame contentClassName="items-center justify-center px-8 py-10">

      <div className="max-w-sm w-full relative z-10 animate-fade-in">
        <h2
          className="font-display text-center"
          style={{ fontSize: '28px', fontWeight: 600, color: 'hsl(var(--maroon))', marginBottom: '16px' }}
        >
          Reset password
        </h2>

        {sent ? (
          <div className="text-center">
            <p
              className="font-body"
              style={{ fontSize: '14px', color: 'hsl(var(--clay))', lineHeight: '1.8', marginBottom: '32px' }}
            >
              If an account exists with{" "}
              <span style={{ color: 'hsl(var(--ink))' }}>{email}</span>,
              you'll receive a password reset link shortly.
            </p>
            <button
              onClick={onBackToSignIn}
              className="w-full font-body font-medium"
              style={{
                background: 'hsl(var(--maroon))',
                color: 'hsl(var(--cream))',
                borderRadius: '100px',
                padding: '14px',
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <p
              className="font-body text-center"
              style={{ fontSize: '14px', color: 'hsl(var(--clay))', lineHeight: '1.8', marginBottom: '32px' }}
            >
              Enter your email and we'll send you a link to reset your password.
            </p>

            {error && (
              <p className="font-body text-center" style={{ fontSize: '12px', color: 'hsl(var(--maroon))', marginBottom: '16px' }}>
                {error}
              </p>
            )}

            <div style={{ marginBottom: '24px' }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
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
              disabled={!email.trim() || loading}
              className="w-full font-body font-medium"
              style={{
                background: !email.trim() || loading ? 'hsl(var(--maroon) / 0.4)' : 'hsl(var(--maroon))',
                color: 'hsl(var(--cream))',
                borderRadius: '100px',
                padding: '14px',
                fontSize: '14px',
                border: 'none',
                cursor: !email.trim() || loading ? 'default' : 'pointer',
              }}
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </>
        )}

        <p className="text-center" style={{ marginTop: '20px' }}>
          <button
            onClick={onBackToSignIn}
            className="font-body"
            style={{ fontSize: '13px', color: 'hsl(var(--clay))', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Back to sign in
          </button>
        </p>
      </div>
    </ScreenFrame>
  );
}
