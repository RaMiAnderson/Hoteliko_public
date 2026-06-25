const { getConnection } = require("../database/databaseConnector");
const FOURNISSEUR_MODEL = require("../models/fournisseurs");
const { broadcastDataChange } = require("../services/realtimeEvents");

const getAllFournisseur = async (req, res) => {
	try {
		const connexion = getConnection();
		if (!connexion) {
			throw new Error("La connexion MySQL n'est pas initialisée");
		}

		const sql = `SELECT * FROM ${FOURNISSEUR_MODEL.name} ORDER BY id DESC`;
		const [rows] = await connexion.execute(sql);

		res.status(200).json(rows);
	} catch (err) {
		console.error("Erreur récupération fournisseurs:", err);
		res.status(500).json({
			error: "Erreur lors de la récupération des fournisseurs"
		});
	}
};

const searchFournisseurByName = async (req, res) => {
	try {
		const connexion = getConnection();
		if (!connexion) {
			throw new Error("La connexion MySQL n'est pas initialisée");
		}

		const rawName = String(req.query.nom ?? "").trim();
		if (!rawName) {
			return res.status(400).json({
				error: "Le paramètre 'nom' est requis"
			});
		}

		const sql = `
			SELECT * FROM ${FOURNISSEUR_MODEL.name}
			WHERE nom LIKE ?
			ORDER BY id DESC
		`;
		const [rows] = await connexion.execute(sql, [`%${rawName}%`]);

		res.status(200).json(rows);
	} catch (err) {
		console.error("Erreur recherche fournisseur:", err);
		res.status(500).json({
			error: "Erreur lors de la recherche du fournisseur"
		});
	}
};

const setOneFournisseur = async (req, res) => {
	try {
		const connexion = getConnection();
		if (!connexion) {
			throw new Error("La connexion MySQL n'est pas initialisée");
		}

		const nom = String(req.body.nom ?? "").trim();
		const adresse = String(req.body.adresse ?? "").trim();
		const contact = String(req.body.contact ?? "").trim();

		if (!nom || !adresse || !contact) {
			return res.status(400).json({
				error: "nom, adresse et contact sont obligatoires"
			});
		}

		const sql = `
			INSERT INTO ${FOURNISSEUR_MODEL.name}
			(nom, adresse, contact, genre, total, date_du_reste, total_reste)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`;
		const values = [
			nom,
			adresse,
			contact,
			null,
			0,
			null,
			0
		];

		const [result] = await connexion.execute(sql, values);

		broadcastDataChange({
			type: "fournisseurs-updated",
			action: "add",
			fournisseurId: Number(result.insertId)
		});

		res.status(201).json({
			message: "Fournisseur créé avec succès",
			id: result.insertId
		});
	} catch (err) {
		console.error("Erreur création fournisseur:", err);

		if (err.code === "ER_DUP_ENTRY") {
			return res.status(409).json({
				error: "Ce contact est déjà utilisé"
			});
		}

		res.status(500).json({
			error: "Erreur lors de la création du fournisseur"
		});
	}
};

const updateOneFournisseur = async (req, res) => {
	try {
		const connexion = getConnection();
		if (!connexion) {
			throw new Error("La connexion MySQL n'est pas initialisée");
		}

		const id = Number(req.params.id);
		if (!Number.isFinite(id) || id <= 0) {
			return res.status(400).json({
				error: "Identifiant fournisseur invalide"
			});
		}

		const nom = String(req.body.nom ?? "").trim();
		const adresse = String(req.body.adresse ?? "").trim();
		const contact = String(req.body.contact ?? "").trim();

		if (!nom || !adresse || !contact) {
			return res.status(400).json({
				error: "nom, adresse et contact sont obligatoires"
			});
		}

		const sql = `
			UPDATE ${FOURNISSEUR_MODEL.name}
			SET nom = ?, adresse = ?, contact = ?
			WHERE id = ?
		`;
		const [result] = await connexion.execute(sql, [nom, adresse, contact, id]);

		if (result.affectedRows === 0) {
			return res.status(404).json({
				error: "Fournisseur non trouvé"
			});
		}

		broadcastDataChange({
			type: "fournisseurs-updated",
			action: "update",
			fournisseurId: id
		});

		res.status(200).json({
			message: "Fournisseur modifié avec succès"
		});
	} catch (err) {
		console.error("Erreur modification fournisseur:", err);

		if (err.code === "ER_DUP_ENTRY") {
			return res.status(409).json({
				error: "Ce contact est déjà utilisé"
			});
		}

		res.status(500).json({
			error: "Erreur lors de la modification du fournisseur"
		});
	}
};

const deleteOneFournisseur = async (req, res) => {
	try {
		const connexion = getConnection();
		if (!connexion) {
			throw new Error("La connexion MySQL n'est pas initialisée");
		}

		const id = Number(req.params.id);
		if (!Number.isFinite(id) || id <= 0) {
			return res.status(400).json({
				error: "Identifiant fournisseur invalide"
			});
		}

		const sql = `DELETE FROM ${FOURNISSEUR_MODEL.name} WHERE id = ?`;
		const [result] = await connexion.execute(sql, [id]);

		if (result.affectedRows === 0) {
			return res.status(404).json({
				error: "Fournisseur non trouvé"
			});
		}

		broadcastDataChange({
			type: "fournisseurs-updated",
			action: "delete",
			fournisseurId: id
		});

		res.status(200).json({
			message: "Fournisseur supprimé avec succès"
		});
	} catch (err) {
		console.error("Erreur suppression fournisseur:", err);

		if (["ER_ROW_IS_REFERENCED_2", "ER_ROW_IS_REFERENCED"].includes(err.code)) {
			return res.status(409).json({
				error: "Suppression impossible : ce fournisseur est lié à d'autres données"
			});
		}

		res.status(500).json({
			error: "Erreur lors de la suppression du fournisseur"
		});
	}
};

module.exports = {
	getAllFournisseur,
	searchFournisseurByName,
	setOneFournisseur,
	updateOneFournisseur,
	deleteOneFournisseur
};
