/**
 * Idempotent demo seed — safe to re-run. Every row is looked up by a natural
 * key before insert, so a second run adds nothing and never duplicates.
 *
 * Refuses to run against production (NODE_ENV=production) unless explicitly
 * forced with SEED_FORCE=1, since it writes fake accounts with a shared,
 * well-known password.
 *
 *   npm run seed
 *
 * Seeds: demo companies (with logo/sector/size/description, reused by the
 * landing "Ils nous ont fait confiance" section), recruiter accounts,
 * complete candidate profiles (incl. a grande école for the OCR module),
 * assessment history with technical/psychotechnical scores, conversations
 * with messages, and per-user notifications.
 */
import 'reflect-metadata';
import * as argon2 from 'argon2';
import { DataSource, Repository } from 'typeorm';
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
  CandidateProfile,
  ProfileVisibility,
} from '../modules/candidates/entities/candidate-profile.entity.js';
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
  Conversation,
  ConversationStatus,
} from '../modules/messaging/entities/conversation.entity.js';
import {
  Message,
  MessageSenderRole,
} from '../modules/messaging/entities/message.entity.js';
import {
  Notification,
  NotificationType,
} from '../modules/notifications/entities/notification.entity.js';

// Shared demo password for every seeded account.
const DEMO_PASSWORD = 'Password123!';

const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

/** Self-contained SVG logo (data URI) — no network fetch needed. */
const logo = (label: string, bg: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="${bg}"/><text x="60" y="60" dy="0.36em" font-family="Arial, sans-serif" font-size="52" font-weight="700" fill="#ffffff" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

interface CompanySeed {
  name: string;
  ice: string;
  sector: string;
  size: CompanySize;
  description: string;
  logo: string;
}

const COMPANIES: CompanySeed[] = [
  {
    name: 'Atlas Digital',
    ice: '001500000000001',
    sector: "Technologies de l'information",
    size: CompanySize.MEDIUM,
    description:
      "Studio d'ingénierie logicielle basé à Casablanca, spécialisé dans les plateformes cloud et l'IA appliquée.",
    logo: logo('AD', '#1d4ed8'),
  },
  {
    name: 'Maghreb Finance',
    ice: '001500000000002',
    sector: 'Services financiers',
    size: CompanySize.LARGE,
    description:
      'Groupe financier panafricain proposant banque de détail, assurance et solutions de paiement digital.',
    logo: logo('MF', '#0f766e'),
  },
  {
    name: 'Zellige Studio',
    ice: '001500000000003',
    sector: 'Design & Créatif',
    size: CompanySize.SMALL,
    description:
      "Agence de design produit et d'expérience de marque, à la croisée de l'artisanat marocain et du digital.",
    logo: logo('ZS', '#b45309'),
  },
  {
    name: 'OuedTech',
    ice: '001500000000004',
    sector: 'Logiciels',
    size: CompanySize.MICRO,
    description:
      'Jeune pousse deeptech construisant des outils de data engineering pour les entreprises africaines.',
    logo: logo('OT', '#7c3aed'),
  },
];

interface RecruiterSeed {
  email: string;
  firstName: string;
  position: string;
  companyName: string;
}

const RECRUITERS: RecruiterSeed[] = [
  {
    email: 'recruteur.atlas@demo.cobalt.ma',
    firstName: 'Yasmine',
    position: 'Talent Acquisition Lead',
    companyName: 'Atlas Digital',
  },
  {
    email: 'recruteur.maghreb@demo.cobalt.ma',
    firstName: 'Karim',
    position: 'Responsable Recrutement',
    companyName: 'Maghreb Finance',
  },
  {
    email: 'recruteur.zellige@demo.cobalt.ma',
    firstName: 'Nadia',
    position: 'Head of People',
    companyName: 'Zellige Studio',
  },
  {
    email: 'recruteur.ouedtech@demo.cobalt.ma',
    firstName: 'Omar',
    position: 'Co-fondateur',
    companyName: 'OuedTech',
  },
];

interface CandidateSeed {
  email: string;
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  location: string;
  school: string;
  // A grande école triggers the "verified" school flag in the demo.
  grandeEcole: boolean;
  // (technical, psychotechnical) score pairs, most recent last.
  history: [number, number][];
}

const CANDIDATES: CandidateSeed[] = [
  {
    email: 'candidat.sara@demo.cobalt.ma',
    firstName: 'Sara',
    lastName: 'El Amrani',
    headline: 'Ingénieure Full-Stack — React / NestJS',
    bio: "5 ans d'expérience à concevoir des produits SaaS scalables. Passionnée par le DX et la qualité logicielle.",
    location: 'Casablanca',
    school: 'École Polytechnique',
    grandeEcole: true,
    history: [
      [78, 71],
      [88, 82],
    ],
  },
  {
    email: 'candidat.youssef@demo.cobalt.ma',
    firstName: 'Youssef',
    lastName: 'Bennani',
    headline: 'Data Engineer — Python / Spark',
    bio: 'Spécialiste des pipelines de données à grande échelle et de la modélisation analytique.',
    location: 'Rabat',
    school: 'Mohammed VI Polytechnic University (UM6P)',
    grandeEcole: true,
    history: [[74, 80]],
  },
  {
    email: 'candidat.imane@demo.cobalt.ma',
    firstName: 'Imane',
    lastName: 'Cherkaoui',
    headline: 'Product Designer — UX / UI',
    bio: "Designer produit orientée impact, de la recherche utilisateur jusqu'au design system.",
    location: 'Marrakech',
    school: 'Université Hassan II',
    grandeEcole: false,
    history: [
      [65, 70],
      [72, 76],
    ],
  },
  {
    email: 'candidat.mehdi@demo.cobalt.ma',
    firstName: 'Mehdi',
    lastName: 'Tazi',
    headline: 'Backend Engineer — Go / Postgres',
    bio: 'Ingénieur backend focalisé sur la fiabilité, les systèmes distribués et la performance.',
    location: 'Tanger',
    school: 'CentraleSupélec',
    grandeEcole: true,
    history: [[81, 68]],
  },
];

async function findOneBy<T extends object>(
  repo: Repository<T>,
  where: Parameters<Repository<T>['findOne']>[0]['where'],
): Promise<T | null> {
  return repo.findOne({ where } as Parameters<Repository<T>['findOne']>[0]);
}

async function seed(ds: DataSource): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
  });

  const users = ds.getRepository(User);
  const companies = ds.getRepository(Company);
  const recruiters = ds.getRepository(Recruiter);
  const profiles = ds.getRepository(CandidateProfile);
  const specialties = ds.getRepository(Specialty);
  const tests = ds.getRepository(Test);
  const assessments = ds.getRepository(Assessment);
  const scores = ds.getRepository(Score);
  const conversations = ds.getRepository(Conversation);
  const messages = ds.getRepository(Message);
  const notifications = ds.getRepository(Notification);

  let created = 0;

  // 1. Companies ------------------------------------------------------------
  const companyByName = new Map<string, Company>();
  for (const c of COMPANIES) {
    let company = await findOneBy(companies, { name: c.name });
    if (!company) {
      company = await companies.save(
        companies.create({
          name: c.name,
          ice: c.ice,
          registrationNumber: null,
          verified: true,
          status: CompanyStatus.ACTIVE,
          logo: c.logo,
          sector: c.sector,
          size: c.size,
          description: c.description,
        }),
      );
      created++;
    }
    companyByName.set(c.name, company);
  }

  // 2. Recruiter accounts ---------------------------------------------------
  for (const r of RECRUITERS) {
    let user = await findOneBy(users, { email: r.email });
    if (!user) {
      user = await users.save(
        users.create({
          email: r.email,
          passwordHash,
          roles: [Role.RECRUITER],
          status: UserStatus.ACTIVE,
          emailVerified: true,
        }),
      );
      created++;
    }
    const company = companyByName.get(r.companyName);
    if (company && !(await findOneBy(recruiters, { userId: user.id }))) {
      await recruiters.save(
        recruiters.create({
          userId: user.id,
          companyId: company.id,
          position: r.position,
        }),
      );
      created++;
    }
  }

  // 3. Assessment test scaffold (specialty + test) --------------------------
  let specialty = await findOneBy(specialties, { name: 'Développement Logiciel' });
  if (!specialty) {
    specialty = await specialties.save(
      specialties.create({
        name: 'Développement Logiciel',
        description: 'Évaluation technique et psychotechnique générale.',
        active: true,
      }),
    );
    created++;
  }
  let test = await findOneBy(tests, { specialtyId: specialty.id, version: 'v1' });
  if (!test) {
    test = await tests.save(
      tests.create({
        specialtyId: specialty.id,
        version: 'v1',
        provider: 'seed',
        durationMinutes: 90,
        active: true,
      }),
    );
    created++;
  }

  // 4. Candidate accounts + profiles + assessment history -------------------
  const candidateUsers = new Map<string, { user: User; profile: CandidateProfile }>();
  for (const c of CANDIDATES) {
    let user = await findOneBy(users, { email: c.email });
    if (!user) {
      user = await users.save(
        users.create({
          email: c.email,
          passwordHash,
          roles: [Role.CANDIDATE],
          status: UserStatus.ACTIVE,
          emailVerified: true,
        }),
      );
      created++;
    }

    let profile = await findOneBy(profiles, { userId: user.id });
    if (!profile) {
      profile = await profiles.save(
        profiles.create({
          userId: user.id,
          firstName: c.firstName,
          lastName: c.lastName,
          headline: c.headline,
          bio: c.bio,
          location: c.location,
          school: c.school,
          schoolVerified: c.grandeEcole,
          visibility: ProfileVisibility.PUBLIC,
          completeness: 90,
          indexedInCvtheque: true,
        }),
      );
      created++;
    }
    candidateUsers.set(c.email, { user, profile });

    // Assessment history — only seed when the candidate has none yet.
    const existing = await assessments.count({ where: { candidateId: user.id } });
    if (existing === 0) {
      let offsetDays = c.history.length * 100;
      for (const [technical, psychotechnical] of c.history) {
        const completedAt = daysAgo(offsetDays);
        offsetDays -= 100;
        const value = Math.round((technical * 0.6 + psychotechnical * 0.4) * 100) / 100;
        const assessment = await assessments.save(
          assessments.create({
            candidateId: user.id,
            testId: test.id,
            status: AssessmentStatus.COMPLETED,
            startedAt: completedAt,
            completedAt,
          }),
        );
        const expiresAt = new Date(completedAt);
        expiresAt.setDate(expiresAt.getDate() + 365);
        await scores.save(
          scores.create({
            assessmentId: assessment.id,
            value,
            percentile: Math.min(99, Math.round(value)),
            technicalScore: technical,
            psychotechnicalScore: psychotechnical,
            baremeVersion: 'v1',
            testVersion: test.version,
            plagiarismVerdict: PlagiarismVerdict.CLEAN,
            expiresAt,
          }),
        );
        created += 2;
      }
    }
  }

  // 5. Conversations + messages (recruiter <-> candidate) -------------------
  const threads: {
    candidateEmail: string;
    companyName: string;
    recruiterEmail: string;
    messages: { from: MessageSenderRole; body: string; read: boolean }[];
  }[] = [
    {
      candidateEmail: 'candidat.sara@demo.cobalt.ma',
      companyName: 'Atlas Digital',
      recruiterEmail: 'recruteur.atlas@demo.cobalt.ma',
      messages: [
        {
          from: MessageSenderRole.RECRUITER,
          body: 'Bonjour Sara, votre profil full-stack a retenu notre attention. Seriez-vous ouverte à un échange cette semaine ?',
          read: true,
        },
        {
          from: MessageSenderRole.CANDIDATE,
          body: 'Bonjour Yasmine, avec plaisir ! Je suis disponible jeudi après-midi.',
          read: true,
        },
        {
          from: MessageSenderRole.RECRUITER,
          body: 'Parfait, je vous envoie une invitation pour jeudi 15h.',
          read: false,
        },
      ],
    },
    {
      candidateEmail: 'candidat.youssef@demo.cobalt.ma',
      companyName: 'Maghreb Finance',
      recruiterEmail: 'recruteur.maghreb@demo.cobalt.ma',
      messages: [
        {
          from: MessageSenderRole.RECRUITER,
          body: 'Hello Youssef, we are building a new data platform and your Spark background is a great match. Interested?',
          read: true,
        },
        {
          from: MessageSenderRole.CANDIDATE,
          body: "Bonjour Karim, oui très intéressé. Pouvez-vous m'en dire plus sur la stack ?",
          read: false,
        },
      ],
    },
    {
      candidateEmail: 'candidat.imane@demo.cobalt.ma',
      companyName: 'Zellige Studio',
      recruiterEmail: 'recruteur.zellige@demo.cobalt.ma',
      messages: [
        {
          from: MessageSenderRole.RECRUITER,
          body: 'Bonjour Imane, votre portfolio est superbe. Nous cherchons une Product Designer senior.',
          read: false,
        },
      ],
    },
  ];

  for (const thread of threads) {
    const candidate = candidateUsers.get(thread.candidateEmail);
    const company = companyByName.get(thread.companyName);
    const recruiter = await findOneBy(users, { email: thread.recruiterEmail });
    if (!candidate || !company || !recruiter) continue;

    let conversation = await findOneBy(conversations, {
      candidateId: candidate.profile.id,
      companyId: company.id,
    });
    if (!conversation) {
      conversation = await conversations.save(
        conversations.create({
          candidateId: candidate.profile.id,
          recruiterId: recruiter.id,
          companyId: company.id,
          status: ConversationStatus.OPEN,
        }),
      );
      created++;
      // Only seed messages for a freshly created thread, so re-runs never
      // append duplicates.
      let msgOffset = thread.messages.length;
      for (const m of thread.messages) {
        const createdAt = daysAgo(msgOffset);
        msgOffset -= 1;
        await messages.save(
          messages.create({
            conversationId: conversation.id,
            senderId:
              m.from === MessageSenderRole.CANDIDATE
                ? candidate.user.id
                : recruiter.id,
            senderRole: m.from,
            body: m.body,
            readAt: m.read ? createdAt : null,
            createdAt,
          }),
        );
        created++;
      }
    }
  }

  // 6. Notifications --------------------------------------------------------
  const notifs: {
    email: string;
    type: NotificationType;
    title: string;
    body: string;
    read: boolean;
  }[] = [
    {
      email: 'candidat.sara@demo.cobalt.ma',
      type: NotificationType.PROFILE_VIEWED,
      title: 'Votre profil a été consulté',
      body: 'Un recruteur de Atlas Digital a consulté votre profil.',
      read: false,
    },
    {
      email: 'candidat.youssef@demo.cobalt.ma',
      type: NotificationType.COOLDOWN_EXPIRED,
      title: 'Nouvelle évaluation disponible',
      body: 'Votre période de latence est terminée : vous pouvez repasser une évaluation.',
      read: false,
    },
    {
      email: 'candidat.imane@demo.cobalt.ma',
      type: NotificationType.PROFILE_VIEWED,
      title: 'Your profile was viewed',
      body: 'A recruiter from Zellige Studio viewed your profile.',
      read: true,
    },
    {
      email: 'candidat.mehdi@demo.cobalt.ma',
      type: NotificationType.PROFILE_VIEWED,
      title: 'Votre profil a été consulté',
      body: 'Un recruteur de OuedTech a consulté votre profil.',
      read: false,
    },
  ];

  for (const n of notifs) {
    const user = await findOneBy(users, { email: n.email });
    if (!user) continue;
    const exists = await findOneBy(notifications, {
      recipientUserId: user.id,
      type: n.type,
      title: n.title,
    });
    if (!exists) {
      await notifications.save(
        notifications.create({
          recipientUserId: user.id,
          type: n.type,
          title: n.title,
          body: n.body,
          readAt: n.read ? new Date() : null,
        }),
      );
      created++;
    }
  }

  console.log(
    created === 0
      ? '✓ Seed already up to date — nothing to insert.'
      : `✓ Seed complete — ${created} row(s) inserted.`,
  );
}

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production' && process.env['SEED_FORCE'] !== '1') {
    throw new Error(
      'Refusing to seed a production database. Set SEED_FORCE=1 to override.',
    );
  }

  const ds = await dataSource.initialize();
  try {
    await seed(ds);
  } finally {
    await ds.destroy();
  }
}

void main().catch((err) => {
  console.error('Seed failed:', err);
  process.exitCode = 1;
});
