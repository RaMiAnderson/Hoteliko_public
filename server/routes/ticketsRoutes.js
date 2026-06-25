const express = require("express");
const router = express.Router();
const ticketsController = require("../controller/ticketsController");

router.get("/all", ticketsController.getAllTickets);
router.get("/:id/items", ticketsController.getTicketItems);
router.post("/:id/items", ticketsController.addItemToTicket);
router.patch("/:ticketId/items/:itemId", ticketsController.updateTicketItemQty);
router.delete("/:ticketId/items/:itemId", ticketsController.deleteTicketItem);
router.get("/:id", ticketsController.getTicketById);
router.patch("/:id/pay", ticketsController.markTicketAsPaid);
router.delete("/:id", ticketsController.deleteTicket);
router.post("/create", ticketsController.createTicket);

module.exports = router;
