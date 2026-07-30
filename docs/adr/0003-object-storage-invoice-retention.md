# 0003 — Criticité de l'archivage `ObjectStorage` : CV vs factures légales

## Statut

**Accepted** — 2026-07-31

## Contexte

`OBJECT_STORAGE` n'a jamais été relié à un client S3/MinIO réel dans l'historique de ce repo. `PortsModule` lie `StubObjectStorageAdapter` — une `Map` en mémoire, perdue à chaque redémarrage — depuis le Lot 1, alors que `docker-compose.yml` provisionne un vrai conteneur MinIO et que `storage.config.ts` porte une config S3 complète (`endpoint`/`accessKey`/`secretKey`/`bucket`/`region`) jamais consommée par un adaptateur réel. Les CV candidats tournent silencieusement sur ce stub depuis le Lot 1 ; les PDF de factures légales (Lot 6C, `InvoiceEmissionService`) héritent de la même limitation — signalé dans `PROGRESS.md` au moment de leur implémentation.

Ce document ne rouvre pas la décision de réutiliser le mécanisme existant pour le Lot 6C (décision correcte, prise sciemment). Il trace une distinction qui manquait dans le flag initial : les deux usages du stub n'ont pas la même criticité, et les traiter comme une seule ligne de dette masquerait un risque légal réel derrière un risque de confort.

## Risque

**CV / documents candidats.** Une perte au redémarrage est récupérable : le candidat re-upload son CV. Dette réelle (UX dégradée, friction), mais sans conséquence irréversible.

**Factures légales.** Une facture émise par `InvoiceEmissionService` contre un paiement Stripe réel, puis archivée dans un stub volatile, disparaît au premier redémarrage — et la loi marocaine impose la conservation des factures (de l'ordre de 10 ans). Ce n'est pas une fonctionnalité incomplète : c'est un document légal qui, après coup, n'existe pas. La numérotation gap-free (Lot 6C) garantit qu'aucun numéro n'est sauté, mais elle ne garantit rien sur la survie du PDF lui-même une fois émis — les deux garanties sont indépendantes, et seule la seconde est concernée ici.

La différence n'est pas de degré, elle est de nature : un CV perdu est un problème de service ; une facture légale perdue est une non-conformité fiscale.

## Décision

Le stub reste acceptable **pour le développement du Lot 6C** — la logique de numérotation, de calcul HT/TVA/TTC et d'archivage est correcte et testée derrière l'interface `ObjectStorage`, indépendamment de l'adaptateur qui la sert. Ce qui change avec ce document, c'est le seuil auquel chaque usage devient bloquant :

- **CV** : bloquant avant tout environnement partagé (staging/prod), comme toute autre donnée utilisateur non triviale — cohérent avec le traitement standard de ce type de dette dans ce repo.
- **Factures légales** : bloquant dès la **première facture émise contre un paiement Stripe réel** — un seuil strictement antérieur à « environnement partagé » en général. Il ne s'agit pas d'un déploiement de test avec des données factices : dès qu'un paiement réel déclenche `InvoiceEmissionService.emit`, le PDF produit doit survivre, ou la facture n'a legalement pas été émise malgré ce que la base de données affirme.

## Conséquence de séquencement

L'archivage S3 réel doit être en place **avant** que le webhook de paiement (checkout ou `invoice.paid` récurrent, Lot 6D) ne tourne contre un compte Stripe encaissant réellement — c'est un prérequis du même jalon que la confirmation de disponibilité Stripe au Maroc (voir `PROGRESS.md`, Lot 6, risque Stripe Maroc/MAD), pas une dette différable indépendamment. Les deux conditions (PSP confirmé, storage réel) doivent être vraies simultanément avant le premier encaissement réel — aucune des deux seule ne suffit à autoriser la mise en production.

## Trigger de résorption

Résorber avant le premier des deux événements suivants :

1. **Premier paiement réel traité** (même en pilote/bêta à enjeu limité) — condition strictement bloquante pour la partie facturation, indépendamment de l'état du reste du produit.
2. **Préparation d'un déploiement en environnement partagé** (staging ou production) — condition qui s'applique de toute façon à l'ensemble du stockage (CV inclus), cohérente avec le seuil déjà documenté pour la dette CV.

## Conséquences

- **Positif** : la gradation de criticité est explicite — une revue future ne traite plus « storage stub » comme une ligne de dette homogène, et ne découvre pas après coup qu'une facture réelle a été émise sur un stockage volatile.
- **Négatif** : aucun changement de code n'accompagne ce document — le risque reste ouvert, seule sa priorité relative est maintenant tracée sans ambiguïté.
- **Portée** : la résorption (adaptateur S3/MinIO réel derrière `ObjectStorage`) est un chantier d'infrastructure à part entière, de même nature que le chantier baseline de l'ADR-0002 — pas une tâche à absorber dans un lot fonctionnel.
