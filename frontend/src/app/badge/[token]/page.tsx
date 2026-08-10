'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Briefcase, Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/locale-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePublicBadge } from '@/features/badge/queries';
import { ScoreShowcase } from '@/features/badge/ScoreShowcase';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export default function PublicBadgePage() {
  const params = useParams();
  const token = params.token as string;
  const { t } = useLocale();
  const { data, isLoading } = usePublicBadge(token);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />

      <Link
        href="/"
        className="mb-8 flex items-center gap-2 text-sm font-semibold text-foreground"
      >
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          T
        </div>
        {t('app.name')}
      </Link>

      {isLoading ? (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : data ? (
        <motion.div className="w-full max-w-sm" {...fadeUp}>
          <Card className="overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-primary via-primary/60 to-primary/20" />
            <CardContent className="flex flex-col items-center gap-6 p-8">
              <ScoreShowcase badge={data} />
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="size-3.5 text-success" />
                {t('badge.verifiedBy')}
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 text-center">
            <Link href="/register">
              <Button className="gap-2">
                <Briefcase className="size-4" />
                {t('badge.cta')}
              </Button>
            </Link>
          </div>
        </motion.div>
      ) : (
        <motion.div className="w-full max-w-sm text-center" {...fadeUp}>
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
            <ShieldX className="size-8 text-muted-foreground/60" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{t('badge.notFound')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('badge.notFoundHint')}</p>
          <Link href="/" className="mt-6 inline-block">
            <Button variant="outline">{t('nav.home')}</Button>
          </Link>
        </motion.div>
      )}
    </div>
  );
}
