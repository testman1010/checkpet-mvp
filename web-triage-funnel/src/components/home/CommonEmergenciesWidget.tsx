
import Link from 'next/link';
import { AlertCircle, ChevronRight } from 'lucide-react';
import pseoMap from '@/data/pseo-map.json';

export function CommonEmergenciesWidget() {
    const featuredSymptoms = pseoMap.featured || [];
    if (!featuredSymptoms || featuredSymptoms.length === 0) return null;

    return (
        <section className="w-full max-w-4xl mx-auto mt-16 px-4 mb-24">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Common Emergencies</h2>
                <p className="text-slate-500 text-sm">Direct access to critical care guides</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredSymptoms.map((item) => (
                    <Link
                        key={item.slug}
                        href={`/check/${item.slug}`}
                        className="group block p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md hover:border-red-100 transition-all"
                    >
                        <div className="flex items-start gap-3">
                            <div className="bg-red-50 p-2 rounded-lg group-hover:bg-red-100 transition-colors shrink-0">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-slate-900 text-sm leading-tight mb-1 group-hover:text-red-700 transition-colors line-clamp-2">
                                    {item.title}
                                </h3>
                                <div className="flex items-center text-xs text-slate-400 group-hover:text-red-500 transition-colors mt-2">
                                    <span>Read Guide</span>
                                    <ChevronRight className="w-3 h-3 ml-1" />
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="mt-8 text-center">
                <Link href="/check" className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">
                    View Full Symptom Directory
                </Link>
            </div>
        </section>
    );
}
