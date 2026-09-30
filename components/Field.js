/** Labelled text input with the app's input styling. */
export default function Field({ label, name, hint, className = "", ...rest }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      <input id={name} name={name} className="input" {...rest} />
      {hint && <span className="mt-1.5 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}
