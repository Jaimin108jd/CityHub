import { connection } from "next/server";
import { EventDetailPageWrapper } from "./EventDetailPageWrapper";

export default async function Page({
    params,
}: {
    params: Promise<{ groupId: string; eventId: string }>;
}) {
    await connection();
    return <EventDetailPageWrapper params={params} />;
}
