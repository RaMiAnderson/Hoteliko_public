const CHAMBRE_CONDITIONS_MODEL = {
	name: "chambre_conditions",
	columns: `
            id INT AUTO_INCREMENT PRIMARY KEY,
            checkin_time TIME NOT NULL DEFAULT '13:00:00',
            checkout_time TIME NOT NULL DEFAULT '09:00:00',
            day_checkin_time TIME NOT NULL DEFAULT '08:00:00',
            day_checkout_time TIME NOT NULL DEFAULT '18:00:00',
            cin_required_reservation TINYINT(1) NOT NULL DEFAULT 1,
            cin_required_occupation TINYINT(1) NOT NULL DEFAULT 1,
            deposit_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        `
};

module.exports = CHAMBRE_CONDITIONS_MODEL;
