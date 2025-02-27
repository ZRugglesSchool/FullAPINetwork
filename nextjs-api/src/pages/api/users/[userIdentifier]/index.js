import connectDB from "@/utils/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { sendPasswordChangeNotification } from "@/utils/kafkaProducer"; 


export default async function handler(req, res) {
    await connectDB();

    const { userIdentifier } = req.query; // Can be ID or username
    const { password, newPassword, ...updateData } = req.body;

    try {
        // Try finding by ID first
        let user = await User.findOne({ name: userIdentifier });


        // If not found by ID, try finding by name
        if (!user) {
            user = await User.findById(userIdentifier);
        }

        if (!user) {
        return res.status(404).json({ message: "User not found" });
        }

        if (req.method === "GET") {
        return res.status(200).json(user);
        } 
        

        if (req.method === "PUT" || req.method === "DELETE") {
            // Check if password is provided
            if (!password) {
                return res.status(400).json({ message: "Password is required" });
            }

            // Verify password with bcrypt
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(403).json({ message: "Incorrect password" });
            }
        }

        if (req.method === "PUT") {
            const oldUser = { ...user.toObject() }; 
            const updatedFields  = { ...updateData };

            let passwordChanged = false;
            if (newPassword) {
                const salt = await bcrypt.genSalt(10);
                updatedFields.password = await bcrypt.hash(newPassword, salt);
                passwordChanged = true;
            }

            const updatedUser = await User.findByIdAndUpdate(user._id, updatedFields, {new: true});

            if (passwordChanged) {
                await sendPasswordChangeNotification(updatedUser);
            }


            return res.status(200).json({
                message: "Updated user",
                previousData: oldUser,
                updatedData: updatedUser
            });
        } 
        
        if (req.method === "DELETE") {
        await User.findByIdAndDelete(user._id);
        return res.status(200).json({ message: "User "+ user.name +" deleted" });
        }

        res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    } catch (error) {
        if (error.kind === "ObjectId") {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(500).json({ message: "Server error", error: error.message });
    }
}
