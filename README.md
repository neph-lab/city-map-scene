# City Map Scene

City Map Scene is a Foundry VTT v14 module for adding city-map geometry to a Scene as an interactive overlay.

## Current Scope

- Stores city-map data on the Scene using module flags.
- Supports point locations, polygon locations, sharp-corner paths, and Bezier paths.
- Preserves elevation on every point so later 3D/parallax work has the needed data.
- Shows a hover pop-up with a name and optional short description.
- Opens a configured Journal entry when a feature with `journalUuid` is clicked.
- Links every feature to one or more scene levels and one or more type tags.
- Applies visibility using both level and type filters: a feature renders only when at least one of its levels and at least one of its types are visible.
- Lets the GM configure type tags as always visible to players, hidden from players, or player-adjustable.
- Provides a procedural `buildingFill` polygon mode that generates stored, non-interactive internal polygons from a seed and fill controls.

## Foundry Setup

Install this folder as:

```text
{userData}/Data/modules/city-map-scene
```

Then enable **City Map Scene** in the world's module list.

The module follows Foundry's module manifest structure: `module.json` loads `scripts/city-map-scene.js`, `styles/city-map-scene.css`, templates, and localization.

## Use

GM tools:

- Scene setup: enable **City Map Scene** in the Scene configuration before the City Map controls appear.
- Scene controls: use the **City Map** control category in the left-side controls.
- Drawing tools: rectangle, circle, polygon, line, and building fill create module-owned city map features, not Foundry Drawing documents.
- Select tool: click an existing city map feature to edit its details, visibility, geometry, and building-fill settings.
- Debug data manager: press `Ctrl+Shift+M` while viewing a City Map Scene to inspect or edit raw data during development.
- Configure type tags from Foundry's module settings menu.
- In the manager, edit Scene levels and features as JSON. Use **Seed Example** to create sample data.
- Use **Regenerate Building Fills** after changing building-fill controls to create a new stored set of internal polygons.

Player tools:

- Scene controls: players only see **City Map Type Visibility**, or can press `Ctrl+Shift+V`.
- Players can only toggle type tags configured with `playerMode: "user"`.

## Feature Data Shape

```json
{
  "id": "market-road",
  "kind": "path",
  "name": "Market Road",
  "description": "Main traffic through the district.",
  "journalUuid": "JournalEntry.abc123",
  "levels": ["street"],
  "types": ["streetmap"],
  "stroke": "#d7d1bb",
  "width": 8,
  "points": [
    { "x": 500, "y": 700, "elevation": 0 },
    { "x": 850, "y": 620, "elevation": 0 },
    { "x": 1120, "y": 760, "elevation": 4 }
  ]
}
```

Supported `kind` values:

- `point`
- `path`
- `polygon`
- `buildingFill`

Bezier path segments can add `cp` for quadratic curves or `cp1` and `cp2` for cubic curves on the destination point.

## Building Fill

`buildingFill` features use their outer polygon as the containing area and store generated internal polygons in `buildings`. Internal polygons are intentionally not separately editable or clickable.

```json
{
  "kind": "buildingFill",
  "buildingFill": {
    "seed": 6173,
    "fillPercent": 0.72,
    "averageSize": 72,
    "sizeVariation": 0.35,
    "irregularity": 0.25,
    "baseElevation": 0,
    "averageTopElevation": 18,
    "topElevationVariation": 8
  }
}
```

The current renderer uses the base elevation and keeps the top-elevation fields in the schema for the planned 3D/parallax stage.
