import type { Metadata } from "next";
import Dashboard from "./Dashboard";
export const metadata: Metadata = {title:"Owner dashboard",robots:{index:false,follow:false}};
export default function Page() { return <Dashboard />; }
