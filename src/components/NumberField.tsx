import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

// Client video 2026-09-25: line-item price boxes always showed a "0" you had to delete first ("it looks
// wonky"). Shows an empty box (with a placeholder) for 0 and keeps the typed text as-is while editing
// (so "0." / "1.50" type naturally); the number handed back is still 0 when empty, same as before.
export default function NumberField({
  value, onValueChange, placeholder = "0.00", ...rest
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number | null | undefined;
  onValueChange: (n: number) => void;
}) {
  const show = (n: number | null | undefined) => (n ? String(n) : "");
  const [text, setText] = useState(show(value));
  useEffect(() => {
    // Only resync when the number changed from outside (e.g. picking an inventory item fills the price).
    setText((cur) => ((parseFloat(cur) || 0) === (value ?? 0) ? cur : show(value)));
  }, [value]);
  return (
    <Input
      {...rest}
      type="number"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={(e) => { setText(e.target.value); onValueChange(parseFloat(e.target.value) || 0); }}
    />
  );
}
