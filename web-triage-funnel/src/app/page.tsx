'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, Assessment } from '@/lib/api-client';
import { CAT_BREEDS, DOG_BREEDS } from '@/lib/breeds';
import { supabase } from '@/lib/supabaseClient';
import { Camera, Check, Loader2, Lock, Search, ShieldAlert, AlertTriangle, Clipboard } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { ProcessingLoader } from '@/components/ui/processing-loader';
import { AnimatePresence, motion } from "framer-motion";
import { usePostHog } from 'posthog-js/react';

import { History, X, Trash2, ChevronRight, Clock, Shield } from 'lucide-react';
import Link from 'next/link';
import { CommonEmergenciesWidget } from '@/components/home/CommonEmergenciesWidget';
import { MonitoringCard } from '@/components/MonitoringCard';
import { AuthWallOverlay } from '@/components/AuthWallOverlay';
import { PaywallOverlay } from '@/components/PaywallOverlay';
import { LoginModal } from '@/components/LoginModal';

// --- Screen 4: History View ---
function HistoryView({ onClose, onViewResult }: { onClose: () => void, onViewResult: (item: any) => void }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Fetch history from DB on mount
  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const deviceId = localStorage.getItem('pet_triage_device_id') || '';

        let headers: Record<string, string> = {};
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const res = await fetch(`/api/cases/history?deviceId=${deviceId}`, { headers });
        const data = await res.json();

        if (data.history) {
          setHistory(data.history);
        }
      } catch (err) {
        console.error("Failed to load history:", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, []);

  const clearHistoryLocal = () => {
    if (confirm("History is now synced to your account. To completely clear data, please email support.")) {
      // Opt to soft-close for now since actual deletion requires API changes
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 overflow-y-auto animate-in slide-in-from-right duration-300">
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-xl relative">
        {/* Header */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onClose} className="-ml-2">
              <ChevronRight className="h-6 w-6 rotate-180" />
            </Button>
            <h2 className="text-xl font-bold text-slate-900">History</h2>
          </div>
          {history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearHistoryLocal} className="text-red-500 hover:text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* List */}
        <div className="p-4 space-y-4">
          {loadingHistory ? (
            <div className="text-center py-20 flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400 mb-4" />
              <p className="text-slate-500 font-medium">Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <History className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No saved analyses yet.</p>
            </div>
          ) : (
            history.map((item: any) => (
              <Card
                key={item.id}
                className="p-3 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98] overflow-hidden flex gap-3"
                onClick={() => onViewResult(item.result)}
              >
                {/* Image Thumbnail */}
                <div className="w-20 h-20 rounded-lg bg-slate-100 shrink-0 overflow-hidden flex items-center justify-center border border-slate-200/60 shadow-inner">
                  {item.image_url ? (
                    <img src={item.image_url} alt="Pet photo" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-slate-300" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <Badge variant={item.result?.urgency_level === 'CRITICAL' || item.result?.urgency_level === 'URGENT' ? 'destructive' : 'secondary'} className="text-[9px] px-1.5 py-0">
                      {item.result?.urgency_level || 'UNKNOWN'}
                    </Badge>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 font-medium">
                      {item.date} {item.time && `• ${item.time}`}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm mb-1 truncate">
                    {item.result?.causes?.[0]?.condition || "Condition Identified"}
                  </h3>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-tight">
                    {item.result?.primaryRecommendation}
                  </p>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// --- Screen 3: The Result Gate ("Conversion Engine") ---
function TriageResult({
  result,
  imagePreview,
  consultHistory,
  petDetails,
  caseId,
  isAuthLocked = false,
  isPayLocked = false,
  onUnlockAuth,
  onCheckoutPay,
  onLogin
}: {
  result: Assessment,
  imagePreview: string | null,
  consultHistory?: { question: string, answer: string }[],
  petDetails?: any,
  caseId: string | null,
  isAuthLocked?: boolean;
  isPayLocked?: boolean;
  onUnlockAuth?: (email: string) => void;
  onCheckoutPay?: (type: 'emergency_scan' | 'subscription') => void;
  onLogin?: () => void;
}) {
  const isEmergency = result.urgency_level === 'CRITICAL' || result.urgency_level === 'URGENT';
  const primaryCondition = result.causes?.[0]?.condition || "Condition Identified";
  // Confidence: Handle 0-1 (decimal) or 0-100 (percentage)
  const rawProb = result.causes?.[0]?.probability || 0;
  const confidence = rawProb > 1 ? Math.round(rawProb) : Math.round(rawProb * 100);

  // Determine Urgency Display
  const getUrgencyConfig = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'CRITICAL':
      case 'EMERGENCY':
        return { text: 'EMERGENCY DETECTED', color: 'bg-red-600' };
      case 'URGENT':
        return { text: 'URGENT CARE NEEDED', color: 'bg-orange-600' };
      case 'CONSULT':
      case 'VET_VISIT_NEEDED':
        return { text: 'VET VISIT RECOMMENDED', color: 'bg-yellow-500' };
      case 'WATCH':
      case 'MONITOR':
        return { text: 'MONITOR AT HOME', color: 'bg-blue-500' };
      case 'NORMAL':
        return { text: 'NO IMMEDIATE CONCERN', color: 'bg-green-500' };
      default:
        // Fallback for unknown states or null
        return { text: 'VET VISIT RECOMMENDED', color: 'bg-yellow-500' };
    }
  };

  const { text: displayUrgency, color: badgeColor } = getUrgencyConfig(result.urgency_level || '');

  // Waitlist State
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleJoinWaitlist = async () => {
    if (!email || !email.includes('@')) {
      alert("Please enter a valid email.");
      return;
    }
    setSaving(true);
    try {
      let photoUrl = null;

      // 1. Upload Image if exists
      if (imagePreview) {
        const fileExt = 'jpg'; // Simplified for MVP (or detect from base64 prefix)
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        // Convert base64 to Blob
        const base64Response = await fetch(imagePreview);
        const blob = await base64Response.blob();

        const { error: uploadError } = await supabase.storage
          .from('triage-images')
          .upload(filePath, blob);

        if (uploadError) {
          console.error("Upload failed:", uploadError);
          // Continue without photo or alert? keeping going for now.
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('triage-images')
            .getPublicUrl(filePath);
          photoUrl = publicUrl;
        }
      }

      // 2. Save Report to DB
      const { error } = await supabase
        .from('waitlist')
        .insert([{
          email,
          source: 'web_triage_mvp',
          report_data: result,
          photo_url: photoUrl
        }]);

      if (error) throw error;
      setJoined(true);

      // 3. Trigger Email (Send URL instead of base64)
      supabase.functions.invoke('generate-report', {
        body: {
          email,
          report_data: result,
          imageUrl: photoUrl,
          consult_history: consultHistory
        }
      }).then(({ error }) => {
        if (error) console.error("Email trigger failed:", error);
      });

      // Optional: Redirect to App Clip if emergency
      if (isEmergency) {
        const appClipUrl = `https://appclip.apple.com/id?p=com.petapp.mobile.Clip&report_id=${result.id || 'TEMP_ID'}`;
        // For web MVP, maybe just stay on page to show result?
        // User requested "immediately show full results". 
        // We can offer the link as a button instead of forced redirect.
      }
    } catch (e: any) {
      console.error("Waitlist Error:", e);
      alert("Could not join waitlist: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Screen 3: The Result ("Analysis Complete") ---
  if (isEmergency) {
    return (
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl mb-6 shadow-sm">
          <div className="flex items-center mb-2">
            <ShieldAlert className="h-6 w-6 text-red-600 mr-2" />
            <h2 className="text-xl font-bold text-red-700 uppercase tracking-wider">Emergency Alert</h2>
          </div>
          <p className="text-red-900 font-medium">
            Analysis suggests immediate medical attention is required. Do not wait.
          </p>
        </div>

        <ResultCardContent
          result={result}
          primaryCondition={primaryCondition}
          confidence={confidence}
          imagePreview={imagePreview}
          consultHistory={consultHistory}
          isEmergency={true}

          petDetails={petDetails}
          caseId={caseId}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 relative pb-24">
      {/* 1. Status Badge */}
      <div className="flex justify-center mb-6">
        <Badge className={`text-white px-4 py-2 text-sm font-bold shadow-lg uppercase tracking-widest ${badgeColor}`}>
          {displayUrgency}
        </Badge>
      </div>

      {/* Overlays logic for Emergency */}
      {isAuthLocked && onUnlockAuth && (
        <AuthWallOverlay loading={saving} onUnlock={onUnlockAuth} onLogin={onLogin || (() => { })} />
      )}
      {isPayLocked && onCheckoutPay && (
        <PaywallOverlay onCheckout={onCheckoutPay} onLogin={onLogin || (() => { })} />
      )}

      {/* 2. Result Card - Blurred if locked */}
      <div className={`transition-all duration-700 ${isAuthLocked || isPayLocked ? 'blur-md pointer-events-none opacity-60 select-none' : ''}`}>
        <ResultCardContent
          result={result}
          primaryCondition={primaryCondition}
          confidence={confidence}
          imagePreview={imagePreview}
          consultHistory={consultHistory}
          isEmergency={false}
          petDetails={petDetails}
          caseId={caseId}
        />
      </div>
    </div>
  );
}

// Extracted Content Component to reuse for both Emergency/Standard and handle Actions
function ResultCardContent({ result, primaryCondition, confidence, imagePreview, consultHistory, isEmergency, petDetails, caseId }: any) {
  const [saved, setSaved] = useState(false);
  const posthog = usePostHog();

  useEffect(() => {
    posthog?.capture('result_viewed', {
      urgency_level: result.urgency_level,
      primary_condition: primaryCondition,
      confidence: confidence,
    });
  }, [result]);

  const handleSave = () => {
    try {
      const historyItem = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        result,
        imagePreview // Note: Saving base64 to localStorage might exceed quota. Best to save only text or specific URL.
        // For MVP, letting it try, but if it fails, we catch.
      };

      // Simplify image for storage if needed
      if (imagePreview && imagePreview.length > 100000) {
        historyItem.imagePreview = null; // Don't save large images to local storage
      }

      const existing = JSON.parse(localStorage.getItem('pet_triage_history') || '[]');
      localStorage.setItem('pet_triage_history', JSON.stringify([historyItem, ...existing]));
      setSaved(true);
      posthog?.capture('action_save_result', {
        urgency_level: result.urgency_level,
        condition: primaryCondition
      });
    } catch (e) {
      console.error("Save failed", e);
      alert("Could not save to history (Storage Full?)");
    }
  };

  const handleShare = async () => {
    posthog?.capture('action_email_vet', {
      species: petDetails?.species
    });
    const text = `
CheckPet Analysis Report
Date: ${new Date().toLocaleDateString()}

PATIENT DETAILS:
- Species: ${petDetails?.species?.toUpperCase() || 'Unknown'}
- Primary Breed: ${petDetails?.breed || 'Unknown/Mixed'}
- Age: ${petDetails?.age || 'Unknown'}
- Weight: ${petDetails?.weight || 'Unknown'}
- Sex: ${petDetails?.sex || 'Unknown'} ${petDetails?.isFixed ? '(Neutered/Spayed)' : '(Intact)'}


PRIMARY ANALYSIS: ${primaryCondition}
Confidence: ${confidence}%
Urgency: ${result.urgency_level}

OBSERVATIONS:
${result.keyObservations?.map((o: string) => `- ${o}`).join('\n') || 'None'}

REASONING:
${result.refinement_reasoning || 'N/A'}

IMMEDIATE ACTION:
${result.primaryRecommendation}
${result.recommendations?.map((r: string) => `- ${r}`).join('\n') || ''}

CONSULT HISTORY:
${consultHistory?.map((h: any) => `Q: ${h.question}\nA: ${h.answer}`).join('\n') || 'None'}
    `.trim();

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'CheckPet Analysis',
          text: text,
        });
      } catch (err) {
        console.log('Share canceled', err);
      }
    } else {
      // Fallback
      navigator.clipboard.writeText(text);
      alert("Report copied to clipboard!");
    }
  };

  return (
    <>
      <Card className="relative overflow-hidden border-2 border-slate-100 shadow-2xl rounded-3xl bg-white mb-6">
        {/* Header */}
        <div className="p-6 pb-2 text-center bg-white">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">SYMPTOM ANALYSIS REPORT</p>
          <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">
            {primaryCondition}
          </h2>
        </div>



        <div className="p-6 pt-0">
          {/* Confidence */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
              {confidence}% Match Confidence
            </Badge>
          </div>

          {/* safety-override: Check for dangerous secondary causes */}
          {(() => {
            const dangerousSecondary = result.causes?.slice(1).find((c: any) =>
              c.urgency === 'HIGH' || c.urgency === 'EMERGENCY'
            );

            if (dangerousSecondary) {
              return (
                <div className="mx-6 mb-6 bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg shadow-sm animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-start gap-3">
                    <div className="bg-orange-100 p-1.5 rounded-full shrink-0 mt-0.5">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-orange-800 uppercase tracking-wide mb-1">
                        Safety Warning
                      </p>
                      <p className="text-sm text-orange-900 leading-snug">
                        Symptoms also match <span className="font-bold">{dangerousSecondary.condition}</span>. Even if less likely, this is a serious condition that must be ruled out by a vet.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* New: Action Buttons Row (Save / Share) */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Button
              variant="outline"
              className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              onClick={handleSave}
              disabled={saved}
            >
              {saved ? <Check className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
              {saved ? "Saved" : "Save to History"}
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleShare}
            >
              <Clipboard className="mr-2 h-4 w-4" /> {/* Using Clipboard icon as requested */}
              Email Vet
            </Button>
          </div>

          {/* Image */}
          {imagePreview && (
            <div className="mb-6 relative rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-slate-50">
              <img
                src={imagePreview}
                className="w-full h-auto block"
                alt="Analysis Target"
              />
              {/* Annotations Overlay */}
              {result.visualAnnotations?.map((ann: any, i: number) => {
                let [ymin, xmin, ymax, xmax] = ann.coordinates;
                if (ymin > 1 || xmin > 1 || ymax > 1 || xmax > 1) {
                  ymin /= 1000;
                  xmin /= 1000;
                  ymax /= 1000;
                  xmax /= 1000;
                }
                const top = ymin * 100;
                const left = xmin * 100;
                const height = (ymax - ymin) * 100;
                const width = (xmax - xmin) * 100;

                return (
                  <div key={i} className="absolute inset-0 pointer-events-none">
                    <div
                      className="absolute border-4 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.8)] z-50 rounded-lg"
                      style={{ top: `${top}%`, left: `${left}%`, width: `${width}%`, height: `${height}%` }}
                    >
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-full shadow-md whitespace-nowrap uppercase tracking-wider">
                        {ann.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Key Observations */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
            <h4 className="font-bold text-slate-700 text-sm mb-2 uppercase tracking-wide">AI Observations</h4>
            <ul className="space-y-2">
              {result.keyObservations?.map((obs: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>{obs}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* AI Reasoning */}
          {result.refinement_reasoning && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
              <h4 className="font-bold text-slate-700 text-sm mb-2 uppercase tracking-wide">AI Reasoning</h4>
              <p className="text-sm text-slate-600 leading-relaxed italic">
                "{result.refinement_reasoning}"
              </p>
            </div>
          )}

          {/* Immediate Action / First Aid */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
            <h4 className="font-bold text-blue-800 text-sm mb-2 uppercase tracking-wide">First Aid / Next Steps</h4>
            <p className="text-sm text-blue-700 leading-relaxed">
              {result.primaryRecommendation}
            </p>

            {/* Dynamic First Aid Steps */}
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-100/50">
                <p className="text-xs font-bold text-blue-600 mb-1">IMMEDIATE CARE:</p>
                <ul className="list-disc list-inside text-xs text-blue-700/80 space-y-1">
                  {result.recommendations.map((rec: string, i: number) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Monitoring Card Integration */}
          {!isEmergency && (
            <div className="mb-4">
              <MonitoringCard caseId={caseId} />
            </div>
          )}

          {/* Citations / References */}
          {result.citations && result.citations.length > 0 && (
            <div className="mt-6 mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Search className="w-3 h-3" />
                Clinical References
              </p>
              <ul className="space-y-1.5">
                {result.citations.map((cite: string, i: number) => (
                  <li key={i} className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1.5 rounded-md flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                    <span className="truncate">{cite}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </Card>

      {/* Sticky Bottom Actions (Alternative Placement) -> We put them inside the card above for better flow, 
          but if requested at strict "bottom of page", we could keep them fixed. 
          The user said: "At the bottom of the page, I want to create two buttons". 
          Let's replicate the action bar from input page for consistency? 
          Or just keep them in the card flux? Card flux is better for scrolling. 
          Actually let's add a fixed bottom bar for "Start Over" vs "History". 
      */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-xl border-t border-slate-200 z-50">
        <Button
          className="w-full h-12 text-lg font-bold rounded-xl bg-slate-900 text-white"
          onClick={() => window.location.reload()}
        >
          Start New Check
        </Button>
      </div>
    </>
  );
}


// --- Screen 2: The Questions ("Investigation") ---
function QuestionsView({
  questions,
  onComplete,
  loading
}: {
  questions: { id: string; text: string }[];
  onComplete: (answers: Record<string, string>) => void; // Changed to string
  loading: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleAnswer = (val: "Yes" | "No" | "Unsure") => {
    const currentQ = questions[currentIndex];
    const newAnswers = { ...answers, [currentQ.id]: val };
    setAnswers(newAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Finished
      onComplete(newAnswers);
    }
  };

  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="w-full max-w-md animate-in slide-in-from-right duration-500 flex flex-col h-[80vh]">
      {/* Header / Progress */}
      <div className="mb-8 mt-4">
        <div className="flex justify-between items-end mb-2">
          <h2 className="text-xl font-bold text-slate-900">Investigation</h2>
          <span className="text-sm font-semibold text-blue-600">
            Step {currentIndex + 1} of {questions.length}
          </span>
        </div>
        <Progress value={progress} className="h-2 bg-slate-100" />
      </div>

      {/* Question Card */}
      <div className="flex-1 flex flex-col justify-center mb-8">
        <h3 className="text-2xl font-bold text-slate-900 leading-snug mb-8 text-center px-4">
          {questions[currentIndex].text}
        </h3>

        <div className="grid grid-cols-1 gap-3 w-full">
          <Button
            variant="outline"
            className="h-14 text-lg font-bold rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-all"
            onClick={() => handleAnswer("Yes")}
          >
            YES
          </Button>
          <Button
            variant="outline"
            className="h-14 text-lg font-bold rounded-xl border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all"
            onClick={() => handleAnswer("No")}
          >
            NO
          </Button>
          <Button
            variant="ghost"
            className="h-12 text-base font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-xl"
            onClick={() => handleAnswer("Unsure")}
          >
            I'm Not Sure
          </Button>
        </div>
      </div>
    </div>
  );
}


export default function PanicIntake() {
  const posthog = usePostHog();
  const [step, setStep] = useState<'INPUT' | 'QUESTIONS' | 'RESULT'>('INPUT');
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog');
  const [sex, setSex] = useState<'MALE' | 'FEMALE'>('MALE');
  const [isFixed, setIsFixed] = useState(true);
  const [breed, setBreed] = useState('');
  const [isMixed, setIsMixed] = useState(false);
  const [showBreedList, setShowBreedList] = useState(false);
  const [ageBracket, setAgeBracket] = useState<'BABY' | 'YOUNG' | 'ADULT' | 'SENIOR'>('ADULT');
  const [weightBracket, setWeightBracket] = useState<'TOY' | 'SMALL' | 'LARGE' | 'GIANT'>('SMALL');

  const [symptoms, setSymptoms] = useState('');
  const [caseId, setCaseId] = useState<string | null>(null);
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  // State for History View
  const [showHistory, setShowHistory] = useState(false);

  // Tracking States
  const checkRan = useRef<boolean>(false);
  const [scanCount, setScanCount] = useState<number>(0);
  const [isTrackingInitialized, setIsTrackingInitialized] = useState<boolean>(false);
  const [deviceId, setDeviceId] = useState<string>('');
  const [isAuthLocked, setIsAuthLocked] = useState(false);
  const [isPayLocked, setIsPayLocked] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const viewHistoryItem = (savedResult: Assessment) => {
    setResult(savedResult);
    setShowHistory(false);
    setStep('RESULT');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserEmail(null);
    localStorage.removeItem('pet_triage_user_id');
    window.location.href = '/';
  };

  // Tracking API Check
  useEffect(() => {
    let currentDeviceId = localStorage.getItem('pet_triage_device_id');

    // We must use strict UUIDs for Supabase foreign keys
    const isValidUUID = currentDeviceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentDeviceId);

    if (!isValidUUID) {
      currentDeviceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() :
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      localStorage.setItem('pet_triage_device_id', currentDeviceId);
    }
    setDeviceId(currentDeviceId as string);

    const checkLimit = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || localStorage.getItem('pet_triage_user_id');

        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }

        const res = await fetch('/api/tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: currentDeviceId, userId, action: 'check' })
        });
        const data = await res.json();
        console.log("Tracking API returned:", data);

        // If query params have successful stripe session checkout flag, verify it securely
        const urlParams = new URLSearchParams(window.location.search);
        const checkoutStatus = urlParams.get('checkout');
        const sessionId = urlParams.get('session_id');

        if (checkoutStatus === 'success' && sessionId) {
          try {
            const verifyRes = await fetch(`/api/stripe/verify?session_id=${sessionId}`);
            const verifyData = await verifyRes.json();

            if (verifyData.verified) {
              // Mark active locally to prevent flashing before the webhook arrives
              data.paymentStatus = 'active';
              data.needsPay = false;

              // UX: Restore pending result if it exists
              const savedState = localStorage.getItem('pet_triage_pending_result');
              if (savedState) {
                try {
                  const parsed = JSON.parse(savedState);
                  // Only restore if it's relatively fresh (within 30 mins)
                  if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
                    setResult(parsed.result);
                    setImagePreview(parsed.imagePreview);
                    setConsultHistory(parsed.consultHistory || []);
                    setCaseId(parsed.caseId);
                    if (parsed.petDetails) {
                      setSpecies(parsed.petDetails.species);
                      setSex(parsed.petDetails.sex);
                      setIsFixed(parsed.petDetails.isFixed);
                      setBreed(parsed.petDetails.breed);
                      setIsMixed(parsed.petDetails.isMixed);
                      setAgeBracket(parsed.petDetails.ageBracket);
                      setWeightBracket(parsed.petDetails.weightBracket);
                    }
                    setStep('RESULT');
                    // Cleanup
                    localStorage.removeItem('pet_triage_pending_result');
                  }
                } catch (pErr) {
                  console.error("Failed to parse restored state", pErr);
                }
              }
            } else {
              console.warn("Stripe Checkout Session not verified as paid.");
            }
          } catch (vErr) {
            console.error("Error verifying Stripe session:", vErr);
          } finally {
            // Strip the parameter from the URL so future scans don't remain continuously unlocked
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
        }

        // --- MAGIC LINK AUTHENTICATION RESTORATION ---
        const loginStatus = urlParams.get('login');
        if (loginStatus === 'success') {
          try {
            const tokenResponse = await supabase.auth.getSession();
            if (tokenResponse.data.session) {
              const fetchRes = await fetch('/api/cases/restore', {
                headers: { 'Authorization': `Bearer ${tokenResponse.data.session.access_token}` }
              });
              const fetchData = await fetchRes.json();
              if (fetchData.ai_analysis) {
                setResult(fetchData.ai_analysis);
                setCaseId(fetchData.case_id);
                // The backend checks if the user is verified/paid, so we map those locking states here
                setIsAuthLocked(data.needsAuth);
                setIsPayLocked(data.needsPay);
                setStep('RESULT');
              }
            }
          } catch (err) {
            console.error("Failed to restore locked case after login", err);
          } finally {
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
        }

        // --- FALLBACK RESTORATION (Checkout Cancel, Browser Back, or Refresh) ---
        if (checkoutStatus !== 'success' && loginStatus !== 'success') {
          const savedState = localStorage.getItem('pet_triage_pending_result');
          if (savedState) {
            try {
              const parsed = JSON.parse(savedState);
              // Only restore if it's relatively fresh (within 30 mins)
              if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
                setResult(parsed.result);
                setImagePreview(parsed.imagePreview);
                setConsultHistory(parsed.consultHistory || []);
                setCaseId(parsed.caseId);
                if (parsed.petDetails) {
                  setSpecies(parsed.petDetails.species);
                  setSex(parsed.petDetails.sex);
                  setIsFixed(parsed.petDetails.isFixed);
                  setBreed(parsed.petDetails.breed);
                  setIsMixed(parsed.petDetails.isMixed);
                  setAgeBracket(parsed.petDetails.ageBracket);
                  setWeightBracket(parsed.petDetails.weightBracket);
                }

                // Re-apply the live locks from the server
                setIsAuthLocked(data.needsAuth);
                setIsPayLocked(data.needsPay);
                setStep('RESULT');
              } else {
                // Expired
                localStorage.removeItem('pet_triage_pending_result');
              }
            } catch (err) {
              console.error("Failed to parse pending state", err);
              localStorage.removeItem('pet_triage_pending_result');
            }
          }
        }

        setScanCount(data.count || 0);

      } catch (err) {
        console.error("Failed to check tracking limits:", err);
      } finally {
        setIsTrackingInitialized(true);
      }
    };

    if (!checkRan.current) {
      checkRan.current = true;
      checkLimit();
    }
  }, []);

  // --- Scroll to top on step change ---
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // --- Auto-Fill from URL (Page Load) ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qSpecies = params.get('species');
    const qSymptom = params.get('symptom');
    const qDesc = params.get('description');

    if (qSpecies && (qSpecies === 'dog' || qSpecies === 'cat')) {
      setSpecies(qSpecies);
    }

    if (qSymptom && qDesc) {
      // Decode and Format
      setSymptoms(`Potential Issue: ${qSymptom} \n\nDetails: ${qDesc}`);
      setIsAutoFilled(true);
    }
  }, []); // Run once on mount

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'INITIAL' | 'REFINEMENT'>('INITIAL');

  // Results & Questions
  const [result, setResult] = useState<Assessment | null>(null);
  const [pendingAssessment, setPendingAssessment] = useState<Assessment | null>(null);
  const [consultHistory, setConsultHistory] = useState<{ question: string, answer: string }[]>([]);

  const quickChips = ['Vomiting', 'Limping', 'Bleeding', 'Diarrhea', 'Lethargy'];

  const addChip = (chip: string) => {
    setSymptoms((prev) => (prev ? `${prev}, ${chip} ` : chip));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImagePreview(base64String);
        const rawBase64 = base64String.split(',')[1];
        setImageBase64(rawBase64);
        posthog?.capture('photo_uploaded', { has_photo: true });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!symptoms.trim()) return;

    setLoading(true);
    setLoadingType('INITIAL');

    // Ensure loader shows for at least 2 seconds
    const minDelay = new Promise(resolve => setTimeout(resolve, 2000));

    try {
      posthog?.capture('analysis_started', {
        species,
        breed: isMixed ? `Mixed ${breed}` : breed,
        symptom_length: symptoms.length
      });

      const [response] = await Promise.all([
        apiClient.analyzeSymptoms({
          symptom: symptoms,
          imageBase64: imageBase64,
          pet: {
            species,
            sex,
            neutered: isFixed,
            breed: isMixed ? `Mixed ${breed}` : breed,
            age_years: ageBracket === 'BABY' ? 0 : ageBracket === 'YOUNG' ? 1 : ageBracket === 'ADULT' ? 4 : 11,
            age_months: ageBracket === 'BABY' ? 4 : ageBracket === 'YOUNG' ? 0 : 0,
            weight_lbs: weightBracket === 'TOY' ? 8 : weightBracket === 'SMALL' ? 30 : weightBracket === 'LARGE' ? 70 : 110,
            weight_description: weightBracket === 'TOY' ? 'Tiny (<15 lbs)' : weightBracket === 'SMALL' ? 'Med (15-45 lbs)' : 'Big (45+ lbs)',
            is_profile_verified: false,
          }
        }),
        minDelay
      ]);

      // Handle Tracking Increment
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('pet_triage_user_id');
      const trackRes = await fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, userId, action: 'increment' })
      });

      if (!trackRes.ok) {
        throw new Error("Tracking service is temporarily unavailable. Please try again.");
      }

      const trackData = await trackRes.json();

      setScanCount(trackData.count);
      // Wait, if url params had success we assume pay is false for now
      const isSuccess = new URLSearchParams(window.location.search).get('checkout') === 'success';
      const actuallyNeedsPay = isSuccess ? false : trackData.needsPay;

      if (response.verification_questions && response.verification_questions.length > 0) {
        setPendingAssessment(response);
        setStep('QUESTIONS');

        // Pass lock states to the next step so it flows down to RESULT
        setIsAuthLocked(trackData.needsAuth);
        setIsPayLocked(actuallyNeedsPay);
      } else {
        setResult(response);
        setIsAuthLocked(trackData.needsAuth);
        setIsPayLocked(actuallyNeedsPay);
        setStep('RESULT');

        // Background Save: Immediately save case to generate ID for monitoring
        apiClient.saveCase(symptoms, response, {
          deviceId,
          userId: userId || undefined,
          isLocked: trackData.needsAuth || actuallyNeedsPay
        }).then(id => {
          console.log("Case Saved:", id);
          setCaseId(id);
        }).catch(err => console.error("Background Save Failed:", err));
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Analysis failed. Please try again.');
    } finally {
      if (step === 'INPUT') setLoading(false);
    }
  };

  const handleQuestionsComplete = async (answers: Record<string, string>) => {
    if (!pendingAssessment) return;

    // Capture History
    const history = pendingAssessment.verification_questions?.map(q => ({
      question: q.text,
      answer: answers[q.id] // Value is already "Yes" | "No" | "Unsure"
    })) || [];
    setConsultHistory(history);

    posthog?.capture('questions_answered', {
      question_count: history.length
    });

    setLoading(true);
    setLoadingType('REFINEMENT');

    // Ensure loader shows for at least 2 seconds for UX "Thinking" effect
    const minDelay = new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Real Refinement Call
      const [refinedResponse] = await Promise.all([
        apiClient.analyzeSymptoms({
          symptom: symptoms,
          imageBase64: imageBase64,
          refinedSymptoms: [],
          refinementContext: history,
          pet: {
            species,
            sex,
            neutered: isFixed,
            breed: isMixed ? `Mixed ${breed}` : breed,
            age_years: ageBracket === 'BABY' ? 0 : ageBracket === 'YOUNG' ? 1 : ageBracket === 'ADULT' ? 4 : 10,
            age_months: ageBracket === 'BABY' ? 3 : ageBracket === 'YOUNG' ? 0 : 0,
            weight_lbs: weightBracket === 'TOY' ? 5 : weightBracket === 'SMALL' ? 30 : weightBracket === 'LARGE' ? 70 : 110,
            is_profile_verified: false,
          }
        }),
        minDelay
      ]);

      setResult(refinedResponse);
      setStep('RESULT');

      // Background Save: Save refined case
      const currentUserId = localStorage.getItem('pet_triage_user_id') || undefined;
      apiClient.saveCase(symptoms, refinedResponse, {
        deviceId,
        userId: currentUserId,
        isLocked: isAuthLocked || isPayLocked
      }).then(id => {
        console.log("Refined Case Saved:", id);
        setCaseId(id);
      }).catch(err => console.error("Background Save Failed:", err));

    } catch (error) {
      console.error("Refinement failed:", error);
      // Fallback to preliminary result if refinement crashes, but alert user
      alert("Refinement connection failed. Showing preliminary result.");
      setResult(pendingAssessment);
      setStep('RESULT');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockAuth = async (email: string, captchaToken?: string) => {
    setLoading(true);
    try {
      // Use our admin unlock route to bypass email confirmation constraints
      const res = await fetch('/api/auth/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, captchaToken })
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      const newlyFetchedUserId = data.userId;
      console.log("AUTH UNLOCK SUCCESS. Received User ID from API:", newlyFetchedUserId);

      if (newlyFetchedUserId) {
        localStorage.setItem('pet_triage_user_id', newlyFetchedUserId);
        console.log("AUTH UNLOCK SAVED TO LOCAL STORAGE:", localStorage.getItem('pet_triage_user_id'));

        // Merge anonymous device scans into the user's permanent profile
        await fetch('/api/tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, userId: newlyFetchedUserId, action: 'merge' })
        });
      }

      // Optional: add to waitlist
      await supabase.from('waitlist').insert([{ email, source: 'auth_wall' }]);

      setIsAuthLocked(false);
    } catch (err: any) {
      console.error("Auth Wall error", err);
      alert("Auth Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutPay = async (type: 'emergency_scan' | 'subscription') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const localUserId = localStorage.getItem('pet_triage_user_id');
      console.log("CHECKOUT INITIATED. Session User ID:", session?.user?.id, "Local Storage User ID:", localUserId);

      const userId = session?.user?.id || localUserId;

      if (!userId) {
        console.error("CHECKOUT FAILED: Both Session and Local Storage are missing a User ID.");
        alert("Session expired. Please start over.");
        return;
      }

      // UX: Save current state to restore after redirect
      if (result) {
        const pendingState = {
          result,
          imagePreview,
          consultHistory,
          caseId,
          petDetails: {
            species,
            sex,
            isFixed,
            breed,
            isMixed,
            ageBracket,
            weightBracket
          },
          timestamp: Date.now()
        };
        localStorage.setItem('pet_triage_pending_result', JSON.stringify(pendingState));
      }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type })
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Checkout Failed: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Error reaching checkout provider.");
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 pb-24 font-sans">

      {/* Gamified Loader Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
          >
            <ProcessingLoader type={loadingType} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* History View Overlay */}
      {showHistory && (
        <HistoryView onClose={() => setShowHistory(false)} onViewResult={viewHistoryItem} />
      )}

      {/* Login Modal Overlay */}
      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)} />
      )}

      {/* Header - Only on Input Step */}
      {step === 'INPUT' && (
        <>
          {/* Top Navigation Bar */}
          <nav className="w-full h-[60px] flex items-center justify-between px-4 max-w-md mx-auto">
            {/* Left: Logo & Text */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm border border-slate-100">
                <img src="/checkpet-logo.png" alt="CheckPet Logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">CheckPet</span>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1">
              {!userEmail ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 hidden sm:flex bg-slate-100 hover:bg-slate-200 rounded-full px-4 items-center justify-center transition-all"
                  onClick={() => setShowLogin(true)}
                >
                  Log in
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs font-bold text-slate-500 hover:text-red-600 hidden sm:flex bg-slate-100 hover:bg-red-50 hover:border-red-100 rounded-full px-4 items-center justify-center transition-all"
                  onClick={handleLogout}
                >
                  Log out
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full w-10 h-10 transition-all"
                onClick={() => setShowHistory(true)}
              >
                <Clock className="h-5 w-5" />
              </Button>
            </div>
          </nav>

          {/* Hero Section */}
          <div className="text-center mt-4 mb-8 px-4 w-full max-w-md mx-auto">
            {/* Eyebrow Pill */}
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 text-green-800 border border-green-200 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-sm">
                100% Free. Completely Anonymous. No Signup.
              </div>
            </div>

            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tighter leading-tight mb-2">
              Check Your Pet's<br />Symptoms Instantly
            </h1>
            <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-md mx-auto">
              Instant triage assessment grounded in professional veterinary protocols.
            </p>
          </div>
        </>
      )}

      {/* Screen 1: The Input ("Triage Start") */}
      {step === 'INPUT' && (
        <>
          {/* PRIMARY: Symptom & Photo Input */}
          <div className="w-full max-w-md bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-6 space-y-6 relative z-20">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide">1. Describe Problem</h2>
                {isAutoFilled && (
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 gap-1.5 px-2 py-0.5 h-5 text-[10px] border border-blue-200">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    Info Received
                  </Badge>
                )}
              </div>
              <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Required</span>
            </div>

            {/* Symptom Text Input (MOVED TO TOP) */}
            <div className="w-full">
              <Card className={`p-4 border-2 shadow-sm rounded-2xl bg-white min-h-[140px] flex flex-col relative focus-within:ring-2 focus-within:ring-blue-500 transition-all ${isAutoFilled ? 'border-blue-300 ring-4 ring-blue-50/50' : 'border-slate-200'}`}>
                <Textarea
                  placeholder="e.g. Limping on left paw, not eating..."
                  className="flex-1 w-full text-lg p-0 border-0 focus-visible:ring-0 resize-none placeholder:text-slate-300 min-h-[80px]"
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                />

                {/* Quick Chips */}
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                  {quickChips.map((chip) => (
                    <Badge
                      key={chip}
                      variant="secondary"
                      className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 cursor-pointer border border-slate-200 select-none active:scale-95 transition-transform"
                      onClick={() => addChip(chip)}
                    >
                      + {chip}
                    </Badge>
                  ))}
                </div>
              </Card>
              {isAutoFilled && (
                <p className="text-xs text-blue-600 mt-2 px-1 flex items-start gap-1.5 animate-in fade-in slide-in-from-top-1">
                  <span className="text-lg leading-none">ℹ️</span>
                  <span>We've started this for you based on the context. <strong>Please add specific details or a photo</strong> to help the AI.</span>
                </p>
              )}
            </div>

            {/* Photo Upload */}
            <div className="w-full">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="photo-upload-lg"
                onChange={handleImageUpload}
              />
              <label
                htmlFor="photo-upload-lg"
                className={`w-full flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer relative overflow-hidden ${imagePreview ? 'border-none bg-transparent p-0' : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50'}`}
              >
                {imagePreview ? (
                  <div className="relative rounded-2xl overflow-hidden bg-slate-100 border-2 border-blue-500 shadow-sm w-full">
                    <img src={imagePreview} className="w-full h-auto block" />
                    <div className="absolute top-4 right-4 z-10">
                      <div className="bg-white/90 p-2 rounded-full shadow-sm cursor-pointer hover:bg-white transition-colors" onClick={(e) => { e.preventDefault(); /* Allow re-upload via label click */ }}>
                        <Check className="w-5 h-5 text-green-600" />
                      </div>
                    </div>
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10 pointer-events-none">
                      <div className="bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full flex items-center shadow-lg">
                        <span className="text-xs font-bold text-white">Tap to Change</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 text-left w-full px-2">
                    <div className="bg-blue-100 p-3 rounded-full shrink-0">
                      <Camera className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Add Photo (Recommended)</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        AI will scan for visible injuries.
                      </p>
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>


          {/* SECONDARY: Pet Identity Input */}
          <div className="w-full max-w-md bg-slate-50 p-5 rounded-3xl border border-slate-200 shadow-sm mb-32 space-y-6 opacity-90 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide">2. Pet Details</h2>
              {isAutoFilled && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 gap-1.5 px-2 py-0.5 h-5 text-[10px] border border-blue-200">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  Info Received
                </Badge>
              )}
            </div>

            {isAutoFilled && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex gap-3 text-xs text-blue-800">
                <span className="text-lg">ℹ️</span>
                <p>
                  We've pre-selected <strong>{species}</strong> for you. Please complete the remaining details (Breed, Gender, Fixed, Weight, Age) for an accurate assessment.
                </p>
              </div>
            )}

            {/* Row 1: Species (Big Toggles) */}
            <div className="flex mb-3 h-12">
              <Button
                variant="ghost"
                className={`flex-1 rounded-l-xl rounded-r-none border-y border-l border-r-0 text-base font-bold tracking-wide ${species === 'dog' ? 'bg-slate-800 text-white hover:bg-slate-900 hover:text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                onClick={() => setSpecies('dog')}
              >
                DOG
              </Button>
              <div className="w-[1px] bg-slate-200 z-10" />
              <Button
                variant="ghost"
                className={`flex-1 rounded-l-none rounded-r-xl border border-l-0 text-base font-bold tracking-wide ${species === 'cat' ? 'bg-slate-800 text-white hover:bg-slate-900 hover:text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                onClick={() => setSpecies('cat')}
              >
                CAT
              </Button>
            </div>

            {/* Row 2: Sex & Fixed */}
            <div className="flex gap-3 h-10 mb-3">
              <div className="flex-[2] flex rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white">
                <button
                  className={`flex-1 text-xs font-bold transition-all ${sex === 'MALE' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  onClick={() => setSex('MALE')}
                >
                  Male
                </button>
                <div className="w-[1px] bg-slate-200" />
                <button
                  className={`flex-1 text-xs font-bold transition-all ${sex === 'FEMALE' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  onClick={() => setSex('FEMALE')}
                >
                  Female
                </button>
              </div>

              <div className="flex-1 flex rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white">
                <button
                  className={`flex-1 text-xs font-bold transition-all ${!isFixed ? 'bg-slate-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  onClick={() => setIsFixed(false)}
                >
                  Intact
                </button>
                <div className="w-[1px] bg-slate-200" />
                <button
                  className={`flex-1 text-xs font-bold transition-all ${isFixed ? 'bg-slate-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  onClick={() => setIsFixed(true)}
                >
                  Fixed
                </button>
              </div>
            </div>

            {/* Row 3: Breed Selection */}
            <div className="relative mb-3 z-10">
              <div className={`flex items-center bg-white border rounded-xl overflow-hidden transition-all ${showBreedList ? 'ring-2 ring-blue-100 border-blue-400' : 'border-slate-200'}`}>
                <div className="pl-3 text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder={`Search ${species} breed...`}
                  className="flex-1 h-10 px-3 text-sm font-medium outline-none bg-transparent placeholder:text-slate-400"
                  value={breed}
                  onFocus={() => setShowBreedList(true)}
                  onBlur={() => setTimeout(() => setShowBreedList(false), 200)}
                  onChange={(e) => setBreed(e.target.value)}
                />
                <button
                  onClick={() => setIsMixed(!isMixed)}
                  className={`mr-2 px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${isMixed ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                >
                  Mixed?
                </button>
              </div>

              {/* Autocomplete Dropdown */}
              {showBreedList && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 max-h-48 overflow-y-auto no-scrollbar py-1 z-50">
                  {(species === 'dog' ? DOG_BREEDS : CAT_BREEDS)
                    .filter(b => b.toLowerCase().includes(breed.toLowerCase()))
                    .map(b => (
                      <button
                        key={b}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 text-slate-700 font-medium transition-colors"
                        onClick={() => {
                          setBreed(b === 'Other' ? '' : b);
                          setShowBreedList(false);
                        }}
                        onMouseDown={(e) => e.preventDefault()} // Prevent blur
                      >
                        {b}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Row 4: Age & Weight (Side by Side) */}
            <div className="flex gap-3">
              {/* Age Group */}
              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">Age</p>
                <div className="flex rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white">
                  {[
                    { label: 'Baby', val: 'BABY', sub: '<1 yr' },
                    { label: 'Adult', val: 'ADULT', sub: '1-9 yrs' },
                    { label: 'Senior', val: 'SENIOR', sub: '10+ yrs' },
                  ].map((opt) => {
                    const isActive = ageBracket === opt.val;
                    return (
                      <button
                        key={opt.val}
                        onClick={() => setAgeBracket(opt.val as any)}
                        className={`flex-1 h-12 flex flex-col items-center justify-center transition-all border-r border-slate-100 last:border-r-0 ${isActive ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span className="text-[11px] font-bold leading-none mb-0.5">{opt.label}</span>
                        <span className={`text-[9px] font-medium ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>{opt.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Weight Group */}
              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">Weight</p>
                <div className="flex rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white">
                  {[
                    { label: 'Tiny', val: 'TOY', sub: '<15 lbs' },
                    { label: 'Med', val: 'SMALL', sub: '15-45 lbs' },
                    { label: 'Big', val: 'LARGE', sub: '45+ lbs' },
                  ].map((opt) => {
                    const isActive = weightBracket === opt.val;
                    return (
                      <button
                        key={opt.val}
                        onClick={() => setWeightBracket(opt.val as any)}
                        className={`flex-1 h-12 flex flex-col items-center justify-center transition-all border-r border-slate-100 last:border-r-0 ${isActive ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span className="text-[11px] font-bold leading-none mb-0.5">{opt.label}</span>
                        <span className={`text-[9px] font-medium ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>{opt.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Common Emergencies Widget (SEO / Crawl Hub) */}
          <CommonEmergenciesWidget />

          {/* Sticky Action Button & Post-First Scan Status Pill */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-xl border-t border-slate-200 safe-area-pb z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
            <div className="max-w-md mx-auto">

              {/* Dynamic Status Pill for Post-First Scan (State One) */}
              {scanCount === 1 && (
                <div className="flex justify-center mb-3">
                  <div className="bg-slate-100/80 border border-slate-200 text-slate-600 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm backdrop-blur-sm">
                    🐶 1 free scan remaining this month.
                  </div>
                </div>
              )}

              <Button
                size="lg"
                className="w-full h-14 rounded-xl shadow-xl transition-all mb-1 bg-slate-900 hover:bg-black text-white active:scale-95"
                onClick={handleAnalyze}
                disabled={loading || !symptoms.trim()}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    ANALYZING...
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-lg">Analyze Pet Symptom</span>
                  </div>
                )}
              </Button>

              {/* Microscopic Helper Text for State Zero */}
              {(isTrackingInitialized === true && scanCount === 0 && loading === false) && (
                <p className="text-[10px] font-bold text-slate-500 text-center uppercase tracking-widest mt-2 mb-2">
                  100% Free First Scan
                </p>
              )}

              {/* Disclaimer Caption with Shield */}
              <div className="flex items-center justify-center gap-3 px-1 opacity-80 mt-2 w-full mx-auto">
                <Shield className="w-7 h-7 text-slate-300 shrink-0" strokeWidth={1.5} />
                <p className="text-[10px] font-medium text-slate-500 text-left leading-tight mt-1">
                  Analysis references clinical protocols and data from industry-standard veterinary manuals (e.g. Merck Vet Manual) to ensure accuracy.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Screen 2: The Questions ("Investigation") */}
      {
        step === 'QUESTIONS' && pendingAssessment && pendingAssessment.verification_questions && (
          <QuestionsView
            questions={pendingAssessment.verification_questions}
            loading={loading}
            onComplete={handleQuestionsComplete}
          />
        )
      }

      {/* Screen 3: The Result Gate ("Conversion Engine") */}
      {step === 'RESULT' && result && (
        <>
          <TriageResult
            result={result}
            imagePreview={imagePreview}
            consultHistory={consultHistory}
            petDetails={{
              species,
              breed: isMixed ? `Mixed ${breed}` : breed,
              sex,
              isFixed,
              age: ageBracket,
              weight: weightBracket
            }}
            caseId={caseId}
            isAuthLocked={isAuthLocked}
            isPayLocked={isPayLocked}
            onUnlockAuth={handleUnlockAuth}
            onCheckoutPay={handleCheckoutPay}
            onLogin={() => setShowLogin(true)}
          />
        </>
      )}
    </div >
  );
}
