const CHAMBRE_OCCUPATIONS_MODEL = {
	name: "chambre_occupations",
	columns: `
            id INT AUTO_INCREMENT PRIMARY KEY,
			chambre_id INT,
			client_id INT,
			occupant_nom VARCHAR(255),
			occupant_contact VARCHAR(100),
			occupant_cin VARCHAR(100),
			type_occupation ENUM('reservation','occupation') NOT NULL,
			type_sejour ENUM('nuit','passage','journee') NOT NULL DEFAULT 'nuit',
			date_debut DATETIME NOT NULL,
            date_fin_prevue DATETIME,
            date_fin_reelle DATETIME,
            prix_nuit DECIMAL(10,2),
            prix_heure DECIMAL(10,2),
            prix_journee DECIMAL(10,2),
            montant_total DECIMAL(10,2),
			montant_acompte DECIMAL(10,2),
			date_acompte DATETIME,
			montant_solde DECIMAL(10,2),
			date_solde DATETIME,
			statut ENUM('active','terminee','annulee') DEFAULT 'active',
			note VARCHAR(255),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (chambre_id) REFERENCES chambres(id),
			FOREIGN KEY (client_id) REFERENCES clients(id)
        `
};

module.exports = CHAMBRE_OCCUPATIONS_MODEL;
