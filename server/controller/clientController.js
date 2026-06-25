const { getConnection } = require("../database/databaseConnector");
const CLIENT_MODEL = require("../models/client")
const { broadcastDataChange } = require("../services/realtimeEvents");

const getAllClient = async (req, res) => {
	try {
		const connexion = getConnection();
		if (!connexion)
			throw new Error("La connexion MySQL n'est pas initialisée");

		const sql = `SELECT * FROM ${CLIENT_MODEL.name}`;
		const [rows] = await connexion.execute(sql);

		res.status(200).json(rows);

	} catch (err) {
		console.error("Error :", err);
		res.status(500).json({
			error: "Erreur lors de la récupération des clients"
		});
	}
}

const setOneClient = async (req, res) => {
	try {
		const connexion = getConnection();
		if (!connexion)
			throw new Error("La connexion MySQL n'est pas initialisée");

		const nom = String(req.body.nom ?? "").trim();
		const prenom = String(req.body.prenom ?? "").trim() || "-";
		const genre = req.body.genre ? String(req.body.genre).trim() : null;
		const numClient = String(req.body.numClient ?? "").trim() || `cl-${Date.now()}`;
		const numberCNI = req.body.numberCNI ? String(req.body.numberCNI).trim() : null;
		const dateCNI = req.body.dateCNI || null;
		const lieuCNI = req.body.lieuCNI ? String(req.body.lieuCNI).trim() : null;
		const numTel = String(req.body.numTel ?? req.body.contact ?? "").trim();
		const adresse = String(req.body.adresse ?? "").trim();

		if (!nom || !adresse || !numTel) {
			return res.status(400).json({
				error: "nom, adresse et numTel sont obligatoires"
			});
		}

		const sql = `
      INSERT INTO ${CLIENT_MODEL.name}
      (nom, prenom, genre, numClient, numberCNI, dateCNI, lieuCNI, numTel, adresse, total_achat, total_reste)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

		const values = [
			nom,
			prenom,
			genre,
			numClient,
			numberCNI,
			dateCNI,
			lieuCNI,
			numTel,
			adresse,
			0, 
			0 
		];

		const [result] = await connexion.execute(sql, values);

		broadcastDataChange({
			type: "clients-updated",
			action: "add",
			clientId: Number(result.insertId)
		});

		res.status(201).json({
			message: "Client créé avec succès",
			id: result.insertId
		});
	} catch (err) {
		console.log("Erreur insert Client : " + err);

		if (err.code === "ER_DUP_ENTRY") {
			return res.status(409).json({
				error: "Un champ unique existe déjà (nom, numClient ou numberCNI)"
			});
		}

		res.status(500).json({
			error: "Erreur lors de la création du client"
		});
	}
}

const searchClientByName = async (req, res) => {
	try {
		const connexion = getConnection();
		if (!connexion)
			throw new Error("La connexion MySQL n'est pas initialisée");

		const nom = String(req.query.nom ?? "").trim();
		if (!nom) {
			return res.status(400).json({ error: "Le paramètre 'nom' est requis" });
		}

		const sql = `SELECT * FROM ${CLIENT_MODEL.name} WHERE nom LIKE ? OR CONCAT(nom, ' ', prenom) LIKE ?`;
		const searchValue = `%${nom}%`;
		const [rows] = await connexion.execute(sql, [searchValue, searchValue]);

		res.status(200).json(rows);

	} catch (err) {
		console.error("Erreur recherche client :", err);
		res.status(500).json({ error: "Erreur lors de la recherche du client" });
	}
}

const updateOneClient = async (req, res) => {
	try {
		const connexion = getConnection();
		if (!connexion)
			throw new Error("La connexion MySQL n'est pas initialisée");

		const id = Number(req.params.id);
		if (!Number.isFinite(id) || id <= 0) {
			return res.status(400).json({ error: "Identifiant client invalide" });
		}

		const nom = String(req.body.nom ?? "").trim();
		const adresse = String(req.body.adresse ?? "").trim();
		const numTel = String(req.body.numTel ?? req.body.contact ?? "").trim();

		if (!nom || !adresse || !numTel) {
			return res.status(400).json({
				error: "nom, adresse et numTel sont obligatoires"
			});
		}

		const sql = `
			UPDATE ${CLIENT_MODEL.name}
			SET nom = ?, adresse = ?, numTel = ?
			WHERE id = ?
		`;
		const [result] = await connexion.execute(sql, [nom, adresse, numTel, id]);

		if (result.affectedRows === 0) {
			return res.status(404).json({ error: "Client non trouvé" });
		}

		broadcastDataChange({
			type: "clients-updated",
			action: "update",
			clientId: id
		});

		res.status(200).json({ message: "Client modifié avec succès" });
	} catch (err) {
		console.error("Erreur modification client :", err);

		if (err.code === "ER_DUP_ENTRY") {
			return res.status(409).json({
				error: "Un champ unique existe déjà (nom, numClient ou numberCNI)"
			});
		}

		res.status(500).json({ error: "Erreur lors de la modification du client" });
	}
}

const deleteOneClient = async (req, res) => {
	try {
		const connexion = getConnection();
		if (!connexion)
			throw new Error("La connexion MySQL n'est pas initialisée");

		const id = Number(req.params.id);
		if (!Number.isFinite(id) || id <= 0) {
			return res.status(400).json({ error: "Identifiant client invalide" });
		}

		const sql = `DELETE FROM ${CLIENT_MODEL.name} WHERE id = ?`;
		const [result] = await connexion.execute(sql, [id]);

		if (result.affectedRows === 0) {
			return res.status(404).json({ error: "Client non trouvé" });
		}

		broadcastDataChange({
			type: "clients-updated",
			action: "delete",
			clientId: id
		});

		res.status(200).json({ message: "Client supprimé avec succès" });
	} catch (err) {
		console.error("Erreur suppression client :", err);

		if (["ER_ROW_IS_REFERENCED_2", "ER_ROW_IS_REFERENCED"].includes(err.code)) {
			return res.status(409).json({
				error: "Suppression impossible : ce client est lié à d'autres données"
			});
		}

		res.status(500).json({ error: "Erreur lors de la suppression du client" });
	}
}


module.exports = {
	getAllClient,
	setOneClient,
	searchClientByName,
	updateOneClient,
	deleteOneClient
}
