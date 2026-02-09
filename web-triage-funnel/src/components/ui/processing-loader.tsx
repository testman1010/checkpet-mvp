import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const LOADING_TERMS = [
    "Extracting visual features...",
    "Analyzing symptom patterns...",
    "Cross-referencing triage protocols...",
    "Calculating risk factors...",
    "Evaluating urgency constraints...",
    "Generating care recommendations...",
    "Finalizing assessment...",
];

export function ProcessingLoader({ type = 'INITIAL' }: { type?: 'INITIAL' | 'REFINEMENT' }) {
    const [termIndex, setTermIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTermIndex((prev) => (prev + 1) % LOADING_TERMS.length);
        }, 2000); // Change term every 2 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-md flex flex-col items-center text-center">

                {/* Pulsing Icon */}
                <div className="mb-8 relative">
                    <div className="absolute inset-0 bg-blue-500 rounded-full opacity-20 animate-ping"></div>
                    <div className="bg-white p-4 rounded-full shadow-lg border border-blue-100 relative z-10">
                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                    </div>
                </div>

                {/* Dynamic Text */}
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {type === 'INITIAL' ? 'Analyzing Case...' : 'Refining Analysis...'}
                </h3>

                <div className="h-8 mb-8 relative w-full flex justify-center overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={termIndex}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="text-slate-500 font-medium absolute w-full"
                        >
                            {LOADING_TERMS[termIndex]}
                        </motion.p>
                    </AnimatePresence>
                </div>

                {/* Progress Bar (Fake but effective) */}
                <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-blue-600 rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{
                            duration: 12, // Slightly longer than usual wait to feel like progress
                            ease: "easeInOut"
                        }}
                    />
                </div>

                <p className="text-xs text-slate-400 mt-4">
                    Powered by the Merck Veterinary Manual Protocols
                </p>

            </div>
        </div>
    );
}
