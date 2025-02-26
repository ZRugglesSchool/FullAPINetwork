import mongoose from "mongoose";

const tradeOfferSchema = new mongoose.Schema({
    offerer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    offeredGames: [{ type: mongoose.Schema.Types.ObjectId, ref: 'VideoGame' }],
    requestedGames: [{ type: mongoose.Schema.Types.ObjectId, ref: 'VideoGame'}],
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], required: true },
    createdAt: { type: Date, default: Date.now }
});

const TradeOffer = mongoose.models.TradeOffer || mongoose.model('TradeOffer', tradeOfferSchema);
export default TradeOffer;