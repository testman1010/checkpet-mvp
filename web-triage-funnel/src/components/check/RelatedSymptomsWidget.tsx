
import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import pseoMap from '@/data/pseo-map.json';
import { Sparkles, ArrowRight } from 'lucide-react';

interface RelatedSymptomsWidgetProps {
    currentSlug: string;
}

// Helper to get title for a slug (SSG friendly)
function getSymptomTitle(slug: string): string {
    try {
        const filePath = path.join(process.cwd(), 'src/data/pages', `${slug}.json`);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        return data.title;
    } catch (e) {
        return slug.replace(/-/g, ' '); // Fallback
    }
}

export function RelatedSymptomsWidget({ currentSlug }: RelatedSymptomsWidgetProps) {
    // @ts-ignore
    const relatedSlugs = pseoMap.related?.[currentSlug] as string[];

    if (!relatedSlugs || relatedSlugs.length === 0) return null;

    // Get data for each related slug
    const relatedItems = relatedSlugs.slice(0, 6).map(slug => ({
        slug,
        title: getSymptomTitle(slug)
    }));

    return (
        <section className="max-w-3xl mx-auto mt-16 pt-8 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-bold text-slate-900">Related Symptom Guides</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relatedItems.map((item) => (
                    <Link
                        key={item.slug}
                        href={`/check/${item.slug}`}
                        className="group block p-4 bg-slate-50 border border-slate-100 rounded-lg hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all"
                    >
                        <h3 className="font-semibold text-slate-800 text-sm mb-1 group-hover:text-blue-700 transition-colors line-clamp-2">
                            {item.title}
                        </h3>
                        <div className="flex items-center text-xs text-slate-400 group-hover:text-blue-500 font-medium">
                            Read Guide
                            <ArrowRight className="w-3 h-3 ml-1 transition-transform group-hover:translate-x-1" />
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
