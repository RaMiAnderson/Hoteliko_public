const { getConnection } = require("../database/databaseConnector");
const CHAMBRES_MODEL = require("../models/chambres");
const CHAMBRE_OCCUPATIONS_MODEL = require("../models/chambre_occupations");
const CHAMBRE_CONDITIONS_MODEL = require("../models/chambre_conditions");
const CHAMBRE_TYPE_TARIFS_MODEL = require("../models/chambre_type_tarifs");
const CLIENT_MODEL = require("../models/client");
const { broadcastDataChange } = require("../services/realtimeEvents");

const ROOM_STATUSES = new Set(["libre", "reservee", "occupee", "maintenance"]);
const MANUAL_ROOM_STATUSES = new Set(["libre", "maintenance"]);
const OCCUPATION_TYPES = new Set(["reservation", "occupation"]);
const RELEASE_MODES = new Set(["checkout", "cancel", "no_show"]);
const STAY_TYPES = new Set(["nuit", "passage", "journee"]);

const DEFAULT_CONDITION = {
     checkin_time: "13:00",
     checkout_time: "09:00",
     day_checkin_time: "08:00",
     day_checkout_time: "18:00",
     cin_required_reservation: true,
     cin_required_occupation: true,
     deposit_percent: 0
};

const normalizeString = (value) => String(value ?? "").trim();

const parsePositiveInt = (value) => {
	const parsed = Number(String(value ?? "").trim());
	if (!Number.isInteger(parsed) || parsed <= 0) return null;
	return parsed;
};

const parseNonNegativeNumber = (value, fallback = 0) => {
	if (value === undefined || value === null || String(value).trim() === "") return fallback;
	const parsed = Number(String(value).trim().replace(",", "."));
	if (!Number.isFinite(parsed) || parsed < 0) return null;
	return parsed;
};

const parseDateTime = (value) => {
	if (value === undefined || value === null || String(value).trim() === "") return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date;
};

const parseTimeParts = (value) => {
     const raw = String(value ?? "").trim();
     if (!raw) return null;
     const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
     if (!match) return null;
     const hours = Number(match[1]);
     const minutes = Number(match[2]);
     const seconds = match[3] ? Number(match[3]) : 0;
     if (!Number.isInteger(hours) || hours < 0 || hours > 23) return null;
     if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null;
     if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) return null;
     return { hours, minutes, seconds };
};

const normalizeTimeValue = (value, fallback = DEFAULT_CONDITION.checkin_time) => {
     const parsed = parseTimeParts(value);
     if (!parsed) return fallback;
     const hh = String(parsed.hours).padStart(2, "0");
     const mm = String(parsed.minutes).padStart(2, "0");
     return `${hh}:${mm}`;
};

const toSqlTime = (value, fallback = DEFAULT_CONDITION.checkin_time) => {
     const parsed = parseTimeParts(value) || parseTimeParts(fallback);
     if (!parsed) return "00:00:00";
     const hh = String(parsed.hours).padStart(2, "0");
     const mm = String(parsed.minutes).padStart(2, "0");
     const ss = String(parsed.seconds).padStart(2, "0");
     return `${hh}:${mm}:${ss}`;
};

const alignDateToTime = (date, timeValue) => {
     if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
     const parsed = parseTimeParts(timeValue);
     if (!parsed) return date;
     const aligned = new Date(date);
     aligned.setHours(parsed.hours, parsed.minutes, 0, 0);
     return aligned;
};

const parseBoolean = (value, fallback = false) => {
     if (value === undefined || value === null || value === "") return fallback;
     if (typeof value === "boolean") return value;
     const normalized = String(value).trim().toLowerCase();
     if (["1", "true", "yes", "y", "oui"].includes(normalized)) return true;
     if (["0", "false", "no", "n", "non"].includes(normalized)) return false;
     return fallback;
};

const normalizeDepositPercent = (value, fallback = 0) => {
     if (value === undefined || value === null || String(value).trim() === "") return fallback;
     const parsed = Number(String(value).trim().replace(",", "."));
     if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
     return parsed;
};

const normalizeRoomTypeKey = (value) => normalizeString(value).toLowerCase();

const calculateHours = (start, end) => {
	if (!start || !end) return 0;
	const diffMs = end.getTime() - start.getTime();
	if (diffMs <= 0) return 0;
	return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
};

const calculateDays = (start, end) => {
	if (!start || !end) return 0;
	const diffMs = end.getTime() - start.getTime();
	if (diffMs <= 0) return 0;
	return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

const calculateDaysInclusive = (start, end) => {
	if (!start || !end) return 0;
	const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
	const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
	const diffDays = Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24));
	if (diffDays < 0) return 0;
	return diffDays + 1;
};

const getMinutesFromDate = (value) => {
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
	return (value.getHours() * 60) + value.getMinutes();
};

const getMinutesFromTimeValue = (value) => {
	const parsed = parseTimeParts(value);
	if (!parsed) return null;
	return (parsed.hours * 60) + parsed.minutes;
};

const calculateJourneeExtras = (start, end, dayCheckin, dayCheckout) => {
	const dayCount = calculateDaysInclusive(start, end);
	const startMinutes = getMinutesFromDate(start);
	const endMinutes = getMinutesFromDate(end);
	const dayStartMinutes = getMinutesFromTimeValue(dayCheckin);
	const dayEndMinutes = getMinutesFromTimeValue(dayCheckout);

	const isTimeValid = dayCount > 0
		&& Number.isFinite(startMinutes)
		&& Number.isFinite(endMinutes)
		&& Number.isFinite(dayStartMinutes)
		&& Number.isFinite(dayEndMinutes)
		&& startMinutes < endMinutes
		&& endMinutes > dayStartMinutes
		&& startMinutes < dayEndMinutes;

	if (!isTimeValid) {
		return {
			dayCount,
			earlyHoursPerDay: 0,
			lateHoursPerDay: 0,
			extraHoursPerDay: 0,
			extraHoursTotal: 0,
			isTimeValid
		};
	}

	const earlyMinutes = Math.max(0, dayStartMinutes - startMinutes);
	const lateMinutes = Math.max(0, endMinutes - dayEndMinutes);
	const earlyHoursPerDay = earlyMinutes > 0 ? Math.ceil(earlyMinutes / 60) : 0;
	const lateHoursPerDay = lateMinutes > 0 ? Math.ceil(lateMinutes / 60) : 0;
	const extraHoursPerDay = earlyHoursPerDay + lateHoursPerDay;
	const extraHoursTotal = extraHoursPerDay * dayCount;

	return {
		dayCount,
		earlyHoursPerDay,
		lateHoursPerDay,
		extraHoursPerDay,
		extraHoursTotal,
		isTimeValid
	};
};

const isSameCalendarDay = (left, right) => {
	if (!left || !right) return false;
	return left.getFullYear() === right.getFullYear()
		&& left.getMonth() === right.getMonth()
		&& left.getDate() === right.getDate();
};

const fetchHourlyPrices = async (connexion) => {
	const [rows] = await connexion.execute(
		`SELECT type, prix_heure FROM ${CHAMBRE_TYPE_TARIFS_MODEL.name} ORDER BY type ASC`
	);
	return (rows || [])
		.map((row) => ({
			type: normalizeString(row.type),
			prix_heure: Number(row.prix_heure) || 0
		}))
		.filter((entry) => entry.type);
};

const fetchDayPrices = async (connexion) => {
	const [rows] = await connexion.execute(
		`SELECT type, prix_journee FROM ${CHAMBRE_TYPE_TARIFS_MODEL.name} ORDER BY type ASC`
	);
	return (rows || [])
		.map((row) => ({
			type: normalizeString(row.type),
			prix_journee: Number(row.prix_journee) || 0
		}))
		.filter((entry) => entry.type);
};

const fetchNightlyPrices = async (connexion) => {
	const [tarifRows] = await connexion.execute(
		`SELECT type, prix_nuit FROM ${CHAMBRE_TYPE_TARIFS_MODEL.name} ORDER BY type ASC`
	);
	const [roomRows] = await connexion.execute(
		`
		SELECT type, MIN(prix_nuit) AS min_price, MAX(prix_nuit) AS max_price
		FROM ${CHAMBRES_MODEL.name}
		WHERE type IS NOT NULL AND TRIM(type) <> ''
		GROUP BY type
		ORDER BY type ASC
		`
	);

	const tarifMap = new Map();
	for (const row of tarifRows || []) {
		const type = normalizeString(row.type);
		if (!type) continue;
		const price = Number(row.prix_nuit) || 0;
		tarifMap.set(type, price);
	}

	const roomMap = new Map();
	for (const row of roomRows || []) {
		const type = normalizeString(row.type);
		if (!type) continue;
		const minPrice = Number(row.min_price);
		const maxPrice = Number(row.max_price);
		if (Number.isFinite(minPrice) && Number.isFinite(maxPrice) && minPrice === maxPrice && minPrice > 0) {
			roomMap.set(type, minPrice);
		}
	}

	const types = new Set([...tarifMap.keys(), ...roomMap.keys()]);
	const merged = [];
	for (const type of types) {
		const tarifPrice = tarifMap.get(type) || 0;
		const roomPrice = roomMap.get(type) || 0;
		const price = tarifPrice > 0 ? tarifPrice : roomPrice;
		if (price > 0) {
			merged.push({ type, prix_nuit: price });
		}
	}

	return merged.sort((a, b) => a.type.localeCompare(b.type));
};

const getHourlyPriceForType = async (connexion, type) => {
	const normalizedType = normalizeString(type);
	if (!normalizedType) return 0;
	const [[row]] = await connexion.execute(
		`SELECT prix_heure FROM ${CHAMBRE_TYPE_TARIFS_MODEL.name} WHERE type = ? LIMIT 1`,
		[normalizedType]
	);
	return Number(row?.prix_heure) || 0;
};

const getDayPriceForType = async (connexion, type) => {
	const normalizedType = normalizeString(type);
	if (!normalizedType) return 0;
	const [[row]] = await connexion.execute(
		`SELECT prix_journee FROM ${CHAMBRE_TYPE_TARIFS_MODEL.name} WHERE type = ? LIMIT 1`,
		[normalizedType]
	);
	return Number(row?.prix_journee) || 0;
};

const getNightlyPriceForType = async (connexion, type) => {
	const normalizedType = normalizeString(type);
	if (!normalizedType) return 0;
	const [[row]] = await connexion.execute(
		`SELECT prix_nuit FROM ${CHAMBRE_TYPE_TARIFS_MODEL.name} WHERE type = ? LIMIT 1`,
		[normalizedType]
	);
	return Number(row?.prix_nuit) || 0;
};

const mapConditionRow = (row) => {
     if (!row) return { ...DEFAULT_CONDITION };
     return {
          id: row.id,
          checkin_time: normalizeTimeValue(row.checkin_time, DEFAULT_CONDITION.checkin_time),
          checkout_time: normalizeTimeValue(row.checkout_time, DEFAULT_CONDITION.checkout_time),
          day_checkin_time: normalizeTimeValue(row.day_checkin_time, DEFAULT_CONDITION.day_checkin_time),
          day_checkout_time: normalizeTimeValue(row.day_checkout_time, DEFAULT_CONDITION.day_checkout_time),
          cin_required_reservation: Boolean(row.cin_required_reservation),
          cin_required_occupation: Boolean(row.cin_required_occupation),
          deposit_percent: Number(row.deposit_percent) || 0
     };
};

const ensureChambreCondition = async (connexion) => {
     const [rows] = await connexion.execute(
          `SELECT * FROM ${CHAMBRE_CONDITIONS_MODEL.name} ORDER BY id ASC LIMIT 1`
     );
     if (rows && rows.length > 0) return mapConditionRow(rows[0]);

     const checkinTime = toSqlTime(DEFAULT_CONDITION.checkin_time, DEFAULT_CONDITION.checkin_time);
     const checkoutTime = toSqlTime(DEFAULT_CONDITION.checkout_time, DEFAULT_CONDITION.checkout_time);
     const dayCheckinTime = toSqlTime(DEFAULT_CONDITION.day_checkin_time, DEFAULT_CONDITION.day_checkin_time);
     const dayCheckoutTime = toSqlTime(DEFAULT_CONDITION.day_checkout_time, DEFAULT_CONDITION.day_checkout_time);
     await connexion.execute(
          `INSERT INTO ${CHAMBRE_CONDITIONS_MODEL.name}
          (checkin_time, checkout_time, day_checkin_time, day_checkout_time, cin_required_reservation, cin_required_occupation, deposit_percent)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
               checkinTime,
               checkoutTime,
               dayCheckinTime,
               dayCheckoutTime,
               DEFAULT_CONDITION.cin_required_reservation ? 1 : 0,
               DEFAULT_CONDITION.cin_required_occupation ? 1 : 0,
               DEFAULT_CONDITION.deposit_percent
          ]
     );
     const [createdRows] = await connexion.execute(
          `SELECT * FROM ${CHAMBRE_CONDITIONS_MODEL.name} ORDER BY id ASC LIMIT 1`
     );
     return mapConditionRow(createdRows?.[0]);
};

const buildClientDisplayName = (client) => {
	const nom = normalizeString(client?.nom);
	const prenom = normalizeString(client?.prenom);
	return `${nom} ${prenom}`.trim();
};

const listChambresSql = (whereClause = "", orderClause = "ORDER BY c.numero ASC, c.id ASC") => `
	SELECT
		c.id,
		c.numero,
		c.type,
		c.capacite,
		c.prix_nuit AS prix_nuit,
		CASE
			WHEN c.statut = 'maintenance' THEN 'maintenance'
			WHEN o.type_occupation = 'occupation' THEN 'occupee'
			WHEN o.type_occupation = 'reservation' THEN 'reservee'
			ELSE 'libre'
		END AS statut,
		c.description,
		c.created_at,
		c.updated_at,
		o.id AS occupation_id,
		o.client_id,
		o.occupant_nom,
		o.occupant_contact,
		o.occupant_cin,
		o.type_occupation,
		o.type_sejour,
		o.date_debut,
		o.date_fin_prevue,
		o.date_fin_reelle,
		COALESCE(o.prix_nuit, c.prix_nuit) AS occupation_prix_nuit,
		o.prix_heure AS occupation_prix_heure,
		o.prix_journee AS occupation_prix_journee,
		o.montant_total,
		o.montant_acompte,
		o.date_acompte,
		o.montant_solde,
		o.date_solde,
		o.note AS occupation_note,
		TRIM(CONCAT(COALESCE(cl.nom, ''), ' ', COALESCE(cl.prenom, ''))) AS client_nom,
		cl.numTel AS client_num_tel,
		cl.numberCNI AS client_cin
	FROM ${CHAMBRES_MODEL.name} c
	LEFT JOIN ${CHAMBRE_OCCUPATIONS_MODEL.name} o
		ON o.id = (
			SELECT o2.id
			FROM ${CHAMBRE_OCCUPATIONS_MODEL.name} o2
			WHERE o2.chambre_id = c.id
				AND o2.statut = 'active'
				AND o2.date_debut <= NOW()
				AND (o2.date_fin_prevue IS NULL OR o2.date_fin_prevue >= NOW())
			ORDER BY o2.date_debut DESC, o2.id DESC
			LIMIT 1
		)
	LEFT JOIN ${CLIENT_MODEL.name} cl ON cl.id = o.client_id
	${whereClause}
	${orderClause}
`;

const ensureConnexion = () => {
	const connexion = getConnection();
	if (!connexion) {
		throw new Error("La connexion MySQL n'est pas initialisée");
	}
	return connexion;
};

const autoCancelExpiredReservations = async (connexion, chambreId = null) => {
	const params = [];
	let whereClause = `
		o.statut = 'active'
		AND o.type_occupation = 'reservation'
		AND o.date_fin_prevue IS NOT NULL
		AND o.date_fin_prevue <= NOW()
	`;
	if (chambreId) {
		whereClause += " AND o.chambre_id = ?";
		params.push(chambreId);
	}

	const [expiredRows] = await connexion.execute(
		`
		SELECT o.id, o.chambre_id
		FROM ${CHAMBRE_OCCUPATIONS_MODEL.name} o
		WHERE ${whereClause}
		`,
		params
	);

	if (!expiredRows.length) return 0;

	const occupationIds = expiredRows.map((row) => row.id);
	const roomIds = Array.from(new Set(expiredRows.map((row) => row.chambre_id)));
	const occupationPlaceholders = occupationIds.map(() => "?").join(", ");
	const roomPlaceholders = roomIds.map(() => "?").join(", ");

	await connexion.execute(
		`
		UPDATE ${CHAMBRE_OCCUPATIONS_MODEL.name}
		SET
			statut = 'annulee',
			date_fin_reelle = COALESCE(date_fin_reelle, date_fin_prevue),
			note = CASE
				WHEN note IS NULL OR note = '' THEN 'No-show'
				ELSE CONCAT(note, ' | No-show')
			END
		WHERE id IN (${occupationPlaceholders})
		`,
		occupationIds
	);

	if (roomIds.length > 0) {
		await connexion.execute(
			`
			UPDATE ${CHAMBRES_MODEL.name}
			SET statut = 'libre'
			WHERE statut = 'reservee' AND id IN (${roomPlaceholders})
			`,
			roomIds
		);
	}

	return expiredRows.length;
};

const getLockedRoomState = async (connexion, chambreId) => {
	const [[room]] = await connexion.execute(
		`SELECT id, numero, type, capacite, prix_nuit, statut, description FROM ${CHAMBRES_MODEL.name} WHERE id = ? FOR UPDATE`,
		[chambreId]
	);
	if (!room) return { room: null, activeOccupation: null };

	const [[activeOccupation]] = await connexion.execute(
		`
		SELECT
			o.id,
			o.chambre_id,
			o.client_id,
			o.occupant_nom,
			o.occupant_contact,
			o.occupant_cin,
			o.type_occupation,
			o.type_sejour,
			o.date_debut,
			o.date_fin_prevue,
			o.date_fin_reelle,
			o.prix_nuit,
			o.prix_heure,
			o.prix_journee,
			o.montant_total,
			o.montant_acompte,
			o.date_acompte,
			o.montant_solde,
			o.date_solde,
			o.note,
			TRIM(CONCAT(COALESCE(c.nom, ''), ' ', COALESCE(c.prenom, ''))) AS client_nom,
			c.numTel AS client_num_tel,
			c.numberCNI AS client_cin
		FROM ${CHAMBRE_OCCUPATIONS_MODEL.name} o
		LEFT JOIN ${CLIENT_MODEL.name} c ON c.id = o.client_id
		WHERE o.chambre_id = ?
			AND o.statut = 'active'
			AND o.date_debut <= NOW()
			AND (o.date_fin_prevue IS NULL OR o.date_fin_prevue >= NOW())
		ORDER BY o.date_debut DESC, o.id DESC
		LIMIT 1
		FOR UPDATE
		`,
		[chambreId]
	);

	return { room, activeOccupation: activeOccupation || null };
};

const findOverlappingActiveOccupation = async (connexion, chambreId, start, end, ignoreId = null) => {
	if (!start) return null;
	const params = [chambreId];
	let sql = `
		SELECT id, type_occupation, date_debut, date_fin_prevue
		FROM ${CHAMBRE_OCCUPATIONS_MODEL.name}
		WHERE chambre_id = ? AND statut = 'active'
	`;

	if (ignoreId) {
		sql += " AND id <> ?";
		params.push(ignoreId);
	}

	if (end) {
		sql += `
			AND (
				(date_fin_prevue IS NULL AND date_debut < ?)
				OR (date_fin_prevue IS NOT NULL AND date_debut < ? AND date_fin_prevue > ?)
			)
		`;
		params.push(end, end, start);
	} else {
		sql += " AND (date_fin_prevue IS NULL OR date_fin_prevue > ?)";
		params.push(start);
	}

	sql += " ORDER BY date_debut ASC, id ASC LIMIT 1";
	const [[row]] = await connexion.execute(sql, params);
	return row || null;
};

const getAllChambres = async (req, res) => {
	try {
		const connexion = ensureConnexion();
		await autoCancelExpiredReservations(connexion);
		const [rows] = await connexion.execute(listChambresSql());
		return res.status(200).json(rows);
	} catch (err) {
		console.error("Erreur récupération chambres:", err);
		return res.status(500).json({
			error: "Erreur lors de la récupération des chambres"
		});
	}
};

const searchChambres = async (req, res) => {
	try {
		const connexion = ensureConnexion();
		await autoCancelExpiredReservations(connexion);
		const rawQuery = normalizeString(req.query.q ?? req.query.nom);
		if (!rawQuery) {
			const [rows] = await connexion.execute(listChambresSql());
			return res.status(200).json(rows);
		}

		const searchValue = `%${rawQuery}%`;
		const whereClause = `
			WHERE
				c.numero LIKE ? OR
				c.type LIKE ? OR
				c.statut LIKE ? OR
				COALESCE(o.occupant_nom, '') LIKE ? OR
				TRIM(CONCAT(COALESCE(cl.nom, ''), ' ', COALESCE(cl.prenom, ''))) LIKE ?
		`;
		const [rows] = await connexion.execute(listChambresSql(whereClause), [
			searchValue,
			searchValue,
			searchValue,
			searchValue,
			searchValue
		]);

		return res.status(200).json(rows);
	} catch (err) {
		console.error("Erreur recherche chambres:", err);
		return res.status(500).json({
			error: "Erreur lors de la recherche des chambres"
		});
	}
};

const getChambreConditions = async (req, res) => {
     try {
          const connexion = ensureConnexion();
          const condition = await ensureChambreCondition(connexion);
          const hourlyPrices = await fetchHourlyPrices(connexion);
          const dayPrices = await fetchDayPrices(connexion);
		const nightlyPrices = await fetchNightlyPrices(connexion);
          return res.status(200).json({
			...condition,
			hourly_prices: hourlyPrices,
			day_prices: dayPrices,
			nightly_prices: nightlyPrices
		  });
     } catch (err) {
          console.error("Erreur récupération conditions chambre:", err);
          return res.status(500).json({ error: "Erreur lors de la récupération des conditions" });
     }
};

const updateChambreConditions = async (req, res) => {
     try {
          const connexion = ensureConnexion();
          const current = await ensureChambreCondition(connexion);

          const rawCheckin = req.body.checkin_time;
          const rawCheckout = req.body.checkout_time;
          const rawDayCheckin = req.body.day_checkin_time;
          const rawDayCheckout = req.body.day_checkout_time;
          const parsedCheckin = parseTimeParts(rawCheckin);
          const parsedCheckout = parseTimeParts(rawCheckout);
          const parsedDayCheckin = parseTimeParts(rawDayCheckin);
          const parsedDayCheckout = parseTimeParts(rawDayCheckout);
          if (rawCheckin !== undefined && rawCheckin !== null && String(rawCheckin).trim() !== "" && !parsedCheckin) {
               return res.status(400).json({ error: "Heure d'entrée invalide (HH:MM)" });
          }
          if (rawCheckout !== undefined && rawCheckout !== null && String(rawCheckout).trim() !== "" && !parsedCheckout) {
               return res.status(400).json({ error: "Heure de sortie invalide (HH:MM)" });
          }
          if (rawDayCheckin !== undefined && rawDayCheckin !== null && String(rawDayCheckin).trim() !== "" && !parsedDayCheckin) {
               return res.status(400).json({ error: "Heure d'entrée journée invalide (HH:MM)" });
          }
          if (rawDayCheckout !== undefined && rawDayCheckout !== null && String(rawDayCheckout).trim() !== "" && !parsedDayCheckout) {
               return res.status(400).json({ error: "Heure de sortie journée invalide (HH:MM)" });
          }

          const checkinTime = normalizeTimeValue(rawCheckin, current.checkin_time);
          const checkoutTime = normalizeTimeValue(rawCheckout, current.checkout_time);
          const dayCheckinTime = normalizeTimeValue(rawDayCheckin, current.day_checkin_time);
          const dayCheckoutTime = normalizeTimeValue(rawDayCheckout, current.day_checkout_time);
          const cinRequiredReservation = parseBoolean(req.body.cin_required_reservation, current.cin_required_reservation);
          const cinRequiredOccupation = parseBoolean(req.body.cin_required_occupation, current.cin_required_occupation);
          const depositPercent = normalizeDepositPercent(req.body.deposit_percent, current.deposit_percent);

          if (depositPercent === null) {
               return res.status(400).json({ error: "Pourcentage d'acompte invalide (0-100)" });
          }

		await connexion.beginTransaction();

          const sqlCheckin = toSqlTime(checkinTime, DEFAULT_CONDITION.checkin_time);
          const sqlCheckout = toSqlTime(checkoutTime, DEFAULT_CONDITION.checkout_time);
          const sqlDayCheckin = toSqlTime(dayCheckinTime, DEFAULT_CONDITION.day_checkin_time);
          const sqlDayCheckout = toSqlTime(dayCheckoutTime, DEFAULT_CONDITION.day_checkout_time);

          await connexion.execute(
               `UPDATE ${CHAMBRE_CONDITIONS_MODEL.name}
               SET checkin_time = ?, checkout_time = ?, day_checkin_time = ?, day_checkout_time = ?, cin_required_reservation = ?, cin_required_occupation = ?, deposit_percent = ?
               WHERE id = ?`,
               [
                    sqlCheckin,
                    sqlCheckout,
                    sqlDayCheckin,
                    sqlDayCheckout,
                    cinRequiredReservation ? 1 : 0,
                    cinRequiredOccupation ? 1 : 0,
                    depositPercent,
                    current.id
               ]
          );

		const normalizeHourlyPayload = (input, valueKey = "prix_heure") => {
			if (Array.isArray(input)) return input;
			if (input && typeof input === "object") {
				return Object.entries(input).map(([type, value]) => ({ type, [valueKey]: value }));
			}
			return [];
		};
		const hourlyPayload = normalizeHourlyPayload(req.body.hourly_prices, "prix_heure");
		for (const entry of hourlyPayload) {
			const type = normalizeString(entry?.type);
			if (!type) continue;
			const price = parseNonNegativeNumber(entry?.prix_heure, 0);
			if (price === null) {
				await connexion.rollback();
				return res.status(400).json({ error: `Prix/heure invalide pour le type ${type}` });
			}
			await connexion.execute(
				`
				INSERT INTO ${CHAMBRE_TYPE_TARIFS_MODEL.name} (type, prix_heure)
				VALUES (?, ?)
				ON DUPLICATE KEY UPDATE prix_heure = VALUES(prix_heure)
				`,
				[type, price]
			);
		}

		const dayPayload = normalizeHourlyPayload(req.body.day_prices, "prix_journee");
		for (const entry of dayPayload) {
			const type = normalizeString(entry?.type);
			if (!type) continue;
			const price = parseNonNegativeNumber(entry?.prix_journee, 0);
			if (price === null) {
				await connexion.rollback();
				return res.status(400).json({ error: `Prix/journée invalide pour le type ${type}` });
			}
			await connexion.execute(
				`
				INSERT INTO ${CHAMBRE_TYPE_TARIFS_MODEL.name} (type, prix_journee)
				VALUES (?, ?)
				ON DUPLICATE KEY UPDATE prix_journee = VALUES(prix_journee)
				`,
				[type, price]
			);
		}

		const nightlyPayload = normalizeHourlyPayload(req.body.nightly_prices, "prix_nuit");
		for (const entry of nightlyPayload) {
			const type = normalizeString(entry?.type);
			if (!type) continue;
			if (entry?.prix_nuit === undefined || entry?.prix_nuit === null || String(entry.prix_nuit).trim() === "") {
				continue;
			}
			const price = parseNonNegativeNumber(entry?.prix_nuit, null);
			if (price === null) {
				await connexion.rollback();
				return res.status(400).json({ error: `Prix/nuit invalide pour le type ${type}` });
			}
			await connexion.execute(
				`
				INSERT INTO ${CHAMBRE_TYPE_TARIFS_MODEL.name} (type, prix_nuit)
				VALUES (?, ?)
				ON DUPLICATE KEY UPDATE prix_nuit = VALUES(prix_nuit)
				`,
				[type, price]
			);
			await connexion.execute(
				`UPDATE ${CHAMBRES_MODEL.name} SET prix_nuit = ? WHERE type = ?`,
				[price, type]
			);
		}

		const updated = await ensureChambreCondition(connexion);
		const hourlyPrices = await fetchHourlyPrices(connexion);
		const dayPrices = await fetchDayPrices(connexion);
		const nightlyPrices = await fetchNightlyPrices(connexion);
		await connexion.commit();
          broadcastDataChange({
               type: "chambres-conditions-updated",
               action: "update"
          });
		if (nightlyPayload.length > 0) {
			broadcastDataChange({
				type: "chambres-updated",
				action: "price-nuit-update"
			});
		}
          return res.status(200).json({
			...updated,
			hourly_prices: hourlyPrices,
			day_prices: dayPrices,
			nightly_prices: nightlyPrices
		  });
     } catch (err) {
		try {
			const connexion = ensureConnexion();
			await connexion.rollback();
		} catch (rollbackErr) {
			console.error("Erreur rollback conditions chambre:", rollbackErr);
		}
          console.error("Erreur mise à jour conditions chambre:", err);
          return res.status(500).json({ error: "Erreur lors de la mise à jour des conditions" });
     }
};

const setOneChambre = async (req, res) => {
	try {
		const connexion = ensureConnexion();

		const numero = normalizeString(req.body.numero);
		const type = normalizeString(req.body.type) || "Standard";
		const capacite = parsePositiveInt(req.body.capacite ?? 1);
		const prixNuit = parseNonNegativeNumber(req.body.prix_nuit, 0);
		const description = normalizeString(req.body.description) || null;
		const requestedStatus = normalizeString(req.body.statut).toLowerCase();
		const statut = MANUAL_ROOM_STATUSES.has(requestedStatus) ? requestedStatus : "libre";

		if (!numero) {
			return res.status(400).json({ error: "Le numéro de chambre est obligatoire" });
		}
		if (!capacite) {
			return res.status(400).json({ error: "La capacité doit être un entier positif" });
		}
		if (prixNuit === null) {
			return res.status(400).json({ error: "Le prix/nuit est invalide" });
		}

		let resolvedPrixNuit = prixNuit;
		if (resolvedPrixNuit === 0) {
			const typePrice = await getNightlyPriceForType(connexion, type);
			if (typePrice > 0) {
				resolvedPrixNuit = typePrice;
			} else {
				const [[row]] = await connexion.execute(
					`
					SELECT MIN(prix_nuit) AS min_price, MAX(prix_nuit) AS max_price
					FROM ${CHAMBRES_MODEL.name}
					WHERE type = ?
					`,
					[type]
				);
				const minPrice = Number(row?.min_price);
				const maxPrice = Number(row?.max_price);
				if (Number.isFinite(minPrice) && Number.isFinite(maxPrice) && minPrice === maxPrice && minPrice > 0) {
					resolvedPrixNuit = minPrice;
				}
			}
		}

		const [result] = await connexion.execute(
			`
			INSERT INTO ${CHAMBRES_MODEL.name}
			(numero, type, capacite, prix_nuit, statut, description)
			VALUES (?, ?, ?, ?, ?, ?)
			`,
			[numero, type, capacite, resolvedPrixNuit, statut, description]
		);

		broadcastDataChange({
			type: "chambres-updated",
			action: "add",
			chambreId: Number(result.insertId)
		});

		return res.status(201).json({
			message: "Chambre créée avec succès",
			id: result.insertId
		});
	} catch (err) {
		console.error("Erreur création chambre:", err);

		if (err.code === "ER_DUP_ENTRY") {
			return res.status(409).json({ error: "Ce numéro de chambre existe déjà" });
		}

		return res.status(500).json({
			error: "Erreur lors de la création de la chambre"
		});
	}
};

const updateOneChambre = async (req, res) => {
	const connexion = ensureConnexion();
	const id = parsePositiveInt(req.params.id);

	if (!id) {
		return res.status(400).json({ error: "Identifiant chambre invalide" });
	}

	const numero = normalizeString(req.body.numero);
	const type = normalizeString(req.body.type) || "Standard";
	const capacite = parsePositiveInt(req.body.capacite ?? 1);
	const prixNuit = parseNonNegativeNumber(req.body.prix_nuit, 0);
	const description = normalizeString(req.body.description) || null;

	if (!numero) {
		return res.status(400).json({ error: "Le numéro de chambre est obligatoire" });
	}
	if (!capacite) {
		return res.status(400).json({ error: "La capacité doit être un entier positif" });
	}
	if (prixNuit === null) {
		return res.status(400).json({ error: "Le prix/nuit est invalide" });
	}

	try {
		const [result] = await connexion.execute(
			`
			UPDATE ${CHAMBRES_MODEL.name}
			SET numero = ?, type = ?, capacite = ?, prix_nuit = ?, description = ?
			WHERE id = ?
			`,
			[numero, type, capacite, prixNuit, description, id]
		);

		if (result.affectedRows === 0) {
			return res.status(404).json({ error: "Chambre non trouvée" });
		}

		broadcastDataChange({
			type: "chambres-updated",
			action: "update",
			chambreId: id
		});

		return res.status(200).json({ message: "Chambre modifiée avec succès" });
	} catch (err) {
		console.error("Erreur modification chambre:", err);

		if (err.code === "ER_DUP_ENTRY") {
			return res.status(409).json({ error: "Ce numéro de chambre existe déjà" });
		}

		return res.status(500).json({
			error: "Erreur lors de la modification de la chambre"
		});
	}
};

const deleteOneChambre = async (req, res) => {
	try {
		const connexion = ensureConnexion();
		const id = parsePositiveInt(req.params.id);
		if (!id) {
			return res.status(400).json({ error: "Identifiant chambre invalide" });
		}

		const [result] = await connexion.execute(`DELETE FROM ${CHAMBRES_MODEL.name} WHERE id = ?`, [id]);

		if (result.affectedRows === 0) {
			return res.status(404).json({ error: "Chambre non trouvée" });
		}

		broadcastDataChange({
			type: "chambres-updated",
			action: "delete",
			chambreId: id
		});

		return res.status(200).json({ message: "Chambre supprimée avec succès" });
	} catch (err) {
		console.error("Erreur suppression chambre:", err);

		if (["ER_ROW_IS_REFERENCED_2", "ER_ROW_IS_REFERENCED"].includes(err.code)) {
			return res.status(409).json({
				error: "Suppression impossible : la chambre est liée à des occupations"
			});
		}

		return res.status(500).json({
			error: "Erreur lors de la suppression de la chambre"
		});
	}
};

const updateChambreStatus = async (req, res) => {
	const connexion = ensureConnexion();
	const id = parsePositiveInt(req.params.id);
	const requestedStatus = normalizeString(req.body.statut).toLowerCase();

	if (!id) {
		return res.status(400).json({ error: "Identifiant chambre invalide" });
	}
	if (!MANUAL_ROOM_STATUSES.has(requestedStatus)) {
		return res.status(400).json({
			error: "Statut invalide (libre ou maintenance)"
		});
	}

	try {
		await connexion.beginTransaction();
		const { room, activeOccupation } = await getLockedRoomState(connexion, id);

		if (!room) {
			await connexion.rollback();
			return res.status(404).json({ error: "Chambre non trouvée" });
		}

		if (activeOccupation) {
			await connexion.rollback();
			return res.status(409).json({
				error: "Impossible de changer le statut: une occupation active existe"
			});
		}

		if (room.statut === requestedStatus) {
			await connexion.commit();
			return res.status(200).json({ message: "Aucune modification de statut" });
		}

		await connexion.execute(
			`UPDATE ${CHAMBRES_MODEL.name} SET statut = ? WHERE id = ?`,
			[requestedStatus, id]
		);

		await connexion.commit();

		broadcastDataChange({
			type: "chambres-updated",
			action: "status",
			chambreId: id,
			statut: requestedStatus
		});

		return res.status(200).json({ message: `Statut mis à jour: ${requestedStatus}` });
	} catch (err) {
		await connexion.rollback();
		console.error("Erreur changement statut chambre:", err);
		return res.status(500).json({
			error: "Erreur lors de la mise à jour du statut"
		});
	}
};

const createChambreOccupation = async (req, res) => {
	const connexion = ensureConnexion();
	const chambreId = parsePositiveInt(req.params.id);
	const mode = normalizeString(req.body.mode).toLowerCase();
	const rawStayType = normalizeString(req.body.type_sejour || req.body.stay_type).toLowerCase();
	const stayType = rawStayType ? rawStayType : "nuit";
	const clientId = req.body.client_id ? parsePositiveInt(req.body.client_id) : null;
	const occupantNomInput = normalizeString(req.body.occupant_nom);
	const occupantContactInput = normalizeString(req.body.occupant_contact);
	const occupantCinInput = normalizeString(req.body.occupant_cin);
	const dateDebut = parseDateTime(req.body.date_debut) || new Date();
	const dateFinPrevueRaw = req.body.date_fin_prevue;
	const dateFinPrevue = parseDateTime(dateFinPrevueRaw);
	const note = normalizeString(req.body.note) || null;
	const montantAcompteInput = parseNonNegativeNumber(req.body.montant_acompte, null);
	const targetOccupationId = parsePositiveInt(req.body.occupation_id || req.body.reservation_id);
	const checkOnly = Boolean(req.body.check_only || req.query.check_only);

	if (!chambreId) {
		return res.status(400).json({ error: "Identifiant chambre invalide" });
	}
	if (!OCCUPATION_TYPES.has(mode)) {
		return res.status(400).json({ error: "Mode invalide (reservation ou occupation)" });
	}
	if (rawStayType && !STAY_TYPES.has(rawStayType)) {
		return res.status(400).json({ error: "Type de séjour invalide (nuit, passage ou journee)" });
	}
	if (!STAY_TYPES.has(stayType)) {
		return res.status(400).json({ error: "Type de séjour invalide (nuit, passage ou journee)" });
	}
	if (mode === "reservation" && !dateFinPrevueRaw) {
		return res.status(400).json({ error: "Date de fin prévue obligatoire pour la réservation" });
	}
	if (stayType === "journee" && !dateFinPrevueRaw) {
		return res.status(400).json({ error: "Date de fin prévue obligatoire pour la journée" });
	}
	if (dateFinPrevueRaw && !dateFinPrevue) {
		return res.status(400).json({ error: "Date de fin prévue invalide" });
	}
	if (dateFinPrevue && dateFinPrevue < dateDebut) {
		return res.status(400).json({
			error: "La date de fin prévue doit être postérieure à la date de début"
		});
	}
	if (stayType === "nuit" && dateFinPrevue && isSameCalendarDay(dateDebut, dateFinPrevue)) {
		return res.status(400).json({
			error: "Séjour nuit impossible sur la même journée. Choisissez Passage ou Journée."
		});
	}

	try {
		await connexion.beginTransaction();
		const { room } = await getLockedRoomState(connexion, chambreId);

		if (!room) {
			await connexion.rollback();
			return res.status(404).json({ error: "Chambre non trouvée" });
		}
		if (!ROOM_STATUSES.has(String(room.statut ?? "").toLowerCase())) {
			await connexion.rollback();
			return res.status(409).json({ error: "Statut de chambre invalide" });
		}
		if (String(room.statut).toLowerCase() === "maintenance") {
			await connexion.rollback();
			return res.status(409).json({ error: "Chambre en maintenance" });
		}

		const buildConflictPayload = (entry) => ({
			id: entry.id,
			type_occupation: entry.type_occupation,
			date_debut: entry.date_debut,
			date_fin_prevue: entry.date_fin_prevue
		});

		let targetOccupation = null;
		if (targetOccupationId) {
			const [[lockedTarget]] = await connexion.execute(
				`
				SELECT
					o.id,
					o.chambre_id,
					o.client_id,
					o.occupant_nom,
					o.occupant_contact,
					o.occupant_cin,
					o.type_occupation,
					o.type_sejour,
					o.date_debut,
					o.date_fin_prevue,
					o.date_fin_reelle,
					o.prix_nuit,
					o.prix_heure,
					o.prix_journee,
					o.montant_total,
					o.montant_acompte,
					o.date_acompte,
					o.montant_solde,
					o.date_solde,
					o.note,
					TRIM(CONCAT(COALESCE(c.nom, ''), ' ', COALESCE(c.prenom, ''))) AS client_nom,
					c.numTel AS client_num_tel,
					c.numberCNI AS client_cin
				FROM ${CHAMBRE_OCCUPATIONS_MODEL.name} o
				LEFT JOIN ${CLIENT_MODEL.name} c ON c.id = o.client_id
				WHERE o.id = ? AND o.chambre_id = ? AND o.statut = 'active'
				LIMIT 1
				FOR UPDATE
				`,
				[targetOccupationId, chambreId]
			);
			if (!lockedTarget) {
				await connexion.rollback();
				return res.status(404).json({ error: "Réservation introuvable" });
			}
			targetOccupation = lockedTarget;
		}

		if (mode === "reservation" && targetOccupation) {
			const now = new Date();
			if (dateDebut && dateDebut < now) {
				await connexion.rollback();
				return res.status(400).json({
					error: "Modification impossible: date de début déjà passée"
				});
			}
			if (dateFinPrevue && dateFinPrevue <= now) {
				await connexion.rollback();
				return res.status(400).json({
					error: "Modification impossible: date de fin déjà passée"
				});
			}
		}

		const overlap = await findOverlappingActiveOccupation(
			connexion,
			chambreId,
			dateDebut,
			dateFinPrevue,
			targetOccupation ? targetOccupation.id : null
		);

		if (mode === "reservation" && overlap) {
			await connexion.rollback();
			return res.status(409).json({
				error: "Chambre occupée à ce moment",
				conflict: buildConflictPayload(overlap)
			});
		}

		if (mode === "reservation" && targetOccupation && String(targetOccupation.type_occupation) !== "reservation") {
			await connexion.rollback();
			return res.status(409).json({
				error: "Occupation active déjà en cours"
			});
		}

		if (mode === "reservation" && targetOccupation) {
			const originalStart = parseDateTime(targetOccupation.date_debut);
			if (originalStart && originalStart <= new Date()) {
				await connexion.rollback();
				return res.status(409).json({
					error: "Modification impossible: la réservation est déjà en cours"
				});
			}
		}

		let reservationToConvert = null;
		if (mode === "occupation") {
			if (targetOccupation) {
				if (overlap) {
					await connexion.rollback();
					return res.status(409).json({
						error: "Chambre occupée à ce moment",
						conflict: buildConflictPayload(overlap)
					});
				}
				if (String(targetOccupation.type_occupation) !== "reservation") {
					await connexion.rollback();
					return res.status(409).json({ error: "Occupation active déjà en cours" });
				}
				reservationToConvert = targetOccupation;
			} else if (overlap) {
				await connexion.rollback();
				return res.status(409).json({
					error: "Chambre occupée à ce moment",
					conflict: buildConflictPayload(overlap)
				});
			}
		}

		if (mode === "occupation" && reservationToConvert && !checkOnly) {
			const now = new Date();
			const reservationStart = parseDateTime(reservationToConvert.date_debut) || dateDebut;
			const reservationEnd = parseDateTime(reservationToConvert.date_fin_prevue) || dateFinPrevue;

			if (reservationStart && now < reservationStart) {
				await connexion.rollback();
				return res.status(409).json({
					error: "Check-in impossible: plage horaire pas encore atteinte"
				});
			}
			if (reservationEnd && now >= reservationEnd) {
				await autoCancelExpiredReservations(connexion, chambreId);
				await connexion.commit();
				return res.status(409).json({
					error: "Réservation expirée: plage horaire dépassée"
				});
			}
		}

		const condition = await ensureChambreCondition(connexion);
		const effectiveStayType = rawStayType && STAY_TYPES.has(rawStayType)
			? rawStayType
			: (reservationToConvert?.type_sejour && STAY_TYPES.has(String(reservationToConvert.type_sejour))
				? String(reservationToConvert.type_sejour)
				: stayType);
		const alignedStart = effectiveStayType === "nuit"
			? alignDateToTime(dateDebut, condition.checkin_time)
			: null;
		const alignedEnd = dateFinPrevue && effectiveStayType === "nuit"
			? alignDateToTime(dateFinPrevue, condition.checkout_time)
			: null;
		const computeNights = (start, end) => {
			if (!start || !end) return 0;
			const diffMs = end.getTime() - start.getTime();
			if (diffMs <= 0) return 0;
			return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
		};

		if (effectiveStayType === "passage" && !dateFinPrevue) {
			await connexion.rollback();
			return res.status(400).json({ error: "Date de fin prévue obligatoire pour le passage" });
		}
		if (effectiveStayType === "passage" && dateFinPrevue && dateFinPrevue <= dateDebut) {
			await connexion.rollback();
			return res.status(400).json({
				error: "La date de fin prévue doit être postérieure à la date de début"
			});
		}
		if (effectiveStayType === "journee" && !dateFinPrevue) {
			await connexion.rollback();
			return res.status(400).json({ error: "Date de fin prévue obligatoire pour la journée" });
		}
		if (effectiveStayType === "nuit" && mode === "reservation" && !alignedEnd) {
			await connexion.rollback();
			return res.status(400).json({ error: "Date de fin prévue obligatoire pour la réservation" });
		}
		if (effectiveStayType === "nuit" && alignedStart && alignedEnd && alignedEnd <= alignedStart) {
			await connexion.rollback();
			return res.status(400).json({
				error: "La date de fin prévue doit être postérieure à la date de début"
			});
		}
		if (effectiveStayType === "nuit" && mode === "occupation" && alignedStart && alignedEnd && !reservationToConvert) {
			const nightsCount = computeNights(alignedStart, alignedEnd);
			if (nightsCount > 1) {
				await connexion.rollback();
				return res.status(400).json({
					error: "Occupation nuit sur plusieurs dates interdite. Choisissez une réservation."
				});
			}
		}
		if (effectiveStayType === "journee" && mode === "occupation" && dateFinPrevue && !isSameCalendarDay(dateDebut, dateFinPrevue) && !reservationToConvert) {
			await connexion.rollback();
			return res.status(400).json({
				error: "Occupation journée sur plusieurs dates interdite. Choisissez une réservation."
			});
		}
		if (effectiveStayType === "journee" && dateFinPrevue) {
			const startMinutes = getMinutesFromDate(dateDebut);
			const endMinutes = getMinutesFromDate(dateFinPrevue);
			const dayStartMinutes = getMinutesFromTimeValue(condition.day_checkin_time);
			const dayEndMinutes = getMinutesFromTimeValue(condition.day_checkout_time);
			const invalidJourneeTime = !Number.isFinite(startMinutes)
				|| !Number.isFinite(endMinutes)
				|| !Number.isFinite(dayStartMinutes)
				|| !Number.isFinite(dayEndMinutes)
				|| startMinutes >= endMinutes
				|| endMinutes <= dayStartMinutes
				|| startMinutes >= dayEndMinutes;
			if (invalidJourneeTime) {
				await connexion.rollback();
				return res.status(400).json({ error: "Choisissez Nuit ou Passage" });
			}
		}
		if (checkOnly) {
			await connexion.rollback();
			return res.status(200).json({ message: "Disponibilité confirmée" });
		}

		const priceNuit = Number(reservationToConvert?.prix_nuit ?? room.prix_nuit) || 0;
		const storedPriceHeure = Number(reservationToConvert?.prix_heure);
		const priceHeure = Number.isFinite(storedPriceHeure)
			? storedPriceHeure
			: await getHourlyPriceForType(connexion, room.type);
		const storedPriceJournee = Number(reservationToConvert?.prix_journee);
		const priceJournee = Number.isFinite(storedPriceJournee)
			? storedPriceJournee
			: await getDayPriceForType(connexion, room.type);
		const nights = effectiveStayType === "nuit" ? computeNights(alignedStart, alignedEnd) : 0;
		const journeeExtras = effectiveStayType === "journee" && dateFinPrevue
			? calculateJourneeExtras(dateDebut, dateFinPrevue, condition.day_checkin_time, condition.day_checkout_time)
			: null;
		const days = effectiveStayType === "journee" ? (journeeExtras?.dayCount || 0) : 0;
		const earlyHours = effectiveStayType === "nuit" && alignedStart && dateDebut && dateDebut < alignedStart
			? calculateHours(dateDebut, alignedStart)
			: 0;
		const lateHours = effectiveStayType === "nuit" && alignedEnd && dateFinPrevue && dateFinPrevue > alignedEnd
			? calculateHours(alignedEnd, dateFinPrevue)
			: 0;
		let montantTotal = 0;
		if (effectiveStayType === "passage") {
			if (priceHeure <= 0) {
				await connexion.rollback();
				return res.status(400).json({ error: "Prix/heure non défini pour ce type de chambre" });
			}
			const passageHours = calculateHours(dateDebut, dateFinPrevue);
			if (passageHours <= 0) {
				await connexion.rollback();
				return res.status(400).json({
					error: "La date de fin prévue doit être postérieure à la date de début"
				});
			}
			montantTotal = Number((passageHours * priceHeure).toFixed(2));
		} else if (effectiveStayType === "journee") {
			if (priceJournee <= 0) {
				await connexion.rollback();
				return res.status(400).json({ error: "Prix/journée non défini pour ce type de chambre" });
			}
			const baseTotal = days > 0 ? Number((days * priceJournee).toFixed(2)) : 0;
			const extraHoursTotal = journeeExtras?.extraHoursTotal || 0;
			const extraTotal = priceHeure > 0 && extraHoursTotal > 0
				? Number((extraHoursTotal * priceHeure).toFixed(2))
				: 0;
			montantTotal = Number((baseTotal + extraTotal).toFixed(2));
		} else {
			const baseTotal = priceNuit > 0 && nights > 0 ? Number((nights * priceNuit).toFixed(2)) : 0;
			const earlyTotal = priceHeure > 0 && earlyHours > 0 ? Number((earlyHours * priceHeure).toFixed(2)) : 0;
			const lateTotal = priceHeure > 0 && lateHours > 0 ? Number((lateHours * priceHeure).toFixed(2)) : 0;
			montantTotal = Number((baseTotal + earlyTotal + lateTotal).toFixed(2));
		}
		const depositPercent = Number(condition.deposit_percent) || 0;
		const minDeposit = Number(((montantTotal * depositPercent) / 100).toFixed(2));
		const existingAcompte = targetOccupation && String(targetOccupation.type_occupation) === "reservation"
			? Number(targetOccupation.montant_acompte) || 0
			: 0;
		const montantAcompteEntry = mode === "reservation" ? (montantAcompteInput ?? 0) : null;
		const montantAcompte = mode === "reservation"
			? Number((existingAcompte + (montantAcompteEntry || 0)).toFixed(2))
			: null;

		if (mode === "reservation") {
			if (montantAcompteInput === null && !targetOccupation) {
				await connexion.rollback();
				return res.status(400).json({ error: "Montant d'acompte invalide" });
			}
			if (targetOccupation) {
				const requiredExtra = Math.max(0, Number((minDeposit - existingAcompte).toFixed(2)));
				if ((montantAcompteEntry || 0) < requiredExtra) {
					await connexion.rollback();
					return res.status(400).json({
						error: `Acompte insuffisant (minimum ${requiredExtra})`
					});
				}
			} else if (montantAcompte < minDeposit) {
				await connexion.rollback();
				return res.status(400).json({
					error: `Acompte insuffisant (minimum ${minDeposit})`
				});
			}
		}

		let resolvedClientId = clientId;
		let clientData = null;
		if (resolvedClientId) {
			const [[client]] = await connexion.execute(
				`SELECT id, nom, prenom, numTel, numberCNI FROM ${CLIENT_MODEL.name} WHERE id = ? LIMIT 1`,
				[resolvedClientId]
			);
			if (!client) {
				await connexion.rollback();
				return res.status(404).json({ error: "Client introuvable" });
			}
			clientData = client;
		}

		if (reservationToConvert) {
			if (mode === "occupation" && String(reservationToConvert.type_occupation) === "reservation") {
				const mergedClientId = resolvedClientId || Number(reservationToConvert.client_id) || null;
				let mergedClientData = clientData;
				if (!mergedClientData && mergedClientId) {
					const [[client]] = await connexion.execute(
						`SELECT id, nom, prenom, numTel FROM ${CLIENT_MODEL.name} WHERE id = ? LIMIT 1`,
						[mergedClientId]
					);
					mergedClientData = client || null;
				}

				const fallbackClientName = buildClientDisplayName(mergedClientData) || normalizeString(reservationToConvert.client_nom);
				const fallbackClientCin = normalizeString(mergedClientData?.numberCNI);
				const occupantNom = occupantNomInput || normalizeString(reservationToConvert.occupant_nom) || fallbackClientName;
				const occupantContact = occupantContactInput || normalizeString(reservationToConvert.occupant_contact) || normalizeString(mergedClientData?.numTel) || null;
				const occupantCin = occupantCinInput || normalizeString(reservationToConvert.occupant_cin) || fallbackClientCin;
				const mergedNote = note || normalizeString(reservationToConvert.note) || null;

				if (!occupantNom) {
					await connexion.rollback();
					return res.status(400).json({
						error: "Le nom de l'occupant est requis pour passer en occupation"
					});
				}
				if (condition.cin_required_occupation && !occupantCin) {
					await connexion.rollback();
					return res.status(400).json({
						error: "Le CIN est requis pour passer en occupation"
					});
				}

				const finalStart = dateDebut;
				const finalEnd = dateFinPrevue;
				const updatedTotal = montantTotal > 0
					? montantTotal
					: (Number(reservationToConvert.montant_total) || 0);

				await connexion.execute(
					`
					UPDATE ${CHAMBRE_OCCUPATIONS_MODEL.name}
					SET
						client_id = ?,
						occupant_nom = ?,
						occupant_contact = ?,
						occupant_cin = ?,
						type_occupation = 'occupation',
						type_sejour = ?,
						date_debut = ?,
						date_fin_prevue = ?,
						prix_nuit = ?,
						prix_heure = ?,
						prix_journee = ?,
						montant_total = ?,
						note = ?
					WHERE id = ?
					`,
					[
						mergedClientId,
						occupantNom,
						occupantContact,
						occupantCin,
						effectiveStayType,
						finalStart,
						finalEnd,
						priceNuit || null,
						priceHeure || null,
						priceJournee || null,
						updatedTotal || null,
						mergedNote,
						reservationToConvert.id
					]
				);

				await connexion.execute(
					`UPDATE ${CHAMBRES_MODEL.name} SET statut = 'occupee' WHERE id = ?`,
					[chambreId]
				);

				await connexion.commit();

				broadcastDataChange({
					type: "chambres-updated",
					action: "checkin",
					chambreId
				});

				return res.status(200).json({
					message: "Réservation convertie en occupation"
				});
			}

			await connexion.rollback();
			return res.status(409).json({
				error: "Cette chambre possède déjà une réservation/occupation active"
			});
		}

		if (mode === "reservation" && targetOccupation) {
			const mergedClientId = resolvedClientId || Number(targetOccupation.client_id) || null;
			let mergedClientData = clientData;
			if (!mergedClientData && mergedClientId) {
				const [[client]] = await connexion.execute(
					`SELECT id, nom, prenom, numTel, numberCNI FROM ${CLIENT_MODEL.name} WHERE id = ? LIMIT 1`,
					[mergedClientId]
				);
				mergedClientData = client || null;
			}

			const fallbackClientName = buildClientDisplayName(mergedClientData) || normalizeString(targetOccupation.client_nom);
			const fallbackClientCin = normalizeString(mergedClientData?.numberCNI) || normalizeString(targetOccupation.client_cin);
			const occupantNom = occupantNomInput || normalizeString(targetOccupation.occupant_nom) || fallbackClientName;
			const occupantContact = occupantContactInput
				|| normalizeString(targetOccupation.occupant_contact)
				|| normalizeString(mergedClientData?.numTel)
				|| null;
			const occupantCin = occupantCinInput || normalizeString(targetOccupation.occupant_cin) || fallbackClientCin;
			const mergedNote = note || normalizeString(targetOccupation.note) || null;

			if (!occupantNom) {
				await connexion.rollback();
				return res.status(400).json({
					error: "Le nom de l'occupant est requis"
				});
			}
			if (condition.cin_required_reservation && !occupantCin) {
				await connexion.rollback();
				return res.status(400).json({
					error: "Le CIN est requis"
				});
			}

			const dateAcompte = montantAcompteEntry && montantAcompteEntry > 0
				? new Date()
				: (targetOccupation.date_acompte || null);

			await connexion.execute(
				`
				UPDATE ${CHAMBRE_OCCUPATIONS_MODEL.name}
				SET
					client_id = ?,
					occupant_nom = ?,
					occupant_contact = ?,
					occupant_cin = ?,
					type_sejour = ?,
					date_debut = ?,
					date_fin_prevue = ?,
					prix_nuit = ?,
					prix_heure = ?,
					prix_journee = ?,
					montant_total = ?,
					montant_acompte = ?,
					date_acompte = ?,
					note = ?
				WHERE id = ?
				`,
				[
					mergedClientId,
					occupantNom,
					occupantContact,
					occupantCin,
					effectiveStayType,
					dateDebut,
					dateFinPrevue,
					priceNuit || null,
					priceHeure || null,
					priceJournee || null,
					montantTotal || null,
					montantAcompte || 0,
					dateAcompte,
					mergedNote,
					targetOccupation.id
				]
			);

			await connexion.commit();

			broadcastDataChange({
				type: "chambres-updated",
				action: "reserve-update",
				chambreId
			});

			return res.status(200).json({
				message: "Réservation modifiée"
			});
		}

		const fallbackClientName = buildClientDisplayName(clientData);
		const fallbackClientCin = normalizeString(clientData?.numberCNI);
		const occupantNom = occupantNomInput || fallbackClientName;
		const occupantContact = occupantContactInput || normalizeString(clientData?.numTel) || null;
		const occupantCin = occupantCinInput || fallbackClientCin;
		const cinRequired = mode === "reservation"
			? condition.cin_required_reservation
			: condition.cin_required_occupation;

		if (!occupantNom) {
			await connexion.rollback();
			return res.status(400).json({
				error: "Le nom de l'occupant est requis"
			});
		}
		if (cinRequired && !occupantCin) {
			await connexion.rollback();
			return res.status(400).json({
				error: "Le CIN est requis"
			});
		}

		const finalStart = dateDebut;
		const finalEnd = dateFinPrevue;
		const dateAcompte = mode === "reservation" && montantAcompte > 0 ? new Date() : null;

		const targetStatus = mode === "reservation" ? "reservee" : "occupee";

		await connexion.execute(
			`
			INSERT INTO ${CHAMBRE_OCCUPATIONS_MODEL.name}
			(chambre_id, client_id, occupant_nom, occupant_contact, occupant_cin, type_occupation, type_sejour, date_debut, date_fin_prevue, prix_nuit, prix_heure, prix_journee, montant_total, montant_acompte, date_acompte, montant_solde, date_solde, statut, note)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
			`,
			[
				chambreId,
				resolvedClientId,
				occupantNom,
				occupantContact,
				occupantCin,
				mode,
				effectiveStayType,
				finalStart,
				finalEnd,
				priceNuit || null,
				priceHeure || null,
				priceJournee || null,
				montantTotal || null,
				mode === "reservation" ? montantAcompte : null,
				dateAcompte,
				null,
				null,
				note
			]
		);

		await connexion.execute(
			`UPDATE ${CHAMBRES_MODEL.name} SET statut = ? WHERE id = ?`,
			[targetStatus, chambreId]
		);

		await connexion.commit();

		broadcastDataChange({
			type: "chambres-updated",
			action: mode === "reservation" ? "reserve" : "occupy",
			chambreId
		});

		return res.status(201).json({
			message: mode === "reservation" ? "Chambre réservée" : "Chambre occupée"
		});
	} catch (err) {
		await connexion.rollback();
		console.error("Erreur affectation chambre:", err);
		return res.status(500).json({
			error: "Erreur lors de l'affectation de la chambre"
		});
	}
};

const releaseChambre = async (req, res) => {
	const connexion = ensureConnexion();
	const chambreId = parsePositiveInt(req.params.id);
	const releaseMode = normalizeString(req.body.mode).toLowerCase();
	const extraNote = normalizeString(req.body.note);
	const montantRecuInput = parseNonNegativeNumber(req.body.montant_recu, null);
	const targetOccupationId = parsePositiveInt(req.body.occupation_id || req.body.reservation_id);

	if (!chambreId) {
		return res.status(400).json({ error: "Identifiant chambre invalide" });
	}
	if (releaseMode && !RELEASE_MODES.has(releaseMode)) {
		return res.status(400).json({ error: "Mode de libération invalide" });
	}

	try {
		await connexion.beginTransaction();
		const { room, activeOccupation } = await getLockedRoomState(connexion, chambreId);

		if (!room) {
			await connexion.rollback();
			return res.status(404).json({ error: "Chambre non trouvée" });
		}

		let targetOccupation = activeOccupation || null;
		if (targetOccupationId) {
			const [[lockedTarget]] = await connexion.execute(
				`
				SELECT
					o.id,
					o.chambre_id,
					o.client_id,
					o.occupant_nom,
					o.occupant_contact,
					o.occupant_cin,
					o.type_occupation,
					o.type_sejour,
					o.date_debut,
					o.date_fin_prevue,
					o.date_fin_reelle,
					o.prix_nuit,
					o.prix_heure,
					o.prix_journee,
					o.montant_total,
					o.montant_acompte,
					o.date_acompte,
					o.montant_solde,
					o.date_solde,
					o.note
				FROM ${CHAMBRE_OCCUPATIONS_MODEL.name} o
				WHERE o.id = ? AND o.chambre_id = ? AND o.statut = 'active'
				LIMIT 1
				FOR UPDATE
				`,
				[targetOccupationId, chambreId]
			);
			if (!lockedTarget) {
				await connexion.rollback();
				return res.status(404).json({ error: "Réservation introuvable" });
			}
			targetOccupation = lockedTarget;
		}

		if (!targetOccupation) {
			if (String(room.statut) === "libre") {
				await connexion.rollback();
				return res.status(409).json({ error: "Cette chambre est déjà libre" });
			}
			if (String(room.statut) === "maintenance") {
				await connexion.rollback();
				return res.status(409).json({
					error: "La chambre est en maintenance, utilisez la mise à jour de statut"
				});
			}

			await connexion.execute(
				`UPDATE ${CHAMBRES_MODEL.name} SET statut = 'libre' WHERE id = ?`,
				[chambreId]
			);
			await connexion.commit();

			broadcastDataChange({
				type: "chambres-updated",
				action: "force-release",
				chambreId
			});

			return res.status(200).json({
				message: "Chambre remise en statut libre"
			});
		}

		const condition = await ensureChambreCondition(connexion);
		const dateDebut = parseDateTime(targetOccupation.date_debut) || new Date();
		const stayType = STAY_TYPES.has(String(targetOccupation.type_sejour))
			? String(targetOccupation.type_sejour)
			: "nuit";
		const isReservation = String(targetOccupation.type_occupation) === "reservation";
		const actualEnd = new Date();
		let alignedEnd = stayType === "nuit"
			? alignDateToTime(actualEnd, condition.checkout_time)
			: null;
		const alignedStart = stayType === "nuit"
			? alignDateToTime(dateDebut, condition.checkin_time)
			: null;
		if (stayType === "nuit" && alignedEnd && alignedStart && alignedEnd <= alignedStart) {
			alignedEnd = new Date(alignedEnd);
			alignedEnd.setDate(alignedEnd.getDate() + 1);
		}
		const priceNuit = Number(targetOccupation.prix_nuit ?? room.prix_nuit) || 0;
		const storedPriceHeure = Number(targetOccupation.prix_heure);
		const priceHeure = Number.isFinite(storedPriceHeure)
			? storedPriceHeure
			: await getHourlyPriceForType(connexion, room.type);
		const storedPriceJournee = Number(targetOccupation.prix_journee);
		const priceJournee = Number.isFinite(storedPriceJournee)
			? storedPriceJournee
			: await getDayPriceForType(connexion, room.type);
		const computeNights = (start, end) => {
			if (!start || !end) return 0;
			const diffMs = end.getTime() - start.getTime();
			if (diffMs <= 0) return 0;
			return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
		};
		const nights = stayType === "nuit" ? computeNights(alignedStart, alignedEnd) : 0;
		const earlyHours = stayType === "nuit" && alignedStart && dateDebut < alignedStart
			? calculateHours(dateDebut, alignedStart)
			: 0;
		const lateHours = stayType === "nuit" && alignedEnd && actualEnd > alignedEnd
			? calculateHours(alignedEnd, actualEnd)
			: 0;
		let recalculatedTotal = 0;
		if (stayType === "passage") {
			const passageHours = calculateHours(dateDebut, actualEnd);
			recalculatedTotal = priceHeure > 0 && passageHours > 0
				? Number((passageHours * priceHeure).toFixed(2))
				: 0;
		} else if (stayType === "journee") {
			const journeeExtrasBilling = calculateJourneeExtras(
				dateDebut,
				actualEnd,
				condition.day_checkin_time,
				condition.day_checkout_time
			);
			const billingDays = journeeExtrasBilling?.dayCount || 0;
			const baseTotal = priceJournee > 0 && billingDays > 0
				? Number((billingDays * priceJournee).toFixed(2))
				: 0;
			const extraHoursTotal = journeeExtrasBilling?.extraHoursTotal || 0;
			const extraTotal = priceHeure > 0 && extraHoursTotal > 0
				? Number((extraHoursTotal * priceHeure).toFixed(2))
				: 0;
			recalculatedTotal = Number((baseTotal + extraTotal).toFixed(2));
		} else {
			const baseTotal = priceNuit > 0 && nights > 0
				? Number((nights * priceNuit).toFixed(2))
				: 0;
			const earlyTotal = priceHeure > 0 && earlyHours > 0
				? Number((earlyHours * priceHeure).toFixed(2))
				: 0;
			const lateTotal = priceHeure > 0 && lateHours > 0
				? Number((lateHours * priceHeure).toFixed(2))
				: 0;
			recalculatedTotal = Number((baseTotal + earlyTotal + lateTotal).toFixed(2));
		}
		if (!recalculatedTotal) {
			recalculatedTotal = Number(targetOccupation.montant_total) || 0;
		}
		const montantAcompte = Number(targetOccupation.montant_acompte) || 0;
		const reste = Math.max(0, recalculatedTotal - montantAcompte);

		if (releaseMode === "checkout") {
			if (montantRecuInput === null) {
				await connexion.rollback();
				return res.status(400).json({ error: "Montant reçu invalide" });
			}
			if (montantRecuInput < reste) {
				await connexion.rollback();
				return res.status(400).json({ error: "Montant reçu insuffisant" });
			}
		}

		const montantSolde = releaseMode === "checkout"
			? Math.min(Math.max(montantRecuInput || 0, 0), reste)
			: null;
		const dateSolde = releaseMode === "checkout" && montantSolde > 0 ? new Date() : null;

		let occupationStatus = "terminee";
		if (isReservation) {
			occupationStatus = releaseMode === "checkout" ? "terminee" : "annulee";
		}

		const statusNotePrefix = isReservation
			? (occupationStatus === "annulee" ? "Réservation annulée" : "Réservation clôturée")
			: "Occupation clôturée";
		const mergedNote = [normalizeString(targetOccupation.note), statusNotePrefix, extraNote]
			.filter(Boolean)
			.join(" | ");

		await connexion.execute(
			`
			UPDATE ${CHAMBRE_OCCUPATIONS_MODEL.name}
			SET statut = ?, date_fin_reelle = ?, prix_nuit = ?, prix_heure = ?, prix_journee = ?, montant_total = ?, montant_solde = ?, date_solde = ?, note = ?
			WHERE id = ?
			`,
			[
				occupationStatus,
				actualEnd,
				priceNuit || null,
				priceHeure || null,
				priceJournee || null,
				recalculatedTotal || null,
				montantSolde,
				dateSolde,
				mergedNote || null,
				targetOccupation.id
			]
		);

		if (String(room.statut).toLowerCase() !== "maintenance") {
			await connexion.execute(
				`UPDATE ${CHAMBRES_MODEL.name} SET statut = 'libre' WHERE id = ?`,
				[chambreId]
			);
		}

		await connexion.commit();

		broadcastDataChange({
			type: "chambres-updated",
			action: isReservation ? "reservation-release" : "checkout",
			chambreId
		});

		return res.status(200).json({
			message: isReservation
				? (occupationStatus === "annulee" ? "Réservation annulée" : "Réservation clôturée")
				: "Chambre libérée"
		});
	} catch (err) {
		await connexion.rollback();
		console.error("Erreur libération chambre:", err);
		return res.status(500).json({
			error: "Erreur lors de la libération de la chambre"
		});
	}
};

const payChambreOccupation = async (req, res) => {
	const connexion = ensureConnexion();
	const chambreId = parsePositiveInt(req.params.id);
	const occupationId = parsePositiveInt(req.body.occupation_id || req.body.reservation_id);
	const montantRecuInput = parseNonNegativeNumber(req.body.montant_recu, null);

	if (!chambreId) {
		return res.status(400).json({ error: "Identifiant chambre invalide" });
	}
	if (!occupationId) {
		return res.status(400).json({ error: "Identifiant occupation invalide" });
	}
	if (montantRecuInput === null || montantRecuInput <= 0) {
		return res.status(400).json({ error: "Montant reçu invalide" });
	}

	try {
		await connexion.beginTransaction();

		const [[room]] = await connexion.execute(
			`SELECT id, numero, type, prix_nuit, statut FROM ${CHAMBRES_MODEL.name} WHERE id = ? FOR UPDATE`,
			[chambreId]
		);
		if (!room) {
			await connexion.rollback();
			return res.status(404).json({ error: "Chambre non trouvée" });
		}

		const [[targetOccupation]] = await connexion.execute(
			`
			SELECT
				o.id,
				o.chambre_id,
				o.type_occupation,
				o.type_sejour,
				o.date_debut,
				o.date_fin_prevue,
				o.prix_nuit,
				o.prix_heure,
				o.prix_journee,
				o.montant_total,
				o.montant_acompte,
				o.date_acompte
			FROM ${CHAMBRE_OCCUPATIONS_MODEL.name} o
			WHERE o.id = ? AND o.chambre_id = ? AND o.statut = 'active'
			LIMIT 1
			FOR UPDATE
			`,
			[occupationId, chambreId]
		);
		if (!targetOccupation) {
			await connexion.rollback();
			return res.status(404).json({ error: "Occupation introuvable" });
		}

		const condition = await ensureChambreCondition(connexion);
		const dateDebut = parseDateTime(targetOccupation.date_debut) || new Date();
		const stayType = STAY_TYPES.has(String(targetOccupation.type_sejour))
			? String(targetOccupation.type_sejour)
			: "nuit";
		const actualEnd = new Date();
		let recalculatedTotal = 0;

		if (!Number(targetOccupation.montant_total)) {
			const priceNuit = Number(targetOccupation.prix_nuit ?? room.prix_nuit) || 0;
			const storedPriceHeure = Number(targetOccupation.prix_heure);
			const priceHeure = Number.isFinite(storedPriceHeure)
				? storedPriceHeure
				: await getHourlyPriceForType(connexion, room.type);
			const storedPriceJournee = Number(targetOccupation.prix_journee);
			const priceJournee = Number.isFinite(storedPriceJournee)
				? storedPriceJournee
				: await getDayPriceForType(connexion, room.type);

			if (stayType === "passage") {
				const passageHours = calculateHours(dateDebut, actualEnd);
				recalculatedTotal = priceHeure > 0 && passageHours > 0
					? Number((passageHours * priceHeure).toFixed(2))
					: 0;
			} else if (stayType === "journee") {
				const journeeExtras = calculateJourneeExtras(dateDebut, actualEnd, condition.day_checkin_time, condition.day_checkout_time);
				const days = journeeExtras?.dayCount || 0;
				const baseTotal = priceJournee > 0 && days > 0
					? Number((days * priceJournee).toFixed(2))
					: 0;
				const extraHoursTotal = journeeExtras?.extraHoursTotal || 0;
				const extraTotal = priceHeure > 0 && extraHoursTotal > 0
					? Number((extraHoursTotal * priceHeure).toFixed(2))
					: 0;
				recalculatedTotal = Number((baseTotal + extraTotal).toFixed(2));
			} else {
				let alignedEnd = alignDateToTime(actualEnd, condition.checkout_time);
				const alignedStart = alignDateToTime(dateDebut, condition.checkin_time);
				if (alignedEnd && alignedStart && alignedEnd <= alignedStart) {
					alignedEnd = new Date(alignedEnd);
					alignedEnd.setDate(alignedEnd.getDate() + 1);
				}
				const computeNights = (start, end) => {
					if (!start || !end) return 0;
					const diffMs = end.getTime() - start.getTime();
					if (diffMs <= 0) return 0;
					return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
				};
				const nights = computeNights(alignedStart, alignedEnd);
				const baseTotal = priceNuit > 0 && nights > 0
					? Number((nights * priceNuit).toFixed(2))
					: 0;
				recalculatedTotal = baseTotal;
			}
		}

		const total = Number(targetOccupation.montant_total) || recalculatedTotal;
		const acompte = Number(targetOccupation.montant_acompte) || 0;
		const reste = Math.max(0, total - acompte);

		if (reste <= 0) {
			await connexion.rollback();
			return res.status(409).json({ error: "Paiement déjà complet" });
		}

		const montantAccepte = Math.min(Math.max(montantRecuInput, 0), reste);
		if (montantAccepte <= 0) {
			await connexion.rollback();
			return res.status(400).json({ error: "Montant reçu invalide" });
		}

		const nouveauAcompte = Number((acompte + montantAccepte).toFixed(2));
		const dateAcompte = montantAccepte > 0 ? new Date() : (targetOccupation.date_acompte || null);

		await connexion.execute(
			`
			UPDATE ${CHAMBRE_OCCUPATIONS_MODEL.name}
			SET montant_acompte = ?, date_acompte = ?
			WHERE id = ?
			`,
			[nouveauAcompte, dateAcompte, targetOccupation.id]
		);

		await connexion.commit();

		broadcastDataChange({
			type: "chambres-updated",
			action: "payment",
			chambreId
		});

		return res.status(200).json({
			message: "Paiement enregistré",
			montant_recu: montantAccepte
		});
	} catch (err) {
		await connexion.rollback();
		console.error("Erreur paiement occupation:", err);
		return res.status(500).json({
			error: "Erreur lors du paiement"
		});
	}
};

const getChambreHistory = async (req, res) => {
	try {
		const connexion = ensureConnexion();
		const chambreId = parsePositiveInt(req.params.id);
		if (!chambreId) {
			return res.status(400).json({ error: "Identifiant chambre invalide" });
		}
		await autoCancelExpiredReservations(connexion, chambreId);

		const [rows] = await connexion.execute(
			`
			SELECT
				o.id,
				o.chambre_id,
				o.client_id,
				o.occupant_nom,
				o.occupant_contact,
				o.occupant_cin,
				o.type_occupation,
				o.type_sejour,
				o.date_debut,
				o.date_fin_prevue,
				o.date_fin_reelle,
				o.prix_nuit,
				o.prix_heure,
				o.prix_journee,
				o.montant_total,
				o.montant_acompte,
				o.date_acompte,
				o.montant_solde,
				o.date_solde,
				o.statut,
				o.note,
				o.created_at,
				TRIM(CONCAT(COALESCE(c.nom, ''), ' ', COALESCE(c.prenom, ''))) AS client_nom,
				c.numTel AS client_num_tel,
				c.numberCNI AS client_cin
			FROM ${CHAMBRE_OCCUPATIONS_MODEL.name} o
			LEFT JOIN ${CLIENT_MODEL.name} c ON c.id = o.client_id
			WHERE o.chambre_id = ?
			ORDER BY o.id DESC
			LIMIT 200
			`,
			[chambreId]
		);

		return res.status(200).json(rows);
	} catch (err) {
		console.error("Erreur historique chambre:", err);
		return res.status(500).json({
			error: "Erreur lors de la récupération de l'historique"
		});
	}
};

const getAllChambreHistory = async (req, res) => {
	try {
		const connexion = ensureConnexion();
		await autoCancelExpiredReservations(connexion);
		const searchValue = normalizeString(req.query.q);
		const statusFilter = normalizeString(req.query.status).toLowerCase();
		const rawStartDate = normalizeString(req.query.startDate);
		const rawEndDate = normalizeString(req.query.endDate);

		const parseDateOnly = (value) => {
			if (!value) return null;
			const date = new Date(`${value}T00:00:00`);
			if (Number.isNaN(date.getTime())) return null;
			return date;
		};

		const whereClauses = [];
		const params = [];

		if (searchValue) {
			const like = `%${searchValue}%`;
			whereClauses.push(
				`
				(
					c.numero LIKE ? OR
					c.type LIKE ? OR
					COALESCE(o.occupant_nom, '') LIKE ? OR
					TRIM(CONCAT(COALESCE(cu.nom, ''), ' ', COALESCE(cu.prenom, ''))) LIKE ?
				)
				`
			);
			params.push(like, like, like, like);
		}

		if (statusFilter && statusFilter !== "tout") {
			if (!["active", "terminee", "annulee"].includes(statusFilter)) {
				return res.status(400).json({ error: "Statut invalide" });
			}
			whereClauses.push("o.statut = ?");
			params.push(statusFilter);
		}

		if (rawStartDate || rawEndDate) {
			const startDate = parseDateOnly(rawStartDate || rawEndDate);
			const endDate = parseDateOnly(rawEndDate || rawStartDate);
			if (!startDate || !endDate) {
				return res.status(400).json({ error: "Date invalide" });
			}

			const endExclusive = new Date(endDate);
			endExclusive.setDate(endExclusive.getDate() + 1);
			whereClauses.push("o.date_debut >= ? AND o.date_debut < ?");
			params.push(startDate, endExclusive);
		}

		const whereClause = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
		const [rows] = await connexion.execute(
			`
			SELECT
				o.id,
				o.chambre_id,
				c.numero,
				c.type,
				c.capacite,
				COALESCE(o.prix_nuit, c.prix_nuit) AS prix_nuit,
				o.prix_journee,
				o.client_id,
				o.occupant_nom,
				o.occupant_contact,
				o.occupant_cin,
				o.type_occupation,
				o.type_sejour,
				o.date_debut,
				o.date_fin_prevue,
				o.date_fin_reelle,
				o.montant_total,
				o.prix_heure,
				o.montant_acompte,
				o.date_acompte,
				o.montant_solde,
				o.date_solde,
				o.statut,
				o.note,
				o.created_at,
				TRIM(CONCAT(COALESCE(cu.nom, ''), ' ', COALESCE(cu.prenom, ''))) AS client_nom,
				cu.numTel AS client_num_tel,
				cu.numberCNI AS client_cin
			FROM ${CHAMBRE_OCCUPATIONS_MODEL.name} o
			INNER JOIN ${CHAMBRES_MODEL.name} c ON c.id = o.chambre_id
			LEFT JOIN ${CLIENT_MODEL.name} cu ON cu.id = o.client_id
			${whereClause}
			ORDER BY o.id DESC
			LIMIT 500
			`,
			params
		);

		return res.status(200).json(rows);
	} catch (err) {
		console.error("Erreur historique chambres:", err);
		return res.status(500).json({
			error: "Erreur lors de la récupération de l'historique"
		});
	}
};

module.exports = {
	getAllChambres,
	searchChambres,
	getChambreConditions,
	updateChambreConditions,
	setOneChambre,
	updateOneChambre,
	deleteOneChambre,
	updateChambreStatus,
	createChambreOccupation,
	releaseChambre,
	payChambreOccupation,
	getChambreHistory,
	getAllChambreHistory
};
