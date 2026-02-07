const router = require("express").Router();
const { authRequired } = require("../middleware/auth");
const ctrl = require("../controllers/authController");

router.post("/register", ctrl.register);
router.post("/login", ctrl.login);
router.get("/me", authRequired, ctrl.me);

module.exports = router;
