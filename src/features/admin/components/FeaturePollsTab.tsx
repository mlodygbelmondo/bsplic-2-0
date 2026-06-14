import { useEffect, useMemo, useState } from 'react';
import { ListPlus, Plus, Power, Trash2, Vote } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { createDefaultFeaturePollForm } from '@/features/feature-polls/constants';
import {
  getFeaturePollAdminStatus,
  validateFeaturePollForm,
} from '@/features/feature-polls/poll-availability';
import {
  createFeaturePoll,
  deactivateFeaturePoll,
  fetchAdminFeaturePolls,
} from '@/features/feature-polls/feature-poll-api';
import type { AdminFeaturePoll } from '@/features/feature-polls/types';

const STATUS_LABELS = {
  active: 'Aktywna',
  expired: 'Zakończone',
  disabled: 'Wyłączone',
} as const;

const STATUS_CLASSES = {
  active: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-muted text-muted-foreground',
  disabled: 'bg-amber-100 text-amber-900',
} as const;

const getPercentage = (count: number, total: number) =>
  total > 0 ? Math.round((count / total) * 100) : 0;

export default function FeaturePollsTab() {
  const [polls, setPolls] = useState<AdminFeaturePoll[]>([]);
  const [form, setForm] = useState(() => createDefaultFeaturePollForm());
  const [creating, setCreating] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const fetchPolls = async () => {
    try {
      setPolls(await fetchAdminFeaturePolls());
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Nie udało się pobrać głosowań'));
    }
  };

  useEffect(() => {
    void fetchPolls();
  }, []);

  const sortedPolls = useMemo(
    () =>
      [...polls].sort(
        (left, right) =>
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime(),
      ),
    [polls],
  );

  const updateOption = (index: number, value: string) => {
    setForm((previous) => {
      const options = [...previous.options];
      options[index] = value;
      return { ...previous, options };
    });
  };

  const addOption = () => {
    setForm((previous) => ({
      ...previous,
      options: [...previous.options, ''],
    }));
  };

  const removeOption = (index: number) => {
    setForm((previous) => ({
      ...previous,
      options: previous.options.filter((_, optionIndex) => optionIndex !== index),
    }));
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    const validationError = validateFeaturePollForm(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setCreating(true);
    try {
      await createFeaturePoll(form);
      toast.success('Głosowanie utworzone');
      setForm(createDefaultFeaturePollForm());
      await fetchPolls();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Nie udało się utworzyć głosowania'));
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (pollId: string) => {
    setDeactivatingId(pollId);
    try {
      await deactivateFeaturePoll(pollId);
      toast.success('Głosowanie wyłączone');
      await fetchPolls();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Nie udało się wyłączyć głosowania'));
    } finally {
      setDeactivatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-xl bg-card p-4 card-shadow sm:p-6"
      >
        <div className="flex items-center gap-2">
          <Vote className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Nowe głosowanie</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 md:col-span-2">
            <p className="text-sm font-semibold">Treści okna głosowania</p>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="feature-poll-title-enabled"
                  checked={form.titleEnabled}
                  onCheckedChange={(checked) =>
                    setForm((previous) => ({
                      ...previous,
                      titleEnabled: checked === true,
                    }))
                  }
                />
                <Label
                  htmlFor="feature-poll-title-enabled"
                  className="cursor-pointer text-sm"
                >
                  Pokaż nagłówek
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="feature-poll-title">Nagłówek</Label>
                <Input
                  id="feature-poll-title"
                  value={form.title}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      title: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="feature-poll-description-enabled"
                  checked={form.descriptionEnabled}
                  onCheckedChange={(checked) =>
                    setForm((previous) => ({
                      ...previous,
                      descriptionEnabled: checked === true,
                    }))
                  }
                />
                <Label
                  htmlFor="feature-poll-description-enabled"
                  className="cursor-pointer text-sm"
                >
                  Pokaż opis
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="feature-poll-description">Opis</Label>
                <Textarea
                  id="feature-poll-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                  rows={2}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="feature-poll-question-enabled"
                  checked={form.questionEnabled}
                  onCheckedChange={(checked) =>
                    setForm((previous) => ({
                      ...previous,
                      questionEnabled: checked === true,
                    }))
                  }
                />
                <Label
                  htmlFor="feature-poll-question-enabled"
                  className="cursor-pointer text-sm"
                >
                  Pokaż pytanie
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="feature-poll-question">Pytanie</Label>
                <Textarea
                  id="feature-poll-question"
                  value={form.question}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      question: event.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div
            className="space-y-2 md:col-span-2"
            data-testid="feature-poll-options"
          >
            <div className="flex items-center justify-between gap-3">
              <Label>Opcje odpowiedzi</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Dodaj
              </Button>
            </div>
            <div className="space-y-2">
              {form.options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    aria-label={`Opcja ${index + 1}`}
                    value={option}
                    onChange={(event) => updateOption(index, event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(index)}
                    disabled={form.options.length <= 2}
                    aria-label="Usuń opcję"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border p-3 md:col-span-2">
            <Checkbox
              id="feature-poll-allow-other"
              checked={form.allowOther}
              onCheckedChange={(checked) =>
                setForm((previous) => ({
                  ...previous,
                  allowOther: checked === true,
                }))
              }
            />
            <Label
              htmlFor="feature-poll-allow-other"
              className="cursor-pointer text-sm"
            >
              Pozwól na odpowiedź Inne
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feature-poll-expires-at">Zakończenie</Label>
            <Input
              id="feature-poll-expires-at"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  expiresAt: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <Button type="submit" disabled={creating} className="w-full sm:w-auto">
          <ListPlus className="mr-1.5 h-4 w-4" />
          {creating ? 'Tworzenie...' : 'Utwórz głosowanie'}
        </Button>
      </form>

      <div className="space-y-3">
        <h3 className="text-base font-semibold">Głosowania</h3>

        {sortedPolls.length === 0 ? (
          <div className="rounded-xl bg-card p-6 text-sm text-muted-foreground card-shadow">
            Brak głosowań.
          </div>
        ) : (
          sortedPolls.map((poll) => {
            const status = getFeaturePollAdminStatus(poll);

            return (
              <div
                key={poll.id}
                className="space-y-4 rounded-xl bg-card p-4 card-shadow sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-semibold">
                        {poll.question}
                      </h4>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          STATUS_CLASSES[status],
                        )}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    </div>
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground">Zakończenie</p>
                        <p className="font-medium">
                          {new Date(poll.expires_at).toLocaleString('pl-PL')}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Głosy</p>
                        <p className="font-semibold">{poll.total_votes}</p>
                      </div>
                    </div>
                  </div>

                  {poll.is_active ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => void handleDeactivate(poll.id)}
                      disabled={deactivatingId === poll.id}
                    >
                      <Power className="mr-1.5 h-4 w-4" />
                      {deactivatingId === poll.id ? 'Wyłączanie...' : 'Wyłącz'}
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-3">
                  {poll.options.map((option) => {
                    const percentage = getPercentage(
                      option.vote_count,
                      poll.total_votes,
                    );

                    return (
                      <div key={option.id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium">{option.label}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {option.vote_count} / {percentage}%
                          </span>
                        </div>
                        <Progress value={percentage} />
                      </div>
                    );
                  })}
                </div>

                {poll.other_responses.length > 0 ? (
                  <div className="rounded-lg border p-3">
                    <p className="mb-2 text-sm font-semibold">
                      Odpowiedzi Inne
                    </p>
                    <div className="space-y-2">
                      {poll.other_responses.map((response, index) => (
                        <p
                          key={`${response}-${index}`}
                          className="rounded-md bg-muted px-3 py-2 text-sm"
                        >
                          {response}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
