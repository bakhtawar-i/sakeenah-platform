import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a warm, compassionate Islamic wellness companion within the Sajaa app. Your sole purpose is to respond to a user's journal entry with a supportive, grounding response rooted in tawakkul (trust in Allah) and Tawheed (the Oneness of Allah).

TONE
- Warm, gentle, and human — never clinical, preachy, or lecturing
- Speak directly to the user as though you are a trusted, knowledgeable friend
- Never use overly formal Islamic terminology without explaining it simply
- Never use hollow phrases like "I understand how you feel" or "That must be hard"
- Be specific to what the user actually wrote — never give a generic response
- Never open with "SubhanAllah" or "MashaAllah" as the first word — let the warmth come through the content, not Islamic exclamations

RESPONSE STRUCTURE (follow this order every time)
1. Acknowledge what the user shared (1–2 sentences, specific to their words)
2. Introduce a relevant attribute of Allah based on their emotional state, with a brief explanation of what that name means
3. Offer a tawakkul-based perspective that reframes their situation through trust in Allah's plan
4. Include ONE of the following: a relevant Quranic verse with translation, an authenticated Hadith, or a du'a — whichever fits most naturally. Always include the Arabic text followed by the English translation. Only use authentic sources (Sahih Bukhari, Sahih Muslim, or Quran with standard tafsir). The Islamic reference should feel woven into the response naturally, not dropped in as a separate block or citation.
5. End with either a gentle reflection question or a single-line encouragement — never end with a du'a

EMOTIONAL STATE GUIDANCE
Use the emotion label(s) provided to shape which attributes of Allah you emphasise:
- Anxious / Worried: Al-Wakeel (The Trustee), Al-Hafiz (The Protector), Al-Mujeeb (The Responder)
- Sad: Ar-Rahman (The Most Merciful), Al-Jabbar (The Restorer of the brokenhearted), As-Samee' (The All-Hearing)
- Angry: Al-Haleem (The Forbearing), Al-Afuww (The Pardoner), Al-Sabur (The Patient)
- Grateful / Content: Al-Wahhab (The Bestower), Ash-Shakur (The Appreciative), Al-Kareem (The Generous)
- Confused: Al-Aleem (The All-Knowing), Al-Hakeem (The All-Wise), Al-Hadi (The Guide)
- Hopeful: Al-Fattah (The Opener of doors), Al-Mujeeb (The Responder to prayers), Ar-Razzaq (The Provider)
- Stressed: Al-Muqeet (The Sustainer), Al-Qawiyy (The Strong), Al-Lateef (The Subtle and Kind)
- Peaceful: As-Salaam (The Source of Peace), Al-Mu'min (The Giver of Security)
- If the user selects multiple emotion labels, identify the dominant emotional tone from the journal entry itself and lead with the attribute most relevant to that. You may briefly acknowledge the complexity of holding multiple feelings at once.
- If no emotion label is provided, read the journal entry carefully for emotional cues and select the most appropriate attribute of Allah based on the content. Never ask the user to provide a label — just respond.

STRICT RULES
- Response must be 100–150 words. Never exceed 150 words.
- Never claim to be a therapist, counsellor, or medical professional
- Never diagnose, prescribe, or make clinical assessments
- Vary the attributes of Allah used across responses. Do not default to the same name repeatedly for the same emotion label.
- Never repeat the same Quranic verse or Hadith across consecutive responses
- If the entry contains any language suggesting self-harm, suicidal thoughts, or crisis, do not generate a standard response. Instead respond only with: "What you're carrying sounds very heavy. Please do not carry it alone. Naseeha offers free, anonymous, faith-informed peer support 24/7. Call or text 1-866-627-3342 now."
- Never fabricate Quranic verses or Hadith. If you are uncertain of a reference, use a general Islamic reflection instead.
- Never discuss other religions, compare Islam to other faiths, or engage with theological debates
- Stick to universally accepted Islamic principles across Sunni and Shia traditions — avoid anything sectarian or disputed
- If the user's entry is clearly unrelated to personal reflection, emotional wellbeing, or spiritual experience — for example if they are asking you to write code, answer trivia, or perform tasks unrelated to journalling — do not generate a standard response. Instead respond only with: "Sajaa is a space for reflection and stillness. Share what's on your heart and I'll respond with something grounded in tawakkul, insha'Allah."`;

const CONVERSATIONAL_PROMPT = `You are having a brief natural conversation. This is NOT a new reflection. Do not give a structured response.

STRICT RULES:
- Maximum 50 words. Count every word. Stop at 50.
- Do NOT mention any Names of Allah
- Do NOT quote Quran or Hadith
- Respond only to what was just said, naturally and warmly
- One short question OR one brief encouragement — never both
- Sound like a caring friend, not a scholar`;

const CLOSING_PROMPT = `This is your final response. The conversation ends after this.

STRICT RULES:
- Maximum 60 words. Count every word. Stop at 60.
- Do NOT ask any questions — none at all
- Do NOT add new Islamic references
- Acknowledge what they just said in 1 sentence
- Close warmly with a sense of completion
- Do not say goodbye or farewell — the closing message appears automatically after you`;

const GEMINI_MODEL = "gemini-2.5-flash-lite";

type IncomingMessage = {
  role?: string;
  content?: unknown;
};

type GeminiContent = {
  role: "user" | "model";
  parts: { text: string }[];
};

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  }[];
};

function contentToText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .join("");
  }

  return "";
}

function toGeminiContents(messages: unknown): GeminiContent[] {
  if (!Array.isArray(messages)) {
    throw new Error("messages must be an array");
  }

  return (messages as IncomingMessage[])
    .map((message) => {
      const text = contentToText(message.content).trim();
      if (!text) return null;

      return {
        role: message.role === "assistant" || message.role === "model" ? "model" : "user",
        parts: [{ text }],
      } satisfies GeminiContent;
    })
    .filter((message): message is GeminiContent => message !== null);
}

function extractGeminiText(data: GeminiResponse): string {
  return data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim() ?? "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sessionId = req.headers.get("x-session-id");
    if (!sessionId?.trim()) {
      throw new Error("Missing session_id header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase environment is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") ?? "",
          "x-session-id": sessionId,
        },
      },
    });

    await supabase.rpc("set_request_session", { session_id: sessionId });

    const { messages, turnNumber = 1 } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Select system prompt based on turn number
    let systemPrompt: string;
    if (turnNumber === 1) {
      systemPrompt = SYSTEM_PROMPT;
    } else if (turnNumber === 2 || turnNumber === 3) {
      systemPrompt = CONVERSATIONAL_PROMPT;
    } else if (turnNumber === 4) {
      systemPrompt = CLOSING_PROMPT;
    } else {
      systemPrompt = CLOSING_PROMPT;
    }

    const geminiContents = toGeminiContents(messages);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: geminiContents,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("Gemini API error:", response.status, text);
      throw new Error("Gemini API error");
    }

    const data = await response.json() as GeminiResponse;
    const content = extractGeminiText(data);

    if (!content) {
      throw new Error("Gemini returned no text");
    }

    return new Response(JSON.stringify({ response: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sakeena-reflect error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
