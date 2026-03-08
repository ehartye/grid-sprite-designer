export function seedBackgroundPresets(db) {
  const PRESETS = [
    {
      id: 'enchanted-forest',
      name: 'Enchanted Forest',
      genre: 'Fantasy',
      gridSize: '1x4',
      bgMode: 'parallax',
      description: 'A mystical enchanted forest with glowing flora, ancient trees, and magical atmosphere. Four parallax layers from sky canopy to forest floor.',
      colorNotes: 'Deep emerald and teal greens, magical cyan-blue glow accents, warm golden dappled light, purple-blue mystical haze in distant layers.',
      layerLabels: JSON.stringify([
        'Sky & Canopy', 'Mid Canopy & Light Rays', 'Undergrowth & Trunks', 'Forest Floor & Roots'
      ]),
      layerGuidance: `LAYER ORDER (top to bottom, farthest to nearest):
  Header "Sky & Canopy" (0,0): The topmost parallax layer. Dense treetop canopy filtering light — overlapping leaf clusters in deep greens with golden light breaking through gaps. Fills the ENTIRE cell. No magenta visible. A purple-blue haze creates depth. Tiny glowing motes float among the leaves.
  Header "Mid Canopy & Light Rays" (1,0): Middle layer with tree trunks and mid-level branches. Shafts of golden light beam diagonally through the canopy from upper left. Magical sparkle particles in the light beams. Magenta background visible at the top where sky/upper canopy shows through. Trees and branches fill the lower two-thirds.
  Header "Undergrowth & Trunks" (2,0): Foreground tree trunks — large, ancient, gnarled. Thick moss covers their bases. Glowing mushrooms and magical flowers dot the undergrowth between trunks. Magenta background visible in upper portion. Content fills from bottom up.
  Header "Forest Floor & Roots" (3,0): Nearest layer — massive twisted roots, fallen logs, and lush ground cover. Bioluminescent fungi glow cyan-blue along root surfaces. Ferns and magical flowers in the foreground. Magenta visible in upper half. Ground detail fills the bottom portion.`,
    },
    {
      id: 'mountain-range',
      name: 'Mountain Range',
      genre: 'Nature',
      gridSize: '1x5',
      bgMode: 'parallax',
      description: 'A majestic mountain landscape with five parallax layers creating deep atmospheric perspective from distant peaks to nearby rocky ground.',
      colorNotes: 'Pale blue-grey for distant mountains, medium slate blue for mid-range, deep grey-brown for near mountains, warm green for foothills, rich earth tones for foreground.',
      layerLabels: JSON.stringify([
        'Sky & Far Peaks', 'Distant Mountains', 'Near Mountains', 'Foothills & Trees', 'Rocky Foreground'
      ]),
      layerGuidance: `LAYER ORDER (top to bottom, farthest to nearest):
  Header "Sky & Far Peaks" (0,0): Topmost layer. A gradient sky from light blue at top to warm peach at the horizon. Very distant mountain silhouettes in pale blue-grey with snow-capped peaks barely visible through atmospheric haze. Fills the ENTIRE cell. No magenta visible.
  Header "Distant Mountains" (1,0): Second layer. A range of mountains in medium slate blue, more detailed than the sky peaks but still softened by atmospheric perspective. Snow patches visible. Magenta above where sky shows through. Mountains fill the lower two-thirds.
  Header "Near Mountains" (2,0): Third layer. Closer mountain range in deeper grey-brown tones with visible rock texture, cliff faces, and sparse vegetation. More detail and contrast. Magenta in upper portion. Mountains fill from bottom, roughly half the cell.
  Header "Foothills & Trees" (3,0): Fourth layer. Rolling green foothills with clusters of evergreen trees. Warm greens and browns. Individual trees distinguishable. Magenta in upper half. Hills and trees fill the lower portion.
  Header "Rocky Foreground" (4,0): Nearest layer. Large rocks, boulders, and scattered wildflowers in the immediate foreground. Rich brown and grey tones. Grass tufts between rocks. Magenta fills the upper two-thirds. Ground content at the very bottom of the cell.`,
    },
    {
      id: 'haunted-graveyard',
      name: 'Haunted Graveyard',
      genre: 'Horror',
      gridSize: '3x2',
      bgMode: 'scene',
      description: 'A spooky graveyard with tombstones, dead trees, and iron fencing. Six scene variants showing different atmospheric conditions.',
      colorNotes: 'Muted greys and dark blues for night, warm orange for dusk, sickly green for fog, purple for supernatural. Desaturated palette throughout.',
      layerLabels: JSON.stringify([
        'Day - Overcast', 'Dusk - Orange Sky', 'Night - Moonlit',
        'Fog - Dense', 'Rain - Storm', 'Haunted - Spirits'
      ]),
      layerGuidance: `SCENE DESIGN — Same graveyard composition across all 6 variants. Layout: iron fence in foreground, rows of tombstones in mid-ground, a large dead oak tree right of center, a small chapel silhouette on the left horizon, rolling hill skyline.

  Header "Day - Overcast" (0,0): Daytime but under heavy grey overcast clouds. Flat, even lighting. The graveyard looks abandoned and neglected but not supernatural. Muted green-grey grass, weathered grey tombstones. Fill the ENTIRE cell.
  Header "Dusk - Orange Sky" (0,1): Sunset with a vivid orange-red sky. Long dark shadows stretch toward the viewer. The dead oak tree is silhouetted dramatically. Warm light hits the tops of tombstones. Ominous mood building.
  Header "Night - Moonlit" (0,2): Full moon high in a dark blue-black sky. Silver moonlight casts sharp shadows. Tombstones gleam pale. The dead oak has an eerie silver outline. Stars visible. Classic horror atmosphere.
  Header "Fog - Dense" (1,0): Same scene enveloped in thick greenish-grey fog. Only the nearest tombstones and fence are clearly visible. The chapel and tree fade into fog. Ground-level mist obscures the grass. Visibility decreases with distance.
  Header "Rain - Storm" (1,1): Heavy rainstorm with dark purple-grey clouds. Lightning illuminates the scene in a flash — dramatic hard shadows. Rain streaks across the frame. Puddles form between tombstones reflecting the lightning. The tree bends in wind.
  Header "Haunted - Spirits" (1,2): Night scene with supernatural activity. Ghostly translucent figures hover above tombstones. An eerie green-purple glow emanates from the ground. The dead oak's branches reach like claws. Spectral orbs float in the air. The chapel window glows ominously.`,
    },
    {
      id: 'ocean-sunset',
      name: 'Ocean Sunset',
      genre: 'Nature',
      gridSize: '1x3',
      bgMode: 'parallax',
      description: 'A serene ocean sunset with three parallax layers — dramatic sky, distant horizon, and rolling waves.',
      colorNotes: 'Warm orange, pink, and purple for sunset sky, deep blue ocean, golden reflections on water, white foam on wave crests.',
      layerLabels: JSON.stringify([
        'Sunset Sky', 'Horizon & Distant Water', 'Waves & Foreground'
      ]),
      layerGuidance: `LAYER ORDER (top to bottom, farthest to nearest):
  Header "Sunset Sky" (0,0): The full sky layer — a gradient from deep purple-blue at the top through pink and orange to golden yellow at the horizon line. Wispy clouds catch the sunset light in warm pink and orange. The sun is a bright golden-white disc near the bottom center. Fills the ENTIRE cell. No magenta visible.
  Header "Horizon & Distant Water" (1,0): The ocean horizon and middle-distance water. Calm deep blue sea with golden-orange sun reflection creating a bright path on the water surface. Gentle wave texture. Magenta visible at the top where sky shows through. Water fills the lower two-thirds.
  Header "Waves & Foreground" (2,0): Nearest water layer — larger rolling waves with white foam crests. Deeper blue-green water with warm sunset reflections. Spray particles catch the golden light. Magenta fills the upper half. Waves and water fill the bottom portion.`,
    },
    {
      id: 'cyberpunk-city',
      name: 'Cyberpunk City',
      genre: 'Sci-Fi',
      gridSize: '2x2',
      bgMode: 'scene',
      description: 'A neon-drenched cyberpunk cityscape with towering megastructures, holographic advertisements, and atmospheric pollution. Four scene variants.',
      colorNotes: 'Dark blue-grey base, hot pink and cyan neon accents, purple atmospheric haze, yellow-orange artificial lighting, green holographic displays.',
      layerLabels: JSON.stringify([
        'Day - Smog', 'Night - Neon',
        'Rain - Reflections', 'Blackout - Emergency'
      ]),
      layerGuidance: `SCENE DESIGN — Same cityscape composition across all 4 variants. Layout: a narrow street canyon between towering megastructures, dense overhead cables and pipes, holographic billboards on building faces, a distant skyline of corporate towers, street-level shops and stalls at the very bottom.

  Header "Day - Smog" (0,0): Daytime but the sky is a hazy yellow-orange from industrial smog. Buildings are visible but muted. Holographic ads are dim, barely visible in daylight. The street is grey and utilitarian. A thin crowd moves below. Fill the ENTIRE cell.
  Header "Night - Neon" (0,1): Nighttime — the city comes alive. Neon signs blaze hot pink and cyan. Holographic ads project vivid images. The buildings are dark silhouettes lit by countless colored lights. The wet street reflects neon colors. Vibrant and electric.
  Header "Rain - Reflections" (1,0): Night with heavy rain. All the neon colors bleed and streak in the rain. Massive puddles on the street create perfect reflections of the signs above. Steam rises from grates. Umbrellas in the crowd below. Atmospheric and moody.
  Header "Blackout - Emergency" (1,1): Power outage — all neon and holographic displays are dark. Only red emergency lights pulse on the buildings. The street is nearly pitch black with sparse flashlight beams. A single emergency vehicle's blue-red lights cut through the darkness. Tense and ominous.`,
    },
    {
      id: 'underwater-reef',
      name: 'Underwater Reef',
      genre: 'Fantasy',
      gridSize: '1x4',
      bgMode: 'parallax',
      description: 'A vibrant underwater coral reef with four parallax layers from the sunlit surface to the deep ocean floor.',
      colorNotes: 'Bright turquoise and teal for shallow water, deep navy for depths, vibrant coral pinks and oranges, bioluminescent cyan-green accents, golden surface light rays.',
      layerLabels: JSON.stringify([
        'Surface Light & Open Water', 'Mid Water & Fish Schools', 'Coral Formations', 'Seafloor & Anemones'
      ]),
      layerGuidance: `LAYER ORDER (top to bottom, farthest to nearest):
  Header "Surface Light & Open Water" (0,0): The topmost layer. Bright turquoise water with golden light rays streaming down from the surface above. Small bubbles rise. The water is clear and luminous. A faint surface ripple pattern at the very top. Fills the ENTIRE cell. No magenta. Color grades from bright turquoise at top to deeper blue at bottom.
  Header "Mid Water & Fish Schools" (1,0): Middle distance. Schools of small colorful tropical fish swim in formation. A sea turtle silhouette glides in the background. Water is a medium blue. Magenta visible at the top. Fish and creatures occupy the lower two-thirds of the cell.
  Header "Coral Formations" (2,0): Coral reef structures — branching coral in pinks and purples, brain coral in green, fan coral swaying. Bright orange clownfish dart among the formations. Bioluminescent accents glow cyan. Magenta above. Coral fills from the bottom up through roughly half the cell.
  Header "Seafloor & Anemones" (3,0): The nearest layer — the ocean floor with sea anemones waving their tentacles, colorful starfish, scattered shells, and sandy patches between rocks. Rich detail and saturated colors. Magenta fills the upper two-thirds. Seafloor content at the very bottom of the cell.`,
    },
    {
      id: 'nuclear-sunset-skyline',
      name: 'Nuclear Sunset Skyline',
      genre: 'Post-Apocalyptic',
      gridSize: '1x4',
      bgMode: 'parallax',
      description: 'A ruined city silhouette against an orange-red sky with a mushroom cloud remnant on the horizon. Four parallax layers from irradiated sky to cracked foreground earth.',
      colorNotes: 'Intense orange-red and amber sky, black and dark grey silhouettes, sickly yellow radiation glow, dusty brown earth tones, muted rust and ash grey.',
      layerLabels: JSON.stringify([
        'Irradiated Sky & Mushroom Cloud', 'Ruined City Silhouette', 'Mid-Ground Rubble & Dead Trees', 'Cracked Earth & Debris'
      ]),
      layerGuidance: `LAYER ORDER (top to bottom, farthest to nearest):
  Header "Irradiated Sky & Mushroom Cloud" (0,0): The topmost layer. A dramatic gradient from deep blood-red at the top through intense orange to sickly yellow at the horizon. The remnant of a mushroom cloud dominates the upper right — a towering column of grey-brown smoke and ash spreading into the characteristic mushroom cap. Wispy radioactive clouds glow with unnatural orange-yellow light. Ash particles drift across the sky. Fills the ENTIRE cell. No magenta visible.
  Header "Ruined City Silhouette" (1,0): Distant ruined cityscape in dark silhouette. Broken skyscrapers — some snapped in half, others leaning at precarious angles. Collapsed overpasses and shattered bridge supports. The skyline is jagged and irregular. Fires burn in a few buildings, casting small orange glows. The sunset backlights everything in deep orange-red. Magenta visible at the top where sky shows through. City fills the lower two-thirds.
  Header "Mid-Ground Rubble & Dead Trees" (2,0): Closer devastation. Skeletal dead trees with no leaves, just blackened trunks and bare branches reaching upward. Piles of concrete rubble, twisted rebar, and crushed vehicles. A toppled water tower or radio antenna lies across the scene. Dust hangs in the air catching orange sunset light. Magenta above. Content fills the lower half.
  Header "Cracked Earth & Debris" (3,0): Nearest layer — severely cracked and parched earth. Deep fissures run through sun-baked mud. Scattered debris: a rusted car door, broken concrete chunks, shattered glass, a faded warning sign. Small fires or smoldering embers in debris piles. A radiation hazard symbol partially buried in dirt. Magenta fills the upper two-thirds. Ground detail at the very bottom.`,
    },
    {
      id: 'underground-vault-interior',
      name: 'Underground Vault Interior',
      genre: 'Post-Apocalyptic',
      gridSize: '1x4',
      bgMode: 'parallax',
      description: 'A clean but aging underground survival vault with metal walls, flickering fluorescent lights, and a massive vault door visible in the distance. Four parallax layers from far wall to foreground equipment.',
      colorNotes: 'Cool blue-grey metal surfaces, warm yellow-white fluorescent light, green screen glow from terminals, chrome and brushed steel, faded safety yellow markings.',
      layerLabels: JSON.stringify([
        'Far Wall & Vault Door', 'Mid Equipment & Lockers', 'Foreground Desks & Terminals', 'Floor Details & Overhead Pipes'
      ]),
      layerGuidance: `LAYER ORDER (top to bottom, farthest to nearest):
  Header "Far Wall & Vault Door" (0,0): The topmost/farthest layer. A massive circular vault door dominates the center-left — heavy reinforced steel with a central locking mechanism, partially open revealing a dark corridor beyond. The surrounding wall is riveted metal panels painted institutional blue-grey. A large painted vault number (e.g., "42") beside the door. Fluorescent tube lights along the ceiling cast even white light. A faded "VAULT-TEC" logo on the wall. Fills the ENTIRE cell. No magenta visible.
  Header "Mid Equipment & Lockers" (1,0): Middle distance. Rows of metal lockers along the walls — some open, some dented. Equipment racks hold tools, hazmat suits, and emergency supplies. A water purification unit with gauges and pipes. A bulletin board with faded notices and schedules. Overhead fluorescent lights flicker — one tube is dead, casting a shadow. Magenta visible at the top. Equipment fills the lower two-thirds.
  Header "Foreground Desks & Terminals" (2,0): Work stations with metal desks. Computer terminals display green text on black screens — system status readouts. A desk lamp provides warm pool of light. Scattered papers, coffee mugs, and personal items. A wall-mounted intercom speaker. Safety posters on the wall. Swivel chairs pushed back as if recently vacated. Magenta above. Content fills the lower half.
  Header "Floor Details & Overhead Pipes" (3,0): Nearest layer — the vault floor and low-hanging overhead infrastructure. Metal grate flooring with visible subfloor pipes beneath. Overhead runs of conduit, ventilation ducts, and bundled cables. A floor-standing fan oscillates. Condensation drips from a pipe joint. Yellow caution stripes painted on floor edges. A small puddle reflects the fluorescent light above. Magenta fills the upper two-thirds. Floor detail at the very bottom.`,
    },
    {
      id: 'wasteland-trading-post',
      name: 'Wasteland Trading Post',
      genre: 'Post-Apocalyptic',
      gridSize: '2x2',
      bgMode: 'scene',
      description: 'A scrap-built trading post and market in the wasteland. Four scene variants showing the same location under different conditions — bustling day, quiet day, night with campfire, and abandoned night.',
      colorNotes: 'Dusty earth tones and sun-bleached colors for day, warm orange campfire glow for night, cool blue moonlight, rust browns and faded canvas tans.',
      layerLabels: JSON.stringify([
        'Day - Bustling', 'Day - Quiet',
        'Night - Campfire', 'Night - Abandoned'
      ]),
      layerGuidance: `SCENE DESIGN — Same trading post composition across all 4 variants. Layout: A central open-air market area with scrap-metal stalls and canvas awnings. A converted shipping container serves as the main shop on the right. Strings of salvaged lights hang overhead between poles. A makeshift bar/counter on the left with stools. A guard tower built from scaffolding in the background. Barbed wire perimeter fencing visible at the edges. A hand-painted "TRADE" sign over the entrance.

  Header "Day - Bustling" (0,0): Bright harsh desert sunlight. The trading post is alive with activity — traders displaying scrap goods on tables, a merchant haggling at the counter, armed guards patrolling. Dust kicked up by foot traffic. Canvas awnings provide shade. Goods piled on tables: canned food, ammunition boxes, water jugs, mechanical parts. A pack brahmin (two-headed cow) stands near the entrance. Fill the ENTIRE cell.
  Header "Day - Quiet" (0,1): Same harsh sunlight but the post is nearly empty. Most stalls are closed with tarps pulled down. A single shopkeeper tends the main container store. A lone traveler sits at the bar counter drinking from a canteen. A sleeping dog curls under a table. Wind blows dust across the empty market. An "OPEN" sign creaks on one hinge. Peaceful but desolate.
  Header "Night - Campfire" (1,0): Nighttime with a large campfire burning in the center of the market area. Warm orange firelight illuminates the stalls and faces of a small group gathered around it. A guard silhouetted in the tower against a starry sky. Salvaged string lights glow dimly overhead. Shadows dance on the shipping container walls. Someone plays a makeshift guitar. The bar is lit by a lantern.
  Header "Night - Abandoned" (1,1): Nighttime, no campfire — the trading post appears abandoned. Cool blue moonlight casts long shadows. Stalls are empty, tarps flapping in the wind. The bar stools are knocked over. A tumbleweed rolls through. The guard tower is unmanned. An ominous silence suggested by the stillness. A single flickering light in the container store suggests someone hiding inside. Unsettling and post-apocalyptic.`,
    },
    {
      id: 'hive-interior',
      name: 'Hive Interior',
      genre: 'Sci-Fi Horror',
      gridSize: '1x4',
      bgMode: 'parallax',
      description: 'A vast organic cavern deep within an alien hive. Resin-coated walls, cocooned figures, and warm amber bioluminescence create a nightmarish organic environment. Four parallax layers from distant cavern wall to foreground floor.',
      colorNotes: 'Warm amber and dark honey for bioluminescence, obsidian black and dark brown for organic surfaces, sickly pale flesh tones for cocooned victims, translucent green-yellow for resin, deep purple shadows.',
      layerLabels: JSON.stringify([
        'Far Cavern Wall & Ceiling', 'Mid Resin Walls & Cocooned Figures', 'Near Organic Pillars & Egg Clusters', 'Hive Floor & Foreground Resin'
      ]),
      layerGuidance: `LAYER ORDER (top to bottom, farthest to nearest):
  Header "Far Cavern Wall & Ceiling" (0,0): The topmost/farthest layer. A vast organic cavern stretching into darkness. The ceiling is covered in hardened resin creating rib-like arching structures reminiscent of HR Giger's biomechanical aesthetic. Warm amber bioluminescent patches glow on the distant walls, providing the only light. Organic tubes and sinew-like cables hang from the ceiling. The scale is immense — the cavern walls disappear into shadow. Fills the ENTIRE cell. No magenta visible.
  Header "Mid Resin Walls & Cocooned Figures" (1,0): Middle distance. Closer resin-coated walls with horrifying detail — humanoid figures are partially cocooned in translucent resin, their outlines visible beneath the hardened surface. Some cocoons have been torn open from the inside, leaving empty husks. Thick resin drips down like melting wax. Faint amber light from behind the resin gives it a sickly warm glow. Biomechanical ribbing on the walls. Magenta visible at the top. Content fills the lower two-thirds.
  Header "Near Organic Pillars & Egg Clusters" (2,0): Closer pillars of hardened resin forming organic columns. Between them, clusters of leathery alien eggs rest on the organic floor — ovoid shapes about knee-high, their tops pulsing slightly as if breathing. A faint blue-green mist clings to the ground around the eggs. One egg is partially open, its four flaps peeled back revealing the dark interior. Dripping resin strands connect pillars like organic webbing. Magenta above. Content fills the lower half.
  Header "Hive Floor & Foreground Resin" (3,0): Nearest layer — the hive floor in intimate detail. Hardened organic resin covers everything in ridged, bone-like textures. Remnants of human equipment partially absorbed into the resin — a rifle barrel, a helmet, boot prints fossilized in hardened secretion. A face-hugger corpse lies discarded, its legs curled inward. Small bioluminescent nodes dot the floor providing dim amber light. Acid burn marks scar the resin. Magenta fills the upper two-thirds. Floor detail at the very bottom.`,
    },
    {
      id: 'space-station-breach',
      name: 'Space Station Breach',
      genre: 'Sci-Fi Horror',
      gridSize: '1x4',
      bgMode: 'parallax',
      description: 'A damaged space station corridor with hull breaches showing the void of space. Emergency red lighting, sparking cables, and floating debris create a tense survival horror atmosphere. Four parallax layers from stars through hull to foreground wreckage.',
      colorNotes: 'Deep black space with white stars, harsh red emergency lighting, cool blue-white sparking electricity, dark grey-blue metal hull, amber warning lights, green status screens.',
      layerLabels: JSON.stringify([
        'Space & Stars Through Breach', 'Damaged Hull & Sparking Cables', 'Emergency-Lit Corridor Section', 'Foreground Debris & Warning Signs'
      ]),
      layerGuidance: `LAYER ORDER (top to bottom, farthest to nearest):
  Header "Space & Stars Through Breach" (0,0): The topmost/farthest layer. The cold void of space visible through massive hull breaches in the station. A dense star field with a distant nebula in purple and blue provides an eerie backdrop. The curved edge of a planet or moon is partially visible in the lower portion. Torn metal edges of the hull breach frame the view like jagged teeth. Small debris particles float in zero gravity between the viewer and the stars. The contrast between the serene beauty of space and the violent destruction is unsettling. Fills the ENTIRE cell. No magenta visible.
  Header "Damaged Hull & Sparking Cables" (1,0): The station's outer hull structure visible in cross-section through the breach. Thick metal plating torn and peeled outward by decompression. Bundles of severed cables sparking with blue-white electrical discharge. Coolant pipes leaking crystallizing vapor into the vacuum. Emergency bulkhead doors partially closed but jammed by wreckage. Structural I-beams bent at unnatural angles. Frost forming on metal surfaces near the breach. Magenta visible at the top. Content fills the lower two-thirds.
  Header "Emergency-Lit Corridor Section" (2,0): An intact section of station corridor illuminated only by pulsing red emergency lights. The normal white corridor lighting is dead. Rotating amber warning beacons cast sweeping shadows. Wall-mounted status screens display critical alerts in green text. Floor emergency strips glow a faint white, marking the evacuation path. Motion tracker panels on the walls — some show contacts. The corridor curves away into darkness. Blast doors at the far end are sealed with red warning lights. Magenta above. Content fills the lower half.
  Header "Foreground Debris & Warning Signs" (3,0): Nearest layer — immediate corridor foreground wreckage. Overturned equipment lockers spilling contents — tools, medical supplies, ammunition magazines. A cracked helmet visor lies face-down. Claw marks score the metal floor in parallel grooves. A blood smear trail leads under a collapsed ceiling panel. Emergency signage flashes "HULL BREACH — SECTOR 7" in red. A discarded motion tracker beeps on the floor, its screen showing a cluster of contacts nearby. Acid burn holes in the deck plating. Magenta fills the upper two-thirds. Debris detail at the very bottom.`,
    },
    {
      id: 'alien-landscape',
      name: 'Alien Landscape',
      genre: 'Sci-Fi Horror',
      gridSize: '2x2',
      bgMode: 'scene',
      description: 'A hostile extraterrestrial planet surface with biomechanical megastructures, bioluminescent flora, and dual moons. Four scene variants showing different atmospheric and temporal conditions.',
      colorNotes: 'Dark volcanic rock in charcoal and deep purple, bioluminescent cyan and green accents, pale silver dual moonlight, amber-orange for active megastructures, sickly yellow-green toxic atmosphere.',
      layerLabels: JSON.stringify([
        'Day - Dual Moons Visible', 'Day - Storm',
        'Night - Bioluminescent', 'Night - Megastructure Active'
      ]),
      layerGuidance: `SCENE DESIGN — Same alien landscape composition across all 4 variants. Layout: A rocky alien terrain of dark volcanic stone in the foreground. Jagged crystalline formations jut from the ground at irregular angles on the left. A massive biomechanical megastructure rises in the background center-right — a towering Giger-esque cathedral of organic pipes, skeletal arches, and ribbed columns. Bioluminescent fungi and alien flora dot the mid-ground. Two moons of different sizes hang in the alien sky. A lake of dark, mirror-still liquid reflects the sky in the mid-ground left.

  Header "Day - Dual Moons Visible" (0,0): An alien daylight — the sky is a sickly yellow-green from the toxic atmosphere, brighter near the horizon. Both moons are visible — a large pale silver moon and a smaller reddish one. The megastructure is fully visible in muted grey tones, clearly ancient and dormant. Crystalline formations catch the light and refract it in prismatic patterns. Bioluminescent fungi are dim, barely visible in daylight. The dark lake reflects the yellow-green sky. Sparse alien vegetation — low, creeping tendrils with bulbous nodes. Fill the ENTIRE cell.
  Header "Day - Storm" (0,1): Same landscape under a violent alien storm. The sky churns with dark purple-black clouds shot through with veins of green lightning. Howling winds whip alien dust across the scene. The crystalline formations vibrate, emitting a visible harmonic shimmer. The megastructure's upper reaches disappear into the storm clouds. The lake surface is turbulent with dark waves. Bioluminescent plants glow brighter in the darkness — a stress response. Lightning strikes the megastructure, running down its ribbed columns. Intense and threatening.
  Header "Night - Bioluminescent" (1,0): Nighttime. Both moons are high — the larger moon is full, casting silver light. The sky is deep indigo-black with unfamiliar constellations. The true spectacle: every bioluminescent organism blazes with light. Fungi glow intense cyan-blue. Alien flowers pulse with green-yellow light. Luminescent spores drift through the air like fireflies. The crystalline formations glow from within. The dark lake reflects all the bioluminescence, creating a mirror of colored lights. The megastructure is a dark silhouette against the moonlit sky. Hauntingly beautiful and alien.
  Header "Night - Megastructure Active" (1,1): Nighttime, but the megastructure has awakened. Its organic pipes glow with pulsing amber-orange light from within. Rhythmic pulses travel up its columns like a heartbeat. Steam or vapor vents from its ribbed surfaces. The ground trembles — cracks in the volcanic rock glow with the same amber light. The lake surface ripples from the vibrations, distorting the reflections. Bioluminescent organisms have gone dark, as if in fear. Both moons are partially obscured by the megastructure's emissions. An ominous deep hum is suggested by the visual intensity. Terrifying and awe-inspiring.`,
    },
  ];

  const insert = db.prepare(
    `INSERT OR IGNORE INTO background_presets (id, name, genre, grid_size, bg_mode, description, color_notes, layer_labels, layer_guidance, is_preset)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const insertAll = db.transaction(() => {
    for (const p of PRESETS) {
      insert.run(p.id, p.name, p.genre, p.gridSize, p.bgMode, p.description, p.colorNotes, p.layerLabels, p.layerGuidance);
    }
  });

  insertAll();
  console.log(`[DB] Seeded ${PRESETS.length} background presets.`);

  // Create a grid preset per background content preset with real layer labels, then link
  const insertGrid = db.prepare(`
    INSERT OR IGNORE INTO grid_presets (name, sprite_type, genre, grid_size, cols, rows, cell_labels, cell_groups, generic_guidance, bg_mode, is_preset)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const findGrid = db.prepare("SELECT id FROM grid_presets WHERE name = ? AND sprite_type = 'background' AND grid_size = ?");
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO background_grid_links (background_preset_id, grid_preset_id, guidance_override, sort_order)
    VALUES (?, ?, ?, 0)
  `);
  const PARALLAX_GUIDANCE = `LAYER ORDER (top to bottom, farthest to nearest): Each cell is one parallax layer. Draw each layer so it tiles horizontally. Layers stack vertically — the top cell is the farthest background, the bottom cell is the nearest foreground. Maintain consistent color palette and art style across all layers. Each layer must fill its ENTIRE cell with no magenta visible.`;
  const SCENE_GUIDANCE = `Each cell in the grid has a WHITE TEXT HEADER naming the scene variant. Draw the same scene/environment in each cell but reflecting the condition described by its header label. Maintain consistent composition, landmark placement, and art style across all cells. Each cell must fill its ENTIRE area with no magenta visible.`;
  const bgSizeToDims = { '1x3': [1,3], '1x4': [1,4], '1x5': [1,5], '2x2': [2,2], '3x2': [3,2], '3x3': [3,3] };
  const linkAll = db.transaction(() => {
    for (const p of PRESETS) {
      const [cols, rows] = bgSizeToDims[p.gridSize] || [1, 4];
      const totalCells = cols * rows;
      const cellGroups = p.bgMode === 'parallax'
        ? [{ name: 'All Layers', cells: Array.from({ length: totalCells }, (_, i) => i) }]
        : (() => {
            const groups = [];
            for (let r = 0; r < rows; r++) {
              const cells = [];
              for (let c = 0; c < cols; c++) cells.push(r * cols + c);
              groups.push({ name: `Row ${r + 1}`, cells });
            }
            return groups;
          })();
      const guidance = p.bgMode === 'parallax' ? PARALLAX_GUIDANCE : SCENE_GUIDANCE;
      insertGrid.run(p.name, 'background', p.genre, p.gridSize, cols, rows,
        p.layerLabels, JSON.stringify(cellGroups), guidance, p.bgMode);
      const gridRow = findGrid.get(p.name, p.gridSize);
      if (gridRow) insertLink.run(p.id, gridRow.id, p.layerGuidance || '');
    }
  });
  linkAll();
  console.log(`[DB] Seeded background grid presets + links.`);
}
