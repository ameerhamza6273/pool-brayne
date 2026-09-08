import { api } from "@/lib/apiClient";

export type FormFieldType = "text" | "textarea" | "number" | "select" | "checkbox" | "yesno" | "photo";

export type FormField = {
  id: string;
  label: string;
  type: FormFieldType;
  options?: string[];
  helpText?: string;
};

export type FormTemplate = {
  id: string;
  name: string;
  description: string | null;
  applies_to: string | null;
  customer_visible: boolean;
  fields: FormField[];
  is_builtin: boolean;
  created_at: string;
};

export const formTemplatesApi = {
  list: () => api.get<FormTemplate[]>("/api/form-templates"),

  detail: (id: string) => api.get<FormTemplate>(`/api/form-templates/${id}`),

  create: (data: { name: string; description: string | null; appliesTo: string | null; customerVisible: boolean; fields: FormField[] }) =>
    api.post<FormTemplate>("/api/form-templates", data),

  update: (id: string, data: { name: string; description: string | null; appliesTo: string | null; customerVisible: boolean; fields: FormField[] }) =>
    api.patch<FormTemplate>(`/api/form-templates/${id}`, data),

  remove: (id: string) => api.del(`/api/form-templates/${id}`),
};
