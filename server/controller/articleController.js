const { getConnection } = require("../database/databaseConnector");
const ARTICLE_MODEL = require("../models/articles");
const { broadcastDataChange } = require("../services/realtimeEvents");

const addArtilceController = async (req, res) => {
	try {
		const connexion = getConnection();
		if (!connexion)
			throw new Error("La connexion MySQL n'est pas initialisée !");

		const sql = `
			INSERT INTO ${ARTICLE_MODEL.name} (designation, type, qt, mesure, achat, vente, seuil)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`;
		const values = [
			req.body.designation,
			req.body.type,
			req.body.qt,
			req.body.mesure,
			req.body.achat,
			req.body.vente,
			req.body.seuil
		]

		const [result] = await connexion.execute(sql, values);
		broadcastDataChange({
			type: "articles-updated",
			action: "add"
		});
		res.json(result);
	} catch (err)
	{
		console.log("Error : " + err)
		res.status(500);
	}
}

const getAllArticleController = async (req, res) => {
	try {
		const connexion = getConnection();
		if (!connexion)
			throw new Error("La connexion MySQL n'est pas initialisée !");

		const sql = `SELECT * FROM ${ARTICLE_MODEL.name}`;
		const [rows] = await connexion.execute(sql);

		res.status(200).json(rows);

	} catch (err) {
		console.error("Error : ", err);
		res.status(500).json({
			error: "Erreur lors de la récupération des articles"
		});
	}
}

const updateArticleController = async (req, res) => {
    try {
        const connexion = getConnection();
        if (!connexion) throw new Error("La connexion MySQL n'est pas initialisée !");

        const { id } = req.params;
        const fields = req.body;

    
        const updates = [];
        const values = [];

        for (const key in fields) {
          
            if (["designation", "type", "qt", "mesure", "achat", "vente", "seuil"].includes(key)) {
                updates.push(`${key} = ?`);
                values.push(fields[key]);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: "Aucun champ valide à mettre à jour" });
        }

        values.push(id);

        const sql = `UPDATE ${ARTICLE_MODEL.name} SET ${updates.join(", ")} WHERE id = ?`;
        const [result] = await connexion.execute(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Article non trouvé" });
        }

        broadcastDataChange({
            type: "articles-updated",
            action: "update",
            articleId: Number(id)
        });

        res.status(200).json({ message: "Article modifié avec succès" });
    } catch (err) {
        console.error("Error : ", err);
        res.status(500).json({ error: "Erreur lors de la modification de l'article" });
    }
};

const deleteArticleController = async (req, res) => {
    try {
        const connexion = getConnection();
        if (!connexion) throw new Error("La connexion MySQL n'est pas initialisée !");

        const { id } = req.params;

        const sql = `DELETE FROM ${ARTICLE_MODEL.name} WHERE id = ?`;
        const [result] = await connexion.execute(sql, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Article non trouvé" });
        }

        broadcastDataChange({
            type: "articles-updated",
            action: "delete",
            articleId: Number(id)
        });

        res.status(200).json({ message: "Article supprimé avec succès" });
    } catch (err) {
        console.error("Error : ", err);
        res.status(500).json({ error: "Erreur lors de la suppression de l'article" });
    }
};

const searchArticleByDesignationController = async (req, res) => {
  try {
    const { designation } = req.query;

    if (!designation) {
      return res.status(400).json({
        error: "Le paramètre 'designation' est requis"
      });
    }

    const connexion = getConnection();
    if (!connexion)
      throw new Error("La connexion MySQL n'est pas initialisée");

    const sql = `
      SELECT * 
      FROM ${ARTICLE_MODEL.name}
      WHERE designation LIKE ?
    `;

    const [rows] = await connexion.execute(sql, [`%${designation}%`]);

    res.status(200).json(rows);

  } catch (err) {
    console.error("Error :", err);
    res.status(500).json({
      error: "Erreur lors de la recherche d'article"
    });
  }
};



module.exports = {
	addArtilceController,
	getAllArticleController,
	updateArticleController,
	deleteArticleController,
	searchArticleByDesignationController
}
