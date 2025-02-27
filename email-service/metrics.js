const { Counter, Gauge, Histogram } = require('prom-client');

// Create a Registry to register the metrics
const Registry = require('prom-client').Registry;
const register = new Registry();

// Enable the default metrics (CPU, memory usage, etc.)
const collectDefaultMetrics = require('prom-client').collectDefaultMetrics;
collectDefaultMetrics({ register });

// Define custom metrics
const messagesProcessed = new Counter({
    name: 'email_service_messages_processed_total',
    help: 'Total number of Kafka messages processed',
    labelNames: ['topic'],
    registers: [register]
});

const messageProcessingTime = new Histogram({
    name: 'email_service_message_processing_duration_seconds',
    help: 'Duration of message processing in seconds',
    labelNames: ['topic'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    registers: [register]
});

const emailsSent = new Counter({
    name: 'email_service_emails_sent_total',
    help: 'Total number of emails sent',
    labelNames: ['type'],
    registers: [register]
});

const emailErrors = new Counter({
    name: 'email_service_errors_total',
    help: 'Total number of errors encountered',
    labelNames: ['operation', 'errorType'],
    registers: [register]
});

const mongoConnectionStatus = new Gauge({
    name: 'email_service_mongo_connection_status',
    help: 'MongoDB connection status (1 = connected, 0 = disconnected)',
    registers: [register]
});

const kafkaConnectionStatus = new Gauge({
    name: 'email_service_kafka_connection_status',
    help: 'Kafka connection status (1 = connected, 0 = disconnected)',
    registers: [register]
});

module.exports = {
    register,
    messagesProcessed,
    messageProcessingTime,
    emailsSent,
    emailErrors,
    mongoConnectionStatus,
    kafkaConnectionStatus
};