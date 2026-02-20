import ProfilePageContent from "@/components/profile/ProfilePage";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Profile | CityHub",
    robots: {
        index: false,
        follow: false,
    },
};

export default function Page() {
    return <ProfilePageContent />;
}
