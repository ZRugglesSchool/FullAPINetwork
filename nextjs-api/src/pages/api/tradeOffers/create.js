import connectDB from "@/utils/db";
import TradeOffer from "@/models/TradeOffer";
import User from "@/models/User";
import VideoGame from "@/models/VideoGame";
import mongoose from "mongoose";
import { sendTradeOfferNotification } from "@/utils/kafkaProducer";

export default async function handler(req, res) {
    try {
        await connectDB();
    } catch (error) {
        return res.status(500).json({ 
            message: "Database connection failed", 
            details: error.message 
        });
    }

    if (req.method === "POST") {
        try {
        const { offerer, receiver, offeredGames = [], requestedGames = [] } = req.body;

        // Check if required fields are present
        if (!offerer || !receiver) {
            return res.status(400).json({
                message: "Missing required fields",
                details: "Both offerer and receiver IDs are required"
            });
        }

        // Validate ObjectIDs
        if (!mongoose.Types.ObjectId.isValid(offerer) || !mongoose.Types.ObjectId.isValid(receiver)) {
            return res.status(400).json({
                message: "Invalid user ID format",
                details: "One or both user IDs are not valid MongoDB ObjectId format"
            });
        }

        // Ensure offerer and receiver are different people
        if (offerer === receiver) {
            return res.status(400).json({
                message: "Invalid trade participants",
                details: "You cannot trade with yourself"
            });
        }

        // Ensure at least one game is offered or requested
        if (offeredGames.length === 0 && requestedGames.length === 0) {
            return res.status(400).json({
                message: "Empty trade offer",
                details: "At least one game must be offered or requested"
            });
        }

        // Validate game IDs format
        const allGameIds = [...offeredGames, ...requestedGames];
        for (const gameId of allGameIds) {
            if (!mongoose.Types.ObjectId.isValid(gameId)) {
                return res.status(400).json({
                    message: "Invalid game ID format",
                    details: `Game ID ${gameId} is not a valid MongoDB ObjectId`
                });
            }
        }

        // Validate users exist
        const [offererUser, receiverUser] = await Promise.all([
            User.findById(offerer),
            User.findById(receiver)
        ]);

        if (!offererUser) {
            return res.status(404).json({
                message: "User not found",
                details: `Offerer with ID ${offerer} does not exist`
            });
        }

        if (!receiverUser) {
            return res.status(404).json({
                message: "User not found",
                details: `Receiver with ID ${receiver} does not exist`
            });
        }

        // Fetch all games at once
        const allGames = await VideoGame.find({
            _id: { $in: allGameIds }
        });

        // Create maps for quick lookups
        const gamesMap = new Map(allGames.map(game => [game._id.toString(), game]));
        
        // Check all offered games exist and are owned by offerer
        if (offeredGames.length > 0) {
            const missingOfferedGames = [];
            const notOwnedOfferedGames = [];

            for (const gameId of offeredGames) {
                const game = gamesMap.get(gameId.toString());
                
                if (!game) {
                    missingOfferedGames.push(gameId);
                } else if (game.ownerId.toString() !== offerer) {
                    notOwnedOfferedGames.push(gameId);
                }
            }

            if (missingOfferedGames.length > 0) {
                return res.status(404).json({
                    message: "Games not found",
                    details: `The following offered games do not exist: ${missingOfferedGames.join(', ')}`
                });
            }

            if (notOwnedOfferedGames.length > 0) {
                return res.status(403).json({
                    message: "Unauthorized game offer",
                    details: `You do not own the following games: ${notOwnedOfferedGames.join(', ')}`
                });
            }
        }

         // Check all requested games exist and are owned by receiver
        if (requestedGames.length > 0) {
            const missingRequestedGames = [];
            const notOwnedRequestedGames = [];

            for (const gameId of requestedGames) {
                const game = gamesMap.get(gameId.toString());
                
                if (!game) {
                    missingRequestedGames.push(gameId);
                } else if (game.ownerId.toString() !== receiver) {
                    notOwnedRequestedGames.push(gameId);
                }
            }

            if (missingRequestedGames.length > 0) {
                return res.status(404).json({
                    message: "Games not found",
                    details: `The following requested games do not exist: ${missingRequestedGames.join(', ')}`
                });
            }

            if (notOwnedRequestedGames.length > 0) {
                return res.status(400).json({
                    message: "Invalid game request",
                    details: `The receiver does not own the following games: ${notOwnedRequestedGames.join(', ')}`
                });
            }
        }

        // Check for duplicate pending offers
        const existingOffer = await TradeOffer.findOne({
            offerer: offererUser._id,
            receiver: receiverUser._id,
            offeredGames: offeredGames,
            requestedGames: requestedGames,
            status: "pending"
        });
        console.log(existingOffer);
        if (existingOffer) {
            return res.status(409).json({
                message: "Duplicate trade offer",
                details: "An identical pending trade offer already exists",
                existingOfferId: existingOffer._id
            });
        }

        // Create trade offer
        const tradeOffer = new TradeOffer({
            offerer: offererUser._id,
            receiver: receiverUser._id,
            offeredGames: offeredGames,
            requestedGames: requestedGames,
            status: "pending",
        });

        await tradeOffer.save();

        await sendTradeOfferNotification(tradeOffer);

        return res.status(201).json({
            message: "Trade offer created successfully",
            tradeOffer
        });
        } catch (error) {
            console.error("Trade Offer Create Error:", error);
            return res.status(500).json({
                message: "Error creating trade offer",
                error: error.message,
                fullerror: error
            });
        }
    } else {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({
            message: `Method ${req.method} Not Allowed`,
            allowedMethods: ["POST"]
        });
    }
}
