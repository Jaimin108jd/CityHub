import { useState } from "react";

export const useRazorpay = () => {
    const [isLoaded, setIsLoaded] = useState(false);

    const loadRazorpay = async () => {
        return new Promise((resolve) => {
            if ((window as any).Razorpay) {
                setIsLoaded(true);
                resolve(true);
                return;
            }
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => {
                setIsLoaded(true);
                resolve(true);
            };
            script.onerror = () => {
                resolve(false);
            };
            document.body.appendChild(script);
        });
    };

    const processPayment = async (
        order: any,
        user: any,
        title: string,
        description: string,
        onSuccess: (response: any) => Promise<void>,
        onError: (error: any) => void
    ) => {
        const res = await loadRazorpay();
        if (!res) {
            onError(new Error("Razorpay SDK failed to load"));
            return;
        }

        const options = {
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Use public key here
            amount: order.amount,
            currency: order.currency,
            name: "CityHub",
            description: title,
            image: "https://example.com/logo.png", // Replace with your logo
            order_id: order.id,
            handler: async (response: any) => {
                try {
                    await onSuccess(response);
                } catch (e) {
                    onError(e);
                }
            },
            prefill: {
                name: user?.name || "",
                email: user?.email || "",
                contact: "", // Add if available
            },
            notes: {
                address: "CityHub Office",
            },
            theme: {
                color: "#10b981", // Emerald-500
            },
            modal: {
                ondismiss: () => {
                    // Handle modal close if needed
                }
            }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", function (response: any) {
            onError(response.error);
        });
        rzp.open();
    };

    return { processPayment, isLoaded };
};
