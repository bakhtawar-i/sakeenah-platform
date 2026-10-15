import { useState } from "react";
import ScreenFrame from "@/components/layout/ScreenFrame";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  email: string;
  onBackToSignUp: () => void;
}

export default function EmailConfirmationScreen({ email, onBackToSignUp }: Props) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const handleResend = async () => {
    if (cooldown || resending) return;
    setResending(true);

    await supabase.auth.resend({ type: "signup", email });

    setResending(false);
    setResent(true);
    setCooldown(true);
    setTimeout(() => setCooldown(false), 60000);
    setTimeout(() => setResent(false), 5000);
  };

  return (
    <ScreenFrame contentClassName="items-center justify-center px-8 py-10">

      <div className="max-w-sm w-full relative z-10 animate-fade-in text-center">
        {/* Mail icon */}
        <div style={{ marginBottom: '24px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(193,124,116,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>

        <h2
          className="font-display"
          style={{ fontSize: '28px', fontWeight: 600, color: 'hsl(var(--maroon))', marginBottom: '16px' }}
        >
          Check your email
        </h2>

        <p
          className="font-body"
          style={{ fontSize: '14px', color: 'hsl(var(--clay))', lineHeight: '1.8', marginBottom: '32px' }}
        >
          We sent a confirmation link to{" "}
          <span style={{ color: 'hsl(var(--ink))' }}>{email}</span>.
          Please verify your email to continue.
        </p>

        <button
          onClick={handleResend}
          disabled={cooldown || resending}
          className="w-full font-body font-medium"
          style={{
            background: cooldown ? 'hsl(var(--maroon) / 0.4)' : 'hsl(var(--maroon))',
            color: 'hsl(var(--cream))',
            borderRadius: '100px',
            padding: '14px',
            fontSize: '14px',
            border: 'none',
            cursor: cooldown ? 'default' : 'pointer',
          }}
        >
          {resending ? "Sending..." : cooldown ? "Email sent — check your inbox" : "Resend email"}
        </button>

        {resent && (
          <p className="font-body" style={{ fontSize: '12px', color: 'hsl(var(--clay))', marginTop: '12px' }}>
            Confirmation email resent.
          </p>
        )}

        <p className="text-center" style={{ marginTop: '20px' }}>
          <button
            onClick={onBackToSignUp}
            className="font-body"
            style={{ fontSize: '13px', color: 'hsl(var(--clay))', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Use a different email
          </button>
        </p>
      </div>
    </ScreenFrame>
  );
}
