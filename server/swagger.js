const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const path = require("path");
const createSwaggerDefinition = require("./swaggerDefinition");

let port = process.env.SERVER_PORT || 8050;

const swaggerOptions = {
  definition: createSwaggerDefinition(port),
  apis: [path.join(__dirname, "routes", "*.js")],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = { swaggerUi, swaggerDocs };