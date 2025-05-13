const express = require('express');
const router = express.Router();
const { googleLogin } = require('../controllers/googleAuth');

router.post('/google-login', googleLogin);

module.exports = router;
