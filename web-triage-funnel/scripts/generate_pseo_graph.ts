
import fs from 'fs';
import path from 'path';

// --- Configuration ---
const PAGES_DIR = path.join(process.cwd(), 'src/data/pages');
const OUTPUT_FILE = path.join(process.cwd(), 'src/data/pseo-map.json');

// --- Types ---
interface PageData {
    slug: string;
    title: string;
    meta_desc: string;
    content: string; // HTML content for urgency scanning
    species: 'Dog' | 'Cat';
    urgencyScore: number;
    tokens: Record<string, number>; // TF map
    featured_override?: boolean;
}

interface OutputMap {
    featured: {
        slug: string;
        title: string;
        reason: string;
    }[];
    related: Record<string, string[]>; // slug -> [related_slugs]
}

// --- Stop Words (Simple English) ---
const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with', 'your', 'you', 'this', 'or', 'if', 'but', 'not', 'can', 'do', 'does', 'did', 'have', 'had', 'what', 'when', 'where', 'who', 'why', 'how'
]);

// --- Helper Functions ---

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function calculateTF(tokens: string[]): Record<string, number> {
    const tf: Record<string, number> = {};
    const total = tokens.length;
    tokens.forEach(t => {
        tf[t] = (tf[t] || 0) + 1;
    });
    // Normalize
    Object.keys(tf).forEach(k => tf[k] = tf[k] / total);
    return tf;
}

function calculateCosineSimilarity(vecA: Record<string, number>, vecB: Record<string, number>, idf: Record<string, number>): number {
    const keys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    keys.forEach(key => {
        const valA = (vecA[key] || 0) * (idf[key] || 0);
        const valB = (vecB[key] || 0) * (idf[key] || 0);
        dotProduct += valA * valB;
        magA += valA * valA;
        magB += valB * valB;
    });

    return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

// --- Main Execution ---

async function main() {
    console.log("Starting pSEO Graph Generation...");

    if (!fs.existsSync(PAGES_DIR)) {
        console.error(`Error: Directory not found: ${PAGES_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.json'));
    const pages: PageData[] = [];
    const docFrequency: Record<string, number> = {};

    console.log(`Processing ${files.length} pages...`);

    // 1. Read & Parse Pages
    for (const file of files) {
        const content = fs.readFileSync(path.join(PAGES_DIR, file), 'utf-8');
        const json = JSON.parse(content);
        const slug = file.replace('.json', '');

        // Determine Species
        const isCat = slug.startsWith('cat-');
        const species = isCat ? 'Cat' : 'Dog';

        // simple stop if not cat/dog
        if (!slug.startsWith('cat-') && !slug.startsWith('dog-')) continue;

        // Urgency Scoring
        let score = 0;
        const lowerContent = (json.content_html + "").toLowerCase();
        const lowerTitle = (json.title + "").toLowerCase();

        if (lowerContent.includes("urgency level: high") || lowerContent.includes("imperative") || lowerContent.includes("emergency")) score += 50;
        if (lowerTitle.includes("bloat") || lowerTitle.includes("gdv")) score += 40;
        if (lowerTitle.includes("breathing") || lowerTitle.includes("respiratory")) score += 30;
        if (lowerTitle.includes("seizure") || lowerTitle.includes("collapse")) score += 30;
        if (lowerTitle.includes("bleeding") || lowerTitle.includes("trauma")) score += 25;
        if (lowerTitle.includes("poison") || lowerTitle.includes("toxin")) score += 25;
        if (lowerTitle.includes("vomiting") || lowerTitle.includes("diarrhea")) score += 10;

        // Check for manual override
        const featured_override = json.featured_override || false;

        // Tokenization for TF-IDF
        const combinedText = `${json.title} ${json.meta_desc}`;
        const tokens = tokenize(combinedText);

        // Update Document Frequency
        const uniqueTokens = new Set(tokens);
        uniqueTokens.forEach(t => {
            docFrequency[t] = (docFrequency[t] || 0) + 1;
        });

        pages.push({
            slug,
            title: json.title,
            meta_desc: json.meta_desc,
            content: json.content_html,
            species,
            urgencyScore: score,
            featured_override,
            tokens: calculateTF(tokens)
        });
    }

    // 2. Calculate IDF
    const idf: Record<string, number> = {};
    const N = pages.length;
    Object.keys(docFrequency).forEach(token => {
        idf[token] = Math.log(N / (docFrequency[token] || 1));
    });

    // 3. Select Featured (Top Urgency + Manual Overrides)
    // We want a mix: 3 Dogs, 3 Cats with highest scores, favoring overrides

    const sortFn = (a: PageData, b: PageData) => {
        if (a.featured_override && !b.featured_override) return -1;
        if (!a.featured_override && b.featured_override) return 1;
        return b.urgencyScore - a.urgencyScore;
    };

    const topDogs = pages.filter(p => p.species === 'Dog').sort(sortFn).slice(0, 3);
    const topCats = pages.filter(p => p.species === 'Cat').sort(sortFn).slice(0, 3);

    const featured = [...topDogs, ...topCats].map(p => ({
        slug: p.slug,
        title: p.title,
        reason: p.featured_override ? "Editors Choice" : `Urgency Score: ${p.urgencyScore}`
    }));

    console.log("Featured Pages Selected:", featured.map(f => `${f.title} (${f.reason})`));

    // 4. Calculate Related Pages (Cosine Similarity)
    const relatedMap: Record<string, string[]> = {};

    // Performance Optimization: Only compare if sharing same tokens? No, simpler to just brute force within species given N=3600 is small for local script
    // Actually 3600^2 comparisons is ~12M. It might take 10-20 seconds. Acceptable.

    console.log("Calculating Content Similarity Graph...");

    pages.forEach((pageA, index) => {
        const candidates = pages.filter(p => p.species === pageA.species && p.slug !== pageA.slug);

        const scoredCandidates = candidates.map(pageB => {
            return {
                slug: pageB.slug,
                score: calculateCosineSimilarity(pageA.tokens, pageB.tokens, idf)
            };
        });

        // Sort by similarity desc
        const topMatches = scoredCandidates
            .sort((a, b) => b.score - a.score)
            .slice(0, 6)
            .map(m => m.slug);

        relatedMap[pageA.slug] = topMatches;

        if (index % 500 === 0) console.log(`Processed ${index}/${pages.length} pages...`);
    });

    // 5. Output
    const output: OutputMap = {
        featured,
        related: relatedMap
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`\nSuccess! Graph written to: ${OUTPUT_FILE}`);
}

main().catch(err => console.error(err));
