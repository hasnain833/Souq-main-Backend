const express = require("express");
const router = express.Router();

const personalizationController = require("../personalizationController/personalizationController");
const verifyToken = require("../../../../utils/verifyToken");

router.get("/", verifyToken, personalizationController.getPersonalization);
router.post("/save", verifyToken, personalizationController.saveOrUpdatePersonalization);
router.post("/like", verifyToken, personalizationController.addPersonalizationFromLikedProduct);

module.exports = router;
