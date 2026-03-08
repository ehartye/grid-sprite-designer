export function seedAnimationSeries(db) {
  // Check if any links already exist for these characters + iso grids
  const existing = db.prepare(`
    SELECT COUNT(*) as count FROM character_grid_links cgl
    JOIN grid_presets gp ON gp.id = cgl.grid_preset_id
    WHERE gp.aspect_ratio = '16:9' AND gp.genre = 'Isometric'
  `).get();
  if (existing.count > 0) return;

  const findGrid = db.prepare("SELECT id FROM grid_presets WHERE name = ?");
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO character_grid_links (character_preset_id, grid_preset_id, guidance_override, sort_order)
    VALUES (?, ?, ?, ?)
  `);

  const SERIES = [
    {
      characterId: 'wasteland-wanderer',
      grids: [
        {
          name: 'Iso Walk Cycle 8\u00d76',
          order: 0,
          guidance: `Walking cautiously through wasteland rubble. Crouched survival posture with spear held diagonally across body for balance. Leather duster coat sways with each step. Goggles on forehead, gas mask bouncing on chest strap. Feet carefully placed to avoid debris. Head constantly scanning left and right. Canteen swings on pack. Dust kicks up slightly from boots on each step.`,
        },
        {
          name: 'Iso Attack Cycle 8\u00d74',
          order: 1,
          guidance: `Rebar spear thrust attack sequence. Wind-up: spear pulled back with both hands, weight on rear foot. Strike: lunging forward with full-body thrust, spear tip leading. Impact: spear extended, slight twist for piercing. Recovery: pulling spear back to ready position, stepping back into defensive stance. Gas mask stays on forehead throughout. Duster flares outward during lunge.`,
        },
        {
          name: 'Iso Idle Cycle 8\u00d74',
          order: 2,
          guidance: `Standing alert in wasteland, scanning the horizon for threats. Spear held vertically in right hand, butt resting on ground. Left hand shading eyes or adjusting goggles. Subtle weight shifts from foot to foot. Occasional glance over shoulder. Breathing visible through slight chest movement. Duster drapes still. Canteen occasionally touched/checked.`,
        },
        {
          name: 'Iso Death Sequence 8\u00d74',
          order: 3,
          guidance: `Collapse from accumulated damage. Hit reaction: staggering backward, spear slipping from grip. Falling: knees buckling, hand reaching for wound. Impact: crumpling to ground on side, duster spreading around body. Final pose: lying face-down with one arm extended, spear fallen nearby, goggles knocked off, gas mask dangling from strap. Canteen spilled.`,
        },
        {
          name: 'Iso Attack Cycle 8\u00d74',
          order: 4,
          guidance: `Special attack: crouch and aim sequence. Frame 1: dropping to one knee from standing, spear shifting to overhand grip. Frame 2: crouched low behind cover (implied), pulling arm back with spear held like a javelin. Frame 3: aiming — body coiled, eyes narrowed through goggles now pulled down over eyes, gas mask hanging. Frame 4: explosive throw — full body extension, spear released in javelin throw, duster billowing from the force. Recovery implied off-sheet. Dust cloud at feet from the sudden movement.`,
        },
      ],
    },
    {
      characterId: 'xenomorph-warrior',
      grids: [
        {
          name: 'Iso Walk Cycle 8\u00d76',
          order: 0,
          guidance: `Predatory stalking movement on all fours transitioning to hunched bipedal. Low to the ground, tail stretched behind for balance, slowly sweeping side to side. Inner jaw occasionally visible through parted outer jaws. Claws extended, fingers splayed for grip. Elongated head tilted slightly as if sensing prey. Exoskeleton gleams with wet sheen. Movement is smooth and deliberate, not rushed.`,
        },
        {
          name: 'Iso Attack Cycle 8\u00d74',
          order: 1,
          guidance: `Lunging claw attack with tail strike follow-up. Wind-up: rearing back on hind legs, arms spread wide, jaws opening. Strike: explosive forward lunge, right claw slashing diagonally. Impact: claws extended at full reach, inner jaw shooting forward. Recovery: tail whips around from behind as secondary attack, then settling back to ready crouch. Acid drool trails from jaws during attack.`,
        },
        {
          name: 'Iso Idle Cycle 8\u00d74',
          order: 2,
          guidance: `Alert hunting stance, perfectly still except for subtle movements. Tail slowly swaying behind like a cat watching prey. Head making small tilting motions, sensing vibrations. Occasional jaw parting slightly revealing inner jaw. Fingers flexing and unflexing. Exoskeleton surface rippling subtly. Drool forming and dropping from lower jaw. Overall impression: coiled spring ready to explode into motion.`,
        },
        {
          name: 'Iso Death Sequence 8\u00d74',
          order: 3,
          guidance: `Acid blood death sequence. Hit: screeching with jaws fully open, body arching backward. Stagger: acid blood spraying from wound, burning ground beneath. Falling: limbs giving way asymmetrically, tail thrashing. Collapse: crumpling with acid pool forming around body. Final pose: curled on side, exoskeleton cracked open, acid still steaming, tail limp, jaws frozen open. Green-yellow acid glow.`,
        },
        {
          name: 'Iso Attack Cycle 8\u00d74',
          order: 4,
          guidance: `Tail strike attack from behind. Frame 1: crouched facing away from target, tail rising high behind the body, barbed tip glinting. Frame 2: tail arcing overhead in a scorpion-like motion, body still low and coiled. Frame 3: tail whipping forward at full extension — the segmented tail stretched to maximum reach, barbed tip driving downward. Frame 4: impact and retract — tail embedded momentarily, acid blood dripping from barb, then pulling back as the creature spins to face the target. Inner jaw visible in a hiss during the spin. Exoskeleton plates shift and flex with the tail movement.`,
        },
      ],
    },
    {
      characterId: 'vault-dweller',
      grids: [
        {
          name: 'Iso Walk Cycle 8\u00d76',
          order: 0,
          guidance: `Purposeful vault-trained walk with military-influenced posture. Upright, shoulders back, laser pistol holstered at hip. Left arm with Pip-Boy slightly raised, green screen glow visible. Blue jumpsuit crisp and clean. Steps are measured and deliberate, trained movement. Yellow stripe visible on jumpsuit sides. Boots have a slight heel click on contact. Head forward, alert but not fearful.`,
        },
        {
          name: 'Iso Attack Cycle 8\u00d74',
          order: 1,
          guidance: `Laser pistol firing sequence from trained hip-fire stance. Wind-up: drawing pistol from holster in smooth motion, left hand steadying Pip-Boy for targeting. Strike: pistol aimed and firing, red laser beam visible from barrel, slight recoil. Impact: follow-through shot, Pip-Boy screen flashing with target data. Recovery: pistol returning to ready position, not holstered. Red laser flash on frames 3-4.`,
        },
        {
          name: 'Iso Idle Cycle 8\u00d74',
          order: 2,
          guidance: `Checking Pip-Boy wrist computer readout while standing guard. Left arm raised to read Pip-Boy screen, green glow illuminating face from below. Right hand resting on holstered pistol. Subtle head movements between checking Pip-Boy and scanning surroundings. Occasional tap on Pip-Boy screen. Jumpsuit creases shift slightly with breathing. Standing at parade rest when not checking device.`,
        },
        {
          name: 'Iso Death Sequence 8\u00d74',
          order: 3,
          guidance: `Clean collapse animation befitting trained vault personnel. Hit: flinching back, hand going to chest wound, Pip-Boy arm dropping. Stagger: pistol falling from holster, knees weakening. Falling: controlled fall to knees first, then sideways. Final pose: lying on back, one hand on chest, Pip-Boy screen still glowing green on outstretched arm, pistol nearby, jumpsuit stained. Eyes closed, peaceful expression.`,
        },
      ],
    },
    {
      characterId: 'biomechanical-entity',
      grids: [
        {
          name: 'Iso Walk Cycle 8\u00d76',
          order: 0,
          guidance: `Mechanical-organic crawling movement blending robotic precision with organic fluidity. Multiple limbs move in unsettling coordination — some metallic, some fleshy. Central mass shifts weight between mechanical legs and organic tendrils. Exposed gears and pistons visible alongside pulsing tissue. Eye cluster tracks independently of body movement. Hydraulic hisses suggested by small steam puffs. Movement is eerily smooth despite the grotesque form.`,
        },
        {
          name: 'Iso Attack Cycle 8\u00d74',
          order: 1,
          guidance: `Tendril lash attack with mechanical precision. Wind-up: organic tendrils coiling back while mechanical arm extends targeting array. Strike: tendrils whipping forward in coordinated bundle, metallic barbs at tips catching light. Impact: tendrils fully extended, sparks flying from mechanical joints powering the strike. Recovery: tendrils retracting and re-coiling, mechanical components resetting with visible gear rotation. Purple bio-energy pulses along tendrils during strike.`,
        },
        {
          name: 'Iso Idle Cycle 8\u00d74',
          order: 2,
          guidance: `Pulsing mechanical-organic idle state. Organic tissue contracts and expands rhythmically like breathing. Mechanical components make small adjustment movements — gears turning, pistons cycling. Tendrils slowly writhe and probe the air. Eye cluster blinks in sequence, not simultaneously. Occasional spark from exposed wiring. Bio-luminescent patches pulse in sync with organic breathing. Steam/vapor vents periodically from cooling systems. Unsettling combination of machine precision and organic restlessness.`,
        },
        {
          name: 'Iso Death Sequence 8\u00d74',
          order: 3,
          guidance: `Component disassembly and system failure cascade. Hit: electrical discharge across body, tendrils spasming. Stagger: mechanical limbs locking at wrong angles, organic parts going limp. Falling: body listing as structural supports fail, components separating. Collapse: mechanical frame crashing down, organic tissue pooling, sparks flying from severed connections. Final pose: scattered wreckage of metal and tissue, eye cluster dimming to dark, last tendril twitching, fluids leaking, small fires on exposed circuitry.`,
        },
      ],
    },
  ];

  const linkAll = db.transaction(() => {
    let linkCount = 0;
    for (const series of SERIES) {
      for (const grid of series.grids) {
        const gridRow = findGrid.get(grid.name);
        if (gridRow) {
          insertLink.run(series.characterId, gridRow.id, grid.guidance, grid.order);
          linkCount++;
        }
      }
    }
    console.log(`[DB] Seeded ${SERIES.length} animation series (${linkCount} grid links).`);
  });

  linkAll();
}
