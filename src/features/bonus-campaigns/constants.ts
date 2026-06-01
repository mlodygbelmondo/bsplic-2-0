import { getTodayAt2359, toInputDateTime } from '@/lib/date-input';

export const createDefaultBonusCampaignForm = (now: Date = new Date()) => ({
  title: '',
  description: '',
  amount: '',
  startsAt: toInputDateTime(now),
  expiresAt: toInputDateTime(getTodayAt2359(now)),
});
