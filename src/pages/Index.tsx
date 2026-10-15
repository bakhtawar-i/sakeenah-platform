import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isOnboardingDone, type JournalEntry } from "@/lib/storage";
import Onboarding from "@/components/Onboarding";
import HomeScreen from "@/components/HomeScreen";
import ResponseScreen from "@/components/ResponseScreen";
import JournalScreen from "@/components/JournalScreen";
import SignUpPrompt from "@/components/SignUpPrompt";
import SignInScreen from "@/components/SignInScreen";
import EmailConfirmationScreen from "@/components/EmailConfirmationScreen";
import PasswordResetScreen from "@/components/PasswordResetScreen";
import type { User } from "@supabase/supabase-js";

type Screen = "home" | "response" | "journal" | "signup" | "signin" | "confirm-email" | "reset-password";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [lastEntry, setLastEntry] = useState<JournalEntry | null>(null);
  const [signUpEmail, setSignUpEmail] = useState("");

  useEffect(() => {
    let resolved = false;

    const resolve = async (currentUser: User | null) => {
      if (resolved) return;
      resolved = true;

      if (currentUser) {
        await migrateAnonymousData(currentUser.id);
      }

      setUser(currentUser);
      if (currentUser) {
        setShowOnboarding(false);
        setScreen("home");
      } else {
        setShowOnboarding(!isOnboardingDone());
      }
      setAuthLoading(false);
    };

    // Timeout fallback: default to unauthenticated after 2 seconds
    const timer = setTimeout(() => void resolve(null), 2000);

    // Check existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timer);
      void resolve(session?.user ?? null);
    });

    // Listen for future auth changes (sign in, sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;

      if (event === "INITIAL_SESSION") {
        // Already handled by getSession above; skip to avoid double-processing
        return;
      }

      if (event === "SIGNED_IN" && currentUser) {
        setAuthLoading(true);
        setTimeout(() => {
          void migrateAnonymousData(currentUser.id).finally(() => {
            setUser(currentUser);
            setShowOnboarding(false);
            setScreen("home");
            setAuthLoading(false);
          });
        }, 0);
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setScreen("home");
      }
    });

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const migrateAnonymousData = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke("claim-anonymous-session");
      if (error) throw error;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", userId);
      if (profileError) throw profileError;

      // Clear localStorage entries after migration
      localStorage.removeItem("sakeena_entries");
    } catch (e) {
      console.error("Migration error:", e);
    }
  };

  const handleResponse = (entry: JournalEntry) => {
    setLastEntry(entry);
    setScreen("response");
  };

  const handleEntryUpdate = (updatedEntry: JournalEntry) => {
    setLastEntry(updatedEntry);
  };

  const handleSignUpSuccess = (email: string) => {
    setSignUpEmail(email);
    setScreen("confirm-email");
  };

  const handleSignInSuccess = () => {
    setAuthLoading(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1A0F0A' }}>
        <h1 className="font-display" style={{ fontSize: '36px', fontStyle: 'italic', fontWeight: 300, color: 'rgba(255, 248, 242, 0.9)' }}>
          Sajaa
        </h1>
      </div>
    );
  }

  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }

  if (screen === "signup") {
    return <SignUpPrompt onSignUpSuccess={handleSignUpSuccess} onSignIn={() => setScreen("signin")} />;
  }
  if (screen === "signin") {
    return (
      <SignInScreen
        onSignInSuccess={handleSignInSuccess}
        onSignUp={() => setScreen("signup")}
        onForgotPassword={() => setScreen("reset-password")}
      />
    );
  }
  if (screen === "confirm-email") {
    return <EmailConfirmationScreen email={signUpEmail} onBackToSignUp={() => setScreen("signup")} />;
  }
  if (screen === "reset-password") {
    return <PasswordResetScreen onBackToSignIn={() => setScreen("signin")} />;
  }

  return (
    <div className="min-h-screen" style={{ background: '#FDF6F0' }}>
      <header className="sticky top-0 z-10 backdrop-blur-sm" style={{ background: '#FDF6F0', borderBottom: '1px solid #F0E0D4' }}>
        <div className="max-w-[420px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display leading-none" style={{ fontSize: '23px', fontStyle: 'italic', color: '#2C1810' }}>Sajaa</h1>
              <p className="mt-0.5 font-body" style={{ fontSize: '10.5px', color: 'rgba(44, 24, 16, 0.45)' }}>A quiet space for your thoughts.</p>
            </div>
            <nav className="flex gap-4 text-xs font-medium items-center">
              <button
                onClick={() => setScreen("home")}
                className="transition-colors font-body"
                style={{ color: screen === "home" ? '#2C1810' : 'rgba(44, 24, 16, 0.45)' }}
              >
                Home
              </button>
              <button
                onClick={() => setScreen("journal")}
                className="transition-colors font-body"
                style={{ color: screen === "journal" ? '#2C1810' : 'rgba(44, 24, 16, 0.45)' }}
              >
                Journal
              </button>
              {user ? (
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setUser(null);
                    setScreen("home");
                  }}
                  className="transition-colors font-body"
                  style={{ color: 'rgba(44, 24, 16, 0.45)', fontSize: '11px' }}
                >
                  Sign out
                </button>
              ) : (
                <button
                  onClick={() => setScreen("signin")}
                  className="transition-colors font-body"
                  style={{ color: 'rgba(44, 24, 16, 0.45)', fontSize: '11px' }}
                >
                  Sign in
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-[420px] mx-auto px-6 pt-9 pb-7">
        {screen === "home" && <HomeScreen onResponse={handleResponse} />}
        {screen === "response" && lastEntry && (
          <ResponseScreen
            entry={lastEntry}
            isAuthenticated={Boolean(user)}
            onSaveReflection={() => setScreen("signup")}
            onViewJournal={() => setScreen("journal")}
            onEntryUpdate={handleEntryUpdate}
          />
        )}
        {screen === "journal" && <JournalScreen onNavigateHome={() => setScreen("home")} />}
      </main>
    </div>
  );
};

export default Index;
