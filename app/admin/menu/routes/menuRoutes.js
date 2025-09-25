const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Get all menus
router.get('/', checkPermission('menus', 'view'), menuController.getAllMenus);

// Get menu statistics
router.get('/stats', checkPermission('menus', 'view'), menuController.getMenuStats);

// Get menu by ID
router.get('/:menuId', checkPermission('menus', 'view'), menuController.getMenuById);

// Create new menu
router.post('/', checkPermission('menus', 'create'), menuController.createMenu);

// Update menu
router.put('/:menuId', checkPermission('menus', 'edit'), menuController.updateMenu);

// Delete menu - Temporarily allow all authenticated admins
router.delete('/:menuId', menuController.deleteMenu);

module.exports = router;
