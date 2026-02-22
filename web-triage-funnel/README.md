# CheckPet MVP (Web Triage Funnel)

An AI-powered veterinary triage application designed to provide instant, professional-grade symptom analysis for pet owners. This MVP focuses on speed, accessibility (no login required), and accuracy.

## 🚀 Key Features

- **Instant Triage**: Immediate symptom analysis without user registration ("100% Free. Completely Anonymous. No Signup.").
- **AI-Powered Assessment**: Dynamic analysis of symptoms using advanced LLMs (via Supabase Edge Functions).
- **Visual Analysis**: Supports photo uploads to analyze visible injuries or conditions using Computer Vision.
- **Dynamic Verification**: The AI asks relevant follow-up questions to refine its assessment.
- **Urgency Classification**: Categorizes conditions into Critical, Urgent, Consult, Watch, or Normal.
- **Local History**: Saves triage results locally on the device for easy access without an account.
- **Lead Generation**: Optional waitlist/email report feature integrated with Supabase.
- **pSEO Architecture**: Programmatic SEO pages generated for common symptoms to drive organic traffic.

## 📱 User Flow & UX

This section details the application flow to provide context for AI agents and developers.

### 1. Land & Intake (The "Input" Screen)
- **Goal**: Minimize friction, gather essential data immediately.
- **Key Elements**:
  - **Header**: "CheckPet" branding + History toggles.
  - **Hero**: "Check Your Pet's Symptoms Instantly", "100% Free. Completely Anonymous. No Signup."
  - **Symptom Input**: Large, focus-centric textarea with "Quick Chips" (Vomiting, Limping, etc.) for rapid entry.
  - **Photo Upload**: Prominent camera icon/dropzone ("Add Photo (Recommended)"). Analyzed via Vision API to detect visible issues (swelling, cuts, posture).
  - **Pet Details**: Toggle-based selection for Speed (Dog/Cat, Male/Female, Fixed/Intact, Age, Weight).
- **Auto-Fill**: Supports URL parameters (`?species=dog&symptom=...`) for pSEO landing page continuity.

### 2. Analysis & Triage (The "Processing" State)
- **Visuals**: Gamified loading overlay with stages ("Scanning...", "Analyzing...", "Consulting Vet Protocols...").
- **Backend Logic**:
  - Calls `analyze-symptom` Edge Function.
  - Vision API processes image (if provided).
  - LLM generates initial differential diagnosis.
  - Determines if "Red Flag" verification questions are needed.

### 3. Verification (The "Investigation" Screen - Conditional)
- **Trigger**: Activated if the AI detects ambiguity or potential high-risk conditions requiring confirmation (e.g., "Is the gum color pale?", "Is the abdomen distended?").
- **UX**: Single-card question flow to reduce cognitive load.
- **Interactions**: Large "YES", "NO", "UNSURE" buttons.
- **Progress**: Linear progress bar indicating steps remaining.

### 4. Results & Action (The "Result" Screen)
- **Urgency Badge**: Top-level status (CRITICAL, URGENT, CONSULT, WATCH, NORMAL) with semantic color-coding.
- **Primary Condition**: Clear, bold diagnosis (e.g., "Gastroenteritis", "Potential Fracture").
- **Confidence Score**: Percentage match based on symptoms.
- **Visual Annotations**: If photo provided, bounding boxes (overlay) highlight areas of concern (e.g., "Swelling", "Laceration").
- **Safety Warnings**: "Red Flag" alerts if dangerous secondary conditions are possible.
- **Action Plan**:
  - **Immediate Steps**: Bulleted "First Aid" or "Next Steps".
  - **Veterinary Advice**: "Reasoning" block explaining *why* the AI concluded this.
- **Engagement**:
  - **Save to History**: LocalStorage persistence (PostHog tracked).
  - **Email Vet**: Generates a professional summary text for clipboard/sharing.
  - **Start Over**: Returns to Intake.

### 5. Local History
- **Access**: Clock icon in header.
- **Data**: Stored in `localStorage`.
- **Privacy**: No cloud sync for MVP (Anonymous/Private).

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Backend/DB**: [Supabase](https://supabase.com/) (Auth, Database, Storage, Edge Functions)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Analytics**: [PostHog](https://posthog.com/)
- **AI Integration**: Custom Supabase Edge Functions (likely wrapping OpenAI/Gemini/Claude).

## 📂 Project Structure

```
web-triage-funnel/
├── src/
│   ├── app/
│   │   ├── page.tsx       # Main Triage Application (Single Page Flow)
│   │   ├── check/         # pSEO Landing Pages
│   │   ├── api/           # Internal API Routes (if any)
│   │   └── ...
│   ├── lib/
│   │   ├── api-client.ts  # Client-side API wrapper for Supabase Functions
│   │   └── breeds.ts      # Dog/Cat breed data
│   └── components/
│       └── ui/            # Reusable UI components
├── public/                # Static assets
└── scripts/
    └── generate_pseo_graph.ts # Script to generate programmatic SEO content
```

## ⚡ Getting Started

### Prerequisites

- Node.js (v20+ recommended)
- npm or yarn

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd checkpet_mvp_production/web-triage-funnel
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up Environment Variables**:
   Create a `.env.local` file in the root of `web-triage-funnel` and add:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
   NEXT_PUBLIC_POSTHOG_HOST=your_posthog_host
   ```

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) (or port 3001 if 3000 is taken) to view the app.

## 🧪 Validating Changes

To verify changes locally:
1. Run `npm run dev`.
2. Check the console for any linting errors.
3. Test the main flow: Input symptoms -> (Optional) Upload Photo -> Answer Questions -> View Result.

## 📦 Deployment

The project is optimized for deployment on [Vercel](https://vercel.com/).
Connect your GitHub repository to Vercel and it will automatically detect the Next.js configuration. Ensure Environment Variables are set in the Vercel Project Settings.
