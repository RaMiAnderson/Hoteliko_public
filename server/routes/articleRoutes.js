const express = require("express");
const router = express.Router();
const artilceController = require("../controller/articleController")

router.post("/", artilceController.addArtilceController);

router.get("/all", artilceController.getAllArticleController);
router.get("/search", artilceController.searchArticleByDesignationController);

router.patch("/:id", artilceController.updateArticleController);

router.delete("/:id", artilceController.deleteArticleController);

module.exports = router;