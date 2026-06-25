const express = require('express');
const app = express();
require('dotenv').config();

let port = process.env.SERVER_PORT || 8050;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const cors = require("cors");
app.use(cors({
	origin: [process.env.CLIENT_API],
	methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
	Credential: true
}));

const routes = require("./routes/routes");
const { errorMiddleware } = require('./middlewares/errorHandler');
app.use(routes);
app.use(errorMiddleware)

const { initDataBase } = require("./database/databaseConnector");

initDataBase().then(() => {
	console.log("DB initialized");
});

const { swaggerUi, swaggerDocs } = require("./swagger");
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));


app.listen(port, () => {
	console.log("Server in http://localhost:" + port);
});