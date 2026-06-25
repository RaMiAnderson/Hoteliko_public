const express = require("express");
const router = express.Router();

const clientController = require("../controller/clientController")

router.get("/all", clientController.getAllClient)
router.get("/search", clientController.searchClientByName)

router.post("/", clientController.setOneClient)
router.patch("/:id", clientController.updateOneClient)
router.delete("/:id", clientController.deleteOneClient)

module.exports = router;
