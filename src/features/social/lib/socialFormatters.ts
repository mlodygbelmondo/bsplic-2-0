interface PolishPluralForms {
  one: string;
  few: string;
  many: string;
}

export function polishPlural(count: number, forms: PolishPluralForms) {
  if (count === 1) return forms.one;
  const lastTwoDigits = count % 100;
  if (lastTwoDigits >= 12 && lastTwoDigits <= 14) return forms.many;
  const lastDigit = count % 10;
  if (lastDigit >= 2 && lastDigit <= 4) return forms.few;
  return forms.many;
}

export function formatCommentCount(count: number) {
  return polishPlural(count, {
    one: 'komentarz',
    few: 'komentarze',
    many: 'komentarzy',
  });
}

export function formatEventsCount(count: number) {
  return `${count} ${polishPlural(count, {
    one: 'zdarzenie',
    few: 'zdarzenia',
    many: 'zdarzeń',
  })}`;
}

export function formatSocialTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'przed chwilą';
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} dn. temu`;
  return new Date(dateStr).toLocaleDateString('pl-PL');
}
