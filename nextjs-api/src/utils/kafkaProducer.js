import { Kafka } from 'kafkajs';

const kafka = new Kafka({
    clientId: "trade-api",
    brokers: [process.env.KAFKA_BROKER || "kafka:9092"],
});

const producer = kafka.producer();
let isConnected = false;

async function ensureConnection() {
    if (!isConnected) {
        await producer.connect();
        isConnected = true;
        console.log("✅ Kafka producer connected");
    }
}
// Send notification about new trade offer
async function sendTradeOfferNotification(tradeOffer) {
    try {
        await ensureConnection();
        
        // Convert Mongoose document to plain object if needed
        const tradeData = typeof tradeOffer.toObject === 'function' 
            ? tradeOffer.toObject() 
            : tradeOffer;
        
        await producer.send({
            topic: "trade-offers",
            messages: [
                { 
                    value: JSON.stringify(tradeData)
                },
            ],
        });
        
        console.log(`✅ Trade offer notification sent for trade: ${tradeData._id}`);
        return true;
    } catch (error) {
        console.error("❌ Error sending trade offer notification:", error);
        return false;
    }
}

// Send notification about trade status update
async function sendTradeStatusUpdateNotification(tradeOffer, newStatus) {
    try {
        await ensureConnection();
        
        // Convert Mongoose document to plain object if needed
        const tradeData = typeof tradeOffer.toObject === 'function' 
            ? tradeOffer.toObject() 
            : tradeOffer;
        
        // Create update payload
        const updateData = {
            tradeId: tradeData._id,
            offerer: tradeData.offerer,
            receiver: tradeData.receiver,
            offeredGames: tradeData.offeredGames,
            requestedGames: tradeData.requestedGames,
            newStatus
        };
        
        await producer.send({
            topic: "trade-status-updates",
            messages: [
                { 
                    value: JSON.stringify(updateData)
                },
            ],
        });
        
        console.log(`✅ Trade status update notification sent for trade: ${tradeData._id}`);
        return true;
    } catch (error) {
        console.error("❌ Error sending trade status update notification:", error);
        return false;
    }
}

module.exports = {
    sendTradeOfferNotification,
    sendTradeStatusUpdateNotification
};