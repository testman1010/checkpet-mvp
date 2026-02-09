
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
        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-symptom`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    imageBase64: input.imageBase64 || null,
                    symptom: input.symptom || "",
                    pet: input.pet || {},
                    refinedSymptoms: input.refinedSymptoms || [],
                    initialCauses: input.initialCauses || [],
                    refinementContext: input.refinementContext || []
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.failureReason || `API Error: ${response.status}`);
            }

            const data = await response.json();
            console.log("🔍 Raw API Response from Supabase:", data); // DEBUG LOG

            // Extract the actual assessment object if wrapped
            const assessmentData = data.assessment || data;

            // Check for application-level errors returned with 200 OK
            if (data.error || (assessmentData.assessmentPossible === false)) {
                throw new Error(data.failureReason || data.error || 'Triage analysis failed.');
            }

            // Normalize Response (Handle Snake Case vs Camel Case)
            const normalizedData: Assessment = {
                ...assessmentData,
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

        } catch (error) {
            console.error("Triage Analysis API Error:", error);
            throw error;
        }
    }
};
