const express = require("express");
const router = express.Router();

const fournisseurController = require("../controller/fournisseurController");

router.get("/all", fournisseurController.getAllFournisseur);
router.get("/search", fournisseurController.searchFournisseurByName);
router.post("/", fournisseurController.setOneFournisseur);
router.patch("/:id", fournisseurController.updateOneFournisseur);
router.delete("/:id", fournisseurController.deleteOneFournisseur);

module.exports = router;
