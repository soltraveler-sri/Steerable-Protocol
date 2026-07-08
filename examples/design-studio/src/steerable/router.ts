import { palettePresets } from "../data/designData";
import type { DesignState, FontPairing, PaletteToken } from "../types";
import {
  designStudioSurfaceIds,
  type DesignStudioSurfaceId,
} from "./designStudioCapabilities";
import type { CapabilityRegistry, SurfaceId } from "./registry";

export type IntentRouteClass =
  | "answer"
  | "single action"
  | "action chain"
  | "workflow needing the loop"
  | "clarification"
  | "refusal/handoff";

export interface IntentRouterRequest {
  intent: string;
  sourceSurfaceId: SurfaceId;
  registry: CapabilityRegistry;
  state: DesignState;
}

export interface ResolvedIntentStep {
  actionId: string;
  params: unknown;
  targetSurfaceId: SurfaceId;
  patternId: string;
}

interface BaseRoute {
  sourceSurfaceId: SurfaceId;
  intent: string;
  routeClass: IntentRouteClass;
  escalationReason?: string;
}

export interface ActionIntentRoute extends BaseRoute {
  routeClass: "single action" | "action chain";
  steps: ResolvedIntentStep[];
}

export interface AnswerIntentRoute extends BaseRoute {
  routeClass: "answer";
  readToolIds: string[];
  message: string;
}

export interface ClarificationIntentRoute extends BaseRoute {
  routeClass: "clarification";
  missing: string[];
  message: string;
}

export interface RefusalIntentRoute extends BaseRoute {
  routeClass: "refusal/handoff";
  message: string;
}

export type IntentRoute =
  | ActionIntentRoute
  | AnswerIntentRoute
  | ClarificationIntentRoute
  | RefusalIntentRoute;

export interface IntentRouterProvider {
  classify: (request: IntentRouterRequest) => IntentRoute | Promise<IntentRoute>;
}

type ExtractorResult =
  | { status: "matched"; params: unknown }
  | { status: "missing"; missing: string[] }
  | { status: "no-match" };

type ExtractorName =
  | "paletteColor"
  | "palettePreset"
  | "fontPairing"
  | "sectionVisibility"
  | "sectionMove"
  | "surface"
  | "posture"
  | "template"
  | "empty";

interface ScriptedActionPattern {
  id: string;
  actionId: string;
  targetSurfaceId: DesignStudioSurfaceId | "source";
  extractor: ExtractorName;
  allTerms?: string[];
  anyTerms?: string[];
}

interface ScriptedAnswerPattern {
  id: string;
  readToolIds: string[];
  anyTerms: string[];
  answer: (state: DesignState) => string;
}

interface ScriptedEscalationPattern {
  id: string;
  anyTerms: string[];
  message: string;
  escalationReason: string;
  missing?: string[];
}

const colorNames: Record<string, string> = {
  "forest green": "#228B22",
  orange: "#FF6600",
  teal: "#0F766E",
  blue: "#2563EB",
  black: "#111827",
  white: "#FFFFFF",
};

const paletteTokenAliases: Record<PaletteToken, string[]> = {
  background: ["background", "page background"],
  surface: ["surface", "card"],
  text: ["text", "copy"],
  muted: ["muted", "secondary text"],
  accent: ["accent", "brand color", "button color"],
  accentContrast: ["accent text", "accent contrast"],
  border: ["border", "stroke"],
};

const fontPairingAliases: Record<FontPairing, string[]> = {
  atelier: ["atelier"],
  editorial: ["editorial"],
  modern: ["modern"],
};

const actionPatterns: ScriptedActionPattern[] = [
  {
    id: "surface.navigate_surface.named",
    actionId: "surface.navigate_surface",
    targetSurfaceId: "source",
    extractor: "surface",
    anyTerms: ["open", "go to", "navigate", "editor", "templates", "settings"],
  },
  {
    id: "palette.set_color.accent",
    actionId: "palette.set_color",
    targetSurfaceId: designStudioSurfaceIds.editor,
    extractor: "paletteColor",
    anyTerms: ["accent", "background", "surface", "text", "muted", "border"],
  },
  {
    id: "policy.set_posture.named",
    actionId: "policy.set_posture",
    targetSurfaceId: designStudioSurfaceIds.settings,
    extractor: "posture",
    anyTerms: ["posture", "cautious", "business", "creative"],
  },
  {
    id: "palette.apply_preset.named",
    actionId: "palette.apply_preset",
    targetSurfaceId: designStudioSurfaceIds.editor,
    extractor: "palettePreset",
    anyTerms: ["switch", "palette", "preset", "citrus", "mono", "studio"],
  },
  {
    id: "typography.set_pairing.named",
    actionId: "typography.set_pairing",
    targetSurfaceId: designStudioSurfaceIds.editor,
    extractor: "fontPairing",
    anyTerms: ["font", "pairing", "typography", "modern", "atelier", "editorial"],
  },
  {
    id: "section.set_visibility.named",
    actionId: "section.set_visibility",
    targetSurfaceId: designStudioSurfaceIds.editor,
    extractor: "sectionVisibility",
    anyTerms: ["hide", "show", "reveal", "pricing", "features", "footer", "social proof"],
  },
  {
    id: "section.move_section.named",
    actionId: "section.move_section",
    targetSurfaceId: designStudioSurfaceIds.editor,
    extractor: "sectionMove",
    allTerms: ["move"],
    anyTerms: ["up", "down", "above", "below", "social proof", "pricing", "features", "footer"],
  },
  {
    id: "template.apply_template.named",
    actionId: "template.apply_template",
    targetSurfaceId: designStudioSurfaceIds.templates,
    extractor: "template",
    anyTerms: ["template", "starting direction", "saas launch", "botanical", "atelier"],
  },
  {
    id: "share.copy_link.empty",
    actionId: "share.copy_link",
    targetSurfaceId: designStudioSurfaceIds.settings,
    extractor: "empty",
    allTerms: ["copy"],
    anyTerms: ["share link"],
  },
  {
    id: "project.export_project.empty",
    actionId: "project.export_project",
    targetSurfaceId: designStudioSurfaceIds.editor,
    extractor: "empty",
    anyTerms: ["export", "mock page"],
  },
  {
    id: "project.reset_project.empty",
    actionId: "project.reset_project",
    targetSurfaceId: designStudioSurfaceIds.settings,
    extractor: "empty",
    anyTerms: ["reset"],
  },
];

const answerPatterns: ScriptedAnswerPattern[] = [
  {
    id: "answer.templates.available",
    readToolIds: ["template.list_available"],
    anyTerms: ["what templates", "which templates", "available templates"],
    answer: (state) =>
      `Available templates: ${state.templates.map((template) => template.name).join(", ")}.`,
  },
  {
    id: "answer.quota.remaining",
    readToolIds: ["quota.get_status"],
    anyTerms: ["exports left", "export quota", "quota left"],
    answer: (state) =>
      `${state.exportQuota.remaining} of ${state.exportQuota.limit} mock exports remain.`,
  },
];

const clarificationPatterns: ScriptedEscalationPattern[] = [
  {
    id: "clarify.vague.style",
    anyTerms: ["make it pop", "make this better", "improve this"],
    message: "Which part should change: palette, typography, section visibility, or template?",
    escalationReason: "missing_target_and_parameter",
    missing: ["target object", "parameter value"],
  },
];

const refusalPatterns: ScriptedEscalationPattern[] = [
  {
    id: "refuse.external.marketing",
    anyTerms: ["mailchimp", "email campaign", "publish live", "production", "buy ads"],
    message: "That is outside the Design Studio declarations, so I cannot automate it here.",
    escalationReason: "outside_declared_capabilities",
  },
];

const extractors: Record<
  ExtractorName,
  (text: string, request: IntentRouterRequest) => ExtractorResult
> = {
  paletteColor: extractPaletteColor,
  palettePreset: extractPalettePreset,
  fontPairing: extractFontPairing,
  sectionVisibility: extractSectionVisibility,
  sectionMove: extractSectionMove,
  surface: extractSurface,
  posture: extractPosture,
  template: extractTemplate,
  empty: () => ({ status: "matched", params: {} }),
};

export class ScriptedIntentRouter implements IntentRouterProvider {
  classify(request: IntentRouterRequest): IntentRoute {
    const intent = request.intent.trim();
    const normalized = normalizeText(intent);

    if (!normalized) {
      return clarificationRoute(request, ["intent"], "Tell me what to change.");
    }

    const refusal = matchEscalation(normalized, refusalPatterns);

    if (refusal) {
      return {
        routeClass: "refusal/handoff",
        sourceSurfaceId: request.sourceSurfaceId,
        intent,
        message: refusal.message,
        escalationReason: refusal.escalationReason,
      };
    }

    const answer = answerPatterns.find((pattern) =>
      pattern.anyTerms.some((term) => includesTerm(normalized, term)),
    );

    if (answer) {
      const missingReadTool = answer.readToolIds.find((id) => !request.registry.getReadTool(id));

      if (missingReadTool) {
        return refusalRoute(
          request,
          `Read tool "${missingReadTool}" is not registered.`,
          "read_tool_unavailable",
        );
      }

      return {
        routeClass: "answer",
        sourceSurfaceId: request.sourceSurfaceId,
        intent,
        readToolIds: [...answer.readToolIds],
        message: answer.answer(request.state),
      };
    }

    const clarification = matchEscalation(normalized, clarificationPatterns);

    if (clarification) {
      return {
        routeClass: "clarification",
        sourceSurfaceId: request.sourceSurfaceId,
        intent,
        missing: clarification.missing ?? ["required parameter"],
        message: clarification.message,
        escalationReason: clarification.escalationReason,
      };
    }

    const segmentTexts = splitIntoSegments(intent);
    const steps: ResolvedIntentStep[] = [];

    for (const segment of segmentTexts) {
      const segmentResult = classifyActionSegment(segment, request);

      if (segmentResult.routeClass === "single action") {
        steps.push(segmentResult.steps[0]);
        continue;
      }

      return segmentResult;
    }

    if (steps.length === 0) {
      return refusalRoute(
        request,
        "I could not map that to a declared Design Studio capability.",
        "no_scripted_pattern_matched",
      );
    }

    const expandedSteps = withNavigationSteps(steps, request.sourceSurfaceId);

    return {
      routeClass: expandedSteps.length === 1 ? "single action" : "action chain",
      sourceSurfaceId: request.sourceSurfaceId,
      intent,
      steps: expandedSteps,
    };
  }
}

function classifyActionSegment(
  segment: string,
  request: IntentRouterRequest,
): ActionIntentRoute | ClarificationIntentRoute | RefusalIntentRoute {
  const normalized = normalizeText(segment);

  for (const pattern of actionPatterns) {
    if (!matchesPattern(normalized, pattern)) {
      continue;
    }

    const extraction = extractors[pattern.extractor](segment, request);

    if (extraction.status === "no-match") {
      continue;
    }

    if (extraction.status === "missing") {
      return clarificationRoute(request, extraction.missing, missingMessage(extraction.missing));
    }

    const action = request.registry.getAction(pattern.actionId);

    if (!action) {
      return refusalRoute(
        request,
        `Action "${pattern.actionId}" is not registered.`,
        "action_unavailable",
      );
    }

    try {
      request.registry.validateActionParams(action, extraction.params);
    } catch (error) {
      return clarificationRoute(
        request,
        ["valid parameters"],
        error instanceof Error ? error.message : String(error),
      );
    }

    const targetSurfaceId =
      pattern.targetSurfaceId === "source"
        ? request.sourceSurfaceId
        : pattern.targetSurfaceId;

    if (!request.registry.isCapabilityOnSurface(pattern.actionId, targetSurfaceId)) {
      return refusalRoute(
        request,
        `Action "${pattern.actionId}" is not declared on "${targetSurfaceId}".`,
        "surface_capability_unavailable",
      );
    }

    return {
      routeClass: "single action",
      sourceSurfaceId: request.sourceSurfaceId,
      intent: request.intent.trim(),
      steps: [
        {
          actionId: pattern.actionId,
          params: extraction.params,
          targetSurfaceId: preferredSurfaceForAction(
            request.registry,
            pattern.actionId,
            request.sourceSurfaceId,
            targetSurfaceId,
          ),
          patternId: pattern.id,
        },
      ],
    };
  }

  return refusalRoute(
    request,
    "I could not map that to a declared Design Studio capability.",
    "no_scripted_pattern_matched",
  );
}

function extractPaletteColor(text: string): ExtractorResult {
  const normalized = normalizeText(text);
  const token = findPaletteToken(normalized);
  const hex = findHex(text) ?? findColorName(normalized);

  if (!token && !hex) {
    return { status: "no-match" };
  }

  const missing = [
    ...(token ? [] : ["palette token"]),
    ...(hex ? [] : ["hex color or supported color name"]),
  ];

  if (missing.length > 0) {
    return { status: "missing", missing };
  }

  return {
    status: "matched",
    params: { token, hex },
  };
}

function extractPalettePreset(text: string): ExtractorResult {
  const normalized = normalizeText(text);
  const preset = palettePresets.find((item) =>
    [item.id, item.name].some((value) => includesTerm(normalized, value)),
  );

  if (!preset) {
    return { status: "missing", missing: ["palette preset"] };
  }

  return {
    status: "matched",
    params: { presetId: preset.id },
  };
}

function extractFontPairing(text: string): ExtractorResult {
  const normalized = normalizeText(text);
  const pairing = findAlias(fontPairingAliases, normalized);

  if (!pairing) {
    return { status: "missing", missing: ["font pairing"] };
  }

  return {
    status: "matched",
    params: { pairing },
  };
}

function extractSectionVisibility(
  text: string,
  request: IntentRouterRequest,
): ExtractorResult {
  const normalized = normalizeText(text);
  const section = findSection(request.state, normalized);
  const hasHide = includesTerm(normalized, "hide") || includesTerm(normalized, "remove");
  const hasShow =
    includesTerm(normalized, "show") ||
    includesTerm(normalized, "reveal") ||
    includesTerm(normalized, "unhide");

  if (!hasHide && !hasShow) {
    return { status: "no-match" };
  }

  const missing = [
    ...(section ? [] : ["section"]),
    ...(hasHide || hasShow ? [] : ["visibility direction"]),
  ];

  if (missing.length > 0) {
    return { status: "missing", missing };
  }

  return {
    status: "matched",
    params: { sectionId: section, visible: hasShow },
  };
}

function extractSectionMove(text: string, request: IntentRouterRequest): ExtractorResult {
  const normalized = normalizeText(text);
  const section = findSection(request.state, normalized);
  const direction =
    includesTerm(normalized, "up") ||
    includesTerm(normalized, "above") ||
    includesTerm(normalized, "earlier")
      ? "up"
      : includesTerm(normalized, "down") ||
          includesTerm(normalized, "below") ||
          includesTerm(normalized, "later")
        ? "down"
        : undefined;

  if (!section && !direction) {
    return { status: "no-match" };
  }

  const missing = [
    ...(section ? [] : ["section"]),
    ...(direction ? [] : ["move direction"]),
  ];

  if (missing.length > 0) {
    return { status: "missing", missing };
  }

  return {
    status: "matched",
    params: { sectionId: section, direction },
  };
}

function extractSurface(text: string): ExtractorResult {
  const normalized = normalizeText(text);
  const surface = Object.values(designStudioSurfaceIds).find((surfaceId) =>
    includesTerm(normalized, surfaceId),
  );

  if (!surface) {
    return { status: "missing", missing: ["surface"] };
  }

  return {
    status: "matched",
    params: { surfaceId: surface },
  };
}

function extractPosture(text: string): ExtractorResult {
  const normalized = normalizeText(text);

  if (
    includesTerm(normalized, "cautious") ||
    includesTerm(normalized, "business") ||
    includesTerm(normalized, "business app")
  ) {
    return {
      status: "matched",
      params: { posture: "business-app" },
    };
  }

  if (
    includesTerm(normalized, "creative") ||
    includesTerm(normalized, "creative tool")
  ) {
    return {
      status: "matched",
      params: { posture: "creative-tool" },
    };
  }

  return { status: "missing", missing: ["posture"] };
}

function extractTemplate(text: string, request: IntentRouterRequest): ExtractorResult {
  const normalized = normalizeText(text);
  const template = request.state.templates.find((item) =>
    [item.id, item.name].some((value) => fuzzyIncludes(normalized, normalizeText(value))),
  );

  if (!template) {
    return { status: "missing", missing: ["template name"] };
  }

  return {
    status: "matched",
    params: { templateId: template.id },
  };
}

function withNavigationSteps(
  steps: ResolvedIntentStep[],
  sourceSurfaceId: SurfaceId,
): ResolvedIntentStep[] {
  let currentSurfaceId = sourceSurfaceId;
  const expanded: ResolvedIntentStep[] = [];

  steps.forEach((step) => {
    if (step.targetSurfaceId !== currentSurfaceId) {
      expanded.push({
        actionId: "surface.navigate_surface",
        params: { surfaceId: step.targetSurfaceId },
        targetSurfaceId: currentSurfaceId,
        patternId: `surface.navigate_surface.to_${step.targetSurfaceId}`,
      });
      currentSurfaceId = step.targetSurfaceId;
    }

    expanded.push(step);
    currentSurfaceId = surfaceAfterStep(step, currentSurfaceId);
  });

  return expanded;
}

function surfaceAfterStep(
  step: ResolvedIntentStep,
  fallbackSurfaceId: SurfaceId,
): SurfaceId {
  if (
    step.actionId === "surface.navigate_surface" &&
    step.params &&
    typeof step.params === "object" &&
    "surfaceId" in step.params &&
    typeof step.params.surfaceId === "string"
  ) {
    return step.params.surfaceId;
  }

  return step.targetSurfaceId ?? fallbackSurfaceId;
}

function splitIntoSegments(intent: string): string[] {
  return intent
    .split(/\b(?:and|then)\b/i)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function matchesPattern(normalized: string, pattern: ScriptedActionPattern): boolean {
  const allTermsMatch = (pattern.allTerms ?? []).every((term) =>
    includesTerm(normalized, term),
  );
  const anyTerms = pattern.anyTerms ?? [];
  const anyTermsMatch =
    anyTerms.length === 0 || anyTerms.some((term) => includesTerm(normalized, term));

  return allTermsMatch && anyTermsMatch;
}

function matchEscalation(
  normalized: string,
  patterns: ScriptedEscalationPattern[],
): ScriptedEscalationPattern | undefined {
  return patterns.find((pattern) =>
    pattern.anyTerms.some((term) => includesTerm(normalized, term)),
  );
}

function findHex(text: string): string | undefined {
  const match = text.match(/#[0-9a-f]{6}\b/i);

  return match?.[0].toUpperCase();
}

function findColorName(normalized: string): string | undefined {
  const names = Object.keys(colorNames).sort((left, right) => right.length - left.length);
  const name = names.find((item) => includesTerm(normalized, item));

  return name ? colorNames[name] : undefined;
}

function findPaletteToken(normalized: string): PaletteToken | undefined {
  return findAlias(paletteTokenAliases, normalized);
}

function findAlias<T extends string>(
  aliases: Record<T, string[]>,
  normalized: string,
): T | undefined {
  return (Object.keys(aliases) as T[]).find((key) =>
    aliases[key].some((alias) => includesTerm(normalized, alias)),
  );
}

function findSection(state: DesignState, normalized: string): string | undefined {
  return state.sections.find((section) =>
    [section.id, section.kind, section.kind.replace(/([A-Z])/g, " $1")]
      .map(normalizeText)
      .some((alias) => fuzzyIncludes(normalized, alias)),
  )?.id;
}

function preferredSurfaceForAction(
  registry: CapabilityRegistry,
  actionId: string,
  sourceSurfaceId: SurfaceId,
  fallbackSurfaceId: SurfaceId,
): SurfaceId {
  if (registry.isCapabilityOnSurface(actionId, sourceSurfaceId)) {
    return sourceSurfaceId;
  }

  return fallbackSurfaceId;
}

function clarificationRoute(
  request: IntentRouterRequest,
  missing: string[],
  message: string,
): ClarificationIntentRoute {
  return {
    routeClass: "clarification",
    sourceSurfaceId: request.sourceSurfaceId,
    intent: request.intent.trim(),
    missing,
    message,
    escalationReason: "missing_required_information",
  };
}

function refusalRoute(
  request: IntentRouterRequest,
  message: string,
  escalationReason: string,
): RefusalIntentRoute {
  return {
    routeClass: "refusal/handoff",
    sourceSurfaceId: request.sourceSurfaceId,
    intent: request.intent.trim(),
    message,
    escalationReason,
  };
}

function missingMessage(missing: string[]): string {
  return `I need ${missing.join(" and ")} before I can run that.`;
}

function includesTerm(normalized: string, term: string): boolean {
  return fuzzyIncludes(normalized, normalizeText(term));
}

function fuzzyIncludes(normalized: string, term: string): boolean {
  const compact = normalized.replaceAll(" ", "");
  const compactTerm = term.replaceAll(" ", "");

  return (
    normalized === term ||
    normalized.includes(term) ||
    compact.includes(compactTerm) ||
    term
      .split(" ")
      .filter(Boolean)
      .every((part) => normalized.includes(part))
  );
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/[^a-z0-9#]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
