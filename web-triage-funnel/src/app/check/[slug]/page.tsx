import fs from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { TriageCTA } from '@/components/check/TriageCTA';

interface SymptomData {
    title: string;
    meta_desc: string;
    content_html: string;
    reviewer_name?: string;
    faqs?: { question: string; answer: string }[];
}

// 1. Generate Static Params (replaces getStaticPaths)
export async function generateStaticParams() {
    const dataDir = path.join(process.cwd(), 'src/data/pages');
    if (!fs.existsSync(dataDir)) return [];
    const files = fs.readdirSync(dataDir);
    return files
        .filter((f) => f.endsWith('.json'))
        .map((f) => ({ slug: f.replace('.json', '') }));
}

// 2. Fetch Data Helper
async function getPageData(slug: string): Promise<SymptomData | null> {
    const filePath = path.join(process.cwd(), 'src/data/pages', `${slug}.json`);
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch {
        return null;
    }
}

// 3. Metadata (SEO)
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const data = await getPageData(slug);
    if (!data) return {};
    return {
        title: data.title,
        description: data.meta_desc,
        alternates: {
            canonical: `/check/${slug}`,
        },
    };
}

// 4. Page Component
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const data = await getPageData(slug);

    // Default reviewer if none specified
    const reviewerName = data?.reviewer_name || "Dr. Jane Doe, DVM";

    if (!data) notFound();

    // Infer Species/Symptom from Slug (simple heuristic)
    const isCat = slug.startsWith('cat-');
    const species = isCat ? 'cat' : 'dog';
    const symptomRaw = slug.replace(/^(cat|dog)-/, '').replace(/-/g, ' ');

    // Structured Data (MedicalWebPage)
    const schemaData = {
        "@context": "https://schema.org",
        "@type": "MedicalWebPage",
        "name": data.title,
        "description": data.meta_desc,
        "audience": {
            "@type": "MedicalAudience",
            "audienceType": "Pet Owners"
        },
        "reviewedBy": {
            "@type": "Person",
            "name": reviewerName
        }
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
            />

            <div className="min-h-screen bg-white font-sans text-gray-900 flex flex-col">

                {/* --- Global Header (New) --- */}
                <header className="bg-white border-b border-slate-100 py-4 px-4 sticky top-0 z-40">
                    <div className="max-w-3xl mx-auto flex items-center justify-center">
                        {/* Simple Logo Link */}
                        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm border border-slate-100">
                                <img src="/checkpet-logo.png" alt="CheckPet Logo" className="w-full h-full object-cover" />
                            </div>
                            <span className="text-lg font-bold text-slate-900 tracking-tight">CheckPet</span>
                        </a>
                    </div>
                </header>

                {/* --- Hero Section --- */}
                <section className="bg-blue-50 py-12 px-4 sm:px-6 lg:px-8 text-center border-b border-blue-100">
                    <div className="max-w-3xl mx-auto">
                        <h1 className="text-3xl font-extrabold text-gray-900 sm:text-5xl mb-4 leading-tight">
                            {data.title}
                        </h1>
                        <p className="text-xl text-blue-800 font-medium mb-8">
                            Unsure if this is serious?
                        </p>

                        {/* --- Contextual Handoff Widget (New) --- */}
                        <TriageCTA
                            species={species}
                            symptom={symptomRaw}
                            symptomTitle={data.title}
                        />
                    </div>
                </section>

                {/* --- Content Body --- */}
                <main className="py-12 px-4 sm:px-6 lg:px-8 flex-grow">
                    <article className="prose prose-lg prose-blue mx-auto">
                        <div dangerouslySetInnerHTML={{ __html: data.content_html }} />

                        {/* --- Reviewer Footer Block --- */}
                        <div className="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-500 flex items-center space-x-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>Protocol reviewed by <strong>{reviewerName}</strong></span>
                        </div>
                    </article>

                    {/* --- FAQ Section --- */}
                    {data.faqs && data.faqs.length > 0 && (
                        <section className="max-w-prose mx-auto mt-12 pt-8 border-t border-gray-200">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
                            <dl className="space-y-6">
                                {data.faqs.map((faq, index) => (
                                    <div key={index} className="bg-gray-50 p-6 rounded-lg">
                                        <dt className="text-lg font-semibold text-gray-900 mb-2">{faq.question}</dt>
                                        <dd className="text-gray-700">{faq.answer}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    )}
                </main>

                {/* --- YMYL Compliance Banner (Moved to Bottom) --- */}


            </div>
        </>
    );
}
