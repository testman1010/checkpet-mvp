'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface TriageCTAProps {
    species: string;
    symptom: string;
    symptomTitle: string;
}

export function TriageCTA({ species, symptom, symptomTitle }: TriageCTAProps) {
    const router = useRouter();
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const handleStartTriage = () => {
        setLoading(true);
        // Construct URL with query parameters
        const params = new URLSearchParams({
            species: species.toLowerCase(),
            symptom: symptom,
            description: description
        });

        // Redirect to main app
        router.push(`/?${params.toString()}`);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-dashed border-blue-300 max-w-md mx-auto hover:border-blue-500 transition-colors group">
            <div className="flex flex-col space-y-4">

                <div className="text-center">
                    <h3 className="text-lg font-bold text-blue-900">
                        Is this an emergency?
                    </h3>
                    <p className="text-sm text-blue-600 mb-4">
                        Get an instant AI triage analysis.
                    </p>
                </div>

                <div>
                    <label htmlFor="cta-desc" className="sr-only">Briefly describe the problem</label>
                    <input
                        id="cta-desc"
                        type="text"
                        placeholder={`Briefly describe the ${symptom}...`}
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 text-slate-700"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleStartTriage()}
                    />
                </div>

                <Button
                    onClick={handleStartTriage}
                    className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-95"
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Starting Triage...
                        </>
                    ) : (
                        "Start Free AI Triage"
                    )}
                </Button>

                <p className="text-xs text-center text-slate-400">
                    No sign-up required • 100% Free
                </p>
            </div>
        </div>
    );
}
