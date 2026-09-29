'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import {
  CONTRACT_TYPES,
  EXPERIENCE_LEVELS,
  type JobContractType,
  type ExperienceLevel,
  type JobFormValues,
  type JobOffer,
} from './queries';
import { contractTypeKey, experienceLevelKey } from './labels';

interface JobFormProps {
  initial?: JobOffer | null;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: JobFormValues) => void;
  onCancel?: () => void;
}

// §3.1 — create / edit an offer. Only `title` is required (the backend enforces
// MinLength 2 / MaxLength 160); everything else is optional.
export function JobForm({
  initial,
  submitting = false,
  submitLabel,
  onSubmit,
  onCancel,
}: JobFormProps) {
  const { t } = useLocale();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [contractType, setContractType] = useState<JobContractType | ''>(
    initial?.contractType ?? '',
  );
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | ''>(
    initial?.experienceLevel ?? '',
  );
  const [skills, setSkills] = useState((initial?.skills ?? []).join(', '));
  const [deadline, setDeadline] = useState(
    initial?.deadline ? initial.deadline.slice(0, 10) : '',
  );
  const [touched, setTouched] = useState(false);

  const titleError = title.trim().length < 2;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (titleError) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      contractType: contractType || null,
      experienceLevel: experienceLevel || null,
      skills: skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      // Send as ISO so the backend's IsISO8601 validation accepts it.
      deadline: deadline ? new Date(deadline).toISOString() : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="job-title">{t('jobs.form.title')}</Label>
        <Input
          id="job-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('jobs.form.titlePlaceholder')}
          maxLength={160}
          aria-invalid={touched && titleError}
        />
        {touched && titleError && (
          <p className="text-xs text-destructive">{t('jobs.form.titleError')}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="job-description">{t('jobs.form.description')}</Label>
        <Textarea
          id="job-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('jobs.form.descriptionPlaceholder')}
          rows={6}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="job-location">{t('jobs.form.location')}</Label>
          <Input
            id="job-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t('jobs.form.locationPlaceholder')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="job-deadline">{t('jobs.form.deadline')}</Label>
          <Input
            id="job-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="job-contract">{t('jobs.form.contractType')}</Label>
          <Select
            id="job-contract"
            value={contractType}
            onChange={(e) =>
              setContractType(e.target.value as JobContractType | '')
            }
          >
            <option value="">{t('jobs.form.any')}</option>
            {CONTRACT_TYPES.map((c) => (
              <option key={c} value={c}>
                {t(contractTypeKey(c))}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="job-experience">{t('jobs.form.experience')}</Label>
          <Select
            id="job-experience"
            value={experienceLevel}
            onChange={(e) =>
              setExperienceLevel(e.target.value as ExperienceLevel | '')
            }
          >
            <option value="">{t('jobs.form.any')}</option>
            {EXPERIENCE_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {t(experienceLevelKey(lvl))}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="job-skills">{t('jobs.form.skills')}</Label>
        <Input
          id="job-skills"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder={t('jobs.form.skillsPlaceholder')}
        />
        <p className="text-xs text-muted-foreground">
          {t('jobs.form.skillsHint')}
        </p>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" disabled={submitting} className="gap-2">
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
