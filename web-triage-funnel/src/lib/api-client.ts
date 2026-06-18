
// --- Domain Models (Mirrored from iOS App) ---

export interface Pet {
    id: string
    name: string
    species: 'dog' | 'cat'
    sex: 'MALE' | 'FEMALE'
    breed?: string
    age_years?: number
    age_months?: number
    weight_lbs?: number
    neutered?: boolean
    // Minimal fields needed for Panic Triage
    is_profile_verified?: boolean
    weight_description?: string
}

export interface Assessment {
    id?: string
    pet_id?: string
    symptoms?: string[]
    health_concerns?: string
    assessment_type?: string
    urgency_level?: 'CRITICAL' | 'URGENT' | 'CONSULT' | 'WATCH' | 'NORMAL'
    recommendations?: string[]

    // Enhanced Results
    assessmentPossible?: boolean
    primaryRecommendation?: string
    confidenceScore?: number
    failureReason?: string
    keyObservations?: string[]
    causes?: Array<{
        condition: string;
        probability: number;
        urgency: 'CRITICAL' | 'URGENT' | 'CONSULT' | 'WATCH' | 'NORMAL';
        reasoning: string;
        system_category: string;
    }>;
    visualAnnotations?: Array<{
        label: string
        coordinates: [number, number, number, number]
    }>

    refinement_reasoning?: string
    conditional_assessment?: string
    watch_for_symptoms?: string[]
    citations?: string[]
    verification_questions?: Array<{
        id: string;
        text: string;
        riskWeight: number;
    }>
}

// --- API Client ---

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("Missing Supabase Environment Variables");
}

export interface AnalyzeSymptomsInput {
    imageBase64?: string | null;
    symptom?: string;
    pet?: Partial<Pet>; // Use Partial for guest flow
    refinedSymptoms?: string[];
    initialCauses?: any[];
    refinementContext?: { question: string, answer: string }[];
}

export const apiClient = {
    analyzeSymptoms: async (input: AnalyzeSymptomsInput): Promise<Assessment> => {
        // Resilience: abort a stuck request via AbortController, and retry transient network
        // drops ("Failed to fetch" / "Load failed") once. Without this, a single dropped or
        // timed-out connection killed the whole funnel (the analysis_failed P0).
        const ANALYZE_TIMEOUT_MS = 60000;
        const MAX_ATTEMPTS = 2; // initial attempt + 1 retry
        const requestBody = JSON.stringify({
            imageBase64: input.imageBase64 || null,
            symptom: input.symptom || "",
            pet: input.pet || {},
            refinedSymptoms: input.refinedSymptoms || [],
            initialCauses: input.initialCauses || [],
            refinementContext: input.refinementContext || []
        });

        let lastError: unknown;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);
            try {
                const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-symptom`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    },
                    body: requestBody,
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    // Server responded with an error status — a real failure, not retryable.
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || errorData.failureReason || `API Error: ${response.status}`);
                }

                const data = await response.json();

                // Extract the actual assessment object if wrapped
                const assessmentData = data.assessment || data;

                // Application-level error returned with 200 OK — not retryable.
                if (data.error || (assessmentData.assessmentPossible === false)) {
                    throw new Error(data.failureReason || data.error || 'Triage analysis failed.');
                }

                // Normalize Response (Handle Snake Case vs Camel Case)
                const normalizedData: Assessment = {
                    ...assessmentData,
                    // Backend returns camelCase `urgencyLevel`; the frontend + analytics use snake_case
                    // `urgency_level`. Without this mapping it was undefined everywhere — which broke the
                    // result urgency badge, the `isEmergency` detection, AND the `urgency_level` property on
                    // the analysis_completed / paywall_shown / auth_wall_shown analytics events.
                    urgency_level: assessmentData.urgency_level || assessmentData.urgencyLevel,
                    // Ensure visualAnnotations is populated if backend returns snake_case
                    visualAnnotations: assessmentData.visualAnnotations || assessmentData.visual_annotations || [],
                    // Ensure other potential mismatch fields are handled
                    keyObservations: assessmentData.keyObservations || assessmentData.key_observations || [],
                    confidenceScore: assessmentData.confidenceScore || assessmentData.confidence_score,
                    refinement_reasoning: assessmentData.refinement_reasoning || assessmentData.reasoning, // Handle both potential field names
                    citations: assessmentData.citations || [],

                    // Map Backend 'redFlagChecklist' -> Frontend 'verification_questions'
                    verification_questions: assessmentData.verification_questions || assessmentData.redFlagChecklist?.map((q: any) => ({
                        id: String(Math.random()), // Generate ID if missing
                        text: q.question,
                        riskWeight: q.riskIfConfirmed === 'emergency' ? 9 : 5
                    })) || [],

                    // Map Backend 'nextSteps' -> Frontend 'primaryRecommendation'
                    primaryRecommendation: assessmentData.primaryRecommendation || assessmentData.nextSteps || assessmentData.summary,

                    // Ensure recommendations is always an array
                    recommendations: assessmentData.recommendations || []
                };

                return normalizedData;

            } catch (error: any) {
                clearTimeout(timeoutId);
                lastError = error;

                // Retry only transient transport failures:
                //  - AbortError: our timeout fired (request hung too long)
                //  - TypeError: browser network failure ("Failed to fetch" / "Load failed")
                const isTimeout = error?.name === 'AbortError';
                const isNetwork = error instanceof TypeError;

                if ((isTimeout || isNetwork) && attempt < MAX_ATTEMPTS) {
                    console.warn(`Triage analyze attempt ${attempt} failed (${isTimeout ? 'timeout' : 'network'}). Retrying…`);
                    await new Promise((r) => setTimeout(r, 1500 * attempt));
                    continue;
                }

                console.error("Triage Analysis API Error:", error);
                if (isTimeout) {
                    throw new Error('Analysis timed out. Please check your connection and try again.');
                }
                throw error;
            }
        }

        // Unreachable in practice (the loop always returns or throws) — satisfies the type checker.
        throw lastError instanceof Error ? lastError : new Error('Analysis failed.');
    },

    saveCase: async (symptoms: string, ai_analysis: any, options: { deviceId?: string, userId?: string, isLocked?: boolean } = {}): Promise<string> => {
        try {
            const response = await fetch('/api/cases/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    symptoms,
                    ai_analysis,
                    deviceId: options.deviceId,
                    userId: options.userId,
                    isLocked: options.isLocked
                })
            });

            if (!response.ok) throw new Error("Failed to save case");
            const data = await response.json();
            return data.case_id;
        } catch (error) {
            console.error("Save Case Error:", error);
            throw error;
        }
    },

    activateMonitoring: async (case_id: string, phone_number: string): Promise<void> => {
        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/activate-monitoring`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ case_id, phone_number })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to activate monitoring");
            }
        } catch (error) {
            console.error("Activate Monitoring Error:", error);
            throw error;
        }
    }
};
