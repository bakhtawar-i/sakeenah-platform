import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isWelcomeSeen, markWelcomeSeen, type JournalEntry } from "@/lib/storage";
import Welcome from "@/components/Welcome";
import ScreenFrame from "@/components/layout/ScreenFrame";
import ArtImage from "@/components/art/ArtImage";
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
  const [welcomeOpen, setWelcomeOpen] = useState(false);
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
        setScreen("home");
      }
      // Show the v3 Welcome automatically once per browser, including to existing users.
      if (!isWelcomeSeen()) {
        markWelcomeSeen();
        setWelcomeOpen(true);
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

  // Reopening the Welcome never resets the flag, entries, session or Home draft.
  const openWelcome = () => setWelcomeOpen(true);
  const closeWelcome = () => {
    markWelcomeSeen();
    setWelcomeOpen(false);
  };

  // Active item: maroon with a coral underline (decorative, not the only cue: aria-current is set too).
  const navLinkClass = (active: boolean) =>
    `font-body border-b-2 pb-[3px] leading-normal transition-colors hover:text-maroon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon ${active ? "border-coral text-maroon" : "border-transparent text-clay-deep"}`;

  // The Response screen continues the Home flow, so Home stays the current nav item (as in the mockups).
  const onHome = screen === "home" || screen === "response";

  if (authLoading) {
    return (
      <ScreenFrame contentClassName="items-center justify-center">
        <h1 className="font-display text-[36px] font-semibold text-maroon">
          Sajaa
        </h1>
      </ScreenFrame>
    );
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
    <>
    {/* While the Welcome is open the page behind it is inert: not focusable or clickable, but still mounted. */}
    <div {...(welcomeOpen ? { inert: "", "aria-hidden": true } : {})}>
    <ScreenFrame art={onHome ? "home" : "corners"}>
      <header className="sticky top-0 z-10 bg-cream/95 backdrop-blur-sm">
        <div className="flex h-[72px] items-center justify-between px-5">
          <h1 className="font-display text-[21px] font-semibold leading-none text-maroon">
            <button
              type="button"
              onClick={openWelcome}
              aria-haspopup="dialog"
              className="flex items-center gap-[10px] rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            >
              {/* 22x28 slot as in the mockup; the logo file has transparent padding, so it is drawn larger and offset to put its ink in the slot. */}
              <span className="relative h-[28px] w-[22px] shrink-0">
                <ArtImage name="logo-mark" width={34} height={45} className="absolute -left-[6px] -top-[8px] h-[45px] w-[34px] max-w-none" />
              </span>
              Sajaa
            </button>
          </h1>
          <nav className="flex items-center gap-[18px] text-[15px] font-medium">
            <button type="button" onClick={() => setScreen("home")} aria-current={onHome ? "page" : undefined} className={navLinkClass(onHome)}>
              Home
            </button>
            <button type="button" onClick={() => setScreen("journal")} aria-current={screen === "journal" ? "page" : undefined} className={navLinkClass(screen === "journal")}>
              Journal
            </button>
            {user ? (
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setUser(null);
                  setScreen("home");
                }}
                className={navLinkClass(false)}
              >
                Sign out
              </button>
            ) : (
              <button type="button" onClick={() => setScreen("signin")} className={navLinkClass(false)}>
                Sign in
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className={`flex-1 px-5 pb-7 ${onHome ? "pt-0" : "pt-9"}`}>
        {screen === "home" && <HomeScreen onResponse={handleResponse} />}
        {screen === "response" && lastEntry && (
          <ResponseScreen
            entry={lastEntry}
            isAuthenticated={Boolean(user)}
            onSaveReflection={() => setScreen("signup")}
            onViewJournal={() => setScreen("journal")}
            onGoHome={() => setScreen("home")}
            onEntryUpdate={handleEntryUpdate}
          />
        )}
        {screen === "journal" && <JournalScreen onNavigateHome={() => setScreen("home")} />}
      </main>

      <footer className="px-5 pb-4 text-center">
        <button
          type="button"
          onClick={openWelcome}
          aria-haspopup="dialog"
          className="rounded-sm text-xs text-clay underline-offset-4 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon"
        >
          About Sajaa
        </button>
      </footer>
    </ScreenFrame>
    </div>
    {welcomeOpen && <Welcome onBegin={closeWelcome} />}
    </>
  );
};

export default Index;
