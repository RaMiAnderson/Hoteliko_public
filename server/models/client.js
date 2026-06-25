const CLIENT_MODEL = {
	name : "clients",
	columns: `
            id INT AUTO_INCREMENT PRIMARY KEY,
    		nom VARCHAR(255) UNIQUE,
    		prenom VARCHAR(255),
    		genre VARCHAR(50),
    		numClient VARCHAR(50) UNIQUE,
    		numberCNI VARCHAR(50) UNIQUE,
    		dateCNI DATE,
    		lieuCNI VARCHAR(100),
    		numTel VARCHAR(50),
    		adresse VARCHAR(255),
    		total_achat DECIMAL(10,2),
    		total_reste DECIMAL(10,2),
    		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        `
}

module.exports = CLIENT_MODEL;