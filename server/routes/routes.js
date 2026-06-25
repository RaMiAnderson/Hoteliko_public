const express = require("express")
const authRoute = require("./authRoutes.js")
const articleRoute = require("./articleRoutes.js")
const clientRoute = require("./clientRoutes.js");
const fournisseurRoute = require("./fournisseurRoutes.js");
const chambreRoute = require("./chambreRoutes.js");
const ticketsRoutes = require("./ticketsRoutes.js");
const dashboardRoutes = require("./dashboardRoutes.js");
const realtimeRoutes = require("./realtimeRoutes.js");
const userManagementRoutes = require("./userManagementRoutes.js");


const router = express.Router()
const BASE_URL = "/api"
router.use(`${BASE_URL}/auth`,authRoute)

router.use(`${BASE_URL}/articles`, articleRoute)

router.use(`${BASE_URL}/clients`, clientRoute);
router.use(`${BASE_URL}/fournisseurs`, fournisseurRoute);
router.use(`${BASE_URL}/chambres`, chambreRoute);

router.use(`${BASE_URL}/tickets`, ticketsRoutes);

router.use(`${BASE_URL}/dashboard`, dashboardRoutes);
router.use(`${BASE_URL}/realtime`, realtimeRoutes);
router.use(`${BASE_URL}/usermanagement`, userManagementRoutes);

module.exports = router
