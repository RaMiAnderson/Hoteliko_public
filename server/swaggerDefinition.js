const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const arrayOf = (schema) => ({
  type: "array",
  items: schema,
});

const jsonContent = (schema) => ({
  "application/json": {
    schema,
  },
});

const requestBody = (schema, required = true, description = "") => {
  const body = {
    required,
    content: jsonContent(schema),
  };
  if (description) body.description = description;
  return body;
};

const response = (description, schema) => {
  if (!schema) return { description };
  return {
    description,
    content: jsonContent(schema),
  };
};

const idParam = (name = "id", description = "Identifiant") => ({
  name,
  in: "path",
  required: true,
  description,
  schema: {
    type: "integer",
    example: 1,
  },
});

const queryParam = (name, schema, description, required = false) => ({
  name,
  in: "query",
  required,
  description,
  schema,
});

const badRequest = {
  400: response("Requete invalide", ref("Error")),
};

const notFound = {
  404: response("Ressource introuvable", ref("Error")),
};

const conflict = {
  409: response("Conflit metier ou donnees deja existantes", ref("Error")),
};

const serverError = {
  500: response("Erreur serveur", ref("Error")),
};

const writeResultResponse = response("Resultat MySQL de l'operation", ref("DbWriteResult"));
const messageResponse = response("Operation reussie", ref("Message"));
const createdWithIdResponse = response("Ressource creee", ref("CreatedWithId"));

const createSwaggerDefinition = (port = 8050) => ({
  openapi: "3.0.0",
  info: {
    title: "Hoteliko API",
    version: "1.0.0",
    description: "Documentation des endpoints REST du serveur Hoteliko.",
  },
  servers: [
    {
      url: `http://localhost:${port}`,
      description: "Serveur local",
    },
  ],
  tags: [
    { name: "Auth", description: "Connexion et verification utilisateur" },
    { name: "Articles", description: "Gestion du stock d'articles" },
    { name: "Clients", description: "Gestion des clients" },
    { name: "Fournisseurs", description: "Gestion des fournisseurs" },
    { name: "Chambres", description: "Gestion des chambres, reservations et occupations" },
    { name: "Tickets", description: "Gestion des tickets et des ventes" },
    { name: "Dashboard", description: "Statistiques et indicateurs" },
    { name: "Realtime", description: "Flux temps reel Server-Sent Events" },
    { name: "User Management", description: "Gestion des utilisateurs" },
  ],
  components: {
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "string",
            example: "Erreur lors de la recuperation des donnees",
          },
          message: {
            type: "string",
            example: "Erreur serveur",
          },
          success: {
            type: "boolean",
            example: false,
          },
        },
      },
      Message: {
        type: "object",
        properties: {
          message: {
            type: "string",
            example: "Operation effectuee avec succes",
          },
        },
      },
      CreatedWithId: {
        type: "object",
        properties: {
          message: {
            type: "string",
            example: "Ressource creee avec succes",
          },
          id: {
            type: "integer",
            example: 1,
          },
        },
      },
      DbWriteResult: {
        type: "object",
        properties: {
          affectedRows: { type: "integer", example: 1 },
          insertId: { type: "integer", example: 12 },
          warningStatus: { type: "integer", example: 0 },
        },
      },
      AuthUser: {
        type: "object",
        properties: {
          username: { type: "string", example: "admin" },
          fonction: { type: "string", example: "Admin" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["username", "password"],
        properties: {
          username: { type: "string", example: "admin" },
          password: { type: "string", format: "password", example: "secret" },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          msg: { type: "string", example: "Connexion reussi" },
          user: ref("AuthUser"),
          token: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
        },
      },
      VerifyUserRequest: {
        type: "object",
        required: ["username"],
        properties: {
          username: { type: "string", example: "admin" },
        },
      },
      UserInfo: {
        type: "object",
        additionalProperties: true,
        properties: {
          id: { type: "integer", example: 1 },
          nom: { type: "string", example: "Rakoto" },
          prenom: { type: "string", example: "Rabe" },
          username: { type: "string", example: "rakoto" },
          fonction: { type: "string", example: "Admin" },
          password: { type: "string", example: "" },
        },
      },
      Article: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          designation: { type: "string", example: "Eau minerale" },
          type: { type: "string", example: "Boisson" },
          qt: { type: "integer", example: 24 },
          mesure: { type: "string", example: "bouteille" },
          achat: { type: "number", format: "float", example: 1200 },
          vente: { type: "number", format: "float", example: 2000 },
          seuil: { type: "integer", example: 5 },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      ArticleInput: {
        type: "object",
        required: ["designation", "type", "qt", "mesure", "achat", "vente", "seuil"],
        properties: {
          designation: { type: "string", example: "Eau minerale" },
          type: { type: "string", example: "Boisson" },
          qt: { type: "integer", minimum: 0, example: 24 },
          mesure: { type: "string", example: "bouteille" },
          achat: { type: "number", minimum: 0, example: 1200 },
          vente: { type: "number", minimum: 0, example: 2000 },
          seuil: { type: "integer", minimum: 0, example: 5 },
        },
      },
      ArticleUpdate: {
        type: "object",
        minProperties: 1,
        properties: {
          designation: { type: "string", example: "Eau minerale 1L" },
          type: { type: "string", example: "Boisson" },
          qt: { type: "integer", minimum: 0, example: 30 },
          mesure: { type: "string", example: "bouteille" },
          achat: { type: "number", minimum: 0, example: 1200 },
          vente: { type: "number", minimum: 0, example: 2200 },
          seuil: { type: "integer", minimum: 0, example: 10 },
        },
      },
      Client: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          nom: { type: "string", example: "Rakoto" },
          prenom: { type: "string", example: "Jean" },
          genre: { type: "string", nullable: true, example: "Homme" },
          numClient: { type: "string", example: "cl-1710000000" },
          numberCNI: { type: "string", nullable: true, example: "123456789012" },
          dateCNI: { type: "string", format: "date", nullable: true },
          lieuCNI: { type: "string", nullable: true, example: "Antananarivo" },
          numTel: { type: "string", example: "0340000000" },
          adresse: { type: "string", example: "Antananarivo" },
          total_achat: { type: "number", example: 0 },
          total_reste: { type: "number", example: 0 },
          created_at: { type: "string", format: "date-time" },
        },
      },
      ClientCreate: {
        type: "object",
        required: ["nom", "adresse", "numTel"],
        properties: {
          nom: { type: "string", example: "Rakoto" },
          prenom: { type: "string", example: "Jean" },
          genre: { type: "string", nullable: true, example: "Homme" },
          numClient: { type: "string", example: "cl-1710000000" },
          numberCNI: { type: "string", nullable: true, example: "123456789012" },
          dateCNI: { type: "string", format: "date", nullable: true },
          lieuCNI: { type: "string", nullable: true, example: "Antananarivo" },
          numTel: { type: "string", example: "0340000000" },
          contact: { type: "string", description: "Alias accepte pour numTel", example: "0340000000" },
          adresse: { type: "string", example: "Antananarivo" },
        },
      },
      ClientUpdate: {
        type: "object",
        required: ["nom", "adresse", "numTel"],
        properties: {
          nom: { type: "string", example: "Rakoto" },
          adresse: { type: "string", example: "Antananarivo" },
          numTel: { type: "string", example: "0340000000" },
          contact: { type: "string", description: "Alias accepte pour numTel", example: "0340000000" },
        },
      },
      Fournisseur: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          nom: { type: "string", example: "Grossiste Mada" },
          adresse: { type: "string", example: "Analakely" },
          contact: { type: "string", example: "0340000000" },
          genre: { type: "string", nullable: true, example: null },
          total: { type: "number", example: 0 },
          date_du_reste: { type: "string", format: "date", nullable: true },
          total_reste: { type: "number", example: 0 },
          created_at: { type: "string", format: "date-time" },
        },
      },
      FournisseurInput: {
        type: "object",
        required: ["nom", "adresse", "contact"],
        properties: {
          nom: { type: "string", example: "Grossiste Mada" },
          adresse: { type: "string", example: "Analakely" },
          contact: { type: "string", example: "0340000000" },
        },
      },
      Chambre: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          numero: { type: "string", example: "101" },
          type: { type: "string", example: "Standard" },
          capacite: { type: "integer", example: 2 },
          prix_nuit: { type: "number", example: 80000 },
          statut: {
            type: "string",
            enum: ["libre", "reservee", "occupee", "maintenance"],
            example: "libre",
          },
          description: { type: "string", nullable: true, example: "Chambre double" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
          occupation_id: { type: "integer", nullable: true, example: 3 },
          client_id: { type: "integer", nullable: true, example: 2 },
          occupant_nom: { type: "string", nullable: true, example: "Rakoto Jean" },
          occupant_contact: { type: "string", nullable: true, example: "0340000000" },
          occupant_cin: { type: "string", nullable: true, example: "123456789012" },
          type_occupation: {
            type: "string",
            enum: ["reservation", "occupation"],
            nullable: true,
            example: "occupation",
          },
          type_sejour: {
            type: "string",
            enum: ["nuit", "passage", "journee"],
            nullable: true,
            example: "nuit",
          },
          date_debut: { type: "string", format: "date-time", nullable: true },
          date_fin_prevue: { type: "string", format: "date-time", nullable: true },
          montant_total: { type: "number", nullable: true, example: 80000 },
          montant_acompte: { type: "number", nullable: true, example: 20000 },
          montant_solde: { type: "number", nullable: true, example: null },
          occupation_note: { type: "string", nullable: true, example: null },
          client_nom: { type: "string", nullable: true, example: "Rakoto Jean" },
          client_num_tel: { type: "string", nullable: true, example: "0340000000" },
          client_cin: { type: "string", nullable: true, example: "123456789012" },
        },
      },
      ChambreInput: {
        type: "object",
        required: ["numero", "type", "capacite", "prix_nuit"],
        properties: {
          numero: { type: "string", example: "101" },
          type: { type: "string", example: "Standard" },
          capacite: { type: "integer", minimum: 1, example: 2 },
          prix_nuit: { type: "number", minimum: 0, example: 80000 },
          statut: {
            type: "string",
            enum: ["libre", "maintenance"],
            description: "Accepte surtout a la creation. Les statuts reservee/occupee sont geres par les occupations.",
            example: "libre",
          },
          description: { type: "string", nullable: true, example: "Chambre double" },
        },
      },
      ChambreStatusUpdate: {
        type: "object",
        required: ["statut"],
        properties: {
          statut: {
            type: "string",
            enum: ["libre", "maintenance"],
            example: "maintenance",
          },
        },
      },
      RoomHourlyPrice: {
        type: "object",
        required: ["type", "prix_heure"],
        properties: {
          type: { type: "string", example: "Standard" },
          prix_heure: { type: "number", minimum: 0, example: 10000 },
        },
      },
      RoomDayPrice: {
        type: "object",
        required: ["type", "prix_journee"],
        properties: {
          type: { type: "string", example: "Standard" },
          prix_journee: { type: "number", minimum: 0, example: 50000 },
        },
      },
      RoomNightPrice: {
        type: "object",
        required: ["type", "prix_nuit"],
        properties: {
          type: { type: "string", example: "Standard" },
          prix_nuit: { type: "number", minimum: 0, example: 80000 },
        },
      },
      ChambreCondition: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          checkin_time: { type: "string", example: "13:00" },
          checkout_time: { type: "string", example: "09:00" },
          day_checkin_time: { type: "string", example: "08:00" },
          day_checkout_time: { type: "string", example: "18:00" },
          cin_required_reservation: { type: "boolean", example: true },
          cin_required_occupation: { type: "boolean", example: true },
          deposit_percent: { type: "number", minimum: 0, maximum: 100, example: 30 },
          hourly_prices: arrayOf(ref("RoomHourlyPrice")),
          day_prices: arrayOf(ref("RoomDayPrice")),
          nightly_prices: arrayOf(ref("RoomNightPrice")),
        },
      },
      ChambreConditionUpdate: {
        type: "object",
        properties: {
          checkin_time: { type: "string", description: "Format HH:MM", example: "13:00" },
          checkout_time: { type: "string", description: "Format HH:MM", example: "09:00" },
          day_checkin_time: { type: "string", description: "Format HH:MM", example: "08:00" },
          day_checkout_time: { type: "string", description: "Format HH:MM", example: "18:00" },
          cin_required_reservation: { type: "boolean", example: true },
          cin_required_occupation: { type: "boolean", example: true },
          deposit_percent: { type: "number", minimum: 0, maximum: 100, example: 30 },
          hourly_prices: {
            type: "array",
            description: "Liste recommandee. Le serveur accepte aussi un objet cle/valeur.",
            items: ref("RoomHourlyPrice"),
          },
          day_prices: {
            type: "array",
            description: "Liste recommandee. Le serveur accepte aussi un objet cle/valeur.",
            items: ref("RoomDayPrice"),
          },
          nightly_prices: {
            type: "array",
            description: "Liste recommandee. Le serveur accepte aussi un objet cle/valeur.",
            items: ref("RoomNightPrice"),
          },
        },
      },
      ChambreOccupationRequest: {
        type: "object",
        required: ["mode"],
        properties: {
          mode: {
            type: "string",
            enum: ["reservation", "occupation"],
            example: "reservation",
          },
          type_sejour: {
            type: "string",
            enum: ["nuit", "passage", "journee"],
            example: "nuit",
          },
          stay_type: {
            type: "string",
            enum: ["nuit", "passage", "journee"],
            description: "Alias accepte pour type_sejour",
            example: "nuit",
          },
          client_id: { type: "integer", nullable: true, example: 1 },
          occupant_nom: { type: "string", example: "Rakoto Jean" },
          occupant_contact: { type: "string", nullable: true, example: "0340000000" },
          occupant_cin: { type: "string", nullable: true, example: "123456789012" },
          date_debut: { type: "string", format: "date-time", example: "2026-06-03T13:00:00" },
          date_fin_prevue: { type: "string", format: "date-time", nullable: true, example: "2026-06-04T09:00:00" },
          montant_acompte: { type: "number", minimum: 0, example: 20000 },
          occupation_id: { type: "integer", description: "Occupation/reservation cible a modifier ou convertir", example: 3 },
          reservation_id: { type: "integer", description: "Alias accepte pour occupation_id", example: 3 },
          check_only: { type: "boolean", description: "Verifie uniquement la disponibilite", example: false },
          note: { type: "string", nullable: true, example: "Arrivee tardive" },
        },
      },
      ChambreReleaseRequest: {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: ["checkout", "cancel", "no_show"],
            example: "checkout",
          },
          occupation_id: { type: "integer", example: 3 },
          reservation_id: { type: "integer", description: "Alias accepte pour occupation_id", example: 3 },
          montant_recu: { type: "number", minimum: 0, example: 60000 },
          note: { type: "string", nullable: true, example: "RAS" },
        },
      },
      ChambrePaymentRequest: {
        type: "object",
        required: ["occupation_id", "montant_recu"],
        properties: {
          occupation_id: { type: "integer", example: 3 },
          reservation_id: { type: "integer", description: "Alias accepte pour occupation_id", example: 3 },
          montant_recu: { type: "number", minimum: 0, example: 30000 },
        },
      },
      ChambrePaymentResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Paiement enregistre" },
          montant_recu: { type: "number", example: 30000 },
        },
      },
      ChambreOccupationHistory: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          chambre_id: { type: "integer", example: 1 },
          numero: { type: "string", example: "101" },
          type: { type: "string", example: "Standard" },
          capacite: { type: "integer", example: 2 },
          prix_nuit: { type: "number", example: 80000 },
          prix_heure: { type: "number", nullable: true, example: 10000 },
          prix_journee: { type: "number", nullable: true, example: 50000 },
          client_id: { type: "integer", nullable: true, example: 1 },
          occupant_nom: { type: "string", example: "Rakoto Jean" },
          occupant_contact: { type: "string", nullable: true, example: "0340000000" },
          occupant_cin: { type: "string", nullable: true, example: "123456789012" },
          type_occupation: { type: "string", enum: ["reservation", "occupation"], example: "occupation" },
          type_sejour: { type: "string", enum: ["nuit", "passage", "journee"], example: "nuit" },
          date_debut: { type: "string", format: "date-time" },
          date_fin_prevue: { type: "string", format: "date-time", nullable: true },
          date_fin_reelle: { type: "string", format: "date-time", nullable: true },
          montant_total: { type: "number", nullable: true, example: 80000 },
          montant_acompte: { type: "number", nullable: true, example: 20000 },
          date_acompte: { type: "string", format: "date-time", nullable: true },
          montant_solde: { type: "number", nullable: true, example: 60000 },
          date_solde: { type: "string", format: "date-time", nullable: true },
          statut: { type: "string", enum: ["active", "terminee", "annulee"], example: "active" },
          note: { type: "string", nullable: true, example: null },
          created_at: { type: "string", format: "date-time" },
          client_nom: { type: "string", nullable: true, example: "Rakoto Jean" },
          client_num_tel: { type: "string", nullable: true, example: "0340000000" },
          client_cin: { type: "string", nullable: true, example: "123456789012" },
        },
      },
      Ticket: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          client_id: { type: "integer", nullable: true, example: 1 },
          table_num: { type: "string", nullable: true, example: "T1" },
          servi_par: { type: "string", nullable: true, example: "Serveur 1" },
          date_ticket: { type: "string", format: "date-time" },
          total_ticket: { type: "number", example: 45000 },
          montant_paye: { type: "number", example: 20000 },
          reste: { type: "number", example: 25000 },
          type_paiement: { type: "string", enum: ["comptant", "attente", "credit"], example: "attente" },
          mode_paiement: { type: "string", enum: ["espece", "mobile_money", "autre"], example: "espece" },
          created_at: { type: "string", format: "date-time" },
          client_nom: { type: "string", example: "Rakoto Jean" },
        },
      },
      TicketItem: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          ticket_id: { type: "integer", example: 1 },
          article_id: { type: "integer", nullable: true, example: 2 },
          designation: { type: "string", example: "Eau minerale" },
          qt: { type: "integer", example: 2 },
          prix_u: { type: "number", example: 2000 },
          prix_total: { type: "number", example: 4000 },
          mesure: { type: "string", example: "bouteille" },
        },
      },
      TicketCreateItem: {
        type: "object",
        required: ["ID", "designation", "qt", "vente"],
        properties: {
          ID: { type: "integer", description: "Identifiant de l'article", example: 2 },
          designation: { type: "string", example: "Eau minerale" },
          qt: { type: "integer", minimum: 1, example: 2 },
          vente: { type: "number", minimum: 0, example: 2000 },
        },
      },
      TicketCreateRequest: {
        type: "object",
        required: ["client_id", "type_paiement", "items"],
        properties: {
          client_id: { type: "integer", example: 1 },
          table_num: { type: "string", nullable: true, example: "T1" },
          servi_par: { type: "string", nullable: true, example: "Serveur 1" },
          type_paiement: { type: "string", enum: ["comptant", "attente"], example: "attente" },
          mode_paiement: { type: "string", enum: ["espece", "mobile_money", "autre"], example: "espece" },
          montant_paye: { type: "number", minimum: 0, example: 20000 },
          total_ticket: { type: "number", minimum: 0, example: 45000 },
          montant_a_rendre: { type: "number", minimum: 0, example: 0 },
          items: arrayOf(ref("TicketCreateItem")),
        },
      },
      TicketAddItemRequest: {
        type: "object",
        required: ["article_id", "qt"],
        properties: {
          article_id: { type: "integer", example: 2 },
          qt: { type: "integer", minimum: 1, example: 1 },
        },
      },
      TicketUpdateItemRequest: {
        type: "object",
        required: ["qt"],
        properties: {
          qt: { type: "integer", minimum: 1, example: 3 },
        },
      },
      TicketPaymentRequest: {
        type: "object",
        required: ["montant_recu"],
        properties: {
          montant_recu: { type: "number", minimum: 0, example: 25000 },
        },
      },
      TicketPaymentResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Ticket paye" },
          montant_applique: { type: "number", example: 25000 },
          montant_a_rendre: { type: "number", example: 0 },
          reste: { type: "number", example: 0 },
          statut: { type: "string", example: "paye" },
        },
      },
      DashboardOverview: {
        type: "object",
        properties: {
          period: {
            type: "object",
            properties: {
              startDate: { type: "string", format: "date", example: "2026-06-01" },
              endDate: { type: "string", format: "date", example: "2026-06-03" },
            },
          },
          kpis: {
            type: "object",
            properties: {
              vente: { type: "number", example: 150000 },
              revient: { type: "number", example: 70000 },
              depense: { type: "number", example: 10000 },
              encaisses: { type: "number", example: 120000 },
              aEncaisser: { type: "number", example: 30000 },
              benefices: { type: "number", example: 70000 },
              encaissement: {
                type: "object",
                properties: {
                  espece: { type: "number", example: 80000 },
                  mobile_money: { type: "number", example: 40000 },
                  autre: { type: "number", example: 0 },
                },
              },
              recette: {
                type: "object",
                properties: {
                  vente: { type: "number", example: 120000 },
                  revientEncaisse: { type: "number", example: 55000 },
                  beneficeEncaisse: { type: "number", example: 65000 },
                },
              },
            },
          },
          chart: arrayOf(ref("DashboardChartPoint")),
          articles: arrayOf(ref("DashboardArticleStats")),
        },
      },
      DashboardChartPoint: {
        type: "object",
        properties: {
          date: { type: "string", example: "2026-06-03 08:00" },
          label: { type: "string", example: "08h" },
          value: { type: "number", example: 25000 },
        },
      },
      DashboardArticleStats: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          designation: { type: "string", example: "Eau minerale" },
          qt_stock: { type: "number", example: 20 },
          qt_vendu: { type: "number", example: 4 },
          prix_u: { type: "number", example: 2000 },
          prix_total_reste: { type: "number", example: 40000 },
        },
      },
      UserCreateRequest: {
        type: "object",
        description: "Schema indicatif: la route est declaree mais aucun controleur n'est branche dans le serveur actuel.",
        properties: {
          nom: { type: "string", example: "Rakoto" },
          prenom: { type: "string", example: "Jean" },
          username: { type: "string", example: "jrkt" },
          password: { type: "string", format: "password", example: "secret" },
          fonction: { type: "string", example: "Reception" },
        },
      },
    },
  },
  paths: {
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Connecter un utilisateur",
        requestBody: requestBody(ref("LoginRequest")),
        responses: {
          200: response("Connexion traitee", ref("LoginResponse")),
          ...serverError,
        },
      },
    },
    "/api/auth/verifyUser": {
      post: {
        tags: ["Auth"],
        summary: "Verifier et recuperer un utilisateur",
        requestBody: requestBody(ref("VerifyUserRequest")),
        responses: {
          200: response("Utilisateur trouve", ref("UserInfo")),
          ...serverError,
        },
      },
    },
    "/api/articles": {
      post: {
        tags: ["Articles"],
        summary: "Ajouter un article",
        requestBody: requestBody(ref("ArticleInput")),
        responses: {
          200: writeResultResponse,
          ...serverError,
        },
      },
    },
    "/api/articles/all": {
      get: {
        tags: ["Articles"],
        summary: "Lister tous les articles",
        responses: {
          200: response("Liste des articles", arrayOf(ref("Article"))),
          ...serverError,
        },
      },
    },
    "/api/articles/search": {
      get: {
        tags: ["Articles"],
        summary: "Rechercher des articles par designation",
        parameters: [
          queryParam("designation", { type: "string", example: "eau" }, "Designation ou partie de designation", true),
        ],
        responses: {
          200: response("Articles correspondants", arrayOf(ref("Article"))),
          ...badRequest,
          ...serverError,
        },
      },
    },
    "/api/articles/{id}": {
      patch: {
        tags: ["Articles"],
        summary: "Modifier un article",
        parameters: [idParam("id", "Identifiant de l'article")],
        requestBody: requestBody(ref("ArticleUpdate")),
        responses: {
          200: messageResponse,
          ...badRequest,
          ...notFound,
          ...serverError,
        },
      },
      delete: {
        tags: ["Articles"],
        summary: "Supprimer un article",
        parameters: [idParam("id", "Identifiant de l'article")],
        responses: {
          200: messageResponse,
          ...notFound,
          ...serverError,
        },
      },
    },
    "/api/clients/all": {
      get: {
        tags: ["Clients"],
        summary: "Lister tous les clients",
        responses: {
          200: response("Liste des clients", arrayOf(ref("Client"))),
          ...serverError,
        },
      },
    },
    "/api/clients/search": {
      get: {
        tags: ["Clients"],
        summary: "Rechercher des clients par nom",
        parameters: [
          queryParam("nom", { type: "string", example: "Rakoto" }, "Nom ou nom complet partiel", true),
        ],
        responses: {
          200: response("Clients correspondants", arrayOf(ref("Client"))),
          ...badRequest,
          ...serverError,
        },
      },
    },
    "/api/clients": {
      post: {
        tags: ["Clients"],
        summary: "Creer un client",
        requestBody: requestBody(ref("ClientCreate")),
        responses: {
          201: createdWithIdResponse,
          ...badRequest,
          ...conflict,
          ...serverError,
        },
      },
    },
    "/api/clients/{id}": {
      patch: {
        tags: ["Clients"],
        summary: "Modifier un client",
        parameters: [idParam("id", "Identifiant du client")],
        requestBody: requestBody(ref("ClientUpdate")),
        responses: {
          200: messageResponse,
          ...badRequest,
          ...notFound,
          ...conflict,
          ...serverError,
        },
      },
      delete: {
        tags: ["Clients"],
        summary: "Supprimer un client",
        parameters: [idParam("id", "Identifiant du client")],
        responses: {
          200: messageResponse,
          ...badRequest,
          ...notFound,
          ...conflict,
          ...serverError,
        },
      },
    },
    "/api/fournisseurs/all": {
      get: {
        tags: ["Fournisseurs"],
        summary: "Lister tous les fournisseurs",
        responses: {
          200: response("Liste des fournisseurs", arrayOf(ref("Fournisseur"))),
          ...serverError,
        },
      },
    },
    "/api/fournisseurs/search": {
      get: {
        tags: ["Fournisseurs"],
        summary: "Rechercher des fournisseurs par nom",
        parameters: [
          queryParam("nom", { type: "string", example: "Grossiste" }, "Nom ou partie de nom", true),
        ],
        responses: {
          200: response("Fournisseurs correspondants", arrayOf(ref("Fournisseur"))),
          ...badRequest,
          ...serverError,
        },
      },
    },
    "/api/fournisseurs": {
      post: {
        tags: ["Fournisseurs"],
        summary: "Creer un fournisseur",
        requestBody: requestBody(ref("FournisseurInput")),
        responses: {
          201: createdWithIdResponse,
          ...badRequest,
          ...conflict,
          ...serverError,
        },
      },
    },
    "/api/fournisseurs/{id}": {
      patch: {
        tags: ["Fournisseurs"],
        summary: "Modifier un fournisseur",
        parameters: [idParam("id", "Identifiant du fournisseur")],
        requestBody: requestBody(ref("FournisseurInput")),
        responses: {
          200: messageResponse,
          ...badRequest,
          ...notFound,
          ...conflict,
          ...serverError,
        },
      },
      delete: {
        tags: ["Fournisseurs"],
        summary: "Supprimer un fournisseur",
        parameters: [idParam("id", "Identifiant du fournisseur")],
        responses: {
          200: messageResponse,
          ...badRequest,
          ...notFound,
          ...conflict,
          ...serverError,
        },
      },
    },
    "/api/chambres/all": {
      get: {
        tags: ["Chambres"],
        summary: "Lister toutes les chambres",
        responses: {
          200: response("Liste des chambres avec occupation active si presente", arrayOf(ref("Chambre"))),
          ...serverError,
        },
      },
    },
    "/api/chambres/search": {
      get: {
        tags: ["Chambres"],
        summary: "Rechercher des chambres",
        parameters: [
          queryParam("q", { type: "string", example: "101" }, "Recherche sur numero, type, statut ou occupant"),
          queryParam("nom", { type: "string", example: "Rakoto" }, "Alias historique accepte pour q"),
        ],
        responses: {
          200: response("Chambres correspondantes", arrayOf(ref("Chambre"))),
          ...serverError,
        },
      },
    },
    "/api/chambres/conditions": {
      get: {
        tags: ["Chambres"],
        summary: "Recuperer les conditions et tarifs des chambres",
        responses: {
          200: response("Conditions des chambres", ref("ChambreCondition")),
          ...serverError,
        },
      },
      put: {
        tags: ["Chambres"],
        summary: "Mettre a jour les conditions et tarifs des chambres",
        requestBody: requestBody(ref("ChambreConditionUpdate")),
        responses: {
          200: response("Conditions mises a jour", ref("ChambreCondition")),
          ...badRequest,
          ...serverError,
        },
      },
    },
    "/api/chambres/history": {
      get: {
        tags: ["Chambres"],
        summary: "Lister l'historique de toutes les chambres",
        parameters: [
          queryParam("q", { type: "string", example: "Rakoto" }, "Recherche sur chambre ou occupant"),
          queryParam("status", { type: "string", enum: ["tout", "active", "terminee", "annulee"], example: "active" }, "Filtre de statut"),
          queryParam("startDate", { type: "string", format: "date", example: "2026-06-01" }, "Debut de periode"),
          queryParam("endDate", { type: "string", format: "date", example: "2026-06-03" }, "Fin de periode"),
        ],
        responses: {
          200: response("Historique des occupations", arrayOf(ref("ChambreOccupationHistory"))),
          ...badRequest,
          ...serverError,
        },
      },
    },
    "/api/chambres/{id}/history": {
      get: {
        tags: ["Chambres"],
        summary: "Lister l'historique d'une chambre",
        parameters: [idParam("id", "Identifiant de la chambre")],
        responses: {
          200: response("Historique de la chambre", arrayOf(ref("ChambreOccupationHistory"))),
          ...badRequest,
          ...serverError,
        },
      },
    },
    "/api/chambres": {
      post: {
        tags: ["Chambres"],
        summary: "Creer une chambre",
        requestBody: requestBody(ref("ChambreInput")),
        responses: {
          201: createdWithIdResponse,
          ...badRequest,
          ...conflict,
          ...serverError,
        },
      },
    },
    "/api/chambres/{id}/occupations": {
      post: {
        tags: ["Chambres"],
        summary: "Creer, modifier ou convertir une reservation/occupation",
        parameters: [
          idParam("id", "Identifiant de la chambre"),
          queryParam("check_only", { type: "boolean", example: false }, "Verifier uniquement la disponibilite"),
        ],
        requestBody: requestBody(ref("ChambreOccupationRequest")),
        responses: {
          200: messageResponse,
          201: messageResponse,
          ...badRequest,
          ...notFound,
          409: response("Conflit de disponibilite ou regle metier", ref("Error")),
          ...serverError,
        },
      },
    },
    "/api/chambres/{id}": {
      patch: {
        tags: ["Chambres"],
        summary: "Modifier une chambre",
        parameters: [idParam("id", "Identifiant de la chambre")],
        requestBody: requestBody(ref("ChambreInput")),
        responses: {
          200: messageResponse,
          ...badRequest,
          ...notFound,
          ...conflict,
          ...serverError,
        },
      },
      delete: {
        tags: ["Chambres"],
        summary: "Supprimer une chambre",
        parameters: [idParam("id", "Identifiant de la chambre")],
        responses: {
          200: messageResponse,
          ...badRequest,
          ...notFound,
          ...conflict,
          ...serverError,
        },
      },
    },
    "/api/chambres/{id}/status": {
      patch: {
        tags: ["Chambres"],
        summary: "Changer manuellement le statut d'une chambre",
        parameters: [idParam("id", "Identifiant de la chambre")],
        requestBody: requestBody(ref("ChambreStatusUpdate")),
        responses: {
          200: messageResponse,
          ...badRequest,
          ...notFound,
          ...conflict,
          ...serverError,
        },
      },
    },
    "/api/chambres/{id}/payment": {
      patch: {
        tags: ["Chambres"],
        summary: "Enregistrer un paiement sur une occupation active",
        parameters: [idParam("id", "Identifiant de la chambre")],
        requestBody: requestBody(ref("ChambrePaymentRequest")),
        responses: {
          200: response("Paiement enregistre", ref("ChambrePaymentResponse")),
          ...badRequest,
          ...notFound,
          ...conflict,
          ...serverError,
        },
      },
    },
    "/api/chambres/{id}/release": {
      patch: {
        tags: ["Chambres"],
        summary: "Liberer une chambre ou cloturer/annuler une reservation",
        parameters: [idParam("id", "Identifiant de la chambre")],
        requestBody: requestBody(ref("ChambreReleaseRequest"), false),
        responses: {
          200: messageResponse,
          ...badRequest,
          ...notFound,
          ...conflict,
          ...serverError,
        },
      },
    },
    "/api/tickets/all": {
      get: {
        tags: ["Tickets"],
        summary: "Lister les tickets",
        parameters: [
          queryParam("type", { type: "string", enum: ["attente", "comptant", "tout"], default: "attente" }, "Filtre de paiement"),
        ],
        responses: {
          200: response("Liste des tickets", arrayOf(ref("Ticket"))),
          ...serverError,
        },
      },
    },
    "/api/tickets/{id}/items": {
      get: {
        tags: ["Tickets"],
        summary: "Lister les items d'un ticket",
        parameters: [idParam("id", "Identifiant du ticket")],
        responses: {
          200: response("Items du ticket", arrayOf(ref("TicketItem"))),
          ...badRequest,
          ...serverError,
        },
      },
      post: {
        tags: ["Tickets"],
        summary: "Ajouter un article a un ticket en attente",
        parameters: [idParam("id", "Identifiant du ticket")],
        requestBody: requestBody(ref("TicketAddItemRequest")),
        responses: {
          201: response("Item ajoute", ref("Message")),
          ...badRequest,
          ...notFound,
          ...conflict,
          ...serverError,
        },
      },
    },
    "/api/tickets/{ticketId}/items/{itemId}": {
      patch: {
        tags: ["Tickets"],
        summary: "Modifier la quantite d'un item de ticket",
        parameters: [
          idParam("ticketId", "Identifiant du ticket"),
          idParam("itemId", "Identifiant de l'item"),
        ],
        requestBody: requestBody(ref("TicketUpdateItemRequest")),
        responses: {
          200: messageResponse,
          ...badRequest,
          ...notFound,
          ...conflict,
          ...serverError,
        },
      },
      delete: {
        tags: ["Tickets"],
        summary: "Supprimer un item de ticket",
        parameters: [
          idParam("ticketId", "Identifiant du ticket"),
          idParam("itemId", "Identifiant de l'item"),
        ],
        responses: {
          200: messageResponse,
          ...badRequest,
          ...notFound,
          ...conflict,
          ...serverError,
        },
      },
    },
    "/api/tickets/{id}": {
      get: {
        tags: ["Tickets"],
        summary: "Recuperer le detail d'un ticket",
        parameters: [idParam("id", "Identifiant du ticket")],
        responses: {
          200: response("Detail du ticket", ref("Ticket")),
          ...badRequest,
          ...notFound,
          ...serverError,
        },
      },
      delete: {
        tags: ["Tickets"],
        summary: "Supprimer un ticket en attente",
        parameters: [idParam("id", "Identifiant du ticket")],
        responses: {
          200: messageResponse,
          ...badRequest,
          ...notFound,
          ...conflict,
          ...serverError,
        },
      },
    },
    "/api/tickets/{id}/pay": {
      patch: {
        tags: ["Tickets"],
        summary: "Enregistrer un paiement de ticket",
        parameters: [idParam("id", "Identifiant du ticket")],
        requestBody: requestBody(ref("TicketPaymentRequest")),
        responses: {
          200: response("Paiement traite", ref("TicketPaymentResponse")),
          ...badRequest,
          ...notFound,
          ...serverError,
        },
      },
    },
    "/api/tickets/create": {
      post: {
        tags: ["Tickets"],
        summary: "Creer un ticket",
        requestBody: requestBody(ref("TicketCreateRequest")),
        responses: {
          201: response("Ticket cree", {
            type: "object",
            properties: {
              message: { type: "string", example: "Ticket cree avec succes" },
              ticket_id: { type: "integer", example: 1 },
            },
          }),
          ...badRequest,
          ...serverError,
        },
      },
    },
    "/api/dashboard/overview": {
      get: {
        tags: ["Dashboard"],
        summary: "Recuperer les indicateurs du dashboard",
        parameters: [
          queryParam("startDate", { type: "string", format: "date", example: "2026-06-01" }, "Date de debut au format YYYY-MM-DD", true),
          queryParam("endDate", { type: "string", format: "date", example: "2026-06-03" }, "Date de fin au format YYYY-MM-DD", true),
          queryParam("designation", { type: "string", example: "eau" }, "Filtre optionnel sur les articles"),
        ],
        responses: {
          200: response("Indicateurs du dashboard", ref("DashboardOverview")),
          ...badRequest,
          ...serverError,
        },
      },
    },
    "/api/realtime/stream": {
      get: {
        tags: ["Realtime"],
        summary: "Ouvrir le flux temps reel SSE",
        responses: {
          200: {
            description: "Flux Server-Sent Events",
            content: {
              "text/event-stream": {
                schema: {
                  type: "string",
                  example: "retry: 3000\n\nevent: data-change\ndata: {\"type\":\"articles-updated\"}\n\n",
                },
              },
            },
          },
        },
      },
    },
    "/api/usermanagement/create": {
      post: {
        tags: ["User Management"],
        summary: "Creer un utilisateur",
        description: "Route declaree dans Express, mais aucun controleur n'est branche dans le serveur actuel.",
        deprecated: true,
        requestBody: requestBody(ref("UserCreateRequest"), false),
        responses: {
          404: response("Aucun handler Express ne traite actuellement cette route", ref("Error")),
        },
      },
    },
  },
});

module.exports = createSwaggerDefinition;
