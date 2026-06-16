import fs from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { TriageCTA, StickyMobileCTA, UrgencyBanner } from '@/components/check/TriageCTA';
import { RelatedSymptomsWidget } from '@/components/check/RelatedSymptomsWidget';
import { PseoEngagementTracker } from '@/components/check/PseoEngagementTracker';

interface SymptomData {
    title: string;
    meta_desc: string;
    content_html: string;
    faqs?: { question: string; answer: string }[];
    __lastModified?: string;
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
        const parsed = JSON.parse(fileContent) as SymptomData;
        // Real "last updated" signal from the content file's modified time.
        const stat = fs.statSync(filePath);
        parsed.__lastModified = stat.mtime.toISOString();
        return parsed;
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

    if (!data) notFound();

    // Honest "last updated" from the content file's modified time (no fabricated review date).
    const dateModified = data.__lastModified || new Date().toISOString();
    const lastUpdatedLabel = new Date(dateModified).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
    });

    // Infer Species/Symptom from Slug (simple heuristic)
    const isCat = slug.startsWith('cat-');
    const species = isCat ? 'cat' : 'dog';
    const symptomRaw = slug.replace(/^(cat|dog)-/, '').replace(/-/g, ' ');

    // Infer urgency from content keywords for the mid-article banner
    const contentLower = (data.content_html || '').toLowerCase();
    const urgency: 'high' | 'moderate' | 'low' =
        contentLower.includes('life-threatening') || contentLower.includes('emergency') || contentLower.includes('immediately')
            ? 'high'
            : contentLower.includes('urgent') || contentLower.includes('vet visit') || contentLower.includes('within 24')
                ? 'moderate'
                : 'low';

    // Structured Data (MedicalWebPage) — honest, organization-level authorship.
    // No fabricated human reviewer; content is compiled by the CheckPet Editorial Team
    // and aligned with the Merck Veterinary Manual (cited below).
    const schemaData = {
        "@context": "https://schema.org",
        "@type": "MedicalWebPage",
        "name": data.title,
        "description": data.meta_desc,
        "inLanguage": "en",
        "dateModified": dateModified,
        "audience": {
            "@type": "MedicalAudience",
            "audienceType": "Pet Owners"
        },
        "about": {
            "@type": "MedicalCondition",
            "name": symptomRaw
        },
        "citation": {
            "@type": "CreativeWork",
            "name": "Merck Veterinary Manual",
            "url": "https://www.merckvetmanual.com/"
        },
        "author": {
            "@type": "Organization",
            "name": "CheckPet Editorial Team",
            "url": "https://checkpet.vet"
        },
        "publisher": {
            "@type": "Organization",
            "name": "CheckPet",
            "url": "https://checkpet.vet",
            "logo": {
                "@type": "ImageObject",
                "url": "https://checkpet.vet/checkpet-logo.png"
            }
        }
    };

    // FAQ Structured Data (AEO Improvement)
    const faqSchema = data.faqs && data.faqs.length > 0 ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": data.faqs.map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer
            }
        }))
    } : null;

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
            />
            {faqSchema && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
                />
            )}

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
                        <p className="text-lg text-slate-600 font-medium mb-8">
                            Find out if your pet needs a vet — free instant assessment.
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

                        {/* --- Mid-Article Urgency Banner (Concept C — second touchpoint) --- */}
                        <UrgencyBanner species={species} symptom={symptomRaw} urgency={urgency} />

                        {/* --- Editorial Attribution + Medical Disclaimer (honest E-E-A-T) --- */}
                        <div className="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-500">
                            <div className="flex items-center space-x-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>
                                    Compiled by the <strong>CheckPet Editorial Team</strong>, aligned with the{' '}
                                    <a href="https://www.merckvetmanual.com/" target="_blank" rel="nofollow noopener" className="underline hover:text-gray-700">Merck Veterinary Manual</a>. Last updated {lastUpdatedLabel}.
                                </span>
                            </div>
                            <p className="mt-3 text-xs text-gray-400 leading-relaxed">
                                This article is for general informational purposes only and is not a substitute for professional veterinary advice, diagnosis, or treatment. If you think your pet may be unwell, contact a licensed veterinarian.
                            </p>
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

                    {/* --- Related Symptoms (pSEO Cross-Linking) --- */}
                    <RelatedSymptomsWidget currentSlug={slug} />
                </main>

                {/* --- YMYL Compliance Banner (Moved to Bottom) --- */}

                {/* --- Client-Side Engagement Tracking --- */}
                <PseoEngagementTracker species={species} symptom={symptomRaw} />

                {/* --- Sticky Mobile CTA (appears when scrolled past hero) --- */}
                <StickyMobileCTA species={species} symptom={symptomRaw} />

            </div>
        </>
    );
}
