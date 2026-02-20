import { PublicProfilePage } from "@/components/profile/PublicProfilePage";

export default function Page({ params }: { params: Promise<{ userId: string }> }) {
    return <PublicProfilePage paramsPromise={params} />;
}
