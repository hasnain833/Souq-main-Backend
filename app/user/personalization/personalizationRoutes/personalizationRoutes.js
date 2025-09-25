const express = require("express");
const router = express.Router();

const personalizationController = require("../personalizationController/personalizationController");
const optionalAuth = require("../../../../utils/optionalAuth");

router.get("/", optionalAuth, personalizationController.getPersonalization);
router.post("/save", optionalAuth, personalizationController.saveOrUpdatePersonalization);
router.post("/like", optionalAuth, personalizationController.addPersonalizationFromLikedProduct);

module.exports = router;
