import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SECONDARY } from "@/components/reflection/styles";

/** Page heading and subline shared by the sign-in screens (sizes from the v3 auth mockups). */
export const AUTH_HEADING = "font-display max-w-[min(230px,calc(100%-117px))] text-[30px] font-semibold leading-[1.2] text-maroon";
export const AUTH_SUBLINE = "mt-3 max-w-[300px] text-[15px] leading-[1.5] text-clay-deep";
/** For a subline long enough to reach the top-right artwork: wraps within the heading's width instead. */
export const AUTH_SUBLINE_NARROW = "mt-3 max-w-[min(300px,calc(100%-117px))] text-[15px] leading-[1.5] text-clay-deep";

/** A centred, underlined text button ("Forgot your password?", "I already have an account"). */
export function TextLink({ onClick, children, className = "" }: { onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mx-auto block rounded-sm text-[15px] font-medium leading-[normal] text-maroon underline underline-offset-[3px] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon focus-visible:ring-offset-2 focus-visible:ring-offset-cream ${className}`}
    >
      {children}
    </button>
  );
}

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id"> {
  label: string;
  /** Shown under the field in the error colour, announced as an alert. */
  error?: string;
  /** Quiet help under the field, such as the password rule. */
  hint?: string;
  className?: string;
}

/**
 * A labelled 56px field (17px text, so iOS does not zoom on focus). type="password"
 * gets a Show / Hide toggle, a real button that reports its state with aria-pressed.
 */
export function AuthField({ label, error, hint, className = "", type = "text", ...input }: FieldProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-[14px] font-medium leading-[normal] text-clay-deep">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          type={isPassword && shown ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`font-body block h-14 w-full rounded-[20px] border-[1.5px] bg-white px-[18px] text-[17px] text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-clay focus:outline-none focus:ring-[3px] focus:ring-maroon/15 ${error ? "border-danger focus:border-danger" : "border-turquoise focus:border-maroon"} ${isPassword ? "pr-[76px]" : ""}`}
          {...input}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown(!shown)}
            aria-pressed={shown}
            aria-controls={id}
            className="absolute right-[11px] top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[14px] font-medium leading-[normal] text-maroon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon"
          >
            {/* The name is the visible word plus "password" (WCAG 2.5.3); aria-pressed carries the state. */}
            {shown ? "Hide" : "Show"}
            <span className="sr-only"> password</span>
          </button>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-2 text-[13px] leading-[normal] text-clay">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-[6px] text-[13.5px] leading-[1.4] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

// How long "Send the email again" stays unavailable after a send.
const RESEND_WAIT_MS = 30_000;

/**
 * "Send the email again" for an account whose email isn't confirmed yet: resends the sign-up link
 * (supabase.auth.resend, as before), then waits about 30 seconds before it can be pressed again.
 */
export function ResendConfirmation({ email, className = "" }: { email: string; className?: string }) {
  const [sending, setSending] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [result, setResult] = useState<"sent" | "failed" | null>(null);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const resend = async () => {
    if (sending || waiting) return;
    setSending(true);
    setResult(null);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setSending(false);
    setResult(error ? "failed" : "sent");
    if (!error) {
      setWaiting(true);
      timer.current = window.setTimeout(() => setWaiting(false), RESEND_WAIT_MS);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={resend}
        disabled={sending || waiting}
        className={`${SECONDARY} disabled:cursor-not-allowed disabled:opacity-[0.55]`}
      >
        {sending ? "Sending..." : "Send the email again"}
      </button>
      <p role="status" className={`text-center text-[14px] leading-[1.5] text-clay-deep ${result ? "mt-3" : ""}`}>
        {result === "sent" ? "Sent again." : result === "failed" ? "That didn't send. Please try again in a moment." : ""}
      </p>
    </div>
  );
}
