const { Kafka } = require("kafkajs");
const nodemailer = require("nodemailer");
const { MongoClient, ObjectId } = require("mongodb");

const kafka = new Kafka({
    clientId: "email-service",
    brokers: [process.env.KAFKA_BROKER || "kafka:9092"],
});

const consumer = kafka.consumer({ groupId: "email-group" });

// MongoDB setup
const mongoUri = process.env.MONGO_URI;
const client = new MongoClient(mongoUri);

const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
        user: process.env.ETHEREAL_USER,
        pass: process.env.ETHEREAL_PASS,
    },
});

const run = async () => {
    try {
        await consumer.connect();
        await client.connect();
        console.log("✅ Connected to MongoDB");

        await consumer.subscribe({ topic: "trade-offers", fromBeginning: true });
        await consumer.subscribe({ topic: "trade-status-updates", fromBeginning: true });
        await consumer.subscribe({ topic: "user-changes", fromBeginning: true });

        const db = client.db("gameAPI");
        const usersCollection = db.collection("users"); // users collection
        const gamesCollection = db.collection("videogames"); // video games collection

        await consumer.run({
            eachMessage: async ({ topic, message }) => {
                const payload = JSON.parse(message.value.toString());
                console.log("payload", payload);
                if (topic === "trade-offers") {
                    await handleTradeOffer(payload, usersCollection, gamesCollection);
                } else if (topic === "trade-status-updates") {
                    await handleStatusUpdate(payload, usersCollection, gamesCollection);
                } else if (topic === "user-changes") {
                    await handleUserChanges(payload, usersCollection);
                }
            },
        });
    } catch (error) {
        console.error("❌ Error in Kafka consumer:", error);
    }
};

async function handleTradeOffer(tradeOffer, usersCollection, gamesCollection) {
    const { offerer, receiver, offeredGames, requestedGames, status, _id } = tradeOffer;

    console.log(`📧 Processing trade offer ${_id} between ${offerer} and ${receiver}`);

    try {
        // Fetch both users' information
        const [offererUser, receiverUser] = await Promise.all([
            usersCollection.findOne({ _id: new ObjectId(offerer) }),
            usersCollection.findOne({ _id: new ObjectId(receiver) })
        ]);

        if (!offererUser || !receiverUser) {
            console.error("❌ Could not find user information");
            return;
        }

        // Fetch all game details at once
        const allGameIds = [...offeredGames, ...requestedGames].map(id => new ObjectId(id));
        const games = await gamesCollection.find({ _id: { $in: allGameIds } }).toArray();

        // Map games by ID for easier lookup
        const gamesMap = games.reduce((map, game) => {
            map[game._id.toString()] = game;
            return map;
        }, {});

        // Format game lists with details
        const offeredGamesDetails = formatGamesList(offeredGames, gamesMap);
        const requestedGamesDetails = formatGamesList(requestedGames, gamesMap);

        // Send email to receiver
        await sendTradeEmail({
            to: receiverUser.email,
            subject: "New Trade Offer Received",
            tradeType: "received",
            offererDetails: formatUserDetails(offererUser),
            receiverDetails: formatUserDetails(receiverUser),
            offeredGamesDetails,
            requestedGamesDetails,
            tradeId: _id,
            status
        });

        // Send email to offerer
        await sendTradeEmail({
            to: offererUser.email,
            subject: "Your Trade Offer Was Sent",
            tradeType: "sent",
            offererDetails: formatUserDetails(offererUser),
            receiverDetails: formatUserDetails(receiverUser),
            offeredGamesDetails,
            requestedGamesDetails,
            tradeId: _id,
            status
        });

        console.log(`✅ Trade offer emails sent to ${receiverUser.email} and ${offererUser.email}`);
    } catch (error) {
        console.error("❌ Error processing trade offer:", error);
    }
}

// Function to handle trade status updates
async function handleStatusUpdate(updateData, usersCollection, gamesCollection) {
    const { tradeId, newStatus, offerer, receiver, offeredGames, requestedGames } = updateData;

    console.log(`📧 Processing status update for trade ${tradeId}: ${newStatus}`);

    try {
        // Fetch both users' information
        const [offererUser, receiverUser] = await Promise.all([
            usersCollection.findOne({ _id: new ObjectId(offerer) }),
            usersCollection.findOne({ _id: new ObjectId(receiver) })
        ]);

        if (!offererUser || !receiverUser) {
            console.error("❌ Could not find user information");
            return;
        }

        // Fetch all game details
        const allGameIds = [...offeredGames, ...requestedGames].map(id => new ObjectId(id));
        const games = await gamesCollection.find({ _id: { $in: allGameIds } }).toArray();

        // Map games by ID for easier lookup
        const gamesMap = games.reduce((map, game) => {
            map[game._id.toString()] = game;
            return map;
        }, {});

        // Format game lists with details
        const offeredGamesDetails = formatGamesList(offeredGames, gamesMap);
        const requestedGamesDetails = formatGamesList(requestedGames, gamesMap);

        // Email subjects based on status
        const statusText = newStatus === "accepted" ? "Accepted" : "Rejected";
        
        // Send email to offerer
        await sendStatusUpdateEmail({
            to: offererUser.email,
            subject: `Your Trade Offer Was ${statusText}`,
            userRole: "offerer",
            offererDetails: formatUserDetails(offererUser),
            receiverDetails: formatUserDetails(receiverUser),
            offeredGamesDetails,
            requestedGamesDetails,
            tradeId,
            status: newStatus
        });

        // Send email to receiver
        await sendStatusUpdateEmail({
            to: receiverUser.email,
            subject: `You ${statusText} a Trade Offer`,
            userRole: "receiver",
            offererDetails: formatUserDetails(offererUser),
            receiverDetails: formatUserDetails(receiverUser),
            offeredGamesDetails,
            requestedGamesDetails,
            tradeId,
            status: newStatus
        });

        console.log(`✅ Status update emails sent to ${offererUser.email} and ${receiverUser.email}`);
    } catch (error) {
        console.error("❌ Error processing status update:", error);
    }
}

async function handleUserChanges(userChange, usersCollection) {
    const { _id, email, name } = userChange;

    console.log(`📧 Processing user change for user ${_id}`);

    try {
        const formattedTime = new Date().toLocaleString();

        await sendPasswordChangeEmail({
            to: email,
            name: name,
            timestamp: formattedTime
        })

        console.log(`✅ Password change email sent to ${userChange.email}`);
    } catch (error) {
        console.error("❌ Error processing user change:", error);
    }
}
// Format user details
function formatUserDetails(user) {
    return {
        name: user.name || "User",
        email: user.email || "No email",
        id: user._id.toString()
    };
}

// Format games list with details
function formatGamesList(gameIds, gamesMap) {
    return gameIds.map(id => {
        const game = gamesMap[id.toString()] || {
            title: "Unknown Game",
            publisher: "Unknown Publisher",
            price: "N/A",
            condition: "N/A"
        };

        return {
            id: id.toString(),
            title: game.title || "Unknown Title",
            publisher: game.publisher || "Unknown Publisher",
            price: game.price || "N/A",
            condition: game.condition || "N/A"
        };
    });
}

// Send initial trade email
async function sendTradeEmail({ to, subject, tradeType, offererDetails, receiverDetails, offeredGamesDetails, requestedGamesDetails, tradeId, status }) {
    // Format games into readable list
    const offeredGamesText = formatGamesText(offeredGamesDetails);
    const requestedGamesText = formatGamesText(requestedGamesDetails);

    const emailText = `
            New Trade Offer ${tradeType.toUpperCase()}!

            Trade ID: ${tradeId}

            Offerer: ${offererDetails.name} - ${offererDetails.email} - ${offererDetails.id}
            Receiver: ${receiverDetails.name} - ${receiverDetails.email} - ${receiverDetails.id}

            Offered Games:
            ${offeredGamesText}

            Requested Games:
            ${requestedGamesText}

            Status: ${status}

            ${tradeType === "received" ? "Please review and accept or reject this trade offer." : "The other user will be notified to review your offer."}
            `;

    // Send email
    await transporter.sendMail({
        from: '"Trade Notifications" <noreply@tradeapp.com>',
        to: to,
        subject: subject,
        text: emailText,
    });
}

// Send status update email
async function sendStatusUpdateEmail({ to, subject, offererDetails, receiverDetails, offeredGamesDetails, requestedGamesDetails, tradeId, status }) {
    // Format games into readable list
    const offeredGamesText = formatGamesText(offeredGamesDetails);
    const requestedGamesText = formatGamesText(requestedGamesDetails);

    let additionalText = "";
    if (status === "accepted") {
        additionalText = "The trade has been completed and game ownership has been transferred.";
    } else if (status === "rejected") {
        additionalText = "No changes have been made to game ownership.";
    }

    const emailText = `
Trade Offer ${status.toUpperCase()}!

Trade ID: ${tradeId}

Offerer: ${offererDetails.name} - ${offererDetails.email} - ${offererDetails.id}
Receiver: ${receiverDetails.name} - ${receiverDetails.email} - ${receiverDetails.id}

Offered Games:
${offeredGamesText}

Requested Games:
${requestedGamesText}

Status: ${status}

${additionalText}
`;

    // Send email
    await transporter.sendMail({
        from: '"Trade Notifications" <noreply@tradeapp.com>',
        to: to,
        subject: subject,
        text: emailText,
    });
}

async function sendPasswordChangeEmail({ to, name, timestamp }) {
    const emailText = `
    Hello ${name},

    This is a confimation that your password for your account was changed at ${timestamp}.

    If you did not make this change, please contact us immediately.

    Thank you, 
    Game Trading Platform Security Team
    `;

    await transporter.sendMail({
        from: '"Account Security" <secutiry@tradeapp.com>',
        to: to,
        subject: "Password Changed",
        text: emailText,
    });
}

// Helper to format games into text
function formatGamesText(games) {
    if (games.length === 0) {
        return "None";
    }
    
    return games.map(game => 
        `${game.title} by ${game.publisher}
Price: ${game.price}
Condition: ${game.condition}`
    ).join("\n\n");
}


run().catch(console.error);
