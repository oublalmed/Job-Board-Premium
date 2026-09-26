// Local exam content bank. Real evaluations are graded by an external vendor;
// locally there is none, so this provides genuine questions the candidate can
// answer, and the answer keys used to grade them server-side. Correct answers
// live here only — the client-facing exam never includes them.

export interface ExamQuestion {
  id: string;
  type: 'technical' | 'psychotechnical';
  domain: string;
  prompt: string;
  options: string[];
  correct: number; // index into options
}

// Shared psychotechnical section (logic / numeracy / reasoning), 40% of score.
const PSYCHOTECHNICAL: ExamQuestion[] = [
  {
    id: 'psy-1',
    type: 'psychotechnical',
    domain: 'Raisonnement logique',
    prompt: 'Quel nombre complète la suite : 2, 6, 12, 20, 30, ?',
    options: ['36', '40', '42', '48'],
    correct: 2,
  },
  {
    id: 'psy-2',
    type: 'psychotechnical',
    domain: 'Raisonnement numérique',
    prompt: 'Un article coûte 240 MAD après une remise de 20 %. Quel était son prix initial ?',
    options: ['260 MAD', '288 MAD', '300 MAD', '320 MAD'],
    correct: 2,
  },
  {
    id: 'psy-3',
    type: 'psychotechnical',
    domain: 'Raisonnement verbal',
    prompt: '« Livre » est à « Bibliothèque » ce que « Tableau » est à … ?',
    options: ['Peintre', 'Musée', 'Couleur', 'Mur'],
    correct: 1,
  },
];

// Technical section per specialty (60% of score). Falls back to DEFAULT for a
// specialty with no dedicated set.
const TECHNICAL: Record<string, ExamQuestion[]> = {
  'Développement Logiciel': [
    {
      id: 'dl-1', type: 'technical', domain: 'Algorithmes',
      prompt: 'Quelle est la complexité temporelle moyenne d’une recherche dans une table de hachage ?',
      options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], correct: 0,
    },
    {
      id: 'dl-2', type: 'technical', domain: 'Structures de données',
      prompt: 'Quelle structure suit le principe LIFO (dernier entré, premier sorti) ?',
      options: ['File (queue)', 'Pile (stack)', 'Arbre', 'Graphe'], correct: 1,
    },
    {
      id: 'dl-3', type: 'technical', domain: 'Programmation',
      prompt: 'En POO, quel principe consiste à masquer les détails internes d’un objet ?',
      options: ['Héritage', 'Polymorphisme', 'Encapsulation', 'Abstraction'], correct: 2,
    },
    {
      id: 'dl-4', type: 'technical', domain: 'Bases de données',
      prompt: 'Quelle clause SQL filtre les lignes APRÈS une agrégation GROUP BY ?',
      options: ['WHERE', 'HAVING', 'FILTER', 'ORDER BY'], correct: 1,
    },
  ],
  'Développement Web Full-Stack': [
    {
      id: 'web-1', type: 'technical', domain: 'Front-end',
      prompt: 'Quel hook React sert à mémoriser une valeur calculée coûteuse ?',
      options: ['useEffect', 'useMemo', 'useRef', 'useState'], correct: 1,
    },
    {
      id: 'web-2', type: 'technical', domain: 'HTTP',
      prompt: 'Quel code HTTP indique une ressource créée avec succès ?',
      options: ['200', '201', '204', '302'], correct: 1,
    },
    {
      id: 'web-3', type: 'technical', domain: 'Back-end',
      prompt: 'Quelle méthode HTTP est idempotente et remplace entièrement une ressource ?',
      options: ['POST', 'PATCH', 'PUT', 'CONNECT'], correct: 2,
    },
    {
      id: 'web-4', type: 'technical', domain: 'Bases de données',
      prompt: 'Dans une base relationnelle, une clé étrangère sert à …',
      options: [
        'accélérer les lectures', 'référencer la clé d’une autre table',
        'chiffrer une colonne', 'stocker du JSON',
      ], correct: 1,
    },
  ],
  'Data Engineering': [
    {
      id: 'de-1', type: 'technical', domain: 'SQL',
      prompt: 'Quelle jointure conserve toutes les lignes de la table de gauche ?',
      options: ['INNER JOIN', 'LEFT JOIN', 'CROSS JOIN', 'SELF JOIN'], correct: 1,
    },
    {
      id: 'de-2', type: 'technical', domain: 'Traitement distribué',
      prompt: 'Dans Spark, une transformation « lazy » est exécutée …',
      options: [
        'immédiatement', 'au moment d’une action (ex. count)',
        'à la fermeture de la session', 'jamais',
      ], correct: 1,
    },
    {
      id: 'de-3', type: 'technical', domain: 'Modélisation',
      prompt: 'Dans un schéma en étoile, la table centrale est …',
      options: ['une dimension', 'la table de faits', 'une vue', 'un index'], correct: 1,
    },
    {
      id: 'de-4', type: 'technical', domain: 'Pipelines',
      prompt: 'Que signifie le « T » dans un pipeline ETL ?',
      options: ['Transfer', 'Transform', 'Trigger', 'Table'], correct: 1,
    },
  ],
  'DevOps & Cloud': [
    {
      id: 'do-1', type: 'technical', domain: 'Conteneurs',
      prompt: 'Quelle commande construit une image à partir d’un Dockerfile ?',
      options: ['docker run', 'docker build', 'docker pull', 'docker exec'], correct: 1,
    },
    {
      id: 'do-2', type: 'technical', domain: 'Orchestration',
      prompt: 'Dans Kubernetes, quelle est la plus petite unité déployable ?',
      options: ['Node', 'Pod', 'Service', 'Deployment'], correct: 1,
    },
    {
      id: 'do-3', type: 'technical', domain: 'CI/CD',
      prompt: 'Que vise l’intégration continue (CI) ?',
      options: [
        'déployer en production automatiquement',
        'fusionner et tester fréquemment les changements',
        'chiffrer les secrets', 'gérer les tickets',
      ], correct: 1,
    },
    {
      id: 'do-4', type: 'technical', domain: 'IaC',
      prompt: 'Terraform est un outil d’…',
      options: [
        'infrastructure as code', 'analyse de logs',
        'orchestration de conteneurs', 'monitoring',
      ], correct: 0,
    },
  ],
  'Product Design (UX/UI)': [
    {
      id: 'ux-1', type: 'technical', domain: 'UX Research',
      prompt: 'Quel livrable synthétise un utilisateur type d’un produit ?',
      options: ['Persona', 'Sitemap', 'Wireframe', 'Changelog'], correct: 0,
    },
    {
      id: 'ux-2', type: 'technical', domain: 'Design',
      prompt: 'Un « wireframe » sert principalement à …',
      options: [
        'définir les couleurs finales', 'structurer la mise en page à basse fidélité',
        'coder l’interface', 'tester la sécurité',
      ], correct: 1,
    },
    {
      id: 'ux-3', type: 'technical', domain: 'Accessibilité',
      prompt: 'Quel critère WCAG concerne le contraste texte/fond ?',
      options: ['Perceptible', 'Robuste', 'Compréhensible', 'Sécurisé'], correct: 0,
    },
    {
      id: 'ux-4', type: 'technical', domain: 'Design System',
      prompt: 'Un design system garantit surtout …',
      options: [
        'la cohérence et la réutilisabilité', 'un meilleur référencement',
        'une base de données rapide', 'moins de tests',
      ], correct: 0,
    },
  ],
  'Cybersécurité': [
    {
      id: 'cy-1', type: 'technical', domain: 'Web Security',
      prompt: 'Quelle attaque injecte du script dans une page vue par d’autres utilisateurs ?',
      options: ['SQL Injection', 'XSS', 'CSRF', 'DDoS'], correct: 1,
    },
    {
      id: 'cy-2', type: 'technical', domain: 'Cryptographie',
      prompt: 'Quel algorithme est un chiffrement symétrique ?',
      options: ['RSA', 'AES', 'ECDSA', 'Diffie-Hellman'], correct: 1,
    },
    {
      id: 'cy-3', type: 'technical', domain: 'Authentification',
      prompt: 'Que renforce l’authentification à deux facteurs (2FA) ?',
      options: [
        'la vitesse de connexion', 'la sécurité via un second facteur',
        'la taille des mots de passe', 'le chiffrement du disque',
      ], correct: 1,
    },
    {
      id: 'cy-4', type: 'technical', domain: 'Bonnes pratiques',
      prompt: 'Comment stocker un mot de passe côté serveur ?',
      options: [
        'en clair', 'chiffré réversible', 'haché avec un sel (ex. argon2/bcrypt)',
        'en base64',
      ], correct: 2,
    },
  ],
};

const DEFAULT_TECHNICAL: ExamQuestion[] = TECHNICAL['Développement Logiciel'];

// The full question set for a specialty (technical + shared psychotechnical),
// with the answer keys — server-side use only.
export function examForSpecialty(specialtyName: string | null): ExamQuestion[] {
  const technical =
    (specialtyName && TECHNICAL[specialtyName]) || DEFAULT_TECHNICAL;
  return [...technical, ...PSYCHOTECHNICAL];
}
