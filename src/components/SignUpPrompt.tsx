import { useState } from "react";
import ScreenFrame from "@/components/layout/ScreenFrame";
import { signUp } from "@/lib/auth";

interface Props {
  onSignUpSuccess: (email: string) => void;
  onSignIn: () => void;
}

export default function SignUpPrompt({ onSignUpSuccess, onSignIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Please enter a valid email";
    if (!password) e.password = "Password is required";
    else if (password.length < 8) e.password = "Password must be at least 8 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || loading) return;
    setLoading(true);
    setErrors({});

    const { error } = await signUp(email.trim(), password);
    if (error) {
      setErrors({ general: error.message });
      setLoading(false);
      return;
    }

    setLoading(false);
    onSignUpSuccess(email.trim());
  };

  return (
    <ScreenFrame contentClassName="items-center justify-center px-8 py-10">

      <div className="max-w-sm w-full relative z-10 animate-fade-in">
        <h2
          className="font-display text-center"
          style={{ fontSize: '28px', fontWeight: 600, color: 'hsl(var(--maroon))', marginBottom: '12px' }}
        >
          Save your reflections
        </h2>
        <p
          className="font-body text-center"
          style={{ fontSize: '14px', color: 'hsl(var(--clay))', marginBottom: '32px', lineHeight: '1.8' }}
        >
          Create an account to keep your journal entries safe and access them anytime.
        </p>

        {errors.general && (
          <p className="font-body text-center" style={{ fontSize: '12px', color: 'hsl(var(--maroon))', marginBottom: '16px' }}>
            {errors.general}
          </p>
        )}

        <div style={{ marginBottom: '16px' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full font-body"
            style={{
              background: '#FFFFFF',
              border: `0.5px solid ${errors.email ? 'hsl(var(--maroon))' : 'hsl(var(--hairline))'}`,
              borderRadius: '12px',
              padding: '14px 16px',
              fontSize: '14px',
              color: 'hsl(var(--ink))',
              outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'hsl(var(--maroon))')}
            onBlur={(e) => { if (!errors.email) e.target.style.borderColor = 'hsl(var(--hairline))'; }}
          />
          {errors.email && (
            <p className="font-body" style={{ fontSize: '12px', color: 'hsl(var(--maroon))', marginTop: '6px' }}>{errors.email}</p>
          )}
        </div>

        <div style={{ marginBottom: '24px' }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min. 8 characters)"
            className="w-full font-body"
            style={{
              background: '#FFFFFF',
              border: `0.5px solid ${errors.password ? 'hsl(var(--maroon))' : 'hsl(var(--hairline))'}`,
              borderRadius: '12px',
              padding: '14px 16px',
              fontSize: '14px',
              color: 'hsl(var(--ink))',
              outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'hsl(var(--maroon))')}
            onBlur={(e) => { if (!errors.password) e.target.style.borderColor = 'hsl(var(--hairline))'; }}
          />
          {errors.password && (
            <p className="font-body" style={{ fontSize: '12px', color: 'hsl(var(--maroon))', marginTop: '6px' }}>{errors.password}</p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full font-body font-medium"
          style={{
            background: loading ? 'hsl(var(--maroon) / 0.4)' : 'hsl(var(--maroon))',
            color: 'hsl(var(--cream))',
            borderRadius: '100px',
            padding: '14px',
            fontSize: '14px',
            border: 'none',
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? "Creating account..." : "Create account"}
        </button>

        <p className="text-center" style={{ marginTop: '20px' }}>
          <button
            onClick={onSignIn}
            className="font-body"
            style={{ fontSize: '13px', color: 'hsl(var(--clay))', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Already have an account? <span style={{ color: 'hsl(var(--ink))' }}>Sign in</span>
          </button>
        </p>
      </div>
    </ScreenFrame>
  );
}
