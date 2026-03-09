export function seedBuildingPresets(db) {
  const PRESETS = [
    {
      id: 'medieval-inn',
      name: 'Medieval Inn',
      genre: 'Classic Fantasy',
      gridSize: '3x3',
      description: 'A cozy two-story medieval inn with a thatched roof, stone chimney, and a wooden sign hanging from an iron bracket. Warm light spills from the windows.',
      details: 'Stone foundation, timber-framed walls with whitewash plaster, dark wooden beams. A wooden door with iron hinges at ground level. Second-floor balcony with flower boxes.',
      colorNotes: 'Warm browns and tans for wood, grey stone foundation, golden-yellow window glow, dark green trim.',
      cellLabels: JSON.stringify([
        'Day - Idle', 'Day - Smoke Rising', 'Day - Sign Swaying',
        'Evening - Lights On', 'Evening - Chimney Glow', 'Evening - Busy',
        'Night - Lantern Lit', 'Night - Quiet', 'Night - Closed'
      ]),
      cellGuidance: `ROW 0 — Daytime Activity:
  Header "Day - Idle" (0,0): The inn in full daylight. Warm sun illuminates the thatched roof and timber walls. Windows reflect blue sky. Door is open. Quiet, peaceful.
  Header "Day - Smoke Rising" (0,1): Same daytime view but a thin trail of grey smoke rises from the stone chimney. Kitchen is active. Small detail change from Idle.
  Header "Day - Sign Swaying" (0,2): Same daytime view but the hanging wooden sign tilts slightly to the right as if caught by a breeze. Sign text is too small to read at pixel scale.

ROW 1 — Evening Transition:
  Header "Evening - Lights On" (1,0): Dusk sky tones (purple-orange). All windows now glow warm golden-yellow from interior candles and hearth. The facade is slightly darker.
  Header "Evening - Chimney Glow" (1,1): Evening view with a warm orange glow emanating from the chimney top. More smoke than daytime. Windows still warmly lit.
  Header "Evening - Busy" (1,2): Evening with multiple warm-lit windows and a small figure silhouette visible in the doorway. The inn looks welcoming and active.

ROW 2 — Nighttime:
  Header "Night - Lantern Lit" (2,0): Dark night sky with stars. A single lantern glows beside the front door. Few windows still lit with dim warm light. Mostly dark facade.
  Header "Night - Quiet" (2,1): Deep night. Only one upstairs window has a faint glow. The lantern beside the door flickers. Very dark and atmospheric.
  Header "Night - Closed" (2,2): Full night, all lights extinguished. The inn is a dark silhouette with just starlight reflecting off the roof. Completely still.`,
    },
    {
      id: 'castle-tower',
      name: 'Castle Tower',
      genre: 'Classic Fantasy',
      gridSize: '2x2',
      description: 'A tall stone castle tower with crenellated battlements, narrow arrow-slit windows, and a blue pennant flag at the peak.',
      details: 'Grey stone block construction, moss growing on lower sections, a wooden door with iron reinforcement at the base. Spiral staircase window slits visible along the height.',
      colorNotes: 'Cool greys for stone, dark green moss patches, royal blue pennant, brown wooden door.',
      cellLabels: JSON.stringify([
        'Day', 'Night',
        'Damaged', 'Ruined'
      ]),
      cellGuidance: `ROW 0 — Time of Day:
  Header "Day" (0,0): The tower in bright daylight. Clean stone walls catch sunlight on the left side. Blue pennant waves in the breeze. Arrow slits are dark.
  Header "Night" (0,1): The tower under moonlight. A cool blue-grey cast over the stone. A single torch flickers at the top of the battlements. Pennant barely visible.

ROW 1 — Damage States:
  Header "Damaged" (1,0): The tower has taken battle damage. Cracks run through the upper stonework, two blocks are missing from the battlements. The pennant is torn. Scorch marks around an arrow slit.
  Header "Ruined" (1,1): The tower is a ruin. The top third has collapsed, leaving jagged broken walls. No pennant. Vines and moss cover exposed surfaces. Rubble at the base.`,
    },
    {
      id: 'space-station-module',
      name: 'Space Station Module',
      genre: 'Sci-Fi',
      gridSize: '2x3',
      description: 'A cylindrical space station module with metallic hull plating, glowing blue viewport windows, and antenna arrays on top.',
      details: 'Brushed metal hull with panel seam lines, a circular airlock hatch on one side, solar panel wing extending from the right side, blinking navigation lights.',
      colorNotes: 'Silver and light grey hull, blue glowing viewports, red and green navigation lights, dark solar panels with blue accents.',
      cellLabels: JSON.stringify([
        'Normal - Frame 1', 'Normal - Frame 2',
        'Alert - Frame 1', 'Alert - Frame 2',
        'Damaged', 'Destroyed'
      ]),
      cellGuidance: `ROW 0 — Normal Operation (loop 1→2→1):
  Header "Normal - Frame 1" (0,0): The module in standard operation. Viewports glow steady blue. Navigation lights: green on right, red on left. Antenna array points upward.
  Header "Normal - Frame 2" (0,1): Subtle animation frame — navigation lights blink (swap positions or dim), antenna tilts very slightly. Viewport glow unchanged.

ROW 1 — Alert Mode (loop 1→2→1):
  Header "Alert - Frame 1" (1,0): Red alert mode. Viewports pulse orange-red instead of blue. A rotating amber warning light is visible on top. Hull unchanged.
  Header "Alert - Frame 2" (1,1): Alert animation frame — warning light rotated to opposite side, viewport glow slightly dimmer (pulse trough). Tense atmosphere.

ROW 2 — Damage Progression:
  Header "Damaged" (2,0): Hull breach on the upper left section — torn metal plates and sparks. One viewport is dark/cracked. Solar panel bent at an angle. Some debris floating nearby.
  Header "Destroyed" (2,1): The module is wrecked. Hull split open exposing interior compartments. All viewports dark. Solar panel detached. Sparks and small fires. Debris cloud.`,
    },
    {
      id: 'ancient-tree',
      name: 'Ancient Tree',
      genre: 'Nature',
      gridSize: '3x3',
      description: 'A massive ancient oak tree with a thick gnarled trunk, spreading canopy of leaves, and visible root system above ground.',
      details: 'Trunk is wide enough for a door-sized hollow at the base. Branches spread in all directions forming a broad canopy. Thick roots break through the soil around the base.',
      colorNotes: 'Dark brown trunk, varied greens for leaves (spring=bright, summer=deep, autumn=orange/red), bare grey-brown branches in winter.',
      cellLabels: JSON.stringify([
        'Spring', 'Summer', 'Autumn',
        'Winter', 'Enchanted', 'Corrupted',
        'Sapling', 'Ancient', 'Dead'
      ]),
      cellGuidance: `ROW 0 — Seasons (bright conditions):
  Header "Spring" (0,0): The tree in early spring with fresh bright-green leaves just emerging. Small white blossoms scattered in the canopy. Light green grass at the base.
  Header "Summer" (0,1): Full summer canopy — dense deep-green foliage. The tree is at its most lush and full. Dappled sunlight visible. Rich green grass below.
  Header "Autumn" (0,2): Autumn colors — leaves in oranges, reds, and golds. Some leaves falling. A few bare branch tips visible through the thinning canopy.

ROW 1 — Special Variants:
  Header "Winter" (1,0): Bare winter branches covered in a light dusting of snow. No leaves. The trunk's texture and gnarled shape are fully visible. Snow on the ground.
  Header "Enchanted" (1,1): The tree glows with magical energy. Small motes of light float among summer-green leaves. The hollow at the base emits a soft golden glow.
  Header "Corrupted" (1,2): Dark twisted version. Leaves are sickly purple-black. The trunk has dark veins of corruption. The ground around it is dead and grey.

ROW 2 — Life Stages:
  Header "Sapling" (2,0): A young version of the tree — thin trunk, small canopy, only a few branches. Fresh and bright green. No hollow yet.
  Header "Ancient" (2,1): Extremely old version — massive trunk, sprawling roots, heavy moss and lichen. Canopy is enormous. A wise, weathered presence.
  Header "Dead" (2,2): The tree has died. Bare grey branches, cracked dry trunk, no leaves. Some branches have broken off. Dry ground with dead grass.`,
    },
    {
      id: 'blacksmith-shop',
      name: 'Blacksmith Shop',
      genre: 'Village',
      gridSize: '3x3',
      description: 'A sturdy blacksmith workshop with an open-air forge, a large anvil visible inside, and a shingled roof with a wide chimney billowing smoke.',
      details: 'Stone and brick construction with heavy wooden support beams. Open front wall exposes the forge and anvil. Weapon and tool racks on the back wall. Bellows beside the forge.',
      colorNotes: 'Dark red-brown brick, grey stone, orange forge glow, dark iron anvil and tools, brown wooden beams.',
      cellLabels: JSON.stringify([
        'Idle', 'Forge Lit', 'Sparks Flying',
        'Light Damage', 'Heavy Damage', 'Destroyed',
        'Day', 'Afternoon', 'Night'
      ]),
      cellGuidance: `ROW 0 — Activity States (loop Idle→Forge Lit→Sparks→Forge Lit):
  Header "Idle" (0,0): The shop at rest. Forge is cold/dark, no smoke from chimney. Tools hang neatly on racks. The anvil sits empty. Quiet and still.
  Header "Forge Lit" (0,1): The forge is burning — warm orange glow illuminates the interior. Smoke rises from the chimney. The bellows are compressed, ready.
  Header "Sparks Flying" (0,2): Active forging — bright sparks spray from the anvil area. Forge blazes hot white-orange. Heavy smoke billows from chimney. The most active frame.

ROW 1 — Damage Progression:
  Header "Light Damage" (1,0): Minor battle damage. Some roof shingles displaced, a crack in the front wall. Forge is out. One tool rack has fallen. Still structurally sound.
  Header "Heavy Damage" (1,1): Severe damage. Part of the roof has collapsed. The front wall has a large breach. Anvil toppled. Soot and char marks everywhere.
  Header "Destroyed" (1,2): The shop is ruined. Most of the roof gone, walls crumbled to half-height. The forge is a pile of rubble. Charred beams. Only the chimney partially stands.

ROW 2 — Time of Day:
  Header "Day" (2,0): Bright daylight. The shop is open and ready for business. Forge has a warm glow. Clear lighting, sharp shadows.
  Header "Afternoon" (2,1): Golden hour lighting — warm amber light from the right. Long shadows. The forge glow is less visible against the warm ambient light.
  Header "Night" (2,2): Night scene with the forge as the main light source. Warm orange glow spills outward. Everything outside the forge-light is dark blue-grey shadow.`,
    },
    {
      id: 'haunted-cathedral',
      name: 'Haunted Cathedral',
      genre: 'Dark Fantasy',
      gridSize: '2x3',
      description: 'A Gothic cathedral with pointed arched windows, a tall spire, flying buttresses, and an ominous atmosphere with cracked stonework and overgrown vines.',
      details: 'Dark stone construction with ornate Gothic architectural details. Large rose window on the front facade. Double wooden doors, one hanging ajar. Gargoyles perch on corners.',
      colorNotes: 'Dark grey and charcoal stone, deep purple stained glass glow, sickly green vine overgrowth, pale moonlight blues.',
      cellLabels: JSON.stringify([
        'Day - Abandoned', 'Day - Haunted',
        'Dusk - Eerie Glow', 'Dusk - Spirits',
        'Night - Dark', 'Night - Possessed'
      ]),
      cellGuidance: `ROW 0 — Daytime States:
  Header "Day - Abandoned" (0,0): The cathedral in daylight but clearly long-abandoned. Cracked walls, overgrown vines, broken windows. Still imposing but desolate. No supernatural elements.
  Header "Day - Haunted" (0,1): Same daytime view but with subtle supernatural hints — a faint ghostly wisp near the doorway, one window glowing faintly purple from inside.

ROW 1 — Dusk Transition:
  Header "Dusk - Eerie Glow" (1,0): Twilight sky. The rose window now glows an unsettling purple. A faint green mist creeps along the ground at the cathedral base.
  Header "Dusk - Spirits" (1,1): Dusk with ghostly figures barely visible near the windows and entrance. The purple glow is brighter. Small spectral orbs float around the spire.

ROW 2 — Night Horror:
  Header "Night - Dark" (2,0): Deep night. The cathedral is a menacing dark silhouette against a moonlit sky. Only the rose window pulses with a dim, rhythmic purple glow.
  Header "Night - Possessed" (2,1): Full supernatural event — the cathedral glows from within with intense purple and green light. Spectral energy crackles around the spire. Ghostly faces in windows. The ground mist is thick and glowing.`,
    },
    {
      id: 'cyberpunk-noodle-shop',
      name: 'Cyberpunk Noodle Shop',
      genre: 'Cyberpunk',
      gridSize: '3x3',
      description: 'A cramped street-level noodle shop with a glowing neon sign, steam vents, and a roll-up metal shutter. Wedged between towering megastructures.',
      details: 'Corrugated metal walls plastered with holographic ads. A serving counter with bar stools faces the street. Overhead cables and pipes run across the facade. A flickering neon bowl-and-chopsticks sign hangs above.',
      colorNotes: 'Hot pink and cyan neon, dark gunmetal walls, warm orange interior light, purple holographic ad accents, yellow steam highlights.',
      cellLabels: JSON.stringify([
        'Open - Idle', 'Open - Steam Burst', 'Open - Neon Flicker',
        'Busy Hour', 'Rain - Reflections', 'Rain - Heavy',
        'Closed - Shuttered', 'Closed - Neon Only', 'Power Outage'
      ]),
      cellGuidance: `ROW 0 — Open for Business:
  Header "Open - Idle" (0,0): The shop is open, shutter rolled up. Warm orange light spills from inside. Neon sign glows steady pink-cyan. A wisp of steam rises from the kitchen vent. Calm street scene.
  Header "Open - Steam Burst" (0,1): A burst of white-yellow steam erupts from the kitchen vent, partially obscuring the upper facade. Neon sign visible through the haze. Interior still warmly lit.
  Header "Open - Neon Flicker" (0,2): The neon sign blinks — the bowl portion is dark, only chopsticks glow cyan. One holographic ad on the wall glitches. Otherwise same as Idle.

ROW 1 — Atmosphere Variants:
  Header "Busy Hour" (1,0): Peak hour — warm glow is brighter, more steam, small silhouette figures visible at the counter stools. The neon sign blazes at full intensity. Lively energy.
  Header "Rain - Reflections" (1,1): Light rain. Puddles on the ground reflect the neon pink and cyan. Rain streaks visible against the dark walls. Interior glow creates warm contrast.
  Header "Rain - Heavy" (1,2): Heavy downpour. Rain is dense, partially obscuring the facade. Neon colors bleed and streak in the rain. Steam mixes with rain vapor. Moody and atmospheric.

ROW 2 — Closed States:
  Header "Closed - Shuttered" (2,0): Metal shutter is down. The neon sign is off. Holographic ads still flicker faintly. Dark and quiet. Only ambient city-glow illuminates the wet metal.
  Header "Closed - Neon Only" (2,1): Shutter down but the neon sign still glows — a beacon in the dark alley. The pink-cyan light reflects off the metal shutter. Everything else dark.
  Header "Power Outage" (2,2): Complete darkness. No neon, no ads, no interior light. The shop is a dark metallic shape. Only faint moonlight/ambient highlights the corrugated edges.`,
    },
    {
      id: 'desert-pyramid',
      name: 'Desert Pyramid',
      genre: 'Ancient',
      gridSize: '2x2',
      description: 'A weathered sandstone step pyramid rising from desert dunes, with hieroglyphic carvings on the entrance facade and a golden capstone at the peak.',
      details: 'Four-stepped pyramid with smooth sandstone blocks. A dark entrance doorway at the base center flanked by carved pillars. Hieroglyphic panels on either side. Wind-worn edges. Sand drifts against the lower steps.',
      colorNotes: 'Sandy tan and warm ochre stone, golden capstone catching sunlight, dark entrance shadow, faded turquoise and red hieroglyphic paint traces.',
      cellLabels: JSON.stringify([
        'Day - Intact', 'Day - Excavated',
        'Curse Active', 'Sandstorm'
      ]),
      cellGuidance: `ROW 0 — Archaeological States:
  Header "Day - Intact" (0,0): The pyramid in bright desert sunlight. Clean sandstone glowing warm. Golden capstone gleams. Sand dunes around the base. Clear blue sky implied by lighting. Sharp shadows on stepped surfaces.
  Header "Day - Excavated" (0,1): Same daylight pyramid but with archaeological scaffolding on one side. Exposed hieroglyphic panel cleaned to reveal vivid turquoise and red paint. Dig trenches at the base expose buried lower steps.

ROW 1 — Supernatural/Environmental:
  Header "Curse Active" (1,0): The pyramid's entrance glows with an eerie green-gold light. Hieroglyphics pulse faintly. The golden capstone emits a beam of light upward. Sand around the base levitates slightly. Ominous atmosphere.
  Header "Sandstorm" (1,1): A sandstorm engulfs the pyramid. Dense tan-brown sand swirls obscure the lower half. Only the upper steps and golden capstone peek through the storm. Wind-driven sand streaks across the frame.`,
    },
    {
      id: 'underwater-coral-shrine',
      name: 'Underwater Coral Shrine',
      genre: 'Aquatic Fantasy',
      gridSize: '2x3',
      description: 'A submerged shrine built from living coral and seashells, with bioluminescent algae providing an ethereal glow. Ancient stone archway at the center.',
      details: 'A stone arch entrance covered in barnacles and coral growth. Brain coral and branching coral form natural walls. Giant clamshells flank the entrance. Kelp strands sway from the top. Schools of tiny fish swim nearby.',
      colorNotes: 'Deep sea blues and teals for water tones, vibrant coral pinks and oranges, bioluminescent cyan-green glow, pearl-white shells, moss-green kelp.',
      cellLabels: JSON.stringify([
        'Calm - Day', 'Calm - Night',
        'Current - Fish Swarm', 'Current - Kelp Sway',
        'Awakened - Glow', 'Awakened - Portal'
      ]),
      cellGuidance: `ROW 0 — Calm Waters:
  Header "Calm - Day" (0,0): The shrine in shallow sunlit water. Light rays filter down from above, creating caustic patterns on the coral. Bioluminescence is subtle. Fish idle near the entrance. Peaceful and serene.
  Header "Calm - Night" (0,1): Deep night waters — darker blue-black tones. The bioluminescent algae now clearly glow cyan-green along the coral edges and archway. A few jellyfish drift above. Mystical and quiet.

ROW 1 — Active Ocean:
  Header "Current - Fish Swarm" (1,0): A large school of small silver fish swirls around the shrine, creating a living cloud of movement. The coral is partially obscured. Dynamic and lively.
  Header "Current - Kelp Sway" (1,1): Strong current — kelp strands stream dramatically to the right. Small bubbles trail from the coral peaks. The shrine looks windswept underwater. Sand particles in the water.

ROW 2 — Magical Awakening:
  Header "Awakened - Glow" (2,0): The shrine activates — all bioluminescent algae blaze bright cyan-green. The coral pulses with inner light. The clamshells open to reveal glowing pearls. Ancient runes on the stone arch illuminate.
  Header "Awakened - Portal" (2,1): Full magical event — a swirling portal of blue-white light fills the stone archway. Energy ripples radiate outward through the water. All coral glows intensely. Fish scatter. The shrine is a beacon of power.`,
    },
    {
      id: 'mushroom-cottage',
      name: 'Mushroom Cottage',
      genre: 'Fairy Tale',
      gridSize: '3x3',
      description: 'A whimsical cottage built inside a giant red-and-white spotted toadstool mushroom, with a round wooden door, tiny windows, and a smoking chimney poking through the cap.',
      details: 'The mushroom cap serves as the roof — bright red with white spots. A round hobbit-style door with brass hinges. Two small round windows with flower boxes. A tiny cobblestone path leads to the door. Smaller decorative mushrooms grow around the base.',
      colorNotes: 'Bright red mushroom cap with white spots, cream-colored stem/walls, warm brown door and window frames, green grass and moss, yellow flower box flowers.',
      cellLabels: JSON.stringify([
        'Spring - Flowers', 'Summer - Butterflies', 'Autumn - Falling Leaves',
        'Winter - Snow Cap', 'Fairy Lights', 'Enchanted Growth',
        'Tiny Cottage', 'Standard', 'Grand Mushroom'
      ]),
      cellGuidance: `ROW 0 — Seasonal Variants:
  Header "Spring - Flowers" (0,0): The mushroom cottage in spring. Flower boxes overflow with colorful blooms. Small wildflowers surround the base. The mushroom cap is vibrant and fresh. Bright, cheerful lighting.
  Header "Summer - Butterflies" (0,1): Full summer — lush green grass, tiny colorful butterflies flutter around the cottage. The mushroom cap is at its brightest red. Warm golden sunlight.
  Header "Autumn - Falling Leaves" (0,2): Autumn tones — tiny orange and yellow leaves drift past. The grass is amber-green. A small pumpkin sits beside the door. The mushroom cap has slight golden-brown patches.

ROW 1 — Magical Variants:
  Header "Winter - Snow Cap" (1,0): Snow covers the mushroom cap spots, creating a cozy winter scene. Icicles hang from the cap edge. Warm glow from the windows. Bare tiny trees nearby.
  Header "Fairy Lights" (1,1): Twilight scene with tiny glowing fairy lights strung around the cap edge and along the path. Fireflies dot the air. The windows glow warm. Magical and cozy.
  Header "Enchanted Growth" (1,2): The mushroom has been magically enhanced — the cap glows faintly, sparkle particles float upward, smaller mushrooms around the base also glow in various colors. Mystical energy.

ROW 2 — Size Variants (same design, different scale):
  Header "Tiny Cottage" (2,0): A very small version — just big enough for a pixie. The door is acorn-sized. Only one window. A single tiny mushroom companion. Adorable miniature scale.
  Header "Standard" (2,1): The normal-sized cottage as described. This is the canonical reference version with all details at standard scale.
  Header "Grand Mushroom" (2,2): An enormous version — the mushroom is three stories tall with multiple windows at different heights. A balcony wraps around the stem. Multiple chimneys. Grand and impressive.`,
    },
    {
      id: 'mech-hangar',
      name: 'Mech Hangar Bay',
      genre: 'Mecha',
      gridSize: '2x3',
      description: 'A massive military hangar bay with blast doors, heavy crane systems, and industrial catwalks. Designed to house and maintain giant combat mechs.',
      details: 'Reinforced steel blast doors that open vertically. Interior visible when open — a mech silhouette in a maintenance cradle, tool racks, fuel lines. Hazard stripe markings on the floor. Overhead crane rail runs the width. Control booth on upper right.',
      colorNotes: 'Military dark green and steel grey, hazard yellow-black stripes, red warning lights, white industrial lighting interior, blue holographic displays in control booth.',
      cellLabels: JSON.stringify([
        'Doors Closed', 'Doors Opening',
        'Doors Open - Empty', 'Doors Open - Mech Docked',
        'Launch Sequence', 'Battle Damage'
      ]),
      cellGuidance: `ROW 0 — Door States:
  Header "Doors Closed" (0,0): The hangar exterior with massive blast doors fully shut. Hazard stripes visible at the door seam. A red status light glows above. The structure looks imposing and sealed. Military stencil numbering on the door.
  Header "Doors Opening" (0,1): The blast doors mid-opening — a bright white gap reveals the lit interior. Hydraulic pistons visible on the door sides. Steam vents from the mechanism. Status light is amber/yellow.

ROW 1 — Interior States:
  Header "Doors Open - Empty" (1,0): Doors fully open revealing an empty hangar bay. The maintenance cradle is vacant. Overhead crane idle. Interior lit with white industrial lights. Tool racks and fuel lines visible. Clean and ready.
  Header "Doors Open - Mech Docked" (1,1): Doors open with a large mech silhouette locked in the maintenance cradle. Robotic arms perform maintenance. Blue holographic diagnostic displays active in the control booth. Busy scene.

ROW 2 — Action States:
  Header "Launch Sequence" (2,0): Active launch — the mech stands at the open door threshold, backlit by interior lights. Thruster exhaust glows blue-white at its feet. Catwalks retracted. Warning lights flash. Dramatic tension.
  Header "Battle Damage" (2,1): The hangar has taken hits — one blast door is crumpled inward, scorch marks on the walls. Sparks shower from severed cables. Interior fires visible. The crane has collapsed. Debris everywhere.`,
    },
    {
      id: 'volcanic-forge-temple',
      name: 'Volcanic Forge Temple',
      genre: 'Elemental',
      gridSize: '3x3',
      description: 'A massive temple built into the face of an active volcano, with lava channels running through carved stone conduits and a great forge entrance framed by obsidian pillars.',
      details: 'Black volcanic rock and obsidian construction. Carved dwarven/elemental runes glow orange along the pillars. Lava flows through carved channels on either side of the entrance. A huge forge opening reveals the orange-white glow of the inner sanctum. Stone steps lead up to the entrance.',
      colorNotes: 'Black obsidian and dark volcanic rock, bright orange-red lava and forge glow, carved runes glow amber-orange, grey volcanic ash, deep red accents.',
      cellLabels: JSON.stringify([
        'Dormant', 'Active - Lava Flow', 'Eruption',
        'Forge Cold', 'Forge Blazing', 'Forge - Artifact',
        'Day - Smoke', 'Lava Night', 'Destroyed'
      ]),
      cellGuidance: `ROW 0 — Volcanic Activity:
  Header "Dormant" (0,0): The temple with minimal volcanic activity. Lava channels are dark with only a faint orange glow deep within. The forge entrance is dimly lit. Wisps of smoke from the mountaintop. Imposing but quiet.
  Header "Active - Lava Flow" (0,1): Volcanic activity increasing — lava flows brightly through the carved channels. The forge entrance glows orange-white. Rune carvings on pillars pulse with heat. Steam and heat shimmer in the air.
  Header "Eruption" (0,2): Full eruption behind the temple — lava fountains spray upward, molten rock rains down. The temple channels overflow with bright lava. Intense orange-red glow illuminates everything. Ash and embers fill the air.

ROW 1 — Forge States:
  Header "Forge Cold" (1,0): The great forge is inactive — the entrance is dark. No lava in the channels. The obsidian pillars are cold black. The runes are unlit. The temple looks abandoned and ancient.
  Header "Forge Blazing" (1,1): The forge is at full power — white-hot light pours from the entrance. Sparks fly outward. Lava channels glow intensely. Runes blaze bright orange. Heat waves visible. The temple is alive with elemental energy.
  Header "Forge - Artifact" (1,2): A magical forging event — the forge emits a beam of golden light upward from the entrance. The lava channels pulse in rhythm. Runes cycle through colors (orange to white). An aura of power surrounds the temple.

ROW 2 — Environmental:
  Header "Day - Smoke" (2,0): Daylight view with volcanic smoke drifting from the peak. The dark obsidian contrasts against the sky. Lava channels have a moderate warm glow. The temple's carved details are clearly visible.
  Header "Lava Night" (2,1): Night scene — the temple is silhouetted against the dark sky, lit only by the lava glow from channels and forge. Runes provide accent lighting. The volcanic rock absorbs all other light. Dramatic and ominous.
  Header "Destroyed" (2,2): The temple has been destroyed by a catastrophic eruption. Obsidian pillars shattered, forge entrance collapsed. Cooled black lava covers the steps. Some channels still glow faintly. Ruins and rubble.`,
    },
    {
      id: 'ruined-gas-station',
      name: 'Ruined Gas Station',
      genre: 'Post-Apocalyptic',
      gridSize: '3x3',
      description: 'A collapsed roadside gas station with a caved-in canopy, rusted fuel pumps, and boarded-up windows. Faded pre-war signage barely readable.',
      details: 'Metal canopy collapsed on one side, supported by a single bent pole. Two rusted fuel pumps on cracked concrete. Boarded windows with plywood and nails. Faded price sign with missing letters. Overgrown parking lot with weeds through cracks. A rusted car hulk sits abandoned nearby.',
      colorNotes: 'Rust orange and brown for corroded metal, faded white and red for old signage, cracked grey concrete, dusty tan for sand and dirt, dark green weeds, dull yellow for faded road markings.',
      cellLabels: JSON.stringify([
        'Day - Abandoned', 'Day - Scavengers', 'Day - Dust Storm',
        'Dusk - Campfire', 'Dusk - Lookout', 'Dusk - Quiet',
        'Night - Moonlit', 'Night - Occupied', 'Night - Raider Attack'
      ]),
      cellGuidance: `ROW 0 — Daytime States:
  Header "Day - Abandoned" (0,0): The gas station in harsh daylight. The collapsed canopy casts a jagged shadow. Rusted pumps stand amid cracked concrete. Faded signage is sun-bleached. Weeds push through every crack. The rusted car hulk bakes in the heat. Empty and desolate.
  Header "Day - Scavengers" (0,1): Same daytime scene but small figure silhouettes are visible near the pumps, checking for remaining fuel. One boards are pried from a window. A pack of salvaged goods sits by the rusted car. Active scavenging.
  Header "Day - Dust Storm" (0,2): A dust storm sweeps across the station. Dense tan-brown dust obscures the lower half. The canopy creaks in the wind. Only the top of the faded sign is visible through the swirling sand. Debris flies past.

ROW 1 — Dusk Transition:
  Header "Dusk - Campfire" (1,0): Orange-purple dusk sky. A small campfire burns inside the station under the remaining canopy. Warm orange firelight spills from the boarded windows. Smoke mixes with the dusky air. Feels temporarily inhabited.
  Header "Dusk - Lookout" (1,1): Dusk with a small figure silhouette standing on the collapsed canopy edge, scanning the horizon. The fading light casts long shadows from the rusted pumps. A watchful, tense atmosphere.
  Header "Dusk - Quiet" (1,2): Peaceful dusk — the orange sky behind the station silhouette. No activity. The rusted pumps cast long shadows and the faded sign is backlit. A melancholy beauty to the abandoned ruin.

ROW 2 — Nighttime States:
  Header "Night - Moonlit" (2,0): Pale moonlight illuminates the station. The rusted metal has a blue-silver sheen. Deep shadows under the canopy. The boarded windows are dark voids. The car hulk is a dark silhouette. Eerie and still.
  Header "Night - Occupied" (2,1): Night with warm light from inside — a lantern or fire visible through gaps in the boarded windows. Someone has set up shelter. Bedroll silhouette visible through the doorway. A watch-fire outside.
  Header "Night - Raider Attack" (2,2): Night action scene — muzzle flashes from behind the rusted pumps. Small explosions of sparks. The canopy is being used as cover. Figures in combat silhouettes. Orange tracer lines against the dark. Chaos.`,
    },
    {
      id: 'fortified-settlement-gate',
      name: 'Fortified Settlement Gate',
      genre: 'Post-Apocalyptic',
      gridSize: '3x3',
      description: 'A makeshift community entrance built from scrap metal walls, featuring a watchtower, barbed wire barriers, and a heavy gate assembled from car doors and sheet metal.',
      details: 'Walls made from corrugated metal sheets, car hoods, and sheet metal welded together. A wooden watchtower with a tin roof rises above the left wall. Barbed wire coils top the walls. The gate is two car doors hinged on pipe frames. A guard post with sandbags flanks the right side. Painted warning signs.',
      colorNotes: 'Rust red and gunmetal grey for scrap metal walls, weathered brown wood for the watchtower, silver barbed wire, faded yellow and black warning signs, olive drab sandbags, dusty brown ground.',
      cellLabels: JSON.stringify([
        'Day - Open', 'Day - Closed', 'Day - Market',
        'Alert - Lockdown', 'Alert - Under Attack', 'Alert - Burning',
        'Night - Guarded', 'Night - All Clear', 'Night - Breach'
      ]),
      cellGuidance: `ROW 0 — Daytime Operations:
  Header "Day - Open" (0,0): The settlement gate in daylight with the car-door gates swung open. Traders and survivors pass through. The watchtower has a guard silhouette. Barbed wire glints in the sun. The scrap walls look sturdy despite their makeshift construction.
  Header "Day - Closed" (0,1): Gates shut tight, car doors sealed and barred from inside. The watchtower guard is alert with a visible rifle silhouette. Warning signs face outward. Barbed wire is prominent. The settlement is locked down but not under threat.
  Header "Day - Market" (0,2): Gates open with a bustling market scene just inside. Small stalls visible through the gateway. Barter goods displayed. Multiple figure silhouettes. The watchtower flies a trade flag. Lively and welcoming.

ROW 1 — Alert States:
  Header "Alert - Lockdown" (1,0): Emergency lockdown — gates barred with extra barricades. The watchtower has multiple armed guards. Additional barbed wire deployed in front of the gate. Warning signs lit with red flares. Tense and defensive.
  Header "Alert - Under Attack" (1,1): Active combat — muzzle flashes from the watchtower and guard post. Bullet impacts spark on the scrap metal walls. The gate shudders from impacts. Smoke rises from behind the walls. Desperate defense.
  Header "Alert - Burning" (1,2): The settlement is on fire — flames engulf the watchtower roof and lick along the scrap walls. The gate hangs broken and open. Black smoke billows upward. Barbed wire melts and sags. Devastation.

ROW 2 — Nighttime States:
  Header "Night - Guarded" (2,0): Night with the gates closed. A lantern hangs from the watchtower and a torch burns at the guard post. The scrap walls are dark silhouettes with barbed wire visible against the moonlit sky. Watchful and secure.
  Header "Night - All Clear" (2,1): Quiet night — the guard in the watchtower is relaxed. A small fire burns inside the guard post. The gates are closed but not barred. Peaceful. Distant campfire light glows from within the settlement behind the walls.
  Header "Night - Breach" (2,2): Night attack aftermath — a section of the scrap wall has been torn open. The watchtower leans at an angle. The gate is smashed inward. Fires burn inside the settlement visible through the breach. The barbed wire is scattered.`,
    },
    {
      id: 'underground-bunker-entrance',
      name: 'Underground Bunker Entrance',
      genre: 'Post-Apocalyptic',
      gridSize: '2x2',
      description: 'A concealed hillside entrance to an underground survival bunker, featuring a heavy blast door, radiation warning signs, and camouflage netting.',
      details: 'A reinforced concrete frame set into a grass-covered hillside. A thick steel blast door with a large wheel lock mechanism. Faded yellow radiation warning signs on either side. Torn camouflage netting partially covering the entrance. A ventilation pipe protrudes from the hillside above. Sandbag emplacements flank the approach.',
      colorNotes: 'Dark concrete grey frame, rusted steel blast door, faded yellow radiation trefoil signs, green-brown camouflage netting, olive grass on the hillside, dull metal ventilation pipe.',
      cellLabels: JSON.stringify([
        'Sealed - Day', 'Open - Day',
        'Sealed - Night', 'Open - Night'
      ]),
      cellGuidance: `ROW 0 — Daytime States:
  Header "Sealed - Day" (0,0): Daylight view of the sealed bunker entrance. The heavy blast door is shut tight, the wheel lock rusted in place. Faded radiation signs flank the concrete frame. Camouflage netting is torn but still partially covers the entrance. Grass grows over the hillside. The ventilation pipe releases a thin wisp of filtered air. Quiet and seemingly abandoned.
  Header "Open - Day" (0,1): The blast door is swung open, revealing a lit interior corridor with concrete walls and flickering fluorescent lights. The wheel lock hangs loose. A figure silhouette stands in the doorway. Fresh tracks in the dirt approach. The camouflage netting is pulled aside. Someone is home.

ROW 1 — Nighttime States:
  Header "Sealed - Night" (1,0): Night view of the sealed entrance. Moonlight catches the rusted blast door and concrete frame. The radiation signs are barely visible in the dark. The camouflage netting is a dark mass. The ventilation pipe is a dark silhouette against the sky. A faint hum from underground is the only sign of life.
  Header "Open - Night" (1,1): Night with the blast door open — warm fluorescent light spills from the corridor onto the dark hillside. The interior is brightly lit in contrast to the dark exterior. A guard sits on the sandbags with a lantern. The open door is a beacon in the darkness.`,
    },
    {
      id: 'irradiated-church',
      name: 'Irradiated Church',
      genre: 'Post-Apocalyptic',
      gridSize: '3x3',
      description: 'A crumbling pre-war church with a broken steeple, partially collapsed roof, and an eerie green radioactive glow emanating from the interior through shattered stained glass windows.',
      details: 'White clapboard walls now grey and peeling. The steeple leans at an angle with the cross bent. Half the roof has caved in exposing wooden rafters. Stained glass windows are shattered, some with jagged colorful fragments remaining. A green radioactive glow pulses from inside. An overgrown graveyard with tilted headstones surrounds the building.',
      colorNotes: 'Peeling grey-white clapboard, dark exposed wooden rafters, sickly green radioactive glow, remaining stained glass fragments in red/blue/gold, overgrown dark green vegetation, grey tilted headstones, rusty brown exposed metal.',
      cellLabels: JSON.stringify([
        'Day - Exterior', 'Day - Glow Pulse', 'Day - Overgrown',
        'Dusk - Silhouette', 'Dusk - Green Beacon', 'Dusk - Fog',
        'Night - Dormant', 'Night - Active', 'Night - Meltdown'
      ]),
      cellGuidance: `ROW 0 — Daytime States:
  Header "Day - Exterior" (0,0): The church in daylight showing its decay. Grey peeling clapboard walls, leaning steeple with bent cross, collapsed roof section. The green glow is faint in daylight, barely visible through the shattered windows. The overgrown graveyard with tilted headstones surrounds the building. Sad and decrepit.
  Header "Day - Glow Pulse" (0,1): Same daytime view but the green radioactive glow pulses brighter — clearly visible even in daylight through the broken windows and collapsed roof. The glow casts faint green light on the ground around the church. Something inside is active.
  Header "Day - Overgrown" (0,2): The church nearly consumed by mutant vegetation. Thick vines with sickly green leaves crawl up the walls. The graveyard headstones are buried in overgrowth. Only the leaning steeple protrudes above the vegetation. Nature reclaiming the ruin.

ROW 1 — Dusk Transition:
  Header "Dusk - Silhouette" (1,0): Orange-purple dusk sky with the church as a dark silhouette. The leaning steeple and bent cross are dramatic against the sunset. The green glow begins to become more visible through the windows. The graveyard headstones cast long shadows.
  Header "Dusk - Green Beacon" (1,1): Dusk with the green radioactive glow now clearly visible and bright. The church becomes a green beacon against the darkening sky. Light streams from every window and the collapsed roof. The surrounding ground is bathed in eerie green.
  Header "Dusk - Fog" (1,2): Dusk with a thick fog rolling through the graveyard. The fog glows faintly green near the church. Headstones emerge from the mist. The steeple pierces above the fog layer. Atmospheric and haunting.

ROW 2 — Nighttime States:
  Header "Night - Dormant" (2,0): Dark night with the church barely visible. The green glow is reduced to a faint pulse from within. Moonlight catches the leaning steeple. The graveyard is dark with headstones as pale shapes. Quiet and ominous.
  Header "Night - Active" (2,1): Night with the green glow at full intensity — the church blazes with radioactive light. Green beams shoot from the shattered windows. The collapsed roof is an open cauldron of green energy. The graveyard is lit in sickly green. Radiation readings would be lethal.
  Header "Night - Meltdown" (2,2): Critical radioactive event — the church's green glow is blinding. Cracks of green energy split the remaining walls. The steeple is surrounded by a green corona. The ground around the church glows and cracks. The headstones themselves glow. An atomic nightmare.`,
    },
    {
      id: 'hive-chamber',
      name: 'Hive Chamber',
      genre: 'Sci-Fi Horror',
      gridSize: '3x3',
      description: 'An organic alien nest chamber with resin-coated walls, cocooned victims along the walls, and a thick layer of biomechanical secretion covering every surface. Dim amber lighting from bioluminescent growths.',
      details: 'Walls made of hardened organic resin with ribbed textures. Cocooned human figures are embedded in the walls, encased in translucent resin showing vague silhouettes. Egg clusters sit on the organic floor. Dripping resin strands hang from the ceiling. Small bioluminescent growths provide dim amber light. A central passage leads deeper into the hive.',
      colorNotes: 'Dark brown-black resin walls, amber bioluminescent glow, translucent grey-white cocoon resin, dark organic floor with green-black sheen, pale flesh visible through cocoon material.',
      cellLabels: JSON.stringify([
        'Empty - Dim', 'Empty - Active', 'Egg Cluster',
        'Cocooned Victims', 'Hatching', 'Drone Present',
        'Warrior Patrolling', 'Queen Nearby', 'Infestation Peak'
      ]),
      cellGuidance: `ROW 0 — Chamber States:
  Header "Empty - Dim" (0,0): The hive chamber in its dormant state. Resin-coated walls glisten with a dark sheen. Bioluminescent growths cast faint amber pools of light. Dripping resin strands hang from above. The chamber is empty and quiet but deeply unsettling. Organic textures cover every surface.
  Header "Empty - Active" (0,1): The chamber is more active — bioluminescent growths pulse brighter. Fresh resin drips are visible. The ribbed walls seem to breathe with subtle expansion. The floor has fresh organic secretion. Something has been here recently.
  Header "Egg Cluster" (0,2): A cluster of leathery alien eggs sits in the center of the chamber. The eggs are waist-high, pale and mottled, with a cross-shaped opening at the top. They pulse gently with internal movement. Mist hugs the floor around them. The amber light catches the moist egg surfaces.

ROW 1 — Infestation Progress:
  Header "Cocooned Victims" (1,0): The walls are lined with cocooned figures — human silhouettes visible through layers of translucent hardened resin. Some figures show signs of chest-burst trauma. The cocoon material is grey-white and veined. The scene is deeply horrifying.
  Header "Hatching" (1,1): An egg in the foreground is opening — the cross-shaped top peeling back to reveal movement inside. A pale facehugger finger-leg reaches from within. Other eggs nearby pulse with imminent hatching. Tension and dread.
  Header "Drone Present" (1,2): A xenomorph drone silhouette crouches in the corner of the chamber, barely distinguishable from the organic walls. Its obsidian body blends with the resin. Only the glint of silver teeth and the curve of the tail blade betray its presence. Predator in its nest.

ROW 2 — Maximum Threat:
  Header "Warrior Patrolling" (2,0): A larger xenomorph warrior strides through the chamber, its ridged head crest nearly touching the ceiling. The resin walls seem to part for it. Acid-green blood traces mark the floor. The amber light catches the warrior's dark brown chitin plates.
  Header "Queen Nearby" (2,1): The chamber trembles — massive footsteps shake loose resin from the ceiling. An enormous shadow fills the passage at the far end. The bioluminescent growths blaze brighter in response. The eggs pulse frantically. The queen is approaching. Ultimate terror.
  Header "Infestation Peak" (2,2): The chamber is at maximum horror — every wall is covered in cocoons, eggs fill the floor, multiple drone silhouettes cling to walls and ceiling. Resin drips constantly. The bioluminescence is at its brightest. The hive is alive and thriving. A nightmare ecosystem.`,
    },
    {
      id: 'derelict-ship-corridor',
      name: 'Derelict Ship Corridor',
      genre: 'Sci-Fi Horror',
      gridSize: '3x3',
      description: 'A biomechanical alien vessel interior with HR Giger-inspired ribbed walls, fog-filled corridors, and flickering emergency strip lighting. The architecture itself seems alive.',
      details: 'Ribbed walls with organic-mechanical fusion — bone-like arches meet chrome pipes and cable bundles. Emergency strip lighting runs along the floor in dim red. Fog drifts at floor level. Skeletal arch doorways lead to other sections. Condensation drips from the biomechanical ceiling. A control panel with alien displays is embedded in one wall.',
      colorNotes: 'Dark steel-grey biomechanical walls with bone-white ribbing, dim red emergency strip lighting, blue-green fog, amber alien display panels, chrome pipe accents, dark condensation streaks.',
      cellLabels: JSON.stringify([
        'Powered Down', 'Emergency Lighting', 'Systems Online',
        'Fog Rolling', 'Motion Detected', 'Acid Damage',
        'Breach - Vacuum', 'Self Destruct', 'Overgrown'
      ]),
      cellGuidance: `ROW 0 — Power States:
  Header "Powered Down" (0,0): The corridor in complete darkness except for very faint bioluminescence from the walls themselves. The ribbed architecture is barely visible — bone-like shapes in the black. No emergency lights. No fog. Absolute silence visualized through stillness. Cold and dead.
  Header "Emergency Lighting" (0,1): Red emergency strip lights flicker on along the floor, casting harsh upward shadows on the ribbed walls. The bone-white ribs become dramatic against the dark ceiling. Fog begins drifting at floor level. The alien control panel shows a single amber warning glyph. Tense.
  Header "Systems Online" (0,2): Full emergency power — red strip lights are steady, the alien control panel blazes with amber displays, and conduit pipes along the walls pulse with faint blue energy. The fog is thicker. The corridor stretches into darkness at both ends. The biomechanical architecture is fully revealed and terrifying.

ROW 1 — Threat Escalation:
  Header "Fog Rolling" (1,0): Dense blue-green fog fills the lower half of the corridor, obscuring the floor completely. The red strip lights glow through the fog creating an otherworldly haze. The upper ribbed walls emerge above the fog line. Visibility is severely limited. Something could be hiding in the fog.
  Header "Motion Detected" (1,1): The control panel flashes a rapid amber warning. A shadow moves at the far end of the corridor — barely visible through the fog. The emergency lights flicker in response to the movement. Condensation falls from the ceiling in a disturbed pattern. The corridor suddenly feels very narrow.
  Header "Acid Damage" (1,2): Acid has burned through sections of the floor and walls — smoking holes with melted edges reveal lower decks and internal pipework. The acid-green residue sizzles and steams. Some ribs are partially dissolved. The corridor is compromised and dangerous.

ROW 2 — Catastrophic States:
  Header "Breach - Vacuum" (2,0): A hull breach at the far end of the corridor — the wall is torn open showing stars and the void of space. Atmosphere vents outward, the fog streaming toward the breach. Emergency bulkheads are half-closed. Loose objects drift toward the opening. The emergency lights strobe in alarm.
  Header "Self Destruct" (2,1): The self-destruct sequence is active — every light flashes red in urgent pulses. The alien control panel displays a countdown in alien glyphs. Steam jets from ruptured pipes. The ribbed walls seem to contract as if the ship is in pain. Alarms implied through visual chaos. Evacuation urgency.
  Header "Overgrown" (2,2): After years of abandonment, the biomechanical architecture has grown — ribs have expanded and merged, new organic growth covers the chrome pipes, and the corridor has partially closed in on itself. The alien technology and organic material have fused into a new, living structure. Beautiful and horrible.`,
    },
    {
      id: 'egg-chamber',
      name: 'Egg Chamber',
      genre: 'Sci-Fi Horror',
      gridSize: '2x2',
      description: 'A breeding ground for facehuggers — a low-ceilinged organic chamber carpeted with leathery eggs on a living organic floor, filled with blue-green mist and pulsing bioluminescence.',
      details: 'Low organic ceiling dripping with resin. The floor is a living organic membrane covered with rows of leathery eggs. Each egg is about waist-high with a cross-shaped opening at the top. Blue-green mist hugs the floor obscuring the egg bases. Pulsing bioluminescent growths in the walls create an eerie rhythmic light. The overall atmosphere is womb-like and profoundly disturbing.',
      colorNotes: 'Pale grey-brown leathery eggs, dark organic floor and ceiling, blue-green bioluminescent mist, amber pulsing wall growths, translucent egg membranes, dark resin drips.',
      cellLabels: JSON.stringify([
        'Dormant', 'Awakening',
        'Hatching Wave', 'Empty Husks'
      ]),
      cellGuidance: `ROW 0 — Pre-Hatch States:
  Header "Dormant" (0,0): The egg chamber at rest. Rows of leathery eggs stand in the mist, all closed at the top. The bioluminescent growths pulse in a slow, hypnotic rhythm. Resin drips from the low ceiling. The blue-green mist is still and even. The eggs appear inert but alive. An unsettling calm.
  Header "Awakening" (0,1): The eggs respond to a presence — the leathery surfaces begin to ripple with internal movement. The cross-shaped openings twitch. The bioluminescence pulses faster. The mist swirls as if disturbed from below. The organic floor membrane contracts slightly. Something is about to happen.

ROW 1 — Active States:
  Header "Hatching Wave" (1,0): Multiple eggs are opening simultaneously — cross-shaped tops peeling back, pale facehugger legs reaching upward. Some facehuggers are already free, scuttling between eggs. The mist churns. The bioluminescence blazes at maximum intensity. A cascade of horrifying birth.
  Header "Empty Husks" (1,1): The aftermath — all eggs are open and empty, their leathery walls collapsed inward. Spent egg fluid pools on the organic floor. The mist has thinned. The bioluminescence dims to a low pulse. Only hollow husks remain. The facehuggers have gone hunting. The silence is worse than the hatching.`,
    },
    {
      id: 'biomechanical-temple',
      name: 'Biomechanical Temple',
      genre: 'Sci-Fi Horror',
      gridSize: '3x3',
      description: 'A Giger-esque cathedral of impossible geometry — skeletal ribbed arches soar overhead, organic pipes pulse with unknown fluids, and a chrome altar sits at the center of a living chamber that defies architectural logic.',
      details: 'Massive skeletal arches made of fused bone and chrome form the ceiling structure. Organic pipes run along the walls carrying dark fluids. A central chrome altar rises from the organic floor, covered in alien glyphs. The walls themselves appear to breathe with slow, rhythmic expansion. The geometry is subtly wrong — angles that should be straight are curved, perspectives that should converge seem to diverge. Living walls with embedded vertebral columns and ribbed surfaces.',
      colorNotes: 'Bone-white skeletal arches with chrome joints, dark steel walls with flesh-pink organic patches, chrome altar with amber glyph lighting, dark fluid in translucent organic pipes, overall palette of chrome silver, bone, and disturbing flesh tones.',
      cellLabels: JSON.stringify([
        'Dormant - Day', 'Dormant - Night', 'Awakened',
        'Ritual Active', 'Entity Summoned', 'Corruption Spreading',
        'Ancient Ruin', 'Fully Alive', 'Transcendence'
      ]),
      cellGuidance: `ROW 0 — Base States:
  Header "Dormant - Day" (0,0): The temple in cold, dead light. The skeletal arches soar overhead but the bone surfaces are dull and dry. The chrome altar sits empty and unlit. The organic pipes are still and dark. The walls do not breathe. The impossible geometry is visible but muted. An ancient, dormant horror.
  Header "Dormant - Night" (0,1): Darkness fills the temple. Faint moonlight catches the chrome surfaces — the altar, the pipe fittings, the arch joints. The bone-white skeletal structure glows faintly. The geometry becomes more unsettling in the dark, shadows making the wrong angles more prominent.
  Header "Awakened" (0,2): The temple stirs — the organic pipes begin flowing with dark fluid. The walls pulse with the first breath. The chrome altar glyphs flicker amber. The skeletal arches flex almost imperceptibly. The flesh-pink patches on the walls darken with blood flow. Something ancient remembers.

ROW 1 — Active States:
  Header "Ritual Active" (1,0): A ceremony in progress — the chrome altar blazes with amber glyph light. The organic pipes pulse rhythmically. The walls breathe visibly. The skeletal arches vibrate with resonance. Small biomechanical entities emerge from the walls. The impossible geometry seems to shift and flow.
  Header "Entity Summoned" (1,1): A massive biomechanical entity materializes above the altar — a translucent form of chrome and flesh, too large for the space yet somehow contained. The temple's geometry bends around it. The skeletal arches bow inward. The organic pipes blaze with superheated fluid. Ultimate cosmic horror.
  Header "Corruption Spreading" (1,2): The temple's influence extends outward — the organic walls push through the stone boundaries. Biomechanical tendrils crawl along the floor beyond the temple proper. The chrome surfaces propagate like a metallic infection. The impossible geometry is spreading. Reality warps at the edges.

ROW 2 — Extreme States:
  Header "Ancient Ruin" (2,0): The temple as archaeological discovery — partially buried, the skeletal arches broken and half-collapsed. The chrome altar is tarnished and covered in dust. Organic pipes are dried and cracked. The impossible geometry is still subtly wrong even in ruin. A place of ancient power, long dormant.
  Header "Fully Alive" (2,1): The temple at maximum biological activity — every surface breathes, the organic pipes flow with bright fluid, the chrome altar projects holographic alien geometries upward. The skeletal arches flex like ribs around a beating heart. The walls are more flesh than metal. The air shimmers with impossible angles.
  Header "Transcendence" (2,2): Beyond horror into awe — the temple has transcended physical form. The skeletal arches dissolve into pure light. The chrome altar projects a gateway to somewhere else. The geometry inverts — inside becomes outside. The organic and mechanical merge into a new form of existence. Terrifyingly beautiful.`,
    },
  ];

  const insert = db.prepare(
    `INSERT OR IGNORE INTO building_presets (id, name, genre, grid_size, description, details, color_notes, cell_labels, cell_guidance, is_preset)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const insertAll = db.transaction(() => {
    for (const p of PRESETS) {
      insert.run(p.id, p.name, p.genre, p.gridSize, p.description, p.details, p.colorNotes, p.cellLabels, p.cellGuidance);
    }
  });

  insertAll();
  console.log(`[DB] Seeded ${PRESETS.length} building presets.`);

  // Create a grid preset per building content preset with real cell labels, then link
  const insertGrid = db.prepare(`
    INSERT OR IGNORE INTO grid_presets (name, sprite_type, genre, grid_size, cols, rows, cell_labels, cell_groups, generic_guidance, bg_mode, is_preset)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const findGrid = db.prepare("SELECT id FROM grid_presets WHERE name = ? AND sprite_type = 'building' AND grid_size = ?");
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO building_grid_links (building_preset_id, grid_preset_id, guidance_override, sort_order)
    VALUES (?, ?, ?, 0)
  `);
  const BUILDING_GUIDANCE = `Each cell in the grid has a WHITE TEXT HEADER that names the variant. Draw the same building in each cell but reflecting the variant described by its header label. Maintain consistent architecture, proportions, and style across all cells. Each row typically represents a thematic group (e.g., activity states, damage states, time of day).`;
  const gridSizeToDims = { '3x3': [3,3], '2x2': [2,2], '2x3': [2,3] };
  const linkAll = db.transaction(() => {
    for (const p of PRESETS) {
      const [cols, rows] = gridSizeToDims[p.gridSize] || [3, 3];
      const _labels = JSON.parse(p.cellLabels);
      const cellGroups = [];
      for (let r = 0; r < rows; r++) {
        const cells = [];
        for (let c = 0; c < cols; c++) cells.push(r * cols + c);
        cellGroups.push({ name: `Row ${r + 1}`, cells });
      }
      insertGrid.run(p.name, 'building', p.genre, p.gridSize, cols, rows,
        p.cellLabels, JSON.stringify(cellGroups), BUILDING_GUIDANCE, null);
      const gridRow = findGrid.get(p.name, p.gridSize);
      if (gridRow) insertLink.run(p.id, gridRow.id, p.cellGuidance || '');
    }
  });
  linkAll();
  console.log(`[DB] Seeded building grid presets + links.`);
}
