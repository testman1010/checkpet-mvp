import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('GEMINI_API_KEY not found in .env.local');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

const CATEGORIES = [
    "Injuries & Trauma",
    "Dietary & Toxins",
    "Symptoms & Illness",
    "Dermatology & Skin",
    "Behavioral & Training",
    "Breeds & Genetics"
];

const promptTemplate = `You are an expert veterinary triage assistant. Categorize the following animal health topics (provided as URL slugs) into exactly one of these 6 categories, choosing the most appropriate one:
${CATEGORIES.map(c => `- ${c}`).join('\n')}

Format your response as a valid, flat JSON object where the keys are the exact slugs provided, and the values are the exact category names from the list above. Do not include any markdown formatting, backticks, or explanation. Output ONLY valid JSON.

Slugs to categorize:
`;

async function run() {
    const pagesDir = path.join(process.cwd(), 'src/data/pages');
    const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.json'));

    // We will extract the slugs
    const slugs = files.map(f => f.replace('.json', ''));

    // Process in batches
    const BATCH_SIZE = 150; // Use a conservative batch size to avoid output token limits
    const finalMap: Record<string, string> = {};

    for (let i = 0; i < slugs.length; i += BATCH_SIZE) {
        const batch = slugs.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(slugs.length / BATCH_SIZE)}...`);

        const prompt = promptTemplate + JSON.stringify(batch);

        try {
            const result = await model.generateContent(prompt);
            let text = result.response.text().trim();
            // clean markdown if any seeped through
            if (text.startsWith('```json')) {
                text = text.substring(7);
            } else if (text.startsWith('```')) {
                text = text.substring(3);
            }
            if (text.endsWith('```')) {
                text = text.substring(0, text.length - 3);
            }
            text = text.trim();

            const parsed = JSON.parse(text);
            Object.assign(finalMap, parsed);
        } catch (e) {
            console.error(`Error processing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, e);
        }

        // Wait a bit to avoid rate limits
        await new Promise(r => setTimeout(r, 2500));
    }

    const outPath = path.join(process.cwd(), 'src/data/directory-map.json');
    fs.writeFileSync(outPath, JSON.stringify(finalMap, null, 2));
    console.log(`Wrote mapping for ${Object.keys(finalMap).length} items to ${outPath}`);
}

run().catch(console.error);
