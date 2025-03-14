import connectDB from "@/utils/db";
import User from "@/models/User";
import { usersCreatedTotal } from "../metrics";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
    await connectDB();


    try {
        const { name, email, password, street_address } = req.body;

        // Check if all fields are provided
        if (!name || !email || !password || !street_address) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Check if the user already exists by email
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already in use" });
        }

        // Create a new user
        const newUser = new User({ name, email, password, street_address });
        await newUser.save();

        usersCreatedTotal.inc();

        return res.status(201).json({
            message: "User registered successfully",
            user: { id: newUser._id, name: newUser.name, email: newUser.email }
        });
    } catch (error) {
        return res.status(500).json({ message: "Server error", error: error.message });
    }
}
