import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock, FileText, Eye, Database } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function PrivacyPage() {
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
                    <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Privacy Policy</h1>
                    <p className="text-lg text-slate-600">Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                </div>

                {/* Content */}
                <div className="space-y-8">

                    {/* Intro Card */}
                    <Card className="p-8 border-slate-200 bg-white rounded-2xl shadow-sm">
                        <div className="flex gap-4">
                            <div className="shrink-0 mt-1">
                                <Lock className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 mb-2">Your Privacy Matters</h2>
                                <p className="text-slate-600 leading-relaxed">
                                    At CheckPet, we take your privacy seriously. This policy explains how we collect, use, and protect the information you provide when using our AI triage tool.
                                </p>
                            </div>
                        </div>
                    </Card>

                    <div className="grid gap-8">
                        <section className="space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <FileText className="w-5 h-5 text-slate-400" />
                                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">1. Information We Collect</h2>
                            </div>
                            <ul className="list-disc list-inside space-y-2 text-slate-600 ml-1">
                                <li><strong>Symptom Data:</strong> The descriptions, species, and other details you enter about your pet's condition.</li>
                                <li><strong>Images:</strong> Photos you upload for analysis by our AI system.</li>
                                <li><strong>Usage Data:</strong> Anonymous metrics on how you interact with our site to help us improve performance.</li>
                            </ul>
                        </section>

                        <section className="space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Database className="w-5 h-5 text-slate-400" />
                                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">2. How We Use Your Data</h2>
                            </div>
                            <p className="text-slate-600 leading-relaxed">
                                We use the information solely to generate the immediate symptom analysis report. Your data is processed by our secure AI partners to provide the service. We may store anonymized data to refine our algorithms and improve the accuracy of future assessments.
                            </p>
                        </section>

                        <section className="space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Eye className="w-5 h-5 text-slate-400" />
                                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">3. Third-Party Sharing</h2>
                            </div>
                            <p className="text-slate-600 leading-relaxed">
                                We do not sell your personal information. We share necessary data with trusted third-party AI providers (such as Google Gemini) strictly for the purpose of generating the analysis. These providers are bound by data privacy agreements suited for enterprise and safe processing.
                            </p>
                            <p className="text-slate-600 leading-relaxed">
                                No mobile information will be shared with third parties/affiliates for marketing/promotional purposes.
                            </p>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">4. Data Security</h2>
                            <p className="text-slate-600 leading-relaxed">
                                We implement industry-standard security measures to protect your data during transmission and storage. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
                            </p>
                        </section>
                    </div>

                    <div className="text-center pt-8 text-slate-400 text-xs">
                        <p>© {new Date().getFullYear()} CheckPet. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
