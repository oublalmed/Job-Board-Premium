// Static, platform-wide description of what the psychotechnical section
// of an évaluation covers — same doctrine as remediation-resources.ts:
// a fixed table here, an admin-managed referential is a later-phase
// concern. Every test uses the same composition (see webhook.service.ts's
// TECHNIQUE_WEIGHT_KEY/PSYCHOTECHNIQUE_WEIGHT_KEY), so this isn't
// per-test data — it's exposed once via GET /assessments/composition.
export const PSYCHOTECHNICAL_ITEM_TYPES = [
  'Suite logique de cartes',
  'Nombre manquant',
  "Degré d'un angle",
];
