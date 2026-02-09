'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { Assessment } from '@/lib/api-client';

interface ClarifyingQuestionsModalProps {
  isOpen: boolean;
  questions: NonNullable<Assessment['verification_questions']>;
  onSubmit: (answers: Record<string, boolean>) => void;
  loading: boolean;
}

export function ClarifyingQuestionsModal({ isOpen, questions, onSubmit, loading }: ClarifyingQuestionsModalProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleValueChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const isComplete = questions.every(q => answers[q.id]);

  const handleSubmit = () => {
    // Convert 'yes'/'no' strings to booleans
    const booleanAnswers: Record<string, boolean> = {};
    Object.keys(answers).forEach(key => {
        booleanAnswers[key] = answers[key] === 'yes';
    });
    onSubmit(booleanAnswers);
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>We need a few more details</DialogTitle>
          <DialogDescription>
            Help us rule out critical conditions by answering these quick questions.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-6 py-4">
          {questions.map((q) => (
            <div key={q.id} className="space-y-3">
              <Label className="text-base font-semibold text-slate-900">
                {q.text}
              </Label>
              <RadioGroup 
                value={answers[q.id]} 
                onValueChange={(val) => handleValueChange(q.id, val)}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id={`${q.id}-yes`} />
                  <Label htmlFor={`${q.id}-yes`} className="font-normal text-slate-700">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id={`${q.id}-no`} />
                  <Label htmlFor={`${q.id}-no`} className="font-normal text-slate-700">No</Label>
                </div>
              </RadioGroup>
            </div>
          ))}
        </div>

        <Button 
            onClick={handleSubmit} 
            disabled={!isComplete || loading}
            className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700"
        >
            {loading ? (
                <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Checking...
                </div>
            ) : (
                "Update Analysis"
            )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
