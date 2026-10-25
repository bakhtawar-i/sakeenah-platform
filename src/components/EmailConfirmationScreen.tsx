import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AUTH_HEADING, TextLink } from "@/components/auth/AuthParts";
import { SECONDARY } from "@/components/reflection/styles";

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
    <div className="animate-fade-in pt-6">
      <h2 className={AUTH_HEADING}>Check your email.</h2>

      <div className="mt-[30px] rounded-[20px] border border-hairline bg-white px-[22px] py-[26px]">
        <p className="break-words text-[16.5px] leading-[1.6] text-ink">
          We sent a link to <b className="font-semibold">{email}</b>. Open it to finish creating your account, then come back here.
        </p>
        <p className="mt-[14px] text-[14px] leading-[1.5] text-clay-deep">
          Nothing there after a few minutes? Check your spam folder, or send it again.
        </p>
      </div>

      <button
        type="button"
        onClick={handleResend}
        disabled={cooldown || resending}
        className={`mt-[22px] ${SECONDARY} disabled:cursor-not-allowed disabled:opacity-[0.55]`}
      >
        {resending ? "Sending..." : cooldown ? "Email sent — check your inbox" : "Send the email again"}
      </button>
      {/* The button label already shows the sent state; this announces it to screen readers. */}
      <p role="status" className="sr-only">
        {resent ? "Confirmation email resent." : ""}
      </p>

      <TextLink onClick={onBackToSignUp} className="mt-5">
        Use a different email
      </TextLink>
    </div>
  );
}
