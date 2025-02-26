import connectDB from "@/utils/db";
import VideoGame from "@/models/VideoGame";
import User from "@/models/User";
import mongoose from "mongoose";


export default async function handler(req, res) {
    try {
        await connectDB();

        const { gameIdentifier } = req.query;
        let game;

        if (req.method === "GET" || req.method === "DELETE" || req.method === "PUT" || req.method === "PATCH") {
            try {
                // Try to find by name first
                game = await VideoGame.findOne({ title: gameIdentifier });
                
                // If not found by name, try by ID
                if (!game && mongoose.Types.ObjectId.isValid(gameIdentifier)) {
                    game = await VideoGame.findById(gameIdentifier);
                }
                
                if (!game) {
                    return res.status(404).json({ 
                        message: "Game not found",
                        details: `No game found with identifier: ${gameIdentifier}`
                    });
                }
            } catch (error) {
                console.error("Error finding game:", error);
                return res.status(500).json({ 
                    message: "Error finding game", 
                    error: error.message 
                });
            }
        }

        switch (req.method) {
                case "GET":
                    return res.status(200).json(game);
                case "PUT":
                case "PATCH":
                    try {
                        const { ownerId, isTradeOffer, ...updateData } = req.body;

                        const oldGame = { ...game.toObject() };
                        if (!isTradeOffer) {
                            // Regular update - verify owner
                            if (!ownerId) {
                                return res.status(400).json({ 
                                    message: "Missing ownerId", 
                                    details: "Owner ID is required for game updates"
                                });
                            }

                            // Validate ownerId format
                            if (!mongoose.Types.ObjectId.isValid(ownerId)) {
                                return res.status(400).json({ 
                                    message: "Invalid owner ID format",
                                    details: "The provided owner ID is not in a valid MongoDB ObjectId format"
                                });
                            }

                            // Check if owner exists
                            try{
                                const user = await User.findById(ownerId);
                                if (!user) {
                                    return res.status(404).json({ 
                                        message: "Owner not found", 
                                        details: `No user exists with the ID: ${ownerId}`
                                    });
                                }
                            } catch 
                            {
                                if (error.kind === "ObjectId") {
                                    return res.status(404).json({ 
                                        message: "Owner not found", 
                                        details: `No user exists with the ID: ${ownerId}`
                                    });
                                }
                            }
                            
                            // Verify the owner matches
                            if (ownerId !== game.ownerId.toString()) {
                                return res.status(403).json({ 
                                    message: "Unauthorized", 
                                    details: "Only the owner can update this game"
                                });
                            }
                        } else {
                            // Trade offer - allow ownerId update
                            // check if request comes from the trade system
                        }

                        const updatedGame = await VideoGame.findByIdAndUpdate(
                            game._id, 
                            req.method === "PATCH" ? updateData : req.body, 
                            { new: true }
                        );

                        return res.status(200).json({
                            message: "Game updated successfully",
                            previousData: oldGame,
                            updatedData: updatedGame
                        });

                    } catch (error) {
                        console.error(`Game ${req.method} Error:`, error);
                        return res.status(500).json({ 
                            message: `Error updating game`, 
                            error: error.message 
                        });
                    }
                    break;
        
                case "DELETE":
                    try {
                        const { ownerId } = req.body;

                        if (!ownerId) {
                            return res.status(400).json({ 
                                message: "Missing ownerId", 
                                details: "Owner ID is required for game updates"
                            });
                        }

                        // Validate ownerId format
                        if (!mongoose.Types.ObjectId.isValid(ownerId)) {
                            return res.status(400).json({ 
                                message: "Invalid owner ID format",
                                details: "The provided owner ID is not in a valid MongoDB ObjectId format"
                            });
                        }

                        // Check if owner exists
                        try{
                            const user = await User.findById(ownerId);
                            if (!user) {
                                return res.status(404).json({ 
                                    message: "Owner not found", 
                                    details: `No user exists with the ID: ${ownerId}`
                                });
                            }
                        } catch 
                        {
                            if (error.kind === "ObjectId") {
                                return res.status(404).json({ 
                                    message: "Owner not found", 
                                    details: `No user exists with the ID: ${ownerId}`
                                });
                            }
                        }
                        
                        // Verify the owner matches
                        if (ownerId !== game.ownerId.toString()) {
                            return res.status(403).json({ 
                                message: "Unauthorized", 
                                details: "Only the owner can Delete this game"
                            });
                        }

                        const deletedGame = await VideoGame.findByIdAndDelete(game._id);
                        return res.status(200).json({ 
                            message: "Game deleted successfully",
                            deletedGame: deletedGame
                        });                        
                    } catch (error) {
                        console.error("Game Delete Error:", error);
                        return res.status(500).json({ 
                            message: "Error deleting game", 
                            error: error.message 
                        });
                    }
                    break;
        
                    default:
                        res.setHeader("Allow", ["GET", "PUT", "PATCH", "DELETE"]);
                        return res.status(405).json({ 
                            message: `Method ${req.method} Not Allowed`,
                            allowedMethods: ["GET", "PUT", "PATCH", "DELETE"]
                        });
                }
            } catch (error) {
                console.error("Handler Error:", error);
                return res.status(500).json({ 
                    message: "Server error", 
                    error: error.message 
                });
            }
        }