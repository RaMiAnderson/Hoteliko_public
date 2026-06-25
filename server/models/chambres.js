const CHAMBRES_MODEL = {
	name: "chambres",
	columns: `
            id INT AUTO_INCREMENT PRIMARY KEY,
			numero VARCHAR(50) UNIQUE,
			type VARCHAR(100),
			capacite INT DEFAULT 1,
			prix_nuit DECIMAL(10,2) DEFAULT 0,
			statut ENUM('libre','reservee','occupee','maintenance') DEFAULT 'libre',
			description VARCHAR(255),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        `
};

module.exports = CHAMBRES_MODEL;
