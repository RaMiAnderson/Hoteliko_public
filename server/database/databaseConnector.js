

const mysql = require('mysql2/promise');
require('dotenv').config();

const USER_MODEL = require('../models/user');
const ADMIN_MODEL = require('../models/admin');
const CLIENT_MODEL = require('../models/client');
const ARTICLES_MODEL = require('../models/articles');
const FOURNISSEURS_MODEL = require('../models/fournisseurs');
const RAVITAILLEMENTS_MODEL = require('../models/ravitaillements');
const TICKETS_MODEL = require('../models/tickets');
const TICKET_ITEMS_MODEL = require('../models/ticket_items');
const DEPENSES_MODEL = require('../models/depenses');
const CHAMBRES_MODEL = require('../models/chambres');
const CHAMBRE_OCCUPATIONS_MODEL = require('../models/chambre_occupations');
const CHAMBRE_CONDITIONS_MODEL = require('../models/chambre_conditions');
const CHAMBRE_TYPE_TARIFS_MODEL = require('../models/chambre_type_tarifs');
const { applySafeSchemaMigrations } = require('./schemaMigrator');

const MODELS = [
	ADMIN_MODEL,
	USER_MODEL,
	CLIENT_MODEL,
	ARTICLES_MODEL,
	FOURNISSEURS_MODEL,
	RAVITAILLEMENTS_MODEL,
	TICKETS_MODEL,
	TICKET_ITEMS_MODEL,
	DEPENSES_MODEL,
	CHAMBRES_MODEL,
	CHAMBRE_OCCUPATIONS_MODEL,
	CHAMBRE_CONDITIONS_MODEL,
	CHAMBRE_TYPE_TARIFS_MODEL
];

let connection = null;

async function initDataBase() {
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME
        });
        console.log("Connected to MySQL!");

		for (const model of MODELS) {
			await connection.execute(`
				CREATE TABLE IF NOT EXISTS ${model.name} (
					${model.columns}
				)
			`);
		}

		const shouldAutoMigrate = String(process.env.DB_AUTO_MIGRATE ?? "true").toLowerCase() !== "false";
		if (shouldAutoMigrate) {
			await applySafeSchemaMigrations(connection, MODELS, {
				databaseName: process.env.DB_NAME
			});
		}

		try {
			await connection.execute(
				`ALTER TABLE ${CHAMBRE_OCCUPATIONS_MODEL.name} MODIFY COLUMN type_sejour ENUM('nuit','passage','journee') NOT NULL DEFAULT 'nuit'`
			);
		} catch (error) {
			console.warn("[SchemaSync] Echec mise à jour enum type_sejour:", error.message);
		}

    } catch (error) {
        console.error("MySQL connection error:", error);
    }
}

function getConnection() {
    return connection;
}

module.exports = { initDataBase, getConnection };
