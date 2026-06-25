const express = require("express");
const router = express.Router();

const chambreController = require("../controller/chambreController");

router.get("/all", chambreController.getAllChambres);
router.get("/search", chambreController.searchChambres);
router.get("/conditions", chambreController.getChambreConditions);
router.put("/conditions", chambreController.updateChambreConditions);
router.get("/history", chambreController.getAllChambreHistory);
router.get("/:id/history", chambreController.getChambreHistory);

router.post("/", chambreController.setOneChambre);
router.post("/:id/occupations", chambreController.createChambreOccupation);

router.patch("/:id", chambreController.updateOneChambre);
router.patch("/:id/status", chambreController.updateChambreStatus);
router.patch("/:id/payment", chambreController.payChambreOccupation);
router.patch("/:id/release", chambreController.releaseChambre);

router.delete("/:id", chambreController.deleteOneChambre);

module.exports = router;
