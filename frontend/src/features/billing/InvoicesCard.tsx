'use client';

import { FileText, Download, Loader2 } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyMAD, formatDateCasablanca } from '@/lib/format';
import { useInvoices, useDownloadInvoice } from './queries';

// EF-BILL-03 — recruiter-facing list of emitted invoices with a link to the
// archived PDF. Amounts are stored in centimes, so divide by 100 for display.
export function InvoicesCard() {
  const { t, locale } = useLocale();
  const { toast } = useToast();
  const { data, isLoading, isError } = useInvoices();
  const download = useDownloadInvoice();

  function handleDownload(id: string) {
    download.mutate(id, {
      onSuccess: ({ url }) => window.open(url, '_blank', 'noopener,noreferrer'),
      onError: () => toast(t('billing.downloadError'), 'error'),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          {t('billing.invoices')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">{t('billing.invoicesError')}</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('billing.invoicesEmpty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('billing.invoices')}</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('billing.colNumber')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('billing.colDate')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('billing.colAmount')}
                  </th>
                  <th scope="col" className="py-2">
                    <span className="sr-only">{t('billing.download')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((invoice) => {
                  const pending =
                    download.isPending && download.variables === invoice.id;
                  return (
                    <tr
                      key={invoice.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-3 pr-4 font-mono text-foreground">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatDateCasablanca(
                          new Date(invoice.issuedAt),
                          locale,
                        )}
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-foreground">
                        {formatCurrencyMAD(invoice.amountTTC / 100, locale)}
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleDownload(invoice.id)}
                          disabled={pending}
                          aria-label={`${t('billing.download')} ${invoice.invoiceNumber}`}
                        >
                          {pending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Download className="size-4" />
                          )}
                          <span className="hidden sm:inline">
                            {t('billing.download')}
                          </span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
