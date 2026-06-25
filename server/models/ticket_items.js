const TICKET_ITEMS_MODEL = {
	name: "ticket_items",
	columns: `
            id INT AUTO_INCREMENT PRIMARY KEY,
			ticket_id INT,
			article_id INT,
			designation VARCHAR(255),
			qt INT,
			prix_u DECIMAL(10,2),
			prix_total DECIMAL(10,2),
			FOREIGN KEY (ticket_id) REFERENCES tickets(id),
			FOREIGN KEY (article_id) REFERENCES articles(id)
        `
} 

module.exports = TICKET_ITEMS_MODEL;