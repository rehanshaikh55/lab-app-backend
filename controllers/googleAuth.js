const { OAuth2Client } = require('google-auth-library');
const User = require('../models/user'); // your User model
const generateToken = require('../utils/generateToken');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { email, name, picture } = ticket.getPayload();

    let user = await User.findOne({ email });

    if (!user) {
      // Register user
      user = await User.create({ email, name, picture });
    }

    const authToken = generateToken(user._id);

    res.status(200).json({ user, token: authToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Google login failed', error: err.message });
  }
};
