const RAVITAILLEMENTS_MODEL = {
	name: "ravitaillements",
	columns: `
            id INT AUTO_INCREMENT PRIMARY KEY,
			fournisseur_id INT,
			article_id INT,
			qt INT,
			achat DECIMAL(10,2),
			vente DECIMAL(10,2),
			total_achat DECIMAL(10,2),
			date_rav DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id),
			FOREIGN KEY (article_id) REFERENCES articles(id)
        `
}

module.exports = RAVITAILLEMENTS_MODEL;