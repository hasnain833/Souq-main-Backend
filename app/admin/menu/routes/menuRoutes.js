const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

router.get('/', checkPermission('menus', 'view'), menuController.getAllMenus);
router.get('/stats', checkPermission('menus', 'view'), menuController.getMenuStats);
router.get('/:menuId', checkPermission('menus', 'view'), menuController.getMenuById);
router.post('/', checkPermission('menus', 'create'), menuController.createMenu);
router.put('/:menuId', checkPermission('menus', 'edit'), menuController.updateMenu);
router.delete('/:menuId', menuController.deleteMenu);

module.exports = router;
