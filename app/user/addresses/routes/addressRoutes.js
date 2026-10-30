const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const verifyToken = require('../../../../utils/verifyToken');

// All address routes require authentication
router.use(verifyToken);

// Address management routes
router.post('/add', addressController.addAddress);
router.get('/', addressController.getUserAddresses);
router.get('/default', addressController.getDefaultAddress);
router.put('/:addressId/set-default', addressController.setDefaultAddress);
router.put('/:addressId', addressController.updateAddress);
router.delete('/:addressId', addressController.deleteAddress);

module.exports = router;
