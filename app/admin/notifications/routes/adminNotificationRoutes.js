const express = require("express");
const router = express.Router();
const {
  verifyAdminToken,
  checkPermission,
} = require("../../auth/middleware/adminAuthMiddleware");
const adminNotificationController = require("../controllers/adminNotificationController");

router.use(verifyAdminToken);
router.get(
  "/",
  checkPermission("notifications", "read"),
  adminNotificationController.getAllNotifications
);

router.get(
  "/stats",
  checkPermission("notifications", "read"),
  adminNotificationController.getNotificationStats
);

router.get(
  "/analytics",
  checkPermission("notifications", "read"),
  adminNotificationController.getNotificationAnalytics
);

router.get(
  "/type/:type",
  checkPermission("notifications", "read"),
  adminNotificationController.getNotificationsByType
);

router.post(
  "/bulk-send",
  checkPermission("notifications", "create"),
  adminNotificationController.sendBulkNotification
);

router.get(
  "/:notificationId",
  checkPermission("notifications", "read"),
  adminNotificationController.getNotificationById
);

router.delete(
  "/:notificationId",
  checkPermission("notifications", "delete"),
  adminNotificationController.deleteNotification
);

router.patch(
  "/:notificationId/read",
  checkPermission("notifications", "update"),
  adminNotificationController.markNotificationAsRead
);

router.get(
  "/user/:userId",
  checkPermission("notifications", "read"),
  adminNotificationController.getUserNotifications
);
router.get(
  "/user/:userId/settings",
  checkPermission("notifications", "read"),
  adminNotificationController.getUserNotificationSettings
);

router.put(
  "/user/:userId/settings",
  checkPermission("notifications", "update"),
  adminNotificationController.updateUserNotificationSettings
);

router.post(
  "/user/:userId/send",
  checkPermission("notifications", "create"),
  adminNotificationController.sendNotificationToUser
);

module.exports = router;
