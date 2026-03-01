import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ConnectionRequest from '@/lib/models/ConnectionRequest';
import User from '@/lib/models/User';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { senderId, receiverId } = await req.json();

        if (!senderId || !receiverId) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        if (senderId === receiverId) {
            return NextResponse.json({ error: 'Cannot connect to yourself' }, { status: 400 });
        }

        const targetUser = await User.findOne({ userId: receiverId });
        if (!targetUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const existingRequest = await ConnectionRequest.findOne({
            senderId,
            receiverId,
            status: 'pending'
        });

        if (existingRequest) {
            return NextResponse.json({ error: 'Request already pending' }, { status: 400 });
        }

        const newRequest = await ConnectionRequest.create({ senderId, receiverId });

        return NextResponse.json({ success: true, request: newRequest }, { status: 201 });
    } catch (error) {
        console.error('Create request error', error);
        return NextResponse.json({ success: false, error: 'Failed to create request' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await connectDB();
        const { requestId, status } = await req.json();

        const request = await ConnectionRequest.findByIdAndUpdate(
            requestId,
            { status },
            { new: true }
        );

        return NextResponse.json({ success: true, request }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to update request' }, { status: 500 });
    }
}
