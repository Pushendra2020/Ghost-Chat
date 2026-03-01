import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 14400, // TTL index: 4 hours (14400 seconds)
    },
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
