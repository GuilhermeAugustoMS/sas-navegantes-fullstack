import { useEffect, useState } from "react";

const KEY = "sas-navegantes:usuario";

/**
 * Placeholder até a Fase 2 (autenticação) existir de verdade: o "usuário
 * atual" é só um nome guardado no navegador, enviado no header x-usuario
 * para a auditoria do backend saber quem fez cada alteração.
 */
export function useUsuario(): [string, (v: string) => void] {
  const [usuario, setUsuarioState] = useState<string>(() => localStorage.getItem(KEY) ?? "sistema");

  useEffect(() => {
    localStorage.setItem(KEY, usuario);
  }, [usuario]);

  const setUsuario = (v: string) => setUsuarioState(v.trim().length > 0 ? v : "sistema");

  return [usuario, setUsuario];
}
