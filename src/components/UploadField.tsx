import { useId, useState, type InputHTMLAttributes } from "react";
import { Upload } from "lucide-react";

/** Visible native picker: keyboard accessible and usable on mobile without drag-and-drop. */
export function UploadField({
  onChange,
  className: _className,
  helpText,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { helpText?: string }) {
  const id = useId();
  const [selected, setSelected] = useState("");
  const images = props.accept?.includes("image");
  return (
    <div className="my-2 w-full min-w-0 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/60 p-4 text-left text-slate-800 transition-colors focus-within:border-blue-700 focus-within:ring-2 focus-within:ring-blue-200 hover:border-blue-500">
      <div className="flex items-start gap-3">
        <Upload aria-hidden="true" size={24} className="mt-1 shrink-0 text-blue-700" />
        <div className="min-w-0 flex-1">
          <label
            htmlFor={props.id ?? id}
            className="block cursor-pointer text-sm font-semibold normal-case tracking-normal"
          >
            {props["aria-label"] ?? "Upload file"}
          </label>
          <p
            id={`${id}-help`}
            className="mt-1 text-xs font-normal normal-case tracking-normal text-slate-600"
          >
            {helpText ??
              (images
                ? "JPG, PNG or WebP · up to 15 MB"
                : props.accept?.includes("csv")
                  ? "CSV file · fill the downloaded template first"
                  : props.accept?.includes(".xlsx")
                    ? "Excel file · fill the downloaded template first"
                    : props.accept?.includes("json")
                      ? "JSON file · choose your saved layout"
                      : "Choose a supported file from your device")}
          </p>
          <input
            {...props}
            id={props.id ?? id}
            type="file"
            aria-describedby={`${id}-help ${id}-status`}
            className="mt-3 block min-h-11 w-full min-w-0 cursor-pointer text-[0px] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-700 file:px-4 file:py-3 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setSelected(file.name);
              onChange?.(e);
            }}
          />
          <p
            id={`${id}-status`}
            role="status"
            className="mt-2 break-words text-xs font-normal normal-case tracking-normal text-slate-600"
          >
            {selected
              ? `Selected: ${selected}. Check the preview or any error below.`
              : "Choose a file from your device. You can replace it later."}
          </p>
        </div>
      </div>
    </div>
  );
}
