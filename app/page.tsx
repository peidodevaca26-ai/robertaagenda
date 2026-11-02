import Agenda from "@/components/agenda";
export const dynamic = "force-dynamic";
export default function Page() {
  return <Agenda demo={process.env.DATA_MODE !== "supabase"} />;
}
