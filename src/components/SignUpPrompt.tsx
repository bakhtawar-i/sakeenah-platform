import { useState } from "react";
import { signUp } from "@/lib/auth";
import { AUTH_HEADING, AUTH_SUBLINE, AuthField, TextLink } from "@/components/auth/AuthParts";
import { PRIMARY } from "@/components/reflection/styles";

interface Props {
  onSignUpSuccess: (email: string) => void;
  onSignIn: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

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
    else if (password.length < MIN_PASSWORD_LENGTH) e.password = "Password must be at least 8 characters";
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
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      className="animate-fade-in pt-6"
    >
      <h2 className={AUTH_HEADING}>Create your account.</h2>
      <p className={AUTH_SUBLINE}>Choose an email and a password.</p>

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
      {/* The rule shown is the one validate() enforces. */}
      <AuthField
        className="mt-[22px]"
        label="Password"
        type="password"
        autoComplete="new-password"
        placeholder="Choose a password"
        hint="At least 8 characters."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password ?? errors.general}
      />

      <button type="submit" disabled={loading} className={`mt-[26px] ${PRIMARY}`}>
        {loading ? "Creating account..." : "Create account"}
      </button>
      <TextLink onClick={onSignIn} className="mt-5">
        I already have an account
      </TextLink>
    </form>
  );
}
