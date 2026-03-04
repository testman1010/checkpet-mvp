import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mail, Loader2, Lock } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';

export function AuthWallOverlay({
    onUnlock,
    onLogin,
    loading
}: {
    onUnlock: (email: string, captchaToken?: string) => void;
    onLogin: () => void;
    loading: boolean;
}) {
    const [email, setEmail] = useState('');
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email.includes('@') && captchaToken) {
            onUnlock(email, captchaToken);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/40 backdrop-blur-md animate-in fade-in duration-500">
            <Card className="w-full max-w-sm p-6 shadow-2xl border-2 border-blue-100 bg-white">
                <div className="flex justify-center mb-4">
                    <div className="bg-blue-100 p-3 rounded-full shrink-0">
                        <Lock className="w-8 h-8 text-blue-600" />
                    </div>
                </div>

                <h3 className="text-xl font-extrabold text-slate-900 text-center mb-2 leading-tight">
                    Your Results Are Ready
                </h3>

                <p className="text-sm font-medium text-slate-500 text-center mb-6 leading-relaxed">
                    Enter your email to save your scan history and unlock your second free scan. We&apos;ll send a copy of the report right to your inbox.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <Mail className="h-5 w-5" />
                        </div>
                        <input
                            type="email"
                            placeholder="Enter your email..."
                            className="w-full h-12 pl-10 pr-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-0 text-sm font-medium outline-none transition-all"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="flex justify-center my-2">
                        <Turnstile
                            siteKey="0x4AAAAAACh2gqH8DpeEoJ-x"
                            onSuccess={(token) => setCaptchaToken(token)}
                            options={{ theme: 'light' }}
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={loading || !email.includes('@') || !captchaToken}
                        className="w-full h-14 text-lg font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg active:scale-95 transition-all"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                UNLOCKING...
                            </div>
                        ) : (
                            "Unlock Diagnosis"
                        )}
                    </Button>
                </form>

                <p className="text-[10px] text-slate-400 text-center mt-4">
                    By unlocking, you agree to our Terms of Service and Privacy Policy. No spam, ever.
                </p>

                <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                    <p className="text-xs text-slate-500 font-medium">
                        Already have an account?{' '}
                        <button
                            onClick={onLogin}
                            className="text-blue-600 hover:text-blue-700 font-bold hover:underline transition-all"
                        >
                            Log in securely
                        </button>
                    </p>
                </div>
            </Card>
        </div>
    );
}
