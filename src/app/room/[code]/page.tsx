import { Suspense } from "react";
import Table from "./Table";

async function Room({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Table code={decodeURIComponent(code).toUpperCase().slice(0, 12)} />;
}

export default function RoomPage(props: PageProps<"/room/[code]">) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Room params={props.params} />
    </Suspense>
  );
}
