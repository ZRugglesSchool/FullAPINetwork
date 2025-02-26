import connectDB from "@/utils/db";
import TradeOffer from "@/models/TradeOffer";
import User from "@/models/User";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { sendTradeStatusUpdateNotification } from "@/utils/kafkaProducer";

export default async function handler(req, res) {
    try {
        await connectDB();
    } catch (error) {
        return res.status(500).json({ 
            message: "Database connection failed", 
            details: error.message 
        });
    }

    if (req.method === "PATCH") {
        try {
            const { id } = req.query;
            const { userId, password, rejectionReason } = req.body;

            // Validate required fields
            if (!userId || !password) {
                return res.status(400).json({ 
                    message: "Missing required fields", 
                    details: "Both userId and password are required" 
                });
            }

            // Validate ObjectID format
            if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ 
                    message: "Invalid ID format", 
                    details: "Trade offer ID or user ID is not valid" 
                });
            }

            // Find the trade offer
            const tradeOffer = await TradeOffer.findById(id);
            if (!tradeOffer) {
                return res.status(404).json({ 
                    message: "Trade offer not found",
                    details: `No trade offer exists with ID: ${id}`
                });
            }

            // Ensure trade is still pending
            if (tradeOffer.status !== "pending") {
                return res.status(400).json({ 
                    message: "Invalid trade status", 
                    details: `This trade offer is already ${tradeOffer.status}` 
                });
            }

            // Verify the user is the receiver of the trade offer
            if (tradeOffer.receiver.toString() !== userId) {
                return res.status(403).json({ 
                    message: "Unauthorized", 
                    details: "Only the receiver of the trade offer can reject it" 
                });
            }

            // Find and authenticate user
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ 
                    message: "User not found", 
                    details: "The specified user does not exist" 
                });
            }

            if (!user._id.equals(tradeOffer.receiver)) {
                return res.status(401).json({ 
                    message: "Authentication failed", 
                    details: "User is not the receiver of this trade offer"
                });
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ 
                    message: "Authentication failed", 
                    details: "Invalid password" 
                });
            }

            // Update status to rejected
            tradeOffer.status = "rejected";
            tradeOffer.completedAt = new Date();
            
            // Add rejection reason if provided
            if (rejectionReason) {
                tradeOffer.rejectionReason = rejectionReason;
            }
            
            await tradeOffer.save();

            sendTradeStatusUpdateNotification(tradeOffer, "rejected");

            return res.status(200).json({ 
                message: "Trade offer rejected successfully", 
                tradeOffer 
            });
        } catch (error) {
            console.error("Reject Trade Error:", error);
            return res.status(500).json({ 
                message: "Error rejecting trade offer", 
                error: error.message 
            });
        }
    } else {
        res.setHeader("Allow", ["PATCH"]);
        return res.status(405).json({ 
            message: `Method ${req.method} Not Allowed`,
            allowedMethods: ["PATCH"] 
        });
    }
}