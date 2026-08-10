import { format } from "date-fns";

// Nigerian convention: day/month/year.
export function formatDate(date) {
  if (!date) return "-";
  return format(new Date(date), "dd/MM/yyyy");
}

export function formatDateTime(date) {
  if (!date) return "-";
  return format(new Date(date), "dd/MM/yyyy, h:mm a");
}
