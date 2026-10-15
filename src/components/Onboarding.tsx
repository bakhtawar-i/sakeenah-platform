import { completeOnboarding } from "@/lib/storage";

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const enterSajaa = () => {
    completeOnboarding();
    onComplete();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-8"
      style={{ background: '#1A0F0A' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 20%, rgba(193,124,116,0.10) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-sm text-center relative z-10 animate-fade-in">
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          className="mx-auto mb-5"
          style={{ opacity: 0.35 }}
        >
          <path
            d="M18 2C9.163 2 2 9.163 2 18s7.163 16 16 16c-5.523 0-10-5.373-10-12S12.477 10 18 10c2.761 0 5.373.895 7.5 2.5A15.93 15.93 0 0018 2z"
            fill="#C17C74"
          />
        </svg>

        <h1
          className="font-display"
          style={{
            fontStyle: 'italic',
            fontWeight: 300,
            fontSize: '46px',
            color: 'rgba(255, 248, 242, 0.9)',
            marginBottom: '20px',
          }}
        >
          Sajaa.
        </h1>

        <p
          className="font-body"
          style={{
            fontStyle: 'italic',
            fontSize: '15px',
            lineHeight: '1.9',
            color: 'rgba(255, 248, 242, 0.50)',
            marginBottom: '18px',
          }}
        >
          A quiet space to put down what your heart is carrying, rooted in trust that Allah is in control.
        </p>

        <p
          className="font-body"
          style={{
            fontSize: '13px',
            lineHeight: '1.8',
            color: 'rgba(255, 248, 242, 0.50)',
            marginBottom: '26px',
          }}
        >
          One intentional reflection each day.<br />
          A moment to pause, reflect, and return tomorrow.
        </p>

        <button
          onClick={enterSajaa}
          className="font-body font-medium"
          style={{
            background: '#FDF6F0',
            color: '#2C1810',
            borderRadius: '100px',
            border: 'none',
            padding: '12px 28px',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Enter Sajaa
        </button>

        <div
          className="font-body"
          style={{
            fontSize: '11px',
            lineHeight: '1.8',
            color: 'rgba(255, 248, 242, 0.38)',
            marginTop: '28px',
          }}
        >
          <p style={{ marginBottom: '10px' }}>
            Your reflections are stored privately and securely. They are used only to generate your responses and are never sold or shared for advertising.
          </p>
          <p>
            Sajaa is a space for reflection, not a replacement for professional support.
          </p>
        </div>
      </div>
    </div>
  );
}
