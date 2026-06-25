const DEPENSES_MODEL = {
	name: "depenses",
	columns: `
            id INT AUTO_INCREMENT PRIMARY KEY,
			designation VARCHAR(255),
			qt INT,
			mesure VARCHAR(50),
			prix_u DECIMAL(10,2),
			prix_total DECIMAL(10,2),
			date_depense DATETIME DEFAULT CURRENT_TIMESTAMP
        `
}

module.exports = DEPENSES_MODEL;