"use node";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import Razorpay from "razorpay";
import crypto from "crypto";

// Initialize Razorpay
const getRazorpay = () => {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
        throw new Error("RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not defined");
    }

    return new Razorpay({
        key_id,
        key_secret,
    });
};

// 1. Create Order (Action)
export const createOrder = action({
    args: {
        amount: v.number(), // Amount in INR
        currency: v.string(), // "INR"
        receipt: v.string(), // e.g., "event_123" or "fund_456"
        notes: v.optional(v.any()), // Extra metadata
    },
    handler: async (ctx, args) => {
        const razorpay = getRazorpay();

        const options = {
            amount: Math.round(args.amount * 100), // Convert to paise
            currency: args.currency,
            receipt: args.receipt,
            notes: args.notes,
        };

        try {
            const order = await razorpay.orders.create(options);
            return order;
        } catch (error) {
            console.error("Razorpay Order Creation Failed:", error);
            throw new Error("Failed to create Razorpay order");
        }
    },
});

// 2. Verify Payment (Action)
export const verifyPayment = action({
    args: {
        razorpay_order_id: v.string(),
        razorpay_payment_id: v.string(),
        razorpay_signature: v.string(),
        type: v.string(), // "event" or "fund"
        targetId: v.string(), // eventId or fundId
        amount: v.number(), // Original amount in INR
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret) throw new Error("RAZORPAY_KEY_SECRET missing");

        const generated_signature = crypto
            .createHmac("sha256", secret)
            .update(args.razorpay_order_id + "|" + args.razorpay_payment_id)
            .digest("hex");

        if (generated_signature === args.razorpay_signature) {
            // Signature matches
            if (args.type === "event") {
                await ctx.runMutation(internal.paymentInternals.recordEventPayment, {
                    eventId: args.targetId as any,
                    userId: args.userId,
                    paymentId: args.razorpay_payment_id,
                    orderId: args.razorpay_order_id,
                    signature: args.razorpay_signature,
                    amount: args.amount,
                });
            } else if (args.type === "fund") {
                await ctx.runMutation(internal.paymentInternals.recordFundContribution, {
                    fundId: args.targetId as any,
                    userId: args.userId,
                    paymentId: args.razorpay_payment_id,
                    orderId: args.razorpay_order_id,
                    signature: args.razorpay_signature,
                    amount: args.amount,
                });
            }
            return { success: true };
        } else {
            throw new Error("Invalid payment signature");
        }
    },
});
