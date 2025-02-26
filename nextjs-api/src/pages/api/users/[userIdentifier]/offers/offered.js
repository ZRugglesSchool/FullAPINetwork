import connectDB from "@/utils/db";
import User from "@/models/User";
import TradeOffer from "@/models/TradeOffer";

export default async function handler(req, res) {
    await connectDB();

    const { userIdentifier } = req.query; 
    try {
        let user = await User.findOne({ name: userIdentifier });

        if (!user) {
            user = await User.findById(userIdentifier);
        }

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Fetch trade offers where the user is the offerer
        const madeOffers = await TradeOffer.find({ offerer: user._id }).populate("requestedGames offeredGames");

        return res.status(200).json({ message: `Trade offers made by ${user.name}`, offers: madeOffers });
    } catch (error) {
        if (error.kind === "ObjectId") {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(500).json({ message: "Server error", error: error.message });
    }
}
