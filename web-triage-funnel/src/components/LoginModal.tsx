import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mail, Loader2, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Turnstile } from '@marsidev/react-turnstile';

export function LoginModal({
    onClose
}: {
    onClose: () => void;
}) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        try {
            const redirectUrl = typeof window !== 'undefined'
                ? `${window.location.origin}/?login=success`
                : 'http://localhost:3000/?login=success';

            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: redirectUrl,
                    captchaToken: captchaToken || undefined,
                },
            });

            if (error) {
                setErrorMsg(error.message);
            } else {
                setSuccess(true);
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <Card className="w-full max-w-sm p-6 shadow-2xl bg-white relative">

                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full"
                    onClick={onClose}
                >
                    <X className="h-5 w-5" />
                </Button>

                {success ? (
                    <div className="text-center py-6 animate-in zoom-in-95 duration-300">
                        <div className="flex justify-center mb-4">
                            <div className="bg-green-100 p-3 rounded-full shrink-0">
                                <CheckCircle2 className="w-10 h-10 text-green-600" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Check Your Email</h3>
                        <p className="text-sm font-medium text-slate-500">
                            We sent a secure login link to <strong className="text-slate-700">{email}</strong>.
                            Click it to instantly unlock your account on this device.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-black text-slate-900 mb-1">Welcome Back</h2>
                            <p className="text-sm font-medium text-slate-500">
                                Enter your email to securely log in. No password required.
                            </p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <Mail className="h-5 w-5" />
                                </div>
                                <input
                                    type="email"
                                    placeholder="Enter your email address"
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

                            {errorMsg && (
                                <p className="text-xs font-semibold text-red-500 text-center animate-in slide-in-from-top-1">
                                    {errorMsg}
                                </p>
                            )}

                            <Button
                                type="submit"
                                disabled={loading || !email.includes('@') || !captchaToken}
                                className="w-full h-12 text-md font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-md active:scale-[0.98] transition-all"
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Sending Link...
                                    </div>
                                ) : (
                                    "Send Magic Link"
                                )}
                            </Button>
                        </form>
                    </>
                )}
            </Card>
        </div>
    );
}
