import connectDB from "@/utils/db";
import User from "@/models/User";
import TradeOffer from "@/models/TradeOffer";

export default async function handler(req, res) {
    await connectDB();

    const { userIdentifier } = req.query; // Can be ID or name

    try {
        let user = await User.findOne({ name: userIdentifier });
        
        if (!user) {
            user = await User.findById(userIdentifier);
        }

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Fetch trade offers where the user is the receiver
        const receivedOffers = await TradeOffer.find({ receiver: user._id }).populate("requestedGames offeredGames");

        return res.status(200).json({ message: `Trade offers received by ${user.name}`, offers: receivedOffers });
    } catch (error) {
        if (error.kind === "ObjectId") {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(500).json({ message: "Server error", error: error.message });
    }
}
