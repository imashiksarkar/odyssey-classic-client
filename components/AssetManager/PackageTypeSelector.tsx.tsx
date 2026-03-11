export function PackageTypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const options = [
    {
      label: "Linux",
      description: "Self-packaged Linux build",
      value: true,
      icon: "🐧",
    },
    {
      label: "Multiplayer",
      description: "Builder-compiled multiplayer",
      value: false,
      icon: "🎮",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`flex flex-col gap-1 px-4 py-3 rounded-lg border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed
              ${
                selected
                  ? "border-gray-900 bg-gray-50 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
          >
            <div className="flex items-center gap-2">
              <span>{opt.icon}</span>
              <span
                className={`text-sm font-semibold ${selected ? "text-gray-900" : "text-gray-600"}`}
              >
                {opt.label}
              </span>
              {selected && (
                <span className="ml-auto w-4 h-4 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400">{opt.description}</p>
          </button>
        );
      })}
    </div>
  );
}
