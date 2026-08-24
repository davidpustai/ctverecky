import type {
    ExpressionSpecification,
    FillLayerSpecification,
    LineLayerSpecification,
} from "maplibre-gl";

export type FeatureStyle = {
    fill: string;
    fillOpacity: number;
    outline: string;
    outlineOpacity: number;
    weight: number;
};

const DEFAULT_STYLE: FeatureStyle = {
    fill: "#2563eb",
    fillOpacity: 0.1,
    outline: "#2563eb",
    outlineOpacity: 1,
    weight: 1,
};

export const FEATURE_STYLES: Record<string, FeatureStyle> = {
    "squadrats-outline": {
        fill: "#2563eb",
        fillOpacity: 0,
        outline: "#1e3a8a",
        outlineOpacity: 0.5,
        weight: 2,
    },
    squadrats: {
        fill: "#2563eb",
        fillOpacity: 0.2,
        outline: "#1e3a8a",
        outlineOpacity: 1,
        weight: 1,
    },
    squadratinhos: {
        fill: "#f97316",
        fillOpacity: 0.2,
        outline: "#ea580c",
        outlineOpacity: 0.8,
        weight: 1,
    },
    ubersquadrat: {
        fill: "#dc2626",
        fillOpacity: 0,
        outline: "#16a34a",
        outlineOpacity: 1,
        weight: 3,
    },
    ubersquadratinho: {
        fill: "#f87171",
        fillOpacity: 0,
        outline: "#dc2626",
        outlineOpacity: 1,
        weight: 3,
    },
    yard: {
        fill: "#16a34a",
        fillOpacity: 0,
        outline: "#14532d",
        outlineOpacity: 0,
        weight: 1,
    },
    yardinho: {
        fill: "#4ade80",
        fillOpacity: 0,
        outline: "#16a34a",
        outlineOpacity: 0,
        weight: 1,
    },
    backyards: {
        fill: "#9333ea",
        fillOpacity: 0,
        outline: "#581c87",
        outlineOpacity: 0,
        weight: 1,
    },
    backyardinhos: {
        fill: "#c084fc",
        fillOpacity: 0,
        outline: "#9333ea",
        outlineOpacity: 0,
        weight: 1,
    },
};

/**
 * Compiles FEATURE_STYLES into a MapLibre `match` expression keyed off the
 * feature's `name` property, falling back to DEFAULT_STYLE.
 */
function matchOn(
    pick: (style: FeatureStyle) => string | number,
): ExpressionSpecification {
    return [
        "match",
        ["get", "name"],
        ...Object.entries(FEATURE_STYLES).flatMap(([name, style]) => [
            name,
            pick(style),
        ]),
        pick(DEFAULT_STYLE),
    ] as unknown as ExpressionSpecification;
}

export function fillPaint(): FillLayerSpecification["paint"] {
    return {
        "fill-color": matchOn((s) => s.fill),
        "fill-opacity": matchOn((s) => s.fillOpacity),
    };
}

export function linePaint(): LineLayerSpecification["paint"] {
    return {
        "line-color": matchOn((s) => s.outline),
        "line-opacity": matchOn((s) => s.outlineOpacity),
        "line-width": matchOn((s) => s.weight),
    };
}
