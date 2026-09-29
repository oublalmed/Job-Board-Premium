/**
 * Clean, controlled test fixtures (§ manual QA).
 *
 * WIPES all data from the database (TRUNCATE, schema preserved) EXCEPT the
 * assessment catalogue (specialties + tests) that backs the QCM question bank,
 * then seeds a small, deterministic set:
 *
 *   3 companies, one per pack (Starter / Pro / Premium), each ACTIVE, with
 *     1 recruiter + 1 subscription.
 *   3 candidates with complete profiles + a recognised grande école + skills,
 *     one completed assessment & score each (one with anti-cheat signals).
 *   Job offers on the Pro & Premium companies (Starter has no JOBS feature),
 *     with candidate applications and a couple of shortlist entries.
 *
 * Every account uses the shared demo password `Password123!`.
 *
 *   npm run seed:testcases
 *
 * Refuses to run against production (NODE_ENV=production) unless SEED_FORCE=1.
 */
import 'reflect-metadata';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import dataSource from './data-source.js';
import { Role } from '../common/enums/role.enum.js';
import { User, UserStatus } from '../modules/users/entities/user.entity.js';
import {
  Company,
  CompanyStatus,
  CompanySize,
} from '../modules/companies/entities/company.entity.js';
import { Recruiter } from '../modules/companies/entities/recruiter.entity.js';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../modules/companies/entities/subscription.entity.js';
import { ShortlistEntry } from '../modules/companies/entities/shortlist-entry.entity.js';
import {
  CandidateProfile,
  ProfileVisibility,
} from '../modules/candidates/entities/candidate-profile.entity.js';
import { Skill } from '../modules/candidates/entities/skill.entity.js';
import { ProfileSkill } from '../modules/candidates/entities/profile-skill.entity.js';
import { Specialty } from '../modules/assessments/entities/specialty.entity.js';
import { Test } from '../modules/assessments/entities/test.entity.js';
import {
  Assessment,
  AssessmentStatus,
} from '../modules/assessments/entities/assessment.entity.js';
import {
  Score,
  PlagiarismVerdict,
} from '../modules/assessments/entities/score.entity.js';
import {
  JobOffer,
  JobStatus,
  JobContractType,
  ExperienceLevel,
} from '../modules/jobs/entities/job-offer.entity.js';
import {
  JobApplication,
  ApplicationStatus,
} from '../modules/jobs/entities/job-application.entity.js';

const DEMO_PASSWORD = 'Password123!';
// Contact quotas mirror business.config.ts defaults (starter 15 / growth 60 /
// scale 200) so seeded subscriptions match what the app provisions.
const CONTACT_QUOTA: Record<string, number> = {
  [SubscriptionPlan.STARTER]: 15,
  [SubscriptionPlan.GROWTH]: 60,
  [SubscriptionPlan.SCALE]: 200,
};

const daysAgo = (n: number): Date =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const inDays = (n: number): Date =>
  new Date(Date.now() + n * 24 * 60 * 60 * 1000);

// Tables kept across the wipe: migration bookkeeping + the evaluation catalogue.
const KEEP_TABLES = new Set([
  'migrations',
  'typeorm_metadata',
  'specialties',
  'tests',
]);

async function wipe(ds: DataSource): Promise<void> {
  const rows: { tablename: string }[] = await ds.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const toTruncate = rows
    .map((r) => r.tablename)
    .filter((t) => !KEEP_TABLES.has(t));
  if (toTruncate.length === 0) return;
  const list = toTruncate.map((t) => `"${t}"`).join(', ');
  await ds.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  console.log(
    `✓ Wiped ${toTruncate.length} table(s); kept catalogue (${[...KEEP_TABLES].join(', ')}).`,
  );
}

async function seed(ds: DataSource): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
  });

  const users = ds.getRepository(User);
  const companies = ds.getRepository(Company);
  const recruiters = ds.getRepository(Recruiter);
  const subscriptions = ds.getRepository(Subscription);
  const shortlist = ds.getRepository(ShortlistEntry);
  const profiles = ds.getRepository(CandidateProfile);
  const skillsRepo = ds.getRepository(Skill);
  const profileSkills = ds.getRepository(ProfileSkill);
  const specialties = ds.getRepository(Specialty);
  const tests = ds.getRepository(Test);
  const assessments = ds.getRepository(Assessment);
  const scores = ds.getRepository(Score);
  const offers = ds.getRepository(JobOffer);
  const applications = ds.getRepository(JobApplication);

  // --- One admin/moderator account, so the /admin space stays usable after
  // the wipe (not part of the 3 test cases, but avoids locking out staff) ---
  await users.save(
    users.create({
      email: 'admin@test.cobalt.ma',
      passwordHash,
      roles: [Role.ADMIN, Role.MODERATOR],
      status: UserStatus.ACTIVE,
      emailVerified: true,
    }),
  );

  // --- Ensure an evaluation catalogue exists (kept across the wipe, but
  // recreate the standard one if the DB was empty) ------------------------
  let test = await tests.findOne({ where: {} });
  if (!test) {
    const specialty = await specialties.save(
      specialties.create({
        name: 'Développement Logiciel',
        description: 'Évaluation technique et psychotechnique générale.',
        active: true,
      }),
    );
    test = await tests.save(
      tests.create({
        specialtyId: specialty.id,
        version: 'v1',
        provider: 'seed',
        durationMinutes: 90,
        active: true,
      }),
    );
    console.log('✓ Recreated the standard evaluation catalogue.');
  }

  // --- Skills catalogue ----------------------------------------------------
  const skillCache = new Map<string, Skill>();
  const skill = async (name: string): Promise<Skill> => {
    const existing = skillCache.get(name);
    if (existing) return existing;
    const s = await skillsRepo.save(skillsRepo.create({ name }));
    skillCache.set(name, s);
    return s;
  };

  // --- 3 companies, one per pack ------------------------------------------
  interface CompanySeed {
    key: 'starter' | 'pro' | 'premium';
    name: string;
    ice: string;
    plan: SubscriptionPlan;
    sector: string;
    size: CompanySize;
    recruiterEmail: string;
    position: string;
  }
  const COMPANIES: CompanySeed[] = [
    {
      key: 'starter',
      name: 'Atlas RH (Starter)',
      ice: '001234567000011',
      plan: SubscriptionPlan.STARTER,
      sector: 'Conseil RH',
      size: CompanySize.SMALL,
      recruiterEmail: 'recruteur.starter@test.cobalt.ma',
      position: 'Chargée de recrutement',
    },
    {
      key: 'pro',
      name: 'Maghreb Tech (Pro)',
      ice: '001234567000022',
      plan: SubscriptionPlan.GROWTH,
      sector: 'Éditeur logiciel',
      size: CompanySize.MEDIUM,
      recruiterEmail: 'recruteur.pro@test.cobalt.ma',
      position: 'Talent Acquisition Manager',
    },
    {
      key: 'premium',
      name: 'Zellige Labs (Premium)',
      ice: '001234567000033',
      plan: SubscriptionPlan.SCALE,
      sector: 'Scale-up SaaS',
      size: CompanySize.MEDIUM,
      recruiterEmail: 'recruteur.premium@test.cobalt.ma',
      position: 'Head of Talent',
    },
  ];

  const companyByKey = new Map<string, Company>();
  const recruiterByKey = new Map<string, User>();

  for (const c of COMPANIES) {
    const company = await companies.save(
      companies.create({
        name: c.name,
        ice: c.ice,
        registrationNumber: null,
        verified: true,
        status: CompanyStatus.ACTIVE,
        sector: c.sector,
        size: c.size,
        description: `Entreprise de test — pack ${c.plan}.`,
      }),
    );
    companyByKey.set(c.key, company);

    const recruiter = await users.save(
      users.create({
        email: c.recruiterEmail,
        passwordHash,
        roles: [Role.RECRUITER, Role.COMPANY_ADMIN],
        status: UserStatus.ACTIVE,
        emailVerified: true,
      }),
    );
    recruiterByKey.set(c.key, recruiter);
    await recruiters.save(
      recruiters.create({
        userId: recruiter.id,
        companyId: company.id,
        position: c.position,
      }),
    );

    await subscriptions.save(
      subscriptions.create({
        companyId: company.id,
        plan: c.plan,
        status: SubscriptionStatus.ACTIVE,
        startsAt: daysAgo(30),
        endsAt: inDays(335),
        contactQuota: CONTACT_QUOTA[c.plan],
        contactsUsed: 0,
        quotaResetAt: inDays(1),
        cancelAtPeriodEnd: false,
      }),
    );
  }

  // --- 3 candidates --------------------------------------------------------
  interface CandidateSeed {
    key: string;
    email: string;
    firstName: string;
    lastName: string;
    headline: string;
    location: string;
    school: string;
    skills: string[];
    // [technical, psychotechnical]
    score: [number, number];
    tabSwitchCount: number;
  }
  const CANDIDATES: CandidateSeed[] = [
    {
      key: 'ensias',
      email: 'candidat.ensias@test.cobalt.ma',
      firstName: 'Sara',
      lastName: 'Benali',
      headline: 'Ingénieure Backend Node.js',
      location: 'Casablanca',
      school: 'ENSIAS',
      skills: ['Node.js', 'PostgreSQL', 'Docker'],
      score: [88, 82],
      tabSwitchCount: 0,
    },
    {
      key: 'emi',
      email: 'candidat.emi@test.cobalt.ma',
      firstName: 'Youssef',
      lastName: 'El Amrani',
      headline: 'Développeur Full-Stack',
      location: 'Rabat',
      school: 'EMI',
      skills: ['React', 'TypeScript', 'Node.js'],
      score: [74, 69],
      // Crosses the tab-switch threshold → "medium" suspicion for the Premium
      // recruiter's anti-cheat card.
      tabSwitchCount: 4,
    },
    {
      key: 'inpt',
      email: 'candidat.inpt@test.cobalt.ma',
      firstName: 'Imane',
      lastName: 'Tazi',
      headline: 'Data Engineer',
      location: 'Marrakech',
      school: 'INPT',
      skills: ['Python', 'SQL', 'Spark'],
      score: [80, 77],
      tabSwitchCount: 0,
    },
  ];

  const profileByKey = new Map<string, CandidateProfile>();
  const candidateUserByKey = new Map<string, User>();

  for (const c of CANDIDATES) {
    const user = await users.save(
      users.create({
        email: c.email,
        passwordHash,
        roles: [Role.CANDIDATE],
        status: UserStatus.ACTIVE,
        emailVerified: true,
      }),
    );
    candidateUserByKey.set(c.key, user);

    const profile = await profiles.save(
      profiles.create({
        userId: user.id,
        firstName: c.firstName,
        lastName: c.lastName,
        headline: c.headline,
        bio: `Profil de test (${c.school}).`,
        location: c.location,
        school: c.school,
        schoolVerified: true,
        visibility: ProfileVisibility.PUBLIC,
        completeness: 90,
        indexedInCvtheque: true,
      }),
    );
    profileByKey.set(c.key, profile);

    for (const name of c.skills) {
      const s = await skill(name);
      await profileSkills.save(
        profileSkills.create({ profileId: profile.id, skillId: s.id }),
      );
    }

    // One completed assessment + score (real grading pipeline shape).
    const completedAt = daysAgo(10);
    const value = Math.round((c.score[0] * 0.6 + c.score[1] * 0.4) * 100) / 100;
    const assessment = await assessments.save(
      assessments.create({
        candidateId: user.id,
        testId: test.id,
        status: AssessmentStatus.COMPLETED,
        startedAt: completedAt,
        completedAt,
        tabSwitchCount: c.tabSwitchCount,
        windowBlurCount: 0,
      }),
    );
    await scores.save(
      scores.create({
        assessmentId: assessment.id,
        value,
        percentile: Math.min(99, Math.round(value)),
        technicalScore: c.score[0],
        psychotechnicalScore: c.score[1],
        baremeVersion: 'v1',
        testVersion: test.version,
        plagiarismVerdict: PlagiarismVerdict.CLEAN,
        expiresAt: inDays(355),
      }),
    );
  }

  // --- Job offers (only Pro & Premium: Starter has no JOBS / 0 posts) ------
  const proCompany = companyByKey.get('pro')!;
  const proRecruiter = recruiterByKey.get('pro')!;
  const premiumCompany = companyByKey.get('premium')!;
  const premiumRecruiter = recruiterByKey.get('premium')!;

  const proPublished = await offers.save(
    offers.create({
      companyId: proCompany.id,
      createdBy: proRecruiter.id,
      title: 'Développeur Full-Stack (React / Node.js)',
      description:
        'Rejoignez notre équipe produit pour construire des applications web modernes.',
      location: 'Casablanca',
      contractType: JobContractType.CDI,
      experienceLevel: ExperienceLevel.MID,
      skills: ['React', 'Node.js', 'TypeScript'],
      status: JobStatus.PUBLISHED,
      publishedAt: daysAgo(7),
    }),
  );
  await offers.save(
    offers.create({
      companyId: proCompany.id,
      createdBy: proRecruiter.id,
      title: 'Stage PFE — Data',
      description: 'Stage de fin d’études sur nos pipelines de données.',
      location: 'Rabat',
      contractType: JobContractType.PFE,
      experienceLevel: ExperienceLevel.JUNIOR,
      skills: ['Python', 'SQL'],
      status: JobStatus.DRAFT,
    }),
  );
  const premiumPublished = await offers.save(
    offers.create({
      companyId: premiumCompany.id,
      createdBy: premiumRecruiter.id,
      title: 'Ingénieur Backend Node.js',
      description: 'Conception et scaling de notre API sur PostgreSQL.',
      location: 'Rabat',
      contractType: JobContractType.CDI,
      experienceLevel: ExperienceLevel.SENIOR,
      skills: ['Node.js', 'PostgreSQL', 'Docker'],
      status: JobStatus.PUBLISHED,
      publishedAt: daysAgo(3),
    }),
  );

  // --- Applications --------------------------------------------------------
  const apply = async (
    candKey: string,
    offer: JobOffer,
    status: ApplicationStatus,
    coverLetter: string,
  ): Promise<void> => {
    const user = candidateUserByKey.get(candKey)!;
    const profile = profileByKey.get(candKey)!;
    await applications.save(
      applications.create({
        jobOfferId: offer.id,
        candidateId: user.id,
        candidateProfileId: profile.id,
        status,
        coverLetter,
      }),
    );
  };

  await apply(
    'ensias',
    premiumPublished,
    ApplicationStatus.APPLIED,
    'Passionnée par le backend Node.js, je serais ravie de contribuer.',
  );
  await apply(
    'emi',
    proPublished,
    ApplicationStatus.SHORTLISTED,
    'Développeur full-stack React/Node, disponible immédiatement.',
  );
  await apply(
    'inpt',
    proPublished,
    ApplicationStatus.APPLIED,
    'Intéressée par le volet data.',
  );
  await apply(
    'inpt',
    premiumPublished,
    ApplicationStatus.UNDER_REVIEW,
    'Solide expérience SQL/PostgreSQL.',
  );

  // --- A couple of shortlist entries (for the recruiter analytics KPI) -----
  await shortlist.save(
    shortlist.create({
      companyId: premiumCompany.id,
      candidateProfileId: profileByKey.get('ensias')!.id,
      addedBy: premiumRecruiter.id,
      note: 'Très bon profil backend.',
    }),
  );
  await shortlist.save(
    shortlist.create({
      companyId: proCompany.id,
      candidateProfileId: profileByKey.get('emi')!.id,
      addedBy: proRecruiter.id,
      note: null,
    }),
  );

  printSummary(COMPANIES, CANDIDATES);
}

function printSummary(
  companies: { name: string; plan: SubscriptionPlan; recruiterEmail: string }[],
  candidates: {
    email: string;
    firstName: string;
    lastName: string;
    school: string;
  }[],
): void {
  console.log(
    '\n✓ Test fixtures created. Password for every account: Password123!\n',
  );
  console.log('Admin (kept so the /admin space stays usable):');
  console.log('  • admin@test.cobalt.ma  →  admin + moderator\n');
  console.log('Recruiters (1 per company, role recruiter + company_admin):');
  for (const c of companies) {
    console.log(`  • ${c.recruiterEmail}  →  ${c.name}  [${c.plan}]`);
  }
  console.log('\nCandidates (complete profile + grande école + score):');
  for (const c of candidates) {
    console.log(
      `  • ${c.email}  →  ${c.firstName} ${c.lastName}  [${c.school}]`,
    );
  }
  console.log(
    '\nJobs: Pro company has 1 published + 1 draft; Premium has 1 published.',
  );
  console.log(
    'Applications & shortlist entries seeded on the published offers.',
  );
  console.log(
    '\nNote: OCR runs on live CV upload — the seed sets each candidate’s school directly.\n',
  );
}

async function main(): Promise<void> {
  if (
    process.env['NODE_ENV'] === 'production' &&
    process.env['SEED_FORCE'] !== '1'
  ) {
    throw new Error(
      'Refusing to wipe/seed a production database. Set SEED_FORCE=1 to override.',
    );
  }

  const ds = await dataSource.initialize();
  try {
    await wipe(ds);
    await seed(ds);
  } finally {
    await ds.destroy();
  }
}

void main().catch((err) => {
  console.error('Test-cases seed failed:', err);
  process.exitCode = 1;
});
