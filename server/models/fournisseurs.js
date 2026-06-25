const FOURNISSEURS_MODEL = {
	name: "fournisseurs",
	columns: `
            id INT AUTO_INCREMENT PRIMARY KEY,
    		nom VARCHAR(255),
    		adresse VARCHAR(255),
    		contact VARCHAR(50) UNIQUE,
    		genre VARCHAR(50),
    		total DECIMAL(10,2),
    		date_du_reste DATE,
    		total_reste DECIMAL(10,2),
    		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        `
}

module.exports = FOURNISSEURS_MODEL;