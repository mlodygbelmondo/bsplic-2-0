import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Vote } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import {
  fetchAvailableFeaturePoll,
  submitFeaturePollVote,
} from '../feature-poll-api';
import type { AvailableFeaturePoll } from '../types';

const OTHER_VALUE = '__other__';

export function FeaturePollSurface() {
  const { user, profile, loading } = useAuth();
  const [poll, setPoll] = useState<AvailableFeaturePoll | null>(null);
  const [selectedValue, setSelectedValue] = useState('');
  const [otherText, setOtherText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingPoll, setLoadingPoll] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadPoll = useCallback(async () => {
    if (!user || !profile) {
      setPoll(null);
      return;
    }

    setLoadingPoll(true);
    try {
      setPoll(await fetchAvailableFeaturePoll());
    } catch (error: unknown) {
      toast.error(
        getErrorMessage(error, 'Nie udało się sprawdzić głosowań'),
      );
      setPoll(null);
    } finally {
      setLoadingPoll(false);
    }
  }, [profile, user]);

  useEffect(() => {
    if (loading || !user || !profile) {
      return;
    }

    void loadPoll();
  }, [loadPoll, loading, profile, user]);

  const validateSelection = () => {
    if (!selectedValue) {
      return 'Wybierz odpowiedź';
    }

    if (selectedValue === OTHER_VALUE && !otherText.trim()) {
      return 'Wpisz swoją propozycję';
    }

    return null;
  };

  const handleSubmit = async () => {
    if (!poll || submitting) {
      return;
    }

    const validationError = validateSelection();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await submitFeaturePollVote({
        pollId: poll.id,
        optionId: selectedValue === OTHER_VALUE ? null : selectedValue,
        otherText: selectedValue === OTHER_VALUE ? otherText.trim() : null,
      });
      toast.success('Dziękujemy za głos');
      setPoll(null);
      setSelectedValue('');
      setOtherText('');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Nie udało się zapisać głosu'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || !profile || !poll) {
    return null;
  }

  const showTitle = poll.title_enabled !== false;
  const showDescription = poll.description_enabled !== false;
  const showQuestion = poll.question_enabled !== false;
  const title = poll.title || 'Głosowanie';
  const description =
    poll.description || 'Odpowiedz na jedno pytanie, żeby kontynuować.';

  return (
    <AnimatePresence>
      <Dialog open>
        <DialogContent
          className={cn('max-w-[30rem] gap-0 overflow-hidden p-0 shadow-2xl')}
          hideCloseButton
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5 p-5 sm:p-6"
          >
            <DialogHeader className="space-y-2 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Vote className="h-5 w-5" />
              </div>
              {showTitle ? (
                <DialogTitle>{title}</DialogTitle>
              ) : (
                <DialogTitle className="sr-only">Głosowanie</DialogTitle>
              )}
              {showDescription ? (
                <DialogDescription>{description}</DialogDescription>
              ) : (
                <DialogDescription className="sr-only">
                  Opis głosowania
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-4">
              {showQuestion ? (
                <p className="text-base font-semibold leading-snug">
                  {poll.question}
                </p>
              ) : null}

              <RadioGroup
                value={selectedValue}
                onValueChange={(value) => {
                  setSelectedValue(value);
                  setFormError(null);
                }}
                className="gap-2"
              >
                {poll.options.map((option) => (
                  <Label
                    key={option.id}
                    htmlFor={`feature-poll-option-${option.id}`}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors',
                      selectedValue === option.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/60',
                    )}
                  >
                    <RadioGroupItem
                      id={`feature-poll-option-${option.id}`}
                      value={option.id}
                    />
                    <span>{option.label}</span>
                  </Label>
                ))}

                {poll.allow_other ? (
                  <Label
                    htmlFor="feature-poll-option-other"
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors',
                      selectedValue === OTHER_VALUE
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/60',
                    )}
                  >
                    <RadioGroupItem
                      id="feature-poll-option-other"
                      value={OTHER_VALUE}
                    />
                    <span>Inne</span>
                  </Label>
                ) : null}
              </RadioGroup>

              <AnimatePresence initial={false}>
                {selectedValue === OTHER_VALUE ? (
                  <motion.div
                    key="feature-poll-other-panel"
                    data-testid="feature-poll-other-panel"
                    initial={{ height: 0, opacity: 0, y: -4 }}
                    animate={{ height: 'auto', opacity: 1, y: 0 }}
                    exit={{ height: 0, opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 pt-1">
                      <Label htmlFor="feature-poll-other-text">
                        Twoja propozycja
                      </Label>
                      <Textarea
                        id="feature-poll-other-text"
                        value={otherText}
                        onChange={(event) => {
                          setOtherText(event.target.value);
                          setFormError(null);
                        }}
                        rows={3}
                      />
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {formError ? (
                <p className="text-sm font-medium text-destructive">
                  {formError}
                </p>
              ) : null}

              <Button
                type="button"
                className="h-11 w-full"
                onClick={() => void handleSubmit()}
                disabled={submitting || loadingPoll}
              >
                {submitting ? 'Zapisywanie...' : 'Oddaj głos'}
              </Button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </AnimatePresence>
  );
}
