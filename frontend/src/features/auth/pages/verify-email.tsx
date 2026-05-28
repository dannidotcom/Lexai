import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { apiError, authApi } from "@/features/auth/api";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("Vérification en cours...");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("Token manquant.");
      return;
    }
    authApi.post("/auth/verify-email", { token }).then(() => setStatus("Email vérifié.")).catch((error) => setStatus(apiError(error)));
  }, [params]);

  return (
    <AuthShell title="Vérification de l’adresse email" subtitle="Activez le compte avec le jeton de confirmation reçu par email.">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-950">Verify Email</h2>
        <p className="text-slate-600">{status}</p>
        <Button asChild className="w-full"><Link to="/login">Continuer</Link></Button>
      </div>
    </AuthShell>
  );
}
