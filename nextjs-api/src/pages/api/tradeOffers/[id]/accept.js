import connectDB from "@/utils/db";
import TradeOffer from "@/models/TradeOffer";
import User from "@/models/User";
import VideoGame from "@/models/VideoGame";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { sendTradeStatusUpdateNotification } from "@/utils/kafkaProducer";
import { tradeOffersAccepted } from "../../metrics";

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
            const { userId, password } = req.body;

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

            // Update ownership of all games involved in the trade
            const { offerer, receiver, offeredGames, requestedGames } = tradeOffer;

            // Transfer offered games from offerer to receiver
            if (offeredGames.length > 0) {
                await VideoGame.updateMany(
                    { _id: { $in: offeredGames } },
                    { $set: { ownerId: receiver } }
                );
            }

            // Transfer requested games from receiver to offerer
            if (requestedGames.length > 0) {
                await VideoGame.updateMany(
                    { _id: { $in: requestedGames } },
                    { $set: { ownerId: offerer } }
                );
            }

            // Reject any other pending trade offers involving these games
            if (offeredGames.length > 0 || requestedGames.length > 0) {
                const allGameIds = [...offeredGames, ...requestedGames];
                
                await TradeOffer.updateMany(
                    {
                        _id: { $ne: tradeOffer._id },
                        status: "pending",
                        $or: [
                            { offeredGames: { $in: allGameIds } },
                            { requestedGames: { $in: allGameIds } }
                        ]
                    },
                    { 
                        $set: { 
                            status: "rejected",
                            rejectionReason: "Another trade involving these games was accepted"
                        }
                    }
                );
            }

            // Update status to accepted
            tradeOffer.status = "accepted";
            tradeOffer.completedAt = new Date();
            await tradeOffer.save();

            // Send notification for the trade status update
            await sendTradeStatusUpdateNotification(tradeOffer, "accepted");

            tradeOffersAccepted.inc();

            return res.status(200).json({ 
                message: "Trade offer accepted successfully", 
                tradeOffer 
            });
        } catch (error) {
            console.error("Accept Trade Error:", error);
            return res.status(500).json({ 
                message: "Error accepting trade offer", 
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
