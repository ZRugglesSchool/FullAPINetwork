import client from "prom-client";

// Create a new registry
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const tradeOffersTotal = new client.Counter({
    name: "trade_offers_total",
    help: "Total number of trade offers created",
    registers: [register]
});

const tradeOffersAccepted = new client.Counter({
    name: "trade_offers_accepted_total",
    help: "Total number of trade offers accepted",
    registers: [register]
});

const tradeOffersRejected = new client.Counter({
    name: "trade_offers_rejected_total",
    help: "Total number of trade offers rejected",
    registers: [register]
});

const usersCreatedTotal = new client.Counter({
    name: "users_created_total",
    help: "Total number of users created",
    registers: [register]
});

const gamesCreatedTotal = new client.Counter({
    name: "games_created_total",
    help: "Total number of games added",
    registers: [register]
});

const tradeOfferProcessingTime = new client.Histogram({
    name: "trade_offer_processing_time",
    help: "Processing time for trade offers",
    buckets: [0.1, 0.5, 1, 3, 5, 10], // Time buckets in seconds
    registers: [register]
});

// API Route to expose Prometheus metrics
export default async function handler(req, res) {
    res.setHeader("Content-Type", register.contentType);
    res.send(await register.metrics());
}

export {
    tradeOffersTotal,
    tradeOffersAccepted,
    tradeOffersRejected,
    usersCreatedTotal,
    gamesCreatedTotal,
    tradeOfferProcessingTime
};
