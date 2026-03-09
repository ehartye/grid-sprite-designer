export function seedTerrainPresets(db) {
  const PRESETS = [
    {
      id: 'grassland-plains',
      name: 'Grassland Plains',
      genre: 'Nature',
      gridSize: '4x4',
      description: 'Lush green grassland tiles with dirt paths, wildflowers, and natural ground variations for an overworld map.',
      colorNotes: 'Vibrant greens for grass, warm brown for dirt, yellow-green for dry patches, tiny wildflower accents in white and yellow.',
      tileLabels: JSON.stringify([
        'Base Grass 1', 'Base Grass 2', 'Base Grass 3', 'Tall Grass',
        'Dirt Path H', 'Dirt Path V', 'Dirt Crossroad', 'Dirt Patch',
        'Grass-Dirt Edge N', 'Grass-Dirt Edge S', 'Grass-Dirt Edge E', 'Grass-Dirt Edge W',
        'Grass-Dirt Corner NE', 'Grass-Dirt Corner NW', 'Grass-Dirt Corner SE', 'Grass-Dirt Corner SW'
      ]),
      tileGuidance: `ROW 0 — Base Grass Tiles (seamlessly tileable with each other):
  Header "Base Grass 1" (0,0): Standard grass tile — short green blades with subtle shade variation. A few tiny wildflowers. This is the most common ground tile.
  Header "Base Grass 2" (0,1): Grass variant with slightly different blade pattern and a small bare soil patch. Tiles seamlessly with Base Grass 1.
  Header "Base Grass 3" (0,2): Grass variant with a tiny rock or two embedded in the soil. Different blade arrangement from 1 and 2.
  Header "Tall Grass" (0,3): Taller, denser grass blades reaching upward. Darker green. Represents overgrown or wild areas.

ROW 1 — Dirt Path Tiles:
  Header "Dirt Path H" (1,0): Horizontal dirt path — packed brown earth running left to right, grass on top and bottom edges. Path edges are slightly ragged.
  Header "Dirt Path V" (1,1): Vertical dirt path — packed brown earth running top to bottom, grass on left and right edges.
  Header "Dirt Crossroad" (1,2): Four-way dirt intersection — paths extend to all four edges. Center is well-worn brown earth.
  Header "Dirt Patch" (1,3): A bare dirt area with no grass — full tile of packed earth with small pebbles. Used for clearings.

ROW 2 — Grass-to-Dirt Edge Transitions (straight edges):
  Header "Grass-Dirt Edge N" (2,0): Grass on the north half, dirt on the south half. Clean natural transition line running horizontally.
  Header "Grass-Dirt Edge S" (2,1): Dirt on the north half, grass on the south half. Reverse of Edge N.
  Header "Grass-Dirt Edge E" (2,2): Grass on the east half, dirt on the west half. Transition line runs vertically.
  Header "Grass-Dirt Edge W" (2,3): Dirt on the east half, grass on the west half. Reverse of Edge E.

ROW 3 — Grass-to-Dirt Corner Transitions:
  Header "Grass-Dirt Corner NE" (3,0): Grass fills the northeast quarter, dirt fills the rest. The grass-dirt boundary curves from the north edge to the east edge.
  Header "Grass-Dirt Corner NW" (3,1): Grass fills the northwest quarter, dirt fills the rest.
  Header "Grass-Dirt Corner SE" (3,2): Grass fills the southeast quarter, dirt fills the rest.
  Header "Grass-Dirt Corner SW" (3,3): Grass fills the southwest quarter, dirt fills the rest.`,
    },
    {
      id: 'dungeon-stone',
      name: 'Dungeon Stone',
      genre: 'Dungeon',
      gridSize: '3x3',
      description: 'Dark stone floor tiles for dungeon interiors with cracks, moss, and wear patterns.',
      colorNotes: 'Dark grey and charcoal stone, green-grey moss accents, brown-black cracks, subtle blue-grey highlights on wet surfaces.',
      tileLabels: JSON.stringify([
        'Stone Floor 1', 'Stone Floor 2', 'Cracked Stone',
        'Mossy Stone', 'Wet Stone', 'Rubble',
        'Wall Base N', 'Wall Base S', 'Wall Corner'
      ]),
      tileGuidance: `ROW 0 — Base Stone Floors (seamlessly tileable):
  Header "Stone Floor 1" (0,0): Clean-cut dark grey stone blocks in a regular pattern. Thin mortar lines between blocks. The standard dungeon floor tile.
  Header "Stone Floor 2" (0,1): Variant stone floor with slightly different block sizes and arrangement. Same color palette as Floor 1 for seamless tiling.
  Header "Cracked Stone" (0,2): Stone floor with visible cracks running through several blocks. Some blocks are slightly displaced. Signs of age and damage.

ROW 1 — Environmental Variants:
  Header "Mossy Stone" (1,0): Stone floor with patches of dark green moss growing in the mortar lines and across some block surfaces. Damp atmosphere.
  Header "Wet Stone" (1,1): Stone floor with a wet sheen — subtle blue-grey reflective highlights on the surface. Small puddle in one corner.
  Header "Rubble" (1,2): Broken stone floor with scattered debris — crumbled blocks, small rock fragments, dust. A partially collapsed area.

ROW 2 — Wall Transition Tiles:
  Header "Wall Base N" (2,0): Stone floor on the south half transitioning to a wall base on the north half. The wall is darker, taller stone blocks with a visible baseboard ledge.
  Header "Wall Base S" (2,1): Wall base on the south half, stone floor on the north half. Reverse of Wall Base N.
  Header "Wall Corner" (2,2): Corner tile where two walls meet — wall base on the north and west edges, stone floor in the southeast quarter. An interior corner piece.`,
    },
    {
      id: 'desert-dunes',
      name: 'Desert Dunes',
      genre: 'Desert',
      gridSize: '4x4',
      description: 'Sandy desert tiles with dunes, rocky outcrops, and oasis transitions for arid environments.',
      colorNotes: 'Warm sandy tan and golden yellow for sand, reddish-brown for rock, dark brown shadows in dune valleys, blue-green for oasis water edges.',
      tileLabels: JSON.stringify([
        'Flat Sand 1', 'Flat Sand 2', 'Rippled Sand', 'Wind Swept',
        'Dune Crest N', 'Dune Crest S', 'Dune Shadow', 'Sand-Rock Mix',
        'Rocky Ground', 'Sandstone', 'Cracked Earth', 'Fossil',
        'Sand-Oasis Edge N', 'Sand-Oasis Edge S', 'Sand-Oasis Edge E', 'Sand-Oasis Edge W'
      ]),
      tileGuidance: `ROW 0 — Base Sand Tiles (seamlessly tileable):
  Header "Flat Sand 1" (0,0): Smooth flat sand with subtle grain texture. Warm tan color. The default desert ground tile.
  Header "Flat Sand 2" (0,1): Sand variant with slightly different grain pattern and a few small pebbles. Tiles with Flat Sand 1.
  Header "Rippled Sand" (0,2): Sand with visible wind ripple patterns running diagonally. Small parallel ridges across the surface.
  Header "Wind Swept" (0,3): Sand with wind-blown streaks and a thin layer of fine dust. Slightly lighter color with movement lines.

ROW 1 — Dune Features:
  Header "Dune Crest N" (1,0): A sand dune crest running across the north portion — elevated lighter sand catching light on the north side, darker shadow on the south side.
  Header "Dune Crest S" (1,1): Dune crest on the south portion. Shadow falls northward. Reverse lighting of Dune Crest N.
  Header "Dune Shadow" (1,2): The shadowed valley between dunes — darker warm brown sand. Tiles between Dune Crest tiles.
  Header "Sand-Rock Mix" (1,3): Sand with small rocks and pebbles scattered across the surface. Transition between pure sand and rocky areas.

ROW 2 — Rocky Desert Tiles:
  Header "Rocky Ground" (2,0): Hard-packed desert floor with exposed reddish-brown rock. Minimal sand. Rough texture.
  Header "Sandstone" (2,1): Flat sandstone surface with natural layered patterns visible. Warm reddish-tan. Smooth but weathered.
  Header "Cracked Earth" (2,2): Dried, cracked mud or clay surface — a polygon pattern of cracks revealing dry soil beneath. Parched and arid.
  Header "Fossil" (2,3): Sandy ground with a partially exposed fossil — a small spiral shell or bone fragment embedded in sandstone. A rare decorative tile.

ROW 3 — Sand-to-Oasis Edges:
  Header "Sand-Oasis Edge N" (3,0): Sand on the north half transitioning to wet dark earth and sparse grass on the south half. The edge of an oasis.
  Header "Sand-Oasis Edge S" (3,1): Wet earth and grass on the north half, sand on the south half. Reverse of Edge N.
  Header "Sand-Oasis Edge E" (3,2): Sand on the east half, oasis vegetation on the west half. Transition runs vertically.
  Header "Sand-Oasis Edge W" (3,3): Oasis vegetation on the east half, sand on the west half. Reverse of Edge E.`,
    },
    {
      id: 'snow-tundra',
      name: 'Snow Tundra',
      genre: 'Arctic',
      gridSize: '3x3',
      description: 'Frozen tundra tiles with snow, ice, and frozen ground for arctic and winter environments.',
      colorNotes: 'Pure white and blue-white for snow, light cyan and blue for ice, dark blue-grey for frozen rock, pale blue shadows.',
      tileLabels: JSON.stringify([
        'Snow 1', 'Snow 2', 'Deep Snow',
        'Ice Patch', 'Frozen Ground', 'Snow-Ice Edge',
        'Snowdrift N', 'Snowdrift S', 'Frozen Puddle'
      ]),
      tileGuidance: `ROW 0 — Base Snow Tiles (seamlessly tileable):
  Header "Snow 1" (0,0): Clean white snow with subtle blue shadow variation. Smooth, undisturbed surface. The default winter ground tile.
  Header "Snow 2" (0,1): Snow variant with a slightly different texture — some crystalline sparkle highlights. Tiles seamlessly with Snow 1.
  Header "Deep Snow" (0,2): Thicker snow with visible depth — softer, fluffier appearance with deeper blue-white shadows in depressions.

ROW 1 — Ice and Frozen Ground:
  Header "Ice Patch" (1,0): A frozen ice surface — smooth, reflective light cyan with white highlight streaks. Slippery appearance. Some hairline cracks visible.
  Header "Frozen Ground" (1,1): Hard frozen earth with a thin dusting of snow. Dark blue-grey ground showing through white frost. Rocky texture beneath.
  Header "Snow-Ice Edge" (1,2): Snow on one half transitioning to smooth ice on the other half. Natural boundary where snow meets a frozen lake or river.

ROW 2 — Features:
  Header "Snowdrift N" (2,0): A snowdrift piled against the north edge — deeper white snow mounded up, thinner on the south side. Wind-sculpted shape.
  Header "Snowdrift S" (2,1): Snowdrift against the south edge. Reverse of Snowdrift N. Mounded snow with wind-carved curves.
  Header "Frozen Puddle" (2,2): Snow ground with a small frozen puddle in the center — smooth ice circle surrounded by snow. A few bubbles trapped under the ice.`,
    },
    {
      id: 'volcanic-rock',
      name: 'Volcanic Rock',
      genre: 'Elemental',
      gridSize: '4x4',
      description: 'Volcanic terrain tiles with obsidian, lava flows, ash, and cooled magma for fiery environments.',
      colorNotes: 'Black and dark grey obsidian, bright orange-red for active lava, dark red for cooling lava, grey ash, amber ember glow.',
      tileLabels: JSON.stringify([
        'Obsidian 1', 'Obsidian 2', 'Basalt', 'Pumice',
        'Lava Flow H', 'Lava Flow V', 'Lava Pool', 'Cooling Lava',
        'Ash Ground', 'Scorched Earth', 'Ember Glow', 'Lava Crack',
        'Rock-Lava Edge N', 'Rock-Lava Edge S', 'Rock-Lava Edge E', 'Rock-Lava Edge W'
      ]),
      tileGuidance: `ROW 0 — Base Volcanic Rock (seamlessly tileable):
  Header "Obsidian 1" (0,0): Smooth black obsidian with glassy reflective highlights. The standard volcanic floor tile. Subtle purple-black sheen.
  Header "Obsidian 2" (0,1): Obsidian variant with slightly rougher texture and small embedded crystals. Tiles with Obsidian 1.
  Header "Basalt" (0,2): Rough dark grey basalt with columnar texture. Hexagonal crack patterns. Matte finish unlike obsidian.
  Header "Pumice" (0,3): Light grey porous volcanic rock with many tiny holes. Lighter and rougher than basalt.

ROW 1 — Active Lava Tiles:
  Header "Lava Flow H" (1,0): A horizontal stream of bright orange-red molten lava flowing left to right. Dark cooled edges frame the bright center channel.
  Header "Lava Flow V" (1,1): Vertical lava stream flowing top to bottom. Same bright orange-red molten center with dark crusted edges.
  Header "Lava Pool" (1,2): A bubbling pool of lava filling most of the tile. Bright orange center, darker red-black crust around edges. A bubble of gas bursting on the surface.
  Header "Cooling Lava" (1,3): Partially cooled lava — dark red-black surface with bright orange cracks showing molten rock beneath. A transitional state between flow and solid.

ROW 2 — Ash and Ember Tiles:
  Header "Ash Ground" (2,0): Grey volcanic ash covering the ground. Fine powdery texture. Footprint-like impressions visible. Muted and desolate.
  Header "Scorched Earth" (2,1): Blackened earth with char marks and heat distortion. Former vegetation reduced to ash outlines. Dark and devastated.
  Header "Ember Glow" (2,2): Dark ground with scattered glowing embers — small orange-red points of light in the cracks. Smoldering aftermath.
  Header "Lava Crack" (2,3): Solid dark rock with a bright orange lava crack running through it diagonally. Molten rock visible through the fissure.

ROW 3 — Rock-to-Lava Edge Transitions:
  Header "Rock-Lava Edge N" (3,0): Solid obsidian on the north half, lava flow on the south half. The rock edge is crumbling and glowing where it meets the molten lava.
  Header "Rock-Lava Edge S" (3,1): Lava on the north half, solid rock on the south half. Reverse of Edge N.
  Header "Rock-Lava Edge E" (3,2): Rock on the east half, lava on the west half. Vertical transition with glowing edge.
  Header "Rock-Lava Edge W" (3,3): Lava on the east half, rock on the west half. Reverse of Edge E.`,
    },
    {
      id: 'forest-floor',
      name: 'Forest Floor',
      genre: 'Nature',
      gridSize: '5x5',
      description: 'Dense forest floor tiles with moss, roots, leaf litter, clearings, and path transitions for woodland environments.',
      colorNotes: 'Deep greens for moss, rich browns for soil and roots, amber-gold for leaf litter, dappled yellow-green for light patches.',
      tileLabels: JSON.stringify([
        'Moss 1', 'Moss 2', 'Leaf Litter', 'Pine Needles', 'Fern Patch',
        'Root Tangle', 'Root Cross', 'Root Line H', 'Root Line V', 'Bare Soil',
        'Clearing 1', 'Clearing 2', 'Mushroom Ring', 'Fallen Log', 'Rock Outcrop',
        'Path H', 'Path V', 'Path Fork', 'Path Curve NE', 'Path Curve NW',
        'Forest-Grass Edge N', 'Forest-Grass Edge S', 'Forest-Grass Edge E', 'Forest-Grass Edge W', 'Forest-Grass Corner'
      ]),
      tileGuidance: `ROW 0 — Base Forest Floor (seamlessly tileable):
  Header "Moss 1" (0,0): Thick green moss covering the ground with tiny details — small sprouts, leaf fragments. The primary forest floor tile. Rich emerald green.
  Header "Moss 2" (0,1): Moss variant with slightly different pattern and a few fallen twigs. Tiles seamlessly with Moss 1.
  Header "Leaf Litter" (0,2): Fallen leaves in amber, gold, and brown scattered over dark soil. Autumn forest floor feel.
  Header "Pine Needles" (0,3): A carpet of brown-orange pine needles over dark soil. Conifer forest ground. Linear texture direction.
  Header "Fern Patch" (0,4): Small fern fronds growing from mossy ground. Bright green ferns add vertical texture interest to the forest floor.

ROW 1 — Root and Soil Tiles:
  Header "Root Tangle" (1,0): Thick tree roots crossing the tile in multiple directions. Dark brown roots over mossy soil. Complex interwoven pattern.
  Header "Root Cross" (1,1): Two large roots crossing in an X pattern. Dark brown over green-brown soil. Used at path intersections in root-heavy areas.
  Header "Root Line H" (1,2): A single thick root running horizontally across the tile. Mossy soil above and below.
  Header "Root Line V" (1,3): A single thick root running vertically. Mossy soil on both sides.
  Header "Bare Soil" (1,4): Exposed dark brown forest soil with minimal vegetation. A few small pebbles and leaf fragments. Used for clearings.

ROW 2 — Feature Tiles:
  Header "Clearing 1" (2,0): A sunlit clearing — lighter green grass with dappled light patches. Surrounded by darker forest floor tones at edges.
  Header "Clearing 2" (2,1): Clearing variant with a few wildflowers and lighter soil. Different dappled light pattern from Clearing 1.
  Header "Mushroom Ring" (2,2): Forest floor with a semicircle of small mushrooms — brown caps with white spots. Mossy ground. A fairy ring.
  Header "Fallen Log" (2,3): A section of fallen tree trunk lying across the tile. Moss-covered bark, decomposing. Soil visible beneath.
  Header "Rock Outcrop" (2,4): A flat stone surface breaking through the forest floor. Grey rock with moss at edges. Leaf litter collects around it.

ROW 3 — Forest Path Tiles:
  Header "Path H" (3,0): A worn dirt path running horizontally through forest floor. Packed brown earth, forest floor on top and bottom.
  Header "Path V" (3,1): Vertical dirt path through forest. Mossy edges, packed earth center.
  Header "Path Fork" (3,2): A path that splits into two directions — T-junction or Y-fork. Worn earth with forest floor in the gaps.
  Header "Path Curve NE" (3,3): Path curving from south to east. Packed earth follows a natural curve through mossy ground.
  Header "Path Curve NW" (3,4): Path curving from south to west. Mirror of Path Curve NE.

ROW 4 — Forest-to-Grassland Edge Transitions:
  Header "Forest-Grass Edge N" (4,0): Dense forest floor on the north half transitioning to open grass on the south half. Tree shadow fades into sunlight.
  Header "Forest-Grass Edge S" (4,1): Open grass on the north half, forest floor on the south half. Reverse of Edge N.
  Header "Forest-Grass Edge E" (4,2): Forest floor on the east half, grass on the west half. Vertical transition.
  Header "Forest-Grass Edge W" (4,3): Grass on the east half, forest floor on the west half. Reverse of Edge E.
  Header "Forest-Grass Corner" (4,4): Forest floor in the northeast corner, grass filling the rest. A convex corner transition where forest meets grassland.`,
    },
    {
      id: 'cracked-desert-wasteland',
      name: 'Cracked Desert Wasteland',
      genre: 'Post-Apocalyptic',
      gridSize: '4x4',
      description: 'Sun-baked post-nuclear earth with deep cracks, scattered debris, radiation pools, and dead brush for wasteland environments.',
      colorNotes: 'Parched tan and pale yellow cracked earth, dark brown crack lines, sickly yellow-green radiation pools, grey-brown dead brush, rust orange debris, bleached bone white.',
      tileLabels: JSON.stringify([
        'Cracked Earth 1', 'Cracked Earth 2', 'Deep Fissure', 'Scorched Ground',
        'Radiation Pool', 'Toxic Puddle', 'Dead Brush', 'Debris Scatter',
        'Rusted Metal', 'Bone Fragments', 'Tire Tracks', 'Blast Crater',
        'Wasteland-Road Edge N', 'Wasteland-Road Edge S', 'Wasteland-Road Edge E', 'Wasteland-Road Edge W'
      ]),
      tileGuidance: `ROW 0 — Base Wasteland Tiles (seamlessly tileable):
  Header "Cracked Earth 1" (0,0): Sun-baked pale tan earth with a polygon pattern of deep cracks. The standard wasteland ground tile. Dry, parched, and lifeless. Subtle heat shimmer implied by pale coloring.
  Header "Cracked Earth 2" (0,1): Variant cracked earth with different crack pattern and a few small pebbles. Same pale tan palette. Tiles seamlessly with Cracked Earth 1.
  Header "Deep Fissure" (0,2): A wide dark crack runs diagonally across the tile, deep enough to show darkness below. The surrounding earth is crumbling at the edges. More dramatic damage than base tiles.
  Header "Scorched Ground" (0,3): Blackened, charred earth from a nuclear blast or fire. Dark brown-black surface with ash residue. No cracks — the ground was melted smooth. Devastated.

ROW 1 — Hazard Tiles:
  Header "Radiation Pool" (1,0): A small pool of sickly yellow-green glowing liquid sitting in a depression. The surrounding cracked earth is stained darker. The pool surface has an oily, unnatural sheen. Lethal.
  Header "Toxic Puddle" (1,1): A smaller toxic puddle — murky brown-green water in a crack. Less glowing than the radiation pool but still dangerous. Dead insects float on the surface.
  Header "Dead Brush" (1,2): Cracked earth with a cluster of dead grey-brown brush — skeletal twigs and dried leaves. The only vegetation, and it is long dead. Desolate.
  Header "Debris Scatter" (1,3): Cracked earth with scattered pre-war debris — broken glass, twisted metal fragments, faded plastic. The remnants of civilization ground into the dirt.

ROW 2 — Feature Tiles:
  Header "Rusted Metal" (2,0): A rusted metal sheet or car panel partially buried in the cracked earth. Rust orange surface with flaking paint. A salvageable resource marker.
  Header "Bone Fragments" (2,1): Bleached white bone fragments scattered on the cracked earth. Animal or human bones sun-bleached to white. A grim reminder of what was lost.
  Header "Tire Tracks" (2,2): Twin parallel tire tracks pressed into the cracked earth, running top to bottom. Someone drove through recently. The tracks are the only sign of life.
  Header "Blast Crater" (2,3): A shallow circular depression — a small blast crater with darker scorched earth at the center and cracked debris around the rim. Evidence of past violence.

ROW 3 — Wasteland-to-Road Edge Transitions:
  Header "Wasteland-Road Edge N" (3,0): Cracked wasteland earth on the north half transitioning to broken asphalt road on the south half. The road edge crumbles into the dirt.
  Header "Wasteland-Road Edge S" (3,1): Broken asphalt on the north half, wasteland earth on the south half. Reverse of Edge N. Weeds push through the asphalt cracks.
  Header "Wasteland-Road Edge E" (3,2): Wasteland on the east half, broken road on the west half. Vertical transition with crumbling asphalt edge.
  Header "Wasteland-Road Edge W" (3,3): Broken road on the east half, wasteland on the west half. Reverse of Edge E.`,
    },
    {
      id: 'toxic-swamp',
      name: 'Toxic Swamp',
      genre: 'Post-Apocalyptic',
      gridSize: '4x4',
      description: 'Murky irradiated wetland tiles with glowing green water, dead trees, bubbling toxic surface, and fungal growths for contaminated swamp environments.',
      colorNotes: 'Murky dark green-brown water, sickly bright green glow in contaminated areas, grey-black dead tree trunks, pale bioluminescent fungi, dark mud brown, toxic yellow-green bubbles.',
      tileLabels: JSON.stringify([
        'Murky Water 1', 'Murky Water 2', 'Glowing Water', 'Bubbling Surface',
        'Mud Flat', 'Dead Tree Stump', 'Fallen Log', 'Fungal Growth',
        'Lily Pad Cluster', 'Toxic Algae', 'Bone Pile', 'Submerged Wreck',
        'Swamp-Land Edge N', 'Swamp-Land Edge S', 'Swamp-Land Edge E', 'Swamp-Land Edge W'
      ]),
      tileGuidance: `ROW 0 — Base Swamp Water (seamlessly tileable):
  Header "Murky Water 1" (0,0): Dark green-brown murky swamp water. The surface is opaque with floating organic matter. Subtle ripple texture. The standard toxic swamp tile. Unsettling and still.
  Header "Murky Water 2" (0,1): Variant murky water with slightly different surface debris and ripple pattern. Tiles seamlessly with Murky Water 1. A few more floating particles.
  Header "Glowing Water" (0,2): Swamp water with a sickly bright green glow emanating from below. The contaminated water illuminates from within. Radiation or chemical contamination. Beautiful and deadly.
  Header "Bubbling Surface" (0,3): Murky water with toxic yellow-green bubbles breaking the surface. Gas escaping from submerged decay. The bubbles pop and release wisps of toxic vapor. Active and dangerous.

ROW 1 — Solid Ground and Features:
  Header "Mud Flat" (1,0): Exposed dark brown mud between water areas. Wet, sticky surface with boot-print impressions. Small puddles of toxic water in depressions. Traversable but treacherous.
  Header "Dead Tree Stump" (1,1): A grey-black dead tree stump rising from the murky water. The trunk is bare and rotting. Fungal growths cling to the base. A landmark in the featureless swamp.
  Header "Fallen Log" (1,2): A dead tree trunk lying partially submerged in the swamp water. Grey-black bark peeling away. Moss and fungi cover the exposed wood. Could be used as a bridge.
  Header "Fungal Growth" (1,3): Mud or shallow water with a cluster of pale bioluminescent fungi. The mushrooms glow a soft blue-green. Toxic spores drift from the caps. Eerie and alien.

ROW 2 — Decorative Feature Tiles:
  Header "Lily Pad Cluster" (2,0): Murky water with mutant lily pads — oversized, slightly wrong in color (dark olive instead of bright green). Some have strange growths or holes. Post-apocalyptic vegetation.
  Header "Toxic Algae" (2,1): Water surface covered in a thick mat of toxic algae — bright yellow-green scum. The water beneath is invisible. The algae pulses faintly. A carpet of contamination.
  Header "Bone Pile" (2,2): Shallow murky water with a pile of animal bones rising above the surface. Bleached white against the dark water. Something was feeding here. Or something died here in numbers.
  Header "Submerged Wreck" (2,3): The top of a submerged vehicle or structure breaking the water surface. Rusted metal protrudes from the murky depths. Moss and algae cover the exposed parts. A pre-war relic swallowed by the swamp.

ROW 3 — Swamp-to-Land Edge Transitions:
  Header "Swamp-Land Edge N" (3,0): Murky swamp water on the north half transitioning to muddy solid ground on the south half. The waterline is irregular with reeds and debris.
  Header "Swamp-Land Edge S" (3,1): Muddy ground on the north half, swamp water on the south half. Reverse of Edge N. The ground slopes into the water.
  Header "Swamp-Land Edge E" (3,2): Swamp water on the east half, solid ground on the west half. Vertical transition with a muddy bank.
  Header "Swamp-Land Edge W" (3,3): Solid ground on the east half, swamp water on the west half. Reverse of Edge E.`,
    },
    {
      id: 'ruined-highway',
      name: 'Ruined Highway',
      genre: 'Post-Apocalyptic',
      gridSize: '4x4',
      description: 'Cracked and broken asphalt highway tiles with faded lane markings, rusted vehicle debris, and overgrown weeds pushing through the pavement.',
      colorNotes: 'Dark grey cracked asphalt, faded yellow and white lane markings, rust orange vehicle debris, dark green weeds in cracks, pale concrete for shoulder, brown dirt beneath broken pavement.',
      tileLabels: JSON.stringify([
        'Asphalt 1', 'Asphalt 2', 'Lane Markings H', 'Lane Markings V',
        'Pothole', 'Major Crack', 'Overgrown Section', 'Rusted Vehicle',
        'Guardrail', 'Road Sign', 'Debris Field', 'Oil Stain',
        'Road-Dirt Edge N', 'Road-Dirt Edge S', 'Road-Dirt Edge E', 'Road-Dirt Edge W'
      ]),
      tileGuidance: `ROW 0 — Base Road Tiles (seamlessly tileable):
  Header "Asphalt 1" (0,0): Dark grey cracked asphalt with small fractures and weathering. The standard broken road tile. Surface is rough and aged but mostly intact. Subtle variations in grey tones.
  Header "Asphalt 2" (0,1): Variant asphalt with different crack pattern and a small weed pushing through. Tiles seamlessly with Asphalt 1. Slightly lighter grey patches from sun bleaching.
  Header "Lane Markings H" (0,2): Asphalt with faded yellow or white lane markings running horizontally — dashed center line and solid edge line. The paint is flaking and barely visible. A ghost of order.
  Header "Lane Markings V" (0,3): Asphalt with faded lane markings running vertically. Dashed line in the center, solid at the edge. Same faded, forgotten paint.

ROW 1 — Damage Tiles:
  Header "Pothole" (1,0): A large pothole in the asphalt — a dark depression revealing layers of road base and brown dirt beneath. Crumbled edges. Water may collect here. A driving hazard.
  Header "Major Crack" (1,1): A wide crack splitting the asphalt diagonally. The crack is wide enough to see dirt and roots beneath. Weeds grow from the gap. The road is failing structurally.
  Header "Overgrown Section" (1,2): Asphalt nearly consumed by vegetation — dark green weeds, grass, and small bushes push through extensive cracks. Nature reclaiming the road. Barely recognizable as pavement.
  Header "Rusted Vehicle" (1,3): A rusted vehicle hulk sitting on the asphalt — a flattened, corroded car shell in rust orange and brown. Tires are flat discs. Windows are empty holes. A permanent road obstacle.

ROW 2 — Feature Tiles:
  Header "Guardrail" (2,0): A section of bent and rusted metal guardrail running across the tile. The posts lean at angles and the rail is dented. A road boundary marker long past its purpose.
  Header "Road Sign" (2,1): A fallen or leaning road sign on cracked asphalt. The sign face is faded and unreadable — maybe a speed limit or direction. The metal pole is rusted. A landmark.
  Header "Debris Field" (2,2): Asphalt covered with scattered debris — broken glass, twisted metal, plastic fragments, and scattered personal items. The aftermath of a crash or abandonment. Cluttered and sad.
  Header "Oil Stain" (2,3): Asphalt with a large dark oil stain — an iridescent dark patch where a vehicle leaked its lifeblood. The stain has been baked in by years of sun. A permanent scar.

ROW 3 — Road-to-Dirt Edge Transitions:
  Header "Road-Dirt Edge N" (3,0): Cracked asphalt on the north half breaking apart into bare dirt and gravel on the south half. The road edge crumbles. Weeds grow in the transition zone.
  Header "Road-Dirt Edge S" (3,1): Bare dirt and gravel on the north half, broken asphalt road on the south half. Reverse of Edge N. The pavement emerges from the wasteland.
  Header "Road-Dirt Edge E" (3,2): Asphalt on the east half, dirt on the west half. Vertical transition with crumbling road shoulder. Gravel scatter at the boundary.
  Header "Road-Dirt Edge W" (3,3): Dirt on the east half, asphalt on the west half. Reverse of Edge E. The road edge is defined by a line of broken concrete chunks.`,
    },
    {
      id: 'organic-hive-floor',
      name: 'Organic Hive Floor',
      genre: 'Sci-Fi Horror',
      gridSize: '4x4',
      description: 'Resin-coated metal floor tiles with organic alien growth, acid burn marks, and cocooned debris for xenomorph hive interiors.',
      colorNotes: 'Dark brown-black hardened resin over gunmetal grating, ridged organic growths in dark grey-brown, acid-green burn marks and residue, pale grey-white cocoon material, dim amber bioluminescent patches.',
      tileLabels: JSON.stringify([
        'Resin Floor 1', 'Resin Floor 2', 'Metal Grating', 'Resin-Metal Mix',
        'Organic Ridge H', 'Organic Ridge V', 'Ridge Junction', 'Acid Burn',
        'Cocoon Debris', 'Egg Base', 'Bioluminescent Patch', 'Secretion Pool',
        'Hive-Metal Edge N', 'Hive-Metal Edge S', 'Hive-Metal Edge E', 'Hive-Metal Edge W'
      ]),
      tileGuidance: `ROW 0 — Base Floor Tiles (seamlessly tileable):
  Header "Resin Floor 1" (0,0): Dark brown-black hardened resin coating over a metal floor. The resin surface is smooth and glossy with subtle organic texture. The standard hive floor tile. Occasionally a glint of metal shows through thin spots.
  Header "Resin Floor 2" (0,1): Variant resin floor with slightly different organic texture and a few small bumps of hardened secretion. Tiles seamlessly with Resin Floor 1. Slightly thicker resin coating.
  Header "Metal Grating" (0,2): Exposed gunmetal industrial grating — the metal floor before organic takeover. Grid pattern with dark gaps between bars. Clean but cold and industrial.
  Header "Resin-Metal Mix" (0,3): Transition tile — metal grating partially covered by encroaching resin. The organic material creeps across the metal in tendrils. The boundary between civilization and infestation.

ROW 1 — Organic Growth Features:
  Header "Organic Ridge H" (1,0): A raised ridge of hardened organic growth running horizontally across the tile. Dark grey-brown with ribbed texture. The ridge rises from the resin floor like a biological pipeline.
  Header "Organic Ridge V" (1,1): A vertical organic ridge running top to bottom. Same ribbed dark grey-brown texture. These ridges form the structural supports of the hive.
  Header "Ridge Junction" (1,2): A junction where multiple organic ridges meet — an intersection of ribbed growths forming a biomechanical node. Slightly larger mound at the center. A structural nexus.
  Header "Acid Burn" (1,3): Resin floor with acid-green burn marks — sizzling holes melted through the resin and into the metal below. Acid blood residue drips. Evidence of combat or injury. The burn edges glow faintly green.

ROW 2 — Feature Tiles:
  Header "Cocoon Debris" (2,0): Fragments of broken cocoon material scattered on the resin floor — pale grey-white fibrous strands and hardened resin chunks. Someone or something broke free. Disturbing evidence.
  Header "Egg Base" (2,1): The resin floor prepared for egg placement — a shallow depression with a textured organic base. Amber bioluminescent spots mark the prepared area. An egg may have been here or is coming.
  Header "Bioluminescent Patch" (2,2): A patch of the resin floor that glows with dim amber bioluminescence. The organic material pulses with faint light. These patches serve as the hive's lighting system. Warm but unsettling.
  Header "Secretion Pool" (2,3): A small pool of fresh organic secretion on the resin floor — translucent amber-brown liquid with a viscous surface. Fresh resin not yet hardened. The hive is actively growing.

ROW 3 — Hive-to-Metal Edge Transitions:
  Header "Hive-Metal Edge N" (3,0): Organic resin hive floor on the north half transitioning to clean metal grating on the south half. The resin edge creeps outward with tendrils reaching across the metal. The infestation boundary.
  Header "Hive-Metal Edge S" (3,1): Clean metal on the north half, organic hive floor on the south half. Reverse of Edge N. The organic growth is advancing northward.
  Header "Hive-Metal Edge E" (3,2): Hive floor on the east half, metal on the west half. Vertical transition with organic tendrils crossing the boundary.
  Header "Hive-Metal Edge W" (3,3): Metal on the east half, hive floor on the west half. Reverse of Edge E. The clean industrial world giving way to alien biology.`,
    },
    {
      id: 'industrial-grating',
      name: 'Industrial Grating',
      genre: 'Sci-Fi Horror',
      gridSize: '4x4',
      description: 'Metal walkway and utility corridor floor tiles with steam vents, dripping condensation, and cable runs for space station and industrial horror environments.',
      colorNotes: 'Gunmetal grey and dark steel grating, yellow-black hazard stripes, white steam wisps, blue-grey condensation drips, dark cable insulation, amber warning light patches.',
      tileLabels: JSON.stringify([
        'Grating 1', 'Grating 2', 'Solid Plate', 'Diamond Plate',
        'Steam Vent', 'Drain Grate', 'Cable Run H', 'Cable Run V',
        'Hazard Stripe H', 'Hazard Stripe V', 'Access Hatch', 'Condensation Pool',
        'Grating-Plate Edge N', 'Grating-Plate Edge S', 'Grating-Plate Edge E', 'Grating-Plate Edge W'
      ]),
      tileGuidance: `ROW 0 — Base Floor Tiles (seamlessly tileable):
  Header "Grating 1" (0,0): Standard gunmetal grey industrial grating — parallel bars with dark gaps showing pipes and conduits below. The standard corridor floor. Clean but industrial. Slight blue-grey sheen from overhead lighting.
  Header "Grating 2" (0,1): Variant grating with slightly different bar spacing and a few water drops on the surface. Tiles seamlessly with Grating 1. One bar is slightly bent.
  Header "Solid Plate" (0,2): A solid dark steel floor plate — smooth with bolt heads at the corners. Used for heavy equipment areas. No gaps. Darker than the grating.
  Header "Diamond Plate" (0,3): Raised diamond-pattern anti-slip floor plate. The standard industrial anti-slip surface. Subtle texture catch from overhead light. Heavier duty than basic grating.

ROW 1 — Utility Features:
  Header "Steam Vent" (1,0): A circular steam vent grate in the floor — a cloud of white steam wisps rising upward. The vent grate is a circular pattern of holes. The steam partially obscures the surrounding floor. Hot and humid.
  Header "Drain Grate" (1,1): A larger drain grate set into the floor — dark recessed grid with condensation dripping in. Slight rust around the edges. Water collects and drips through the gaps.
  Header "Cable Run H" (1,2): Grating with a bundle of insulated cables running horizontally across the surface. Cables are dark with colored bands at intervals. Secured with metal clamps to the grating.
  Header "Cable Run V" (1,3): Cable bundle running vertically top to bottom across the grating. Same dark insulated cables with clamps. Used for wiring-heavy corridor sections.

ROW 2 — Feature Tiles:
  Header "Hazard Stripe H" (2,0): Floor with a yellow-black hazard stripe band running horizontally across the center. Warning paint on either grating or solid plate. Marks a danger zone boundary.
  Header "Hazard Stripe V" (2,1): Vertical yellow-black hazard stripe running top to bottom. Same industrial warning paint marking a boundary or restricted area.
  Header "Access Hatch" (2,2): A square access hatch in the floor — a hinged plate with a recessed handle and locking mechanism. Yellow-black hazard marking around the edge. Leads to maintenance areas below.
  Header "Condensation Pool" (2,3): Grating with a shallow pool of collected condensation — blue-grey water reflecting overhead lights. The surrounding grating is wet and slightly discolored. Dripping from above.

ROW 3 — Grating-to-Plate Edge Transitions:
  Header "Grating-Plate Edge N" (3,0): Open grating on the north half transitioning to solid plate on the south half. A structural beam marks the boundary. The grating shows pipes below while the plate is sealed.
  Header "Grating-Plate Edge S" (3,1): Solid plate on the north half, grating on the south half. Reverse of Edge N. The transition from sealed to open flooring.
  Header "Grating-Plate Edge E" (3,2): Grating on the east half, solid plate on the west half. Vertical transition with a structural beam.
  Header "Grating-Plate Edge W" (3,3): Solid plate on the east half, grating on the west half. Reverse of Edge E.`,
    },
    {
      id: 'alien-planet-surface',
      name: 'Alien Planet Surface',
      genre: 'Sci-Fi Horror',
      gridSize: '4x4',
      description: 'Hostile extraterrestrial landscape tiles with jagged dark rock, bioluminescent pools, alien vegetation, and toxic atmospheric effects.',
      colorNotes: 'Dark charcoal and purple-black jagged rock, bright cyan-blue bioluminescent pools, alien magenta and teal vegetation, toxic yellow-green atmosphere wisps, pale bone-white mineral deposits.',
      tileLabels: JSON.stringify([
        'Alien Rock 1', 'Alien Rock 2', 'Jagged Formation', 'Smooth Basalt',
        'Bioluminescent Pool', 'Toxic Vent', 'Alien Fungi', 'Tendril Growth',
        'Mineral Deposit', 'Fossil Imprint', 'Spore Cluster', 'Acid Erosion',
        'Rock-Pool Edge N', 'Rock-Pool Edge S', 'Rock-Pool Edge E', 'Rock-Pool Edge W'
      ]),
      tileGuidance: `ROW 0 — Base Rock Tiles (seamlessly tileable):
  Header "Alien Rock 1" (0,0): Dark charcoal alien rock with a subtle purple-black sheen. The texture is unlike earthly stone — angular fractures with glassy smooth surfaces between them. The standard alien ground tile. Cold and lifeless.
  Header "Alien Rock 2" (0,1): Variant alien rock with different fracture pattern and a few pale mineral veins running through the surface. Tiles seamlessly with Alien Rock 1. Slightly more purple tint.
  Header "Jagged Formation" (0,2): Sharp, upward-pointing rock formations jutting from the surface. Dark charcoal spires with crystalline tips. The ground between the formations is rough. Treacherous terrain.
  Header "Smooth Basalt" (0,3): Polished-smooth alien basalt — very dark with a glassy surface reflecting faint light. Unlike rough rock, this surface is eerily perfect. As if melted and resolidified.

ROW 1 — Hazard and Life Tiles:
  Header "Bioluminescent Pool" (1,0): A small pool of bright cyan-blue glowing liquid in a rock depression. The light illuminates the surrounding dark rock. The liquid surface is perfectly still and reflective. Beautiful but of unknown origin.
  Header "Toxic Vent" (1,1): A crack in the alien rock releasing yellow-green toxic gas wisps. The gas rises from below and the rock edges are stained and corroded. The atmosphere is poisonous. Stay clear.
  Header "Alien Fungi" (1,2): Clusters of alien mushroom-like growths sprouting from the rock. Magenta caps with teal bioluminescent gills. Short, thick stalks. Unlike any earthly organism. Possibly dangerous.
  Header "Tendril Growth" (1,3): Dark organic tendrils growing across the rock surface — biomechanical vines that seem to be exploring the terrain. Teal-green with segmented ridges. Are they plant or animal? They pulse faintly.

ROW 2 — Feature Tiles:
  Header "Mineral Deposit" (2,0): A cluster of pale bone-white crystalline minerals erupting from the dark rock. The crystals glow faintly from within. Possibly valuable or possibly a trap. Sharp-edged and geometric.
  Header "Fossil Imprint" (2,1): The dark rock surface shows a large fossil imprint — the outline of an alien creature preserved in stone. Multiple limbs, an elongated skull. Ancient. The shape is disturbingly familiar.
  Header "Spore Cluster" (2,2): Small bioluminescent spore pods scattered across the rock surface. Each pod is a tiny magenta sphere that releases invisible spores. The air above shimmers faintly with released particles.
  Header "Acid Erosion" (2,3): Alien rock that has been eroded by natural acid — smooth, flowing channels cut into the dark surface revealing lighter purple-grey stone beneath. The acid is gone but its marks remain.

ROW 3 — Rock-to-Pool Edge Transitions:
  Header "Rock-Pool Edge N" (3,0): Dark alien rock on the north half transitioning to bioluminescent pool on the south half. The rock edge glows cyan where it meets the luminous liquid. Crystals form at the waterline.
  Header "Rock-Pool Edge S" (3,1): Bioluminescent pool on the north half, alien rock on the south half. Reverse of Edge N. The glowing liquid laps at the dark stone.
  Header "Rock-Pool Edge E" (3,2): Rock on the east half, glowing pool on the west half. Vertical transition with cyan light illuminating the nearby rock face.
  Header "Rock-Pool Edge W" (3,3): Glowing pool on the east half, rock on the west half. Reverse of Edge E. The cyan light creates an eerie glow on the dark stone surface.`,
    },
  ];

  const insert = db.prepare(
    `INSERT OR IGNORE INTO terrain_presets (id, name, genre, grid_size, description, color_notes, tile_labels, tile_guidance, is_preset)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const insertAll = db.transaction(() => {
    for (const p of PRESETS) {
      insert.run(p.id, p.name, p.genre, p.gridSize, p.description, p.colorNotes, p.tileLabels, p.tileGuidance);
    }
  });

  insertAll();
  console.log(`[DB] Seeded ${PRESETS.length} terrain presets.`);

  // Create a grid preset per terrain content preset with real tile labels, then link
  const insertGrid = db.prepare(`
    INSERT OR IGNORE INTO grid_presets (name, sprite_type, genre, grid_size, cols, rows, cell_labels, cell_groups, generic_guidance, bg_mode, is_preset)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const findGrid = db.prepare("SELECT id FROM grid_presets WHERE name = ? AND sprite_type = 'terrain' AND grid_size = ?");
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO terrain_grid_links (terrain_preset_id, grid_preset_id, guidance_override, sort_order)
    VALUES (?, ?, ?, 0)
  `);
  const TERRAIN_GUIDANCE = `Each cell in the grid has a WHITE TEXT HEADER naming the tile type. All tiles must share the same art style, color palette, and scale. Edge and corner tiles must seamlessly connect with adjacent base tiles. Each row represents a thematic group.`;
  const terrainSizeToDims = { '4x4': [4,4], '3x3': [3,3], '5x5': [5,5] };
  const linkAll = db.transaction(() => {
    for (const p of PRESETS) {
      const [cols, rows] = terrainSizeToDims[p.gridSize] || [4, 4];
      const _labels = JSON.parse(p.tileLabels);
      const cellGroups = [];
      for (let r = 0; r < rows; r++) {
        const cells = [];
        for (let c = 0; c < cols; c++) cells.push(r * cols + c);
        cellGroups.push({ name: `Row ${r + 1}`, cells });
      }
      insertGrid.run(p.name, 'terrain', p.genre, p.gridSize, cols, rows,
        p.tileLabels, JSON.stringify(cellGroups), TERRAIN_GUIDANCE, null);
      const gridRow = findGrid.get(p.name, p.gridSize);
      if (gridRow) insertLink.run(p.id, gridRow.id, p.tileGuidance || '');
    }
  });
  linkAll();
  console.log(`[DB] Seeded terrain grid presets + links.`);
}
