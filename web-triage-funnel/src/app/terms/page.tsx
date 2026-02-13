import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert, Scale, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center font-sans text-slate-900">
            <div className="w-full max-w-3xl">
                {/* Back Button */}
                <div className="mb-8">
                    <Link href="/">
                        <Button variant="ghost" className="gap-2 text-slate-600 hover:text-slate-900 pl-0 hover:bg-transparent">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Triage
                        </Button>
                    </Link>
                </div>

                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Terms of Service</h1>
                    <p className="text-lg text-slate-600">Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                </div>

                {/* Content */}
                <div className="space-y-8">

                    {/* CRITICAL DISCLAIMER */}
                    <Card className="p-8 border-red-200 bg-red-50/50 rounded-2xl shadow-sm">
                        <div className="flex gap-4">
                            <div className="shrink-0 mt-1">
                                <ShieldAlert className="w-6 h-6 text-red-600" />
                            </div>
                            <div className="space-y-3">
                                <h2 className="text-xl font-bold text-red-900">1. NO VETERINARY ADVICE</h2>
                                <p className="text-red-800 leading-relaxed font-medium">
                                    CheckPet is an automated information tool powered by artificial intelligence. <strong>It isn't a substitute for professional veterinary care.</strong>
                                </p>
                                <p className="text-red-800/90 text-sm leading-relaxed">
                                    We do not provide medical diagnoses, treatments, or prescriptions. No veterinarian-client-patient relationship is established by your use of this site. <strong>Never disregard professional veterinary advice or delay in seeking it because of something you have read on this website.</strong> In a medical emergency, you must contact your local veterinarian or an emergency animal hospital immediately.
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-8 border-slate-200 bg-white rounded-2xl shadow-sm space-y-8">
                        <section className="space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Scale className="w-5 h-5 text-slate-400" />
                                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">2. Acceptance of Terms</h2>
                            </div>
                            <p className="text-slate-600 leading-relaxed">
                                By accessing or using CheckPet ("the Service"), you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the Service.
                            </p>
                        </section>

                        <section className="space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <ScrollText className="w-5 h-5 text-slate-400" />
                                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">3. Use of AI Technology</h2>
                            </div>
                            <p className="text-slate-600 leading-relaxed">
                                You acknowledge that the Service uses artificial intelligence (AI) to analyze data. AI systems can hallucinate, make errors, or provide incomplete information. The output is based on probability and patterns, not clinical judgment. You agree not to rely solely on the Service for decisions affecting the health or safety of your pet.
                            </p>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">4. Limitation of Liability</h2>
                            <p className="text-slate-600 leading-relaxed uppercase text-xs font-bold tracking-wider text-slate-500 mb-2">Read Carefully</p>
                            <p className="text-slate-600 leading-relaxed">
                                To the maximum extent permitted by law, CheckPet and its creators, affiliates, and partners shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use, or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or not we have been informed of the possibility of such damage.
                            </p>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">5. Disclaimer of Warranties</h2>
                            <p className="text-slate-600 leading-relaxed">
                                Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" basis. The Service is provided without warranties of any kind, whether express or implied, including, but not limited to, implied warranties of merchantability, fitness for a particular purpose, non-infringement, or course of performance.
                            </p>
                        </section>
                    </Card>

                    <div className="text-center pt-8 text-slate-400 text-xs">
                        <p>© {new Date().getFullYear()} CheckPet. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
