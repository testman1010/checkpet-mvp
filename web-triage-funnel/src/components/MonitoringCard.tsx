
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { MessageCircle, CheckCircle, Loader2, ShieldCheck } from 'lucide-react';

interface MonitoringCardProps {
    caseId: string | null;
}

export function MonitoringCard({ caseId }: MonitoringCardProps) {
    const [phone, setPhone] = useState('');
    const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!caseId) return;

        setStatus('LOADING');
        setErrorMessage('');

        try {
            await apiClient.activateMonitoring(caseId, phone);
            setStatus('SUCCESS');
        } catch (error: any) {
            console.error("Monitoring Activation Failed:", error);
            setStatus('ERROR');
            setErrorMessage(error.message || "Failed to activate. Please try again.");
        }
    };

    if (status === 'SUCCESS') {
        return (
            <Card className="bg-teal-50 border-teal-200 p-6 rounded-2xl shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <div className="flex flex-col items-center text-center">
                    <div className="bg-teal-100 p-3 rounded-full mb-3">
                        <CheckCircle className="h-8 w-8 text-teal-600" />
                    </div>
                    <h3 className="text-lg font-bold text-teal-900 mb-1">Active Monitoring Enabled</h3>
                    <p className="text-teal-700 text-sm mb-4">
                        We will check on your pet via SMS in 2 hours to ensure they are improving.
                    </p>
                    <div className="text-xs text-teal-600 bg-teal-100/50 px-3 py-1 rounded-full font-medium">
                        Look for a text from CheckPet
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-blue-100 p-6 rounded-2xl shadow-sm mb-6">
            <div className="flex items-start gap-4 mb-4">
                <div className="bg-white p-2.5 rounded-xl shadow-sm shrink-0">
                    <MessageCircle className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight mb-1">
                        Worried this might change?
                    </h3>
                    <p className="text-sm text-slate-600">
                        We can check on your pet again in 2 hours to make sure they're okay.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                    <Input
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="bg-white border-slate-200 h-12 text-lg"
                        required
                        disabled={!caseId || status === 'LOADING'}
                    />
                    {errorMessage && <p className="text-xs text-red-500 pl-1">{errorMessage}</p>}
                </div>

                <Button
                    type="submit"
                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-md hover:shadow-lg transition-all"
                    disabled={!caseId || status === 'LOADING' || phone.length < 10}
                >
                    {status === 'LOADING' ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Activating...
                        </>
                    ) : (
                        <>
                            <ShieldCheck className="mr-2 h-5 w-5" />
                            Monitor My Pet
                        </>
                    )}
                </Button>

                <p className="text-[10px] text-center text-slate-400">
                    One-time automated check-in. No spam. Data expires in 24h.
                </p>
            </form>
        </Card>
    );
}
