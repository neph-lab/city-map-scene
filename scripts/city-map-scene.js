const MODULE_ID = "city-map-scene";
const FLAGS = {
  FEATURES: "features",
  LEVELS: "levels"
};

const TYPE_MODES = {
  ALWAYS: "always",
  HIDDEN: "hidden",
  USER: "user"
};

const DEFAULT_TYPE_TAGS = [
  { id: "streetmap", label: "Streetmap", playerMode: TYPE_MODES.ALWAYS, color: "#d7d1bb" },
  { id: "venues", label: "Venues", playerMode: TYPE_MODES.USER, color: "#c97b63" },
  { id: "entertainment", label: "Entertainment", playerMode: TYPE_MODES.USER, color: "#8fb8de" },
  { id: "gm-notes", label: "GM Notes", playerMode: TYPE_MODES.HIDDEN, color: "#9a7ad1" }
];

const SAMPLE_LEVELS = [
  { id: "street", label: "Street", visible: true, elevation: 0 },
  { id: "upper", label: "Upper Walkways", visible: true, elevation: 20 }
];

const SAMPLE_FEATURES = [
  {
    id: "market-road",
    kind: "path",
    name: "Market Road",
    description: "Main traffic through the district.",
    levels: ["street"],
    types: ["streetmap"],
    stroke: "#d7d1bb",
    width: 8,
    points: [
      { x: 500, y: 700, elevation: 0 },
      { x: 850, y: 620, elevation: 0 },
      { x: 1120, y: 760, elevation: 4 }
    ]
  },
  {
    id: "theatre",
    kind: "polygon",
    name: "The Old Theatre",
    description: "A busy landmark venue.",
    levels: ["street"],
    types: ["venues", "entertainment"],
    fill: "#8fb8de88",
    stroke: "#8fb8de",
    journalUuid: "",
    points: [
      { x: 930, y: 430, elevation: 0 },
      { x: 1120, y: 450, elevation: 0 },
      { x: 1100, y: 590, elevation: 0 },
      { x: 900, y: 570, elevation: 0 }
    ]
  },
  {
    id: "warehouse-block",
    kind: "buildingFill",
    name: "Warehouse Block",
    levels: ["street"],
    types: ["streetmap"],
    fill: "#6d806888",
    stroke: "#a7bd9d",
    buildingFill: {
      seed: 6173,
      fillPercent: 0.72,
      averageSize: 72,
      sizeVariation: 0.35,
      irregularity: 0.25,
      baseElevation: 0,
      averageTopElevation: 18,
      topElevationVariation: 8
    },
    points: [
      { x: 1210, y: 470, elevation: 0 },
      { x: 1540, y: 490, elevation: 0 },
      { x: 1500, y: 780, elevation: 0 },
      { x: 1180, y: 730, elevation: 0 }
    ]
  }
];

Hooks.once("init", () => {
  registerSettings();
  game.keybindings.register(MODULE_ID, "openManager", {
    name: "CITYMAP.Keybindings.OpenManager.Name",
    hint: "CITYMAP.Keybindings.OpenManager.Hint",
    editable: [{ key: "KeyM", modifiers: ["CONTROL", "SHIFT"] }],
    onDown: () => openManager(),
    restricted: true,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
  game.keybindings.register(MODULE_ID, "openVisibility", {
    name: "City Map Type Visibility",
    hint: "Choose which adjustable city map type tags are visible to you.",
    editable: [{ key: "KeyV", modifiers: ["CONTROL", "SHIFT"] }],
    onDown: () => {
      new CityMapVisibility().render(true);
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
});

Hooks.once("ready", () => {
  game.cityMapScene = {
    openManager,
    openVisibility: () => new CityMapVisibility().render(true),
    refresh: () => CityMapOverlay.refresh(),
    getVisibleTypes,
    regenerateBuildingFill
  };
});

Hooks.on("canvasReady", () => CityMapOverlay.refresh());
Hooks.on("canvasPan", () => CityMapOverlay.refresh());
Hooks.on("updateScene", (scene) => {
  if (scene.id === canvas?.scene?.id) CityMapOverlay.refresh();
});

Hooks.on("getSceneControlButtons", (controls) => {
  const tokenControls = Array.isArray(controls) ? controls.find((c) => c.name === "token") : controls.tokens;
  if (!tokenControls?.tools) return;

  const visibilityTool = {
    name: "city-map-scene-visibility",
    title: "City Map Type Visibility",
    icon: "fa-solid fa-eye",
    button: true,
    visible: true,
    onChange: () => new CityMapVisibility().render(true),
    onClick: () => new CityMapVisibility().render(true)
  };

  const managerTool = {
    name: "city-map-scene",
    title: "City Map Scene",
    icon: "fa-solid fa-map-location-dot",
    button: true,
    visible: game.user.isGM,
    onChange: () => openManager(),
    onClick: () => openManager()
  };

  if (Array.isArray(tokenControls.tools)) {
    tokenControls.tools.push(visibilityTool);
    if (game.user.isGM) tokenControls.tools.push(managerTool);
  } else {
    tokenControls.tools["city-map-scene-visibility"] = {
      ...visibilityTool,
      order: Object.keys(tokenControls.tools).length
    };
    tokenControls.tools["city-map-scene"] = {
      ...managerTool,
      order: Object.keys(tokenControls.tools).length,
      visible: game.user.isGM
    };
  }
});

function registerSettings() {
  game.settings.register(MODULE_ID, "typeTags", {
    name: "CITYMAP.Settings.TypeTags.Name",
    hint: "CITYMAP.Settings.TypeTags.Hint",
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_TYPE_TAGS,
    onChange: () => CityMapOverlay.refresh()
  });

  game.settings.register(MODULE_ID, "playerVisibleTypes", {
    name: "CITYMAP.Settings.PlayerVisibility.Name",
    hint: "CITYMAP.Settings.PlayerVisibility.Hint",
    scope: "client",
    config: false,
    type: Object,
    default: {},
    onChange: () => CityMapOverlay.refresh()
  });

  game.settings.registerMenu(MODULE_ID, "typeConfig", {
    name: "CITYMAP.Settings.Menu.Name",
    label: "CITYMAP.Settings.Menu.Label",
    hint: "CITYMAP.Settings.Menu.Hint",
    icon: "fas fa-tags",
    type: CityMapTypeConfig,
    restricted: true
  });
}

function openManager() {
  if (!game.user.isGM) return false;
  if (!canvas?.scene) return ui.notifications.warn("Open a Scene before editing city map data.");
  new CityMapManager(canvas.scene).render(true);
  return true;
}

function getTypeTags() {
  return foundry.utils.deepClone(game.settings.get(MODULE_ID, "typeTags") ?? DEFAULT_TYPE_TAGS);
}

function getVisibleTypes() {
  const tags = getTypeTags();
  if (game.user.isGM) return new Set(tags.map((t) => t.id));

  const preferences = game.settings.get(MODULE_ID, "playerVisibleTypes") ?? {};
  return new Set(tags.filter((tag) => {
    if (tag.playerMode === TYPE_MODES.ALWAYS) return true;
    if (tag.playerMode === TYPE_MODES.HIDDEN) return false;
    return preferences[tag.id] !== false;
  }).map((tag) => tag.id));
}

class CityMapVisibility extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "city-map-scene-visibility",
      title: "City Map Type Visibility",
      template: `modules/${MODULE_ID}/templates/visibility.hbs`,
      width: 360
    });
  }

  getData() {
    const preferences = game.settings.get(MODULE_ID, "playerVisibleTypes") ?? {};
    return {
      tags: getTypeTags()
        .filter((tag) => game.user.isGM || tag.playerMode !== TYPE_MODES.HIDDEN)
        .map((tag) => ({
          id: tag.id,
          label: tag.label,
          locked: tag.playerMode !== TYPE_MODES.USER && !game.user.isGM,
          checked: tag.playerMode === TYPE_MODES.ALWAYS || preferences[tag.id] !== false,
          checkedAttr: tag.playerMode === TYPE_MODES.ALWAYS || preferences[tag.id] !== false ? "checked" : "",
          lockedAttr: tag.playerMode !== TYPE_MODES.USER && !game.user.isGM ? "disabled" : ""
        }))
    };
  }

  async _updateObject(_event, formData) {
    const preferences = {};
    for (const tag of getTypeTags()) {
      if (tag.playerMode === TYPE_MODES.USER || game.user.isGM) preferences[tag.id] = Boolean(formData[tag.id]);
    }
    await game.settings.set(MODULE_ID, "playerVisibleTypes", preferences);
  }
}

function getVisibleLevels(scene) {
  const levels = scene.getFlag(MODULE_ID, FLAGS.LEVELS) ?? [];
  return new Set(levels.filter((level) => level.visible !== false).map((level) => level.id));
}

function isFeatureVisible(feature, scene) {
  const visibleLevels = getVisibleLevels(scene);
  const visibleTypes = getVisibleTypes();
  const featureLevels = Array.isArray(feature.levels) ? feature.levels : [];
  const featureTypes = Array.isArray(feature.types) ? feature.types : [];
  return featureLevels.some((level) => visibleLevels.has(level)) && featureTypes.some((type) => visibleTypes.has(type));
}

class CityMapOverlay {
  static container;
  static graphics = [];
  static tooltip;

  static refresh() {
    if (!canvas?.stage || !canvas?.scene) return;
    this.clear();
    this.container = new PIXI.Container();
    this.container.sortableChildren = true;
    this.container.zIndex = 750;
    canvas.stage.addChild(this.container);

    const features = canvas.scene.getFlag(MODULE_ID, FLAGS.FEATURES) ?? [];
    for (const feature of features) {
      if (!isFeatureVisible(feature, canvas.scene)) continue;
      const graphics = this.drawFeature(feature);
      if (graphics) this.graphics.push(graphics);
    }
  }

  static clear() {
    this.graphics = [];
    if (this.container) this.container.destroy({ children: true });
    this.container = null;
    this.hideTooltip();
  }

  static drawFeature(feature) {
    if (!this.container) return null;
    const graphics = new PIXI.Graphics();
    graphics.eventMode = "static";
    graphics.cursor = feature.journalUuid ? "pointer" : "help";
    graphics.zIndex = Math.max(...(feature.points ?? []).map((p) => Number(p.elevation ?? 0)), 0);

    if (feature.kind === "point") drawPoint(graphics, feature);
    else if (feature.kind === "path") drawPath(graphics, feature);
    else if (feature.kind === "polygon" || feature.kind === "buildingFill") drawPolygon(graphics, feature);

    if (feature.kind === "buildingFill") {
      const buildings = Array.isArray(feature.buildings) ? feature.buildings : regenerateBuildingFill(feature);
      for (const building of buildings) drawPolygon(graphics, building, true);
    }

    graphics.on("pointerover", (event) => this.showTooltip(feature, event));
    graphics.on("pointermove", (event) => this.moveTooltip(event));
    graphics.on("pointerout", () => this.hideTooltip());
    graphics.on("pointertap", () => openJournal(feature));
    this.container.addChild(graphics);
    return graphics;
  }

  static showTooltip(feature, event) {
    this.hideTooltip();
    const tooltip = document.createElement("aside");
    tooltip.className = "city-map-scene-tooltip";
    const name = document.createElement("strong");
    name.textContent = feature.name ?? "Unnamed Location";
    tooltip.append(name);
    if (feature.description) {
      const description = document.createElement("p");
      description.textContent = feature.description;
      tooltip.append(description);
    }
    document.body.append(tooltip);
    this.tooltip = tooltip;
    this.moveTooltip(event);
  }

  static moveTooltip(event) {
    if (!this.tooltip) return;
    const original = event?.originalEvent;
    const x = Number(original?.clientX ?? 0) + 12;
    const y = Number(original?.clientY ?? 0) + 12;
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
  }

  static hideTooltip() {
    this.tooltip?.remove();
    this.tooltip = null;
  }
}

function drawPoint(graphics, feature) {
  const point = feature.points?.[0] ?? feature;
  graphics.lineStyle(2, colorNumber(feature.stroke ?? "#ffffff"), 1);
  graphics.beginFill(colorNumber(feature.fill ?? feature.stroke ?? "#ffffff"), 0.85);
  graphics.drawCircle(point.x, point.y, Number(feature.radius ?? 7));
  graphics.endFill();
}

function drawPath(graphics, feature) {
  const points = feature.points ?? [];
  if (points.length < 2) return;
  graphics.lineStyle(Number(feature.width ?? 4), colorNumber(feature.stroke ?? "#ffffff"), Number(feature.alpha ?? 0.9));
  graphics.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    if (point.cp1 && point.cp2) graphics.bezierCurveTo(point.cp1.x, point.cp1.y, point.cp2.x, point.cp2.y, point.x, point.y);
    else if (point.cp) graphics.quadraticCurveTo(point.cp.x, point.cp.y, point.x, point.y);
    else graphics.lineTo(point.x, point.y);
  }
}

function drawPolygon(graphics, feature, internal = false) {
  const points = feature.points ?? [];
  if (points.length < 3) return;
  const fill = feature.fill ?? (internal ? "#66666699" : "#ffffff44");
  const stroke = feature.stroke ?? "#ffffff";
  graphics.lineStyle(internal ? 1 : Number(feature.width ?? 2), colorNumber(stroke), internal ? 0.65 : 0.9);
  graphics.beginFill(colorNumber(fill), alphaFromColor(fill, internal ? 0.55 : 0.35));
  graphics.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
  graphics.closePath();
  graphics.endFill();
}

function openJournal(feature) {
  if (!feature.journalUuid) return;
  fromUuid(feature.journalUuid).then((document) => document?.sheet?.render(true));
}

function colorNumber(color) {
  if (typeof color === "number") return color;
  return Number.parseInt(String(color).replace("#", "").slice(0, 6), 16) || 0xffffff;
}

function alphaFromColor(color, fallback) {
  const value = String(color);
  if (!value.startsWith("#") || value.length < 9) return fallback;
  return Number.parseInt(value.slice(7, 9), 16) / 255;
}

function regenerateBuildingFill(feature) {
  const settings = feature.buildingFill ?? {};
  const polygon = feature.points ?? [];
  if (polygon.length < 3) return [];

  const seed = Number(settings.seed ?? 1);
  const random = seededRandom(seed);
  const bounds = polygonBounds(polygon);
  const averageSize = clamp(Number(settings.averageSize ?? 80), 10, 1000);
  const variation = clamp(Number(settings.sizeVariation ?? 0.25), 0, 1);
  const irregularity = clamp(Number(settings.irregularity ?? 0.25), 0, 1);
  const fillPercent = clamp(Number(settings.fillPercent ?? 0.6), 0, 1);
  const features = [];

  for (let y = bounds.minY; y < bounds.maxY; y += averageSize) {
    for (let x = bounds.minX; x < bounds.maxX; x += averageSize) {
      if (random() > fillPercent) continue;
      const sizeJitter = 1 + ((random() * 2 - 1) * variation);
      const width = averageSize * sizeJitter * (0.8 + random() * 0.4);
      const height = averageSize * sizeJitter * (0.8 + random() * 0.4);
      const cx = x + averageSize * (0.25 + random() * 0.5);
      const cy = y + averageSize * (0.25 + random() * 0.5);
      if (!pointInPolygon({ x: cx, y: cy }, polygon)) continue;
      const points = rectanglePoints(cx, cy, width, height, irregularity, random)
        .filter((point) => pointInPolygon(point, polygon));
      if (points.length >= 3) {
        features.push({
          kind: "polygon",
          fill: feature.fill,
          stroke: feature.stroke,
          points: points.map((point) => ({ ...point, elevation: Number(settings.baseElevation ?? 0) }))
        });
      }
    }
  }
  return features;
}

function rectanglePoints(cx, cy, width, height, irregularity, random) {
  const halfW = width / 2;
  const halfH = height / 2;
  return [
    { x: cx - halfW, y: cy - halfH },
    { x: cx + halfW, y: cy - halfH },
    { x: cx + halfW, y: cy + halfH },
    { x: cx - halfW, y: cy + halfH }
  ].map((point) => ({
    x: point.x + ((random() * 2 - 1) * width * 0.35 * irregularity),
    y: point.y + ((random() * 2 - 1) * height * 0.35 * irregularity)
  }));
}

function polygonBounds(points) {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y)
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersects = ((pi.y > point.y) !== (pj.y > point.y))
      && (point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x);
    if (intersects) inside = !inside;
  }
  return inside;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

class CityMapTypeConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "city-map-scene-type-config",
      title: "City Map Types",
      template: `modules/${MODULE_ID}/templates/type-config.hbs`,
      width: 620
    });
  }

  getData() {
    return {
      typeTagsJson: JSON.stringify(getTypeTags(), null, 2)
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action='defaults']").on("click", () => {
      html.find("textarea[name='typeTags']").val(JSON.stringify(DEFAULT_TYPE_TAGS, null, 2));
    });
  }

  async _updateObject(_event, formData) {
    const typeTags = parseJson(formData.typeTags, "type tags");
    validateTypeTags(typeTags);
    await game.settings.set(MODULE_ID, "typeTags", typeTags);
  }
}

class CityMapManager extends FormApplication {
  constructor(scene, options = {}) {
    super(scene, options);
    this.scene = scene;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "city-map-scene-manager",
      title: "City Map Scene",
      template: `modules/${MODULE_ID}/templates/manager.hbs`,
      width: 900,
      height: "auto",
      resizable: true
    });
  }

  getData() {
    return {
      levelsJson: JSON.stringify(this.scene.getFlag(MODULE_ID, FLAGS.LEVELS) ?? SAMPLE_LEVELS, null, 2),
      featuresJson: JSON.stringify(this.scene.getFlag(MODULE_ID, FLAGS.FEATURES) ?? [], null, 2)
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action='seed-example']").on("click", () => {
      html.find("textarea[name='levels']").val(JSON.stringify(SAMPLE_LEVELS, null, 2));
      html.find("textarea[name='features']").val(JSON.stringify(SAMPLE_FEATURES, null, 2));
    });
    html.find("[data-action='regenerate-buildings']").on("click", () => {
      const features = parseJson(html.find("textarea[name='features']").val(), "features");
      for (const feature of features) {
        if (feature.kind !== "buildingFill") continue;
        feature.buildingFill ??= {};
        feature.buildingFill.seed = Math.floor(Math.random() * 1_000_000);
        feature.buildings = regenerateBuildingFill(feature);
      }
      html.find("textarea[name='features']").val(JSON.stringify(features, null, 2));
      CityMapOverlay.refresh();
    });
  }

  async _updateObject(_event, formData) {
    const levels = parseJson(formData.levels, "levels");
    const features = parseJson(formData.features, "features");
    validateLevels(levels);
    validateFeatures(features);
    for (const feature of features) {
      if (feature.kind !== "buildingFill" || Array.isArray(feature.buildings)) continue;
      feature.buildingFill ??= {};
      feature.buildingFill.seed ??= Math.floor(Math.random() * 1_000_000);
      feature.buildings = regenerateBuildingFill(feature);
    }
    await this.scene.setFlag(MODULE_ID, FLAGS.LEVELS, levels);
    await this.scene.setFlag(MODULE_ID, FLAGS.FEATURES, features);
    CityMapOverlay.refresh();
  }
}

function parseJson(value, label) {
  try {
    return JSON.parse(value || "[]");
  } catch (error) {
    ui.notifications.error(`Invalid ${label} JSON: ${error.message}`);
    throw error;
  }
}

function validateTypeTags(typeTags) {
  if (!Array.isArray(typeTags)) throw new Error("Type tags must be an array.");
  for (const tag of typeTags) {
    if (!tag.id || !tag.label) throw new Error("Each type tag needs id and label.");
    if (!Object.values(TYPE_MODES).includes(tag.playerMode)) throw new Error(`Invalid playerMode for type tag ${tag.id}.`);
  }
}

function validateLevels(levels) {
  if (!Array.isArray(levels)) throw new Error("Levels must be an array.");
  for (const level of levels) {
    if (!level.id || !level.label) throw new Error("Each level needs id and label.");
  }
}

function validateFeatures(features) {
  if (!Array.isArray(features)) throw new Error("Features must be an array.");
  for (const feature of features) {
    if (!feature.id || !feature.kind || !feature.name) throw new Error("Each feature needs id, kind, and name.");
    if (!Array.isArray(feature.levels) || !Array.isArray(feature.types)) throw new Error(`Feature ${feature.id} needs levels and types arrays.`);
    if (!["point", "path", "polygon", "buildingFill"].includes(feature.kind)) throw new Error(`Feature ${feature.id} has an unsupported kind.`);
  }
}
