const MODULE_ID = "city-map-scene";
const CityMapApplication = foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2);

const FLAGS = {
  FEATURES: "features",
  LEVELS: "levels",
  IS_CITY_MAP: "isCityMap"
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

const CITY_MAP_TOOLS = {
  SELECT: "select",
  RECTANGLE: "rectangle",
  CIRCLE: "circle",
  POLYGON: "polygon",
  LINE: "line",
  BUILDING_FILL: "buildingFill"
};

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
      return openVisibility();
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
});

Hooks.once("ready", () => {
  game.cityMapScene = {
    openManager,
    openVisibility,
    refresh: () => CityMapOverlay.refresh(),
    getVisibleTypes,
    regenerateBuildingFill
  };
});

Hooks.on("canvasReady", () => CityMapOverlay.refresh());
Hooks.on("canvasPan", () => CityMapOverlay.refresh());
Hooks.on("updateScene", (scene) => {
  if (scene.id !== canvas?.scene?.id) return;
  if (!isCityMapScene(scene)) CityMapDrawingTool.deactivate();
  CityMapOverlay.refresh();
  refreshSceneControls();
});

Hooks.on("getSceneControlButtons", (controls) => {
  if (!isCityMapScene(canvas?.scene)) return;
  const visibilityTool = {
    name: "city-map-scene-visibility",
    title: "City Map Type Visibility",
    icon: "fa-solid fa-eye",
    button: true,
    visible: true,
    onChange: () => openVisibility(),
    onClick: () => openVisibility()
  };
  const cityMapControls = {
    name: MODULE_ID,
    title: "City Map",
    icon: "fa-solid fa-map-location-dot",
    order: Array.isArray(controls) ? controls.length : Object.keys(controls).length,
    visible: true,
    activeTool: CITY_MAP_TOOLS.SELECT,
    onChange: (_event, active) => {
      if (!active) CityMapDrawingTool.activate(CITY_MAP_TOOLS.SELECT);
    },
    onToolChange: (_event, tool, active) => {
      if (active && !tool.button) CityMapDrawingTool.activate(tool.name);
    },
    tools: assignToolOrders(game.user.isGM ? getGmControlTools(visibilityTool) : [visibilityTool])
  };

  if (Array.isArray(controls)) controls.push(cityMapControls);
  else controls[MODULE_ID] = {
    ...cityMapControls,
    tools: Object.fromEntries(cityMapControls.tools.map((tool, order) => [tool.name, { ...tool, order }]))
  };
});

Hooks.on("renderSceneConfig", (application, element) => {
  injectSceneConfigCityMapFlag(application, element);
});

function getGmControlTools(visibilityTool) {
  return [
    {
      name: CITY_MAP_TOOLS.SELECT,
      title: "Select City Map Feature",
      icon: "fa-solid fa-arrow-pointer",
      active: true,
      onChange: (_event, active) => active && CityMapDrawingTool.activate(CITY_MAP_TOOLS.SELECT),
      onClick: () => CityMapDrawingTool.activate(CITY_MAP_TOOLS.SELECT)
    },
    makeDrawingControl(CITY_MAP_TOOLS.RECTANGLE, "City Map Rectangle", "fa-regular fa-square"),
    makeDrawingControl(CITY_MAP_TOOLS.CIRCLE, "City Map Circle", "fa-regular fa-circle"),
    makeDrawingControl(CITY_MAP_TOOLS.POLYGON, "City Map Polygon", "fa-solid fa-draw-polygon"),
    makeDrawingControl(CITY_MAP_TOOLS.LINE, "City Map Line", "fa-solid fa-route"),
    makeDrawingControl(CITY_MAP_TOOLS.BUILDING_FILL, "City Map Building Fill", "fa-solid fa-city"),
    visibilityTool
  ];
}

function assignToolOrders(tools) {
  return tools.map((tool, order) => ({ ...tool, order }));
}

function makeDrawingControl(name, title, icon) {
  return {
    name,
    title,
    icon,
    onChange: (_event, active) => active && CityMapDrawingTool.activate(name),
    onClick: () => CityMapDrawingTool.activate(name)
  };
}

function isCityMapScene(scene = canvas?.scene) {
  const value = scene?.getFlag(MODULE_ID, FLAGS.IS_CITY_MAP);
  return value === true || value === "true";
}

function injectSceneConfigCityMapFlag(application, element) {
  const scene = application.document;
  if (scene?.documentName !== "Scene" || element.querySelector('[data-tab="city-map-scene"]')) return;

  const tabNav = element.querySelector('nav.tabs[data-group="sheet"]')
    ?? element.querySelector("nav.tabs")
    ?? element.querySelector('[data-application-part="tabs"]');
  const tabContent = element.querySelector('.tab[data-group="sheet"]')?.parentElement
    ?? element.querySelector(".tab")?.parentElement
    ?? element.querySelector("section");
  if (!tabNav || !tabContent) return;

  const navItem = document.createElement("a");
  navItem.className = "item";
  navItem.dataset.tab = "city-map-scene";
  navItem.dataset.group = "sheet";
  navItem.innerHTML = `<i class="fa-solid fa-map-location-dot"></i><span>City Map</span>`;
  tabNav.append(navItem);

  const tab = document.createElement("section");
  tab.className = "tab city-map-scene-config-tab";
  tab.dataset.tab = "city-map-scene";
  tab.dataset.group = "sheet";
  tab.innerHTML = `
    <div class="form-group">
      <label>City Map Scene</label>
      <div class="form-fields">
        <input type="checkbox" name="flags.${MODULE_ID}.${FLAGS.IS_CITY_MAP}" value="true">
      </div>
      <p class="hint">Enable City Map Scene controls and overlay data for this Scene.</p>
    </div>
  `;
  tabContent.append(tab);

  const checkbox = tab.querySelector("input");
  checkbox.checked = isCityMapScene(scene);

  navItem.addEventListener("click", (event) => {
    event.preventDefault();
    for (const item of tabNav.querySelectorAll(".item")) item.classList.toggle("active", item === navItem);
    for (const sibling of tabContent.querySelectorAll('.tab[data-group="sheet"], .tab')) {
      sibling.classList.toggle("active", sibling === tab);
    }
    try {
      application.changeTab?.("city-map-scene", "sheet", { event, navElement: navItem, force: true });
    } catch (_error) {
      // SceneConfig does not know about module-injected tabs, so the DOM fallback above is authoritative.
    }
  });

  checkbox.addEventListener("change", async () => {
    await scene.setFlag(MODULE_ID, FLAGS.IS_CITY_MAP, checkbox.checked);
    refreshSceneControls();
  });
  const form = element.closest("form") ?? element.querySelector("form");
  form?.addEventListener("submit", async () => {
    await scene.setFlag(MODULE_ID, FLAGS.IS_CITY_MAP, checkbox.checked);
    refreshSceneControls();
  }, { once: true });
}

function refreshSceneControls() {
  ui.controls?.render?.({ reset: true });
}

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
  if (!isCityMapScene()) return ui.notifications.warn("Enable City Map Scene in this Scene's configuration first.");
  renderFoundryApp(new CityMapManager(canvas.scene));
  return true;
}

function openVisibility() {
  if (!isCityMapScene()) return false;
  renderFoundryApp(new CityMapVisibility());
  return true;
}

function renderFoundryApp(application) {
  return application.render({ force: true });
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

class CityMapVisibility extends CityMapApplication {
  static DEFAULT_OPTIONS = {
      id: "city-map-scene-visibility",
      tag: "form",
      classes: ["city-map-scene-visibility"],
      position: { width: 360 },
      window: { title: "City Map Type Visibility", icon: "fa-solid fa-eye" },
      form: {
        closeOnSubmit: true,
        handler: async function (_event, _form, formData) {
          return this._onSubmit(formData.object);
        }
      }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/visibility.hbs` }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const preferences = game.settings.get(MODULE_ID, "playerVisibleTypes") ?? {};
    return foundry.utils.mergeObject(context, {
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
    });
  }

  async _onSubmit(formData) {
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

class CityMapDrawingTool {
  static activeTool = CITY_MAP_TOOLS.SELECT;
  static drawing = null;
  static preview = null;
  static listenersBound = false;
  static view = null;

  static activate(tool) {
    if (!game.user.isGM) return;
    this.cancel();
    this.activeTool = tool;
    if (tool === CITY_MAP_TOOLS.SELECT) {
      this.detachListeners();
      ui.notifications.info("City map select mode.");
      return;
    }
    this.attachListeners();
    ui.notifications.info(`City map ${tool} drawing mode. Press Escape to cancel.`);
  }

  static attachListeners() {
    const view = getCanvasView();
    if (this.listenersBound || !view) return;
    this.listenersBound = true;
    this.view = view;
    view.addEventListener("pointerdown", this.onPointerDown, true);
    view.addEventListener("pointermove", this.onPointerMove, true);
    view.addEventListener("pointerup", this.onPointerUp, true);
    view.addEventListener("click", this.onClick, true);
    view.addEventListener("dblclick", this.onDoubleClick, true);
    view.addEventListener("contextmenu", this.onContextMenu, true);
    window.addEventListener("keydown", this.onKeyDown);
  }

  static detachListeners() {
    if (!this.listenersBound) return;
    this.listenersBound = false;
    this.view?.removeEventListener("pointerdown", this.onPointerDown, true);
    this.view?.removeEventListener("pointermove", this.onPointerMove, true);
    this.view?.removeEventListener("pointerup", this.onPointerUp, true);
    this.view?.removeEventListener("click", this.onClick, true);
    this.view?.removeEventListener("dblclick", this.onDoubleClick, true);
    this.view?.removeEventListener("contextmenu", this.onContextMenu, true);
    this.view = null;
    window.removeEventListener("keydown", this.onKeyDown);
  }

  static onPointerDown(event) {
    if (!CityMapDrawingTool.isReadyForCanvasEvent(event)) return;
    if (CityMapDrawingTool.isVertexTool()) {
      CityMapDrawingTool.consumeCanvasEvent(event);
      return;
    }
    if (!CityMapDrawingTool.isDragTool()) return;
    CityMapDrawingTool.consumeCanvasEvent(event);
    const origin = getEventPoint(event);
    CityMapDrawingTool.drawing = { origin, current: origin };
    CityMapDrawingTool.drawPreview([origin, origin], CityMapDrawingTool.activeTool === CITY_MAP_TOOLS.LINE);
  }

  static onPointerMove(event) {
    if (!CityMapDrawingTool.isReadyForCanvasEvent(event, false)) return;
    if (CityMapDrawingTool.isDragTool() && CityMapDrawingTool.drawing?.origin) {
      CityMapDrawingTool.consumeCanvasEvent(event);
      CityMapDrawingTool.drawing.current = getEventPoint(event);
      CityMapDrawingTool.drawPreview(
        pointsForDragTool(CityMapDrawingTool.activeTool, CityMapDrawingTool.drawing.origin, CityMapDrawingTool.drawing.current),
        CityMapDrawingTool.activeTool === CITY_MAP_TOOLS.LINE
      );
      return;
    }

    if (!CityMapDrawingTool.isVertexTool() || !CityMapDrawingTool.drawing?.points?.length) return;
    const points = [...CityMapDrawingTool.drawing.points, getEventPoint(event)];
    CityMapDrawingTool.drawPreview(points, CityMapDrawingTool.activeTool === CITY_MAP_TOOLS.LINE);
  }

  static async onPointerUp(event) {
    if (!CityMapDrawingTool.isReadyForCanvasEvent(event)) return;
    if (CityMapDrawingTool.isVertexTool()) {
      CityMapDrawingTool.consumeCanvasEvent(event);
      return;
    }
    if (!CityMapDrawingTool.isDragTool() || !CityMapDrawingTool.drawing?.origin) return;
    CityMapDrawingTool.consumeCanvasEvent(event);
    const destination = getEventPoint(event);
    const points = pointsForDragTool(CityMapDrawingTool.activeTool, CityMapDrawingTool.drawing.origin, destination);
    CityMapDrawingTool.drawing = null;
    CityMapDrawingTool.clearPreview();
    if (!hasUsableSize(points)) return;
    await CityMapDrawingTool.createFeature(points);
  }

  static async onClick(event) {
    if (!CityMapDrawingTool.isReadyForCanvasEvent(event)) return;
    if (!CityMapDrawingTool.isVertexTool() || event.detail > 1) return;
    CityMapDrawingTool.consumeCanvasEvent(event);
    const point = getEventPoint(event);
    CityMapDrawingTool.drawing ??= { points: [] };
    CityMapDrawingTool.drawing.points.push(point);
    CityMapDrawingTool.drawPreview(CityMapDrawingTool.drawing.points, CityMapDrawingTool.activeTool === CITY_MAP_TOOLS.LINE);
  }

  static async onDoubleClick(event) {
    if (!CityMapDrawingTool.isReadyForCanvasEvent(event)) return;
    if (!CityMapDrawingTool.isVertexTool()) return;
    CityMapDrawingTool.consumeCanvasEvent(event);
    await CityMapDrawingTool.finishVertexDrawing();
  }

  static async onContextMenu(event) {
    if (!CityMapDrawingTool.isReadyForCanvasEvent(event, false)) return;
    if (!CityMapDrawingTool.isVertexTool()) return;
    CityMapDrawingTool.consumeCanvasEvent(event);
    await CityMapDrawingTool.finishVertexDrawing();
  }

  static async finishVertexDrawing() {
    const points = this.drawing?.points ?? [];
    const minimum = this.activeTool === CITY_MAP_TOOLS.LINE ? 2 : 3;
    if (points.length < minimum) return;
    this.drawing = null;
    this.clearPreview();
    await this.createFeature(points);
  }

  static onKeyDown = async (event) => {
    if (event.key === "Escape") CityMapDrawingTool.cancel();
    if (event.key === "Enter" && CityMapDrawingTool.isVertexTool()) await CityMapDrawingTool.finishVertexDrawing();
  };

  static async createFeature(points) {
    const feature = await createFeatureFromTool(this.activeTool, points);
    if (!feature) return;
    renderFoundryApp(new CityMapFeatureConfig(feature, { isNew: true }));
  }

  static isDragTool() {
    return [CITY_MAP_TOOLS.RECTANGLE, CITY_MAP_TOOLS.CIRCLE].includes(this.activeTool);
  }

  static isVertexTool() {
    return [CITY_MAP_TOOLS.POLYGON, CITY_MAP_TOOLS.LINE, CITY_MAP_TOOLS.BUILDING_FILL].includes(this.activeTool);
  }

  static drawPreview(points, open = false) {
    this.clearPreview();
    this.preview = new PIXI.Graphics();
    this.preview.eventMode = "none";
    this.preview.lineStyle(2, 0x00d1ff, 0.9);
    this.preview.beginFill(0x00d1ff, open ? 0 : 0.12);
    if (points.length) {
      this.preview.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) this.preview.lineTo(point.x, point.y);
      if (!open && points.length > 2) this.preview.closePath();
    }
    this.preview.endFill();
    canvas.stage.addChild(this.preview);
  }

  static clearPreview() {
    this.preview?.destroy();
    this.preview = null;
  }

  static cancel() {
    this.drawing = null;
    this.clearPreview();
  }

  static deactivate() {
    this.activeTool = CITY_MAP_TOOLS.SELECT;
    this.cancel();
    this.detachListeners();
  }

  static isReadyForCanvasEvent(event, leftButtonOnly = true) {
    if (!game.user.isGM || !isCityMapScene()) return false;
    if (this.activeTool === CITY_MAP_TOOLS.SELECT) return false;
    if (leftButtonOnly && event.button !== 0) return false;
    return true;
  }

  static consumeCanvasEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }
}

class CityMapOverlay {
  static container;
  static graphics = [];
  static tooltip;

  static refresh() {
    if (!canvas?.stage || !canvas?.scene) return;
    this.clear();
    if (!isCityMapScene()) return;
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
    graphics.on("pointertap", () => {
      if (game.user.isGM && CityMapDrawingTool.activeTool === CITY_MAP_TOOLS.SELECT) renderFoundryApp(new CityMapFeatureConfig(feature));
      else openJournal(feature);
    });
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
  fromUuid(feature.journalUuid).then((document) => document?.sheet && renderFoundryApp(document.sheet));
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

function getEventPoint(event) {
  if (Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY)) {
    const view = getCanvasView();
    const rect = view?.getBoundingClientRect?.();
    const screenPoint = new PIXI.Point(event.clientX - (rect?.left ?? 0), event.clientY - (rect?.top ?? 0));
    const local = canvas.stage.toLocal(screenPoint);
    return {
      x: Math.round(local.x),
      y: Math.round(local.y),
      elevation: 0
    };
  }

  const local = event?.getLocalPosition?.(canvas.stage)
    ?? event?.data?.getLocalPosition?.(canvas.stage)
    ?? canvas.stage.toLocal(event?.global ?? event?.data?.global ?? { x: 0, y: 0 });
  return {
    x: Math.round(local.x),
    y: Math.round(local.y),
    elevation: 0
  };
}

function getCanvasView() {
  return canvas?.app?.canvas ?? canvas?.app?.view ?? document.querySelector("canvas#board");
}

function pointsForDragTool(tool, origin, destination) {
  if (tool === CITY_MAP_TOOLS.CIRCLE) return circlePoints(origin, destination);
  return rectangleFromCorners(origin, destination);
}

function rectangleFromCorners(a, b) {
  return [
    { x: a.x, y: a.y, elevation: 0 },
    { x: b.x, y: a.y, elevation: 0 },
    { x: b.x, y: b.y, elevation: 0 },
    { x: a.x, y: b.y, elevation: 0 }
  ];
}

function circlePoints(origin, destination) {
  const radius = Math.hypot(destination.x - origin.x, destination.y - origin.y);
  const segments = 32;
  return Array.from({ length: segments }, (_value, index) => {
    const angle = (Math.PI * 2 * index) / segments;
    return {
      x: Math.round(origin.x + Math.cos(angle) * radius),
      y: Math.round(origin.y + Math.sin(angle) * radius),
      elevation: 0
    };
  });
}

function hasUsableSize(points) {
  const bounds = polygonBounds(points);
  return (bounds.maxX - bounds.minX) >= 8 || (bounds.maxY - bounds.minY) >= 8;
}

async function createFeatureFromTool(tool, points) {
  if (!canvas?.scene) return null;
  await ensureSceneLevels(canvas.scene);
  const levels = canvas.scene.getFlag(MODULE_ID, FLAGS.LEVELS) ?? SAMPLE_LEVELS;
  const typeTags = getTypeTags();
  const type = typeTags.find((tag) => tag.playerMode !== TYPE_MODES.HIDDEN) ?? typeTags[0];
  const base = {
    id: foundry.utils.randomID(),
    name: defaultFeatureName(tool),
    description: "",
    journalUuid: "",
    levels: [levels[0]?.id ?? "ground"],
    types: [type?.id ?? "streetmap"],
    stroke: type?.color ?? "#ffffff",
    width: tool === CITY_MAP_TOOLS.LINE ? 5 : 2,
    points
  };

  if (tool === CITY_MAP_TOOLS.LINE) return { ...base, kind: "path", fill: "" };
  if (tool === CITY_MAP_TOOLS.BUILDING_FILL) {
    const feature = {
      ...base,
      kind: "buildingFill",
      fill: "#6d806888",
      buildingFill: {
        seed: Math.floor(Math.random() * 1_000_000),
        fillPercent: 0.65,
        averageSize: 72,
        sizeVariation: 0.3,
        irregularity: 0.25,
        baseElevation: 0,
        averageTopElevation: 18,
        topElevationVariation: 8
      }
    };
    feature.buildings = regenerateBuildingFill(feature);
    return feature;
  }
  return {
    ...base,
    kind: "polygon",
    shapeType: tool,
    fill: `${type?.color ?? "#ffffff"}66`
  };
}

function defaultFeatureName(tool) {
  const labels = {
    [CITY_MAP_TOOLS.RECTANGLE]: "New Rectangle",
    [CITY_MAP_TOOLS.CIRCLE]: "New Circle",
    [CITY_MAP_TOOLS.POLYGON]: "New Polygon",
    [CITY_MAP_TOOLS.LINE]: "New Line",
    [CITY_MAP_TOOLS.BUILDING_FILL]: "New Building Fill"
  };
  return labels[tool] ?? "New City Map Feature";
}

async function ensureSceneLevels(scene) {
  const levels = scene.getFlag(MODULE_ID, FLAGS.LEVELS);
  if (Array.isArray(levels) && levels.length) return;
  await scene.setFlag(MODULE_ID, FLAGS.LEVELS, [{ id: "ground", label: "Ground", visible: true, elevation: 0 }]);
}

async function saveFeature(feature) {
  const scene = canvas.scene;
  const features = foundry.utils.deepClone(scene.getFlag(MODULE_ID, FLAGS.FEATURES) ?? []);
  const index = features.findIndex((existing) => existing.id === feature.id);
  if (index >= 0) features[index] = feature;
  else features.push(feature);
  await scene.setFlag(MODULE_ID, FLAGS.FEATURES, features);
  CityMapOverlay.refresh();
}

class CityMapFeatureConfig extends CityMapApplication {
  constructor(feature, options = {}) {
    super(options);
    this.feature = foundry.utils.deepClone(feature);
    this.isNew = Boolean(options.isNew);
  }

  static DEFAULT_OPTIONS = {
      id: "city-map-scene-feature-config",
      tag: "form",
      classes: ["city-map-scene-feature-config"],
      position: { width: 560 },
      window: { title: "City Map Feature", icon: "fa-solid fa-map-pin", resizable: true },
      form: {
        closeOnSubmit: true,
        handler: async function (_event, _form, formData) {
          return this._onSubmit(formData.object);
        }
      }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/feature-config.hbs` }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "details", icon: "fa-solid fa-pen", label: "Details" },
        { id: "visibility", icon: "fa-solid fa-eye", label: "Visibility" },
        { id: "geometry", icon: "fa-solid fa-draw-polygon", label: "Geometry" },
        { id: "building", icon: "fa-solid fa-city", label: "Building Fill" }
      ],
      initial: "details"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sceneLevels = canvas.scene.getFlag(MODULE_ID, FLAGS.LEVELS) ?? [];
    const selectedLevels = new Set(this.feature.levels ?? []);
    const selectedTypes = new Set(this.feature.types ?? []);
    const elevation = Number(this.feature.points?.[0]?.elevation ?? this.feature.buildingFill?.baseElevation ?? 0);
    return foundry.utils.mergeObject(context, {
      feature: this.feature,
      isPath: this.feature.kind === "path",
      isBuildingFill: this.feature.kind === "buildingFill",
      elevation,
      pointsJson: JSON.stringify(this.feature.points ?? [], null, 2),
      levels: sceneLevels.map((level) => ({
        ...level,
        checkedAttr: selectedLevels.has(level.id) ? "checked" : ""
      })),
      typeTags: getTypeTags().map((tag) => ({
        ...tag,
          checkedAttr: selectedTypes.has(tag.id) ? "checked" : ""
      }))
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.querySelector("[data-action='regenerate-buildings']")?.addEventListener("click", () => {
      const feature = this.collectFeature(this.element);
      feature.buildingFill.seed = Math.floor(Math.random() * 1_000_000);
      feature.buildings = regenerateBuildingFill(feature);
      this.feature = feature;
      this.render({ force: true });
    });
  }

  collectFeature(form) {
    return this.featureFromData(formObjectFromElement(form));
  }

  async _onSubmit(formData) {
    const feature = this.featureFromData(formData);
    await saveFeature(feature);
  }

  featureFromData(data) {
    const elevation = Number(data.elevation ?? 0);
    const feature = foundry.utils.deepClone(this.feature);
    feature.name = data.name?.trim() || "Unnamed City Map Feature";
    feature.description = data.description?.trim() ?? "";
    feature.journalUuid = data.journalUuid?.trim() ?? "";
    feature.stroke = data.stroke || feature.stroke || "#ffffff";
    feature.width = Number(data.width ?? feature.width ?? 2);
    if (feature.kind !== "path") feature.fill = data.fill || feature.fill || "#ffffff66";
    feature.points = parseJson(data.points, "points").map((point) => ({
      x: Number(point.x),
      y: Number(point.y),
      elevation
    }));
    feature.levels = Object.entries(data.level ?? {}).filter(([_id, enabled]) => enabled).map(([id]) => id);
    feature.types = Object.entries(data.type ?? {}).filter(([_id, enabled]) => enabled).map(([id]) => id);

    if (feature.kind === "buildingFill") {
      feature.buildingFill = {
        seed: Number(data.buildingFill?.seed ?? feature.buildingFill?.seed ?? 1),
        fillPercent: Number(data.buildingFill?.fillPercent ?? feature.buildingFill?.fillPercent ?? 0.65),
        averageSize: Number(data.buildingFill?.averageSize ?? feature.buildingFill?.averageSize ?? 72),
        sizeVariation: Number(data.buildingFill?.sizeVariation ?? feature.buildingFill?.sizeVariation ?? 0.3),
        irregularity: Number(data.buildingFill?.irregularity ?? feature.buildingFill?.irregularity ?? 0.25),
        baseElevation: Number(data.buildingFill?.baseElevation ?? elevation),
        averageTopElevation: Number(data.buildingFill?.averageTopElevation ?? feature.buildingFill?.averageTopElevation ?? 18),
        topElevationVariation: Number(data.buildingFill?.topElevationVariation ?? feature.buildingFill?.topElevationVariation ?? 8)
      };
      feature.buildings = regenerateBuildingFill(feature);
    }
    return feature;
  }
}

function formObjectFromElement(form) {
  const data = {};
  for (const element of form.elements) {
    if (!element.name || element.disabled) continue;
    if (element.type === "checkbox") data[element.name] = element.checked;
    else data[element.name] = element.value;
  }
  return foundry.utils.expandObject(data);
}

class CityMapTypeConfig extends CityMapApplication {
  static DEFAULT_OPTIONS = {
      id: "city-map-scene-type-config",
      tag: "form",
      classes: ["city-map-scene-type-config"],
      position: { width: 620 },
      window: { title: "City Map Types", icon: "fas fa-tags" },
      form: {
        closeOnSubmit: true,
        handler: async function (_event, _form, formData) {
          return this._onSubmit(formData.object);
        }
      }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/type-config.hbs` }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return foundry.utils.mergeObject(context, {
      typeTagsJson: JSON.stringify(getTypeTags(), null, 2)
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.querySelector("[data-action='defaults']")?.addEventListener("click", () => {
      this.element.querySelector("textarea[name='typeTags']").value = JSON.stringify(DEFAULT_TYPE_TAGS, null, 2);
    });
  }

  async _onSubmit(formData) {
    const typeTags = parseJson(formData.typeTags, "type tags");
    validateTypeTags(typeTags);
    await game.settings.set(MODULE_ID, "typeTags", typeTags);
  }
}

class CityMapManager extends CityMapApplication {
  constructor(scene, options = {}) {
    super(options);
    this.scene = scene;
  }

  static DEFAULT_OPTIONS = {
      id: "city-map-scene-manager",
      tag: "form",
      classes: ["city-map-scene-manager"],
      position: { width: 900 },
      window: { title: "City Map Scene", icon: "fa-solid fa-map-location-dot", resizable: true },
      form: {
        closeOnSubmit: true,
        handler: async function (_event, _form, formData) {
          return this._onSubmit(formData.object);
        }
      }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/manager.hbs` }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return foundry.utils.mergeObject(context, {
      levelsJson: JSON.stringify(this.scene.getFlag(MODULE_ID, FLAGS.LEVELS) ?? SAMPLE_LEVELS, null, 2),
      featuresJson: JSON.stringify(this.scene.getFlag(MODULE_ID, FLAGS.FEATURES) ?? [], null, 2)
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.querySelector("[data-action='seed-example']")?.addEventListener("click", () => {
      this.element.querySelector("textarea[name='levels']").value = JSON.stringify(SAMPLE_LEVELS, null, 2);
      this.element.querySelector("textarea[name='features']").value = JSON.stringify(SAMPLE_FEATURES, null, 2);
    });
    this.element.querySelector("[data-action='regenerate-buildings']")?.addEventListener("click", () => {
      const features = parseJson(this.element.querySelector("textarea[name='features']").value, "features");
      for (const feature of features) {
        if (feature.kind !== "buildingFill") continue;
        feature.buildingFill ??= {};
        feature.buildingFill.seed = Math.floor(Math.random() * 1_000_000);
        feature.buildings = regenerateBuildingFill(feature);
      }
      this.element.querySelector("textarea[name='features']").value = JSON.stringify(features, null, 2);
      CityMapOverlay.refresh();
    });
  }

  async _onSubmit(formData) {
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
