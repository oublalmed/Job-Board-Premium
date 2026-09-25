'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Link2,
  Code,
  Globe,
  Briefcase,
  ExternalLink,
  Trash2,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useProfileLinks,
  useAddProfileLink,
  useDeleteProfileLink,
  useReverifyProfileLink,
  type ProfileLinkType,
  type LinkAccessibilityStatus,
} from './queries';

// EF-CAND-04 — how each accessibility-verification status renders. The icon is
// decorative (aria-hidden); the visible text carries the meaning for screen
// readers, so the badge never relies on colour alone (WCAG 1.4.1).
const STATUS_META: Record<
  LinkAccessibilityStatus,
  {
    icon: React.ComponentType<{ className?: string }>;
    className: string;
    labelKey: string;
  }
> = {
  pending: {
    icon: Clock,
    className: 'text-muted-foreground',
    labelKey: 'profileLinks.statusPending',
  },
  reachable: {
    icon: CheckCircle2,
    className: 'text-emerald-600 dark:text-emerald-400',
    labelKey: 'profileLinks.statusReachable',
  },
  unreachable: {
    icon: AlertCircle,
    className: 'text-destructive',
    labelKey: 'profileLinks.statusUnreachable',
  },
};

const LINK_TYPES: ProfileLinkType[] = [
  'github',
  'portfolio',
  'linkedin',
  'other',
];

const TYPE_ICON: Record<
  ProfileLinkType,
  React.ComponentType<{ className?: string }>
> = {
  github: Code,
  portfolio: Globe,
  linkedin: Briefcase,
  other: Link2,
};

// Validation is a UX aid only — the backend (@IsUrl, require_protocol) is the
// real boundary. A regex refine avoids depending on any particular zod URL
// helper and matches the http/https contract the API enforces.
const linkFormSchema = z.object({
  type: z.enum(['github', 'portfolio', 'linkedin', 'other']),
  url: z.string().refine((v) => /^https?:\/\/.+/i.test(v.trim()), {
    message: 'invalid-url',
  }),
  label: z.string(),
});

type LinkFormValues = z.infer<typeof linkFormSchema>;

// EF-CAND-04 — lets a candidate add/remove external links (github, portfolio,
// linkedin, other). The backend CRUD already existed with no UI calling it.
export function ProfileLinksCard() {
  const { t } = useLocale();
  const { toast } = useToast();
  const { data, isLoading } = useProfileLinks();
  const addLink = useAddProfileLink();
  const deleteLink = useDeleteProfileLink();
  const reverifyLink = useReverifyProfileLink();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LinkFormValues>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: { type: 'github', url: '', label: '' },
  });

  const onSubmit = handleSubmit((values) => {
    addLink.mutate(
      {
        type: values.type,
        url: values.url.trim(),
        label: values.label.trim() || undefined,
      },
      {
        onSuccess: () => reset({ type: values.type, url: '', label: '' }),
        onError: () => toast(t('profileLinks.addError'), 'error'),
      },
    );
  });

  function handleRemove(id: string) {
    deleteLink.mutate(id, {
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  function handleReverify(id: string) {
    reverifyLink.mutate(id, {
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  const links = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="size-5 text-primary" />
          {t('profileLinks.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          {t('profileLinks.description')}
        </p>

        {isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('profileLinks.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {links.map((link) => {
              const Icon = TYPE_ICON[link.type];
              const status = STATUS_META[link.accessibilityStatus];
              const StatusIcon = status.icon;
              const isReverifying =
                reverifyLink.isPending && reverifyLink.variables === link.id;
              return (
                <li
                  key={link.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3"
                >
                  <Icon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {link.label || t(`profileLinks.type${capitalize(link.type)}`)}
                    </p>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 truncate text-xs text-primary hover:underline"
                    >
                      <span className="truncate">{link.url}</span>
                      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                    </a>
                  </div>
                  {/* EF-CAND-04 — accessibility status. Icon is decorative; the
                      text label carries the meaning (no colour-only signal). */}
                  <span
                    className={`hidden items-center gap-1 text-xs font-medium sm:flex ${status.className}`}
                  >
                    <StatusIcon className="size-3.5 shrink-0" aria-hidden="true" />
                    {t(status.labelKey)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-muted-foreground"
                    onClick={() => handleReverify(link.id)}
                    disabled={isReverifying}
                    aria-label={`${t('profileLinks.recheck')} ${link.url}`}
                  >
                    <RefreshCw
                      className={`size-4 ${isReverifying ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => handleRemove(link.id)}
                    disabled={
                      deleteLink.isPending && deleteLink.variables === link.id
                    }
                    aria-label={`${t('profileLinks.remove')} ${link.url}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-end"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link-type">{t('profileLinks.type')}</Label>
            <select
              id="link-type"
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              {...register('type')}
            >
              {LINK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`profileLinks.type${capitalize(type)}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="link-url">{t('profileLinks.url')}</Label>
            <Input
              id="link-url"
              type="url"
              inputMode="url"
              placeholder={t('profileLinks.urlPlaceholder')}
              aria-invalid={!!errors.url}
              {...register('url')}
            />
            {errors.url && (
              <p className="text-xs text-destructive">
                {t('profileLinks.urlInvalid')}
              </p>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="link-label">{t('profileLinks.label')}</Label>
            <Input
              id="link-label"
              placeholder={t('profileLinks.labelPlaceholder')}
              {...register('label')}
            />
          </div>
          <Button type="submit" disabled={addLink.isPending} className="gap-2">
            {addLink.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {t('profileLinks.add')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
