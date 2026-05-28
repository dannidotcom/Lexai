import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { apiError, authApi } from "@/features/auth/api";

const schema = z.object({ email: z.string().email() });

export default function ForgotPasswordPage() {
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: "" } });
  async function onSubmit(values: z.infer<typeof schema>) {
    try {
      await authApi.post("/auth/forgot-password", values);
      toast.success("Instructions envoyées si le compte existe");
    } catch (error) {
      toast.error(apiError(error));
    }
  }
  return (
    <AuthShell title="Réinitialisation du mot de passe" subtitle="Un lien à usage unique et durée limitée sera envoyé si le compte existe.">
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <h2 className="text-2xl font-semibold text-slate-950">Forgot Password</h2>
        <Input className="border-sky-100 bg-white text-slate-950" type="email" placeholder="Email" {...form.register("email")} />
        <Button className="w-full" disabled={form.formState.isSubmitting}>Envoyer</Button>
        <Link className="block text-sm font-medium text-sky-700" to="/login">Retour login</Link>
      </form>
    </AuthShell>
  );
}
