import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import ServiceDesk from "./service-desk";
import AuthPortal from "./auth-portal";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  if (user) return <ServiceDesk />;
  return <AuthPortal signInPath={chatGPTSignInPath("/")}/>;
}
