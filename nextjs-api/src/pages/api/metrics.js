import client from "prom-client";

// Create a new registry
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// API Route to expose Prometheus metrics
export default async function handler(req, res) {
    res.setHeader("Content-Type", register.contentType);
    res.send(await register.metrics());
}
