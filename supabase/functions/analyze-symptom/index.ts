
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.16.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Type Definitions ---
interface Pet {
    name: string;
    species: string;
    breed?: string;
    age_years?: number;
    age_months?: number;
    weight_lbs?: number;
    activity_level?: string;
    personality_type?: string;
    training_level?: string;
    living_situation?: string;
    medical_history?: string;
    special_dietary_needs?: string;
    behavioral_notes?: string;
    completion_percentage?: number;
    weight_description?: string;
}

interface BreedData {
    name: string;
    category: string;
    care_highlights: string[];
    common_health_issues: string[];
    task_data?: {
        daily_tasks: {
            exercise_intensity: string;
            grooming_frequency: string;
            mental_stimulation_needs: string;
            special_care_tasks: string[];
        };
        engagement_boosters?: {
            achievement_tasks: string[];
        };
        weather_adaptations?: {
            hot_weather_modifications: string[];
            cold_weather_modifications: string[];
            rainy_day_alternatives: string[];
        };
    };
}

// --- RAG Helper Function ---
async function retrieveVeterinaryContext(
    queryText: string,
    species: string,
    genAI: GoogleGenerativeAI,
    supabase: any,
    isRefinementMode: boolean = false
): Promise<string> {
    if (!queryText || queryText.trim().length === 0) return "";

    try {
        // Step 1: Query Generation (Extract Filters & Key Concepts)
        const fastModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" }); // Updated to valid model name

        const focusInstruction = isRefinementMode
            ? "Focus strictly on medical conditions associated with these confirmed tags."
            : "Prioritize broad categorization.";

        const queryPrompt = `
        You are a search optimization agent for a veterinary database.
        Analyze the user's description and "translate" it into strict search parameters.
        ${focusInstruction}

        SEARCH TARGET: "${queryText}"
        PET SPECIES: "${species}"

        RULES:
        1. "clinical_category": Return up to 3 most relevant categories(e.g., "Dermatology", "Emergency", "Toxicology", "Gastroenterology", "General Principles").
           - If description implies trauma, wounds, or severe pain, YOU MUST include "Emergency" and "General Principles".
        2. "species":
           - If input is "Dog", return ["Dog", "General", "Unknown"].
           - If input is "Cat", return ["Cat", "General", "Unknown"].
           - Otherwise, return [${species}, "General", "Unknown"].
        3. "search_query": A short, keyword - dense query optimized for vector similarity(removing filler words).
        
        Return ONLY JSON:
        {
            "clinical_category": ["string", "string"],
            "species": ["string", "string"],
            "search_query": "string"
        }
        `;

        const queryResult = await fastModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: queryPrompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });

        const queryParams = JSON.parse(queryResult.response.text());
        console.log("Generated Search Params:", queryParams);

        // Step 2: Fallback Search Logic
        const performSearch = async (useFilters: boolean) => {
            // Use gemini-embedding-001 and slice to 768 for the v2 schema
            const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
            const embeddingResult = await embeddingModel.embedContent(queryParams.search_query);

            const rpcParams: any = {
                query_embedding: embeddingResult.embedding.values.slice(0, 768),
                match_threshold: isRefinementMode ? 0.30 : (useFilters ? 0.5 : 0.35),
                match_count: isRefinementMode ? 8 : 5
            };

            if (useFilters) {
                rpcParams.filter = {
                    species: [queryParams.species[0]],
                    clinical_category: [queryParams.clinical_category[0]]
                };
            }

            // Using the new v2 RPC which correctly processes the JSON filter and uses embedding_v2
            const { data: documents, error } = await supabase.rpc('match_merck_v2', rpcParams);
            return { documents, error };
        };

        // Attempt 1: Strict Search
        let searchResults = await performSearch(true);

        // Attempt 2: Fallback (Relaxed/No Filter)
        if (!searchResults.documents || searchResults.documents.length === 0) {
            console.log("Strict search returned 0 results. Triggering Fallback.");
            searchResults = await performSearch(false);
        }

        if (searchResults.error) {
            console.error("Vector search error:", searchResults.error);
            return "";
        } else if (searchResults.documents && searchResults.documents.length > 0) {
            return searchResults.documents.map((d: any) =>
                `[Reference: Merck Veterinary Manual, Source: ${d.metadata?.source || 'Unknown'}, Page: ${d.metadata?.loc?.pageLabel || d.metadata?.page || 'Unknown'}]
                 ${d.content} `
            ).join("\n\n---\n\n");
        } else {
            return "No specific veterinary protocols found in database after fallback search.";
        }

    } catch (err) {
        console.error("RAG processing error:", err);
        return "";
    }
}


// --- New: Monitoring Handler ---
async function handleMonitoring(
    reqBody: any,
    genAI: GoogleGenerativeAI,
    supabase: any
): Promise<Response> {
    const { monitoring_history, original_analysis, pet } = reqBody;

    // Extract pet details or default
    const petName = pet?.name || "the pet";
    const species = pet?.species || "animal";

    // 1. Get latest user input (if any) to fetch fresh context
    const latestUserMessage = monitoring_history
        .filter((m: any) => m.role === 'user')
        .pop()?.content || "";

    // 2. Retrieve Context (RAG) based on latest input + original condition
    const contextQuery = `${latestUserMessage} ${original_analysis?.primaryRecommendation || ""} ${original_analysis?.keyObservations?.join(" ") || ""}`;
    const veterinaryContext = await retrieveVeterinaryContext(contextQuery, species, genAI, supabase, true);

    // 3. Construct Prompt
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const prompt = `
    ROLE: You are an expert Veterinary AI Assistant conducting a follow-up check-in.
    
    CONTEXT:
    - Pet: ${petName} (${species})
    - Initial Triage (2 hours ago): ${JSON.stringify(original_analysis?.causes?.[0] || "Unknown Issue")}
    - Urgency: ${original_analysis?.urgency_level || "Unknown"}
    
    HISTORY OF CHECK-IN:
    ${JSON.stringify(monitoring_history)}

    NEW VETERINARY KNOWLEDGE (RAG):
    ${veterinaryContext}

    GOAL:
    Determine if the pet's condition is BETTER, WORSE, or SAME.
    Then generate a SHORT, empathetic, and medically relevant SMS reply (max 160 chars ideally, but up to 300 ok).

    LOGIC:
    - If this is the FIRST check-in (history is empty):
      - Ask a specific question about the MAIN symptom from the Initial Triage.
      - Example: "Hi, this is CheckPet. Has ${petName} vomited again in the last 2 hours?"
    - If user says YES/BETTER:
      - Reply with reassurance and close the case. STATUS: RESOLVED.
    - If user says NO/WORSE:
      - Advise seeing a vet immediately. STATUS: ESCALATED.
    - If user provides specific symptom (e.g. "Gum color is pale"):
      - Analyze it using the Veterinary Context.
      - If it indicates danger (Pale gums = shock), ESCALATE.
      - If it's ambiguous, ask ONE clarifying question. STATUS: ONGOING.
    
    OUTPUT JSON:
    {
        "status": "RESOLVED" | "ESCALATED" | "ONGOING",
        "reply_text": "string (the SMS content)",
        "reasoning": "string (internal medical logic)"
    }
    `;

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
    });

    const responseText = result.response.text();
    return new Response(responseText, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });
}


// --- Original Helpers (Prompt Logic) ---
// (Kept simplified for brevity, assume full propmt logic is needed if we are replacing the file)
// IMPORTANT: Since I am replacing the file, I must include the FULL original logic for the Triage Mode too.
// I will copy the original helper functions here.

const UNIVERSAL_STANDARDS = `
RESPONSE QUALITY STANDARDS:
- Confidence Score: Always include 0-100% confidence in recommendations
- Specificity: Use exact measurements, timeframes, and quantities when possible
- Personalization: Reference pet name ("<PET_NAME_PLACEHOLDER>") and specific characteristics.
- Safety First: Escalate to veterinary care when uncertain.
- Actionability: Every recommendation must be immediately actionable.
- OUTPUT STYLE: If referencing weight in text/reasoning, YOU MUST use the descriptive category (e.g. "Tiny (<15 lbs)") if available. DO NOT Use the specific numeric estimate (e.g. "8 lbs") in the output text, as it is an internal estimation only.

URGENCY CLASSIFICATION SYSTEM (5 Levels):
1. CRITICAL (Red): Immediate threat to life. Go to ER immediately.
   - Signs: Difficulty breathing (gasping), Seizures >3min, Collapse, Bloat (distended abdomen), Uncontrolled bleeding, Pale gum color, Male cat straining to urinate, Toxin ingestion, Trauma/Fall from height.
2. URGENT (Orange): Serious but stable. Vet visit required today (within 6-12h).
   - Signs: Deep wounds, Persistent vomiting (>24h), Bloody diarrhea, Eye injuries (squinting/cloudy), Severe pain/Lameness (non-weight bearing), Inability to walk.
3. CONSULT (Yellow): Non-urgent medical issue. Vet visit within 24-48h.
   - Signs: Ear infections, Skin rashes, Mild limping, Worms, Lethargy without other symptoms, Behavioral changes >12h.
4. WATCH (Blue): Monitor at home.
   - Signs: Single vomit, Mild scratch, Energy slightly off, 'Just not right' but eating/drinking/active.
5. NORMAL (Green): Wellness/Diet/Prevention questions only. No medical concern.
`;

function generateBreedContext(pet: Pet, breedInfo?: BreedData | null): string {
    if (!breedInfo) {
        return `
BREED CONTEXT:
- Mixed breed or breed unknown - using general ${pet.species} care guidelines
- Apply species-appropriate care standards
- Monitor for common ${pet.species} health issues
`;
    }

    return `
BREED-SPECIFIC CONTEXT:
- Breed: ${breedInfo.name} (${breedInfo.category} size category)
- Key Care Requirements: ${breedInfo.care_highlights.join(', ')}
- Common Health Concerns: ${breedInfo.common_health_issues.join(', ')}
- Special Considerations: ${breedInfo.task_data ?
            `Exercise intensity: ${breedInfo.task_data.daily_tasks.exercise_intensity}, 
     Grooming frequency: ${breedInfo.task_data.daily_tasks.grooming_frequency},
     Mental stimulation needs: ${breedInfo.task_data.daily_tasks.mental_stimulation_needs}` :
            'Standard breed care applies'}
`;
}

function generatePetProfileContext(pet: Pet, breedInfo?: BreedData | null): string {
    const ageDisplay = pet.age_years || pet.age_months ?
        `${pet.age_years || 0} years ${pet.age_months || 0} months` : 'Age unknown';

    return `
PET PROFILE:
- Name: ${pet.name}
- Species: ${pet.species}
- Breed: ${pet.breed || 'Mixed/Unknown'}
- Sex: ${pet.sex || 'Unknown'} (${pet.neutered ? 'Fixed' : 'Intact'})
- Age: ${ageDisplay}
- Weight: ${pet.weight_description ? pet.weight_description : ''} ${pet.weight_lbs ? `(~${pet.weight_lbs} lbs)` : ''}
- Activity Level: ${pet.activity_level || 'Not specified'}
- Personality: ${pet.personality_type || 'Not assessed'}
- Training Level: ${pet.training_level || 'Not assessed'}
- Living Situation: ${pet.living_situation || 'Not specified'}
- Medical History: ${pet.medical_history || 'None provided'}
- Special Dietary Needs: ${pet.special_dietary_needs || 'None'}
- Behavioral Notes: ${pet.behavioral_notes || 'None'}

${generateBreedContext(pet, breedInfo)}
`;
}

function generateHealthAssessmentPrompt(
    pet: Pet,
    breedInfo: BreedData | null,
    veterinaryContext: string = "",
    imageBase64: string | null = null,
    symptom: string = "",
    refinedSymptoms: string[] = [],
    initialCauses: any[] = [],
    refinementContext: { question: string, answer: string }[] = []
): string {

    const isRefinementMode = refinedSymptoms && refinedSymptoms.length > 0;

    const modePrompt = isRefinementMode
        ? `
# ROLE
You are an expert Veterinary Triage AI. You have already provided an initial assessment for a pet, and the user has now answered specific clarifying questions to verify that assessment.

# OBJECTIVE
Your goal is to "Zero In" on the diagnosis. You must re-calculate the probabilities of the likely conditions based *specifically* on the new answers provided by the user. You will then output a refined diagnosis and a clear explanation of how the new information changed (or confirmed) the conclusion.

# INPUT DATA
You will receive:
1. Pet Profile (Species, Age, Weight, Sex) - see below.
2. Original User Description - see below.
3. Initial Top Diagnosis & Probability (The "Hypothesis"):
   ${initialCauses.map(c => `- ${c.condition} (${(c.probability * 100).toFixed(0)}%)`).join('\n   ')}
4. The 3 Clarifying Questions asked & 5. The User's Answers (The "Evidence"):
   ${refinementContext.map(qa => `Q: "${qa.question}" -> A: "${qa.answer}"`).join('\n   ')}

# TRIAGE LOGIC (STRICT)
1. **The "Rule Out" Mechanic:** If the user answered "No" to a critical symptom of the Initial Diagnosis (e.g., Hypothesis: Fracture -> Question: "Is the leg dangling?" -> Answer: "No"), you MUST significantly lower the probability of that condition.
2. **The "Rule In" Mechanic:** If the user answered "Yes" to a specific distinguishing symptom, you MUST increase the probability of the matching condition.
3. **The "Unsure" Default (Safety First):** If the user answered "Unsure" to a critical symptom (e.g., "Are gums pale?"), you MUST treat it as a **HIGH RISK / POTENTIAL POSITIVE** until proven otherwise. Do NOT rule out an emergency based on an "Unsure" answer.
4. **Safety Override:** If any answer indicates a life-threatening sign (e.g., pale gums, trouble breathing, profuse bleeding), the final urgency must be "EMERGENCY" regardless of the specific condition diagnosis.

INSTRUCTION: 
- Re-evaluate the probabilities.
- Generate a new "causes" array with updated probabilities.
- REQUIRED FIELD "refinement_reasoning": 
  - **CRITICAL EVIDENCE REQUIREMENT (RAG)**: You MUST support your refined diagnosis by citing specific evidence from the user's answers AND the provided [VETERINARY CONTEXT].
  - **CITATION FORMAT**: "User reported [Answer], which matches text in Merck Manual: '[Exact Quote from Context]'."
  - IF IMAGE PROVIDED: Start with "Visual analysis detected [specific finding]..." then add the citations.
  - Example: "User reported gums are pink, which matches text: 'Reverse sneezing is self-limiting and gums remain pink'. This rules out Choking where 'cyanosis' is present."
- REQUIRED FIELD "conditional_assessment": A string strictly following this template: "Current symptoms match [Likely Condition] ([Probability]% match). However, because [Severe Condition] shares early symptoms, strict monitoring of [Specific Body Part] is required for the next 24 hours."
- REQUIRED FIELD "watch_for_symptoms": A list of 3 specific "Red Flag" symptoms associated with the [Severe Condition] that would indicate escalation.
- Return the FULL JSON structure.
    `
        : `
[*** INITIAL TRIAGE MODE ***]
Analyze the user's raw input. Cast a wide net for potential issues. Priority is correct System Categorization.
    `;

    return `You are an advanced veterinary AI assistant. Analyze the ${Boolean(imageBase64) ? 'photo and ' : ''}input: "${symptom}" for ${pet.name}.

${modePrompt}

[VETERINARY CONTEXT]
${veterinaryContext}

You are analyzing a ${pet.species}. The provided context may contain information for other animals. Aggressively ignore any context that explicitly references horses, cows, birds, or other species irrelevant to ${pet.species}.

${UNIVERSAL_STANDARDS}

${generatePetProfileContext(pet, breedInfo)}

    TRIAGE PROTOCOL (Risk-Based & Safe):
    1. List the Top 3 Potential Causes.
    2. Assign System Category (GI, ORTHO, RESP, etc.).
    3. Determine Global Urgency Level (CRITICAL, URGENT, CONSULT, WATCH, NORMAL).
    
    *** CRITICAL INSTRUCTION FOR EMERGENCY CASES ***
    If the Urgency Level is CRITICAL or URGENT:
    - The "immediate_aid" array must ONLY contain life-stabilizing steps (e.g., "Apply pressure", "Keep warm", "Transport immediately").
    - Do NOT include generic advice like "Monitor water intake".
    - The "detailedAnalysis" section can be brief or empty as priority is transport.

    CLINICAL TRIAGE STEP-BY-STEP (Standard of Care):
    1. IMMEDIATE FIRST AID ("The 30-Minute Rule"):
       - Goal: Stabilize patient. Prevent further injury.
       - Generate exactly 3 medically relevant actions.
       
    2. RECOVERY PROTOCOL (Locked Content):
       - Days 1-5 Management (Nutrition, Wound Care).

    3. USER VALUE & CONVERSION STRATEGY:
       - Generate "complication_risk_badge" and "locked_categories" hooks.

    BIO - INFERENCE PROTOCOL:
    If image provided, infer Breed, Weight, and Confidence.

    *** DYNAMIC CLARIFICATION RULES (CRITICAL) ***
    1. Generate exactly 3 strictly BOOLEAN (Yes/No) questions. The user MUST be able to answer them with ONLY a simple 'Yes' or 'No'.
    2. STRICTLY FORBIDDEN: 'Or' questions. 
       - BAD: "Is the bump firm or squishy?" -> GOOD: "Is the bump firm to the touch?"
    3. STRICTLY FORBIDDEN: Open-ended questions. 
       - BAD: "What color is the vomit?" -> GOOD: "Is the vomit yellow or green?"
    4. NAMING: Refer to the animal as "your pet" (or "your dog/cat"), NEVER "Guest Pet".

    CRITICAL: Respond ONLY in valid JSON format.

    Expected JSON structure:
    {
        "assessmentPossible": boolean,
        "quickInsight": string,
        "keyObservations": string[],
        "primaryRecommendation": string,
        "urgencyLevel": "CRITICAL" | "URGENT" | "CONSULT" | "WATCH" | "NORMAL",
        "confidenceScore": number,
        "causes": [
            {
                "condition": string,
                "probability": number,
                "urgency": "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY",
                "reasoning": string,
                "system_category": string
            }
        ],
        "detectedSystems": string[],
        "triage_strategy": {
            "immediate_aid": string[],
            "recovery_protocol": string[]
        },
        "conversion_hooks": {
            "complication_risk_badge": string,
            "protocol_header": string,
            "locked_categories": [{ "title": string, "subtitle": string }],
            "redFlagChecklist": [{ "question": string, "riskIfConfirmed": string, "logic": string }]
        },
        "detailedAnalysis": {
            "feeding": { "recommendations": string[] },
            "exercise": { "activities": string[] },
            "grooming": { "tasks": string[] },
            "health": { "monitoring": string[], "preventive_care": string[] }
        },
        "patient_demographics": {
            "species": "dog" | "cat",
            "breed_prediction": string | null,
            "weight_class_guess": string | null,
            "confidence": number
        },
        "visualAnnotations": [
            { "label": string, "coordinates": [ymin, xmin, ymax, xmax] }
        ],
        "refinement_reasoning": string,
        "verification_questions": [{ "id": string, "text": string, "riskWeight": number }],
        "conditional_assessment": string,
        "watch_for_symptoms": string[],
        "citations": string[]
    }

    Return ONLY the JSON object.`;
}

function mapUrgencyToSchema(level: string): string {
    const up = (level || '').toUpperCase();
    if (up === 'CRITICAL') return 'emergency';
    if (up === 'URGENT') return 'urgent';
    if (up === 'CONSULT') return 'vet_visit_needed';
    if (up === 'WATCH') return 'monitor';
    if (up === 'NORMAL') return 'normal';
    return 'consult_vet'; // Fallback
}


// --- Main Handler ---

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY');
        if (!apiKey) {
            throw new Error('Missing Gemini API Key');
        }

        const reqBody = await req.json();
        const { imageBase64, pet, breedInfo, symptom, refinedSymptoms, initialCauses, refinementContext, monitoring_mode } = reqBody;

        const genAI = new GoogleGenerativeAI(apiKey);
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // --- BRANCH: Monitoring Mode ---
        if (monitoring_mode) {
            return await handleMonitoring(reqBody, genAI, supabase);
        }

        // --- BRANCH: Standard Triage Mode ---

        // Default to a generic pet if not provided (Guest Triage)
        const defaultPet = {
            name: 'Guest Pet',
            species: 'Unknown Animal',
            breed: 'Unknown',
            age_years: 0,
            weight_lbs: 0
        };
        const petData = { ...defaultPet, ...pet };

        // Define Search Target
        const isRefinementMode = refinedSymptoms && refinedSymptoms.length > 0;
        const searchTarget = isRefinementMode
            ? refinedSymptoms.join(' ') + ' ' + (symptom || '')
            : (symptom || '');

        // Retrieve RAG Context
        const contextText = await retrieveVeterinaryContext(searchTarget, petData.species, genAI, supabase, isRefinementMode);

        const model = genAI.getGenerativeModel({
            model: 'gemini-3-flash-preview',
        });

        const prompt = generateHealthAssessmentPrompt(petData, breedInfo, contextText, imageBase64, symptom, refinedSymptoms || [], initialCauses || [], refinementContext || []);

        const parts: any[] = [{ text: prompt }];
        if (imageBase64) {
            parts.push({
                inlineData: {
                    data: imageBase64,
                    mimeType: 'image/jpeg'
                }
            });
        }

        const result = await model.generateContent({
            contents: [
                {
                    role: 'user',
                    parts: parts
                }
            ],
            generationConfig: {
                maxOutputTokens: 12000,
                temperature: 0.4,
                responseMimeType: "application/json",
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
        });

        let responseText = '';
        try {
            responseText = result.response.text();
        } catch (textError) {
            console.error("Error extracting text from response:", textError);
            const candidates = result.response.candidates;
            if (candidates && candidates.length > 0 && candidates[0].content?.parts?.[0]?.text) {
                responseText = candidates[0].content.parts[0].text;
            }
        }

        // Handle empty response
        if (!responseText || responseText.trim().length === 0) {
            throw new Error("Empty response from Gemini");
        }

        let analysisData;
        try {
            const firstBrace = responseText.indexOf('{');
            const lastBrace = responseText.lastIndexOf('}');
            let cleanJson = '';
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                cleanJson = responseText.substring(firstBrace, lastBrace + 1);
            } else {
                cleanJson = responseText.replace(/```json\n ?|\n ? ```/g, '').trim();
                cleanJson = cleanJson.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
            }
            // sanitize
            cleanJson = cleanJson.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
            // fix trailing comma
            cleanJson = cleanJson.replace(/,(\s*[}\]])/g, '$1');

            analysisData = JSON.parse(cleanJson);
        } catch (e) {
            console.error("Failed to parse JSON:", e, responseText.substring(0, 500));
            analysisData = {
                assessmentPossible: false,
                failureReason: "Could not parse AI response",
                rawResponse: responseText.substring(0, 500)
            };
        }

        // --- Data Normalization ---
        const normalizedData = {
            ...analysisData,

            // Fix Urgency Mapping
            urgencyLevel: mapUrgencyToSchema(analysisData.urgencyLevel),

            // 3. New Output Flags for UI
            isRefinedDiagnosis: isRefinementMode,
            confirmedTags: refinedSymptoms || [],
            causes: analysisData.causes || [],
            refinement_reasoning: analysisData.refinement_reasoning || null,
            detectedSystems: analysisData.detectedSystems || [],
            recommended_strategy: analysisData.recommended_strategy || "Consult a Veterinarian",

            // Freemium Strategy normalization
            triage_strategy: analysisData.triage_strategy || {
                immediate_aid: analysisData.actionableSteps || [],
                recovery_protocol: (analysisData.recovery_protocol && analysisData.recovery_protocol.length > 0)
                    ? analysisData.recovery_protocol
                    : (analysisData.recommendations || [])
            },
            conversion_hooks: analysisData.conversion_hooks || { locked_categories: [] },
            summary: analysisData.summary || analysisData.quickInsight || "Health assessment complete.",
            recommendations: analysisData.triage_strategy?.immediate_aid || analysisData.recommendations || [],
            nextSteps: analysisData.nextSteps || analysisData.primaryRecommendation || "Please review the recommendations and consult your vet.",
            missing_fields: analysisData.missing_fields || [],
            follow_up_questions: analysisData.follow_up_questions || [],
            verification_questions: analysisData.verification_questions || [],
            conditional_assessment: analysisData.conditional_assessment || null,
            watch_for_symptoms: analysisData.watch_for_symptoms || [],
            visualAnnotations: analysisData.visualAnnotations || [],
        };

        return new Response(JSON.stringify(normalizedData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error('Edge Function Error:', error);
        return new Response(JSON.stringify({
            error: error.message,
            assessmentPossible: false,
            failureReason: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
});
