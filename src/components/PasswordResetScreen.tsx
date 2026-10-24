import { useState } from "react";
import { resetPassword } from "@/lib/auth";
import { AUTH_HEADING, AUTH_SUBLINE_NARROW, AuthField, TextLink } from "@/components/auth/AuthParts";
import { PRIMARY } from "@/components/reflection/styles";

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
    <div className="animate-fade-in pt-6">
      <h2 className={AUTH_HEADING}>Reset password</h2>

      {sent ? (
        <>
          <div className="mt-[30px] rounded-[20px] border border-hairline bg-white px-[22px] py-[26px]">
            <p role="status" className="break-words text-[16.5px] leading-[1.6] text-ink">
              If an account exists with <b className="font-semibold">{email}</b>, you'll receive a password reset link shortly.
            </p>
          </div>
          <button type="button" onClick={onBackToSignIn} className={`mt-[22px] ${PRIMARY}`}>
            Back to sign in
          </button>
        </>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <p className={AUTH_SUBLINE_NARROW}>Enter your email and we'll send you a link to reset your password.</p>
          <AuthField
            className="mt-[30px]"
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error || undefined}
          />
          <button type="submit" disabled={!email.trim() || loading} className={`mt-[26px] ${PRIMARY}`}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
          <TextLink onClick={onBackToSignIn} className="mt-[18px]">
            Back to sign in
          </TextLink>
        </form>
      )}
    </div>
  );
}
