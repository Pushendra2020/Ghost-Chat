import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';
import { nanoid } from 'nanoid';

export async function POST() {
    try {
        await connectDB();

        // Generate a secure random 10 character user ID
        let userId = nanoid(10);
        // Ensure uniqueness just in case
        while (await User.findOne({ userId })) {
            userId = nanoid(10);
        }

        const newUser = await User.create({ userId });

        return NextResponse.json({ success: true, userId: newUser.userId }, { status: 201 });
    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 });
    }
}
