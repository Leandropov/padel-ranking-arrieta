import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatearFechaLegible(iso) {
  const [anio, mes, dia] = iso.split('-');
  return dia + '/' + mes + '/' + anio;
}
