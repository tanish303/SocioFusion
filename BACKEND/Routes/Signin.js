const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../Models/User");

const SECRET_KEY = process.env.JWT_SECRET;

router.post("/", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

const user = await User.findOne({ email: new RegExp(`^${email}$`, "i") });
    if (!user) {
      return res.status(404).json({ message: "User with this email does not exist" });
    }
if (!user.password || typeof user.password !== "string") {
      return res.status(500).json({ message: "User account is missing a password. Please reset your password or contact support." });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Password is incorrect for this email" });
    }

        const token = jwt.sign(
          { userId: user._id },
          process.env.JWT_SECRET,
            { expiresIn: "7d" } 

        );

    res.status(200).json({ jwtToken: token, username: user.username });
  } catch (error) {
    console.error("Error during sign-in:", error);
    res.status(500).json({ message: "An error occurred. Please try again later." });
  }
});

module.exports = router;
