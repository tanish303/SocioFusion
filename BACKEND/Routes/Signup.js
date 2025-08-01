const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const User = require("../Models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");



const upload = require("../config/multerConfig"); // ✅ Import cloudinary multer config



// For sending otp 

router.post("/sendotp", async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email address" });
    }

    // Check if the email already exists and has completed signup
    const existingUser = await User.findOne({ email });

    if (existingUser && existingUser.password) {
      return res
        .status(409)
        .json({ message: "Email already registered. Please log in." });
    }

    // Generate a 6-digit OTP
    const otp = crypto.randomInt(100000, 999999);

    // Generate a random temporary username (only if new user is created)
    const tempUsername = `tempuser_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // Upsert user: insert if new, or update OTP if already exists
    await User.updateOne(
      { email },
      {
        $set: {
          otp,
          otpExpiresAt: Date.now() + 10 * 60 * 1000, // OTP expires in 10 mins
        },
        $setOnInsert: {
          username: tempUsername, // ✅ unique placeholder username
          password: "",           // placeholder password
          socialProfile: {
            name: "placeholder",  // required field
          },
          professionalProfile: {
            name: "placeholder",  // required field
          },
        },
      },
      { upsert: true }
    );

    // Configure nodemailer
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Send OTP email
    await transporter.sendMail({
      from: `"TweniQ" <tweniq@gmail.com>`,
      to: email,
      subject: "Verify Your Email",
      text: `Hi there!

To continue with your registration, please verify your email using the OTP below:

🔐 Your One-Time Password (OTP): ${otp}

If you didn’t request this, you can safely ignore this email.

Thanks,  
The TweniQ Team`,
    });

    return res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});



// For verifying the otp entered by user

  router.post("/verifyotp", async (req,res)=>
  {
    try {
      const {email, otp} = req.body;
      const user = await User.findOne({email});
      const userotp = await user.otp;
      if(otp == userotp)
      {
        res.status(200)
        .json({
            message: "Otp is correct ",
            success: true,
            
          
        })

      }
      else{
        return res.status(403)
                .json({ message: "OTP is wrong", success: false });
      }

      
    } catch (error) {
console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Internal server error" });    }
  });


router.get("/usernameavailability", async (req, res) => {
  try {
console.log("Username to check for availability:", req.query.username);
const username = req.query.username?.trim();

    if (!username) {
      return res.status(400).json({
        available: false,
        message: "Username is required",
      });
    }

    // Check if the username exists (case-insensitive)
    const user = await User.findOne({
      username: { $regex: `^${username}$`, $options: "i" },
    });

    if (!user) {
      return res.status(200).json({
        available: true,
        message: "Username is available",
      });
    } else {
      return res.status(200).json({
        available: false,
        message: "Username already taken",
      });
    }
  } catch (error) {
    console.error("Error checking username availability:", error.message);
    res.status(500).json({
      available: false,
      message: "Internal server error",
    });
  }
});


router.post(
  "/saveprofiledata",
  upload.fields([
    { name: "socialDp", maxCount: 1 },
    { name: "professionalDp", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { email, username, password, socialProfile, professionalProfile } = req.body;

      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: "User not found" });

      const trimmedUsername = username?.trim();

      if (trimmedUsername && trimmedUsername !== user.username) {
          if (trimmedUsername.startsWith("tempuser_")) {
    return res.status(400).json({
      message: "Invalid username. Please choose a more personal username.",
    });
  }
        const existingUser = await User.findOne({
          username: { $regex: `^${trimmedUsername}$`, $options: "i" },
        });

        if (existingUser) {
          return res
            .status(409)
            .json({ message: "Username already taken. Please choose another." });
        }

        user.username = trimmedUsername;
      }

      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
      }

      const parsedSocial = JSON.parse(socialProfile);
      const parsedProfessional = JSON.parse(professionalProfile);

      user.socialProfile = {
        ...user.socialProfile,
        ...parsedSocial,
        dpUrl: req.files?.socialDp?.[0]
          ? req.files.socialDp[0].path
          : user.socialProfile.dpUrl,
      };

      user.professionalProfile = {
        ...user.professionalProfile,
        ...parsedProfessional,
        dpUrl: req.files?.professionalDp?.[0]
          ? req.files.professionalDp[0].path
          : user.professionalProfile.dpUrl,
      };

      await user.save();

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      return res.status(200).json({
        message: "Profile updated successfully",
        jwtToken: token,
        username: user.username,
      });
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.username) {
        return res
          .status(409)
          .json({ message: "Username already taken. Please choose another." });
      }

      console.error("Error updating user profile:", error);
      return res.status(500).json({ message: "An error occurred", error });
    }
  }
);






module.exports = router;