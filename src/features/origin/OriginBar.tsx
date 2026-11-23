import { interpolate, type Messages } from "../../shared/i18n/messages";
import { OriginControls } from "./OriginControls";
import type { originCoverage } from "./coverage";
import { defaultOrigin, type Origin } from "./origin";
import type { OriginControlsApi } from "./useOriginControls";

interface OriginBarProps {
  readonly controls: OriginControlsApi;
  readonly coverage: ReturnType<typeof originCoverage>;
  readonly messages: Messages;
  readonly origin: Origin;
  readonly originLabel: string;
  readonly count: string;
}

export function OriginBar({
  controls,
  coverage,
  messages,
  origin,
  originLabel,
  count,
}: OriginBarProps) {
  return (
    <header className="origin-bar">
      <div>
        <h1 className="app-title">{messages.title}</h1>
        <p className="app-scope">{interpolate(messages.scopeAndCount, { count })}</p>
      </div>
      <OriginControls
        controls={controls}
        messages={messages}
        origin={origin}
        originLabel={originLabel}
        originTitle={origin.kind === "search" ? origin.title : originLabel}
        originContext={origin.kind === "search" ? origin.context : ""}
      />
      {coverage === "outside" ? (
        <div className="origin-coverage">
          <output>{messages.outsideFinland}</output>
          <button
            type="button"
            className="origin-action"
            onClick={() => controls.changeOrigin(defaultOrigin)}
          >
            {messages.returnToHelsinki}
          </button>
        </div>
      ) : coverage === "border" ? (
        <output className="origin-coverage">{messages.borderNotice}</output>
      ) : null}
    </header>
  );
}
