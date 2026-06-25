const CHAMBRE_TYPE_TARIFS_MODEL = {
	name: "chambre_type_tarifs",
	columns: `
            id INT AUTO_INCREMENT PRIMARY KEY,
            type VARCHAR(100) NOT NULL UNIQUE,
            prix_heure DECIMAL(10,2) NOT NULL DEFAULT 0,
            prix_journee DECIMAL(10,2) NOT NULL DEFAULT 0,
            prix_nuit DECIMAL(10,2) NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        `
};

module.exports = CHAMBRE_TYPE_TARIFS_MODEL;
