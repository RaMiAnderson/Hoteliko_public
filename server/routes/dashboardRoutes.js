const express = require("express");
const router = express.Router();

const dashboardController = require("../controller/dashboardController");

router.get("/overview", dashboardController.getDashboardOverview);

module.exports = router;
