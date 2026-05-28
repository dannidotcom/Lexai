import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { apiError, authApi } from "@/features/auth/api";

const schema = z.object({
  token: z.string().min(32),
  password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/),
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, { path: ["confirm_password"], message: "Passwords must match" });

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { token: params.get("token") ?? "", password: "", confirm_password: "" },
  });
  async function onSubmit(values: z.infer<typeof schema>) {
    try {
      await authApi.post("/auth/reset-password", values);
      toast.success("Mot de passe réinitialisé");
      navigate("/login");
    } catch (error) {
      toast.error(apiError(error));
    }
  }
  return (
    <AuthShell title="Définir un nouveau mot de passe" subtitle="Après validation, toutes les sessions existantes seront révoquées automatiquement.">
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <h2 className="text-2xl font-semibold text-slate-950">Reset Password</h2>
        <Input className="border-sky-100 bg-white text-slate-950" placeholder="Token" {...form.register("token")} />
        <Input className="border-sky-100 bg-white text-slate-950" type="password" placeholder="Nouveau mot de passe" {...form.register("password")} />
        <Input className="border-sky-100 bg-white text-slate-950" type="password" placeholder="Confirmer" {...form.register("confirm_password")} />
        <Button className="w-full" disabled={form.formState.isSubmitting}>Réinitialiser</Button>
      </form>
    </AuthShell>
  );
}
