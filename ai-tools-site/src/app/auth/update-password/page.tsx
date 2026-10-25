import AuthPage from "@/components/auth-screen";
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <AuthPage mode="update-password" searchParams={searchParams} />;
}
