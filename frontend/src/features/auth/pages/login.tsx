import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { apiError, authApi, TokenResponse } from "@/features/auth/api";
import { useAuthStore } from "@/stores/auth-store";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  async function onSubmit(values: FormValues) {
    try {
      const { data } = await authApi.post<TokenResponse>("/auth/login", values);
      setSession(data.user, data.access_token);
      toast.success("Session ouverte");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(apiError(error));
    }
  }

  return (
    <AuthShell title="Connexion sécurisée" subtitle="Accédez à votre espace professionnel avec contrôle de session, journalisation sécurité et vérification des droits.">
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <h2 className="text-2xl font-semibold text-slate-950">Login</h2>
        <label className="block space-y-2 text-sm font-medium text-slate-700">
          Email
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-sky-500" />
            <Input className="border-sky-100 bg-white pl-9 text-slate-950" type="email" autoComplete="email" {...form.register("email")} />
          </div>
        </label>
        <label className="block space-y-2 text-sm font-medium text-slate-700">
          Password
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-sky-500" />
            <Input className="border-sky-100 bg-white pl-9 text-slate-950" type="password" autoComplete="current-password" {...form.register("password")} />
          </div>
        </label>
        <Button className="w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Connexion..." : "Se connecter"}</Button>
        <div className="flex justify-between text-sm font-medium text-sky-700">
          <Link to="/forgot-password">Mot de passe oublié</Link>
          <Link to="/register">Créer un compte</Link>
        </div>
      </form>
    </AuthShell>
  );
}
