const { getConnection } = require("../database/databaseConnector");
const TICKETS_MODEL = require("../models/tickets");
const TICKET_ITEMS_MODEL = require("../models/ticket_items");
const ARTICLES_MODEL = require("../models/articles");
const DEPENSES_MODEL = require("../models/depenses");

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isValidISODate = (value) => {
	if (!DATE_REGEX.test(value)) return false;

	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));

	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
};

const toNumber = (value) => {
	const num = Number(value);
	return Number.isNaN(num) ? 0 : num;
};

const buildDailyRange = (startDate, endDate) => {
	const result = [];
	const start = new Date(`${startDate}T00:00:00Z`);
	const end = new Date(`${endDate}T00:00:00Z`);

	for (let cur = new Date(start); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
		const y = cur.getUTCFullYear();
		const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
		const d = String(cur.getUTCDate()).padStart(2, "0");
		const iso = `${y}-${m}-${d}`;
		result.push({
			date: iso,
			label: `${d}/${m}`,
			value: 0
		});
	}

	return result;
};

const buildHourlyRange = (selectedDate) => {
	const result = [];

	for (let hour = 0; hour < 24; hour += 1) {
		const hh = String(hour).padStart(2, "0");
		result.push({
			date: `${selectedDate} ${hh}:00`,
			label: `${hh}h`,
			value: 0
		});
	}

	return result;
};

const getDashboardOverview = async (req, res) => {
	try {
		const connexion = getConnection();
		if (!connexion) {
			throw new Error("La connexion MySQL n'est pas initialisée !");
		}

		const { startDate, endDate, designation } = req.query;

		if (!startDate || !endDate || !isValidISODate(startDate) || !isValidISODate(endDate)) {
			return res.status(400).json({
				error: "Les paramètres startDate et endDate sont obligatoires (format YYYY-MM-DD)."
			});
		}

		if (startDate > endDate) {
			return res.status(400).json({
				error: "startDate doit être inférieur ou égal à endDate."
			});
		}

		const likeDesignation = designation ? `%${designation}%` : "%";

		const [ticketSummaryRows] = await connexion.execute(
			`
			SELECT
				COALESCE(SUM(total_ticket), 0) AS vente,
				COALESCE(SUM(montant_paye), 0) AS encaisses,
				COALESCE(SUM(reste), 0) AS aEncaisser
			FROM ${TICKETS_MODEL.name}
			WHERE DATE(date_ticket) BETWEEN ? AND ?
			`,
			[startDate, endDate]
		);

		const [roomEncaisseRows] = await connexion.execute(
			`
			SELECT
				COALESCE(SUM(CASE WHEN date_acompte IS NOT NULL AND DATE(date_acompte) BETWEEN ? AND ? THEN montant_acompte ELSE 0 END), 0) AS acompte_total,
				COALESCE(SUM(CASE WHEN date_solde IS NOT NULL AND DATE(date_solde) BETWEEN ? AND ? THEN montant_solde ELSE 0 END), 0) AS solde_total
			FROM chambre_occupations
			`,
			[startDate, endDate, startDate, endDate]
		);

		const [revientRows] = await connexion.execute(
			`
			SELECT
				COALESCE(SUM(ti.qt * COALESCE(a.achat, 0)), 0) AS revient
			FROM ${TICKET_ITEMS_MODEL.name} ti
			INNER JOIN ${TICKETS_MODEL.name} t ON t.id = ti.ticket_id
			LEFT JOIN ${ARTICLES_MODEL.name} a ON a.id = ti.article_id
			WHERE DATE(t.date_ticket) BETWEEN ? AND ?
			`,
			[startDate, endDate]
		);

		const [depenseRows] = await connexion.execute(
			`
			SELECT COALESCE(SUM(prix_total), 0) AS depense
			FROM ${DEPENSES_MODEL.name}
			WHERE DATE(date_depense) BETWEEN ? AND ?
			`,
			[startDate, endDate]
		);

		const [venteEncaisseeRows] = await connexion.execute(
			`
			SELECT COALESCE(SUM(total_ticket), 0) AS venteEncaissee
			FROM ${TICKETS_MODEL.name}
			WHERE DATE(date_ticket) BETWEEN ? AND ?
			AND type_paiement = 'comptant'
			`,
			[startDate, endDate]
		);

		const [revientEncaisseRows] = await connexion.execute(
			`
			SELECT
				COALESCE(SUM(ti.qt * COALESCE(a.achat, 0)), 0) AS revientEncaisse
			FROM ${TICKET_ITEMS_MODEL.name} ti
			INNER JOIN ${TICKETS_MODEL.name} t ON t.id = ti.ticket_id
			LEFT JOIN ${ARTICLES_MODEL.name} a ON a.id = ti.article_id
			WHERE DATE(t.date_ticket) BETWEEN ? AND ?
			AND t.type_paiement = 'comptant'
			`,
			[startDate, endDate]
		);

		const [encaissementRows] = await connexion.execute(
			`
			SELECT mode_paiement, COALESCE(SUM(montant_paye), 0) AS total
			FROM ${TICKETS_MODEL.name}
			WHERE DATE(date_ticket) BETWEEN ? AND ?
			GROUP BY mode_paiement
			`,
			[startDate, endDate]
		);

		const isSingleDayRange = startDate === endDate;

		let salesRows = [];
		if (isSingleDayRange) {
			const [salesByHourRows] = await connexion.execute(
				`
				SELECT LPAD(HOUR(date_ticket), 2, '0') AS heure, COALESCE(SUM(total_ticket), 0) AS total
				FROM ${TICKETS_MODEL.name}
				WHERE DATE(date_ticket) = ?
				GROUP BY HOUR(date_ticket)
				ORDER BY HOUR(date_ticket) ASC
				`,
				[startDate]
			);
			salesRows = salesByHourRows;
		} else {
			const [salesByDayRows] = await connexion.execute(
				`
				SELECT DATE_FORMAT(DATE(date_ticket), '%Y-%m-%d') AS jour, COALESCE(SUM(total_ticket), 0) AS total
				FROM ${TICKETS_MODEL.name}
				WHERE DATE(date_ticket) BETWEEN ? AND ?
				GROUP BY DATE(date_ticket)
				ORDER BY DATE(date_ticket) ASC
				`,
				[startDate, endDate]
			);
			salesRows = salesByDayRows;
		}

		const [articleRows] = await connexion.execute(
			`
			SELECT
				a.id,
				a.designation,
				a.qt AS qt_stock,
				COALESCE(v.qt_vendu, 0) AS qt_vendu,
				COALESCE(a.vente, 0) AS prix_u,
				COALESCE(a.qt, 0) * COALESCE(a.vente, 0) AS prix_total_reste
			FROM ${ARTICLES_MODEL.name} a
			LEFT JOIN (
				SELECT
					ti.article_id,
					COALESCE(SUM(ti.qt), 0) AS qt_vendu
				FROM ${TICKET_ITEMS_MODEL.name} ti
				INNER JOIN ${TICKETS_MODEL.name} t ON t.id = ti.ticket_id
				WHERE DATE(t.date_ticket) BETWEEN ? AND ?
				GROUP BY ti.article_id
			) v ON v.article_id = a.id
			WHERE a.designation LIKE ?
			ORDER BY a.designation ASC
			`,
			[startDate, endDate, likeDesignation]
		);

		const ticketSummary = ticketSummaryRows[0] || {};
		const vente = toNumber(ticketSummary.vente);
		const roomEncaisse = toNumber(roomEncaisseRows?.[0]?.acompte_total) + toNumber(roomEncaisseRows?.[0]?.solde_total);
		const encaisses = toNumber(ticketSummary.encaisses) + roomEncaisse;
		const aEncaisser = toNumber(ticketSummary.aEncaisser);
		const revient = toNumber((revientRows[0] || {}).revient);
		const depense = toNumber((depenseRows[0] || {}).depense);
		const benefices = vente - revient - depense + roomEncaisse;
		const venteEncaissee = toNumber((venteEncaisseeRows[0] || {}).venteEncaissee);
		const revientEncaisse = toNumber((revientEncaisseRows[0] || {}).revientEncaisse);
		const beneficeEncaisse = venteEncaissee - revientEncaisse;

		const encaissement = {
			espece: 0,
			mobile_money: 0,
			autre: 0
		};

		encaissementRows.forEach((row) => {
			if (row.mode_paiement === "espece") encaissement.espece = toNumber(row.total);
			if (row.mode_paiement === "mobile_money") encaissement.mobile_money = toNumber(row.total);
			if (row.mode_paiement === "autre") encaissement.autre = toNumber(row.total);
		});

		let chart = [];
		if (isSingleDayRange) {
			chart = buildHourlyRange(startDate);
			const hourIndex = new Map(
				chart.map((item, idx) => [item.label.slice(0, 2), idx])
			);

			salesRows.forEach((row) => {
				const key = String(row.heure).padStart(2, "0");
				const idx = hourIndex.get(key);
				if (idx !== undefined) {
					chart[idx].value = toNumber(row.total);
				}
			});
		} else {
			chart = buildDailyRange(startDate, endDate);
			const dayIndex = new Map(chart.map((item, idx) => [item.date, idx]));
			salesRows.forEach((row) => {
				const key = String(row.jour).slice(0, 10);
				const idx = dayIndex.get(key);
				if (idx !== undefined) {
					chart[idx].value = toNumber(row.total);
				}
			});
		}

		const articles = articleRows.map((row) => ({
			id: row.id,
			designation: row.designation,
			qt_stock: toNumber(row.qt_stock),
			qt_vendu: toNumber(row.qt_vendu),
			prix_u: toNumber(row.prix_u),
			prix_total_reste: toNumber(row.prix_total_reste)
		}));

		res.status(200).json({
			period: { startDate, endDate },
			kpis: {
				vente,
				revient,
				depense,
				encaisses,
				aEncaisser,
				benefices,
				encaissement,
				recette: {
					vente: venteEncaissee,
					revientEncaisse,
					beneficeEncaisse
				}
			},
			chart,
			articles
		});
	} catch (err) {
		console.error("Error dashboard overview:", err);
		res.status(500).json({
			error: "Erreur lors de la récupération du dashboard"
		});
	}
};

module.exports = {
	getDashboardOverview
};
