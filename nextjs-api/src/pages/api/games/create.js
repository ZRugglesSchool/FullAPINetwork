import connectDB from "@/utils/db";
import VideoGame from "@/models/VideoGame";
import User from "@/models/User";
import mongoose from "mongoose";
import { gamesCreatedTotal } from "../metrics";

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
        const { title, publisher, year, system, condition, price, rating, ownerId } = req.body;

        const missingFields = [];
        if (!title) missingFields.push("title");
        if (!publisher) missingFields.push("publisher");
        if (!year) missingFields.push("year");
        if (!system) missingFields.push("system");
        if (!condition) missingFields.push("condition");
        if (!price) missingFields.push("price");
        if (!rating) missingFields.push("rating");
        if (!ownerId) missingFields.push("ownerId");

        if (missingFields.length > 0) {
            return res.status(400).json({ 
                message: "Missing required fields", 
                missingFields: missingFields 
            });
        }

        // Validate fields format
        if (isNaN(Number(year))) {
            return res.status(400).json({ message: "Year must be a number" });
        }
        
        if (isNaN(Number(price))) {
            return res.status(400).json({ message: "Price must be a number" });
        }
        
        if (isNaN(Number(rating)) || rating < 1 || rating > 10) {
            return res.status(400).json({ message: "Rating must be a number between 1 and 10" });
        }

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

        // Create and save the new game
        const newGame = new VideoGame({ title, publisher, year, system, condition, price, rating, ownerId });
        try {
            await newGame.save();
        } catch (saveError) {
            // Handle mongoose validation errors
            if (saveError.name === "ValidationError") {
                const validationErrors = {};
                
                for (const field in saveError.errors) {
                    validationErrors[field] = saveError.errors[field].message;
                }
                
                return res.status(400).json({
                    message: "Validation error",
                    errors: validationErrors
                });
            }
            
            throw saveError;
        }

        gamesCreatedTotal.inc();

        return res.status(201).json({
            message: "Video game created successfully",
            game: newGame
        });

        } catch (error) {
            console.error("Game create POST Error:", error);
            return res.status(500).json({ 
                message: "Server error while creating game", 
                error: error.message 
            });
        }
    } else {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({ 
            message: `Method ${req.method} Not Allowed`,
            allowedMethods: ["POST"]
        });    }
}
