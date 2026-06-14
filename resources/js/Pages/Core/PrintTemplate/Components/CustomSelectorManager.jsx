import { PlusIcon, XIcon } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import Select from "@/Components/Select";
import { cn } from "@/lib/utils";

export default function CustomSelectorManager({
  selectors,
  selectedState,
  states,
  targets,
  setState,
  addSelector,
  removeSelector,
}) {
  const { t } = useLaravelReactI18n();

  const addNewSelector = () => {
    const next = selectors.length + 1;
    addSelector({ name: `new-${next}`, label: `New ${next}` });
  };

  const targetStr = targets.join(", ");

  return (
    <div className="gjs-custom-selector-manager p-2 flex flex-col gap-2 text-left">
      <div className="flex items-center">
        <div className="grow">{t("core.printTemplate.editor.selectors")}</div>
        <Select
          value={selectedState}
          onChange={(ev) => setState(ev.target.value)}
          options={states.map((state) => ({
            value: state.id,
            label: state.getName(),
          }))}
        />
      </div>
      <div
        className={cn(
          "flex items-center gap-2 flex-wrap p-2 bg-black/30 border rounded min-h-[45px]",
        )}
      >
        {targetStr ? (
          <button
            type="button"
            onClick={addNewSelector}
            className={cn("border rounded px-2 py-1")}
          >
            <PlusIcon />
          </button>
        ) : (
          <div className="opacity-70">
            {t("core.printTemplate.editor.select_a_component")}
          </div>
        )}
        {selectors.map((selector) => (
          <div
            key={selector.toString()}
            className="px-2 py-1 flex items-center gap-1 whitespace-nowrap bg-sky-500 rounded"
          >
            <div>{selector.getLabel()}</div>
            <button type="button" onClick={() => removeSelector(selector)}>
              <XIcon />
            </button>
          </div>
        ))}
      </div>
      <div>
        {t("core.printTemplate.editor.selected")}{" "}
        <span className="opacity-70">
          {targetStr || t("core.printTemplate.editor.none")}
        </span>
      </div>
    </div>
  );
}
