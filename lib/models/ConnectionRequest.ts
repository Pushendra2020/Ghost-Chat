import mongoose from 'mongoose';

const ConnectionRequestSchema = new mongoose.Schema({
    senderId: {
        type: String,
        required: true,
        index: true,
    },
    receiverId: {
        type: String,
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 14400, // TTL index: 4 hours (14400 seconds)
    },
});

export default mongoose.models.ConnectionRequest || mongoose.model('ConnectionRequest', ConnectionRequestSchema);
