import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In Page",
  description: "Sign in to your MediGuard EHR account",
};

export default function SignIn() {
  return <SignInForm />;
}
