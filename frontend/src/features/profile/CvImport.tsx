'use client';

import { useRef, useState } from 'react';
import { Sparkles, Upload, Loader2, Save, Link2, FileText } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  useParseCv,
  useApplyCvImport,
  type CvSuggestions,
  type ApplyCvImportPayload,
} from './cv-import';

// Local, editable rows (each carries an `include` toggle).
interface ExpRow {
  include: boolean;
  type: 'work' | 'education';
  title: string;
  organization: string;
  startDate: string;
  endDate: string;
  description: string;
}
interface ProjRow {
  include: boolean;
  title: string;
  description: string;
  url: string;
}
interface CertRow {
  include: boolean;
  name: string;
  issuer: string;
  issueDate: string;
}
interface LinkRow {
  include: boolean;
  type: string;
  url: string;
}

interface Rows {
  experiences: ExpRow[];
  projects: ProjRow[];
  certifications: CertRow[];
  links: LinkRow[];
}

function fromSuggestions(s: CvSuggestions): Rows {
  return {
    experiences: s.experiences.map<ExpRow>((e) => ({
      include: true,
      type: e.type,
      title: e.title,
      organization: e.organization,
      startDate: '',
      endDate: '',
      description: e.description,
    })),
    projects: s.projects.map<ProjRow>((p) => ({
      include: true,
      title: p.title,
      description: p.description,
      url: p.url ?? '',
    })),
    certifications: s.certifications.map<CertRow>((c) => ({
      include: true,
      name: c.name,
      issuer: c.issuer,
      issueDate: '',
    })),
    links: s.links.map<LinkRow>((l) => ({
      include: true,
      type: l.type,
      url: l.url,
    })),
  };
}

// §1 — Import a CV, review the auto-extracted data (edit / complete / deselect),
// then save the confirmed subset to the profile.
export function CvImport({ onApplied }: { onApplied?: () => void }) {
  const { t } = useLocale();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const parse = useParseCv();
  const apply = useApplyCvImport();

  const [rows, setRows] = useState<Rows | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    parse.mutate(file, {
      onSuccess: (s) => {
        const r = fromSuggestions(s);
        const total =
          r.experiences.length +
          r.projects.length +
          r.certifications.length +
          r.links.length;
        setRows(r);
        toast(
          total === 0
            ? t('cvImport.nothingFound')
            : t('cvImport.parsed', { count: String(total) }),
          total === 0 ? 'info' : 'success',
        );
      },
      onError: () => toast(t('cvImport.parseError'), 'error'),
    });
    e.target.value = '';
  }

  // An included row is "ready" only when its required fields are filled.
  const invalidCount = rows
    ? rows.experiences.filter((r) => r.include && !r.startDate).length +
      rows.certifications.filter((r) => r.include && (!r.issuer || !r.issueDate))
        .length
    : 0;

  const includedCount = rows
    ? rows.experiences.filter((r) => r.include).length +
      rows.projects.filter((r) => r.include).length +
      rows.certifications.filter((r) => r.include).length +
      rows.links.filter((r) => r.include).length
    : 0;

  function handleSave() {
    if (!rows) return;
    const payload: ApplyCvImportPayload = {
      experiences: rows.experiences
        .filter((r) => r.include && r.startDate && r.title.trim())
        .map((r) => ({
          type: r.type,
          title: r.title.trim(),
          organization: r.organization.trim() || '—',
          startDate: r.startDate,
          endDate: r.endDate || undefined,
          description: r.description.trim() || undefined,
        })),
      projects: rows.projects
        .filter((r) => r.include && r.title.trim())
        .map((r) => ({
          title: r.title.trim(),
          description: r.description.trim() || r.title.trim(),
          url: r.url.trim() || undefined,
        })),
      certifications: rows.certifications
        .filter((r) => r.include && r.name.trim() && r.issuer && r.issueDate)
        .map((r) => ({
          name: r.name.trim(),
          issuer: r.issuer.trim(),
          issueDate: r.issueDate,
        })),
      links: rows.links
        .filter((r) => r.include && r.url.trim())
        .map((r) => ({ type: r.type, url: r.url.trim() })),
    };

    apply.mutate(payload, {
      onSuccess: (res) => {
        const n =
          res.created.experiences +
          res.created.projects +
          res.created.certifications +
          res.created.links;
        toast(t('cvImport.saved', { count: String(n) }), 'success');
        setRows(null);
        onApplied?.();
      },
      onError: () => toast(t('cvImport.saveError'), 'error'),
    });
  }

  function patch(
    key: keyof Rows,
    i: number,
    value: Record<string, unknown>,
  ) {
    setRows((prev) => {
      if (!prev) return prev;
      const list = [
        ...(prev[key] as unknown as Array<Record<string, unknown>>),
      ];
      list[i] = { ...list[i], ...value };
      return { ...prev, [key]: list } as Rows;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" />
          {t('cvImport.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t('cvImport.subtitle')}</p>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => fileRef.current?.click()}
            disabled={parse.isPending}
          >
            {parse.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {t('cvImport.selectCv')}
          </Button>
        </div>

        {rows && (
          <div className="flex flex-col gap-5">
            {/* Experiences */}
            {rows.experiences.length > 0 && (
              <Section
                icon={<FileText className="size-4" />}
                label={t('cvImport.experiences')}
              >
                {rows.experiences.map((r, i) => (
                  <RowShell
                    key={`e${i}`}
                    include={r.include}
                    onToggle={(v) => patch('experiences', i, { include: v })}
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={r.title}
                        placeholder={t('cvImport.expTitle')}
                        onChange={(e) =>
                          patch('experiences', i, { title: e.target.value })
                        }
                      />
                      <Input
                        value={r.organization}
                        placeholder={t('cvImport.expOrg')}
                        onChange={(e) =>
                          patch('experiences', i, {
                            organization: e.target.value,
                          })
                        }
                      />
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {t('cvImport.startDate')}
                        <Input
                          type="date"
                          value={r.startDate}
                          aria-invalid={r.include && !r.startDate}
                          onChange={(e) =>
                            patch('experiences', i, {
                              startDate: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {t('cvImport.endDate')}
                        <Input
                          type="date"
                          value={r.endDate}
                          onChange={(e) =>
                            patch('experiences', i, { endDate: e.target.value })
                          }
                        />
                      </label>
                    </div>
                  </RowShell>
                ))}
              </Section>
            )}

            {/* Projects */}
            {rows.projects.length > 0 && (
              <Section
                icon={<FileText className="size-4" />}
                label={t('cvImport.projects')}
              >
                {rows.projects.map((r, i) => (
                  <RowShell
                    key={`p${i}`}
                    include={r.include}
                    onToggle={(v) => patch('projects', i, { include: v })}
                  >
                    <div className="flex flex-col gap-2">
                      <Input
                        value={r.title}
                        placeholder={t('cvImport.projTitle')}
                        onChange={(e) =>
                          patch('projects', i, { title: e.target.value })
                        }
                      />
                      <Input
                        value={r.url}
                        placeholder="https://…"
                        onChange={(e) =>
                          patch('projects', i, { url: e.target.value })
                        }
                      />
                    </div>
                  </RowShell>
                ))}
              </Section>
            )}

            {/* Certifications */}
            {rows.certifications.length > 0 && (
              <Section
                icon={<FileText className="size-4" />}
                label={t('cvImport.certifications')}
              >
                {rows.certifications.map((r, i) => (
                  <RowShell
                    key={`c${i}`}
                    include={r.include}
                    onToggle={(v) => patch('certifications', i, { include: v })}
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={r.name}
                        placeholder={t('cvImport.certName')}
                        onChange={(e) =>
                          patch('certifications', i, { name: e.target.value })
                        }
                      />
                      <Input
                        value={r.issuer}
                        placeholder={t('cvImport.certIssuer')}
                        aria-invalid={r.include && !r.issuer}
                        onChange={(e) =>
                          patch('certifications', i, { issuer: e.target.value })
                        }
                      />
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {t('cvImport.issueDate')}
                        <Input
                          type="date"
                          value={r.issueDate}
                          aria-invalid={r.include && !r.issueDate}
                          onChange={(e) =>
                            patch('certifications', i, {
                              issueDate: e.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                  </RowShell>
                ))}
              </Section>
            )}

            {/* Links */}
            {rows.links.length > 0 && (
              <Section
                icon={<Link2 className="size-4" />}
                label={t('cvImport.links')}
              >
                {rows.links.map((r, i) => (
                  <RowShell
                    key={`l${i}`}
                    include={r.include}
                    onToggle={(v) => patch('links', i, { include: v })}
                  >
                    <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
                      <Select
                        value={r.type}
                        onChange={(e) =>
                          patch('links', i, { type: e.target.value })
                        }
                      >
                        <option value="github">GitHub</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="portfolio">Portfolio</option>
                        <option value="other">Autre</option>
                      </Select>
                      <Input
                        value={r.url}
                        onChange={(e) =>
                          patch('links', i, { url: e.target.value })
                        }
                      />
                    </div>
                  </RowShell>
                ))}
              </Section>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
              <Button
                className="gap-2"
                onClick={handleSave}
                disabled={
                  apply.isPending || includedCount === 0 || invalidCount > 0
                }
              >
                {apply.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {t('cvImport.save')}
              </Button>
              {invalidCount > 0 && (
                <span className="text-xs text-warning">
                  {t('cvImport.fillRequired', { count: String(invalidCount) })}
                </span>
              )}
              <Button
                variant="ghost"
                onClick={() => setRows(null)}
                disabled={apply.isPending}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {label}
      </h4>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function RowShell({
  include,
  onToggle,
  children,
}: {
  include: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
      <input
        type="checkbox"
        checked={include}
        onChange={(e) => onToggle(e.target.checked)}
        className="mt-1 size-4 shrink-0 accent-primary"
        aria-label="include"
      />
      <div className={`flex-1 ${include ? '' : 'opacity-50'}`}>{children}</div>
    </div>
  );
}
