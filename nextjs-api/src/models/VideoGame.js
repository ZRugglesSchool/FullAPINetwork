import mongoose from "mongoose";

const videoGameSchema = new mongoose.Schema({
    title: { type: String, required: true },
    publisher: { type: String, required: true },
    year: { type: Number, required: true },
    system: { type: String, required: true },
    condition: { type: String, enum: ['mint', 'good', 'fair', 'poor'], required: true },
    price: { type: Number, required: true },
    rating: { type: Number, enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

const VideoGame = mongoose.models.VideoGame || mongoose.model('VideoGame', videoGameSchema);
export default VideoGame;