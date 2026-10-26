import { useState } from "react";
import { signIn } from "@/lib/auth";
import { AUTH_HEADING, AUTH_SUBLINE, AuthField, ResendConfirmation, TextLink } from "@/components/auth/AuthParts";
import { PRIMARY, SECONDARY } from "@/components/reflection/styles";

interface Props {
  onSignInSuccess: () => void;
  onSignUp: () => void;
  onForgotPassword: () => void;
}

// Supabase answers a wrong email or a wrong password with the same error; say so without naming either.
const INVALID_CREDENTIALS = "That email and password don't match. Please try again.";

export default function SignInScreen({ onSignInSuccess, onSignUp, onForgotPassword }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  // Set when the account exists but its email isn't confirmed yet: offer the link again instead of an error.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Email is required";
    if (!password) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || loading) return;
    setLoading(true);
    setErrors({});
    setUnconfirmedEmail(null);

    const { error } = await signIn(email.trim(), password);
    if (error && (error.code === "email_not_confirmed" || error.message === "Email not confirmed")) {
      setUnconfirmedEmail(email.trim());
      setLoading(false);
      return;
    }
    if (error) {
      setErrors({ general: error.message === "Invalid login credentials" ? INVALID_CREDENTIALS : error.message });
      setLoading(false);
      return;
    }

    setLoading(false);
    onSignInSuccess();
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      className="animate-fade-in pt-6"
    >
      <h2 className={AUTH_HEADING}>Welcome back.</h2>
      <p className={AUTH_SUBLINE}>Sign in to your Sajaa account.</p>

      <AuthField
        className="mt-[30px]"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <AuthField
        className="mt-[22px]"
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password ?? errors.general}
      />

      {unconfirmedEmail && (
        <div className="mt-[22px] rounded-[16px] border border-hairline bg-white px-4 py-[14px]">
          <p role="alert" className="text-[15px] leading-[1.5] text-clay-deep">
            Please confirm your email first. We can send the link again.
          </p>
          <ResendConfirmation email={unconfirmedEmail} className="mt-3" />
        </div>
      )}

      <button type="submit" disabled={loading} className={`mt-[26px] ${PRIMARY}`}>
        {loading ? "Signing in..." : "Sign in"}
      </button>
      <TextLink onClick={onForgotPassword} className="mt-[18px]">
        Forgot your password?
      </TextLink>

      <hr className="mt-[34px] border-0 border-t border-hairline" />
      <button type="button" onClick={onSignUp} className={`mt-[26px] ${SECONDARY}`}>
        Create an account
      </button>
    </form>
  );
}
