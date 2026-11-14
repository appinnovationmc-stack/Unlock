import SignupForm from "./SignupForm";
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; role?: string }> }) {
  return <SignupForm searchParams={await searchParams} />;
}
