export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface JournalEntry {
  id: string;
  thought: string;
  emotions: string[];
  response: string;
  messages: ConversationMessage[];
  turnCount: number;
  status: "active" | "completed";
  createdAt: string;
}

const ENTRIES_KEY = "sakeena_entries";
// v3 Welcome flag. A new key so existing users see the v3 Welcome once; the
// older "sakeena_onboarding_done" key is left untouched.
const WELCOME_KEY = "sajaa_onboarding_v3";

export function getEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEntry(entry: JournalEntry) {
  const entries = getEntries();
  entries.unshift(entry);
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export function isWelcomeSeen(): boolean {
  try {
    return localStorage.getItem(WELCOME_KEY) === "true";
  } catch {
    return false;
  }
}

export function markWelcomeSeen() {
  try {
    localStorage.setItem(WELCOME_KEY, "true");
  } catch {
    // Storage unavailable (e.g. private mode); the Welcome may show again next visit.
  }
}
