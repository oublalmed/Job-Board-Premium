'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  User,
  MapPin,
  Upload,
  Trash2,
  Save,
  FileText,
  Briefcase,
  Building2,
  ShieldCheck,
  Clock,
  ShieldX,
} from 'lucide-react';
import { apiClient } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getAccessToken } from '@/auth/token-store';

// The generated schema types GET /companies/recruiters as
// Record<string, never>[] (missing Swagger response decorator on the
// backend) — this is the real shape returned by
// RecruiterService.listRecruiters (recruiter.service.ts), a flat
// summary with no nested user/company relations.
interface RecruiterSummary {
  id: string;
  userId: string;
  email: string;
  position: string | null;
  createdAt: string;
}

interface ProfileData {
  profile: {
    firstName?: string | null;
    lastName?: string | null;
    headline?: string | null;
    bio?: string | null;
    location?: string | null;
    availability?: string | null;
    mobility?: string | null;
    school?: string | null;
    schoolVerified?: boolean;
    visibility?: 'public' | 'recruiters_only' | 'hidden';
  };
  // The profile endpoint nests the full CompletenessResultDto here, not
  // a bare number — confirmed against the real backend DTO
  // (candidate-profile.service.ts). Found by regenerating the OpenAPI
  // schema after restoring the backend endpoints this page depends on:
  // the previous (stale) schema silently let `completeness: number` go
  // uncaught here.
  completeness: {
    completeness: number;
    isPublishable: boolean;
    missing: { key: string; label: string; weight: number }[];
  };
}

interface CvData {
  cv: {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    scanStatus: string;
  } | null;
}

type SchoolVerificationStatus = 'pending' | 'verified' | 'rejected';

interface SchoolVerificationData {
  verification: {
    id: string;
    status: SchoolVerificationStatus;
    matchedSchool: string | null;
    reviewNote: string | null;
    createdAt: string;
    reviewedAt: string | null;
  } | null;
}

// /api/v1/candidates/profile and /api/v1/candidates/cv are guarded
// @Roles(CANDIDATE) — a recruiter calling them gets a 403. This page
// used to call them unconditionally for every role, so recruiters saw
// a silently-blank, half-broken candidate form. Split by role instead:
// there's no backend concept of a recruiter's own profile beyond their
// company membership (Recruiter.position), so recruiters get a minimal
// read-only view rather than a fabricated editable form.
export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  const isCandidate = user.roles.includes('candidate');
  const isRecruiter = user.roles.some((r) =>
    ['recruiter', 'company_admin', 'admin'].includes(r),
  );

  if (isCandidate) return <CandidateProfile />;
  if (isRecruiter) return <RecruiterProfile />;
  return null;
}

function RecruiterProfile() {
  const { user } = useAuth();
  const { t } = useLocale();

  const [loading, setLoading] = useState(true);
  const [recruiter, setRecruiter] = useState<RecruiterSummary | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  async function loadRecruiter() {
    setLoading(true);
    try {
      const [recruitersRes, companyRes] = await Promise.all([
        apiClient.GET('/api/v1/companies/recruiters'),
        apiClient.GET('/api/v1/companies/me'),
      ]);
      const list = (recruitersRes.data ?? []) as unknown as RecruiterSummary[];
      setRecruiter(list.find((r) => r.userId === user?.userId) ?? null);
      const companyData = companyRes.data as { company?: { name?: string } } | undefined;
      setCompanyName(companyData?.company?.name ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRecruiter();
  }, []);

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-foreground">{t('profile.title')}</h1>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-start">
          <div className="flex size-24 items-center justify-center rounded-full bg-primary/10">
            <User className="size-12 text-primary" />
          </div>
          <div className="flex flex-1 flex-col gap-4 text-center sm:text-start">
            <div>
              <p className="text-lg font-semibold text-foreground">{user.email}</p>
              {recruiter?.position && (
                <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground sm:justify-start">
                  <Briefcase className="size-3.5" />
                  {recruiter.position}
                </p>
              )}
              <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {user.roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>

            {companyName && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground sm:justify-start">
                <Building2 className="size-4" />
                {companyName}
              </div>
            )}

            <Link href="/company" className="self-center sm:self-start">
              <Button variant="outline" size="sm">
                {t('company.title')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CandidateProfile() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completeness, setCompleteness] = useState<number>(0);
  const [cv, setCv] = useState<CvData['cv']>(null);
  const [uploading, setUploading] = useState(false);
  const [schoolVerified, setSchoolVerified] = useState(false);
  const [verification, setVerification] = useState<SchoolVerificationData['verification']>(null);
  const [uploadingDiploma, setUploadingDiploma] = useState(false);
  const diplomaInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [availability, setAvailability] = useState('');
  const [mobility, setMobility] = useState('');
  const [school, setSchool] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'recruiters_only' | 'hidden'>('hidden');

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [profileRes, cvRes, verificationRes] = await Promise.all([
        apiClient.GET('/api/v1/candidates/profile'),
        apiClient.GET('/api/v1/candidates/cv'),
        apiClient.GET('/api/v1/candidates/school-verification'),
      ]);

      if (profileRes.data) {
        const d = profileRes.data as ProfileData;
        const p = d.profile;
        setFirstName(p.firstName ?? '');
        setLastName(p.lastName ?? '');
        setHeadline(p.headline ?? '');
        setBio(p.bio ?? '');
        setLocation(p.location ?? '');
        setAvailability(p.availability ?? '');
        setMobility(p.mobility ?? '');
        setSchool(p.school ?? '');
        setSchoolVerified(p.schoolVerified ?? false);
        setVisibility(p.visibility ?? 'hidden');
        setCompleteness(d.completeness?.completeness ?? 0);
      }

      if (cvRes.data) {
        setCv((cvRes.data as CvData).cv ?? null);
      }

      if (verificationRes.data) {
        setVerification((verificationRes.data as SchoolVerificationData).verification ?? null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        headline: headline || undefined,
        bio: bio || undefined,
        location: location || undefined,
        availability: availability || undefined,
        mobility: mobility || undefined,
        school: school || undefined,
        visibility,
      };

      const { error } = await apiClient.PUT('/api/v1/candidates/profile', {
        body: body as never,
      });
      if (error) {
        toast(t('profile.saveError'), 'error');
        return;
      }

      const { data } = await apiClient.GET('/api/v1/candidates/profile/completeness');
      if (data) {
        setCompleteness((data as { completeness: number }).completeness ?? 0);
      }
      toast(t('profile.saved'), 'success');
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadCv(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      const res = await fetch(`${baseUrl}/api/v1/candidates/cv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: formData,
      });

      if (!res.ok) {
        toast(t('common.error'), 'error');
        return;
      }

      toast(t('profile.cvUploaded'), 'success');
      const cvRes = await apiClient.GET('/api/v1/candidates/cv');
      if (cvRes.data) setCv((cvRes.data as CvData).cv ?? null);

      const compRes = await apiClient.GET('/api/v1/candidates/profile/completeness');
      if (compRes.data) setCompleteness((compRes.data as { completeness: number }).completeness ?? 0);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteCv() {
    const { error } = await apiClient.DELETE('/api/v1/candidates/cv');
    if (error) {
      toast(t('common.error'), 'error');
      return;
    }
    setCv(null);
    toast(t('profile.cvDeleted'), 'success');

    const compRes = await apiClient.GET('/api/v1/candidates/profile/completeness');
    if (compRes.data) setCompleteness((compRes.data as { completeness: number }).completeness ?? 0);
  }

  async function handleUploadDiploma(file: File) {
    setUploadingDiploma(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      const res = await fetch(`${baseUrl}/api/v1/candidates/school-verification`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: formData,
      });

      if (!res.ok) {
        toast(t('common.error'), 'error');
        return;
      }

      toast(t('profile.diplomaUploaded'), 'success');
      const verificationRes = await apiClient.GET('/api/v1/candidates/school-verification');
      if (verificationRes.data) {
        setVerification((verificationRes.data as SchoolVerificationData).verification ?? null);
      }
    } finally {
      setUploadingDiploma(false);
    }
  }

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48 lg:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('profile.title')}</h1>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{t('profile.completeness')}</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min(completeness, 100)}%` }}
                />
              </div>
              <Badge variant={completeness >= 70 ? 'success' : 'warning'}>
                {Math.round(completeness)}%
              </Badge>
            </div>
          </div>
        </div>
        <Button onClick={() => void handleSave()} disabled={saving}>
          <Save className="size-4" />
          {saving ? t('profile.saving') : t('profile.save')}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <div className="flex size-24 items-center justify-center rounded-full bg-primary/10">
              <User className="size-12 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : user.email}
              </p>
              {headline && (
                <p className="mt-1 text-sm text-muted-foreground">{headline}</p>
              )}
              {location && (
                <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  {location}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('profile.personalInfo')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="firstName">{t('profile.firstName')}</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="lastName">{t('profile.lastName')}</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="headline">{t('profile.headline')}</Label>
                <Input
                  id="headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="bio">{t('profile.bio')}</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t('profile.bioPlaceholder')}
                  rows={3}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="location">{t('profile.location')}</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t('profile.locationPlaceholder')}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">{t('profile.email')}</Label>
                <Input id="email" value={user.email} disabled />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="availability">{t('profile.availability')}</Label>
                <Input
                  id="availability"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  placeholder={t('profile.availabilityPlaceholder')}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mobility">{t('profile.mobility')}</Label>
                <Input
                  id="mobility"
                  value={mobility}
                  onChange={(e) => setMobility(e.target.value)}
                  placeholder={t('profile.mobilityPlaceholder')}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="school" className="flex items-center gap-2">
                  {t('profile.school')}
                  {schoolVerified && (
                    <Badge variant="success" className="gap-1">
                      <ShieldCheck className="size-3" />
                      {t('profile.schoolVerifiedBadge')}
                    </Badge>
                  )}
                </Label>
                <Input
                  id="school"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder={t('profile.schoolPlaceholder')}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="visibility">{t('profile.visibility')}</Label>
                <Select
                  id="visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                >
                  <option value="public">{t('profile.visibilityPublic')}</option>
                  <option value="recruiters_only">{t('profile.visibilityRecruitersOnly')}</option>
                  <option value="hidden">{t('profile.visibilityHidden')}</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.cv')}</CardTitle>
        </CardHeader>
        <CardContent>
          {cv ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <FileText className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">{cv.originalName}</p>
                  <p className="text-xs text-muted-foreground">
                    {(cv.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={() => void handleDeleteCv()}
              >
                <Trash2 className="size-4" />
                {t('profile.deleteCv')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{t('profile.noCv')}</p>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUploadCv(file);
                  }}
                />
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="size-4" />
                  {uploading ? t('common.loading') : t('profile.uploadCv')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.schoolVerification.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {verification && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
              {verification.status === 'verified' && (
                <ShieldCheck className="size-5 shrink-0 text-emerald-600" />
              )}
              {verification.status === 'pending' && (
                <Clock className="size-5 shrink-0 text-amber-600" />
              )}
              {verification.status === 'rejected' && (
                <ShieldX className="size-5 shrink-0 text-destructive" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t(`profile.schoolVerification.status.${verification.status}`)}
                  {verification.matchedSchool ? ` — ${verification.matchedSchool}` : ''}
                </p>
                {verification.status === 'rejected' && verification.reviewNote && (
                  <p className="mt-1 text-xs text-muted-foreground">{verification.reviewNote}</p>
                )}
              </div>
            </div>
          )}

          {(!verification || verification.status === 'rejected') && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {t('profile.schoolVerification.hint')}
              </p>
              <div>
                <input
                  ref={diplomaInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUploadDiploma(file);
                  }}
                />
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => diplomaInputRef.current?.click()}
                  disabled={uploadingDiploma}
                >
                  <Upload className="size-4" />
                  {uploadingDiploma
                    ? t('common.loading')
                    : t('profile.schoolVerification.upload')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
