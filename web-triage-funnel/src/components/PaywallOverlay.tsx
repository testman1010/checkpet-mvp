import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ShieldAlert, Loader2, Sparkles } from 'lucide-react';

export function PaywallOverlay({
    onCheckout,
    onLogin,
}: {
    onCheckout: (type: 'emergency_scan' | 'subscription') => void;
    onLogin: () => void;
}) {
    const [loading, setLoading] = useState<'emergency_scan' | 'subscription' | null>(null);

    const handleSelect = (type: 'emergency_scan' | 'subscription') => {
        setLoading(type);
        onCheckout(type);
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-white/50 backdrop-blur-md animate-in fade-in duration-500">

            {/* Squeeze Header - Outside Card for maximum hierarchy break */}
            <div className="text-center mb-6">
                <h2 className="text-3xl font-black text-slate-900 drop-shadow-sm mb-2">
                    Limit Reached
                </h2>
                <p className="text-slate-700 font-medium">
                    Unlock your pet's diagnosis now.
                </p>
            </div>

            <Card className="w-full max-w-sm p-4 overflow-hidden border-2 border-slate-900 shadow-2xl bg-white space-y-3">

                {/* The Upsell (Subscription) - Top Choice */}
                <div
                    onClick={() => handleSelect('subscription')}
                    className="relative block w-full bg-slate-900 rounded-xl p-5 cursor-pointer hover:bg-slate-800 transition-colors active:scale-[0.98] mt-1"
                >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-full shadow-sm whitespace-nowrap uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Best Value
                    </div>

                    <div className="flex justify-between items-center mb-1">
                        <h3 className="text-lg font-bold text-white">CheckPet Unlimited</h3>
                        <span className="text-xl font-black text-white">$9.99<span className="text-xs font-medium text-slate-400">/mo</span></span>
                    </div>
                    <p className="text-xs text-slate-300">
                        Unlimited daily scans & permanent health history. Cancel anytime.
                    </p>

                    <Button
                        className="w-full mt-4 h-12 bg-white text-slate-900 hover:bg-slate-100 font-bold"
                        disabled={loading !== null}
                    >
                        {loading === 'subscription' ? <Loader2 className="h-5 w-5 animate-spin" /> : "Unlock Unlimited"}
                    </Button>
                </div>

                {/* The Panic Button (One-Time) - Bottom Choice */}
                <div
                    onClick={() => handleSelect('emergency_scan')}
                    className="relative block w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-4 cursor-pointer hover:border-slate-300 hover:bg-slate-100 transition-colors active:scale-[0.98]"
                >
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-slate-700" />
                            <h3 className="text-sm font-bold text-slate-800">Single Emergency Scan</h3>
                        </div>
                        <span className="text-lg font-black text-slate-800">$3.99</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                        One-time access to this specific diagnosis. No recurring fees.
                    </p>

                    <Button
                        variant="outline"
                        className="w-full mt-3 h-10 border-slate-300 bg-white hover:bg-slate-50 font-bold text-slate-700"
                        disabled={loading !== null}
                    >
                        {loading === 'emergency_scan' ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buy Emergency Scan"}
                    </Button>
                </div>

            </Card>

            <p className="text-[10px] text-slate-600 text-center mt-6 font-medium max-w-xs">
                Secure checkout provided by Stripe. Access granted instantly.
            </p>

            <div className="mt-8">
                <p className="text-xs text-slate-600 font-medium bg-white/50 px-4 py-2 rounded-full shadow-sm border border-slate-200 backdrop-blur-sm">
                    Already subscribed?{' '}
                    <button
                        onClick={onLogin}
                        className="text-slate-900 font-bold hover:underline transition-all"
                    >
                        Log in here
                    </button>
                </p>
            </div>
        </div>
    );
}
