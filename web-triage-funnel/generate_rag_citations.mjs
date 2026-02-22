import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env relative to this script inside web-triage-funnel
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// If this script fails with a 404 NOT FOUND for gemini-embedding-001, replace this variable with a key that has Vertex AI / Cloud embeddings enabled.
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function processFile(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);

        let originalHtml = data.content_html || '';
        const title = data.title || '';

        // Strip the previous citation block out so we can replace it (even if AEO script modified the H3 inside)
        const citationSplitText = "<div class='mt-8 p-6 bg-blue-50 border-l-4 border-blue-600 rounded-lg'>";
        if (originalHtml.includes(citationSplitText)) {
            originalHtml = originalHtml.split(citationSplitText)[0];
            // Remove accumulated escaped newlines from the end
            originalHtml = originalHtml.replace(/(\\n)+$/, '').trimEnd();
        }

        // 1. Generate gemini-embedding-001 vector
        const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const embeddingResult = await embeddingModel.embedContent(title);
        const embeddingValues = embeddingResult.embedding.values.slice(0, 768);

        // 2. Query Supabase for Top 3 most relevant chunks
        const { data: dbData, error } = await supabase.rpc("match_merck_v2", {
            query_embedding: embeddingValues,
            match_threshold: 0.35,
            match_count: 3
        });

        if (error) {
            throw new Error(error.message);
        }

        if (dbData && dbData.length > 0) {
            // Take the best matching doc's metadata for citation
            const doc = dbData[0];
            const pageNum = doc.metadata?.loc?.pageLabel || doc.metadata?.page_label || doc.metadata?.page || "N/A";
            const sourceDoc = "The Merck Veterinary Manual";
            let chapterHtml = "";
            if (doc.metadata?.clinical_category && Array.isArray(doc.metadata.clinical_category)) {
                chapterHtml = `<p class='text-xs text-blue-700 font-semibold mb-1'>Chapter: ${doc.metadata.clinical_category.join(', ')}</p>`;
            } else if (typeof doc.metadata?.clinical_category === 'string') {
                chapterHtml = `<p class='text-xs text-blue-700 font-semibold mb-1'>Chapter: ${doc.metadata.clinical_category}</p>`;
            }

            // Combine the top 3 chunks to provide the LLM with maximum context
            const allChunksText = dbData.map(d => d.content).join("\n\n---\n\n");

            // 3. Ask Gemini 2.0 to extract and correct the relevant medical context
            const textModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const prompt = `You are a strict veterinary editor. You are provided with raw OCR excerpts from the Merck Veterinary Manual related to the query: "${title}".
            
            YOUR TASK:
            1. Extract ONLY the information that is highly clinically relevant to the query.
            2. Ignore and discard any irrelevant sentences, cutoff sentences, or fluff.
            3. Fix any OCR spelling or grammar mistakes (e.g., "effmts" -> "efforts", "racliographs" -> "radiographs").
            4. Combine the extracted relevant facts into a single, cohesive, highly professional medical paragraph.
            5. Return ONLY the final paragraph. DO NOT return markdown formatting or conversational text.
            
            RAW OCR EXCERPTS:
            ${allChunksText}`;

            let cleanExcerpt = "";
            try {
                const aiResult = await textModel.generateContent(prompt);
                cleanExcerpt = aiResult.response.text().trim();
            } catch (err) {
                console.error(`Gemini cleanup failed for ${path.basename(filePath)}`, err.message);
                cleanExcerpt = doc.content.substring(0, 300) + "..."; // Fallback
            }

            // Ensure no literal \n strings are added to the DOM
            const citationHtml = `<div class='mt-8 p-6 bg-blue-50 border-l-4 border-blue-600 rounded-lg'><h3 class='text-sm font-bold text-blue-900 uppercase tracking-wider mb-2'>Clinical Context (Merck Veterinary Manual)</h3><p class='text-sm text-blue-800 leading-relaxed mb-4'>${cleanExcerpt}</p>${chapterHtml}<p class='text-xs text-blue-700 font-semibold'>Source: ${sourceDoc}, 11th Edition (Page ${pageNum})</p></div>`;

            data.content_html = originalHtml + citationHtml;

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            return `Successfully cited: ${path.basename(filePath)}`;
        } else {
            return `No citation matched for: ${path.basename(filePath)}`;
        }

    } catch (e) {
        return `Error processing ${path.basename(filePath)}: ${e.message}`;
    }
}

async function main() {
    const pagesDir = path.join(__dirname, 'src', 'data', 'pages');
    let files = fs.readdirSync(pagesDir)
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(pagesDir, f));

    const limitArgIndex = process.argv.indexOf('--limit');
    if (limitArgIndex > -1) {
        const limit = parseInt(process.argv[limitArgIndex + 1]);
        files = files.slice(0, limit);
        console.log(`TEST RUN: Processing only ${limit} files.`);
    }

    console.log(`Checking ${files.length} pages for RAG Citations using gemini-embedding-001 and gemini-2.0-flash...`);

    // Process in small batches to be faster but gentle on API limits
    let successCount = 0;
    const batchSize = 5;

    for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(processFile));

        for (const result of results) {
            console.log(result);
            if (result.startsWith("Successfully cited:")) {
                successCount++;
            }
        }

        // Add a small delay between batches
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`\nCompleted! Successfully added citations to ${successCount} files.`);
}

main();
