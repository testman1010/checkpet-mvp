import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Brain, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
            <div className="w-full max-w-2xl">
                {/* Back Button */}
                <div className="mb-8">
                    <Link href="/">
                        <Button variant="ghost" className="gap-2 text-slate-600 hover:text-slate-900">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Triage
                        </Button>
                    </Link>
                </div>

                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">About CheckPet</h1>
                    <p className="text-lg text-slate-600">Empowering pet parents with instant, AI-driven symptom analysis.</p>
                </div>

                {/* Main Content */}
                <div className="space-y-6">

                    {/* Mission Card */}
                    <Card className="p-8 border-slate-200 shadow-sm bg-white rounded-2xl">
                        <div className="flex items-start gap-4">
                            <div className="bg-blue-100 p-3 rounded-full shrink-0">
                                <Brain className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 mb-2">How It Works</h2>
                                <p className="text-slate-600 leading-relaxed">
                                    CheckPet utilizes advanced artificial intelligence to analyze your pet's symptoms against thousands of veterinary protocols, including the Merck Veterinary Manual. We look for patterns that match common conditions to help you decide if you need to see a vet immediately or if it can wait.
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Legal Disclaimer Card - CRITICAL */}
                    <Card className="p-8 border-orange-200 shadow-sm bg-orange-50/50 rounded-2xl">
                        <div className="flex items-start gap-4">
                            <div className="bg-orange-100 p-3 rounded-full shrink-0">
                                <AlertTriangle className="w-6 h-6 text-orange-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 mb-2">Important Disclaimer</h2>
                                <p className="text-slate-700 leading-relaxed font-medium">
                                    CheckPet is an informational tool, not a veterinary diagnostic service.
                                </p>
                                <ul className="mt-4 space-y-2 text-sm text-slate-600 list-disc list-inside">
                                    <li>We do <strong>not</strong> provide medical diagnoses or prescriptions.</li>
                                    <li>Our analysis is based on the information you provide and may not capture the full clinical picture.</li>
                                    <li><strong>In a medical emergency, do not use this tool. Contact your local veterinary clinic or emergency hospital immediately.</strong></li>
                                </ul>
                            </div>
                        </div>
                    </Card>

                    {/* Trust/Privacy */}
                    <Card className="p-8 border-slate-200 shadow-sm bg-white rounded-2xl">
                        <div className="flex items-start gap-4">
                            <div className="bg-green-100 p-3 rounded-full shrink-0">
                                <ShieldCheck className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 mb-2">Privacy & Protocol</h2>
                                <p className="text-slate-600 leading-relaxed">
                                    We prioritize your pet's health and your privacy. Your data is analyzed securely and is used solely to generate your symptom report. We do not sell your personal information.
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Branding Note */}
                    <div className="text-center pt-8 text-slate-400 text-sm">
                        <p>© {new Date().getFullYear()} CheckPet. All rights reserved.</p>
                        <p className="mt-1">CheckPet - AI Pet Symptom Analysis</p>
                    </div>

                </div>
            </div>
        </div>
    );
}
