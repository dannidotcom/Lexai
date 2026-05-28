import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { apiError, authApi } from "@/features/auth/api";

const schema = z.object({
  full_name: z.string().min(2).optional().or(z.literal("")),
  email: z.string().email(),
  password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/),
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, { path: ["confirm_password"], message: "Passwords must match" });
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { full_name: "", email: "", password: "", confirm_password: "" } });

  async function onSubmit(values: FormValues) {
    try {
      await authApi.post("/auth/register", values);
      toast.success("Compte créé. Vérifiez votre email.");
      navigate("/login");
    } catch (error) {
      toast.error(apiError(error));
    }
  }

  return (
    <AuthShell title="Créer un compte sécurisé" subtitle="Inscription contrôlée avec mot de passe fort, vérification email et rattachement à une session appareil.">
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <h2 className="text-2xl font-semibold text-slate-950">Register</h2>
        <Input className="border-sky-100 bg-white text-slate-950" placeholder="Nom complet" {...form.register("full_name")} />
        <Input className="border-sky-100 bg-white text-slate-950" type="email" placeholder="Email" autoComplete="email" {...form.register("email")} />
        <Input className="border-sky-100 bg-white text-slate-950" type="password" placeholder="Mot de passe fort" autoComplete="new-password" {...form.register("password")} />
        <Input className="border-sky-100 bg-white text-slate-950" type="password" placeholder="Confirmer le mot de passe" autoComplete="new-password" {...form.register("confirm_password")} />
        <Button className="w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Création..." : "Créer le compte"}</Button>
        <Link className="block text-sm font-medium text-sky-700" to="/login">Déjà un compte</Link>
      </form>
    </AuthShell>
  );
}
