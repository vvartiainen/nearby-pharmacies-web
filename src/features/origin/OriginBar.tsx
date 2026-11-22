import { interpolate, type Messages } from "../../shared/i18n/messages";
import { OriginControls } from "./OriginControls";
import type { originCoverage } from "./coverage";
import { defaultOrigin, type Origin } from "./origin";
import type { useOriginControls } from "./useOriginControls";

interface OriginBarProps {
  readonly controls: ReturnType<typeof useOriginControls>;
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
  const nearbyAddress =
    origin.kind === "device" || origin.kind === "pin" ? controls.originAddress : undefined;
  const originFieldTitle = nearbyAddress
    ? interpolate(messages.nearAddress, { address: nearbyAddress.street })
    : origin.kind === "search"
      ? origin.title
      : originLabel;
  const originFieldContext =
    nearbyAddress?.city ?? (origin.kind === "search" ? origin.context : "");
  const originFieldLabel = nearbyAddress
    ? [originFieldTitle, originFieldContext].filter(Boolean).join(", ")
    : originLabel;

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
        originLabel={originFieldLabel}
        originTitle={originFieldTitle}
        originContext={originFieldContext}
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
