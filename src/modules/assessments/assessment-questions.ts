// Multiple-choice (QCM) exam bank. Each exam draws 30 questions — 20 technical
// (profile-specific first, topped up with shared IT questions) + 10
// psychotechnical — with the answer keys used only server-side for grading.

export type QuestionType = 'technical' | 'psychotechnical';

export interface ExamQuestion {
  id: string;
  type: QuestionType;
  domain: string;
  prompt: string;
  options: string[];
  correct: number; // index into options
}

const q = (
  id: string,
  type: QuestionType,
  domain: string,
  prompt: string,
  options: string[],
  correct: number,
): ExamQuestion => ({ id, type, domain, prompt, options, correct });

// ---- Psychotechnical (shared across profiles) ----
const PSYCHO: ExamQuestion[] = [
  q('psy-1', 'psychotechnical', 'Logique', 'Quel nombre complète la suite : 2, 6, 12, 20, 30, ?', ['36', '40', '42', '48'], 2),
  q('psy-2', 'psychotechnical', 'Numérique', 'Un article coûte 240 MAD après une remise de 20 %. Prix initial ?', ['260 MAD', '288 MAD', '300 MAD', '320 MAD'], 2),
  q('psy-3', 'psychotechnical', 'Verbal', '« Livre » est à « Bibliothèque » ce que « Tableau » est à … ?', ['Peintre', 'Musée', 'Couleur', 'Mur'], 1),
  q('psy-4', 'psychotechnical', 'Logique', 'Quel nombre complète la suite : 1, 4, 9, 16, 25, ?', ['30', '35', '36', '49'], 2),
  q('psy-5', 'psychotechnical', 'Logique', 'Quel est l’intrus : 3, 5, 7, 9, 11 ?', ['3', '5', '9', '11'], 2),
  q('psy-6', 'psychotechnical', 'Raisonnement', 'Tous les chats sont des animaux. Certains animaux sont noirs. Donc :', ['Tous les chats sont noirs', 'Certains chats sont noirs', 'On ne peut pas conclure', 'Aucun chat n’est noir'], 2),
  q('psy-7', 'psychotechnical', 'Numérique', 'Une voiture parcourt 120 km en 1 h 30. Vitesse moyenne ?', ['70 km/h', '80 km/h', '90 km/h', '100 km/h'], 1),
  q('psy-8', 'psychotechnical', 'Numérique', '15 représente quel pourcentage de 60 ?', ['20 %', '25 %', '30 %', '40 %'], 1),
  q('psy-9', 'psychotechnical', 'Verbal', 'Quelle lettre complète la suite : A, C, E, G, ?', ['H', 'I', 'J', 'K'], 1),
  q('psy-10', 'psychotechnical', 'Numérique', 'Un train part à 14 h 00, trajet de 2 h 45. Heure d’arrivée ?', ['16 h 15', '16 h 30', '16 h 45', '17 h 00'], 2),
  q('psy-11', 'psychotechnical', 'Logique', 'Si 3 ouvriers montent un mur en 6 jours, 6 ouvriers le montent en ?', ['2 jours', '3 jours', '4 jours', '6 jours'], 1),
  q('psy-12', 'psychotechnical', 'Logique', 'Quel nombre complète : 100, 50, 25, 12,5, ?', ['5', '6', '6,25', '10'], 2),
  q('psy-13', 'psychotechnical', 'Verbal', '« Médecin » est à « Hôpital » ce que « Professeur » est à … ?', ['Élève', 'École', 'Livre', 'Cours'], 1),
  q('psy-14', 'psychotechnical', 'Probabilités', 'Avec un dé à 6 faces, quelle est la probabilité d’obtenir un nombre pair ?', ['1/6', '1/3', '1/2', '2/3'], 2),
];

// ---- Shared technical (applicable to any IT profile) ----
const SHARED_TECH: ExamQuestion[] = [
  q('sh-1', 'technical', 'Algorithmes', 'Complexité moyenne d’une recherche dans une table de hachage ?', ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], 0),
  q('sh-2', 'technical', 'Structures de données', 'Quelle structure suit le principe LIFO ?', ['File', 'Pile', 'Arbre', 'Graphe'], 1),
  q('sh-3', 'technical', 'Structures de données', 'Quelle structure suit le principe FIFO ?', ['Pile', 'File', 'Tas', 'Dictionnaire'], 1),
  q('sh-4', 'technical', 'HTTP', 'Que signifie le code HTTP 404 ?', ['Succès', 'Redirection', 'Ressource introuvable', 'Erreur serveur'], 2),
  q('sh-5', 'technical', 'HTTP', 'Quel code HTTP indique une ressource créée ?', ['200', '201', '204', '302'], 1),
  q('sh-6', 'technical', 'HTTP', 'Quelle méthode HTTP est idempotente et remplace la ressource ?', ['POST', 'PATCH', 'PUT', 'CONNECT'], 2),
  q('sh-7', 'technical', 'SQL', 'Quelle clause filtre APRÈS une agrégation GROUP BY ?', ['WHERE', 'HAVING', 'FILTER', 'ORDER BY'], 1),
  q('sh-8', 'technical', 'SQL', 'Quelle jointure conserve toutes les lignes de la table de gauche ?', ['INNER JOIN', 'LEFT JOIN', 'CROSS JOIN', 'SELF JOIN'], 1),
  q('sh-9', 'technical', 'Git', 'Quelle commande crée et bascule sur une nouvelle branche ?', ['git branch', 'git checkout -b', 'git switch --list', 'git merge'], 1),
  q('sh-10', 'technical', 'Git', 'Git est un système de gestion de version …', ['centralisé', 'distribué', 'propriétaire', 'en lecture seule'], 1),
  q('sh-11', 'technical', 'POO', 'Quel principe masque les détails internes d’un objet ?', ['Héritage', 'Polymorphisme', 'Encapsulation', 'Récursivité'], 2),
  q('sh-12', 'technical', 'Bases de données', 'À quoi sert principalement un index ?', ['Chiffrer les données', 'Accélérer les recherches', 'Réduire la taille', 'Créer des relations'], 1),
  q('sh-13', 'technical', 'Bases de données', 'Une clé étrangère sert à …', ['accélérer les écritures', 'référencer la clé d’une autre table', 'chiffrer une colonne', 'stocker du JSON'], 1),
  q('sh-14', 'technical', 'Cryptographie', 'Quel algorithme est un chiffrement symétrique ?', ['RSA', 'AES', 'ECDSA', 'Diffie-Hellman'], 1),
  q('sh-15', 'technical', 'Cryptographie', 'Quel algorithme est asymétrique ?', ['AES', 'RSA', 'DES', 'ChaCha20'], 1),
  q('sh-16', 'technical', 'Sécurité', 'Comment stocker un mot de passe côté serveur ?', ['En clair', 'Chiffré réversible', 'Haché avec un sel (bcrypt/argon2)', 'En base64'], 2),
  q('sh-17', 'technical', 'Sécurité', 'Quelle attaque injecte du script dans une page vue par d’autres ?', ['SQL Injection', 'XSS', 'CSRF', 'DDoS'], 1),
  q('sh-18', 'technical', 'Sécurité', 'HTTPS repose sur le protocole …', ['SSHv1', 'TLS', 'FTP', 'SMTP'], 1),
  q('sh-19', 'technical', 'Algorithmes', 'Complexité moyenne du tri rapide (quicksort) ?', ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'], 1),
  q('sh-20', 'technical', 'Algorithmes', 'La recherche binaire nécessite un tableau …', ['aléatoire', 'trié', 'chaîné', 'vide'], 1),
  q('sh-21', 'technical', 'Réseaux', 'Quel protocole est fiable et ordonné ?', ['UDP', 'TCP', 'ICMP', 'ARP'], 1),
  q('sh-22', 'technical', 'Réseaux', 'À quoi sert le DNS ?', ['Chiffrer le trafic', 'Résoudre un nom en adresse IP', 'Router les paquets', 'Compresser les données'], 1),
  q('sh-23', 'technical', 'Conteneurs', 'Un conteneur Docker est …', ['une machine virtuelle', 'une instance en cours d’une image', 'un fichier de config', 'un dépôt Git'], 1),
  q('sh-24', 'technical', 'Tests', 'Un test unitaire vérifie …', ['toute l’application', 'une unité isolée (fonction)', 'l’infrastructure', 'la base de données'], 1),
  q('sh-25', 'technical', 'CI/CD', 'Que vise l’intégration continue (CI) ?', ['Déployer en prod automatiquement', 'Fusionner et tester fréquemment', 'Chiffrer les secrets', 'Gérer les tickets'], 1),
  q('sh-26', 'technical', 'Algorithmes', 'Complexité d’accès à un élément d’un tableau par index ?', ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], 0),
  q('sh-27', 'technical', 'Programmation', 'Une fonction récursive doit toujours avoir …', ['une boucle', 'un cas de base', 'un thread', 'une variable globale'], 1),
  q('sh-28', 'technical', 'SQL', 'En SQL, NULL signifie …', ['zéro', 'chaîne vide', 'absence de valeur', 'faux'], 2),
  q('sh-29', 'technical', 'Bases de données', 'La normalisation vise surtout à …', ['accélérer les lectures', 'réduire la redondance', 'chiffrer les données', 'dupliquer les tables'], 1),
  q('sh-30', 'technical', 'Concurrence', 'À quoi sert un mutex ?', ['Accélérer le CPU', 'Protéger une section critique', 'Compresser la mémoire', 'Créer des threads'], 1),
  q('sh-31', 'technical', 'API', 'Une API REST est généralement …', ['avec état', 'sans état (stateless)', 'monolithique', 'chiffrée par défaut'], 1),
  q('sh-32', 'technical', 'Données', 'Le format JSON représente …', ['du binaire', 'des paires clé/valeur textuelles', 'des images', 'du SQL'], 1),
];

// ---- Profile-specific technical ----
const PROFILE_TECH: Record<string, ExamQuestion[]> = {
  'Software Engineer': [
    q('se-1', 'technical', 'Design', 'Dans SOLID, le « S » signifie …', ['Simplicity', 'Single Responsibility', 'Separation', 'Stateless'], 1),
    q('se-2', 'technical', 'Structures de données', 'Insertion en fin d’une liste chaînée avec pointeur de queue ?', ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], 0),
    q('se-3', 'technical', 'Design Patterns', 'Quel pattern crée des objets sans exposer la logique d’instanciation ?', ['Singleton', 'Factory', 'Observer', 'Adapter'], 1),
    q('se-4', 'technical', 'Concurrence', 'Laquelle N’EST PAS une condition du deadlock ?', ['Exclusion mutuelle', 'Attente circulaire', 'Préemption des ressources', 'Détention et attente'], 2),
    q('se-5', 'technical', 'POO', 'Le polymorphisme permet …', ['de dupliquer le code', 'une même interface, des comportements différents', 'd’éviter les tests', 'de chiffrer les objets'], 1),
    q('se-6', 'technical', 'Algorithmes', 'Recherche dans un arbre binaire de recherche équilibré ?', ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], 1),
    q('se-7', 'technical', 'Programmation', 'Un objet immuable …', ['change souvent d’état', 'ne change pas d’état après création', 'n’a pas de type', 'est toujours global'], 1),
    q('se-8', 'technical', 'Bonnes pratiques', 'Le principe DRY signifie …', ['Do Repeat Yourself', 'Don’t Repeat Yourself', 'Deploy Rapidly Yearly', 'DebugReady Yet'], 1),
  ],
  'Java / Backend': [
    q('jb-1', 'technical', 'Collections', 'Quelle collection Java interdit les doublons ?', ['List', 'Set', 'Map', 'Array'], 1),
    q('jb-2', 'technical', 'Java Core', 'Le mot-clé `final` sur une variable …', ['la rend volatile', 'interdit sa réaffectation', 'la rend statique', 'la supprime'], 1),
    q('jb-3', 'technical', 'Spring', 'Quelle annotation injecte une dépendance ?', ['@Bean', '@Autowired', '@Entity', '@Table'], 1),
    q('jb-4', 'technical', 'JPA', 'Quelle annotation marque une entité persistante ?', ['@Repository', '@Entity', '@Service', '@Component'], 1),
    q('jb-5', 'technical', 'JVM', 'La JVM exécute …', ['du code natif', 'du bytecode', 'du C++', 'du SQL'], 1),
    q('jb-6', 'technical', 'Java Core', 'Si `a.equals(b)` est vrai, alors …', ['a == b', 'a.hashCode() == b.hashCode()', 'a et b sont null', 'a > b'], 1),
    q('jb-7', 'technical', 'Concurrence', 'On démarre un thread Java via …', ['run()', 'start()', 'exec()', 'launch()'], 1),
    q('jb-8', 'technical', 'REST', 'Quelle annotation Spring expose un contrôleur REST ?', ['@Controller', '@RestController', '@RequestBody', '@Configuration'], 1),
  ],
  Frontend: [
    q('fe-1', 'technical', 'React', 'Quel hook gère un état local ?', ['useEffect', 'useState', 'useRef', 'useContext'], 1),
    q('fe-2', 'technical', 'React', 'Quel hook gère un effet de bord ?', ['useMemo', 'useEffect', 'useState', 'useCallback'], 1),
    q('fe-3', 'technical', 'CSS', 'Quelle valeur active une disposition flexible ?', ['display:block', 'display:flex', 'position:absolute', 'float:left'], 1),
    q('fe-4', 'technical', 'JavaScript', 'L’opérateur `===` compare …', ['la valeur seulement', 'la valeur et le type', 'la référence seulement', 'le type seulement'], 1),
    q('fe-5', 'technical', 'Browser', 'Le DOM est …', ['un serveur', 'une représentation arborescente de la page', 'un langage', 'une base de données'], 1),
    q('fe-6', 'technical', 'TypeScript', 'TypeScript ajoute à JavaScript …', ['le multithreading', 'le typage statique', 'un serveur', 'un ORM'], 1),
    q('fe-7', 'technical', 'Accessibilité', 'Quel attribut fournit un texte alternatif à une image ?', ['title', 'alt', 'aria-role', 'label'], 1),
    q('fe-8', 'technical', 'React', 'Quel hook mémorise une valeur calculée coûteuse ?', ['useEffect', 'useMemo', 'useRef', 'useState'], 1),
  ],
  'Full Stack': [
    q('fs-1', 'technical', 'API', 'Une API REST échange le plus souvent en …', ['XML', 'JSON', 'CSV', 'binaire'], 1),
    q('fs-2', 'technical', 'Authentification', 'À quoi sert un JWT ?', ['chiffrer le disque', 'authentifier via un jeton signé', 'router le trafic', 'compresser'], 1),
    q('fs-3', 'technical', 'Sécurité web', 'CORS contrôle …', ['la mémoire', 'les requêtes cross-origin', 'les cookies tiers', 'le cache'], 1),
    q('fs-4', 'technical', 'Persistance', 'Un ORM sert à …', ['router les requêtes', 'mapper objets et tables relationnelles', 'chiffrer les données', 'gérer le cache'], 1),
    q('fs-5', 'technical', 'HTTP', 'Le code HTTP 401 signifie …', ['interdit', 'non authentifié', 'introuvable', 'erreur serveur'], 1),
    q('fs-6', 'technical', 'Back-end', 'Un middleware sert à …', ['stocker des données', 'intercepter/traiter les requêtes', 'compiler le code', 'chiffrer le disque'], 1),
    q('fs-7', 'technical', 'Déploiement', 'Le déploiement bleu-vert vise à …', ['doubler les coûts', 'réduire l’interruption de service', 'supprimer les tests', 'chiffrer'], 1),
    q('fs-8', 'technical', 'Bases de données', 'Une transaction ACID garantit …', ['seulement l’atomicité', 'atomicité, cohérence, isolation, durabilité', 'la vitesse', 'la réplication'], 1),
  ],
  'Data Engineer': [
    q('de-1', 'technical', 'ETL', 'Dans ETL, le « T » signifie …', ['Transfer', 'Transform', 'Trigger', 'Table'], 1),
    q('de-2', 'technical', 'Spark', 'Une transformation « lazy » Spark s’exécute …', ['immédiatement', 'lors d’une action', 'à la fermeture', 'jamais'], 1),
    q('de-3', 'technical', 'Modélisation', 'Dans un schéma en étoile, la table centrale est …', ['une dimension', 'la table de faits', 'une vue', 'un index'], 1),
    q('de-4', 'technical', 'Streaming', 'Kafka est …', ['une base relationnelle', 'un système de messagerie/streaming distribué', 'un ORM', 'un cache'], 1),
    q('de-5', 'technical', 'Data Warehouse', 'Un entrepôt de données est optimisé pour …', ['les transactions (OLTP)', 'l’analytique (OLAP)', 'le cache', 'les fichiers'], 1),
    q('de-6', 'technical', 'Pipelines', 'Le partitionnement des données sert à …', ['chiffrer', 'paralléliser et améliorer les performances', 'réduire la sécurité', 'supprimer les doublons'], 1),
    q('de-7', 'technical', 'SQL', '`GROUP BY` sert à …', ['trier', 'agréger par groupe', 'joindre', 'filtrer les colonnes'], 1),
    q('de-8', 'technical', 'Qualité', 'Un pipeline idempotent …', ['double les données à chaque exécution', 'peut être rejoué sans effet de bord', 'ne s’exécute qu’une fois', 'ignore les erreurs'], 1),
  ],
  'DevOps / Cloud': [
    q('do-1', 'technical', 'Conteneurs', 'Quelle commande construit une image à partir d’un Dockerfile ?', ['docker run', 'docker build', 'docker pull', 'docker exec'], 1),
    q('do-2', 'technical', 'Kubernetes', 'La plus petite unité déployable dans Kubernetes ?', ['Node', 'Pod', 'Service', 'Deployment'], 1),
    q('do-3', 'technical', 'IaC', 'Terraform est un outil d’…', ['infrastructure as code', 'orchestration de conteneurs', 'analyse de logs', 'CI'], 0),
    q('do-4', 'technical', 'CI/CD', 'Dans CI/CD, « CD » peut signifier …', ['Continuous Debugging', 'Continuous Delivery/Deployment', 'Central Database', 'Code Duplication'], 1),
    q('do-5', 'technical', 'Réseaux', 'Un load balancer sert à …', ['chiffrer', 'répartir le trafic entre instances', 'stocker des logs', 'compiler'], 1),
    q('do-6', 'technical', 'Observabilité', 'Logs, métriques et traces relèvent de …', ['la sécurité', 'l’observabilité', 'la compilation', 'le cache'], 1),
    q('do-7', 'technical', 'Kubernetes', 'À quoi sert `kubectl` ?', ['éditer du code', 'gérer un cluster Kubernetes', 'construire des images', 'router le DNS'], 1),
    q('do-8', 'technical', 'Scalabilité', 'L’auto-scaling ajuste …', ['le code source', 'le nombre d’instances selon la charge', 'les mots de passe', 'les DNS'], 1),
  ],
  Cybersecurity: [
    q('cy-1', 'technical', 'Bonnes pratiques', 'Le principe du moindre privilège signifie …', ['tout autoriser', 'accorder le minimum de droits nécessaires', 'désactiver les logs', 'partager les comptes'], 1),
    q('cy-2', 'technical', 'Cryptographie', 'Le chiffrement asymétrique utilise …', ['une seule clé', 'une paire clé publique/privée', 'aucune clé', 'un sel'], 1),
    q('cy-3', 'technical', 'Réseaux', 'Un pare-feu filtre …', ['la mémoire', 'le trafic réseau', 'le code source', 'les logs'], 1),
    q('cy-4', 'technical', 'Authentification', 'La 2FA renforce …', ['la vitesse', 'l’authentification via un second facteur', 'le chiffrement du disque', 'le cache'], 1),
    q('cy-5', 'technical', 'TLS', 'Un certificat TLS garantit …', ['la vitesse', 'l’identité du serveur et le chiffrement', 'la compression', 'l’indexation'], 1),
    q('cy-6', 'technical', 'Attaques', 'Une attaque par force brute …', ['injecte du SQL', 'essaie de nombreuses combinaisons', 'sature le réseau', 'lit la mémoire'], 1),
    q('cy-7', 'technical', 'Cryptographie', 'Le hachage sert surtout à …', ['chiffrer de façon réversible', 'vérifier l’intégrité', 'compresser', 'router'], 1),
    q('cy-8', 'technical', 'AppSec', 'L’OWASP Top 10 recense …', ['des langages', 'les risques de sécurité des applications web', 'des frameworks', 'des bases de données'], 1),
  ],
  'QA / Test': [
    q('qa-1', 'technical', 'Tests', 'Un test unitaire cible …', ['toute l’app', 'une unité isolée', 'l’UI complète', 'l’infra'], 1),
    q('qa-2', 'technical', 'Tests', 'Un test d’intégration vérifie …', ['une fonction seule', 'l’interaction entre composants', 'la syntaxe', 'le style'], 1),
    q('qa-3', 'technical', 'Méthodo', 'TDD signifie …', ['tester après le code', 'écrire le test avant le code', 'ne pas tester', 'tester en prod'], 1),
    q('qa-4', 'technical', 'Tests', 'Un test de régression vérifie …', ['la performance', 'qu’une correction ne casse pas l’existant', 'la sécurité', 'l’accessibilité'], 1),
    q('qa-5', 'technical', 'Couverture', 'La couverture de code mesure …', ['le nombre de bugs', 'la part de code exécutée par les tests', 'la vitesse', 'la taille'], 1),
    q('qa-6', 'technical', 'Automatisation', 'Un mock sert à …', ['accélérer le CPU', 'simuler une dépendance', 'chiffrer', 'déployer'], 1),
    q('qa-7', 'technical', 'Performance', 'Un test de charge évalue …', ['la sécurité', 'le comportement sous forte sollicitation', 'l’accessibilité', 'le style'], 1),
    q('qa-8', 'technical', 'Défauts', 'Un bug « bloquant » est …', ['cosmétique', 'de sévérité élevée empêchant l’usage', 'un warning', 'une amélioration'], 1),
  ],
  'Business Analyst IT': [
    q('ba-1', 'technical', 'Agile', 'Une user story suit le format …', ['« Si… alors… »', '« En tant que… je veux… afin de… »', '« Étant donné… »', '« Faire… »'], 1),
    q('ba-2', 'technical', 'BPMN', 'BPMN sert à …', ['coder', 'modéliser des processus métier', 'tester', 'déployer'], 1),
    q('ba-3', 'technical', 'UML', 'Le diagramme de cas d’utilisation décrit …', ['la base de données', 'les interactions acteurs/système', 'le réseau', 'le code'], 1),
    q('ba-4', 'technical', 'Recette', 'La recette (UAT) est réalisée par …', ['les développeurs', 'les utilisateurs/métier', 'les serveurs', 'les DBA'], 1),
    q('ba-5', 'technical', 'Exigences', 'Un critère d’acceptation définit …', ['le budget', 'quand une exigence est satisfaite', 'l’architecture', 'le planning'], 1),
    q('ba-6', 'technical', 'Exigences', 'Une exigence non fonctionnelle concerne …', ['une fonctionnalité', 'la performance, la sécurité, etc.', 'un bouton', 'un écran'], 1),
    q('ba-7', 'technical', 'Agile', 'Le backlog produit est priorisé par …', ['le Scrum Master', 'le Product Owner', 'le développeur', 'le client final'], 1),
    q('ba-8', 'technical', 'Priorisation', 'La méthode MoSCoW sert à …', ['estimer les coûts', 'prioriser les exigences', 'tester', 'déployer'], 1),
  ],
  'IT Project Manager': [
    q('pm-1', 'technical', 'Scrum', 'La durée typique d’un sprint est de …', ['1 jour', '1 à 4 semaines', '3 mois', '1 an'], 1),
    q('pm-2', 'technical', 'Planning', 'Le chemin critique est …', ['la tâche la moins chère', 'la plus longue séquence de tâches dépendantes', 'le premier jalon', 'le budget'], 1),
    q('pm-3', 'technical', 'Risques', 'Un risque se caractérise par …', ['sa couleur', 'sa probabilité et son impact', 'son coût seul', 'sa durée seule'], 1),
    q('pm-4', 'technical', 'Gestion', 'Le triangle projet regroupe …', ['coût, délai, périmètre', 'code, test, prod', 'client, équipe, sponsor', 'plan, do, check'], 0),
    q('pm-5', 'technical', 'Planning', 'Un jalon (milestone) est …', ['une tâche longue', 'un point de contrôle clé sans durée', 'un risque', 'un livrable payant'], 1),
    q('pm-6', 'technical', 'Scrum', 'Le rôle du Scrum Master est de …', ['écrire le code', 'faciliter et lever les obstacles', 'valider le budget', 'vendre le produit'], 1),
    q('pm-7', 'technical', 'Suivi', 'Un burndown chart montre …', ['le budget dépensé', 'le travail restant dans le temps', 'les bugs', 'les risques'], 1),
    q('pm-8', 'technical', 'Gouvernance', 'La matrice RACI définit …', ['les coûts', 'les responsabilités (R/A/C/I)', 'le planning', 'les risques'], 1),
  ],
};

// French aliases of the older catalog, for backwards compatibility.
const ALIASES: Record<string, string> = {
  'Développement Logiciel': 'Software Engineer',
  'Développement Web Full-Stack': 'Frontend',
  'Data Engineering': 'Data Engineer',
  'DevOps & Cloud': 'DevOps / Cloud',
  Cybersécurité: 'Cybersecurity',
  'Product Design (UX/UI)': 'Frontend',
};

export const PROFILE_NAMES = Object.keys(PROFILE_TECH);

function resolveProfile(name: string | null): string {
  if (!name) return 'Software Engineer';
  if (PROFILE_TECH[name]) return name;
  const alias = ALIASES[name];
  if (alias) return alias;
  const ci = PROFILE_NAMES.find((p) => p.toLowerCase() === name.toLowerCase());
  return ci ?? 'Software Engineer';
}

// Deterministic seeded shuffle so getExam and submitExam pick the SAME 30
// questions for an attempt (seed = assessment id), while different attempts get
// different sets.
function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const TECHNICAL_PER_EXAM = 20;
const PSYCHO_PER_EXAM = 10;

// A 30-question QCM for a specialty: profile-specific technical questions first,
// topped up with shared technical, plus the psychotechnical section.
export function examForSpecialty(
  specialtyName: string | null,
  seed = 'default',
): ExamQuestion[] {
  const profile = resolveProfile(specialtyName);
  const profileTech = seededShuffle(PROFILE_TECH[profile] ?? [], seed + ':pt');
  const sharedTech = seededShuffle(SHARED_TECH, seed + ':st');
  const technical = [...profileTech, ...sharedTech].slice(0, TECHNICAL_PER_EXAM);
  const psycho = seededShuffle(PSYCHO, seed + ':psy').slice(0, PSYCHO_PER_EXAM);
  return [...technical, ...psycho];
}
