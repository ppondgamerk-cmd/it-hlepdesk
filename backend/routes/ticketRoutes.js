const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');

router.get('/', ticketController.getAllTickets);
router.post('/', ticketController.createTicket);
router.put('/:id', ticketController.updateTicket);

module.exports = router;
