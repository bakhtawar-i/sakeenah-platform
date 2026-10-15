# Sajaa (سجى)  

**AI-Assisted Reflection Platform**  
Designed for intentional journaling, not engagement optimization  

🌐 Live: https://sajaa-app.vercel.app/  
👥 20+ active users  

---

## 🧠 Overview  

Sajaa is a conversational AI system designed to support structured self-reflection.  

Unlike traditional AI assistants that optimize for longer interactions, Sajaa is intentionally constrained—encouraging users to pause, reflect, and disengage after meaningful interaction.  

The system combines **LLM orchestration, contextual memory, and behavioral constraints** to guide journaling in a focused and emotionally aware manner.

A key aspect of the system is its inspiration from **Tawakkul (trust and reliance)** and reflective themes derived from the **Names of Allah**, which inform the tone, structure, and intent of responses. This allows the system to provide **grounded, calming, and values-driven reflections** rather than generic AI-generated text.

---

## 🎯 Design Philosophy  

Most AI systems are optimized for:
- longer conversations  
- higher engagement  
- more usage  

Sajaa is built around a different principle:

> **Reflection over engagement.**

Key design decisions:
- One structured reflection per day  
- Limited conversational depth (bounded interaction loops)  
- Context-aware responses instead of open-ended chat  
- Privacy-first data handling  

---

## ⚙️ System Architecture  

Frontend (React / Next.js)

↓

API Layer (FastAPI)

↓

LLM Orchestration Layer

↓

Prompt Pipeline + Constraints

↓

Memory System (Session + Historical)

↓

Database (User + Journal Storage)

---

## 🔑 Core Features  

- 📝 Guided journaling workflow  
- 🤖 Emotion-aware conversational responses  
- 🧠 Context-aware memory across sessions  
- 🔐 Authentication + anonymous → account migration  
- 📚 Persistent journal history  
- ⚠️ Safety-aware response handling for sensitive inputs  
- 🔁 Bounded interaction design (prevents infinite chat loops)  

---

## 🔄 Core System Flows  

### Reflection Flow  
HomeScreen → Reflection Engine → LLM → Memory Update → Database  

### Authentication Flow  
Anonymous Session → Supabase Auth → Session Claim  

### Journal Retrieval  
JournalScreen → Supabase RPC → Historical Entries  

---

## 📸 Product Walkthrough  

### Home & Reflection Input  
![Home](docs/screenshots/home.png)

### AI-Assisted Reflection  
![AI Response](docs/screenshots/ai-response.png)

--- 

## 🧠 Memory System  

Sajaa implements a **multi-level memory design**:

### 1. Session Memory  
- Maintains context within a single journaling session  
- Enables coherent multi-turn interaction  

### 2. Historical Memory  
- Stores past journal entries  
- Provides continuity across sessions  

### 3. Emerging Feature — Reflective Memory (In Progress 🚧)  
- Aggregates journaling patterns over time (e.g., weekly trends)  
- Generates **contextual reflective insights**, such as:  
  > “I noticed you’ve been feeling anxious this week...”  
- Combines pattern recognition with structured response generation  
- Designed to integrate **emotional awareness + faith-based reassurance (Tawakkul-inspired responses)**  

→ This moves the system toward **longitudinal user understanding rather than isolated interactions**  

---

## 🧩 LLM Pipeline  

The system is not a simple chatbot wrapper. It includes:

- Structured prompting layers  
- Context injection (session + history)  
- Response constraints (tone, intent, safety)  
- Controlled generation flow (bounded outputs)  

---

## ⚠️ Safety & Behavioral Constraints  

Sajaa incorporates guardrails for sensitive interactions:

- Emotion-aware response shaping  
- Avoidance of harmful or escalating outputs  
- Encouragement of reflection rather than dependency  
- Controlled conversation limits  

---

## 🏗️ Engineering Challenges  

Key challenges addressed during development:

- Designing **bounded AI conversations** instead of infinite chat  
- Managing **contextual memory while preserving privacy**  
- Preventing **prompt drift across multiple turns**  
- Handling **emotionally sensitive inputs safely**  
- Building **stateful interactions over stateless LLM APIs**  
- Supporting **anonymous → authenticated user transitions**  

---

## 🛠️ Tech Stack  

**ML / AI:**  
LLMs, Prompt Engineering, RAG concepts  

**Backend:**  
FastAPI, Python  

**Frontend:**  
Next.js / React  

**Database & Auth:**  
Supabase, PostgreSQL  

**Infrastructure:**  
Vercel, Cloud APIs  

**Data Handling:**  
Session memory, journal persistence, structured storage  

---

## 🚀 Future Work  

- Semantic retrieval across journal history  
- Long-term memory summarization  
- Personalized reflection generation  
- Mood trend analysis  
- Embedding-based memory retrieval  
- Advanced safety evaluation pipelines  

---

## 🎯 Why This Project  

Sajaa was built to explore a different paradigm for AI systems:  

> Systems that help users **stop**, rather than continue.  

It reflects a shift from:
- engagement-driven AI  
to  
- **intention-driven AI systems**

---

## 👤 Author  

**Bakhtawar Iftikhar**  
Founder & Machine Learning Engineer  

- LinkedIn: https://www.linkedin.com/in/bakhtawar-iftikhar/  
- Portfolio: https://bakhtawar-iftikhar.base44.app/

---
