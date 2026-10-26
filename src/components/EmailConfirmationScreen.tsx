import { AUTH_HEADING, ResendConfirmation, TextLink } from "@/components/auth/AuthParts";

interface Props {
  email: string;
  onBackToSignUp: () => void;
}

export default function EmailConfirmationScreen({ email, onBackToSignUp }: Props) {
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

      <ResendConfirmation email={email} className="mt-[22px]" />

      <TextLink onClick={onBackToSignUp} className="mt-5">
        Use a different email
      </TextLink>
    </div>
  );
}
