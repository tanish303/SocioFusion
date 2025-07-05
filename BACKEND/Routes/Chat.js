const router = require("express").Router();
const jwt = require("jsonwebtoken");
const ChatRoom = require("../Models/ChatRoom");
const Message = require("../Models/Message");
const User = require("../Models/User");

/* 🔐 Inline token validation */
const verifyToken = (req) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId;
  } catch (err) {
    return null;
  }
};

/* 🔍 Search user by username in current mode */
router.get("/search", async (req, res) => {
  const userId = verifyToken(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { q, mode } = req.query;            // ?q=john&mode=social
  if (!q) return res.status(400).json({ message: "Search username  missing" });

const user = await User.findOne(
  { username: new RegExp(`^${q}$`, "i") }   // ← exact match, case‑insensitive
).lean();   if (!user) return res.status(404).json({ message: "User not found" });

  const profile = user[`${mode}Profile`];
  if (!profile)
    return res.status(404).json({ message: `User has no ${mode} profile` });

  res.json({
    user: {
      _id:       user._id,
      username:  user.username,
      followers: user.followersCount,
      following: user.followingCount,
      posts:     profile.posts.length,
    },
  });
});


/* ➕ Create or fetch a DM room */
router.post("/room", async (req, res) => {
  const userId = verifyToken(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { otherUserId, mode } = req.body;

  let room = await ChatRoom.findOne({
    participants: { $all: [userId, otherUserId] },
    mode,
  });

  if (!room) {
    room = await ChatRoom.create({
      participants: [userId, otherUserId],
      mode,
    });
  }

  res.json({ roomId: room._id });
});

/* 💬 Get conversations list */
router.get("/conversations", async (req, res) => {
  const userId = verifyToken(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized token, Please Signin again" });

  const { mode } = req.query;

  const rooms = await ChatRoom.find({
    participants: userId,
    mode,
  })
    .populate("participants", "username")
    .sort({ updatedAt: -1 })
    .lean();

  const conv = rooms.map((r) => {
    const other = r.participants.find((u) => u._id.toString() !== userId);
    return {
      roomId: r._id,
      username: other?.username || "Unknown",
    };
  });

  res.json({ conversations: conv });
});


/* 📜 Get messages of a room */
router.get("/room/:id/messages", async (req, res) => {
  const userId = verifyToken(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const msgs = await Message.find({ room: req.params.id })
    .sort({ createdAt: 1 })
    .lean();

  res.json({ messages: msgs });
});

/* 👤 Get partner name for a room */
router.get("/room/:id/info", async (req, res) => {
  const userId = verifyToken(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const room = await ChatRoom.findById(req.params.id)
    .populate("participants", "username")
    .lean();

  if (!room) return res.status(404).json({ message: "Room not found" });

  const partner = room.participants.find((p) => p._id.toString() !== userId);
  if (!partner) return res.status(400).json({ message: "Partner not found" });

  res.json({ partnerUsername: partner.username }); // 👈 send username only
});

// ❌ Delete chat room and all messages
router.delete("/room/:id", async (req, res) => {
  const userId = verifyToken(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const room = await ChatRoom.findById(req.params.id);
  if (!room) return res.status(404).json({ message: "Room not found" });

  // Make sure user is part of this chat
  if (!room.participants.includes(userId)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  await Message.deleteMany({ room: room._id }); // delete all messages in the room
  await ChatRoom.findByIdAndDelete(room._id);   // delete the room

  res.json({ success: true });
});


module.exports = router;
