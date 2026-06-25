const ARTICLES_MODEL = {
	name: "articles",
	columns: `
            id INT AUTO_INCREMENT PRIMARY KEY,
    		designation VARCHAR(255) UNIQUE,
    		type VARCHAR(100),
    		qt INT,
    		mesure VARCHAR(50),
    		achat DECIMAL(10,2),
    		vente DECIMAL(10,2),
    		seuil INT,
    		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        `
}  

module.exports = ARTICLES_MODEL;