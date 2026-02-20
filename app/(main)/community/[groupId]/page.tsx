import { connection } from "next/server";
import GroupDetailPageWrapper from "./GroupDetailPageWrapper";

export default async function Page({ params }: { params: Promise<{ groupId: string }> }) {
    await connection();
    return <GroupDetailPageWrapper params={params} />;
}
