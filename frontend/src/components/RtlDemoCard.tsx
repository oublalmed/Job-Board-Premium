import { Building2, CalendarDays, MapPin, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { SupportedLocale } from '@/i18n';
import { formatCurrencyMAD, formatDateCasablanca } from '@/lib/format';

// Proves RTL is a layout direction, not a translation: every spacing/
// alignment utility below is a *logical* one (border-s, ps-*, ms-auto,
// text-start/text-end) — never pl-*/pr-*/ml-*/mr-*/text-left/text-right.
// Flip <html dir> (LanguageSwitcher → i18n → syncDocumentDirection) and
// this card mirrors itself with zero direction-specific classes here.
export function RtlDemoCard() {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? 'fr') as SupportedLocale;

  const salary = formatCurrencyMAD(18000, locale);
  const postedAt = formatDateCasablanca(
    new Date('2026-07-15T10:00:00Z'),
    locale,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('demo.rtl.title')}</CardTitle>
        <CardDescription>{t('demo.rtl.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* border-s-4 = border-inline-start: a physical left border in
            LTR, a physical right border in RTL — the same class both
            times. ps-4 (padding-inline-start) keeps content off the
            accent bar on whichever side it lands. */}
        <div className="flex flex-col gap-3 border-s-4 border-primary ps-4">
          <div className="flex items-center gap-2">
            <Building2
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="font-medium text-foreground">
              {t('demo.rtl.jobCardTitle')}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('demo.rtl.jobCardCompany')}</span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <MapPin className="size-4" aria-hidden="true" />
              {t('demo.rtl.jobCardLocation')}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Wallet
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="text-muted-foreground">
              {t('demo.rtl.jobCardSalaryLabel')}:
            </span>
            <span className="font-medium">{salary}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="text-muted-foreground">
              {t('demo.rtl.jobCardPostedLabel')}:
            </span>
            <span>{postedAt}</span>
          </div>
        </div>

        {/* ms-auto (margin-inline-start: auto) pushes the second box to
            the *end* side — the right in LTR, the left in RTL. */}
        <div className="flex rounded-md border border-border p-2 text-sm">
          <span className="rounded bg-muted px-2 py-1 text-start">
            {t('demo.rtl.startLabel')}
          </span>
          <span className="ms-auto rounded bg-muted px-2 py-1 text-end">
            {t('demo.rtl.endLabel')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
