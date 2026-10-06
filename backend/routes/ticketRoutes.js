const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { authenticate, allow } = require('../middleware/auth');
router.use(authenticate);

router.get('/', ticketController.getAllTickets);
router.post('/', ticketController.createTicket);
router.put('/:id', allow('staff', 'admin'), ticketController.updateTicket);

module.exports = router;
