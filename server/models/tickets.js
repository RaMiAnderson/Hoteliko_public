const TICKETS_MODEL = {
	name: "tickets",
	columns: `
            id INT AUTO_INCREMENT PRIMARY KEY,
			client_id INT,
			table_num VARCHAR(50),
			servi_par VARCHAR(50),
			date_ticket DATETIME,
			total_ticket DECIMAL(10,2),
			montant_paye DECIMAL(10,2),
			reste DECIMAL(10,2),
			type_paiement ENUM('comptant','attente','credit'),
			mode_paiement ENUM('espece','mobile_money','autre'),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (client_id) REFERENCES clients(id)
        `
}

module.exports = TICKETS_MODEL;