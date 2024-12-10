import { Server } from "socket.io";
import { createServer } from "http";
import express from "express";
import cors from "cors";

// Simplified server without Prisma for demonstration
// You'll need to replace with your actual database logic
const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Maximum pending invitations allowed
const MAX_PENDING_INVITATIONS = 3;

// Store active user socket connections
const userSockets = new Map();

// Mock database (replace with your actual database)
const pendingInvitations = new Map();

io.on("connection", (socket) => {
  // Store user socket connection
  socket.on("register", (userId) => {
    userSockets.set(userId, socket.id);
    console.log("user connected", userId);
  });

  // Handle player invitation
  socket.on("sendInvitation", (invitationData) => {
    const {
      senderId,
      receiverId,
      gameId,
      senderUsername,
      senderRank,
      receiverUsername,
    } = invitationData;

    // Check if receiver has max pending invitations
    const currentPendingInvitations = pendingInvitations.get(receiverId) || 0;
    if (currentPendingInvitations >= MAX_PENDING_INVITATIONS) {
      socket.emit("invitationError", {
        message: "Receiver has reached maximum pending invitations",
      });
      return;
    }

    // Update pending invitations count
    pendingInvitations.set(receiverId, currentPendingInvitations + 1);

    // Find receiver's socket and send invitation
    const receiverSocketId = userSockets.get(receiverId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newInvitation", {
        senderId,
        receiverId,
        gameId,
        senderUsername,
        senderRank,
        receiverUsername,
      });

      // Notify sender about successful invitation
      socket.emit("invitationSent", {
        message: "Invitation sent successfully!",
      });
    }
  });

  // Handle invitation response
  socket.on(
    "respondToInvitation",
    ({ senderId, receiverId, status, receiverUsername }) => {
      // Reduce pending invitations count
      const currentPendingInvitations = pendingInvitations.get(receiverId) || 0;
      pendingInvitations.set(
        receiverId,
        Math.max(0, currentPendingInvitations - 1)
      );

      // Find sender's socket and notify
      const senderSocketId = userSockets.get(senderId);

      if (senderSocketId) {
        io.to(senderSocketId).emit("invitationResponse", {
          status,
          receiverUsername, // Replace with actual receiver username
        });
      }
    }
  );

  // Disconnect handling
  // Disconnect handling
  socket.on("disconnect", () => {
    let disconnectedUserId = null;

    // Find and remove the user's socket connection
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        console.log("user disconnected", userId);
        disconnectedUserId = userId;
        userSockets.delete(userId);
        break;
      }
    }

    // Remove any pending invitations for the disconnected user
    // if (disconnectedUserId) {
    //   // Remove invitations where the user is the receiver
    //   pendingInvitations.delete(disconnectedUserId);

    //   // Optionally, you might want to cancel any invitations sent by this user
    //   // This would require additional logic to track sent invitations
    //   console.log(
    //     `Cleaned up pending invitations for user ${disconnectedUserId}`
    //   );
    // }
  });
});

const PORT = process.env.SOCKET_PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});

export default io;
