import User from '../models/user.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import generateToken from '../utils/generateToken.js';

// Register
export const register = async (request, reply) => {
  try {
    const { name, email, password, phone, address, role } = request.body;

    const existing = await User.findOne({ email });
    if (existing) return reply.code(400).send({ message: 'Email already in use' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      address,
      role: role || 'user',
    });

    const token = generateToken(newUser._id);

    return reply.code(201).send({ user: newUser, token });
  } catch (err) {
    return reply.code(500).send({ message: 'Registration failed', error: err.message });
  }
};

// Login
export const login = async (request, reply) => {
  try {
    const { email, password } = request.body;

    const user = await User.findOne({ email });
    if (!user) return reply.code(400).send({ message: 'Email doesnt Exist please register this email ' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return reply.code(400).send({ message: 'Invalid email or password' });

    const token = generateToken(user._id);

    return reply.code(200).send({ user, token });
  } catch (err) {
    return reply.code(500).send({ message: 'Login failed', error: err.message });
  }
};

// Mail Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'shaikhrehan1016@gmail.com',
    pass: 'hpvm mfbe yozg wxyt', // App password
  },
});

// Forgot Password
export const forgotPassword = async (request, reply) => {
  const { email } = request.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return reply.code(404).send({ message: 'User not found' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    const resetURL = `http://localhost:3000/reset-password/${resetToken}`;

    await transporter.sendMail({
      from: 'shaikhrehan1016@gmail.com',
      to: user.email,
      subject: 'Password Reset',
      html: `<p>Click <a href="${resetURL}">here</a> to reset your password. This link will expire in 1 hour.</p>`,
    });

    return reply.code(200).send({ message: 'Password reset email sent successfully' });
  } catch (err) {
    return reply.code(500).send({ message: 'Failed to send email', error: err.message });
  }
};

// Reset Password
export const resetPassword = async (request, reply) => {
  const { token } = request.params;
  const { newPassword } = request.body;

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) return reply.code(400).send({ message: 'Invalid or expired token' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    return reply.code(200).send({ message: 'Password has been reset successfully' });
  } catch (err) {
    return reply.code(500).send({ message: 'Failed to reset password', error: err.message });
  }
};
