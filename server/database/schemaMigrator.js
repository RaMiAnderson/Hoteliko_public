const MAX_IDENTIFIER_LENGTH = 64;

const CONSTRAINT_PREFIXES = [
	"PRIMARY KEY",
	"FOREIGN KEY",
	"CONSTRAINT",
	"UNIQUE KEY",
	"UNIQUE INDEX",
	"KEY",
	"INDEX",
	"FULLTEXT",
	"SPATIAL",
	"CHECK",
	"UNIQUE ("
];

function escapeIdentifier(identifier) {
	return `\`${String(identifier).replace(/`/g, "``")}\``;
}

function normalizeSpaces(value) {
	return String(value ?? "").replace(/\s+/g, " ").trim();
}

function splitSqlDefinitions(sqlBlock) {
	const input = String(sqlBlock ?? "");
	const parts = [];
	let current = "";
	let depth = 0;
	let inSingle = false;
	let inDouble = false;
	let inBacktick = false;

	for (let index = 0; index < input.length; index += 1) {
		const char = input[index];
		const previous = input[index - 1];

		if (char === "'" && !inDouble && !inBacktick && previous !== "\\") {
			inSingle = !inSingle;
		} else if (char === '"' && !inSingle && !inBacktick && previous !== "\\") {
			inDouble = !inDouble;
		} else if (char === "`" && !inSingle && !inDouble) {
			inBacktick = !inBacktick;
		}

		if (!inSingle && !inDouble && !inBacktick) {
			if (char === "(") depth += 1;
			if (char === ")" && depth > 0) depth -= 1;

			if (char === "," && depth === 0) {
				const trimmed = normalizeSpaces(current);
				if (trimmed) parts.push(trimmed);
				current = "";
				continue;
			}
		}

		current += char;
	}

	const tail = normalizeSpaces(current);
	if (tail) parts.push(tail);

	return parts;
}

function isConstraintDefinition(definition) {
	const upper = normalizeSpaces(definition).toUpperCase();
	return CONSTRAINT_PREFIXES.some((prefix) => upper.startsWith(prefix));
}

function extractColumnName(definition) {
	const trimmed = normalizeSpaces(definition);
	const match = trimmed.match(/^`?([a-zA-Z0-9_]+)`?\s+/);
	if (!match) return null;

	const candidate = String(match[1] ?? "").trim();
	if (!candidate) return null;

	const upperCandidate = candidate.toUpperCase();
	if (["PRIMARY", "FOREIGN", "CONSTRAINT", "KEY", "UNIQUE", "INDEX", "CHECK"].includes(upperCandidate)) {
		return null;
	}

	return candidate;
}

function hasInlineUniqueConstraint(definition) {
	const normalized = normalizeSpaces(definition).toUpperCase();
	return /\bUNIQUE\b/.test(normalized);
}

function buildUniqueIndexName(tableName, columnName) {
	const raw = `uniq_${tableName}_${columnName}`;
	if (raw.length <= MAX_IDENTIFIER_LENGTH) return raw;
	return raw.slice(0, MAX_IDENTIFIER_LENGTH);
}

async function resolveDatabaseName(connection, fallbackName = "") {
	if (fallbackName) return fallbackName;
	const [rows] = await connection.query("SELECT DATABASE() AS dbName");
	return rows?.[0]?.dbName || "";
}

async function fetchExistingColumns(connection, tableName) {
	const [rows] = await connection.query(`SHOW COLUMNS FROM ${escapeIdentifier(tableName)}`);
	return new Set(
		(rows || []).map((row) => String(row?.Field ?? "").trim()).filter(Boolean)
	);
}

async function hasUniqueIndexForColumn(connection, dbName, tableName, columnName) {
	const [rows] = await connection.execute(
		`
		SELECT NON_UNIQUE
		FROM information_schema.STATISTICS
		WHERE TABLE_SCHEMA = ?
		  AND TABLE_NAME = ?
		  AND COLUMN_NAME = ?
		`,
		[dbName, tableName, columnName]
	);

	return Array.isArray(rows) && rows.some((row) => Number(row.NON_UNIQUE) === 0);
}

async function addMissingColumn(connection, tableName, definition) {
	await connection.query(
		`ALTER TABLE ${escapeIdentifier(tableName)} ADD COLUMN ${definition}`
	);
}

async function addMissingUniqueIndex(connection, tableName, columnName) {
	const indexName = buildUniqueIndexName(tableName, columnName);
	await connection.query(
		`ALTER TABLE ${escapeIdentifier(tableName)} ADD UNIQUE ${escapeIdentifier(indexName)} (${escapeIdentifier(columnName)})`
	);
}

function parseModelColumns(columnsSql) {
	const definitions = splitSqlDefinitions(columnsSql);
	const columns = [];

	for (const definition of definitions) {
		if (isConstraintDefinition(definition)) continue;

		const columnName = extractColumnName(definition);
		if (!columnName) continue;

		columns.push({
			name: columnName,
			definition
		});
	}

	return columns;
}

async function applySafeSchemaMigrations(connection, models, options = {}) {
	const dbName = await resolveDatabaseName(connection, options.databaseName);

	for (const model of models) {
		const tableName = String(model?.name ?? "").trim();
		const columnsSql = String(model?.columns ?? "");
		if (!tableName || !columnsSql) continue;

		const expectedColumns = parseModelColumns(columnsSql);
		if (expectedColumns.length === 0) continue;

		let existingColumns = new Set();
		try {
			existingColumns = await fetchExistingColumns(connection, tableName);
		} catch (error) {
			console.warn(`[SchemaSync] Impossible de lire la table ${tableName}:`, error.message);
			continue;
		}

		for (const expected of expectedColumns) {
			if (existingColumns.has(expected.name)) continue;

			try {
				await addMissingColumn(connection, tableName, expected.definition);
				existingColumns.add(expected.name);
				console.log(`[SchemaSync] Colonne ajoutée: ${tableName}.${expected.name}`);
			} catch (error) {
				console.warn(`[SchemaSync] Echec ajout colonne ${tableName}.${expected.name}:`, error.message);
			}
		}

		for (const expected of expectedColumns) {
			if (!hasInlineUniqueConstraint(expected.definition)) continue;
			if (!existingColumns.has(expected.name)) continue;

			try {
				const hasUnique = await hasUniqueIndexForColumn(connection, dbName, tableName, expected.name);
				if (hasUnique) continue;

				await addMissingUniqueIndex(connection, tableName, expected.name);
				console.log(`[SchemaSync] Index UNIQUE ajouté: ${tableName}.${expected.name}`);
			} catch (error) {
				console.warn(`[SchemaSync] Echec ajout index UNIQUE ${tableName}.${expected.name}:`, error.message);
			}
		}
	}
}

module.exports = {
	applySafeSchemaMigrations
};

