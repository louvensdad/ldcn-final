import { T } from "../../design/tokens";
import type { DecisionEventDto } from "../../api/runtime.client";

/**
 * Generic renderer for GeneratorDecisionEvent[] (already sorted/filtered by the caller). Payload
 * is rendered as raw key:value pairs — no per-eventType structure assumed, same "no
 * chain-of-thought, no reinterpretation" spirit applied to the Architecture decision cards.
 */
export function EventTimeline({ events }: { events: DecisionEventDto[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {events.map((event) => (
        <div key={event.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: Object.keys(event.payload).length ? 6 : 0 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{event.eventType}</span>
            <span style={{ fontSize: 11, color: T.textMuted }}>{new Date(event.createdAt).toLocaleString()}</span>
          </div>
          {Object.keys(event.payload).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(event.payload).map(([key, value]) => (
                <span key={key} style={{ fontSize: 11.5, color: T.textMuted }}>
                  {key}: {String(value)}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
