# CheckPet MVP - Active Monitoring Architecture

## Overview
The **Active Monitoring** feature enables the CheckPet system to perform automated SMS follow-ups with users after their initial triage. This system is built on a serverless architecture using Supabase Edge Functions, pg_cron, and Twilio.

**Primary Goal:** Re-engage users 2 hours after triage to check on their pet's status (Better/Worse/Same) and provide AI-driven veterinary advice.

---

## 1. Architecture Components

### A. Database (`triage_cases` table)
The core data model storing the triage session state.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary Key (also the Case ID) |
| `client_phone_number` | Text | User's verified phone number for SMS |
| `monitor_opt_in` | Boolean | True if user requested follow-up |
| `follow_up_time` | Timestamptz | Scheduled time for the check-in (Created At + 2 hours) |
| `follow_up_sent` | Boolean | Flag to prevent duplicate messages |
| `monitoring_history` | JSONB | Chat log of the SMS conversation (User/Assistant messages) |
| `ai_analysis` | JSONB | The initial triage result (context for the AI) |

**Policies (RLS):**
- `INSERT`: Allowed for `anon` (public triage)
- `UPDATE`: Allowed for `anon` based on Case ID (for opting in)
- `SELECT`: Allowed for `anon` (restricted practice, acceptable for MVP)

### B. Edge Functions (Deno / TypeScript)
Located in `supabase/functions/`.

1.  **`save-case`**
    -   **Trigger:** Frontend `handleAnalyze` completion.
    -   **Action:** Persists the initial `symptoms` and `ai_analysis` to `triage_cases`.
    -   **Returns:** `case_id`.

2.  **`activate-monitoring`**
    -   **Trigger:** User clicks "Monitor My Pet" on Triage Result page.
    -   **Action:** Updates `triage_cases` with `client_phone_number`, sets `monitor_opt_in = true`, and calculates `follow_up_time`.

3.  **`send-scheduled-sms` (Cron Job)**
    -   **Trigger:** Database Cron (`pg_cron`) runs every 10 minutes.
    -   **Action:**
        -   Queries `triage_cases` for rows where `follow_up_time < NOW()` AND `follow_up_sent = false`.
        -   Iterates through cases and sends SMS via Twilio API.
        -   Updates `follow_up_sent = true` and logs the initial outbound message to `monitoring_history`.

4.  **`handle-sms-reply` (Webhook)**
    -   **Trigger:** Incoming SMS to Twilio Phone Number.
    -   **Action:**
        -   Finds the active case associated with the sender's phone number.
        -   Calls `analyze-symptom` (in Monitoring Mode) to generate a response.
        -   Sends AI reply back via Twilio.
        -   Appends interaction to `monitoring_history`.

5.  **`analyze-symptom` (Updated)**
    -   **Enhanced Logic:** Refactored to support a `monitoring_mode` flag.
    -   **RAG Integration:** Uses `retrieveContext` to fetch veterinary protocol based on the *latest* SMS content + original triage context.
    -   **Model:** Uses `gemini-3-flash-preview` for generation.

### C. Infrastructure
-   **Twilio:** Handles SMS delivery and webhook callbacks.
-   **Supabase Cron:** Schedules the `process-monitoring-queue` job.
-   **Supabase Storage/DB:** PostgreSQL with `pg_net` extension for HTTP calls from SQL.

---

## 2. Operational Workflows

### Flow 1: Opt-In
1.  User completes triage -> `save-case` returns `case_id`.
2.  Frontend displays `<MonitoringCard>`.
3.  User enters phone -> `activate-monitoring` called.
4.  DB row updated: `monitor_opt_in=true`, `follow_up_time=NOW() + 2 hours`.

### Flow 2: Automated Check-In
1.  `pg_cron` wakes up (every 10 min).
2.  Executes `SELECT net.http_post(url='.../send-scheduled-sms')`.
3.  Function finds due cases.
4.  Twilio sends: *"Hi, this is CheckPet. How is [Pet Name] doing?"*
5.  DB updated: `follow_up_sent=true`.

### Flow 3: User Reply (AI Conversation)
1.  User replies: *"He's vomiting again."*
2.  Twilio Webhook -> `handle-sms-reply`.
3.  Function looks up case by phone number.
4.  Retrieves `original_analysis` (from initial triage) + `monitoring_history`.
5.  Generates RAG-grounded response using Gemini.
    -   *Logic:* If "Better" -> Resolve. If "Worse" -> Escalate to Vet.
6.  Reply sent to user.

---

## 3. Configuration & Secrets

Required `.env` or Supabase Secrets:

| Secret | Purpose |
|--------|---------|
| `TWILIO_ACCOUNT_SID` | API Credential |
| `TWILIO_AUTH_TOKEN` | API Credential |
| `TWILIO_PHONE_NUMBER` | Sending Identity |
| `SUPABASE_URL` | Edge Function Connectivity |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypassing RLS for Cron/Webhooks |
| `GEMINI_API_KEY` | AI Generation |

**Cron Schedule (SQL):**
```sql
select cron.schedule(
    'process-monitoring-queue',
    '*/10 * * * *',
    $$
    select net.http_post(
        url:='https://[PROJECT_REF].supabase.co/functions/v1/send-scheduled-sms',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'
    ) as request_id;
    $$
);
```

---

## 4. Troubleshooting for LLMs/Devs

-   **Message Not Sent:** Check `triage_cases.follow_up_sent`. If false and time is past, check Cron logs or manually invoke `send-scheduled-sms`.
-   **Wrong Reply:** Check `monitoring_history` in DB to see the conversation execution context.
-   **Twilio 404:** Ensure `handle-sms-reply` URL is correctly set in Twilio Console > Active Numbers > Messaging > Webhook.

---
*Generated by Agent Antigravity for Context Retention.*
