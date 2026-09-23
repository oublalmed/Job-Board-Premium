'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FolderGit2,
  ExternalLink,
  Pencil,
  Trash2,
  Plus,
  X,
  Loader2,
} from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useProjects,
  useAddProject,
  useUpdateProject,
  useDeleteProject,
  type Project,
} from './queries';

// Client validation is a UX aid only — the backend DTO (@IsString, @MinLength,
// @IsUrl http/https) is the real boundary. Mirrors the certifications form.
const projectFormSchema = z.object({
  title: z.string().refine((v) => v.trim().length > 0, { message: 'required' }),
  description: z
    .string()
    .refine((v) => v.trim().length > 0, { message: 'required' }),
  role: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  url: z
    .string()
    .refine((v) => v.trim() === '' || /^https?:\/\/.+/i.test(v.trim()), {
      message: 'invalid-url',
    }),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

const EMPTY_FORM: ProjectFormValues = {
  title: '',
  description: '',
  role: '',
  startDate: '',
  endDate: '',
  url: '',
};

// EF-CAND-07 — lets a candidate add/edit/delete structured projects, mirroring
// the certifications card. Talks to the owner-scoped /candidates/projects CRUD.
export function ProjectsCard() {
  const { t } = useLocale();
  const { toast } = useToast();
  const { data, isLoading } = useProjects();
  const addProject = useAddProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: EMPTY_FORM,
  });

  function startEdit(project: Project) {
    setEditingId(project.id);
    reset({
      title: project.title,
      description: project.description,
      role: project.role ?? '',
      startDate: project.startDate?.slice(0, 10) ?? '',
      endDate: project.endDate?.slice(0, 10) ?? '',
      url: project.url ?? '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    reset(EMPTY_FORM);
  }

  const onSubmit = handleSubmit((values) => {
    const input = {
      title: values.title.trim(),
      description: values.description.trim(),
      role: values.role.trim() || undefined,
      startDate: values.startDate.trim() || undefined,
      endDate: values.endDate.trim() || undefined,
      url: values.url.trim() || undefined,
    };

    if (editingId) {
      updateProject.mutate(
        { id: editingId, input },
        {
          onSuccess: () => {
            toast(t('projects.updated'), 'success');
            cancelEdit();
          },
          onError: () => toast(t('projects.saveError'), 'error'),
        },
      );
    } else {
      addProject.mutate(input, {
        onSuccess: () => reset(EMPTY_FORM),
        onError: () => toast(t('projects.saveError'), 'error'),
      });
    }
  });

  function handleRemove(id: string) {
    if (editingId === id) cancelEdit();
    deleteProject.mutate(id, {
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  const projects = data ?? [];
  const isSaving = addProject.isPending || updateProject.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderGit2 className="size-5 text-primary" />
          {t('projects.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          {t('projects.description')}
        </p>

        {isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('projects.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {projects.map((project) => (
              <li
                key={project.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3"
              >
                <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {project.title}
                    {project.role ? ` · ${project.role}` : ''}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {project.description}
                  </p>
                  {(project.startDate || project.endDate) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {project.startDate?.slice(0, 10) ?? '—'}
                      {project.endDate
                        ? ` → ${project.endDate.slice(0, 10)}`
                        : ''}
                    </p>
                  )}
                  {project.url && (
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 truncate text-xs text-primary hover:underline"
                    >
                      <span className="truncate">{t('projects.link')}</span>
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => startEdit(project)}
                  aria-label={`${t('projects.edit')} ${project.title}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => handleRemove(project.id)}
                  disabled={
                    deleteProject.isPending &&
                    deleteProject.variables === project.id
                  }
                  aria-label={`${t('projects.remove')} ${project.title}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="flex flex-col gap-3 border-t border-border/60 pt-4"
        >
          <p className="text-sm font-medium text-foreground">
            {editingId ? t('projects.editTitle') : t('projects.addTitle')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-title">{t('projects.name')}</Label>
              <Input
                id="project-title"
                placeholder={t('projects.namePlaceholder')}
                aria-invalid={!!errors.title}
                {...register('title')}
              />
              {errors.title && (
                <p className="text-xs text-destructive">
                  {t('projects.required')}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-role">{t('projects.role')}</Label>
              <Input
                id="project-role"
                placeholder={t('projects.rolePlaceholder')}
                {...register('role')}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="project-description">
                {t('projects.descriptionLabel')}
              </Label>
              <Input
                id="project-description"
                placeholder={t('projects.descriptionPlaceholder')}
                aria-invalid={!!errors.description}
                {...register('description')}
              />
              {errors.description && (
                <p className="text-xs text-destructive">
                  {t('projects.required')}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-start">{t('projects.startDate')}</Label>
              <Input id="project-start" type="date" {...register('startDate')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-end">{t('projects.endDate')}</Label>
              <Input id="project-end" type="date" {...register('endDate')} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="project-url">{t('projects.url')}</Label>
              <Input
                id="project-url"
                type="url"
                inputMode="url"
                placeholder="https://…"
                aria-invalid={!!errors.url}
                {...register('url')}
              />
              {errors.url && (
                <p className="text-xs text-destructive">
                  {t('projects.urlInvalid')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {editingId ? t('projects.save') : t('projects.add')}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                className="gap-2"
                onClick={cancelEdit}
              >
                <X className="size-4" />
                {t('projects.cancel')}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
