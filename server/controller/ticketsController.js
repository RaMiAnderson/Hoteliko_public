const { getConnection } = require("../database/databaseConnector");
const TICKETS_MODEL = require("../models/tickets");
const TICKET_ITEMS_MODEL = require("../models/ticket_items");
const ARTICLES_MODEL = require("../models/articles");
const CLIENT_MODEL = require("../models/client");
const { broadcastDataChange } = require("../services/realtimeEvents");

const PAYMENT_TYPES = new Set(["comptant", "attente", "tout"]);

const lockTicketById = async (connexion, ticketId) => {
	const [[ticket]] = await connexion.execute(
		`
		SELECT
			id,
			client_id,
			total_ticket,
			montant_paye,
			reste,
			type_paiement,
			table_num,
			servi_par,
			date_ticket
		FROM ${TICKETS_MODEL.name}
		WHERE id = ?
		FOR UPDATE
		`,
		[ticketId]
	);

	return ticket;
};

const ensureEditablePendingTicket = (ticket) => {
	if (!ticket) return { ok: false, status: 404, error: "Ticket introuvable" };

	const ticketType = String(ticket.type_paiement ?? "").toLowerCase();
	const ticketReste = Number(ticket.reste) || 0;
	if (ticketType !== "attente" || ticketReste <= 0) {
		return {
			ok: false,
			status: 409,
			error: "Ce ticket ne peut plus être modifié"
		};
	}

	return { ok: true };
};

const computeTicketAfterTotalChange = (ticket, newTotalTicket) => {
	const oldTotal = Math.max(0, Number(ticket.total_ticket) || 0);
	const oldReste = Math.max(0, Number(ticket.reste) || 0);
	const paid = Math.max(0, Number(ticket.montant_paye) || 0);
	const safeNewTotal = Math.max(0, Number(newTotalTicket) || 0);

	if (safeNewTotal < paid) {
		return {
			ok: false,
			error: "Opération impossible : le total deviendrait inférieur au montant déjà payé"
		};
	}

	const newReste = Math.max(0, safeNewTotal - paid);
	const nextTypePaiement = newReste === 0 ? "comptant" : "attente";

	return {
		ok: true,
		oldTotal,
		oldReste,
		newTotal: safeNewTotal,
		newReste,
		deltaTotal: safeNewTotal - oldTotal,
		deltaReste: newReste - oldReste,
		nextTypePaiement
	};
};

const getTicketById = async (req, res) => {
	try {
		const connexion = getConnection();
		if (!connexion)
			throw new Error("La connexion MySQL n'est pas initialisée");

		const id = Number(req.params.id);
		if (!Number.isFinite(id) || id <= 0) {
			return res.status(400).json({ error: "Identifiant ticket invalide" });
		}

		const [rows] = await connexion.execute(
			`
			SELECT
				t.id,
				t.client_id,
				t.table_num,
				t.servi_par,
				t.date_ticket,
				t.total_ticket,
				t.montant_paye,
				t.reste,
				t.type_paiement,
				t.mode_paiement,
				t.created_at,
				TRIM(CONCAT(COALESCE(c.nom, ''), ' ', COALESCE(c.prenom, ''))) AS client_nom
			FROM ${TICKETS_MODEL.name} t
			LEFT JOIN ${CLIENT_MODEL.name} c ON c.id = t.client_id
			WHERE t.id = ?
			LIMIT 1
			`,
			[id]
		);

		if (!rows.length) {
			return res.status(404).json({ error: "Ticket introuvable" });
		}

		const ticket = rows[0];
		return res.status(200).json({
			...ticket,
			client_nom: String(ticket.client_nom ?? "").trim() || "Client inconnu"
		});
	} catch (err) {
		console.error("Erreur récupération détail ticket :", err);
		return res.status(500).json({
			error: "Erreur lors de la récupération du ticket"
		});
	}
};

const getTicketItems = async (req, res) => {
	try {
		const connexion = getConnection();
		if (!connexion)
			throw new Error("La connexion MySQL n'est pas initialisée");

		const ticketId = Number(req.params.id);
		if (!Number.isFinite(ticketId) || ticketId <= 0) {
			return res.status(400).json({ error: "Identifiant ticket invalide" });
		}

		const [items] = await connexion.execute(
			`
			SELECT
				ti.id,
				ti.ticket_id,
				ti.article_id,
				ti.designation,
				ti.qt,
				ti.prix_u,
				ti.prix_total,
				COALESCE(a.mesure, '-') AS mesure
			FROM ${TICKET_ITEMS_MODEL.name} ti
			LEFT JOIN ${ARTICLES_MODEL.name} a ON a.id = ti.article_id
			WHERE ti.ticket_id = ?
			ORDER BY ti.id ASC
			`,
			[ticketId]
		);

		return res.status(200).json(items);
	} catch (err) {
		console.error("Erreur récupération items ticket :", err);
		return res.status(500).json({
			error: "Erreur lors de la récupération des items du ticket"
		});
	}
};

const addItemToTicket = async (req, res) => {
	const connexion = getConnection();
	if (!connexion)
		return res.status(500).json({ error: "Connexion MySQL indisponible" });

	const ticketId = Number(req.params.id);
	if (!Number.isFinite(ticketId) || ticketId <= 0) {
		return res.status(400).json({ error: "Identifiant ticket invalide" });
	}

	const articleId = Number(req.body.article_id);
	const qty = Number(req.body.qt);

	if (!Number.isFinite(articleId) || articleId <= 0) {
		return res.status(400).json({ error: "Article invalide" });
	}
	if (!Number.isInteger(qty) || qty <= 0) {
		return res.status(400).json({ error: "Quantité invalide" });
	}

	try {
		await connexion.beginTransaction();

		const ticket = await lockTicketById(connexion, ticketId);
		const editableCheck = ensureEditablePendingTicket(ticket);
		if (!editableCheck.ok) {
			await connexion.rollback();
			return res.status(editableCheck.status).json({ error: editableCheck.error });
		}

		const [existingItems] = await connexion.execute(
			`
			SELECT id
			FROM ${TICKET_ITEMS_MODEL.name}
			WHERE ticket_id = ? AND article_id = ?
			LIMIT 1
			FOR UPDATE
			`,
			[ticketId, articleId]
		);
		if (existingItems.length > 0) {
			await connexion.rollback();
			return res.status(409).json({
				error: "Cet article est déjà présent dans le ticket, modifiez sa quantité"
			});
		}

		const [[article]] = await connexion.execute(
			`
			SELECT id, designation, qt, vente
			FROM ${ARTICLES_MODEL.name}
			WHERE id = ?
			FOR UPDATE
			`,
			[articleId]
		);
		if (!article) {
			await connexion.rollback();
			return res.status(404).json({ error: "Article introuvable" });
		}
		const articleStock = Number(article.qt) || 0;
		if (articleStock < qty) {
			await connexion.rollback();
			return res.status(409).json({ error: "Stock insuffisant pour cet article" });
		}

		const prixU = Math.max(0, Number(article.vente) || 0);
		const addedTotal = qty * prixU;
		const computedTicket = computeTicketAfterTotalChange(
			ticket,
			(Number(ticket.total_ticket) || 0) + addedTotal
		);
		if (!computedTicket.ok) {
			await connexion.rollback();
			return res.status(409).json({ error: computedTicket.error });
		}

		const [insertResult] = await connexion.execute(
			`
			INSERT INTO ${TICKET_ITEMS_MODEL.name}
			(ticket_id, article_id, designation, qt, prix_u, prix_total)
			VALUES (?, ?, ?, ?, ?, ?)
			`,
			[
				ticketId,
				articleId,
				String(article.designation ?? "Article"),
				qty,
				prixU,
				addedTotal
			]
		);

		await connexion.execute(
			`UPDATE ${ARTICLES_MODEL.name} SET qt = qt - ? WHERE id = ?`,
			[qty, articleId]
		);

		await connexion.execute(
			`
			UPDATE ${TICKETS_MODEL.name}
			SET total_ticket = ?, reste = ?, type_paiement = ?
			WHERE id = ?
			`,
			[
				computedTicket.newTotal,
				computedTicket.newReste,
				computedTicket.nextTypePaiement,
				ticketId
			]
		);

		if (ticket.client_id) {
			await connexion.execute(
				`
				UPDATE ${CLIENT_MODEL.name}
				SET
					total_achat = GREATEST(0, COALESCE(total_achat, 0) + ?),
					total_reste = GREATEST(0, COALESCE(total_reste, 0) + ?)
				WHERE id = ?
				`,
				[
					computedTicket.deltaTotal,
					computedTicket.deltaReste,
					ticket.client_id
				]
			);
		}

		await connexion.commit();

		broadcastDataChange({
			type: "stock-updated",
			source: "ticket-item-add",
			articleIds: [articleId]
		});
		broadcastDataChange({
			type: "tickets-updated",
			source: "ticket-item-add",
			ticketId
		});
		if (ticket.client_id) {
			broadcastDataChange({
				type: "clients-updated",
				source: "ticket-item-add",
				clientId: Number(ticket.client_id)
			});
		}

		return res.status(201).json({
			message: "Article ajouté au ticket",
			item_id: insertResult.insertId
		});
	} catch (err) {
		await connexion.rollback();
		console.error("Erreur ajout item ticket :", err);
		return res.status(500).json({
			error: "Erreur lors de l'ajout de l'article au ticket"
		});
	}
};

const updateTicketItemQty = async (req, res) => {
	const connexion = getConnection();
	if (!connexion)
		return res.status(500).json({ error: "Connexion MySQL indisponible" });

	const ticketId = Number(req.params.ticketId);
	const itemId = Number(req.params.itemId);
	const qty = Number(req.body.qt);

	if (!Number.isFinite(ticketId) || ticketId <= 0 || !Number.isFinite(itemId) || itemId <= 0) {
		return res.status(400).json({ error: "Identifiant invalide" });
	}
	if (!Number.isInteger(qty) || qty <= 0) {
		return res.status(400).json({ error: "Quantité invalide" });
	}

	try {
		await connexion.beginTransaction();

		const ticket = await lockTicketById(connexion, ticketId);
		const editableCheck = ensureEditablePendingTicket(ticket);
		if (!editableCheck.ok) {
			await connexion.rollback();
			return res.status(editableCheck.status).json({ error: editableCheck.error });
		}

		const [[item]] = await connexion.execute(
			`
			SELECT id, article_id, qt, prix_u, prix_total
			FROM ${TICKET_ITEMS_MODEL.name}
			WHERE id = ? AND ticket_id = ?
			FOR UPDATE
			`,
			[itemId, ticketId]
		);
		if (!item) {
			await connexion.rollback();
			return res.status(404).json({ error: "Item introuvable" });
		}

		const oldQty = Number(item.qt) || 0;
		if (qty === oldQty) {
			await connexion.commit();
			return res.status(200).json({ message: "Aucune modification détectée" });
		}

		const deltaQty = qty - oldQty;
		const prixU = Math.max(0, Number(item.prix_u) || 0);
		const deltaTotal = deltaQty * prixU;

		const computedTicket = computeTicketAfterTotalChange(
			ticket,
			(Number(ticket.total_ticket) || 0) + deltaTotal
		);
		if (!computedTicket.ok) {
			await connexion.rollback();
			return res.status(409).json({ error: computedTicket.error });
		}

		if (item.article_id) {
			const [[article]] = await connexion.execute(
				`SELECT id, qt FROM ${ARTICLES_MODEL.name} WHERE id = ? FOR UPDATE`,
				[item.article_id]
			);
			if (!article) {
				await connexion.rollback();
				return res.status(404).json({ error: "Article introuvable" });
			}

			if (deltaQty > 0) {
				const availableStock = Number(article.qt) || 0;
				if (availableStock < deltaQty) {
					await connexion.rollback();
					return res.status(409).json({ error: "Stock insuffisant pour cet article" });
				}
				await connexion.execute(
					`UPDATE ${ARTICLES_MODEL.name} SET qt = qt - ? WHERE id = ?`,
					[deltaQty, item.article_id]
				);
			} else {
				await connexion.execute(
					`UPDATE ${ARTICLES_MODEL.name} SET qt = qt + ? WHERE id = ?`,
					[Math.abs(deltaQty), item.article_id]
				);
			}
		}

		await connexion.execute(
			`
			UPDATE ${TICKET_ITEMS_MODEL.name}
			SET qt = ?, prix_total = ?
			WHERE id = ?
			`,
			[qty, qty * prixU, itemId]
		);

		await connexion.execute(
			`
			UPDATE ${TICKETS_MODEL.name}
			SET total_ticket = ?, reste = ?, type_paiement = ?
			WHERE id = ?
			`,
			[
				computedTicket.newTotal,
				computedTicket.newReste,
				computedTicket.nextTypePaiement,
				ticketId
			]
		);

		if (ticket.client_id) {
			await connexion.execute(
				`
				UPDATE ${CLIENT_MODEL.name}
				SET
					total_achat = GREATEST(0, COALESCE(total_achat, 0) + ?),
					total_reste = GREATEST(0, COALESCE(total_reste, 0) + ?)
				WHERE id = ?
				`,
				[
					computedTicket.deltaTotal,
					computedTicket.deltaReste,
					ticket.client_id
				]
			);
		}

		await connexion.commit();

		broadcastDataChange({
			type: "stock-updated",
			source: "ticket-item-update",
			articleIds: item.article_id ? [Number(item.article_id)] : []
		});
		broadcastDataChange({
			type: "tickets-updated",
			source: "ticket-item-update",
			ticketId
		});
		if (ticket.client_id) {
			broadcastDataChange({
				type: "clients-updated",
				source: "ticket-item-update",
				clientId: Number(ticket.client_id)
			});
		}

		return res.status(200).json({ message: "Quantité mise à jour" });
	} catch (err) {
		await connexion.rollback();
		console.error("Erreur mise à jour item ticket :", err);
		return res.status(500).json({
			error: "Erreur lors de la mise à jour de l'item"
		});
	}
};

const deleteTicketItem = async (req, res) => {
	const connexion = getConnection();
	if (!connexion)
		return res.status(500).json({ error: "Connexion MySQL indisponible" });

	const ticketId = Number(req.params.ticketId);
	const itemId = Number(req.params.itemId);

	if (!Number.isFinite(ticketId) || ticketId <= 0 || !Number.isFinite(itemId) || itemId <= 0) {
		return res.status(400).json({ error: "Identifiant invalide" });
	}

	try {
		await connexion.beginTransaction();

		const ticket = await lockTicketById(connexion, ticketId);
		const editableCheck = ensureEditablePendingTicket(ticket);
		if (!editableCheck.ok) {
			await connexion.rollback();
			return res.status(editableCheck.status).json({ error: editableCheck.error });
		}

		const [[item]] = await connexion.execute(
			`
			SELECT id, article_id, qt, prix_total
			FROM ${TICKET_ITEMS_MODEL.name}
			WHERE id = ? AND ticket_id = ?
			FOR UPDATE
			`,
			[itemId, ticketId]
		);
		if (!item) {
			await connexion.rollback();
			return res.status(404).json({ error: "Item introuvable" });
		}

		const [[itemCount]] = await connexion.execute(
			`
			SELECT COUNT(*) AS count_items
			FROM ${TICKET_ITEMS_MODEL.name}
			WHERE ticket_id = ?
			`,
			[ticketId]
		);
		if (Number(itemCount?.count_items || 0) <= 1) {
			await connexion.rollback();
			return res.status(409).json({
				error: "Impossible de supprimer le dernier item. Supprimez le ticket à la place"
			});
		}

		const itemTotal = Math.max(0, Number(item.prix_total) || 0);
		const computedTicket = computeTicketAfterTotalChange(
			ticket,
			(Number(ticket.total_ticket) || 0) - itemTotal
		);
		if (!computedTicket.ok) {
			await connexion.rollback();
			return res.status(409).json({ error: computedTicket.error });
		}

		if (item.article_id) {
			await connexion.execute(
				`UPDATE ${ARTICLES_MODEL.name} SET qt = qt + ? WHERE id = ?`,
				[Math.max(0, Number(item.qt) || 0), item.article_id]
			);
		}

		await connexion.execute(
			`DELETE FROM ${TICKET_ITEMS_MODEL.name} WHERE id = ?`,
			[itemId]
		);

		await connexion.execute(
			`
			UPDATE ${TICKETS_MODEL.name}
			SET total_ticket = ?, reste = ?, type_paiement = ?
			WHERE id = ?
			`,
			[
				computedTicket.newTotal,
				computedTicket.newReste,
				computedTicket.nextTypePaiement,
				ticketId
			]
		);

		if (ticket.client_id) {
			await connexion.execute(
				`
				UPDATE ${CLIENT_MODEL.name}
				SET
					total_achat = GREATEST(0, COALESCE(total_achat, 0) + ?),
					total_reste = GREATEST(0, COALESCE(total_reste, 0) + ?)
				WHERE id = ?
				`,
				[
					computedTicket.deltaTotal,
					computedTicket.deltaReste,
					ticket.client_id
				]
			);
		}

		await connexion.commit();

		broadcastDataChange({
			type: "stock-updated",
			source: "ticket-item-delete",
			articleIds: item.article_id ? [Number(item.article_id)] : []
		});
		broadcastDataChange({
			type: "tickets-updated",
			source: "ticket-item-delete",
			ticketId
		});
		if (ticket.client_id) {
			broadcastDataChange({
				type: "clients-updated",
				source: "ticket-item-delete",
				clientId: Number(ticket.client_id)
			});
		}

		return res.status(200).json({ message: "Item supprimé du ticket" });
	} catch (err) {
		await connexion.rollback();
		console.error("Erreur suppression item ticket :", err);
		return res.status(500).json({
			error: "Erreur lors de la suppression de l'item"
		});
	}
};

const deleteTicket = async (req, res) => {
	const connexion = getConnection();
	if (!connexion)
		return res.status(500).json({ error: "Connexion MySQL indisponible" });

	const ticketId = Number(req.params.id);
	if (!Number.isFinite(ticketId) || ticketId <= 0) {
		return res.status(400).json({ error: "Identifiant ticket invalide" });
	}

	try {
		await connexion.beginTransaction();

		const ticket = await lockTicketById(connexion, ticketId);
		if (!ticket) {
			await connexion.rollback();
			return res.status(404).json({ error: "Ticket introuvable" });
		}

		const ticketType = String(ticket.type_paiement ?? "").toLowerCase();
		if (ticketType !== "attente") {
			await connexion.rollback();
			return res.status(409).json({
				error: "Seuls les tickets en attente peuvent être supprimés"
			});
		}

		const [items] = await connexion.execute(
			`
			SELECT id, article_id, qt
			FROM ${TICKET_ITEMS_MODEL.name}
			WHERE ticket_id = ?
			FOR UPDATE
			`,
			[ticketId]
		);

		const touchedArticleIds = [];
		for (const item of items) {
			if (!item.article_id) continue;
			touchedArticleIds.push(Number(item.article_id));
			await connexion.execute(
				`UPDATE ${ARTICLES_MODEL.name} SET qt = qt + ? WHERE id = ?`,
				[Math.max(0, Number(item.qt) || 0), item.article_id]
			);
		}

		await connexion.execute(
			`DELETE FROM ${TICKET_ITEMS_MODEL.name} WHERE ticket_id = ?`,
			[ticketId]
		);
		await connexion.execute(
			`DELETE FROM ${TICKETS_MODEL.name} WHERE id = ?`,
			[ticketId]
		);

		if (ticket.client_id) {
			await connexion.execute(
				`
				UPDATE ${CLIENT_MODEL.name}
				SET
					total_achat = GREATEST(0, COALESCE(total_achat, 0) - ?),
					total_reste = GREATEST(0, COALESCE(total_reste, 0) - ?)
				WHERE id = ?
				`,
				[
					Math.max(0, Number(ticket.total_ticket) || 0),
					Math.max(0, Number(ticket.reste) || 0),
					ticket.client_id
				]
			);
		}

		await connexion.commit();

		if (touchedArticleIds.length > 0) {
			broadcastDataChange({
				type: "stock-updated",
				source: "ticket-delete",
				articleIds: touchedArticleIds
			});
		}
		broadcastDataChange({
			type: "tickets-updated",
			source: "ticket-delete",
			ticketId
		});
		if (ticket.client_id) {
			broadcastDataChange({
				type: "clients-updated",
				source: "ticket-delete",
				clientId: Number(ticket.client_id)
			});
		}

		return res.status(200).json({ message: "Ticket supprimé avec succès" });
	} catch (err) {
		await connexion.rollback();
		console.error("Erreur suppression ticket :", err);
		return res.status(500).json({
			error: "Erreur lors de la suppression du ticket"
		});
	}
};

const getAllTickets = async (req, res) => {
	try {
		const connexion = getConnection();
		if (!connexion)
			throw new Error("La connexion MySQL n'est pas initialisée");

		const rawType = String(req.query.type ?? "attente").trim().toLowerCase();
		const selectedType = PAYMENT_TYPES.has(rawType) ? rawType : "attente";

		const whereClause = selectedType === "tout"
			? ""
			: "WHERE t.type_paiement = ?";
		const params = selectedType === "tout" ? [] : [selectedType];

		const sql = `
			SELECT
				t.id,
				t.client_id,
				t.table_num,
				t.servi_par,
				t.date_ticket,
				t.total_ticket,
				t.montant_paye,
				t.reste,
				t.type_paiement,
				t.mode_paiement,
				t.created_at,
				TRIM(CONCAT(COALESCE(c.nom, ''), ' ', COALESCE(c.prenom, ''))) AS client_nom
			FROM ${TICKETS_MODEL.name} t
			LEFT JOIN ${CLIENT_MODEL.name} c ON c.id = t.client_id
			${whereClause}
			ORDER BY t.date_ticket DESC, t.id DESC
		`;

		const [rows] = await connexion.execute(sql, params);
		const normalizedRows = rows.map((row) => ({
			...row,
			client_nom: String(row.client_nom ?? "").trim() || "Client inconnu"
		}));

		res.status(200).json(normalizedRows);
	} catch (err) {
		console.error("Erreur récupération tickets :", err);
		res.status(500).json({
			error: "Erreur lors de la récupération des tickets"
		});
	}
};

const markTicketAsPaid = async (req, res) => {
	const connexion = getConnection();
	if (!connexion)
		return res.status(500).json({ error: "Connexion MySQL indisponible" });

	const id = Number(req.params.id);
	if (!Number.isFinite(id) || id <= 0) {
		return res.status(400).json({ error: "Identifiant ticket invalide" });
	}
	const montantRecuRaw = Number(req.body.montant_recu);
	if (!Number.isFinite(montantRecuRaw) || montantRecuRaw <= 0) {
		return res.status(400).json({ error: "Montant reçu invalide" });
	}

	try {
		await connexion.beginTransaction();

		const [[ticket]] = await connexion.execute(
			`
			SELECT id, client_id, reste, montant_paye
			FROM ${TICKETS_MODEL.name}
			WHERE id = ?
			FOR UPDATE
			`,
			[id]
		);

		if (!ticket) {
			await connexion.rollback();
			return res.status(404).json({ error: "Ticket introuvable" });
		}

		const currentReste = Number(ticket.reste) || 0;
		if (currentReste <= 0) {
			await connexion.commit();
			return res.status(200).json({ message: "Ticket déjà payé" });
		}
		const montantRecu = Math.max(0, montantRecuRaw);
		const montantToApply = Math.min(montantRecu, currentReste);
		const newReste = Math.max(0, currentReste - montantToApply);
		const isFullyPaid = newReste <= 0;
		const montantARendre = Math.max(0, montantRecu - currentReste);
		const nextTypePaiement = isFullyPaid ? "comptant" : "attente";

		await connexion.execute(
			`
			UPDATE ${TICKETS_MODEL.name}
			SET
				montant_paye = COALESCE(montant_paye, 0) + ?,
				reste = ?,
				type_paiement = ?
			WHERE id = ?
			`,
			[montantToApply, newReste, nextTypePaiement, id]
		);

		if (ticket.client_id) {
			await connexion.execute(
				`
				UPDATE ${CLIENT_MODEL.name}
				SET total_reste = GREATEST(0, COALESCE(total_reste, 0) - ?)
				WHERE id = ?
				`,
				[montantToApply, ticket.client_id]
			);
		}

		await connexion.commit();

		broadcastDataChange({
			type: "tickets-updated",
			source: "ticket-pay",
			ticketId: id
		});
		if (ticket.client_id) {
			broadcastDataChange({
				type: "clients-updated",
				source: "ticket-pay",
				clientId: Number(ticket.client_id)
			});
		}

		return res.status(200).json({
			message: isFullyPaid ? "Ticket payé" : "Paiement partiel enregistré",
			montant_applique: montantToApply,
			montant_a_rendre: montantARendre,
			reste: newReste,
			statut: isFullyPaid ? "payé" : "non-payé"
		});
	} catch (err) {
		await connexion.rollback();
		console.error("Erreur paiement ticket :", err);
		return res.status(500).json({
			error: "Erreur lors du paiement du ticket"
		});
	}
};


const createTicket = async (req, res) => {
	const connexion = getConnection();
	if (!connexion)
		return res.status(500).json({ error: "Connexion MySQL indisponible" });

	const {
		client_id,
		table_num,
		servi_par,
		type_paiement,
		mode_paiement,
		montant_paye,
		total_ticket,
		montant_a_rendre,
		items
	} = req.body;

	if (!client_id || !type_paiement || !items || items.length === 0) {
		return res.status(400).json({
			error: "client_id, type_paiement et items sont obligatoires"
		});
	}

	const normalizedPaymentType = String(type_paiement ?? "").trim().toLowerCase();
	const finalPaymentType = normalizedPaymentType === "comptant" ? "comptant" : "attente";

	const totalTicketVal = Math.max(0, Number(total_ticket) || 0);
	const montantPayeSaisi = Math.max(0, Number(montant_paye) || 0);
	const montantPayeVal = Math.min(montantPayeSaisi, totalTicketVal);
	const reste = Math.max(0, totalTicketVal - montantPayeVal);

	try {
		await connexion.beginTransaction();

		const sqlTicket = `
			INSERT INTO ${TICKETS_MODEL.name}
			(client_id, table_num, servi_par, date_ticket, total_ticket, montant_paye, reste, type_paiement, mode_paiement)
			VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?)
		`;

		const ticketValues = [
			client_id || 1,
			table_num || null,
			servi_par || null,
			totalTicketVal || 0,
			montantPayeVal || 0,
			reste,
			finalPaymentType,
			mode_paiement || "espece"
		];

		const [ticketResult] = await connexion.execute(sqlTicket, ticketValues);
		const ticketId = ticketResult.insertId;

		const sqlItem = `
			INSERT INTO ${TICKET_ITEMS_MODEL.name}
			(ticket_id, article_id, designation, qt, prix_u, prix_total)
			VALUES (?, ?, ?, ?, ?, ?)
		`;

		for (const item of items) {
			const prixTotal = item.qt * item.vente;

			await connexion.execute(sqlItem, [
				ticketId,
				item.ID,
				item.designation,
				item.qt,
				item.vente,
				prixTotal
			]);
		}

		for (const item of items) {
			const [[article]] = await connexion.execute(
				`SELECT qt FROM ${ARTICLES_MODEL.name} WHERE id = ? FOR UPDATE`,
				[item.ID]
			);
		
			if (!article || article.qt < item.qt) {
				throw new Error(`Stock insuffisant : ${item.designation}`);
			}
		
			await connexion.execute(
				`UPDATE ${ARTICLES_MODEL.name} SET qt = qt - ? WHERE id = ?`,
				[item.qt, item.ID]
			);
		}

		await connexion.execute(
			`
			UPDATE ${CLIENT_MODEL.name}
			SET 
				total_achat = total_achat + ?,
				total_reste = total_reste + ?
			WHERE id = ?
			`,
			[
				totalTicketVal,
				reste > 0 ? reste : 0,
				client_id
			]
		);

		await connexion.commit();

		broadcastDataChange({
			type: "stock-updated",
			source: "ticket-create",
			articleIds: items.map((item) => item.ID)
		});
		broadcastDataChange({
			type: "tickets-updated",
			source: "ticket-create",
			ticketId
		});

		res.status(201).json({
			message: "Ticket créé avec succès",
			ticket_id: ticketId
		});

	} catch (err) {
		await connexion.rollback();
		console.error("Erreur création ticket :", err);

		res.status(500).json({
			error: "Erreur lors de la création du ticket"
		});
	}
};

module.exports = {
	getAllTickets,
	getTicketById,
	getTicketItems,
	addItemToTicket,
	updateTicketItemQty,
	deleteTicketItem,
	deleteTicket,
	markTicketAsPaid,
	createTicket
};
