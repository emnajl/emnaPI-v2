# Explication Detaillee Du Projet

## 1. Titre Du Projet

Module de gestion des ressources et reservations.

Le projet permet de :
- gerer les salles
- gerer les equipements
- faire des reservations
- valider ou refuser les demandes
- suivre les reservations cote utilisateur
- piloter le systeme cote administration
- appliquer un moteur de regles metier pour decider si une reservation est auto-approuvee, en attente, ou bloquee

---

## 2. Objectif Fonctionnel

L objectif du projet est de digitaliser la reservation de ressources dans un contexte scolaire ou universitaire.

Les ressources principales sont :
- les salles
- les equipements

Le systeme doit :
- eviter les conflits de reservation
- tenir compte des maintenances
- distinguer les reservations simples des reservations sensibles
- permettre un traitement administratif
- donner une interface moderne pour l utilisateur et l admin

---

## 3. Architecture Generale

Le projet est separe en 2 grandes parties :

1. Backend
- technologie : Spring Boot
- role : exposer les API REST, appliquer les regles metier, parler avec la base de donnees

2. Frontend
- technologie : Angular 21 + Angular Material + ApexCharts
- role : afficher les ecrans, recuperer les donnees backend, guider l utilisateur dans les actions

Le backend et le frontend communiquent en HTTP via des endpoints REST.

Flux general :
- le frontend envoie une requete au backend
- le backend applique les verifications et la logique metier
- le backend sauvegarde ou retourne une decision
- le frontend affiche le resultat a l utilisateur

---

## 4. Technologies Utilisees

### Backend

- Java 17
- Spring Boot 3.2.4
- Spring Web
- Spring Data JPA
- Hibernate
- MySQL
- Lombok
- JUnit 5
- Mockito

### Frontend

- Angular 21
- Angular Material
- FormsModule
- Standalone Components
- ng-apexcharts
- angular-tabler-icons
- SCSS

---

## 5. Structure Du Backend

Racine principale :
`src/main/java/com/example/reservation`

### Packages

#### `Controller`
Contient les classes REST qui recoivent les requetes HTTP.

- `RoomController`
- `EquipmentController`
- `ReservationController`
- `ReservationBlockPeriodController`

#### `Services`
Contient la logique metier.

- `RoomService`
- `EquipmentService`
- `ReservationService`
- `ReservationBlockPeriodService`

#### `Repository`
Contient l acces base de donnees avec JPA.

- `RoomRepository`
- `EquipmentRepository`
- `ReservationRepository`
- `ReservationBlockPeriodRepository`

#### `Entities`
Contient les modeles persistants.

- `Room`
- `Equipment`
- `Reservation`
- `ReservationBlockPeriod`

#### `Entities/Enums`
Contient les enumerations.

- `ReservationStatus`
- `ResourceStatus`
- `ReservationBlockType`

#### `Dto`
Contient les objets de transport utilises pour le preview des regles metier.

- `ReservationRulePreviewRequest`
- `ReservationRuleDecisionResponse`

---

## 6. Base De Donnees Et Entites

### 6.1 Entite `Room`

Fichier :
`src/main/java/com/example/reservation/Entities/Room.java`

Role :
representer une salle reservable.

Champs principaux :
- `id`
- `name`
- `capacity`
- `location`
- `status`

Le champ `status` permet de savoir si la salle est :
- `AVAILABLE`
- `UNAVAILABLE`
- `MAINTENANCE`

Usage metier :
- une salle indisponible ou en maintenance ne peut pas etre reservee
- une grande salle peut imposer une validation admin

### 6.2 Entite `Equipment`

Fichier :
`src/main/java/com/example/reservation/Entities/Equipment.java`

Role :
representer un equipement reservable.

Champs principaux :
- `id`
- `name`
- `type`
- `reference`
- `isSensitive`
- `status`

Le champ `isSensitive` est tres important.

Usage metier :
- si l equipement est sensible, la reservation n est pas auto approuvee
- elle passe par une validation administrative

### 6.3 Entite `Reservation`

Fichier :
`src/main/java/com/example/reservation/Entities/Reservation.java`

Role :
representer une reservation effectuee par un utilisateur.

Champs principaux :
- `id`
- `startTime`
- `endTime`
- `status`
- `userId`
- `validatedBy`
- `validatedAt`
- `validationComment`
- `room`
- `equipments`

Relations :
- une reservation peut avoir une salle : `ManyToOne`
- une reservation peut avoir plusieurs equipements : `ManyToMany`

Statuts de reservation :
- `PENDING`
- `APPROVED`
- `REJECTED`
- `CANCELLED`
- `MODIFICATION_REQUESTED`

### 6.4 Entite `ReservationBlockPeriod`

Fichier :
`src/main/java/com/example/reservation/Entities/ReservationBlockPeriod.java`

Role :
representer une periode pendant laquelle les reservations sont interdites.

Champs principaux :
- `id`
- `title`
- `type`
- `startTime`
- `endTime`
- `description`
- `active`

Types possibles :
- `HOLIDAY`
- `EXAM`
- `SPECIAL_EVENT`
- `GENERAL_MAINTENANCE`

Usage metier :
- bloquer automatiquement les reservations pendant un jour ferie
- bloquer pendant les examens
- bloquer pendant un evenement special
- bloquer pendant une maintenance generale

---

## 7. Repositories Et Requetes

### `ReservationRepository`

Fichier :
`src/main/java/com/example/reservation/Repository/ReservationRepository.java`

Il contient les requetes de detection de conflit.

#### Requete conflit salle
`findConflictingReservationsForRoom`

Elle cherche les reservations qui :
- concernent la meme salle
- ont un statut actif ou semi actif :
  - `APPROVED`
  - `PENDING`
  - `MODIFICATION_REQUESTED`
- se chevauchent dans le temps

#### Requete conflit equipement
`findConflictingReservationsForEquipment`

Meme idee mais pour les equipements.

### `ReservationBlockPeriodRepository`

Il contient une requete pour retrouver toutes les periodes bloquees actives qui chevauchent un creneau demande.

---

## 8. Logique Metier Du Backend

### 8.1 Gestion Des Salles

Service :
`RoomService`

Fonctions :
- creer une salle
- lire toutes les salles
- lire une salle par id
- modifier une salle
- supprimer une salle

Point important :
si une salle est deja liee a des reservations historiques, la suppression physique peut echouer.

Dans ce cas, le projet applique un `soft delete` logique :
- la salle est basculee en `UNAVAILABLE`
- on conserve l historique

C est tres important devant le prof :
cela protege l integrite des donnees historiques.

### 8.2 Gestion Des Equipements

Service :
`EquipmentService`

Fonctions :
- creer un equipement
- lire tous les equipements
- modifier un equipement
- supprimer un equipement

Comme pour les salles, si un equipement est deja utilise dans des reservations passees :
- on ne casse pas l historique
- on le met en `UNAVAILABLE`

### 8.3 Reservation Et Moteur De Regles

Service central :
`ReservationService`

C est la classe la plus importante du projet.

Elle fait deux choses :

1. `createReservation`
- cree reellement la reservation

2. `previewReservationRules`
- calcule la decision metier avant creation
- retourne au frontend si la demande est :
  - bloquee
  - auto approuvee
  - en attente de validation

#### Regles metier implementees

##### A. Validation des donnees
- il faut au moins une salle ou un equipement
- la date de debut doit etre dans le futur
- la date de fin doit etre apres la date de debut
- la duree maximale est de 8 heures

##### B. Auto approbation
La reservation est auto approuvee si :
- la salle est petite
- il n y a pas d equipement sensible
- le creneau est dans les horaires normaux
- la duree n est pas longue
- il n y a pas de conflit
- il n y a pas de periode bloquee

Le statut final devient alors :
- `APPROVED`

##### C. Validation obligatoire
La reservation passe en validation admin si au moins une condition suivante est vraie :
- la salle a une grande capacite
- le creneau est hors horaires normaux
- la reservation depasse le seuil de duree longue
- un equipement sensible est selectionne

Le statut final devient alors :
- `PENDING`

##### D. Blocage automatique
La reservation est refusee avant creation si :
- la ressource est en maintenance
- la ressource est indisponible
- il existe deja une reservation sur le creneau
- une periode bloquee recouvre le creneau

Dans ce cas :
- le backend lance une exception metier
- la reservation n est pas creee

##### E. Temps Tampon
Le moteur applique un temps tampon :
- 30 minutes avant
- 30 minutes apres

Cela signifie qu un conflit est detecte non seulement sur le creneau strict, mais aussi sur le creneau etendu.

Exemple :
- reservation existante : 10:00 -> 12:00
- avec temps tampon : 09:30 -> 12:30
- une nouvelle demande a 12:15 sera donc consideree comme conflictuelle

Cette regle est utile pour :
- preparation de salle
- nettoyage
- remise en etat
- installation du materiel

---

## 9. Endpoints REST Du Backend

### 9.1 Salles

Base :
`/api/rooms`

- `POST /api/rooms`
  - creer une salle
- `GET /api/rooms`
  - recuperer toutes les salles
- `GET /api/rooms/{id}`
  - recuperer une salle
- `PUT /api/rooms/{id}`
  - modifier une salle
- `DELETE /api/rooms/{id}`
  - supprimer ou desactiver logiquement

### 9.2 Equipements

Base :
`/api/equipments`

- `POST /api/equipments`
- `GET /api/equipments`
- `GET /api/equipments/{id}`
- `PUT /api/equipments/{id}`
- `DELETE /api/equipments/{id}`

### 9.3 Reservations

Base :
`/api/reservations`

- `POST /api/reservations`
  - creer une reservation reelle
- `POST /api/reservations/preview`
  - previsualiser la decision des regles metier
- `GET /api/reservations`
  - liste des reservations
- `PUT /api/reservations/{id}/validate`
  - validation admin
- `PUT /api/reservations/{id}/cancel`
  - annulation

### 9.4 Periodes Bloquees

Base :
`/api/reservation-block-periods`

- `GET /api/reservation-block-periods`
- `POST /api/reservation-block-periods`
- `PUT /api/reservation-block-periods/{id}`
- `DELETE /api/reservation-block-periods/{id}`

---

## 10. Frontend Angular

Le frontend principal de la soutenance est :
`frontend-v2`

### Architecture

Le frontend utilise :
- Angular standalone components
- Angular Material pour les formulaires, cartes, tableaux, selects, datepickers
- ApexCharts pour les graphiques
- un layout avec sidebar et routes

### Routage principal

Fichier :
`frontend-v2/src/app/pages/emna/emna.routes.ts`

Routes metier :
- `/emna/resources`
- `/emna/reserve`
- `/emna/my-reservations`
- `/emna/admin-validation`
- `/emna/admin-rooms`
- `/emna/admin-equipments`
- `/emna/admin-dashboard`

### Navigation laterale

Fichier :
`frontend-v2/src/app/layouts/full/sidebar/sidebar-data.ts`

La sidebar expose les ecrans du module :
- Dashboard Admin
- Equipements
- Salles
- Validation
- Ressources
- Reserver
- Mes Reservations

---

## 11. Pages Frontend En Detail

### 11.1 `ResourcesComponent`

Role :
- afficher le catalogue des salles et equipements
- permettre la recherche et les filtres
- permettre une reservation rapide

Fonctions visibles :
- recherche globale
- filtres par statut
- filtres par type
- capacite minimale
- filtrage du materiel sensible
- cartes resume

Usage :
permet a l utilisateur de preparer son choix avant de reserver.

### 11.2 `ReserveComponent`

C est la page la plus importante cote utilisateur.

Role :
- choisir salle et equipement
- choisir date et heure
- voir la decision metier avant soumission

Fonctions :
- date de debut et de fin
- presets de duree rapide : 1h, 2h, 4h
- suggestions de creneaux
- detection de conflit
- previsualisation du moteur de regles
- affichage des raisons de blocage
- affichage des raisons de validation admin
- affichage des notes metier

Fichiers importants :
- `frontend-v2/src/app/pages/emna/reserve/reserve.component.ts`
- `frontend-v2/src/app/pages/emna/reserve/reserve.component.html`

### 11.3 `MyReservationsComponent`

Role :
- permettre a l utilisateur de suivre ses reservations

Fonctions :
- recherche
- filtres
- tri
- timeline
- badges de statut
- badges temps reel :
  - a venir
  - en cours
  - terminee
- annulation
- affichage du retour admin

### 11.4 `AdminValidationComponent`

Role :
- permettre a l administration de traiter les reservations en attente

Fonctions :
- vue priorisee
- recherche
- filtre par priorite
- commentaire integre
- boutons :
  - approuver
  - refuser
  - demander modification
- notifications snackbars

Point important :
on a remplace l ancien `prompt()` navigateur par une vraie UI metier.

### 11.5 `AdminRoomsComponent`

Role :
- CRUD des salles

Fonctions :
- creation
- modification
- suppression
- rechargement de la liste

Point important :
si suppression impossible a cause de l historique, le backend fait une desactivation logique.

### 11.6 `AdminEquipmentsComponent`

Role :
- CRUD des equipements

Fonctions :
- creation
- modification
- suppression
- gestion du caractere sensible

### 11.7 `AdminDashboardComponent`

Role :
- donner une vue analytique au responsable

Fonctions :
- filtre de periode
- charge des reservations
- pics horaires
- top ressources
- repartition des statuts

Technologie :
- ApexCharts

---

## 12. Service Frontend De Communication

Fichier :
`frontend-v2/src/app/services/api.service.ts`

Role :
centraliser tous les appels HTTP vers le backend.

Exemples :
- recuperer les salles
- recuperer les equipements
- recuperer les reservations
- creer une reservation
- annuler
- valider
- previsualiser les regles de reservation

Avantage :
- le code est centralise
- les composants restent plus lisibles

---

## 13. Scenario Complet D Une Reservation

Voici le flux complet que tu peux expliquer demain.

### Etape 1
L utilisateur ouvre la page `Ressources` ou `Reserver`.

### Etape 2
Il choisit :
- une salle
- un equipement eventuel
- une date de debut
- une date de fin

### Etape 3
Le frontend appelle :
`POST /api/reservations/preview`

Le backend analyse :
- disponibilite des ressources
- conflits
- temps tampon
- horaires
- duree
- sensibilite du materiel
- grande salle
- periodes bloquees

### Etape 4
Le backend retourne une decision :

Cas 1 : auto approbation
- statut final prevu : `APPROVED`

Cas 2 : validation requise
- statut final prevu : `PENDING`

Cas 3 : blocage
- creation interdite

### Etape 5
Le frontend affiche a l utilisateur :
- la decision
- les raisons
- les notes

### Etape 6
Si l utilisateur valide :
- le frontend appelle `POST /api/reservations`
- le backend recrache la meme logique
- si tout est bon, la reservation est sauvegardee

### Etape 7
Si la reservation est en attente :
- l admin la voit dans `Admin validation`
- l admin peut approuver, refuser, ou demander modification

### Etape 8
L utilisateur voit le resultat dans `Mes reservations`

---

## 14. Pourquoi Le Projet Est Interressant Techniquement

Ce projet n est pas seulement un CRUD.

Il contient :

### 1. Une separation claire en couches
- controller
- service
- repository
- entity

### 2. Une vraie logique metier
- auto approbation
- validation conditionnelle
- blocage calendaire
- temps tampon
- conflits de ressources

### 3. Une traçabilite
- qui a valide
- quand
- commentaire admin

### 4. Une bonne conservation de l historique
- soft delete logique sur salles et equipements lies a des reservations passees

### 5. Un frontend moderne
- interface admin et utilisateur
- preview en temps reel
- analytics
- notifications UX

---

## 15. Ce Que Le Prof Peut Te Demander

### Question 1
"Pourquoi avoir mis la logique dans le service et pas dans le controller ?"

Reponse :
Parce que le controller doit juste recevoir et renvoyer les requetes HTTP.
La logique metier doit etre centralisee dans le service pour etre reutilisable, testable et plus propre.

### Question 2
"Pourquoi faire un endpoint preview ?"

Reponse :
Pour que l utilisateur voie avant la creation si la reservation sera acceptee, mise en attente ou refusee.
Cela ameliore l UX et evite des erreurs tardives.

### Question 3
"Comment evitez-vous les conflits de reservations ?"

Reponse :
Avec des requetes JPA qui verifient le chevauchement temporel sur la meme salle ou le meme equipement.
En plus, on applique un temps tampon avant et apres.

### Question 4
"Pourquoi un soft delete sur les salles et equipements ?"

Reponse :
Pour garder l historique des reservations passees.
Sinon on casserait la coherence des donnees.

### Question 5
"Quelle est la valeur ajoutee du moteur de regles ?"

Reponse :
Le projet ne fait pas juste stocker des reservations.
Il prend des decisions metier automatiques selon la nature de la ressource, la duree, les horaires et le calendrier.

### Question 6
"Pourquoi avoir separe salle et equipement ?"

Reponse :
Parce que ce sont deux ressources differentes.
Une reservation peut concerner une salle seule, un equipement seul, ou les deux.
Les regles et conflits peuvent aussi etre differents.

---

## 16. Limitations Actuelles

Le projet est deja solide, mais il reste des pistes d amelioration :

- pas encore de gestion reelle d authentification et roles securises
- `userId` et `adminId` sont encore simules
- les periodes bloquees existent cote backend mais pas encore en ecran admin dedie
- pas encore de notifications email ou SMS
- pas encore de gestion d utilisateurs par base de donnees

Tu peux dire au prof que ces points sont des evolutions naturelles du projet.

---

## 17. Tests

Le backend contient des tests, notamment :
- chargement du contexte Spring
- tests du moteur de regles de reservation

Exemples verifies :
- auto approbation petite salle
- validation obligatoire grande salle ou equipement sensible
- blocage en jour ferie
- blocage sur conflit avec temps tampon

Fichier important :
`src/test/java/com/example/reservation/Services/ReservationServiceTest.java`

---

## 18. Lancement Du Projet

### Backend

Depuis la racine :

```powershell
./mvnw spring-boot:run
```

Le backend tourne sur :
`http://localhost:8087`

### Frontend

Depuis `frontend-v2` :

```powershell
npm install
npm start
```

Le frontend tourne sur :
`http://localhost:4200`

### Base MySQL

Configuration :
`src/main/resources/application.properties`

Base :
- nom : `PI`
- port backend : `8087`

---

## 19. Resume Oral Simple Pour La Soutenance

Tu peux dire quelque chose comme :

"Mon projet est un module de gestion des ressources et reservations construit avec Spring Boot pour le backend et Angular pour le frontend. Le systeme permet de gerer les salles, les equipements et les reservations. La partie la plus importante est le moteur de regles metier : une reservation peut etre auto approuvee, mise en attente de validation admin, ou bloquee automatiquement. La decision depend de plusieurs facteurs comme la taille de la salle, la sensibilite du materiel, les horaires, la duree, les conflits et les periodes bloquees comme les examens ou jours feries. Le frontend permet a l utilisateur de previsualiser cette decision avant la creation de la reservation, puis de suivre le traitement de sa demande. Cote admin, on peut gerer les ressources, valider les demandes, et consulter un dashboard analytique." 

---

## 20. Conclusion

Ce projet est un vrai systeme de reservation avec :
- une base de donnees structuree
- une API REST propre
- une logique metier reelle
- un frontend moderne et exploitable

Le point fort principal du projet est qu il ne se limite pas a un CRUD.
Il prend des decisions metier et gere des cas realistes :
- validation conditionnelle
- blocage automatique
- temps tampon
- conservation de l historique
- suivi utilisateur
- pilotage admin

---

## 21. Conseils Pour Demain

- Commence toujours par l objectif fonctionnel
- Explique ensuite l architecture backend/frontend
- Montre les entites et leurs relations
- Insiste sur `ReservationService` car c est le coeur metier
- Montre ensuite le preview cote frontend
- Termine par le workflow complet utilisateur -> admin -> suivi

Si tu veux, je peux maintenant te preparer un deuxieme fichier plus court, style "fiche de revision orale 5 minutes", pour que tu puisses parler facilement demain sans relire tout le document.
