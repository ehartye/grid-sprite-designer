import { decomposeGuidanceBlob, RPG_FULL_RENAME } from './decomposeGuidance.js';

export function seedCharacterPresets(db) {
  const PRESETS = [
    {
      id: 'cecil-paladin',
      name: "Cecil the Paladin",
      genre: "Classic Fantasy",
      description: "A noble paladin with shoulder-length silver-white hair, strong jawline, and piercing blue eyes. Medium athletic build. Stands with confident, upright posture.",
      equipment: "Ornate white-and-gold plate armor with a blue cape, wielding a holy longsword with a glowing blade. Shield with a sun emblem on his back.",
      colorNotes: "Silver-white hair, blue eyes. White and gold armor with blue accents. Cape is royal blue with gold trim.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Cecil stands relaxed facing the viewer, longsword held loosely at his right side with the blade pointing down. Cape drapes naturally and his expression is calm and noble.
  Header "Idle Up" (2,1): Relaxed standing pose facing away, cape and shield filling the view. His silver-white hair rests on his shoulders above the blue cape.
  Header "Idle Left" (2,2): Cecil faces left in a relaxed stance, sword visible at his side, weight evenly distributed. His left hand rests near his belt.
  Header "Idle Right" (2,3): Relaxed facing right, the blue cape flowing gently. His right hand holds the sword loosely and the gold-trimmed armor catches ambient light.
  Header "Battle Idle 1" (2,4): Cecil drops into a combat-ready crouch, sword raised at mid-guard and shield arm braced forward. A faint holy glow emanates from the blade.
  Header "Battle Idle 2" (2,5): Slight sway in his battle stance, the holy glow on the longsword intensifying briefly. Cape billows slightly as he shifts his weight between feet.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Cecil holds his battle stance firmly, cape billowing behind him, sword gleaming with holy light. His piercing blue eyes are locked forward in concentration.
  Header "Attack 1" (3,1): Wind-up pose — Cecil pulls the holy longsword back over his right shoulder, body coiled and weight shifting to his back foot. The cape wraps slightly around his torso.
  Header "Attack 2" (3,2): Mid-swing — the holy sword slashes forward in a diagonal arc, a small trail of white-gold light following the blade. His body rotates into the strike.
  Header "Attack 3" (3,3): Follow-through — sword fully extended forward, a small burst of holy light erupting at the blade tip. The cape flies outward from the rotational force.
  Header "Cast 1" (3,4): Cecil raises the longsword overhead with both hands, blade pointing skyward. Small motes of white holy energy begin gathering around the blade.
  Header "Cast 2" (3,5): His eyes glow faintly white as a small pillar of holy light forms around the raised sword. The cape lifts slightly from the energy.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The holy spell releases — a small burst of divine light erupts from the sword, cape billowing upward from the energy. His armor glows briefly with golden radiance.
  Header "Damage 1" (4,1): Cecil flinches backward from a hit, raising his left arm defensively while the shield catches impact. His expression shows pain through gritted teeth.
  Header "Damage 2" (4,2): Staggering back further, Cecil leans away with a dent visible in his shoulder armor. His cape whips forward from the force of the blow.
  Header "Damage 3" (4,3): Recovery pose — Cecil plants the longsword tip into the ground for balance, pushing himself back to standing. His cape settles behind him.
  Header "KO 1" (4,4): His knees buckle as his grip on the sword loosens. His head drops and the holy glow on the blade fades. The shield slides off his back.
  Header "KO 2" (4,5): Falling — his body hits the ground on one side, cape spreading beneath him. The longsword slips from his fingers.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Cecil lies fully on the ground, longsword beside his body and cape draped partially over his face. The holy glow has completely faded from his equipment.
  Header "Victory 1" (5,1): Cecil raises the holy longsword triumphantly overhead with one hand, cape flowing behind him. The blade pulses with renewed holy light.
  Header "Victory 2" (5,2): Sword held high, small holy sparkles erupt around Cecil as the cape billows dramatically. His expression is one of righteous satisfaction.
  Header "Victory 3" (5,3): Cecil plants the longsword into the ground before him and crosses his arms, standing confidently. The cape drapes regally and the blade still faintly glows.
  Header "Weak Pose" (5,4): Cecil kneels on one knee using the longsword as a crutch, panting with visible exhaustion. His armor is scuffed and the cape is torn at the edges.
  Header "Critical Pose" (5,5): Desperate last stand — Cecil barely stands with cracked armor plates, the holy aura around his sword flickering weakly. His blue eyes burn with defiant resolve.`,
      groupGuidance: {
        "Walk South Animation Frames": "Cecil strides South with noble confidence, the holy longsword held loosely in his right hand with the blade angled back and the sun-emblem shield strapped across his back. His blue cape sways gently and the gold trim of his white plate armor catches the light.",
        "Walk North Animation Frames": "Cecil strides North with noble confidence, the holy longsword held loosely in his right hand with the blade angled back and the sun-emblem shield strapped across his back. His blue cape sways gently and the gold trim of his white plate armor catches the light.",
        "Walk West Animation Frames": "Cecil strides West with noble confidence, the holy longsword held loosely in his right hand with the blade angled back and the sun-emblem shield strapped across his back. His blue cape sways gently and the gold trim of his white plate armor catches the light.",
        "Walk East Animation Frames": "Cecil strides East with noble confidence, the holy longsword held loosely in his right hand with the blade angled back and the sun-emblem shield strapped across his back. His blue cape sways gently and the gold trim of his white plate armor catches the light."
      },
    },
    {
      id: 'vivienne-scholar',
      name: "Vivienne the Scholar",
      genre: "Classic Fantasy",
      description: "A studious mage with chin-length dark auburn hair, round spectacles, and warm brown eyes. Petite frame with a thoughtful expression and slightly hunched scholarly posture.",
      equipment: "Flowing purple robes with gold embroidered runes, carrying a thick leather-bound tome in one hand and a crystal-topped staff in the other. A satchel of scrolls at her hip.",
      colorNotes: "Dark auburn hair, brown eyes. Deep purple robes with gold trim and rune patterns. Staff crystal is pale violet. Book is brown leather with gold clasps.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Vivienne stands facing the viewer reading her tome absently, staff resting on her right shoulder. Her spectacles sit low on her nose and her expression is absorbed in thought.
  Header "Idle Up" (2,1): Facing away, the back of her purple robes with gold rune embroidery fills the view. The staff leans against her shoulder and the satchel hangs at her hip.
  Header "Idle Left" (2,2): Vivienne faces left in a relaxed stance, one finger holding her place in the open tome. The staff rests in the crook of her arm.
  Header "Idle Right" (2,3): Facing right, she holds the staff loosely with the crystal end tilted forward. The tome is tucked under her other arm, gold clasps catching light.
  Header "Battle Idle 1" (2,4): Vivienne snaps to attention — the tome floats open before her and the staff is raised with its crystal glowing bright violet. Small arcane symbols drift around her.
  Header "Battle Idle 2" (2,5): The tome pages flip magically on their own as the staff crystal pulses with intensifying violet light. Her auburn hair lifts slightly from the arcane energy.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Vivienne pushes her spectacles up with one finger, settling into a ready stance. The floating tome hovers at her side and the staff crystal hums with energy.
  Header "Attack 1" (3,1): Wind-up — Vivienne pulls the staff back with both hands as the tome snaps shut and tucks itself under her arm. Her weight shifts to her back foot.
  Header "Attack 2" (3,2): Vivienne sweeps the staff forward in an arc, the crystal releasing a small burst of violet arcane energy. Her robes flare outward from the motion.
  Header "Attack 3" (3,3): Follow-through — a compact violet energy blast erupts from the crystal tip as the staff extends fully. Small arcane glyphs shimmer in the blast trail.
  Header "Cast 1" (3,4): The tome floats open before Vivienne, pages glowing. She raises both hands, fingers splayed, as a small circle of golden runes forms around her.
  Header "Cast 2" (3,5): A larger spell circle materializes as her auburn hair floats upward from the magical current. The tome pages turn rapidly and the rune circle spins.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The spell releases — a focused beam of violet light shoots from the floating tome as the rune circle collapses inward. Her robes billow from the energy discharge.
  Header "Damage 1" (4,1): Vivienne flinches from a hit, spectacles knocked askew on her face. She clutches the tome protectively to her chest while the staff wavers in her grip.
  Header "Damage 2" (4,2): Staggering backward, a few scrolls spill from her satchel. Her spectacles hang crooked and her expression shows alarm. The staff crystal flickers.
  Header "Damage 3" (4,3): Recovery — Vivienne steadies herself, pushing her spectacles back into place with a trembling hand. She pulls the tome closer and the staff crystal stabilizes.
  Header "KO 1" (4,4): Vivienne collapses forward, curling protectively over the tome. The staff slips from her hand and the crystal dims. Scrolls scatter from the satchel.
  Header "KO 2" (4,5): Falling to her side, Vivienne hugs the tome to her chest. Her spectacles slide off her face and the staff rolls away, crystal going dark.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Vivienne lies on the ground using the closed tome as a pillow, spectacles fallen beside her face. The staff lies nearby with its crystal completely dim.
  Header "Victory 1" (5,1): Vivienne adjusts her spectacles with a satisfied, slightly smug smile. The tome snaps shut in her hand with a decisive thump.
  Header "Victory 2" (5,2): She raises the staff overhead, the crystal erupting with violet sparkles. The tome floats beside her spinning gently in celebration.
  Header "Victory 3" (5,3): Vivienne tucks the tome under her arm and pushes her spectacles up confidently, staff planted at her side. A few arcane glyphs orbit her like fireflies.
  Header "Weak Pose" (5,4): Vivienne leans heavily on her staff for support, the crystal barely glowing. The tome is clutched tightly to her chest and she pants through parted lips.
  Header "Critical Pose" (5,5): Barely standing, Vivienne holds the open tome before her as its pages swirl protectively in a defensive barrier. Her spectacles are cracked and the staff crystal sputters.`,
      groupGuidance: {
        "Walk South Animation Frames": "While walking, Vivienne the Scholar holds her spell book under her left arm and her crystal staff in her right hand, held upright. Her satchel of scrolls bounces gently on her left hip.",
        "Walk North Animation Frames": "While walking, Vivienne the Scholar holds her spell book under her left arm and her crystal staff in her right hand, held upright. Her satchel of scrolls bounces gently on her left hip.",
        "Walk West Animation Frames": "While walking, Vivienne the Scholar holds her spell book under her left arm and her crystal staff in her right hand, held upright. Her satchel of scrolls bounces gently on her left hip.",
        "Walk East Animation Frames": "While walking, Vivienne the Scholar holds her spell book under her left arm and her crystal staff in her right hand, held upright. Her satchel of scrolls bounces gently on her left hip."
      },
    },
    {
      id: 'kael-thornwood',
      name: "Kael Thornwood",
      genre: "Classic Fantasy",
      description: "A lithe elven ranger with long braided golden hair, pointed ears, and sharp green eyes. Lean athletic build with graceful, balanced stance.",
      equipment: "Supple forest-green leather armor with a brown hooded cloak, carrying an elegant longbow across his back and a quiver of silver-tipped arrows. A hunting knife at his belt.",
      colorNotes: "Golden blonde hair, bright green eyes. Forest-green leather with brown cloak and belt. Bow is pale wood with silver inlay. Arrow fletching is emerald green.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Kael stands in a calm watchful stance facing the viewer, right hand resting near the hunting knife at his belt. His pointed ears are alert and his green eyes scan the surroundings.
  Header "Idle Up" (2,1): Relaxed facing away, the cloak draped over his shoulders and the longbow and quiver visible. His braided golden hair rests along his spine.
  Header "Idle Left" (2,2): Facing left in a relaxed stance, one hand touching the bow strap on his shoulder. His elven features are visible in profile with pointed ear prominent.
  Header "Idle Right" (2,3): Facing right, Kael stands casually with his hand near the quiver. The brown cloak shifts slightly in an ambient breeze.
  Header "Battle Idle 1" (2,4): Kael crouches low with the longbow drawn and a silver-tipped arrow nocked, eyes narrowed in focus. The cloak is pulled back to free his arms.
  Header "Battle Idle 2" (2,5): Slight sway in his crouched archer stance, the bowstring taut. He scans for targets, the arrowhead glinting with silver.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Kael holds the drawn bow steady, the silver arrow tip glinting. The bowstring is taut and his braided hair hangs over his shoulder, cloak pulled aside.
  Header "Attack 1" (3,1): Kael draws the bow fully back, pulling the silver-tipped arrow to his cheek. His green eyes narrow with precision and his body coils with tension.
  Header "Attack 2" (3,2): The arrow releases — a silver streak trails from the bow as his fingers snap open. The bowstring vibrates and a small flash marks the departure.
  Header "Attack 3" (3,3): Follow-through — bow arm fully extended, fingers still open from the release. The silver arrow is a small streak at the edge of the cell, cloak blown back.
  Header "Cast 1" (3,4): Kael reaches into his quiver and draws a special arrow wreathed in small green nature energy. Tiny vines spiral around the arrowhead as he nocks it.
  Header "Cast 2" (3,5): The enchanted arrow is drawn back, swirling with green nature magic. Small leaves and thorn fragments orbit the arrowhead and his green eyes glow faintly.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The enchanted arrow releases, trailing a small burst of vines and thorns. A compact explosion of green nature energy marks the impact point ahead of his bow arm.
  Header "Damage 1" (4,1): Kael stumbles backward from a hit, his cloak torn at the edge. The bow wavers in his grip and a few arrows spill from the disturbed quiver.
  Header "Damage 2" (4,2): Staggering further, Kael clutches his side with his bow hand. His braided hair is disheveled and the cloak is partially ripped.
  Header "Damage 3" (4,3): Recovery — Kael steadies himself on one knee, drawing a fresh arrow from the quiver. His expression is pained but determined, green eyes still sharp.
  Header "KO 1" (4,4): The longbow slips from his loosening grip as his knees buckle. His golden braid falls across his face and the quiver tilts, spilling arrows.
  Header "KO 2" (4,5): Kael falls onto his side, the bow clattering beside him. His cloak spreads around his body and arrows scatter on the ground.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Kael lies on the ground wrapped in his brown cloak like a blanket, the longbow resting beside him. His braided hair spills across the ground and his eyes are closed.
  Header "Victory 1" (5,1): Kael spins a silver-tipped arrow between his fingers with a confident smirk, the longbow resting on his shoulder. His green eyes gleam with satisfaction.
  Header "Victory 2" (5,2): He tosses the arrow into the air and catches it deftly, his braided hair swinging. The cloak billows behind him in a dramatic pose.
  Header "Victory 3" (5,3): Kael slings the bow over his shoulder and crosses his arms, smirking with elven grace. A few emerald-fletched arrows remain in his quiver.
  Header "Weak Pose" (5,4): Kael uses the longbow as a crutch to stay upright, panting heavily. His cloak is tattered, the quiver nearly empty, and his green eyes are weary.
  Header "Critical Pose" (5,5): Barely standing, Kael draws his last silver-tipped arrow with trembling hands. His aim wavers but his jaw is set with elven determination.`,
      groupGuidance: {
        "Walk South Animation Frames": "Kael walks South with a light, silent elven stride, the longbow slung over his right shoulder with the quiver of silver-tipped arrows on his left hip. His brown cloak sways gently, his braided golden hair catches the light, and the hunting knife glints at his right hip.",
        "Walk North Animation Frames": "Kael walks North with a light, silent elven stride, the longbow slung over his right shoulder with the quiver of silver-tipped arrows on his left hip. His brown cloak sways gently, his braided golden hair catches the light, and the hunting knife glints at his right hip.",
        "Walk West Animation Frames": "Kael walks West with a light, silent elven stride, the longbow slung over his right shoulder with the quiver of silver-tipped arrows on his left hip. His brown cloak sways gently, his braided golden hair catches the light, and the hunting knife glints at his right hip.",
        "Walk East Animation Frames": "Kael walks East with a light, silent elven stride, the longbow slung over his right shoulder with the quiver of silver-tipped arrows on his left hip. His brown cloak sways gently, his braided golden hair catches the light, and the hunting knife glints at his right hip."
      },
    },
    {
      id: 'chrono-blade',
      name: "Chrono Blade",
      genre: "Sci-Fantasy",
      description: "A time-traveling swordsman with spiky dark blue hair, a determined gaze, and a glowing temporal sigil on his forehead. Athletic build with a dynamic, forward-leaning combat stance.",
      equipment: "Sleek silver-gray light armor with crimson accents, a flowing red scarf that trails behind him, and a gleaming katana with a clock-gear guard. A small chrono-device on his left wrist.",
      colorNotes: "Dark blue spiky hair, amber eyes. Silver-gray armor with red accents and scarf. Katana blade has a faint blue temporal glow. Wrist device pulses cyan.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Chrono Blade stands facing the viewer with his right hand resting on the sheathed katana hilt, scarf drifting lazily. His amber eyes are watchful and the temporal sigil glows faintly.
  Header "Idle Up" (2,1): Facing away, the red scarf drapes down his back over the silver-gray armor. The katana sheath is visible at his left hip and his spiky hair silhouettes against the background.
  Header "Idle Left" (2,2): Facing left in a relaxed stance, hand on katana hilt. His lean profile shows the temporal sigil and the chrono-device glows steadily on his wrist.
  Header "Idle Right" (2,3): Facing right, scarf drifting gently behind him. His right hand rests casually on the clock-gear katana guard, amber eyes scanning ahead.
  Header "Battle Idle 1" (2,4): Chrono Blade draws the katana in a forward-leaning iaido stance, the blade emanating a faint blue temporal glow. A small afterimage trails behind his leading shoulder.
  Header "Battle Idle 2" (2,5): He shifts weight in his battle stance, the temporal sigil blazing brighter. A small translucent afterimage of his previous position lingers briefly beside him.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Chrono Blade holds the drawn katana low and forward, blade glowing blue. The red scarf whips in an unseen temporal wind and his amber eyes are locked on target.
  Header "Attack 1" (3,1): Iaido wind-up — he sheathes the katana and crouches low, hand on the hilt ready to quickdraw. The chrono-device flashes cyan and time seems to compress around him.
  Header "Attack 2" (3,2): Quickdraw slash — the katana is a blur of blue temporal energy as he draws and slashes in one motion. A small arc of blue light trails the blade path.
  Header "Attack 3" (3,3): Follow-through — the katana is fully extended, a fading blue temporal blur trail marking the slash. His scarf catches up a beat late, showing the speed.
  Header "Cast 1" (3,4): Chrono Blade raises his left wrist as the chrono-device activates, projecting small cyan time-distortion circles. The katana is held back in his right hand.
  Header "Cast 2" (3,5): The time-distortion circles expand and spin around him, the temporal sigil blazing. His hair and scarf float upward from the chronal energy.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): A small time-freeze burst erupts from the chrono-device, sending a ripple of cyan distortion outward. He stands at the center with scarf frozen mid-billow.
  Header "Damage 1" (4,1): Chrono Blade recoils from a hit, the red scarf whipping violently forward. The temporal sigil flickers and a small translucent shield shimmer fades on impact.
  Header "Damage 2" (4,2): Staggering backward, the chrono-device sparks on his wrist. His katana wavers in his grip and the temporal afterimage effect stutters erratically.
  Header "Damage 3" (4,3): Recovery — he plants one foot and steadies himself, katana raised defensively. The scarf settles and the chrono-device stabilizes with a dim cyan pulse.
  Header "KO 1" (4,4): The chrono-device sparks and shorts out as his knees give way. The katana dips toward the ground and the temporal sigil goes dark.
  Header "KO 2" (4,5): Collapsing forward, the katana clatters from his grip. His red scarf pools around him and fading temporal echoes flicker around his falling body.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Chrono Blade lies on the ground, katana beside him and scarf spread beneath his body. Faint temporal echoes fade like ghosts around his still form. The chrono-device is dark.
  Header "Victory 1" (5,1): Chrono Blade performs a swift katana flourish, the blue-glowing blade tracing a circle of light. His red scarf billows dramatically behind him.
  Header "Victory 2" (5,2): He sheathes the katana with a precise click, the temporal sigil pulsing triumphantly. The scarf settles in a dramatic drape and his amber eyes gleam.
  Header "Victory 3" (5,3): Standing tall with arms crossed, the sheathed katana at his side and scarf drifting in slow motion. The chrono-device projects small celebratory cyan sparks.
  Header "Weak Pose" (5,4): Chrono Blade hunches forward, one hand on his knee and the other gripping the katana loosely. The chrono-device malfunctions, flickering between states, and his afterimage stutters.
  Header "Critical Pose" (5,5): Barely standing, he grips the katana with both hands as the chrono-device crackles erratically. His body flickers with translucent temporal duplicates and his scarf is tattered.`,
      groupGuidance: {
        "Walk South Animation Frames": "Chrono Blade strides South with athletic purpose, his right hand resting on the sheathed katana at his left hip and the long red scarf trailing dynamically behind him. The temporal sigil on his forehead and the chrono-device on his left wrist pulse with faint cyan light.",
        "Walk North Animation Frames": "Chrono Blade strides North with athletic purpose, his right hand resting on the sheathed katana at his left hip and the long red scarf trailing dynamically behind him. The temporal sigil on his forehead and the chrono-device on his left wrist pulse with faint cyan light.",
        "Walk West Animation Frames": "Chrono Blade strides West with athletic purpose, his right hand resting on the sheathed katana at his left hip and the long red scarf trailing dynamically behind him. The temporal sigil on his forehead and the chrono-device on his left wrist pulse with faint cyan light.",
        "Walk East Animation Frames": "Chrono Blade strides East with athletic purpose, his right hand resting on the sheathed katana at his left hip and the long red scarf trailing dynamically behind him. The temporal sigil on his forehead and the chrono-device on his left wrist pulse with faint cyan light."
      },
    },
    {
      id: 'shadow-weaver',
      name: "Shadow Weaver",
      genre: "Dark Fantasy",
      description: "A stealthy assassin with short-cropped black hair, pale skin, and narrow violet eyes that gleam in darkness. Slim, agile build with a low crouching ready stance.",
      equipment: "Form-fitting dark leather armor with deep purple trim, a half-face mask covering the lower face, twin curved daggers with serrated edges, and a belt of throwing knives. A dark hooded cloak with a tattered hem.",
      colorNotes: "Black hair, violet eyes, pale skin. Very dark charcoal leather armor with deep purple accents. Daggers are dark steel with purple gem pommels. Cloak is near-black with purple lining.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Shadow Weaver crouches facing the viewer, hood up and violet eyes scanning. Her right hand rests on a concealed dagger hilt beneath the cloak. Small wisps of shadow drift at her feet.
  Header "Idle Up" (2,1): Crouched facing away, the hooded cloak nearly envelops her form. The tattered hem pools on the ground and the purple cloak lining shows at the edges.
  Header "Idle Left" (2,2): Facing left in a low crouch, one hand near a dagger. Her narrow violet eyes peer from beneath the hood and pale skin stands stark against dark armor.
  Header "Idle Right" (2,3): Facing right, crouched and watchful. The half-face mask and glowing violet eyes create an intimidating profile against the dark cloak.
  Header "Battle Idle 1" (2,4): Shadow Weaver throws back the cloak and draws both curved daggers, dropping into a low combat stance. Small shadow wisps rise from her charcoal armor. The purple gem pommels glow faintly.
  Header "Battle Idle 2" (2,5): She shifts weight between feet in her dual-dagger stance, the serrated edges catching dim light. Shadow wisps coil around her forearms and the violet eyes narrow.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Shadow Weaver holds her daggers reversed in a defensive cross, shadow wisps thickening around her. The cloak billows behind and the purple gem pommels pulse.
  Header "Attack 1" (3,1): Wind-up — she coils her body tight, both daggers pulled back to her sides. Her violet eyes flash and small shadow trails begin forming behind the blades.
  Header "Attack 2" (3,2): Rapid double slash — both curved daggers slash forward in an X-pattern, each trailing a small arc of dark shadow energy. Her body blurs with speed.
  Header "Attack 3" (3,3): Follow-through — daggers fully extended from the X-slash, small shadow trails dissipating. Her cloak whips from the rotational force and she slides to a stop.
  Header "Cast 1" (3,4): Shadow Weaver sheathes both daggers and raises her hands as shadow tendrils rise from beneath her. Her body begins dissolving into darkness from the feet up, only violet eyes remaining bright.
  Header "Cast 2" (3,5): She is nearly melted into a pool of living shadow, only her violet eyes and the top of her hooded head visible. Small shadow tendrils reach outward from the pool.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): A small explosion of shadow erupts outward from where she stood, sending dark tendrils in all directions. Her violet eyes flash from within the epicenter of the burst.
  Header "Damage 1" (4,1): Shadow Weaver recoils from a hit, the half-face mask cracking along one side. Her daggers waver in her grip and the shadow wisps scatter.
  Header "Damage 2" (4,2): Staggering back, a section of her mask falls away revealing pale skin beneath. Her cloak is torn and one dagger nearly slips from her fingers.
  Header "Damage 3" (4,3): Recovery — she catches her balance in a low crouch, re-gripping both daggers. The broken mask shows her gritted teeth and the shadow wisps slowly reform.
  Header "KO 1" (4,4): Her daggers clatter to the ground as her legs give out. Her form begins dissolving into shadow involuntarily, edges flickering between solid and dark vapor.
  Header "KO 2" (4,5): She collapses into a spreading pool of shadow, her body half-dissolved. The violet eyes dim and the daggers lie abandoned at the edge of the pool.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Only a dark puddle of shadow remains on the ground with two fading violet points of light where her eyes were. The daggers and broken mask fragments lie nearby.
  Header "Victory 1" (5,1): Shadow Weaver flips both daggers into the air with a casual wrist flick, the serrated blades spinning. Her violet eyes crinkle with satisfaction above the intact mask.
  Header "Victory 2" (5,2): She catches both daggers and crosses them before her in a showy pose. Small shadow wisps spiral around her in a celebratory vortex.
  Header "Victory 3" (5,3): Shadow Weaver melts briefly into shadow and reappears standing confidently with daggers sheathed, arms crossed. The cloak settles around her with dramatic flair.
  Header "Weak Pose" (5,4): Crouching low with one dagger as support, her shadow form is unstable — edges of her body flicker between solid and vapor. The mask is cracked and her breathing is ragged.
  Header "Critical Pose" (5,5): Barely holding form, her body phases in and out of shadow uncontrollably. One dagger is gone, the other gripped desperately. Her violet eyes flicker like dying embers.`,
      groupGuidance: {
        "Walk South Animation Frames": "Shadow Weaver skulks South in a low predatory crouch, her right hand gripping one curved dagger beneath the cloak and her left hand hovering near the belt of throwing knives at her hip. The dark hooded cloak wraps tightly around her slim frame, her violet eyes gleam above the half-face mask, and the tattered hem brushes the ground.",
        "Walk North Animation Frames": "Shadow Weaver skulks North in a low predatory crouch, her right hand gripping one curved dagger beneath the cloak and her left hand hovering near the belt of throwing knives at her hip. The dark hooded cloak wraps tightly around her slim frame, her violet eyes gleam above the half-face mask, and the tattered hem brushes the ground.",
        "Walk West Animation Frames": "Shadow Weaver skulks West in a low predatory crouch, her right hand gripping one curved dagger beneath the cloak and her left hand hovering near the belt of throwing knives at her hip. The dark hooded cloak wraps tightly around her slim frame, her violet eyes gleam above the half-face mask, and the tattered hem brushes the ground.",
        "Walk East Animation Frames": "Shadow Weaver skulks East in a low predatory crouch, her right hand gripping one curved dagger beneath the cloak and her left hand hovering near the belt of throwing knives at her hip. The dark hooded cloak wraps tightly around her slim frame, her violet eyes gleam above the half-face mask, and the tattered hem brushes the ground."
      },
    },
    {
      id: 'ignis-pyromancer',
      name: "Ignis the Pyromancer",
      genre: "Elemental Fantasy",
      description: "A fierce fire sorceress with long, wild flame-red hair that seems to flicker at the tips, bright orange eyes, and warm bronze skin. Medium build with an assertive, wide-footed stance.",
      equipment: "Layered crimson and burnt-orange robes with ember-like particles drifting from the hems, ornate gold bracers on both wrists, and a staff topped with a caged fireball. A fire-opal pendant at her throat.",
      colorNotes: "Flame-red hair with orange-yellow tips, orange eyes, bronze skin. Crimson and burnt-orange robes. Gold bracers and pendant. Staff fire is bright orange-yellow. Ember particles are orange-red.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Ignis stands in a wide-footed stance facing the viewer, staff resting beside her. Embers drift lazily from her robe hems and her flame-red hair tips glow softly.
  Header "Idle Up" (2,1): Facing away in a relaxed stance, the wild flame-red hair flows down her back with flickering tips. The crimson robes and ember particles create a warm silhouette.
  Header "Idle Left" (2,2): Facing left, Ignis rests the staff against her shoulder. The caged fireball flickers gently and a few embers orbit the gold bracers on her near wrist.
  Header "Idle Right" (2,3): Facing right, she holds the staff loosely at her side. The fire-opal pendant pulses with inner warmth and her orange eyes glow faintly.
  Header "Battle Idle 1" (2,4): Ignis drops into an aggressive wide stance, staff held forward with the caged fireball blazing brightly. Small flames lick at her feet and her hair tips ignite with orange fire.
  Header "Battle Idle 2" (2,5): She shifts weight in her combat stance as a small ring of fire orbits her staff. The gold bracers glow with heat and her hair floats upward slightly from the thermal updraft.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Ignis holds her battle stance, flames intensifying around the staff. Her orange eyes blaze and ember particles swirl faster around her crimson robes.
  Header "Attack 1" (3,1): Wind-up — Ignis raises the staff overhead, the caged fireball growing brighter. She plants her feet wide and coils her torso, heat shimmer rising around her.
  Header "Attack 2" (3,2): She slams the staff down and a small wave of fire erupts forward from the impact point. Her robes flare outward and her hair whips from the force.
  Header "Attack 3" (3,3): Follow-through — the fire wave crests at the edge of the cell, staff planted in the ground. Her bronze skin gleams from the heat, embers showering around her.
  Header "Cast 1" (3,4): Ignis raises both hands, the staff floating beside her. Her flame-red hair ignites fully, becoming a mane of fire. A small vortex of flames begins forming between her palms.
  Header "Cast 2" (3,5): The fire vortex grows between her outstretched hands as her entire body radiates heat. The gold bracers glow white-hot and the fire-opal pendant blazes.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Ignis launches a small but intense fireball from her palms, a compact meteor of orange-yellow flame. Her robes billow violently upward and her hair is a column of fire above her head.
  Header "Damage 1" (4,1): Ignis stumbles back from a hit, her flames sputtering momentarily. The caged fireball on the staff dims and the ember particles scatter chaotically around her.
  Header "Damage 2" (4,2): Staggering further, cracks appear in one of her gold bracers. Her hair flames flicker out at the tips, returning to just red, and the fire-opal pendant dims.
  Header "Damage 3" (4,3): Recovery — Ignis reignites with effort, small flames returning to her hair tips. She grips the staff tighter and the caged fireball steadies, though dimmer than before.
  Header "KO 1" (4,4): All fires die out — her hair falls limp as normal red hair, the staff fireball extinguishes, and the embers vanish. She drops to her knees.
  Header "KO 2" (4,5): She falls forward, the now-dark staff clattering beside her. Her crimson robes spread on the ground with no embers or fire. The gold bracers are dull and cold.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Ignis lies on the ground, robes spread around her with the extinguished staff nearby. A last thin wisp of smoke rises from her hair. The fire-opal pendant is dark and cracked.
  Header "Victory 1" (5,1): Ignis thrusts her staff skyward as a small pillar of fire erupts from the caged fireball. Her hair blazes fully and her wide grin radiates fierce triumph.
  Header "Victory 2" (5,2): She spins the staff in a fiery flourish, creating a ring of small embers around her. The gold bracers shine and her bronze skin glows warmly from the firelight.
  Header "Victory 3" (5,3): Ignis plants the staff and stands with her free hand on her hip, flames dancing along her hair. The fire-opal pendant pulses victoriously and embers float in celebration.
  Header "Weak Pose" (5,4): Ignis leans on the staff with both hands, flames barely flickering at her hair tips. The caged fireball is dim, the pendant cracked, and her breathing comes in heavy gasps.
  Header "Critical Pose" (5,5): Barely standing in a wide desperate stance, her flames are reduced to faint flickers. The gold bracers are fractured, the staff fireball gutters, and only her blazing orange eyes remain defiant.`,
      groupGuidance: {
        "Walk South Animation Frames": "Ignis strides South with assertive confidence, her caged-fireball staff held upright in her right hand and her left hand swinging freely with the gold bracer glinting. Her wild flame-red hair sways with flickering orange-yellow tips and small ember particles drift from the hems of her crimson robes.",
        "Walk North Animation Frames": "Ignis strides North with assertive confidence, her caged-fireball staff held upright in her right hand and her left hand swinging freely with the gold bracer glinting. Her wild flame-red hair sways with flickering orange-yellow tips and small ember particles drift from the hems of her crimson robes.",
        "Walk West Animation Frames": "Ignis strides West with assertive confidence, her caged-fireball staff held upright in her right hand and her left hand swinging freely with the gold bracer glinting. Her wild flame-red hair sways with flickering orange-yellow tips and small ember particles drift from the hems of her crimson robes.",
        "Walk East Animation Frames": "Ignis strides East with assertive confidence, her caged-fireball staff held upright in her right hand and her left hand swinging freely with the gold bracer glinting. Her wild flame-red hair sways with flickering orange-yellow tips and small ember particles drift from the hems of her crimson robes."
      },
    },
    {
      id: 'mx-zero',
      name: "MX-Zero",
      genre: "Sci-Fi Action",
      description: "A heroic robot with a rounded blue helmet featuring a red gem on the forehead, expressive green eyes, and a compact humanoid frame. Solid, balanced stance with one arm transformed into a cannon.",
      equipment: "Sleek blue and cyan armor plating over a dark bodysuit, with white joints and accents. Right arm is a modular arm cannon with a glowing cyan barrel. Armored boots with jet boosters.",
      colorNotes: "Primary blue armor with cyan highlights. White joint segments and trim. Dark navy bodysuit underneath. Helmet gem is red. Arm cannon glows cyan. Boot jets are orange when active.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): MX-Zero stands in a relaxed scanning mode facing the viewer, arm cannon lowered and barrel dim. His green eyes blink in a friendly manner and the helmet gem pulses softly red.
  Header "Idle Up" (2,1): Facing away in standby, the back armor panels and boot jet ports are visible. His compact frame is upright with the arm cannon resting at his side.
  Header "Idle Left" (2,2): Facing left in idle mode, arm cannon hanging at his side. His green eyes are half-lidded in a relaxed expression and the cyan highlights on his armor are muted.
  Header "Idle Right" (2,3): Facing right, standing balanced with the arm cannon resting. The red helmet gem pulses in a slow rhythm and the white joint segments are clean and bright.
  Header "Battle Idle 1" (2,4): MX-Zero snaps to combat mode — arm cannon raised and charged with intense cyan glow, knees bent in a firing stance. A small targeting reticle appears in his green eyes.
  Header "Battle Idle 2" (2,5): He shifts in his combat stance, the arm cannon humming with building energy. The helmet gem blazes red and the boot jets engage with small orange flares for stability.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): MX-Zero holds his firing stance, arm cannon fully charged and glowing bright cyan. His green eyes lock forward with the targeting display active and all armor panels are battle-tight.
  Header "Attack 1" (3,1): Wind-up — the arm cannon barrel opens wider as energy concentrates inside, glowing intensely cyan. MX-Zero braces his feet and leans into the firing position.
  Header "Attack 2" (3,2): Rapid fire — a small burst of cyan plasma shoots from the cannon barrel with a bright muzzle flash. His arm recoils slightly from the discharge and his boots grip the ground.
  Header "Attack 3" (3,3): Follow-through — the plasma bolt streaks to the edge of the cell as the cannon barrel vents small wisps of cyan energy. His body rocks back from the recoil.
  Header "Cast 1" (3,4): The arm cannon begins transforming — panels shift and the barrel extends, reconfiguring into a larger mega-buster form. Energy crackles along the new barrel as it charges.
  Header "Cast 2" (3,5): The mega-buster is fully formed and charging, a sphere of intense cyan energy growing at the barrel tip. All of his armor lights pulse in sync and his green eyes blaze.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The mega-buster fires a massive charged shot — a large cyan energy sphere launches forward with a blinding flash. The recoil pushes him back and his boot jets fire to compensate.
  Header "Damage 1" (4,1): MX-Zero staggers from a hit, blue armor plates jostling and sparking at the joints. His green eyes flicker and the arm cannon dips from the impact force.
  Header "Damage 2" (4,2): Reeling backward, a panel of blue armor cracks and small electrical sparks spray from exposed wiring. The red helmet gem flickers and the cannon barrel dims.
  Header "Damage 3" (4,3): Recovery — MX-Zero plants his feet and recalibrates, armor panels clicking back into place. The sparking subsides and his green eyes refocus with renewed determination.
  Header "KO 1" (4,4): Systems failing — his green eyes dim and flicker as his knees buckle. The arm cannon powers down, barrel going dark, and the helmet gem fades to dull red.
  Header "KO 2" (4,5): Collapsing forward, his armor panels go slack. Faint sparks crackle from joints as his body hits the ground face-first, arm cannon thudding beside him.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): MX-Zero lies collapsed on the ground, eyes completely dark and all armor lights extinguished. Small occasional sparks crackle from his joints. The arm cannon barrel is cold and grey.
  Header "Victory 1" (5,1): MX-Zero pumps his left fist into the air while the arm cannon is raised triumphantly. His green eyes shine brightly and the boot jets fire small celebratory orange sparks.
  Header "Victory 2" (5,2): He strikes a heroic pose with the arm cannon aimed skyward, cyan barrel blazing. The helmet gem pulses a victorious red and all armor lights cycle through a bright pattern.
  Header "Victory 3" (5,3): MX-Zero gives a thumbs-up with his left hand, the arm cannon resting on his hip. His green eyes form a friendly expression and the boot jets puff a tiny orange burst.
  Header "Weak Pose" (5,4): MX-Zero stands unsteadily, one knee slightly buckled. His systems are failing — static flickers in his green eyes, the arm cannon is powered down, and the helmet gem sputters.
  Header "Critical Pose" (5,5): Barely operational, MX-Zero leans forward with the arm cannon flickering between charged and dead. Exposed wiring sparks, armor panels hang loose, and his green eyes strobe with static.`,
      groupGuidance: {
        "Walk South Animation Frames": "MX-Zero steps South with precise mechanical strides, his right arm-cannon held at the ready with its cyan barrel glowing faintly and his left hand swinging in a natural cadence. The red gem on his blue helmet pulses softly and the jet-booster vents at his heels show faint orange heat.",
        "Walk North Animation Frames": "MX-Zero steps North with precise mechanical strides, his right arm-cannon held at the ready with its cyan barrel glowing faintly and his left hand swinging in a natural cadence. The red gem on his blue helmet pulses softly and the jet-booster vents at his heels show faint orange heat.",
        "Walk West Animation Frames": "MX-Zero steps West with precise mechanical strides, his right arm-cannon held at the ready with its cyan barrel glowing faintly and his left hand swinging in a natural cadence. The red gem on his blue helmet pulses softly and the jet-booster vents at his heels show faint orange heat.",
        "Walk East Animation Frames": "MX-Zero steps East with precise mechanical strides, his right arm-cannon held at the ready with its cyan barrel glowing faintly and his left hand swinging in a natural cadence. The red gem on his blue helmet pulses softly and the jet-booster vents at his heels show faint orange heat."
      },
    },
    {
      id: 'hayate-ninja',
      name: "Hayate the Wind Ninja",
      genre: "Action Platformer",
      description: "A swift ninja with a dark blue head wrap leaving only sharp grey eyes visible, lean and agile build, always appearing mid-motion even when standing still.",
      equipment: "Dark blue-black fitted shinobi armor with silver arm guards and shin guards, a long trailing silver-white scarf, a ninjato sword strapped to his back, and shuriken holstered at his waist.",
      colorNotes: "Dark blue-black armor and head wrap. Grey eyes. Silver-white scarf and metallic silver guards. Ninjato handle is wrapped in dark blue cord. Shuriken are polished steel.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Hayate stands with arms crossed facing the viewer, the silver-white scarf drifting in an unseen wind. Despite standing still, his crouch suggests coiled potential. Grey eyes are calm but alert.
  Header "Idle Up" (2,1): Facing away with arms crossed, the ninjato and scarf visible on his back. The dark blue head wrap tails drift gently and his posture is poised and watchful.
  Header "Idle Left" (2,2): Facing left with arms crossed, his lean profile showing the silver arm guards and the scarf drifting behind. One foot is slightly forward, ready to move instantly.
  Header "Idle Right" (2,3): Facing right, arms crossed, scarf floating lazily. The shuriken at his waist and the ninjato hilt over his shoulder create a distinctive silhouette.
  Header "Battle Idle 1" (2,4): Hayate draws the ninjato in a low combat stance, the straight blade gleaming. The silver-white scarf whips aggressively and his grey eyes narrow above the head wrap.
  Header "Battle Idle 2" (2,5): He shifts into a deeper crouch, ninjato held reversed along his forearm. The scarf coils in the wind and the silver arm guards are positioned defensively.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Hayate holds his low ninjato stance, the blade angled forward. His scarf whips in a controlled spiral and the polished shuriken at his waist are within easy reach.
  Header "Attack 1" (3,1): Wind-up — Hayate pulls the ninjato back in a reverse grip, body coiling like a spring. Small wind streaks form around the blade and his scarf goes taut.
  Header "Attack 2" (3,2): Rapid slash — the ninjato cuts forward in a blur, a small streak of wind following the blade path. His body spins and the scarf trails in a wide arc.
  Header "Attack 3" (3,3): Follow-through — a second slash completes a combo, wind streaks crossing in an X. The ninjato is fully extended and the scarf snaps from the speed of the rotation.
  Header "Cast 1" (3,4): Hayate sheathes the ninjato and performs rapid hand signs, fingers blurring. A small wind vortex begins forming around his feet, the scarf spiraling upward.
  Header "Cast 2" (3,5): The wind vortex intensifies as shuriken lift from his holster and orbit him in the spinning air. His scarf stands straight up and his grey eyes glow with focused energy.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Wind blade barrage — multiple small crescent-shaped wind blades launch outward from the vortex as the orbiting shuriken shoot forward. The scarf snaps violently in the discharge.
  Header "Damage 1" (4,1): Hayate is knocked backward from a hit, the scarf tangling around his arm. His ninjato wavers and the silver arm guards show a dent from the impact.
  Header "Damage 2" (4,2): Staggering, his head wrap is partially torn revealing black hair beneath. The scarf wraps chaotically around his body and a shuriken drops from his belt.
  Header "Damage 3" (4,3): Recovery — Hayate catches himself in a low three-point crouch, untangling the scarf with one hand. His grey eyes refocus and he draws the ninjato again.
  Header "KO 1" (4,4): The ninjato clatters from his hand as his legs give way. His silver-white scarf droops and the head wrap loosens, revealing more of his face beneath.
  Header "KO 2" (4,5): Falling face-down, the scarf pools around his crumpled body. The shuriken scatter from his belt and the ninjato slides away from his outstretched hand.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Hayate lies face-down on the ground, the silver-white scarf draped over his body like a shroud. The ninjato rests beside him and scattered shuriken surround his still form.
  Header "Victory 1" (5,1): Hayate appears from a puff of ninja smoke, flipping a polished shuriken between his fingers. His grey eyes crinkle with satisfaction above the head wrap and the scarf billows triumphantly.
  Header "Victory 2" (5,2): He catches the shuriken and sheathes the ninjato in one fluid motion, striking a confident cross-armed pose. The scarf settles dramatically behind him.
  Header "Victory 3" (5,3): Hayate stands with the ninjato resting on his shoulder, head tilted with casual confidence. A single shuriken spins on his fingertip and the silver-white scarf drifts in the breeze.
  Header "Weak Pose" (5,4): Hayate leans heavily on the ninjato planted in the ground, panting. His scarf is tattered and dragging, the silver arm guards are dented, and his grey eyes are weary but defiant.
  Header "Critical Pose" (5,5): Barely standing, Hayate grips the ninjato with both trembling hands. His head wrap is half-unwound, the scarf is shredded, and his breathing is visible and labored.`,
      groupGuidance: {
        "Walk South Animation Frames": "Hayate dashes South in a swift ninja stride that barely touches the ground, his left hand gripping the ninjato sheath across his back and his right hand open at his side near the shuriken holster at his waist. The long silver-white scarf trails dynamically behind him and the silver arm and shin guards catch brief flashes of light.",
        "Walk North Animation Frames": "Hayate dashes North in a swift ninja stride that barely touches the ground, his left hand gripping the ninjato sheath across his back and his right hand open at his side near the shuriken holster at his waist. The long silver-white scarf trails dynamically behind him and the silver arm and shin guards catch brief flashes of light.",
        "Walk West Animation Frames": "Hayate dashes West in a swift ninja stride that barely touches the ground, his left hand gripping the ninjato sheath across his back and his right hand open at his side near the shuriken holster at his waist. The long silver-white scarf trails dynamically behind him and the silver arm and shin guards catch brief flashes of light.",
        "Walk East Animation Frames": "Hayate dashes East in a swift ninja stride that barely touches the ground, his left hand gripping the ninjato sheath across his back and his right hand open at his side near the shuriken holster at his waist. The long silver-white scarf trails dynamically behind him and the silver arm and shin guards catch brief flashes of light."
      },
    },
    {
      id: 'sgt-nova',
      name: "Sgt. Nova",
      genre: "Sci-Fi Action",
      description: "A hardened space marine with a full visor helmet showing a green HUD glow, bulky power-armored frame, and a commanding military bearing.",
      equipment: "Heavy olive-green and gunmetal power armor with reinforced shoulder plates, a large plasma rifle held at the ready, ammo pouches on the belt, and a jet pack module on the back.",
      colorNotes: "Olive-green primary armor with gunmetal-gray secondary plates. Visor glows green. Plasma rifle has a blue energy cell. Jet pack has orange thruster ports. Belt pouches are dark brown.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Sgt. Nova stands at parade rest facing the viewer, plasma rifle shouldered with barrel up. The green visor glows steadily and his commanding posture fills the frame with power armor bulk.
  Header "Idle Up" (2,1): At ease facing away, the jet pack and reinforced back armor visible. The plasma rifle barrel extends over his right shoulder and the orange thruster ports are dormant.
  Header "Idle Left" (2,2): Facing left at parade rest, rifle shouldered. His helmet profile shows the green visor strip and the bulky shoulder plate. Ammo pouches are accessible at his belt.
  Header "Idle Right" (2,3): Facing right at ease, the power armor bulk evident. The plasma rifle rests against his shoulder and the green visor casts a faint glow on the nearby armor plates.
  Header "Battle Idle 1" (2,4): Sgt. Nova drops into a combat firing stance, plasma rifle aimed forward with the blue energy cell glowing bright. His knees are bent, visor HUD tracking, and the shoulder plates brace for recoil.
  Header "Battle Idle 2" (2,5): He shifts in his firing stance, the rifle barrel scanning. The green visor HUD flickers with targeting data and the jet pack vents pulse orange with readiness.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Sgt. Nova holds his firing stance, rifle locked on target. The visor HUD displays targeting brackets and the blue energy cell hums with full charge. His heavy boots are firmly planted.
  Header "Attack 1" (3,1): Wind-up — he braces the plasma rifle against his shoulder plate, sighting down the barrel. The blue energy cell brightens as the weapon charges and his visor locks on.
  Header "Attack 2" (3,2): Rapid fire — a burst of blue plasma erupts from the rifle barrel with a bright muzzle flash. The recoil pushes against his shoulder plate and spent energy crackles from the barrel.
  Header "Attack 3" (3,3): Follow-through — the plasma bursts streak to the edge of the cell, the rifle barrel venting blue-white heat. His boots have slid back slightly from the sustained recoil.
  Header "Cast 1" (3,4): Sgt. Nova raises his left arm, activating a wrist-mounted hologram display. A small blue tactical interface projects upward showing an orbital targeting reticle. The rifle is slung.
  Header "Cast 2" (3,5): The hologram display expands as he confirms coordinates, a small beam of light shooting skyward from his wrist device. The visor HUD displays incoming strike data.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): An orbital strike lands — a focused beam of energy impacts from above at the cell edge, creating a small explosion of light. Sgt. Nova shields his visor from the flash with one arm.
  Header "Damage 1" (4,1): Sgt. Nova staggers from a hit, armor sparking at the impact point on his shoulder plate. The plasma rifle wavers and the visor HUD flickers with static.
  Header "Damage 2" (4,2): Stumbling backward, a gunmetal armor panel cracks and sparks fly from exposed circuitry. The jet pack sputters and the green visor dims briefly.
  Header "Damage 3" (4,3): Recovery — he plants the rifle stock on the ground for balance, pushing back to a standing firing position. The visor HUD reboots with a green flash and he grits through the pain.
  Header "KO 1" (4,4): Systems critical — the armor locks up as servos fail, his knees buckling under the heavy suit. The visor HUD scrambles and the plasma rifle droops in weakening hands.
  Header "KO 2" (4,5): Sgt. Nova collapses under the weight of the dead power armor, the rifle clattering beside him. The jet pack sparks once and the visor goes dark.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Sgt. Nova lies in the powered-down armor, visor completely dark and all systems offline. The plasma rifle rests beside his outstretched arm and faint sparks crackle from the jet pack.
  Header "Victory 1" (5,1): Sgt. Nova raises the plasma rifle overhead with one arm in triumph, the blue energy cell blazing. The jet pack fires a small celebratory burst of orange flame and the visor glows bright green.
  Header "Victory 2" (5,2): He plants the rifle butt on the ground and stands at attention, giving a sharp military salute. The visor HUD displays a mission-complete readout and the armor gleams.
  Header "Victory 3" (5,3): Sgt. Nova rests the rifle on his shoulder with casual confidence, helmet tilted slightly. The green visor reflects the aftermath and the jet pack vents steam in satisfaction.
  Header "Weak Pose" (5,4): Sgt. Nova leans heavily on the plasma rifle as a crutch, visor cracked with a flickering green glow. Coolant leaks from a damaged armor joint and his jet pack is offline.
  Header "Critical Pose" (5,5): Barely standing in failing armor, Sgt. Nova holds the plasma rifle one-handed, the energy cell nearly depleted. The visor is cracked and sputtering, one shoulder plate is gone, and servos whine.`,
      groupGuidance: {
        "Walk South Animation Frames": "Sgt. Nova marches South with heavy deliberate steps, the plasma rifle held at the ready across his chest in both armored hands with the barrel angled upward. The green visor HUD glows on his helmet, the jet-pack vents show faint orange heat on his back, and the ammo pouches at his belt bounce with each stride.",
        "Walk North Animation Frames": "Sgt. Nova marches North with heavy deliberate steps, the plasma rifle held at the ready across his chest in both armored hands with the barrel angled upward. The green visor HUD glows on his helmet, the jet-pack vents show faint orange heat on his back, and the ammo pouches at his belt bounce with each stride.",
        "Walk West Animation Frames": "Sgt. Nova marches West with heavy deliberate steps, the plasma rifle held at the ready across his chest in both armored hands with the barrel angled upward. The green visor HUD glows on his helmet, the jet-pack vents show faint orange heat on his back, and the ammo pouches at his belt bounce with each stride.",
        "Walk East Animation Frames": "Sgt. Nova marches East with heavy deliberate steps, the plasma rifle held at the ready across his chest in both armored hands with the barrel angled upward. The green visor HUD glows on his helmet, the jet-pack vents show faint orange heat on his back, and the ammo pouches at his belt bounce with each stride."
      },
    },
    {
      id: 'gel-slime',
      name: "Gel Slime",
      genre: "Classic Fantasy",
      description: "A small, round, translucent blue slime creature with a jiggly gelatinous body. Two large, expressive dark eyes with white highlights sit near the top of its body. A perpetual happy expression with a tiny curved mouth.",
      equipment: "",
      colorNotes: "Translucent sky-blue body with lighter blue highlights on top and darker blue shadow at the base. Eyes are large and dark with bright white shine spots. A faint inner glow gives it a jewel-like quality.",
      rowGuidance: `
Gel Slime is a limbless gelatinous blob — no arms, no legs, no skeleton. It moves by squishing and bouncing. All poses show a round, translucent body that compresses and stretches.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Gel Slime sits in a gentle idle wobble facing the viewer, body jiggling slightly. Its large dark eyes blink contentedly with bright white highlights and the tiny curved mouth smiles. The inner glow pulses softly.
  Header "Idle Up" (2,1): Facing away in a relaxed wobble, the rounded back of the translucent body shows the inner glow. The darker blue base shadow is visible and the body sways gently.
  Header "Idle Left" (2,2): Facing left with a gentle jiggle, one eye visible in profile. The translucent sky-blue body catches light on its curved surface and it sways rhythmically.
  Header "Idle Right" (2,3): Facing right with a contented wobble, the tiny mouth and one large eye visible. The jewel-like inner glow shifts with each gentle sway.
  Header "Battle Idle 1" (2,4): Gel Slime puffs up slightly larger, its body vibrating with determination. The eyes narrow with a focused expression and the inner glow intensifies. Its happy mouth becomes a determined line.
  Header "Battle Idle 2" (2,5): The puffed-up slime vibrates faster, body rippling with contained energy. The translucent form becomes slightly more opaque as it concentrates and the base shadow darkens.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Gel Slime holds its puffed battle stance, body taut and vibrating. The inner glow pulses rapidly and the dark eyes are locked forward with unusual intensity for such a cute creature.
  Header "Attack 1" (3,1): Wind-up — Gel Slime compresses its body down flat, coiling like a spring. The inner glow concentrates at the base and its eyes squint with effort as it prepares to launch.
  Header "Attack 2" (3,2): Tackle launch — the slime springs forward, body elongated into a missile shape aimed at the target. The inner glow streaks behind like a comet trail and its eyes are determined.
  Header "Attack 3" (3,3): Impact — Gel Slime splats against the target area, body flattening and rippling outward on contact. It quickly reforms into a wobbly sphere, eyes spinning briefly from the collision.
  Header "Cast 1" (3,4): Gel Slime glows brightly from within, the translucent body becoming luminous. Small water droplets begin condensing in the air around it and its eyes close in concentration.
  Header "Cast 2" (3,5): The water droplets multiply and orbit the glowing slime. Its body pulses with blue light and the surrounding air shimmers with moisture. The inner glow is intense and beautiful.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Water splash burst — the orbiting droplets explode outward in a small ring of water, and Gel Slime itself releases a pulse of blue energy. Its body dims afterward, slightly deflated from the effort.
  Header "Damage 1" (4,1): Gel Slime flattens from an impact, body rippling violently like disturbed jelly. Its eyes widen in shock and spin momentarily while the inner glow flickers. The happy expression turns to surprise.
  Header "Damage 2" (4,2): The slime wobbles erratically, body distorted and off-balance. Its dark eyes are dizzy spirals and the translucent form shows the inner glow sputtering unevenly.
  Header "Damage 3" (4,3): Recovery — Gel Slime reshapes itself with a determined wobble, eyes refocusing. Its body is slightly less translucent than normal and the inner glow steadies to a dim pulse.
  Header "KO 1" (4,4): Gel Slime begins melting — its round shape sags and flattens, the body losing cohesion. The eyes droop sadly and the inner glow fades. The tiny mouth turns down.
  Header "KO 2" (4,5): Further melting into a spreading puddle, the body nearly flat. The eyes are half-submerged in the puddle and the last traces of inner glow flicker at the center.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Gel Slime is a flat translucent blue puddle on the ground with two fading dark eyes barely visible at the surface. The inner glow has completely gone out and only a faint blue tint remains.
  Header "Victory 1" (5,1): Gel Slime bounces high into the air with joy, body stretching tall. Its eyes are bright crescents of happiness and small sparkles surround its glowing form. The tiny mouth is a wide grin.
  Header "Victory 2" (5,2): At the peak of its victory bounce, Gel Slime wiggles ecstatically. The inner glow is the brightest it has ever been and happy sparkles orbit its translucent body.
  Header "Victory 3" (5,3): Landing from the bounce, Gel Slime jiggles contentedly with a satisfied expression. Its large eyes shine with delight and the inner glow pulses warmly. A few last sparkles fade around it.
  Header "Weak Pose" (5,4): Gel Slime sags and droops, body semi-transparent and barely holding its round shape. The eyes are half-closed and tired, the inner glow is very faint, and the edges of its body waver.
  Header "Critical Pose" (5,5): Nearly dissolved, Gel Slime is a wobbly semi-flat blob barely maintaining form. Its eyes are dim and unfocused, the body is almost fully transparent, and it trembles with the effort of staying together.`,
      groupGuidance: {
        "Walk South Animation Frames": "Gel Slime squishes and bounces South with jelly-physics wobble, its translucent sky-blue body compressing on landing and stretching tall mid-bounce. The faint inner glow brightens with each rebound and the happy expression stays locked no matter how the body deforms.",
        "Walk North Animation Frames": "Gel Slime squishes and bounces North with jelly-physics wobble, its translucent sky-blue body compressing on landing and stretching tall mid-bounce. The faint inner glow brightens with each rebound and the happy expression stays locked no matter how the body deforms.",
        "Walk West Animation Frames": "Gel Slime squishes and bounces West with jelly-physics wobble, its translucent sky-blue body compressing on landing and stretching tall mid-bounce. The faint inner glow brightens with each rebound and the happy expression stays locked no matter how the body deforms.",
        "Walk East Animation Frames": "Gel Slime squishes and bounces East with jelly-physics wobble, its translucent sky-blue body compressing on landing and stretching tall mid-bounce. The faint inner glow brightens with each rebound and the happy expression stays locked no matter how the body deforms."
      },
    },
    {
      id: 'magma-wyrm',
      name: "Magma Wyrm",
      genre: "Classic Fantasy",
      description: "A small but fearsome fire-breathing dragon with molten orange-red scales, two curved horns, a ridged back, and a spiked tail. Bat-like wings folded at its sides. Fierce yellow eyes with slit pupils and an open mouth revealing glowing fangs.",
      equipment: "",
      colorNotes: "Molten orange-red scales with darker crimson underbelly. Bright yellow-orange cracks between scales suggesting inner magma. Horns and claws are dark charcoal. Wing membranes are deep red. Eyes are fierce yellow. Mouth interior glows orange.",
      rowGuidance: `
Magma Wyrm is a small four-legged dragon with bat-like wings and a spiked tail. It has no arms or hands — its four legs end in charcoal claws used for walking and gripping. Two curved horns crown its head.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Magma Wyrm sits on its haunches facing the viewer, wings twitching at its sides. Thin smoke curls from its nostrils and the fierce yellow eyes watch lazily. The magma cracks pulse with slow heat.
  Header "Idle Up" (2,1): Sitting facing away, the ridged back and folded wings are prominent. The spiked tail curls around one side and the dark charcoal horns curve upward from its skull.
  Header "Idle Left" (2,2): Facing left at rest, smoke wisping from its snout. Its wings fold against the near flank and the spiked tail lies along the ground. The yellow eye watches with slit-pupil focus.
  Header "Idle Right" (2,3): Facing right at rest, the crimson underbelly visible as it sits. The curved horns and ridged back create a fierce profile and faint heat shimmer rises from its scales.
  Header "Battle Idle 1" (2,4): Magma Wyrm spreads its bat-like wings wide, revealing the deep red membranes. Its mouth opens to show glowing orange fangs and it drops into an aggressive crouch. Small flames lick from its jaws.
  Header "Battle Idle 2" (2,5): Wings still spread, the wyrm sways with predatory menace. The magma cracks between scales blaze brighter and its spiked tail lashes side to side. The fierce yellow eyes lock on prey.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Magma Wyrm holds its aggressive stance, wings half-spread and mouth aglow. Heat shimmer rises from its entire body and the ground beneath its claws shows faint scorch marks.
  Header "Attack 1" (3,1): Wind-up — the wyrm rears its head back, mouth opening wide. Fire builds in its throat, visible as a growing orange glow behind its glowing fangs. The body coils for a lunge.
  Header "Attack 2" (3,2): Lunging bite — Magma Wyrm snaps forward with jaws wide, fire streaming from the corners of its mouth. Its fore-claws extend and the spiked tail counterbalances the strike.
  Header "Attack 3" (3,3): Follow-through — a small burst of fire breath erupts from its mouth, bathing the area ahead in orange flame. Its wings flare from the effort and the charcoal horns gleam with reflected fire.
  Header "Cast 1" (3,4): Magma Wyrm rears up on its hind legs, wings spread wide. Its scales crack open wider revealing the bright magma beneath, and its entire body begins to glow from within.
  Header "Cast 2" (3,5): Standing on hind legs, the wyrm roars skyward as magma seeps from every scale crack. The deep red wing membranes are backlit by the internal fire and its eyes blaze white-hot.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Volcanic eruption — magma bursts from the cracks across its body in a small explosive release. Fire geysers erupt around the wyrm as it roars, wings fully spread and tail lashing.
  Header "Damage 1" (4,1): Magma Wyrm recoils from a hit, several scales cracking and falling away to reveal cooling grey stone beneath. Its wings flinch inward and a pained snarl shows dimming fangs.
  Header "Damage 2" (4,2): Staggering on its claws, more scales crack and the magma beneath begins cooling. The fierce yellow eyes dim and the fire in its mouth sputters. The spiked tail droops.
  Header "Damage 3" (4,3): Recovery — the wyrm shakes itself, reigniting some of the cooling cracks with renewed orange glow. It snarls defiantly and plants its claws, though patches of grey cooled stone remain.
  Header "KO 1" (4,4): The wyrm's wings crumple and fold as the fire inside dies. Its scales cool rapidly to dark grey, the magma cracks solidifying. It drops to its belly with dimming yellow eyes.
  Header "KO 2" (4,5): Collapsing onto its side, the wings splay lifelessly. The once-glowing fangs are dark and the spiked tail lies still. Grey cooled stone spreads across its body.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Magma Wyrm lies curled up, its scales fully cooled to dark grey stone. No glow remains in the cracks, the eyes are closed, and it resembles a small stone statue of a dragon.
  Header "Victory 1" (5,1): Magma Wyrm rears up and roars triumphantly, a plume of fire shooting from its mouth. Its wings spread fully showing the deep red membranes and every scale crack blazes brilliant orange.
  Header "Victory 2" (5,2): Wings spread wide, the wyrm stamps its fore-claws proudly. Sparks fly from beneath its charcoal claws and its fierce yellow eyes burn with wild satisfaction.
  Header "Victory 3" (5,3): Magma Wyrm settles into a proud sitting pose, wings folded neatly and spiked tail curled around its body. Small flames flicker contentedly from its nostrils and the magma cracks pulse warmly.
  Header "Weak Pose" (5,4): The wyrm hunches low, wings drooping and barely folded. Most magma cracks have cooled to dim orange, the eyes are half-lidded, and only faint smoke rises from its closed mouth.
  Header "Critical Pose" (5,5): Barely standing on trembling claws, the wyrm is mostly cooled grey stone with only a few faint orange cracks remaining. Its eyes are barely yellow slits and the wings drag on the ground.`,
      groupGuidance: {
        "Walk South Animation Frames": "Magma Wyrm lumbers South on all four clawed legs, its spiked tail swishing from side to side and lava dripping from its open mouth. The molten orange-red scales pulse with inner heat and the bat-like wings fold tightly against its flanks.",
        "Walk North Animation Frames": "Magma Wyrm lumbers North on all four clawed legs, its spiked tail swishing from side to side and lava dripping from its open mouth. The molten orange-red scales pulse with inner heat and the bat-like wings fold tightly against its flanks.",
        "Walk West Animation Frames": "Magma Wyrm lumbers West on all four clawed legs, its spiked tail swishing from side to side and lava dripping from its open mouth. The molten orange-red scales pulse with inner heat and the bat-like wings fold tightly against its flanks.",
        "Walk East Animation Frames": "Magma Wyrm lumbers East on all four clawed legs, its spiked tail swishing from side to side and lava dripping from its open mouth. The molten orange-red scales pulse with inner heat and the bat-like wings fold tightly against its flanks."
      },
    },
    {
      id: 'mosskin-spirit',
      name: "Mosskin Spirit",
      genre: "Classic Fantasy",
      description: "A gentle forest spirit NPC whose body is formed from intertwined bark, leaves, and moss. A rounded head with two large glowing green eyes and a small peaceful smile. Short stubby limbs with leaf-like hands. Small flowers and mushrooms sprout from its shoulders.",
      equipment: "",
      colorNotes: "Body is mottled brown bark with patches of vibrant green moss. Leaves are various greens from bright lime to deep forest green. Eyes glow soft emerald. Flowers are tiny white and pale yellow. Mushrooms are red with white spots. A faint green aura surrounds it.",
      rowGuidance: `
Mosskin Spirit has short stubby legs and stubby arms ending in leaf-like hands — not standard human proportions. Its rounded bark body is squat and wide, and it waddles rather than walks. Small flowers and red-spotted mushrooms sprout from its shoulders.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Mosskin Spirit sways gently like a tree in a breeze, facing the viewer. The shoulder mushrooms pulse with faint bioluminescence and the large emerald eyes blink slowly and contentedly.
  Header "Idle Up" (2,1): Swaying facing away, the bark back with moss patches is on display. Tiny white flowers bloom and close in a slow rhythm and the green aura pulses peacefully.
  Header "Idle Left" (2,2): Facing left in a gentle sway, one leaf-like hand raised slightly as if sensing the wind. The emerald eye glows warmly and the red-spotted mushroom tilts toward the light.
  Header "Idle Right" (2,3): Facing right, swaying gently. The rounded bark head tilts with curiosity and the shoulder flowers and mushrooms sway in their own gentle rhythm. Spores drift lazily.
  Header "Battle Idle 1" (2,4): Mosskin Spirit plants its stubby feet as small roots spread outward from beneath them, anchoring it to the ground. Its emerald eyes brighten intensely and the bark body hardens visibly.
  Header "Battle Idle 2" (2,5): Roots deepen as the spirit braces itself, the bark plates tightening. The green aura intensifies and the mushrooms and flowers glow brighter, channeling forest energy.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Rooted firmly, the Mosskin Spirit stands with hardened bark armor and blazing emerald eyes. The green aura crackles with nature energy and the mushrooms pulse with defensive light.
  Header "Attack 1" (3,1): Wind-up — a vine extends rapidly from the spirit's leaf-like hand, coiling back like a whip. Thorns sprout along the vine and the bark body leans into the strike.
  Header "Attack 2" (3,2): Vine lash — the thorned vine whips forward in a sharp crack, extending to the edge of the cell. Leaves scatter from the motion and the emerald eyes flash with uncharacteristic ferocity.
  Header "Attack 3" (3,3): Follow-through — the vine retracts as small thorns scatter at the impact point. The Mosskin Spirit rebalances on its stubby legs and the bark plates settle back into place.
  Header "Cast 1" (3,4): The spirit closes its emerald eyes and raises both leaf-like hands, communing with the forest. A circle of glowing green leaves begins spinning around it and the green aura expands.
  Header "Cast 2" (3,5): The leaf circle intensifies into a spinning ring of forest magic. Tiny flowers bloom and wilt rapidly within the spell circle and the mushrooms on its shoulders glow brilliant red.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Massive root eruption — thick roots burst from the ground around the spirit in a small ring, twisting upward with green energy. The Mosskin Spirit directs them with outstretched leaf-hands.
  Header "Damage 1" (4,1): The Mosskin Spirit stumbles from a hit, bark cracking along one side. Several leaves fall from its body and the shoulder flowers wilt from the shock. Its emerald eyes wince.
  Header "Damage 2" (4,2): Staggering back, more bark cracks and moss patches dry and brown at the edges. A mushroom breaks off from one shoulder and the green aura flickers weakly.
  Header "Damage 3" (4,3): Recovery — the spirit steadies itself, new moss slowly creeping over the cracked bark. Its emerald eyes reopen with determination and tiny buds push through the damaged areas.
  Header "KO 1" (4,4): The roots anchoring the spirit retract into the ground as its stubby legs weaken. The bark body starts splitting and leaves fall rapidly. The emerald eye glow fades to dim.
  Header "KO 2" (4,5): The Mosskin Spirit topples forward, its bark body separating at the cracks. Flowers and mushrooms fall off and the green aura gutters out. It crumbles slowly.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): A small pile of bark fragments, dried leaves, and fallen mushrooms lies on the ground — all that remains of the spirit. The emerald eye glow has vanished and only a faint green wisp lingers above.
  Header "Victory 1" (5,1): Mosskin Spirit blooms with joy — dozens of tiny white and yellow flowers burst open across its body. Its emerald eyes are bright crescents of happiness and it does a little stomping dance.
  Header "Victory 2" (5,2): The spirit waves its leaf-like hands as a shower of green spores and flower petals erupts around it. New mushrooms sprout on its shoulders and the green aura blazes with life.
  Header "Victory 3" (5,3): Mosskin Spirit settles into a content pose, flowers in full bloom and mushrooms glowing softly. Its peaceful smile widens and it hugs itself with its stubby leaf-hands.
  Header "Weak Pose" (5,4): The spirit droops visibly, leaves wilting and turning brown at the edges. The mushrooms are shriveled and the flowers have closed. Its emerald eyes are dim and it sways unsteadily.
  Header "Critical Pose" (5,5): Barely standing, the bark body is cracked throughout and most leaves have browned and fallen. The emerald eyes are faint flickers, the aura is nearly invisible, and it trembles like a dying plant.`,
      groupGuidance: {
        "Walk South Animation Frames": "Mosskin Spirit waddles South on stubby legs with a gentle side-to-side tilt, the small flowers and red-spotted mushrooms on its shoulders bobbing with each step. Tiny green spores drift from its mossy patches and a faint green aura outlines its bark-woven body.",
        "Walk North Animation Frames": "Mosskin Spirit waddles North on stubby legs with a gentle side-to-side tilt, the small flowers and red-spotted mushrooms on its shoulders bobbing with each step. Tiny green spores drift from its mossy patches and a faint green aura outlines its bark-woven body.",
        "Walk West Animation Frames": "Mosskin Spirit waddles West on stubby legs with a gentle side-to-side tilt, the small flowers and red-spotted mushrooms on its shoulders bobbing with each step. Tiny green spores drift from its mossy patches and a faint green aura outlines its bark-woven body.",
        "Walk East Animation Frames": "Mosskin Spirit waddles East on stubby legs with a gentle side-to-side tilt, the small flowers and red-spotted mushrooms on its shoulders bobbing with each step. Tiny green spores drift from its mossy patches and a faint green aura outlines its bark-woven body."
      },
    },
    {
      id: 'voidmaw-parasite',
      name: "Voidmaw Parasite",
      genre: "Sci-Fi Horror",
      description: "A writhing alien parasite with a segmented, chitinous body that ends in a lamprey-like circular mouth lined with concentric rings of needle-thin teeth. Four hooked appendages on each side used for latching onto hosts. A pulsing translucent sac on its back reveals dark fluid inside. Two vestigial eye-stalks protrude from the head segment.",
      equipment: "",
      colorNotes: "Oily black chitin with iridescent purple-green sheen. Mouth interior is raw pinkish-red. Back sac is translucent milky grey with dark violet fluid. Eye-stalks tip with dull yellow bioluminescent orbs. Hooked legs are dark gunmetal with rust-red tips.",
      rowGuidance: `
Voidmaw Parasite has no legs or arms. It is a segmented worm-like creature with four hooked appendages on each side (eight total), two vestigial eye-stalks on the head segment, and a lamprey-like circular mouth. It moves by slithering and pulling itself along with its hooks. A pulsing translucent sac rides its back.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Voidmaw Parasite is coiled in a loose spiral facing the viewer, eye-stalks scanning slowly. The back sac pulses with a slow heartbeat rhythm and the hooks are tucked beneath its body. The lamprey mouth is closed to a slit.
  Header "Idle Up" (2,1): Coiled facing away, the translucent sac and segmented back dominate the view. The dull yellow eye-stalks peek over the head segment and the hooks rest along its sides.
  Header "Idle Left" (2,2): Coiled facing left, one eye-stalk visible scanning ahead. The oily chitin reflects light in iridescent bands and the sac pulses gently. The rust-red hook tips peek from beneath.
  Header "Idle Right" (2,3): Coiled facing right, the lamprey mouth visible as a thin slit in the head segment. The back sac shows the dark violet fluid shifting slowly and the eye-stalks drift lazily.
  Header "Battle Idle 1" (2,4): Voidmaw rears its front segments upward, lamprey mouth opening wide to reveal concentric rings of needle teeth. The hooks spread wide from its sides and the back sac swells aggressively. Eye-stalks lock forward.
  Header "Battle Idle 2" (2,5): Swaying in its reared stance, the parasite hisses with the mouth fully open. The pinkish-red mouth interior glistens and the hooks flex menacingly. The sac pulses rapidly with dark violet fluid.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Voidmaw holds its reared threat posture, hooks spread wide and mouth gaping. The eye-stalks lock on the target with intensified yellow glow and the chitin sheen ripples with agitation.
  Header "Attack 1" (3,1): Wind-up — the parasite coils its body tight like a spring, mouth opening wider. The hooks extend forward in a grasping formation and the back sac compresses, building internal pressure.
  Header "Attack 2" (3,2): Lunge — Voidmaw launches forward, hooks clamping outward to grab. The lamprey mouth leads the strike, needle teeth splayed in concentric rings. The body stretches taut behind it.
  Header "Attack 3" (3,3): Latch and drill — the hooks clamp onto the target area and the mouth presses forward, teeth rotating. The sac pulses rapidly and the entire body writhes with feeding frenzy energy.
  Header "Cast 1" (3,4): The back sac begins swelling dramatically, the translucent membrane stretching to reveal the dark violet fluid churning inside. The eye-stalks retract and the chitin plates seal tightly.
  Header "Cast 2" (3,5): The sac reaches maximum distension, glowing faintly violet through the milky grey membrane. A toxic haze begins seeping from pores along the segments and the hooks brace the body.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The sac ruptures in a controlled burst, spraying a cloud of dark violet acid from the pores along its body. The toxic cloud spreads within the cell and the parasite shudders from the exertion.
  Header "Damage 1" (4,1): Voidmaw recoils from a hit, chitin cracking along one segment. Dark violet fluid leaks from the crack and the eye-stalks flinch back. The hooks clench reflexively inward.
  Header "Damage 2" (4,2): Writhing in pain, more chitin plates crack and the oily sheen dulls on the damaged segments. The back sac deflates slightly and the lamprey mouth emits a silent shriek.
  Header "Damage 3" (4,3): Recovery — the parasite coils tightly around its damaged segments, the hooks guarding its body. The eye-stalks re-emerge cautiously and the chitin slowly seals over the worst cracks.
  Header "KO 1" (4,4): Voidmaw curls inward as its segments seize, hooks twitching spasmodically. The back sac deflates and the dull yellow eye-stalk lights fade. The lamprey mouth gapes open and limp.
  Header "KO 2" (4,5): The parasite collapses into a loose coil, hooks limp and splayed. The chitin loses its iridescent sheen turning matte black and the sac is flat and empty.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): A shriveled husk of matte black chitin lies in a loose coil. The sac is completely flat, the hooks are rigid and curled, and the eye-stalks are dark. No movement remains.
  Header "Victory 1" (5,1): Voidmaw rears triumphantly, the lamprey mouth open in a victorious display of needle teeth. The back sac glows with renewed violet fluid and all hooks spread wide in dominance.
  Header "Victory 2" (5,2): The parasite sways in its reared pose, the eye-stalks pulsing bright yellow. The iridescent chitin sheen ripples in bands of purple and green and the sac pulses with a fast, healthy rhythm.
  Header "Victory 3" (5,3): Voidmaw settles into a coiled throne pose, hooks tucked neatly, sac glowing contentedly. The eye-stalks blink slowly with satisfaction and the lamprey mouth closes to a smug slit.
  Header "Weak Pose" (5,4): The parasite sags loosely, hooks limp and barely gripping. The back sac is deflated and the eye-stalks droop. The chitin is dull and the segments barely undulate with weakened movement.
  Header "Critical Pose" (5,5): Nearly motionless, Voidmaw lies in a loose uncoiled line. The hooks twitch feebly, the sac is flat, and only one eye-stalk manages a faint yellow flicker. The chitin is cracked and lightless.`,
      groupGuidance: {
        "Walk South Animation Frames": "Voidmaw Parasite slithers South with its hooked appendages pulling along the segmented chitinous body, the iridescent purple-green sheen rippling across its oily black plates. The translucent back sac pulses with dark violet fluid and the dull yellow eye-stalks wave in the direction of travel.",
        "Walk North Animation Frames": "Voidmaw Parasite slithers North with its hooked appendages pulling along the segmented chitinous body, the iridescent purple-green sheen rippling across its oily black plates. The translucent back sac pulses with dark violet fluid and the dull yellow eye-stalks wave in the direction of travel.",
        "Walk West Animation Frames": "Voidmaw Parasite slithers West with its hooked appendages pulling along the segmented chitinous body, the iridescent purple-green sheen rippling across its oily black plates. The translucent back sac pulses with dark violet fluid and the dull yellow eye-stalks wave in the direction of travel.",
        "Walk East Animation Frames": "Voidmaw Parasite slithers East with its hooked appendages pulling along the segmented chitinous body, the iridescent purple-green sheen rippling across its oily black plates. The translucent back sac pulses with dark violet fluid and the dull yellow eye-stalks wave in the direction of travel."
      },
    },
    {
      id: 'fluxbot-drone',
      name: "Fluxbot Drone",
      genre: "Sci-Fi",
      description: "A small hovering maintenance drone with a spherical chrome body, a single large blue optical lens, and three articulated tool-arms folding neatly underneath. Two anti-gravity fins rotate slowly on either side. A ring of status LEDs encircles its equator. Friendly and curious demeanor despite being fully mechanical.",
      equipment: "",
      colorNotes: "Polished chrome body with brushed steel panels. Main lens is bright cyan-blue with a white focal point. Anti-grav fins are matte dark grey with cyan edge lighting. LED ring cycles through soft blue and green. Tool-arms are gunmetal with orange safety markings at the joints.",
      rowGuidance: `
Fluxbot Drone has no legs — it hovers via two anti-gravity fins on either side. It has three articulated tool-arms (not two human arms) folding underneath its spherical chrome body, and a single large optical lens as its face. It is fully mechanical.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Fluxbot Drone hovers at rest facing the viewer, bobbing gently up and down. The large cyan-blue lens tilts curiously and the LED ring cycles through calm blue-green patterns. The chrome body gleams.
  Header "Idle Up" (2,1): Hovering at rest facing away, the anti-grav fins idle slowly. The brushed steel panels catch light and the LED ring pulses softly. The tool-arms hang relaxed underneath.
  Header "Idle Left" (2,2): Facing left in an idle hover, the lens focuses on something with a curious tilt. The chrome sphere reflects its surroundings and the fins rotate lazily.
  Header "Idle Right" (2,3): Facing right, hovering with gentle bobs. The lens white focal point adjusts and the LED ring shows a friendly green pattern. The drone radiates curious, friendly energy.
  Header "Battle Idle 1" (2,4): Fluxbot snaps to alert — the optical lens turns from cyan-blue to bright red, tool-arms deploy from underneath in a defensive array. The LED ring flashes rapid orange warnings and the fins spin faster.
  Header "Battle Idle 2" (2,5): Hovering with agitation, the red lens scans for threats. The tool-arms are splayed defensively — one ends in a small arc welder, another in a gripper claw. The chrome body vibrates with energy.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Fluxbot holds its combat hover, red lens locked forward and tool-arms at the ready. The LED ring strobes orange and the anti-grav fins are at maximum spin with bright cyan edges.
  Header "Attack 1" (3,1): Wind-up — one tool-arm extends forward, the arc welder tip charging with a bright orange-white glow. The chrome body braces and the other arms stabilize the drone against recoil.
  Header "Attack 2" (3,2): The arc welder fires a concentrated beam of orange-white energy in a short, precise blast. The chrome body rocks backward from the discharge and the red lens narrows.
  Header "Attack 3" (3,3): Follow-through — the second tool-arm swings forward with the gripper claw in a physical strike. The arc welder vents heat and the LED ring flashes with the exertion.
  Header "Cast 1" (3,4): Fluxbot projects a wide scanning beam from its lens, now blue again. The beam sweeps in a cone, and the tool-arms begin assembling small glowing particles — repair nanobots — from an internal dispenser.
  Header "Cast 2" (3,5): A cloud of tiny glowing cyan nanobots swarms around the drone, orbiting the chrome body. The LED ring cycles rapidly through blue and green as it coordinates the nanobots.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): EMP burst — the LED ring blazes blindingly bright, then discharges a ring of crackling blue-white energy outward from the equator. The chrome body dims momentarily from the power drain.
  Header "Damage 1" (4,1): Fluxbot jolts from a hit, sparking at the impact point on its chrome body. The drone spins off-axis briefly and the lens flickers. One anti-grav fin stutters in its rotation.
  Header "Damage 2" (4,2): Spinning erratically, a panel of brushed steel cracks on the chrome body. The lens develops a visible fracture line and the LED ring shows static patterns. Sparks crackle from a tool-arm joint.
  Header "Damage 3" (4,3): Recovery — Fluxbot stabilizes its spin, re-leveling with visible effort. The cracked lens refocuses and the LED ring reboots to a steady pattern. One fin is slower than the other.
  Header "KO 1" (4,4): Power failing — the anti-grav fins slow and stutter, causing the drone to sink. The lens dims from cyan to grey and the LED ring goes dark one segment at a time. Tool-arms droop.
  Header "KO 2" (4,5): Fluxbot drops to the ground with a metallic thud, the chrome body rolling to a stop. The fins stop spinning and the lens is dark. A last spark crackles from the LED ring.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Fluxbot Drone lies on the ground, chrome body scratched and dull. The lens is dark and cracked, the fins are motionless, and the LED ring is dead. Occasional sparks crackle from exposed joints.
  Header "Victory 1" (5,1): Fluxbot spins happily in place, the chrome body gleaming as the LED ring cycles through a rainbow of celebratory colors. The lens glows bright cyan with a heart-shaped focal point.
  Header "Victory 2" (5,2): The drone does a little aerial loop, tool-arms extended in a whee pose. The anti-grav fins spin at full speed with brilliant cyan trails and the lens beams happily.
  Header "Victory 3" (5,3): Fluxbot hovers proudly, giving a thumbs-up with one tool-arm gripper. The LED ring displays a scrolling smiley pattern and the chrome body is polished to a perfect shine.
  Header "Weak Pose" (5,4): Fluxbot hovers low and unsteadily, the anti-grav fins sputtering. The lens flickers between dim cyan and dark, the LED ring is mostly unlit, and one tool-arm hangs limp.
  Header "Critical Pose" (5,5): Barely hovering inches off the ground, the chrome body is dented and sparking. The lens strobes weakly, both fins stutter, and the LED ring shows only a single blinking red segment.`,
      groupGuidance: {
        "Walk South Animation Frames": "Fluxbot Drone hovers South with a slight directional tilt, the spherical chrome body reflecting its surroundings and the two anti-gravity fins spinning with cyan edge lighting. The LED ring around its equator cycles through soft blue and green.",
        "Walk North Animation Frames": "Fluxbot Drone hovers North with a slight directional tilt, the spherical chrome body reflecting its surroundings and the two anti-gravity fins spinning with cyan edge lighting. The LED ring around its equator cycles through soft blue and green.",
        "Walk West Animation Frames": "Fluxbot Drone hovers West with a slight directional tilt, the spherical chrome body reflecting its surroundings and the two anti-gravity fins spinning with cyan edge lighting. The LED ring around its equator cycles through soft blue and green.",
        "Walk East Animation Frames": "Fluxbot Drone hovers East with a slight directional tilt, the spherical chrome body reflecting its surroundings and the two anti-gravity fins spinning with cyan edge lighting. The LED ring around its equator cycles through soft blue and green."
      },
    },
    {
      id: 'spore-lurker',
      name: "Spore Lurker",
      genre: "Sci-Fi Horror",
      description: "A fungal alien organism that resembles a crouching mass of fleshy tendrils topped with a cluster of bulbous spore pods. No visible eyes — instead it senses via vibration through fine cilia covering its surface. When threatened, the pods swell and release clouds of toxic green spores. Moves with an unsettling undulating crawl.",
      equipment: "",
      colorNotes: "Fleshy pale mauve and grey tendrils with sickly yellow-green veining. Spore pods are swollen dark purple with bright toxic-green tips that glow faintly. Cilia are near-white and shimmer slightly. Underside is wet-looking dark reddish-brown.",
      rowGuidance: `
Spore Lurker has no limbs, no eyes, and no discernible head. It is a crouching mass of fleshy tendrils topped with a cluster of bulbous spore pods. It senses via fine cilia covering its surface and moves with an undulating crawl, tendrils pulling it along.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Spore Lurker sits in a compact mass facing the viewer, pulsing slowly. The spore pods are dormant with faintly glowing green tips and the cilia wave gently, sensing vibrations.
  Header "Idle Up" (2,1): Resting facing away, the cluster of spore pods visible above the tendril mass. The pale mauve flesh breathes slowly and the yellow-green veining dims in the relaxed state.
  Header "Idle Left" (2,2): Facing left at rest, tendrils loosely coiled. The spore pod cluster sits atop the mass in profile and the cilia shimmer along the surface in slow rhythmic waves.
  Header "Idle Right" (2,3): Facing right, the Lurker pulses gently. The dark reddish-brown underside anchors to the ground and the toxic-green spore tips glow with a dim, regular pulse.
  Header "Battle Idle 1" (2,4): The spore pods swell visibly, the dark purple bulbs expanding with internal pressure. The cilia stand erect across the entire surface and the tendrils spread outward aggressively. The toxic-green tips blaze.
  Header "Battle Idle 2" (2,5): Tendrils spread wider as the pods swell further, green tips glowing intensely. The yellow-green veining throbs faster and the cilia vibrate with hostile sensing activity.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Fully agitated, the Spore Lurker holds its spread posture with swollen pods and erect cilia. The toxic-green glow is at maximum and the fleshy mass vibrates with aggressive energy.
  Header "Attack 1" (3,1): Wind-up — a thick tendril rears back from the mass, the pale mauve flesh taut with coiled power. The yellow-green veining bulges along its length and the cilia flatten for aerodynamics.
  Header "Attack 2" (3,2): Tendril lash — the thick tendril whips forward, its tip splitting open to reveal reddish-brown inner flesh. The strike extends to the edge of the cell and the body lurches forward.
  Header "Attack 3" (3,3): A spore pod at the tendril tip bursts on impact, releasing a small cloud of toxic green spores. The pod deflates and the tendril retracts while the green cloud hangs in the air.
  Header "Cast 1" (3,4): All spore pods begin swelling dramatically, the dark purple membranes stretching thin to show the toxic green spore mass inside. The entire body hunkers down and the cilia flatten.
  Header "Cast 2" (3,5): The pods reach critical swelling, toxic-green light shining through the stretched purple membranes. A haze of green begins seeping from micro-pores and the tendrils brace the body.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Toxic spore explosion — all pods burst simultaneously, releasing a dense cloud of glowing green spores that fills the cell. The Lurker shudders at the center, pods deflated and dripping.
  Header "Damage 1" (4,1): The Lurker recoils from a hit, tendrils flinching inward. Several cilia are torn off and float away. A spore pod pops prematurely, leaking green fluid, and the yellow-green veining flickers.
  Header "Damage 2" (4,2): More tendrils curl protectively as the fleshy mass takes damage. The pale mauve skin tears in places showing darker inner tissue and another pod ruptures, deflating with a hiss.
  Header "Damage 3" (4,3): Recovery — the Lurker reshapes its mass, surviving tendrils covering the wounds. The remaining spore pods slowly re-inflate and the cilia begin sensing again, though many are broken.
  Header "KO 1" (4,4): The tendrils go limp one by one, collapsing from the outside in. The spore pods deflate and droop, their green tips going dark. The mass sags as it loses structural integrity.
  Header "KO 2" (4,5): The Lurker collapses into a formless heap, tendrils splayed and motionless. The pods are flat and empty, the cilia are still, and the yellow-green veining goes dark.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): A deflated mass of pale mauve tendrils lies flat on the ground, spore pods empty and withered. The toxic-green glow has died completely and a few last spores settle like dust around it.
  Header "Victory 1" (5,1): The Lurker puffs up triumphantly, all pods swelling with renewed vigor. The toxic-green tips blaze and the cilia wave in organized patterns. New tiny pods bud from the tendril mass.
  Header "Victory 2" (5,2): Tendrils wave slowly in a display of dominance, the spore pods pulsing with healthy green glow. The yellow-green veining throbs with strong circulation and the cilia shimmer brilliantly.
  Header "Victory 3" (5,3): The Spore Lurker settles into a satisfied mound, new growth visible as tiny tendrils and buds push from its surface. The pods glow contentedly and the cilia wave in gentle, peaceful patterns.
  Header "Weak Pose" (5,4): The Lurker is dried and shrunken, tendrils thin and brittle. Most spore pods are empty and the remaining ones glow a sickly dim green. The cilia are wilted and barely moving.
  Header "Critical Pose" (5,5): Nearly desiccated, the Lurker is a fraction of its normal size. The tendrils are cracked and brown, pods shriveled, and only a faint green flicker remains at the tip of the largest surviving pod.`,
      groupGuidance: {
        "Walk South Animation Frames": "Spore Lurker crawls South with undulating tendrils pulling it along, the fleshy pale mauve mass contracting and extending in waves. The cluster of dark purple spore pods sways atop its body and the near-white cilia ripple across its skin while yellow-green veining pulses through the tendrils.",
        "Walk North Animation Frames": "Spore Lurker crawls North with undulating tendrils pulling it along, the fleshy pale mauve mass contracting and extending in waves. The cluster of dark purple spore pods sways atop its body and the near-white cilia ripple across its skin while yellow-green veining pulses through the tendrils.",
        "Walk West Animation Frames": "Spore Lurker crawls West with undulating tendrils pulling it along, the fleshy pale mauve mass contracting and extending in waves. The cluster of dark purple spore pods sways atop its body and the near-white cilia ripple across its skin while yellow-green veining pulses through the tendrils.",
        "Walk East Animation Frames": "Spore Lurker crawls East with undulating tendrils pulling it along, the fleshy pale mauve mass contracting and extending in waves. The cluster of dark purple spore pods sways atop its body and the near-white cilia ripple across its skin while yellow-green veining pulses through the tendrils."
      },
    },
    {
      id: 'arc-jelly',
      name: "Arc Jelly",
      genre: "Sci-Fi",
      description: "A bioluminescent deep-space jellyfish creature with a translucent dome-shaped bell and long trailing tentacles that crackle with electrical arcs. Inside the bell, a dense cluster of neural filaments pulses with light. Drifts gracefully through zero-gravity environments. Peaceful unless provoked, at which point its tentacles discharge powerful electric shocks.",
      equipment: "",
      colorNotes: "Bell is translucent pale blue-white with a soft inner glow. Neural filaments pulse between electric blue and bright white. Tentacles are near-transparent with vivid cyan-to-violet electrical arcs running along their length. Outer bell rim has a faint pink-magenta bioluminescent edge.",
      rowGuidance: `
Arc Jelly has no limbs — it is a jellyfish with a translucent dome-shaped bell and long trailing tentacles that crackle with electrical arcs. It propels itself through rhythmic bell contractions and drifts with trailing tentacles below. A dense cluster of neural filaments pulses inside the bell.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Arc Jelly floats peacefully facing the viewer, the bell gently pulsing. The neural filaments glow with a calm, slow pulse between blue and white. Tentacles sway below with lazy, gentle arcs.
  Header "Idle Up" (2,1): Floating serenely facing away, the translucent bell glows softly from within. The tentacles drift in zero-gravity currents and the pink-magenta rim pulses at resting rhythm.
  Header "Idle Left" (2,2): Facing left in a peaceful drift, the bell profile shows the neural filament glow. The tentacles trail with occasional small cyan sparks and the dome shimmers translucently.
  Header "Idle Right" (2,3): Facing right, floating calmly. The bell catches light beautifully and the neural filaments pulse in a mesmerizing slow pattern. The tentacles drift with faint electrical whispers.
  Header "Battle Idle 1" (2,4): Arc Jelly contracts its bell aggressively, the dome pulling tight. The neural filaments blaze bright white and the tentacles stiffen, arcs intensifying from lazy sparks to vivid cyan-violet bolts.
  Header "Battle Idle 2" (2,5): In defensive posture, the tentacles spread outward like an electrified cage. The arcs crackle louder and brighter, jumping between tentacles. The bell rim blazes pink-magenta in warning.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Arc Jelly holds its combat posture with tentacles spread and crackling. The neural filaments pulse rapidly between blue and white and the bell vibrates with contained electrical energy.
  Header "Attack 1" (3,1): Wind-up — one tentacle rears back, charging with intense cyan energy. The electrical arc along its length builds to a blinding brightness and the bell contracts in preparation.
  Header "Attack 2" (3,2): Shock lash — the charged tentacle whips forward, discharging a bolt of cyan-violet lightning at the target. The other tentacles flare sympathetically and the bell pulses from the energy release.
  Header "Attack 3" (3,3): Follow-through — the lightning bolt crackles at the edge of the cell as the striking tentacle recoils. Residual arcs dance along all tentacles and the neural filaments flash white.
  Header "Cast 1" (3,4): All neural filaments blaze simultaneously as Arc Jelly enters an overcharge state. The filaments pulse faster and brighter, and energy visibly flows down from the bell into the tentacles.
  Header "Cast 2" (3,5): A massive charge builds — every tentacle blazes with intense electrical energy, arcs jumping between them in a web of lightning. The bell glows from within like a lantern and the rim is incandescent pink.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Chain lightning storm — arcs of cyan-violet lightning discharge simultaneously from all tentacles in a radial burst. The bell flashes blindingly white and the neural filaments overload momentarily.
  Header "Damage 1" (4,1): Arc Jelly recoils from a hit, the bell distorting from its dome shape. The neural filaments flicker erratically and several tentacle arcs sputter out. The bell wobbles off-balance.
  Header "Damage 2" (4,2): The bell collapses partially inward, losing its smooth dome shape. The neural filament glow dims unevenly and more tentacles go dark, their arcs dying. The pink-magenta rim fades.
  Header "Damage 3" (4,3): Recovery — the bell slowly re-inflates to its dome shape, though slightly lopsided. The neural filaments reestablish a dim glow and a few tentacles reignite with weak arcs.
  Header "KO 1" (4,4): The bell deflates, losing its dome shape and sagging. The neural filaments go dark one cluster at a time and the tentacles tangle lifelessly, all arcs extinguished.
  Header "KO 2" (4,5): Arc Jelly sinks downward as the bell crumples, tentacles tangling into a limp mass below. The last flickers of bioluminescence fade from the pink rim and the filaments are completely dark.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): A translucent heap of collapsed bell and tangled tentacles lies on the ground. The neural filaments are dark, no arcs remain, and only the faintest blue tint shows it was once luminous.
  Header "Victory 1" (5,1): Arc Jelly blazes with a brilliant light show — the bell fully expanded and glowing, neural filaments pulsing in rapid rainbow patterns. Arcs dance joyfully between all tentacles in cyan, violet, and white.
  Header "Victory 2" (5,2): The tentacles perform a synchronized wave, arcs of light traveling down their lengths in sequence. The bell pulses in rhythm and the pink-magenta rim blazes with celebratory bioluminescence.
  Header "Victory 3" (5,3): Arc Jelly settles into a serene float, the bell glowing warmly with a satisfied inner light. The tentacles drift gracefully with soft, gentle arcs and the neural filaments pulse in a calm, happy pattern.
  Header "Weak Pose" (5,4): The bell sags and barely holds its shape, the inner glow reduced to a faint flicker. Most tentacles hang limp and dark, with only one or two managing dim, sputtering arcs.
  Header "Critical Pose" (5,5): Nearly collapsed, the bell is translucent and shapeless. The neural filaments show only the faintest ghost of light and the tentacles are limp tangles with no electrical activity. Only the fading pink rim shows life.`,
      groupGuidance: {
        "Walk South Animation Frames": "Arc Jelly pulses South with rhythmic bell contractions, the trailing tentacles crackling with cyan-violet arcs. The neural filaments inside the translucent dome glow electric blue with each propulsion and the pink-magenta rim pulses softly.",
        "Walk North Animation Frames": "Arc Jelly pulses North with rhythmic bell contractions, the trailing tentacles crackling with cyan-violet arcs. The neural filaments inside the translucent dome glow electric blue with each propulsion and the pink-magenta rim pulses softly.",
        "Walk West Animation Frames": "Arc Jelly pulses West with rhythmic bell contractions, the trailing tentacles crackling with cyan-violet arcs. The neural filaments inside the translucent dome glow electric blue with each propulsion and the pink-magenta rim pulses softly.",
        "Walk East Animation Frames": "Arc Jelly pulses East with rhythmic bell contractions, the trailing tentacles crackling with cyan-violet arcs. The neural filaments inside the translucent dome glow electric blue with each propulsion and the pink-magenta rim pulses softly."
      },
    },
    {
      id: 'rustback-scavenger',
      name: "Rustback Scavenger",
      genre: "Post-Apocalyptic Sci-Fi",
      description: "A six-legged insectoid scavenger built from salvaged mechanical parts fused with organic tissue. Its body is a corroded metal thorax with exposed wiring and a biological abdomen. A pair of mismatched optical sensors serve as eyes — one is a cracked red camera lens, the other a repurposed green scanner. Mandibles fashioned from sharpened scrap metal click constantly.",
      equipment: "",
      colorNotes: "Corroded burnt-orange and rust-brown metal plating over sickly grey-green organic tissue. Wiring is faded yellow and red. Camera-eye glows dim red, scanner-eye glows green. Mandibles are dull gunmetal. Legs alternate between rusted mechanical joints and pale fleshy segments. Abdomen has a faint sickly yellow bioluminescence.",
      rowGuidance: `
Rustback Scavenger is a six-legged insectoid — no human-like arms or hands. Its legs alternate between rusted mechanical joints and pale fleshy segments. Two front legs serve as arms. Its head has scrap-metal mandibles and two mismatched optical sensors (one cracked red camera, one green scanner). A biological abdomen trails behind the corroded metal thorax.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Rustback Scavenger stands on all six legs facing the viewer, mandibles twitching with constant clicking. Both mismatched eyes scan — the red camera flickering and the green scanner sweeping. Wiring dangles from the thorax.
  Header "Idle Up" (2,1): Standing facing away, the biological abdomen and its sickly yellow glow are prominent. The six legs are planted firmly and the exposed wiring hangs from the corroded back plating.
  Header "Idle Left" (2,2): Facing left at rest, mandibles clicking idly. The corroded profile shows the mechanical-organic fusion clearly — rust-brown metal meeting grey-green tissue at jagged seams.
  Header "Idle Right" (2,3): Facing right, the cracked red camera-eye scans nearby while the green scanner on the far side sweeps. The mandibles twitch and the faded wiring shifts with the head movements.
  Header "Battle Idle 1" (2,4): Rustback rears up on its four back legs, front two legs raised with hooked tips extended. The mandibles spread wide showing sharpened scrap-metal edges and both eyes flash — red and green blazing.
  Header "Battle Idle 2" (2,5): Swaying in its reared posture, the front legs claw at the air. The abdomen glows brighter yellow as it charges biological processes and the exposed wiring crackles with stolen electricity.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Holding its aggressive rear, the Rustback clicks its mandibles rapidly. Both eyes lock on target — red camera focusing, green scanner mapping. The front leg hooks gleam with rust-red sharpened tips.
  Header "Attack 1" (3,1): Wind-up — the mandibles spread wide as the Rustback lunges its thorax forward. The scrap-metal jaw edges catch light and the front legs retract, preparing to strike.
  Header "Attack 2" (3,2): Mandible snap — the sharpened scrap-metal mandibles clamp shut with tremendous force. The corroded thorax rocks forward with the strike and the mechanical joints grind audibly.
  Header "Attack 3" (3,3): The biological abdomen contracts and spits a small glob of acid from its rear segment, the sickly yellow bioluminescence flaring as the caustic liquid arcs forward. The thorax braces.
  Header "Cast 1" (3,4): The abdomen begins glowing intensely, the sickly yellow bioluminescence brightening to a vivid pulse. The thorax opens panels revealing internal machinery that whirs and clicks, assembling something.
  Header "Cast 2" (3,5): Mini-drones — tiny versions of itself made from scrap — begin emerging from the thorax panels. The abdomen provides organic fuel, glowing as it pumps energy into the spawning process.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Swarm burst — a cluster of tiny scrap mini-drones launches from the thorax, buzzing outward in a small cloud. The Rustback shudders from the exertion, abdomen dimming after the spawning effort.
  Header "Damage 1" (4,1): Rustback recoils from a hit, corroded armor plates buckling inward. Sparks fly from exposed wiring and the cracked red camera-eye flickers. One front leg twitches from the impact.
  Header "Damage 2" (4,2): More plates buckle and a section of burnt-orange plating falls away, exposing the grey-green organic tissue beneath. The wiring sparks and the green scanner-eye goes dim briefly.
  Header "Damage 3" (4,3): Recovery — the Rustback shakes its thorax, resettling the loose plates. Its mandibles click defiantly and the abdomen pulses as biological repair begins on the exposed tissue. Both eyes reboot.
  Header "KO 1" (4,4): Legs begin failing — the mechanical joints seize one by one, causing the body to sink unevenly. The wiring sparks and goes dead, the mandibles slow their clicking, and both eyes flicker erratically.
  Header "KO 2" (4,5): Rustback crashes to the ground as the remaining legs fold, the corroded thorax hitting with a metallic clang. The abdomen bioluminescence fades and the mandibles go still.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Rustback lies upside-down, six legs curled inward and twitching faintly. The corroded plating is dented and the wiring is dead. Both eyes are dark and the mandibles are locked open.
  Header "Victory 1" (5,1): Rustback clicks its mandibles in a rapid triumphant rhythm, both eyes blazing — red camera bright, green scanner sweeping. The front legs wave and the abdomen glows a strong, healthy yellow.
  Header "Victory 2" (5,2): It stamps its six legs in a skittering victory dance, the corroded plating clanking. The wiring bounces and sparks celebratorily and the mandibles clatter like applause.
  Header "Victory 3" (5,3): Rustback settles into a proud stance, all six legs planted wide and thorax raised high. Both eyes glow steadily and a piece of salvaged scrap dangles from one mandible as a trophy.
  Header "Weak Pose" (5,4): Three of the six legs are failing, causing the Rustback to drag its body. One eye is dark and the other flickers weakly. The mandibles click slowly and the abdomen glow is nearly extinguished.
  Header "Critical Pose" (5,5): Only two legs function, barely dragging the corroded body forward. The cracked red camera-eye is dead, the green scanner emits only a faint flicker. The mandibles hang open and the abdomen is dark.`,
      groupGuidance: {
        "Walk South Animation Frames": "For walking animations, Rustback Scavenger skitters on its back legs, front legs held up like arms. The corroded metal thorax shifting over sickly grey-green organic tissue. The mismatched eyes — cracked red camera and green scanner — and the scrap-metal mandibles click. Exposed wiring sways. Bioluminescent abdomen pulses.",
        "Walk North Animation Frames": "For walking animations, Rustback Scavenger skitters on its back legs, front legs held up like arms. The corroded metal thorax shifting over sickly grey-green organic tissue. The mismatched eyes — cracked red camera and green scanner — and the scrap-metal mandibles click. Exposed wiring sways. Bioluminescent abdomen pulses.",
        "Walk West Animation Frames": "For walking animations, Rustback Scavenger skitters on its back legs, front legs held up like arms. The corroded metal thorax shifting over sickly grey-green organic tissue. The mismatched eyes — cracked red camera and green scanner — and the scrap-metal mandibles click. Exposed wiring sways. Bioluminescent abdomen pulses.",
        "Walk East Animation Frames": "For walking animations, Rustback Scavenger skitters on its back legs, front legs held up like arms. The corroded metal thorax shifting over sickly grey-green organic tissue. The mismatched eyes — cracked red camera and green scanner — and the scrap-metal mandibles click. Exposed wiring sways. Bioluminescent abdomen pulses."
      },
    },
    {
      id: 'baron-brioche',
      name: "Baron Brioche",
      genre: "Food Fantasy",
      description: "A pompous bread nobleman with a golden-brown brioche bun for a head, a flaky croissant mustache, and tiny raisin eyes set deep in his doughy face. Plump, round body made of layered pastry. Struts with aristocratic arrogance.",
      equipment: "A baguette rapier with a butter-pat crossguard, a cape made of flattened puff pastry sheets, and a monocle made from a hardened sugar disc. A breadbasket shield on his back.",
      colorNotes: "Golden-brown brioche head, warm amber pastry body. Cape is pale golden puff pastry. Baguette rapier is tan with a yellow butter crossguard. Monocle is translucent amber sugar. Raisin eyes are dark brown.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Baron Brioche stands facing the viewer with one hand on his hip and the other resting on the baguette rapier pommel. His croissant mustache twitches with disdain and his sugar monocle gleams.
  Header "Idle Up" (2,1): Facing away, the puff-pastry cape drapes regally over his round pastry body. The breadbasket shield sits on his back and the brioche head is tilted upward snobbishly.
  Header "Idle Left" (2,2): Facing left, one hand adjusts the sugar monocle while the other holds the baguette rapier loosely. His raisin eyes squint with aristocratic suspicion.
  Header "Idle Right" (2,3): Facing right, the Baron puffs out his layered chest proudly, cape flowing behind. He twirls one end of the croissant mustache with his free hand.
  Header "Battle Idle 1" (2,4): Baron Brioche drops into a fencing stance, baguette rapier raised in a classic en garde position. His puff-pastry cape flares behind him and his raisin eyes narrow with intensity.
  Header "Battle Idle 2" (2,5): He shifts weight in his fencing stance, the rapier tip tracing small circles. The butter-pat crossguard catches light and his brioche head gleams with a buttery sheen.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Baron holds his en garde pose firmly, monocle gleaming with determination. His croissant mustache bristles and the baguette rapier hums with flour-dusted menace.
  Header "Attack 1" (3,1): Wind-up — Baron Brioche pulls the baguette rapier back in a classic lunge preparation, his round body coiling. The puff-pastry cape wraps slightly around his torso.
  Header "Attack 2" (3,2): Mid-lunge — the baguette rapier thrusts forward with surprising speed, a small puff of flour erupting from the blade. His pastry body stretches forward dramatically.
  Header "Attack 3" (3,3): Follow-through — rapier fully extended, a burst of toasted bread crumbs explodes from the tip on impact. The cape flies outward and his monocle catches the light of the strike.
  Header "Cast 1" (3,4): Baron Brioche raises the baguette rapier overhead, and the breadbasket shield floats off his back. Golden dough energy begins swirling between the two items.
  Header "Cast 2" (3,5): A ring of floating croissants, rolls, and breadsticks materializes around him as the dough energy intensifies. His brioche head glows warm gold and the mustache crackles with yeast magic.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The bread spell releases — a barrage of magically-hardened dinner rolls fires outward from the orbiting ring. The breadbasket shield snaps back onto his back and his cape billows from the yeasty shockwave.
  Header "Damage 1" (4,1): Baron Brioche flinches from a hit, his monocle popping off his face. A chunk of his brioche head crumbles away and he clutches it in horror. The croissant mustache droops on one side.
  Header "Damage 2" (4,2): Staggering back, large flaky crumbs break from his layered body. His puff-pastry cape tears and the baguette rapier wavers in his grip. His raisin eyes widen with indignation.
  Header "Damage 3" (4,3): Recovery — Baron Brioche pats himself back into shape, smoothing the pastry layers. He retrieves his monocle and jams it back on, mustache bristling with outrage.
  Header "KO 1" (4,4): The Baron's pastry legs give way, his round body crumbling at the seams. The baguette rapier cracks in half and the monocle shatters. His brioche head deflates slightly.
  Header "KO 2" (4,5): Baron Brioche topples sideways, his layered body flattening like a collapsed souffle. The puff-pastry cape spreads beneath him and crumbs scatter everywhere.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Baron lies flat and deflated on the ground, looking like a sad, squashed pastry. His broken baguette rapier lies beside him, the croissant mustache has unraveled, and his monocle is in pieces.
  Header "Victory 1" (5,1): Baron Brioche puffs up to twice his size in triumph, pastry layers expanding gloriously. He raises the baguette rapier overhead and his monocle catches a triumphant gleam.
  Header "Victory 2" (5,2): He twirls the baguette rapier in a flourish while golden bread crumbs shower around him like confetti. His croissant mustache curls upward in a magnificent victory pose.
  Header "Victory 3" (5,3): The Baron plants the baguette rapier into the ground, crosses his arms over his puffed pastry chest, and tilts his brioche head back with a hearty, arrogant laugh.
  Header "Weak Pose" (5,4): Baron Brioche leans heavily on the baguette rapier, his pastry body sagging and crumbling at the edges. His monocle is cracked and the croissant mustache hangs limply.
  Header "Critical Pose" (5,5): Barely holding together, the Baron's body is a mess of separated flaky layers. His brioche head is dented, one raisin eye has fallen out, and the baguette rapier is bent — but he still sneers defiantly through his ruined mustache.`,
      groupGuidance: {
        "Walk South Animation Frames": "Baron Brioche struts South with an aristocratic waddle, the baguette rapier swinging in his right hand and the sugar monocle perched over his left raisin eye. His puff-pastry cape flutters behind him, the breadbasket shield rides his back, and crumbs and faint flour dust trail from his layered pastry body.",
        "Walk North Animation Frames": "Baron Brioche struts North with an aristocratic waddle, the baguette rapier swinging in his right hand and the sugar monocle perched over his left raisin eye. His puff-pastry cape flutters behind him, the breadbasket shield rides his back, and crumbs and faint flour dust trail from his layered pastry body.",
        "Walk West Animation Frames": "Baron Brioche struts West with an aristocratic waddle, the baguette rapier swinging in his right hand and the sugar monocle perched over his left raisin eye. His puff-pastry cape flutters behind him, the breadbasket shield rides his back, and crumbs and faint flour dust trail from his layered pastry body.",
        "Walk East Animation Frames": "Baron Brioche struts East with an aristocratic waddle, the baguette rapier swinging in his right hand and the sugar monocle perched over his left raisin eye. His puff-pastry cape flutters behind him, the breadbasket shield rides his back, and crumbs and faint flour dust trail from his layered pastry body."
      },
    },
    {
      id: 'sergeant-sriracha',
      name: "Sergeant Sriracha",
      genre: "Food Fantasy",
      description: "A fiery hot-sauce warrior with a body shaped like a bright red sriracha bottle, a green cap helmet, and intense orange-flame eyes. Muscular arms sprout from the bottle shoulders. Legs are sturdy and planted wide in a military stance.",
      equipment: "Dual chili-pepper grenades on a bandolier across his chest, armored gauntlets with capsaicin-dripping knuckle spikes, and a nozzle cannon mounted on his right forearm that shoots pressurized hot sauce. A jalape\u00f1o-shaped combat knife at his belt.",
      colorNotes: "Bright red body with white sriracha rooster label on chest. Green cap helmet. Orange-flame eyes. Gauntlets are dark red with orange spikes. Chili grenades are green and red. Nozzle cannon is chrome with red tubing.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Sergeant Sriracha stands at ease facing the viewer, hands behind his back, chest out to display the rooster label proudly. His flame eyes scan forward and the green cap helmet shadows his face.
  Header "Idle Up" (2,1): At ease facing away, the bandolier of chili grenades visible across his back. The green cap sits atop the narrowing bottle neck.
  Header "Idle Left" (2,2): Facing left at ease, one hand resting on the jalape\u00f1o knife. His cylindrical profile and the nozzle cannon at his side are prominent.
  Header "Idle Right" (2,3): Facing right at ease, the nozzle cannon arm hanging ready. Steam gently wafts from the barrel and his flame eyes look ahead watchfully.
  Header "Battle Idle 1" (2,4): Sriracha drops into a combat crouch, nozzle cannon raised and aimed forward with pressurized sauce visible in the chrome barrel. A chili grenade is gripped in his other hand. His flame eyes blaze bright.
  Header "Battle Idle 2" (2,5): He shifts weight in his combat stance, the nozzle cannon barrel glowing orange from internal heat. The capsaicin knuckle spikes drip molten sauce onto the ground.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Sriracha holds his combat stance, nozzle cannon humming with pressure. A heat shimmer distorts the air around his bright red body and his flame eyes are locked on target.
  Header "Attack 1" (3,1): Wind-up — Sriracha cocks back his cannon arm as pressure builds visibly inside the chrome barrel. His bottle body compresses slightly like a squeezed bottle.
  Header "Attack 2" (3,2): A concentrated blast of hot sauce erupts from the nozzle cannon in a fiery orange stream. The recoil pushes him back slightly and his green cap tilts from the force.
  Header "Attack 3" (3,3): Follow-through — the sauce stream splashes on impact, sending bright red droplets sizzling in all directions. Sriracha steadies himself, barrel smoking.
  Header "Cast 1" (3,4): Sriracha pulls the pins on two chili grenades simultaneously, one in each hand. The grenades glow from green to bright red as they activate, smoke curling from their stems.
  Header "Cast 2" (3,5): He hurls both chili grenades upward where they orbit him, trailing fire and capsaicin vapor. His entire body glows brighter red and the rooster label seems to animate.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The chili grenades detonate — a massive explosion of fire, hot sauce, and pepper seeds erupts outward. Sriracha stands in the center, arms wide, his flame eyes blazing white-hot.
  Header "Damage 1" (4,1): Sriracha stumbles back from a hit, a crack forming in his bottle body. Hot sauce leaks from the crack and his green cap is knocked askew. He grunts through gritted teeth.
  Header "Damage 2" (4,2): Staggering further, more cracks spread across his body. Hot sauce drips from multiple fractures and the nozzle cannon sparks. A chili grenade falls from the damaged bandolier.
  Header "Damage 3" (4,3): Recovery — Sriracha slaps a hand over the worst crack, sealing it with sheer heat pressure. His flame eyes reignite with fury and he straightens his green cap.
  Header "KO 1" (4,4): The cracks widen catastrophically — hot sauce pours from his body in streams. The nozzle cannon goes limp, the bandolier snaps, and chili grenades scatter. His flame eyes flicker.
  Header "KO 2" (4,5): Sriracha topples forward, his cracked bottle body splitting open on impact. A pool of hot sauce spreads beneath him and his green cap rolls away.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Sergeant Sriracha lies in a pool of his own sauce, body cracked open like a broken bottle. The green cap rests upside down nearby, the bandolier is scattered, and his flame eyes are completely dark.
  Header "Victory 1" (5,1): Sriracha pumps his nozzle cannon arm overhead, firing a triumphant geyser of hot sauce into the air like a fountain. His flame eyes blaze and the rooster label glows.
  Header "Victory 2" (5,2): He flexes both arms, capsaicin knuckle spikes flaring bright orange. A ring of fire surrounds his feet and his bottle body gleams an intense, polished red.
  Header "Victory 3" (5,3): Sriracha plants his feet wide, crosses his arms, and lets steam pour from his green cap in a dramatic release of pressure. The chili grenades on his bandolier glow victoriously.
  Header "Weak Pose" (5,4): Sriracha's body is covered in hairline cracks, sauce slowly seeping out. The nozzle cannon droops, barely functional. His flame eyes are dim embers and he breathes in labored puffs of steam.
  Header "Critical Pose" (5,5): Barely standing, Sriracha is a shattered mess — body held together by sheer will, sauce pooling at his feet. One flame eye is out, the other gutters weakly. He aims the sputtering nozzle cannon with his last ounce of heat.`,
      groupGuidance: {
        "Walk South Animation Frames": "Sergeant Sriracha marches South with military precision, his right forearm nozzle cannon raised at the ready and his left hand resting on the jalapeño combat knife at his belt. The chili-pepper grenade bandolier bounces across his chest with each step and a small heat shimmer radiates from his bright red body.",
        "Walk North Animation Frames": "Sergeant Sriracha marches North with military precision, his right forearm nozzle cannon raised at the ready and his left hand resting on the jalapeño combat knife at his belt. The chili-pepper grenade bandolier bounces across his chest with each step and a small heat shimmer radiates from his bright red body.",
        "Walk West Animation Frames": "Sergeant Sriracha marches West with military precision, his right forearm nozzle cannon raised at the ready and his left hand resting on the jalapeño combat knife at his belt. The chili-pepper grenade bandolier bounces across his chest with each step and a small heat shimmer radiates from his bright red body.",
        "Walk East Animation Frames": "Sergeant Sriracha marches East with military precision, his right forearm nozzle cannon raised at the ready and his left hand resting on the jalapeño combat knife at his belt. The chili-pepper grenade bandolier bounces across his chest with each step and a small heat shimmer radiates from his bright red body."
      },
    },
    {
      id: 'duchess-gelato',
      name: "Duchess Gelato",
      genre: "Food Fantasy",
      description: "An elegant ice cream sorceress with a swirled tri-color gelato head (strawberry pink, pistachio green, vanilla cream), a waffle-cone corset bodice, and a flowing skirt made of frozen cream ribbons. Graceful and poised with a cold, regal demeanor.",
      equipment: "A wafer-stick wand tipped with a crystallized sugar star, a parasol made from a giant sugar cookie with royal icing filigree, and delicate spun-sugar jewelry at her wrists and neck. A small sundae-glass familiar floats beside her.",
      colorNotes: "Tri-color gelato head: strawberry pink, pistachio green, vanilla cream. Waffle-cone bodice is warm tan with grid pattern. Skirt is pale white-blue frozen cream. Wand is tan wafer with a sparkling sugar star. Parasol is cream with white icing swirls.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Duchess Gelato stands poised facing the viewer, parasol resting on her shoulder and wand held loosely. Her gelato head swirls slowly with hypnotic color and the sundae familiar orbits her lazily.
  Header "Idle Up" (2,1): Facing away, the frozen cream skirt and sugar cookie parasol dominate the view. Frost crystals drift gently downward around her feet.
  Header "Idle Left" (2,2): Facing left, she holds the parasol open to shade her gelato head from imagined heat. The wand rests in the crook of her arm and her expression is serene.
  Header "Idle Right" (2,3): Facing right, the Duchess fans herself delicately with one hand. The sundae-glass familiar hovers near her shoulder and the sugar star on her wand pulses faintly.
  Header "Battle Idle 1" (2,4): Duchess Gelato snaps the parasol shut and holds it like a staff alongside the wafer wand. Her gelato head swirls faster, frost radiating from her body. The sundae familiar's ice cream glows.
  Header "Battle Idle 2" (2,5): She twirls the wand in a figure-eight, trails of frost and tiny snowflakes following the sugar star. Her frozen cream skirt crystallizes into sharp icy edges.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Duchess holds her battle pose with cold elegance, wand raised and parasol braced. The air around her visibly chills with frost particles and her gelato head gleams with icy resolve.
  Header "Attack 1" (3,1): Wind-up — she pulls the wafer wand back, the sugar star gathering swirling frost energy. The sundae familiar spins rapidly beside her, generating cold.
  Header "Attack 2" (3,2): She thrusts the wand forward, launching a concentrated blast of frozen cream that spirals toward the target. The sugar star blazes with icy light.
  Header "Attack 3" (3,3): Follow-through — the frozen blast impacts in a burst of ice crystals and cream splatter. The Duchess flicks the wand with a satisfied flourish, frost settling around her.
  Header "Cast 1" (3,4): The Duchess raises both the wand and the parasol overhead, opening the parasol upside-down like a bowl. A blizzard of sprinkles, cream, and ice begins swirling above her.
  Header "Cast 2" (3,5): The inverted parasol fills with magical gelato energy — a miniature frozen storm swirls inside it. Her tri-color head blazes bright and the sundae familiar merges into the growing spell.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Duchess flips the parasol and slams it down — a massive wave of flash-frozen gelato erupts outward, coating everything in ice cream and frost. The sundae familiar reforms beside her, glowing.
  Header "Damage 1" (4,1): Duchess Gelato flinches as a hit cracks her waffle-cone corset. A scoop of pink gelato drops from her head and the parasol wavers. She gasps with regal indignation.
  Header "Damage 2" (4,2): Staggering back, her tri-color gelato head begins to melt — streams of pink, green, and cream run down her face. The frozen cream skirt thaws at the edges and drips.
  Header "Damage 3" (4,3): Recovery — the Duchess waves her wand and re-freezes herself with a flash of cold. The melting stops, though her gelato head is slightly lopsided. She composes herself with icy dignity.
  Header "KO 1" (4,4): Her gelato head melts catastrophically, colors running together into a muddy swirl. The waffle-cone corset cracks and crumbles. The sundae familiar shatters like glass.
  Header "KO 2" (4,5): Duchess Gelato collapses in a pool of melted ice cream, her frozen skirt dissolving into puddles. The parasol breaks and the wand's sugar star dissolves.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): All that remains is a sad puddle of melted tri-color gelato with a broken waffle-cone corset sitting in the center. The wafer wand and shattered parasol lie in the pool. Only a faint cold mist marks where she stood.
  Header "Victory 1" (5,1): The Duchess twirls her parasol overhead triumphantly as a shower of rainbow sprinkles cascades down. Her gelato head swirls in vibrant, perfectly layered colors.
  Header "Victory 2" (5,2): She conjures a massive sundae from thin air beside her and perches the sundae familiar on top as the cherry. She curtsies with a regal flourish, frost sparkling.
  Header "Victory 3" (5,3): Duchess Gelato snaps the parasol open and poses beneath it, wand planted at her side. Tiny ice cream cones orbit her like a frozen solar system.
  Header "Weak Pose" (5,4): The Duchess leans on her parasol as a cane, her gelato head drooping and slowly melting. Her frozen skirt is slushy and the wafer wand droops. The sundae familiar flickers in and out of existence.
  Header "Critical Pose" (5,5): Barely a silhouette of her former self — mostly melted, the Duchess holds together by sheer frozen willpower. Her gelato head is a single dripping blob, the corset is cracked, but she still aims the dissolving wand with trembling grace.`,
      groupGuidance: {
        "Walk South Animation Frames": "Duchess Gelato glides South with regal grace, the sugar cookie parasol resting on her left shoulder and the wafer-stick wand held loosely in her right hand. Her frozen cream skirt swirls in elegant ribbons, a faint trail of frost crystals follows in her wake, and the sundae-glass familiar bobs faithfully at her right side.",
        "Walk North Animation Frames": "Duchess Gelato glides North with regal grace, the sugar cookie parasol resting on her left shoulder and the wafer-stick wand held loosely in her right hand. Her frozen cream skirt swirls in elegant ribbons, a faint trail of frost crystals follows in her wake, and the sundae-glass familiar bobs faithfully at her right side.",
        "Walk West Animation Frames": "Duchess Gelato glides West with regal grace, the sugar cookie parasol resting on her left shoulder and the wafer-stick wand held loosely in her right hand. Her frozen cream skirt swirls in elegant ribbons, a faint trail of frost crystals follows in her wake, and the sundae-glass familiar bobs faithfully at her right side.",
        "Walk East Animation Frames": "Duchess Gelato glides East with regal grace, the sugar cookie parasol resting on her left shoulder and the wafer-stick wand held loosely in her right hand. Her frozen cream skirt swirls in elegant ribbons, a faint trail of frost crystals follows in her wake, and the sundae-glass familiar bobs faithfully at her right side."
      },
    },
    {
      id: 'general-gumbo',
      name: "General Gumbo",
      genre: "Food Fantasy",
      description: "A hulking stew golem villain with a cast-iron cauldron for a torso, thick okra-stalk arms, and legs made of bundled andouille sausage links. His head is a bubbling pot lid with two glowing ember eyes peering through the steam. A dark roux oozes from his joints.",
      equipment: "A massive ladle war-hammer with a heavy iron bowl, a lid shield that doubles as his head cover, and chains made of linked onion rings draped across his body. A belt of bay leaves and a pouch of file powder at his hip.",
      colorNotes: "Dark iron-gray cauldron torso with brown roux dripping from seams. Okra arms are dark green. Sausage legs are reddish-brown. Ember eyes are orange-red. Ladle is dark iron. Onion ring chains are golden-brown. Steam is white-gray.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): General Gumbo stands menacingly, both okra hands resting on the ladle war-hammer planted before him. His pot-lid head vents a steady column of steam and his ember eyes smolder through it. Roux drips slowly from his torso seams.
  Header "Idle Up" (2,1): Facing away, a hulking mass of iron and stew. The cauldron handles jut outward, the ladle is slung across his back, and steam rises from the pot-lid into the air.
  Header "Idle Left" (2,2): Facing left, one okra arm rests on the ladle handle while the other hangs at his side, roux dripping from the knuckles. The onion-ring chains sag under their own weight.
  Header "Idle Right" (2,3): Facing right, the General's ember eyes glow ominously through a fresh billow of steam. His sausage legs are planted wide and the cauldron bubbles faintly inside.
  Header "Battle Idle 1" (2,4): Gumbo hoists the ladle war-hammer onto his shoulder with one okra arm, the other fist clenched. His pot-lid head tilts forward aggressively, steam jetting sideways. The cauldron torso bubbles violently.
  Header "Battle Idle 2" (2,5): He shifts the ladle to a two-handed grip, ember eyes flaring brighter. The roux at his joints darkens and thickens menacingly, and the onion-ring chains tighten across his swelling chest.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The General holds the massive ladle at the ready, steam pouring from every seam of his body. His ember eyes are slits of focused rage and the cauldron bubbles and roils inside.
  Header "Attack 1" (3,1): Wind-up — Gumbo heaves the ladle war-hammer overhead with both okra arms, the heavy iron bowl blotting out the sky. His cauldron torso groans under the strain.
  Header "Attack 2" (3,2): The ladle crashes downward with devastating force, the iron bowl slamming into the ground. A shockwave of dark roux and hot broth explodes outward from the impact. The chains rattle furiously.
  Header "Attack 3" (3,3): Follow-through — Gumbo wrenches the ladle from the crater, splashing boiling gumbo in an arc. Steam erupts from the impact zone and his ember eyes blaze with satisfaction.
  Header "Cast 1" (3,4): The General removes his pot-lid head and holds it over the cauldron opening. The stew inside begins to bubble and churn with unnatural energy, green and brown vapors spiraling upward.
  Header "Cast 2" (3,5): He plunges an okra arm into his own cauldron body, stirring the contents. A vortex of stew energy rises — chunks of okra, sausage, and shrimp orbit within a tornado of dark roux magic.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Gumbo slams the pot-lid back on and the spell erupts — a geyser of boiling, enchanted gumbo blasts from every seam and joint, scalding everything nearby. The onion-ring chains glow red-hot.
  Header "Damage 1" (4,1): A hit dents the cauldron torso, causing a spray of hot stew from the crack. The pot-lid rattles and his ember eyes flicker. One onion-ring chain link snaps.
  Header "Damage 2" (4,2): Staggering, a large section of the cauldron cracks open, pouring stew. His okra arms wilt slightly and the sausage legs buckle. Steam vents erratically from the pot-lid.
  Header "Damage 3" (4,3): Recovery — Gumbo slaps a massive okra hand over the crack, sealing it with hardened roux. He straightens up with a threatening rumble, ember eyes reigniting.
  Header "KO 1" (4,4): The cauldron torso fractures catastrophically — stew pours from every side. The okra arms go limp, sausage legs buckle, and the pot-lid tilts off his head. Ember eyes dim.
  Header "KO 2" (4,5): General Gumbo collapses in a massive splash of gumbo, his cauldron body splitting open. The ladle clatters to the ground and sausage links scatter.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): A shattered iron cauldron sits in a lake of cooling gumbo. Limp okra arms, disconnected sausage links, and a cracked pot-lid lie scattered in the stew. The ember eyes are cold dark stones.
  Header "Victory 1" (5,1): General Gumbo raises the ladle war-hammer overhead with one arm, stew raining down from the bowl like a grotesque trophy. His pot-lid head jets steam in a furious victory roar and his ember eyes blaze.
  Header "Victory 2" (5,2): He slams both okra fists against his cauldron chest in a thunderous drumroll, each impact sending splashes of dark roux outward. The onion-ring chains clatter percussively.
  Header "Victory 3" (5,3): Gumbo plants the ladle and removes his pot-lid, revealing the bubbling stew within. He holds the lid aloft like a crown, ember eyes glowing with malevolent pride.
  Header "Weak Pose" (5,4): The cauldron is covered in cracks, leaking stew from a dozen wounds. His okra arms are wilted and browning, the sausage legs are sagging, and one ember eye has gone dark. Steam barely trickles from the pot-lid.
  Header "Critical Pose" (5,5): Barely a shell of iron and stew, Gumbo holds together through sheer stubborn villainy. The cauldron is more hole than metal, the roux has dried to a crust, and his remaining ember eye burns with desperate, simmering fury.`,
      groupGuidance: {
        "Walk South Animation Frames": "General Gumbo lumbers South with heavy sloshing footfalls, the massive ladle war-hammer gripped in his right okra hand and his left okra fist clenched at his side. His cast-iron cauldron torso creaks, steam billows from his pot-lid head, onion-ring chains rattle across his chest, and dark roux drips from every joint.",
        "Walk North Animation Frames": "General Gumbo lumbers North with heavy sloshing footfalls, the massive ladle war-hammer gripped in his right okra hand and his left okra fist clenched at his side. His cast-iron cauldron torso creaks, steam billows from his pot-lid head, onion-ring chains rattle across his chest, and dark roux drips from every joint.",
        "Walk West Animation Frames": "General Gumbo lumbers West with heavy sloshing footfalls, the massive ladle war-hammer gripped in his right okra hand and his left okra fist clenched at his side. His cast-iron cauldron torso creaks, steam billows from his pot-lid head, onion-ring chains rattle across his chest, and dark roux drips from every joint.",
        "Walk East Animation Frames": "General Gumbo lumbers East with heavy sloshing footfalls, the massive ladle war-hammer gripped in his right okra hand and his left okra fist clenched at his side. His cast-iron cauldron torso creaks, steam billows from his pot-lid head, onion-ring chains rattle across his chest, and dark roux drips from every joint."
      },
    },
    {
      id: 'pepperoni-pete',
      name: "Pepperoni Pete",
      genre: "Food Fantasy",
      description: "A roguish pizza-slice thief with a triangular pizza body, a golden-brown crust spine running down his back, and a face made of melted mozzarella with pepperoni-disc cheeks. Lanky and flexible with a sneaky, hunched posture. Strings of cheese trail from his movements.",
      equipment: "Twin pizza-cutter chakrams that he throws and recalls, suction-cup boots made of mozzarella for wall-climbing, and a bandana made from a folded napkin. A utility belt of condiment packets (hot pepper flakes, parmesan, garlic butter).",
      colorNotes: "Triangular body is pizza-orange with melted yellow cheese and red pepperoni spots. Crust spine is golden-brown. Mozzarella face is pale yellow-white. Napkin bandana is white with red checkered pattern. Pizza-cutter chakrams are silver with red handles.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Pete stands in a casual thieves' slouch, one hand spinning a pizza-cutter chakram lazily. His pepperoni cheeks bulge in a smirk above the bandana and cheese strings hang from his fingertips.
  Header "Idle Up" (2,1): Facing away in a slouch, the crust spine and crossed chakrams are visible. His napkin bandana ties droop and he scratches his back, flaking off a pepperoni disc.
  Header "Idle Left" (2,2): Facing left, Pete leans against an invisible wall, arms crossed. The chakrams dangle from his fingers and his mozzarella face has a bored, scheming expression.
  Header "Idle Right" (2,3): Facing right, he casually tosses a parmesan packet from his utility belt and catches it. His pizza-triangle body is relaxed and slightly droopy with stretchy cheese.
  Header "Battle Idle 1" (2,4): Pete snaps to attention, a pizza-cutter chakram in each hand held in a dual-wield stance. His mozzarella face stretches into a wild grin above the bandana and his body tenses.
  Header "Battle Idle 2" (2,5): He flips one chakram in the air and catches it, shifting into a new stance. Cheese strings whip around him dynamically and his pepperoni cheeks flush darker red.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Pete crouches low with both chakrams ready, the silver blades spinning slowly. His mozzarella eyes narrow and cheese strings drift around him like tripwires.
  Header "Attack 1" (3,1): Wind-up — Pete cocks his arm back, one pizza-cutter chakram spinning up to speed in his grip. His triangular body coils like a spring, cheese stretching taut.
  Header "Attack 2" (3,2): He hurls the chakram in a flat spinning arc, the silver blade slicing through the air with a pizza-cutter whir. Cheese strings trail behind it like a yo-yo tether.
  Header "Attack 3" (3,3): The chakram ricochets back to his hand as the second one flies out in a follow-up throw. Both blades flash silver and cheese-string trails criss-cross the frame.
  Header "Cast 1" (3,4): Pete rips open all his condiment packets at once — hot pepper flakes, parmesan, and garlic butter swirl around him in a spicy tornado. His pizza body absorbs the seasonings and glows.
  Header "Cast 2" (3,5): The condiment tornado intensifies — pepper flakes ignite into tiny sparks, parmesan crystallizes into shrapnel, and garlic butter coats his chakrams with a golden sheen. His eyes glow red-pepper hot.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Pete launches both seasoned chakrams simultaneously through the condiment storm — they spiral outward trailing fire, cheese, and garlic-butter sparks. The explosion is a greasy, spicy supernova.
  Header "Damage 1" (4,1): Pete flinches as a hit takes a bite-shaped chunk out of his pizza body. Cheese strings spray from the wound and he clutches the missing section. His bandana slips.
  Header "Damage 2" (4,2): Another hit tears more pizza from his body — he's visibly smaller now, missing a large triangular piece. Toppings scatter and his mozzarella face stretches in pain.
  Header "Damage 3" (4,3): Recovery — Pete pulls his remaining cheese together, stretching mozzarella over the wounds like bandages. He's battered but his eyes burn with defiant mischief behind the crooked bandana.
  Header "KO 1" (4,4): Pete's pizza body tears apart — cheese strings snap, pepperoni discs pop off, and the crust spine cracks. The chakrams clatter to the ground and his mozzarella face melts into a sad droop.
  Header "KO 2" (4,5): He collapses into a messy heap of cheese, sauce, and scattered toppings. The napkin bandana flutters down over the pile and the chakrams spin to a stop beside him.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): A sad pile of cold pizza remains — flattened, stale, and congealed. The crust spine lies cracked on top, pepperoni discs are scattered, and the checkered bandana covers the mess like a tiny shroud. The chakrams are stuck in the ground nearby.
  Header "Victory 1" (5,1): Pete juggles both pizza-cutter chakrams overhead, spinning and catching them with flashy flair. Cheese strings fly everywhere in celebration and his pepperoni cheeks glow with triumph.
  Header "Victory 2" (5,2): He strikes a dramatic rogue pose — one foot on an invisible ledge, chakram pointed forward, napkin bandana billowing. A trail of cheese strings frames him like a cheesy spotlight.
  Header "Victory 3" (5,3): Pete takes a bite out of his own arm (it grows back immediately in a stretch of cheese), chewing smugly. He twirls a chakram on one finger and winks with a mozzarella eyelid.
  Header "Weak Pose" (5,4): Pete is missing large chunks of his pizza body, barely held together by overstretched cheese strings. The crust spine is cracked, the bandana is torn, and he holds one chakram weakly while the other drags on the ground.
  Header "Critical Pose" (5,5): Just a sad, tiny triangle of pizza with a face — most of his body is gone. He clutches one battered chakram with a single stretched cheese-string arm, his last pepperoni cheek barely hanging on. But his mozzarella grin refuses to die.`,
      groupGuidance: {
        "Walk South Animation Frames": "Pepperoni Pete slinks South in a sneaky crouch, one pizza-cutter chakram in each hand — the right spinning lazily and the left tucked close. Strings of melted mozzarella trail from his movements and his mozzarella suction-cup boots stick briefly to the ground with each stealthy step.",
        "Walk North Animation Frames": "Pepperoni Pete slinks North in a sneaky crouch, one pizza-cutter chakram in each hand — the right spinning lazily and the left tucked close. Strings of melted mozzarella trail from his movements and his mozzarella suction-cup boots stick briefly to the ground with each stealthy step.",
        "Walk West Animation Frames": "Pepperoni Pete slinks West in a sneaky crouch, one pizza-cutter chakram in each hand — the right spinning lazily and the left tucked close. Strings of melted mozzarella trail from his movements and his mozzarella suction-cup boots stick briefly to the ground with each stealthy step.",
        "Walk East Animation Frames": "Pepperoni Pete slinks East in a sneaky crouch, one pizza-cutter chakram in each hand — the right spinning lazily and the left tucked close. Strings of melted mozzarella trail from his movements and his mozzarella suction-cup boots stick briefly to the ground with each stealthy step."
      },
    },
    {
      id: 'queen-umami',
      name: "Queen Umami",
      genre: "Food Fantasy",
      description: "A sinister mushroom empress villain with a massive shiitake cap crown, a body woven from enoki and oyster mushroom fibers, and glowing bioluminescent spore eyes. Tall and willowy with an unsettling, swaying gait. Dark truffle-colored skin with veins of mycelium running beneath the surface.",
      equipment: "A gnarled morel scepter that drips with dark spore ink, a cloak of layered portobello gills that rustles like whispers, and a choker of dried porcini discs. Clouds of psychedelic spores drift around her constantly.",
      colorNotes: "Shiitake cap crown is dark brown with tan cracks. Body is pale cream enoki fibers with gray oyster mushroom patches. Bioluminescent eyes are eerie blue-green. Truffle skin is near-black. Morel scepter is dark honeycomb brown. Portobello gill cloak is dark brown-purple. Spore clouds are sickly yellow-green.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Queen Umami stands still facing the viewer, an aura of slowly rotating spores surrounding her. The morel scepter rests upright at her side, leaking ink. Her bioluminescent eyes are half-lidded and menacing beneath the shiitake crown.
  Header "Idle Up" (2,1): Facing away, motionless but for the slowly rustling gill cloak. Mycelium threads fan outward from her feet in an expanding network. Spores drift upward lazily.
  Header "Idle Left" (2,2): Facing left, she strokes the morel scepter thoughtfully, dark ink coating her fingers. Her bioluminescent eyes cast a blue-green glow on the scepter's honeycomb surface.
  Header "Idle Right" (2,3): Facing right, Queen Umami holds up one hand and examines the mycelium veins pulsing beneath her truffle skin. A small mushroom sprouts from her palm and she crushes it, releasing spores.
  Header "Battle Idle 1" (2,4): Umami raises the morel scepter overhead, its dark ink flowing upward in defiance of gravity. Her bioluminescent eyes blaze fully open, her spore cloud intensifies to a toxic haze, and the gill cloak spreads wide like fungal wings.
  Header "Battle Idle 2" (2,5): She sways hypnotically in her battle stance, the spore cloud pulsing in rhythm. Mycelium threads creep outward from her feet aggressively and the morel scepter hums with dark energy.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Queen holds her menacing stance, gill cloak spread wide. The spore cloud is thick and choking, her eyes are blazing beacons, and the morel scepter drips with anticipation.
  Header "Attack 1" (3,1): Wind-up — Umami raises the morel scepter and dark spore ink collects at its tip, forming a large, quivering droplet. Mycelium threads retract from the ground into her body, charging the attack.
  Header "Attack 2" (3,2): She swings the scepter in a wide arc, the collected ink launching as a toxic slash of dark spore energy. The portobello cloak flares outward and her eyes leave bioluminescent trails.
  Header "Attack 3" (3,3): The dark slash impacts and erupts into a patch of rapid fungal growth — mushrooms sprout instantly at the point of contact, then wither and release a secondary spore burst.
  Header "Cast 1" (3,4): Queen Umami plants the morel scepter into the ground. Mycelium threads explode outward from the base, forming a vast underground network. Small mushrooms begin sprouting in a circle around her.
  Header "Cast 2" (3,5): The mushroom circle grows taller, each cap glowing with bioluminescent energy. The Queen raises her arms and the spore cloud converges overhead into a dense, swirling fungal storm. Her eyes are blinding blue-green.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The fungal storm detonates — a massive cascade of toxic spores, sprouting mushrooms, and dark mycelium tendrils erupts in all directions. The Queen stands in the eye, gill cloak billowing, a silhouette of pure fungal terror.
  Header "Damage 1" (4,1): A hit tears a section of enoki fibers from her body, exposing dark truffle beneath. She recoils, her shiitake crown cracking at one edge. Spores scatter erratically.
  Header "Damage 2" (4,2): Staggering, more of her enoki-fiber body tears away. The mycelium veins beneath her skin pulse frantically in repair mode. The portobello cloak shreds at the edges and the morel scepter wavers.
  Header "Damage 3" (4,3): Recovery — Queen Umami regrows her damaged fibers rapidly, new mushroom tissue sprouting to fill the gaps. The repairs are visible as lighter-colored patches. She hisses through clenched teeth, eyes blazing.
  Header "KO 1" (4,4): Her body can't keep up with the damage — enoki fibers wilt and collapse. The shiitake crown splits down the middle, the morel scepter cracks, and the bioluminescent light in her eyes sputters.
  Header "KO 2" (4,5): Queen Umami topples in a cascade of decaying mushroom matter, her gill cloak folding over her like a funeral shroud. The spore cloud dissipates and mycelium threads go limp.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): A mound of wilted, decaying fungal matter lies on the ground — the split shiitake crown on top, the broken morel scepter beside it. The bioluminescent glow is gone. Only a few dormant spores drift upward from the remains.
  Header "Victory 1" (5,1): Queen Umami raises the morel scepter and a forest of bioluminescent mushrooms erupts around her in celebration. Her eyes blaze triumphant blue-green and the gill cloak spreads wide like a dark throne behind her.
  Header "Victory 2" (5,2): She laughs silently, spore clouds erupting in rhythmic bursts like dark fireworks. Mycelium threads spread outward in a conquering web and new mushrooms sprout wherever they touch.
  Header "Victory 3" (5,3): The Queen sits upon a throne of interwoven mushrooms that grew from the battlefield. She rests the scepter across her lap, shiitake crown gleaming, bioluminescent eyes half-lidded in cold satisfaction.
  Header "Weak Pose" (5,4): Umami's body is riddled with rot — enoki fibers browning and wilting, the shiitake crown sagging and cracked. Her bioluminescent eyes are dim and her spore cloud is thin. She clutches the morel scepter for support.
  Header "Critical Pose" (5,5): A crumbling ruin of fungus, Queen Umami barely maintains her form. Her crown is shattered, her cloak is decomposing, and only one bioluminescent eye still glows — but the mycelium beneath the ground still pulses, and her grip on the cracked scepter remains iron.`,
      groupGuidance: {
        "Walk South Animation Frames": "Queen Umami drifts South with an unsettling sway, the gnarled morel scepter dripping dark spore ink in her right hand and her left hand trailing mycelium threads. Her layered portobello-gill cloak rustles like whispers, a cloud of yellow-green spores trails behind her, and mycelium threads spread from each footprint.",
        "Walk North Animation Frames": "Queen Umami drifts North with an unsettling sway, the gnarled morel scepter dripping dark spore ink in her right hand and her left hand trailing mycelium threads. Her layered portobello-gill cloak rustles like whispers, a cloud of yellow-green spores trails behind her, and mycelium threads spread from each footprint.",
        "Walk West Animation Frames": "Queen Umami drifts West with an unsettling sway, the gnarled morel scepter dripping dark spore ink in her right hand and her left hand trailing mycelium threads. Her layered portobello-gill cloak rustles like whispers, a cloud of yellow-green spores trails behind her, and mycelium threads spread from each footprint.",
        "Walk East Animation Frames": "Queen Umami drifts East with an unsettling sway, the gnarled morel scepter dripping dark spore ink in her right hand and her left hand trailing mycelium threads. Her layered portobello-gill cloak rustles like whispers, a cloud of yellow-green spores trails behind her, and mycelium threads spread from each footprint."
      },
    },
    {
      id: 'wasabi-ronin',
      name: "Wasabi Ronin",
      genre: "Food Fantasy",
      description: "A stoic wandering sushi warrior with a body made of tightly-packed rice wrapped in a nori seaweed cloak, a head of vibrant green wasabi paste shaped into a stern samurai topknot, and eyes made of pickled ginger slices. Compact, disciplined physique with precise, economical movements.",
      equipment: "A razor-sharp sashimi blade (a single long slice of gleaming tuna used as a katana), bamboo-mat armor worn over the nori cloak, and chopstick throwing daggers tucked into a soy-sauce-bottle holster at his hip. A small dish of soy sauce serves as a meditation focus.",
      colorNotes: "White rice body with dark green nori cloak. Bright green wasabi head and topknot. Pink pickled-ginger eyes. Sashimi blade is deep red tuna with a silver edge. Bamboo-mat armor is tan with green ties. Chopsticks are pale wood. Soy sauce bottle is dark brown-black.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Wasabi Ronin stands perfectly still, hands at his sides, facing the viewer. His ginger eyes are calm, his wasabi topknot motionless. The sashimi blade rests sheathed and the nori cloak is undisturbed. Total stillness.
  Header "Idle Up" (2,1): Facing away in a meditative stance, the nori cloak draped over his rice body. The sashimi blade crosses his back and the wasabi topknot is perfectly vertical.
  Header "Idle Left" (2,2): Facing left, one hand rests on the sashimi hilt in a classic iaido ready position. His expression is blank and focused, ginger eyes unblinking.
  Header "Idle Right" (2,3): Facing right, the Ronin holds the small soy sauce dish in one hand, meditating on its dark surface. His wasabi features are serene.
  Header "Battle Idle 1" (2,4): In a single fluid motion, Wasabi Ronin draws the sashimi blade — the deep red tuna katana gleams with a razor-silver edge. His nori cloak falls back from his arms and his ginger eyes narrow. The wasabi topknot seems to sharpen.
  Header "Battle Idle 2" (2,5): He shifts into a low kendo stance, the sashimi blade angled precisely. A faint green aura of wasabi heat radiates from his body and the bamboo-mat armor creaks.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Ronin holds his blade perfectly level, the tuna-red surface reflecting light. His entire body is coiled potential energy — ginger eyes locked, wasabi head steady, rice body compressed and ready.
  Header "Attack 1" (3,1): Wind-up — Wasabi Ronin raises the sashimi blade overhead in a classic two-handed grip. His rice body compresses like a loaded spring and the nori cloak whips back.
  Header "Attack 2" (3,2): A devastating downward slash — the sashimi blade cuts through the air with a flash of red and silver. A thin line of wasabi heat trails the blade edge and his ginger eyes blaze.
  Header "Attack 3" (3,3): Follow-through — the blade completes its arc with surgical precision. A burst of wasabi-green energy erupts at the point of impact and the Ronin flicks the blade clean in a chiburi motion.
  Header "Cast 1" (3,4): Wasabi Ronin draws three chopstick daggers between his fingers and channels energy through them. Each chopstick tip glows with a different condiment aura — soy brown, wasabi green, ginger pink.
  Header "Cast 2" (3,5): He hurls the charged chopsticks upward where they form a triangle in the air. A spinning mandala of sushi energy materializes between them — rice, nori, and fish spinning in a sacred pattern.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The sushi mandala fires — a focused beam of pure umami energy blasts downward through the chopstick triangle. The beam is layered: soy-dark outer ring, wasabi-green core, ginger-pink sparks. The Ronin sheathes his blade as the attack lands.
  Header "Damage 1" (4,1): A hit scatters rice from the Ronin's body, leaving a gap in his torso. His nori cloak tears and a chopstick snaps. His ginger eyes wince but he holds his stance.
  Header "Damage 2" (4,2): More rice bursts from his body, the nori cloak now shredded. His bamboo-mat armor cracks and the sashimi blade wobbles in his loosening grip. The wasabi topknot wilts slightly.
  Header "Damage 3" (4,3): Recovery — the Ronin presses his scattered rice back into place with one hand, packing it tight. He adjusts the torn nori, steadies the blade, and hardens his wasabi expression. Ginger eyes sharpen.
  Header "KO 1" (4,4): His rice body finally falls apart — grains pouring from the torn nori like sand. The sashimi blade drops as his arm disintegrates. The wasabi topknot melts in the heat of defeat.
  Header "KO 2" (4,5): Wasabi Ronin collapses into a mound of loose rice, torn nori sheets, and a puddle of melted wasabi. The sashimi blade lies across the pile and the chopsticks are scattered.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): A deconstructed sushi plate lies on the ground — scattered rice, limp nori, a dissolved wasabi smear, two pink ginger slices where the eyes were, and the sashimi blade resting atop it all. The chopsticks are laid parallel in a final respectful gesture.
  Header "Victory 1" (5,1): Wasabi Ronin sheathes the sashimi blade in one precise, ceremonial motion — the blade slides home with a decisive click. His wasabi topknot gleams and his ginger eyes close in satisfied meditation.
  Header "Victory 2" (5,2): He performs a formal bow, the nori cloak spreading elegantly. Then he rises and holds the soy sauce dish aloft in a toast to the fallen. A single cherry blossom petal — made of thin-sliced ginger — drifts past.
  Header "Victory 3" (5,3): The Ronin sits cross-legged on the ground, sashimi blade across his lap, chopstick daggers arranged neatly beside him. He sips from the soy sauce dish in serene contemplation, wasabi topknot perfect.
  Header "Weak Pose" (5,4): His rice body is thin and loosely packed, grains falling steadily. The nori cloak is more hole than seaweed, the wasabi topknot is drooping, and he uses the sashimi blade as a walking stick. His ginger eyes are faded.
  Header "Critical Pose" (5,5): Barely a fistful of rice held together by a single strip of nori, the Ronin somehow still stands. The sashimi blade trembles in his grip, the wasabi has nearly dissolved, and only one faint ginger eye remains — but his stance is still perfect.`,
      groupGuidance: {
        "Walk South Animation Frames": "Wasabi Ronin walks South with measured disciplined steps, his right hand resting on the sashimi blade's hilt at his left hip and his left arm hanging still at his side. His nori seaweed cloak sways slightly, a few grains of rice trail from the hem, and his sharp wasabi topknot juts rigidly above his stoic face.",
        "Walk North Animation Frames": "Wasabi Ronin walks North with measured disciplined steps, his right hand resting on the sashimi blade's hilt at his left hip and his left arm hanging still at his side. His nori seaweed cloak sways slightly, a few grains of rice trail from the hem, and his sharp wasabi topknot juts rigidly above his stoic face.",
        "Walk West Animation Frames": "Wasabi Ronin walks West with measured disciplined steps, his right hand resting on the sashimi blade's hilt at his left hip and his left arm hanging still at his side. His nori seaweed cloak sways slightly, a few grains of rice trail from the hem, and his sharp wasabi topknot juts rigidly above his stoic face.",
        "Walk East Animation Frames": "Wasabi Ronin walks East with measured disciplined steps, his right hand resting on the sashimi blade's hilt at his left hip and his left arm hanging still at his side. His nori seaweed cloak sways slightly, a few grains of rice trail from the hem, and his sharp wasabi topknot juts rigidly above his stoic face."
      },
    },
    {
      id: 'wasteland-wanderer',
      name: "Wasteland Wanderer",
      genre: "Post-Apocalyptic",
      description: "A lone survivor with sun-weathered skin, a full-face gas mask with round tinted lenses, and a tattered leather duster over layered scavenged clothing. Medium wiry build with a cautious, hunched posture.",
      equipment: "A long leather duster over mismatched layered clothing, a rubber-strapped gas mask, a crude makeshift spear fashioned from a stop sign and pipe, and a bulging salvaged backpack covered in dangling trinkets.",
      colorNotes: "Dusty brown leather duster, faded olive under-layers, rust orange accents on salvaged gear. Gas mask is dark rubber with amber-tinted lenses. Spear shaft is dull grey pipe with a faded red stop-sign blade. Backpack is patched tan canvas.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Wanderer stands in a slightly hunched stance facing the viewer, spear resting on his shoulder and one hand on a hip strap. The gas mask's amber lenses stare out beneath the duster's raised collar. Trinkets hang still from the backpack.
  Header "Idle Up" (2,1): Facing away at rest, the patched backpack and dangling trinkets fill the view. The leather duster hangs loosely and the spear extends upward past his shoulder. The rubber gas mask straps cross the back of his head.
  Header "Idle Left" (2,2): Facing left in a watchful hunched stance, one hand resting on the spear shaft planted beside him. The gas mask filter and amber lens are visible in profile. The duster drapes heavily.
  Header "Idle Right" (2,3): Facing right at rest, the spear leaning against his shoulder. The duster collar is turned up and the backpack's silhouette extends behind him. The mask's breathing creates a faint haze from the filter.
  Header "Battle Idle 1" (2,4): The Wanderer drops into a low defensive crouch, the stop-sign spear held horizontally at waist level with both hands. The duster pulls back from his arms and the amber lenses narrow with focus behind the mask.
  Header "Battle Idle 2" (2,5): He shifts his weight in the crouch, the spear tip tracking an unseen threat. The backpack straps creak and the trinkets clink softly. His gas mask breathing quickens, visible as a faint pulse from the filter.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Wanderer holds the defensive crouch, spear angled forward. The duster flares behind him and the amber lenses reflect a harsh wasteland glare. His knuckles are white on the pipe shaft.
  Header "Attack 1" (3,1): Wind-up — he pulls the stop-sign spear back over his right shoulder, body coiling. The duster wraps around his torso from the twist and the backpack shifts heavily.
  Header "Attack 2" (3,2): The spear thrusts forward in a savage jab, the faded red stop-sign blade punching outward. His body extends into the strike and the duster flares from the motion.
  Header "Attack 3" (3,3): Follow-through — the spear is fully extended, the stop-sign blade at maximum reach. The duster whips from the rotational force and the Wanderer's hunched posture straightens into the lunge.
  Header "Cast 1" (3,4): The Wanderer reaches into the backpack and pulls out a crude Molotov cocktail — a glass bottle stuffed with an oily rag. He holds a salvaged lighter in his other hand, spear tucked under his arm.
  Header "Cast 2" (3,5): The rag ignites, casting orange firelight across his gas mask. The amber lenses glow warm and the bottle's contents slosh with volatile liquid. Smoke trails from the burning rag.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Wanderer hurls the Molotov forward — a small arc of fire trails the spinning bottle as it shatters at the cell edge, erupting in a compact burst of flame. He shields his mask with one arm.
  Header "Damage 1" (4,1): The Wanderer staggers backward from a hit, the spear wavering in his grip. One gas mask lens cracks in a spiderweb pattern and trinkets scatter from the jostled backpack.
  Header "Damage 2" (4,2): Stumbling further, the duster tears at the shoulder and salvaged gear spills from a ruptured backpack pocket. The cracked mask lens distorts the amber glow and his breathing rasps louder through the filter.
  Header "Damage 3" (4,3): Recovery — the Wanderer plants the spear butt into the ground for balance, steadying himself. He presses the torn duster against his side and the remaining mask lens refocuses on the threat.
  Header "KO 1" (4,4): His grip on the spear loosens as his knees buckle. The gas mask straps slip and the mask tilts sideways on his face. The backpack drags him backward with its weight.
  Header "KO 2" (4,5): The Wanderer collapses onto the backpack, the spear clattering beside him. The gas mask pulls free, revealing sun-weathered, scarred skin beneath. Trinkets scatter across the ground.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Wanderer lies sprawled on the ground atop the crushed backpack, the gas mask beside his weathered face. The stop-sign spear rests nearby and scattered trinkets and salvage surround his still form.
  Header "Victory 1" (5,1): The Wanderer plants the stop-sign spear into the ground and leans on it, pushing the gas mask up onto his forehead. His weathered face shows a rare, tired grin beneath.
  Header "Victory 2" (5,2): He raises the spear overhead with one hand, the faded red stop-sign blade catching the light. The duster billows and trinkets jingle in a metallic cheer from the backpack.
  Header "Victory 3" (5,3): The Wanderer slings the spear across his shoulders behind his neck, arms draped over it casually. The gas mask hangs loosely at his collar and he surveys the aftermath with amber-tinted goggles pushed up.
  Header "Weak Pose" (5,4): The Wanderer leans heavily on the spear as a crutch, one hand clutching his side. The duster is torn and caked with dust, the mask filter is clogged with soot, and the backpack hangs by a single strap.
  Header "Critical Pose" (5,5): Barely standing, the Wanderer grips the spear with trembling hands. The gas mask is cracked and wheezing, the duster is shredded, and his desperate amber lenses scan for any escape route.`,
      groupGuidance: {
        "Walk South Animation Frames": "The Wasteland Wanderer trudges South with a cautious hunched posture, the stop-sign spear gripped in his right hand at shoulder height and his left hand hooked into a backpack strap. His tattered leather duster sways, the bulging salvaged backpack bounces with dangling trinkets, and the amber lenses of his gas mask catch the light.",
        "Walk North Animation Frames": "The Wasteland Wanderer trudges North with a cautious hunched posture, the stop-sign spear gripped in his right hand at shoulder height and his left hand hooked into a backpack strap. His tattered leather duster sways, the bulging salvaged backpack bounces with dangling trinkets, and the amber lenses of his gas mask catch the light.",
        "Walk West Animation Frames": "The Wasteland Wanderer trudges West with a cautious hunched posture, the stop-sign spear gripped in his right hand at shoulder height and his left hand hooked into a backpack strap. His tattered leather duster sways, the bulging salvaged backpack bounces with dangling trinkets, and the amber lenses of his gas mask catch the light.",
        "Walk East Animation Frames": "The Wasteland Wanderer trudges East with a cautious hunched posture, the stop-sign spear gripped in his right hand at shoulder height and his left hand hooked into a backpack strap. His tattered leather duster sways, the bulging salvaged backpack bounces with dangling trinkets, and the amber lenses of his gas mask catch the light."
      },
    },
    {
      id: 'vault-dweller',
      name: "Vault Dweller",
      genre: "Post-Apocalyptic",
      description: "A young, clean-cut survivor freshly emerged from an underground vault. Short brown hair, wide blue eyes, and an expression of cautious wonder. Lean build in a fitted jumpsuit with an upright, slightly nervous posture.",
      equipment: "A bright blue jumpsuit with a yellow number '42' on the back, a chunky Pip-Boy wrist computer on the left arm with a green screen, a compact laser pistol holstered at the hip, and a small utility belt with pouches.",
      colorNotes: "Bright blue jumpsuit with yellow trim and number. Pip-Boy is dark grey-green with a glowing green screen. Laser pistol is chrome with a red energy cell. Utility belt is brown leather with brass buckles.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Vault Dweller stands facing the viewer in a slightly stiff, uncertain stance. His left arm is raised to check the Pip-Boy screen, which glows green with readouts. The blue jumpsuit is pristine and the laser pistol is holstered.
  Header "Idle Up" (2,1): Facing away, the yellow '42' on the blue jumpsuit is clear. His posture is upright but tense, hands at his sides with the Pip-Boy arm slightly raised. The utility belt hangs neatly.
  Header "Idle Left" (2,2): Facing left, the Vault Dweller taps at the Pip-Boy screen with his right hand. The green display casts a soft glow on his chin and the blue jumpsuit drapes cleanly on his lean frame.
  Header "Idle Right" (2,3): Facing right, hand resting near the holstered laser pistol. His wide blue eyes peer cautiously ahead and the yellow trim on the jumpsuit catches ambient light.
  Header "Battle Idle 1" (2,4): The Vault Dweller draws the chrome laser pistol in a two-handed grip, feet apart in a textbook shooting stance. The Pip-Boy screen switches to a targeting display and the red energy cell glows at the pistol's base.
  Header "Battle Idle 2" (2,5): He adjusts his aim nervously, the laser pistol wavering slightly in his grip. The Pip-Boy targeting display blinks with distance readings and his blue eyes narrow with determined focus.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Vault Dweller steadies the laser pistol with both hands, settling into a firmer stance. The Pip-Boy beeps with a target lock and the red energy cell hums. His expression hardens behind the sights.
  Header "Attack 1" (3,1): Wind-up — he squares his shoulders and sights down the laser pistol, the red energy cell brightening as it charges. The Pip-Boy arm supports the shooting hand and his blue eyes lock on the target.
  Header "Attack 2" (3,2): A bright red laser beam fires from the chrome pistol with a flash at the barrel. The recoil pushes his hands up slightly and the red beam streaks across the cell. The jumpsuit creases from the brace.
  Header "Attack 3" (3,3): Follow-through — the laser beam terminates at the cell edge in a small red impact flash. The pistol barrel vents heat and the Vault Dweller steadies himself for another shot, Pip-Boy recalibrating.
  Header "Cast 1" (3,4): The Vault Dweller raises his Pip-Boy arm and activates a special function, the green screen projecting a small holographic map. The laser pistol is holstered as he focuses on the device.
  Header "Cast 2" (3,5): The Pip-Boy projects a wider holographic field, a targeting grid expanding outward. The device whirs and clicks, the green screen blazing bright, and his wide eyes reflect the holographic data.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Pip-Boy activates a V.A.T.S.-like targeting burst — a brief pulse of green energy radiates outward from the device, highlighting weak points. Time seems to slow around him momentarily before normalizing.
  Header "Damage 1" (4,1): The Vault Dweller flinches from a hit, the laser pistol nearly slipping from his grip. A scorch mark appears on the blue jumpsuit sleeve and the Pip-Boy screen flickers with static.
  Header "Damage 2" (4,2): Stumbling backward, the jumpsuit tears at the shoulder revealing a white undershirt. The Pip-Boy sparks at a cracked hinge and a utility pouch spills its contents. His expression shows genuine fear.
  Header "Damage 3" (4,3): Recovery — the Vault Dweller steadies himself, checking the Pip-Boy which reboots with a green flash. He picks up the laser pistol and forces a brave expression, though his hands tremble.
  Header "KO 1" (4,4): The laser pistol drops from his limp fingers as his knees give out. The Pip-Boy screen displays a flatline readout and the bright blue jumpsuit is stained and torn. His eyes go wide with shock.
  Header "KO 2" (4,5): The Vault Dweller collapses forward, the Pip-Boy arm outstretched with a fading green screen. The chrome laser pistol slides away and the yellow '42' on his back is now scuffed and dirty.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Vault Dweller lies face-down on the ground, the Pip-Boy screen dark and the blue jumpsuit torn and dirtied. The laser pistol rests nearby and scattered utility belt contents surround him.
  Header "Victory 1" (5,1): The Vault Dweller holds the laser pistol up triumphantly, blowing imaginary smoke from the barrel. The Pip-Boy beeps a cheerful victory jingle and his wide blue eyes beam with surprised pride.
  Header "Victory 2" (5,2): He holsters the laser pistol with a spin and checks the Pip-Boy, which displays a smiley face and XP gained. His nervous expression is replaced by a confident grin and the jumpsuit is still clean.
  Header "Victory 3" (5,3): The Vault Dweller gives a thumbs-up with his Pip-Boy hand, the green screen showing a thumbs-up icon in return. He stands tall with an awkward but genuine confidence, blue jumpsuit gleaming.
  Header "Weak Pose" (5,4): The Vault Dweller hunches over with hands on knees, panting. The jumpsuit is torn and stained, the Pip-Boy screen flickers with warning readouts, and the laser pistol dangles loosely from one hand.
  Header "Critical Pose" (5,5): Barely standing, the Vault Dweller clutches the laser pistol with both hands. The Pip-Boy screen flashes red emergency warnings, the jumpsuit is in tatters, and his blue eyes are wide with terrified determination.`,
      groupGuidance: {
        "Walk South Animation Frames": "The Vault Dweller steps South with cautious upright posture, the chunky Pip-Boy on his left wrist glowing green and his right hand hovering near the chrome laser pistol holstered at his right hip. The bright blue jumpsuit is crisp with yellow trim and the utility belt pouches bounce with each careful stride.",
        "Walk North Animation Frames": "The Vault Dweller steps North with cautious upright posture, the chunky Pip-Boy on his left wrist glowing green and his right hand hovering near the chrome laser pistol holstered at his right hip. The bright blue jumpsuit is crisp with yellow trim and the utility belt pouches bounce with each careful stride.",
        "Walk West Animation Frames": "The Vault Dweller steps West with cautious upright posture, the chunky Pip-Boy on his left wrist glowing green and his right hand hovering near the chrome laser pistol holstered at his right hip. The bright blue jumpsuit is crisp with yellow trim and the utility belt pouches bounce with each careful stride.",
        "Walk East Animation Frames": "The Vault Dweller steps East with cautious upright posture, the chunky Pip-Boy on his left wrist glowing green and his right hand hovering near the chrome laser pistol holstered at his right hip. The bright blue jumpsuit is crisp with yellow trim and the utility belt pouches bounce with each careful stride."
      },
    },
    {
      id: 'raider-warlord',
      name: "Raider Warlord",
      genre: "Post-Apocalyptic",
      description: "A brutal scavenger leader with a shaved head sporting a tall crimson mohawk, heavy war paint across the eyes, and a scarred, muscular build. Aggressive forward-leaning stance radiating menace.",
      equipment: "Spiked shoulder armor welded from scrap metal and car parts, a heavy chain weapon ending in a spiked ball, bone-and-tooth trophies on a necklace, and crude war paint in red and black streaks.",
      colorNotes: "Bare scarred skin with red and black war paint. Crimson mohawk. Armor is rust red and gunmetal scrap metal with bone white trophy accents. Chain is dark iron and the spiked ball is pitted steel. Pants are torn black leather.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Warlord stands with legs apart facing the viewer, the chain weapon coiled in one fist. The spiked armor gleams dull rust red and his war-painted face glares with open hostility. The bone necklace hangs over his scarred chest.
  Header "Idle Up" (2,1): Facing away, the spiked shoulder armor and bare scarred back fill the view. The chain weapon hangs at his side and bone trophies are hooked to the back of his armor. The crimson mohawk is a bold ridge.
  Header "Idle Left" (2,2): Facing left, the Warlord rests the spiked ball on the ground with the chain taut in his fist. His profile shows the prominent mohawk, sharp war paint, and the menacing scrap armor silhouette.
  Header "Idle Right" (2,3): Facing right, he holds the chain loosely, letting the spiked ball swing lazily. His aggressive forward lean and scarred muscular arms are prominent beneath the rust red armor plates.
  Header "Battle Idle 1" (2,4): The Warlord begins swinging the chain weapon overhead in a wide arc, the spiked ball whirring. He drops into a wide combat stance and bares his teeth with a snarl. The war paint makes his eyes look like burning embers.
  Header "Battle Idle 2" (2,5): The chain swings faster, the spiked ball a blur above his head. He shifts his weight aggressively and the scrap armor clanks and sparks. His crimson mohawk whips in the self-made wind.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Warlord holds the whirring chain at peak speed, muscles straining beneath the scrap armor. His war-painted face is locked in a battle snarl and the spiked ball hums with lethal momentum.
  Header "Attack 1" (3,1): Wind-up — he pulls the chain back over his shoulder, the spiked ball swinging behind him. His body coils with raw power and the scrap armor groans under the tension. War paint glistens with sweat.
  Header "Attack 2" (3,2): The chain lashes forward — the spiked ball rockets outward in a savage overhead slam. His entire body follows the arc and the scrap armor sparks from the violent motion.
  Header "Attack 3" (3,3): Impact — the spiked ball crashes down at the cell edge with a burst of sparks and debris. The chain snaps taut and the Warlord is pulled forward by the momentum, boots skidding.
  Header "Cast 1" (3,4): The Warlord reaches to his belt and produces a crude frag grenade — a tin can packed with scrap metal and a fuse. He bites the pull ring with his teeth while holding the chain weapon in the other hand.
  Header "Cast 2" (3,5): The fuse sparks and sizzles as he holds the grenade overhead, the orange glow reflecting off his war paint and spiked armor. Scrap shrapnel is visible inside the crude casing.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Warlord hurls the frag grenade — it tumbles through the air and detonates at the cell edge in a small burst of fire and flying scrap metal shards. He shields himself with the spiked shoulder armor.
  Header "Damage 1" (4,1): The Warlord reels from a hit, a scrap armor plate cracking and flying off his shoulder. The chain weapon jerks in his grip and his mohawk flattens from the impact. War paint smears with blood.
  Header "Damage 2" (4,2): Staggering back, more armor plates buckle and fall. His scarred torso takes a visible wound and the bone necklace snaps, sending trophies scattering. The chain weapon drags on the ground.
  Header "Damage 3" (4,3): Recovery — the Warlord plants his feet and roars with rage, swinging the chain weapon back up. His remaining armor is battered but he forces himself upright, war paint streaked with blood and fury in his eyes.
  Header "KO 1" (4,4): The chain weapon slips from his weakening grip, the spiked ball thudding to the ground. His massive frame sways and the remaining scrap armor hangs loose. The mohawk droops and the war paint is smeared.
  Header "KO 2" (4,5): The Warlord crashes to his knees, then falls forward onto the broken scrap armor. The chain weapon lies coiled beside him and bone trophies scatter. His crimson mohawk is flattened against the ground.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Warlord lies face-down amid scattered scrap armor plates, broken bone trophies, and the tangled chain weapon. His crimson mohawk is matted and the war paint is unrecognizable. The spiked ball rests near his open hand.
  Header "Victory 1" (5,1): The Warlord raises the chain weapon overhead and roars, spiked ball swinging triumphantly. His war-painted face splits into a savage grin and he beats his scarred chest with his free fist. The mohawk bristles.
  Header "Victory 2" (5,2): He slams the spiked ball into the ground with a thunderous crash and stands over it, one boot on the chain. The scrap armor gleams with battle damage and he throws his head back in a primal howl.
  Header "Victory 3" (5,3): The Warlord coils the chain weapon around his arm and crosses his armored arms, glaring forward with contemptuous superiority. The bone necklace clicks and the crimson mohawk stands perfectly erect.
  Header "Weak Pose" (5,4): The Warlord hunches forward, chain weapon dragging on the ground. Half his scrap armor is gone, the war paint is faded with dried blood, and the mohawk wilts. He snarls through gritted teeth, refusing to fall.
  Header "Critical Pose" (5,5): Barely standing, the Warlord swings the chain weapon in weak, desperate arcs. His armor is destroyed, the bone necklace is gone, and his body is covered in wounds — but his war-painted eyes still burn with unbroken fury.`,
      groupGuidance: {
        "Walk South Animation Frames": "The Raider Warlord stomps South with aggressive forward-leaning menace, the heavy chain weapon gripped in his right fist with the spiked ball dragging the ground and his left fist clenched at his side. His crimson mohawk rises like a war banner above welded scrap-metal armor and his scarred muscular frame.",
        "Walk North Animation Frames": "The Raider Warlord stomps North with aggressive forward-leaning menace, the heavy chain weapon gripped in his right fist with the spiked ball dragging the ground and his left fist clenched at his side. His crimson mohawk rises like a war banner above welded scrap-metal armor and his scarred muscular frame.",
        "Walk West Animation Frames": "The Raider Warlord stomps West with aggressive forward-leaning menace, the heavy chain weapon gripped in his right fist with the spiked ball dragging the ground and his left fist clenched at his side. His crimson mohawk rises like a war banner above welded scrap-metal armor and his scarred muscular frame.",
        "Walk East Animation Frames": "The Raider Warlord stomps East with aggressive forward-leaning menace, the heavy chain weapon gripped in his right fist with the spiked ball dragging the ground and his left fist clenched at his side. His crimson mohawk rises like a war banner above welded scrap-metal armor and his scarred muscular frame."
      },
    },
    {
      id: 'mutant-enforcer',
      name: "Mutant Enforcer",
      genre: "Post-Apocalyptic",
      description: "An oversized irradiated brute standing a head taller than a normal human. Sickly green-tinged skin with purple bruising and visible radiation scars. Hunched, top-heavy build with massive arms and a small, angry head.",
      equipment: "A crude super sledge — an oversized sledgehammer with a car engine block as the head, torn remnants of pre-war clothing barely covering the torso, and heavy chains wrapped around the forearms as makeshift bracers.",
      colorNotes: "Sickly green skin with mottled purple bruising and grey radiation scars. Torn clothing is faded grey-blue. Super sledge head is dark steel with rust. Chain bracers are dark iron. Eyes are a dim, angry yellow.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Enforcer stands hunched facing the viewer, the super sledge resting on his shoulder with the engine-block head behind his back. His massive chain-wrapped arms hang forward and his small head peers out with dim yellow eyes. Green skin pulses faintly with radiation.
  Header "Idle Up" (2,1): Facing away, the enormous hunched back and massive shoulders fill the frame. The super sledge rests across the back of his neck like a yoke. Chain bracers dangle and the torn clothing barely covers his lower back.
  Header "Idle Left" (2,2): Facing left, the Enforcer rests both hands on top of the upright super sledge handle, the engine-block head on the ground. His hunched profile and small angry head create a looming silhouette. Radiation scars mark his visible arm.
  Header "Idle Right" (2,3): Facing right, the sledge hangs loosely in one massive hand. His top-heavy posture leans forward and the purple bruising on his green skin creates a sickly pattern. The chain bracers are prominent on his near arm.
  Header "Battle Idle 1" (2,4): The Enforcer hoists the super sledge with both hands, raising the car-engine head overhead. He drops into a wide aggressive stance and roars, revealing jagged, yellowed teeth. His green skin darkens with rage and the yellow eyes blaze.
  Header "Battle Idle 2" (2,5): He swings the super sledge in slow, menacing figure-eights, the engine-block head whooshing through the air. The chain bracers rattle and his massive frame shifts with surprising control for his size.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Enforcer holds the super sledge cocked behind his right shoulder, muscles bulging. His small head is lowered like a charging bull and the dim yellow eyes lock on the target with brute focus. Chains rattle on his tensed forearms.
  Header "Attack 1" (3,1): Wind-up — the Enforcer heaves the super sledge high overhead with both hands, the engine-block head at its peak. His green body stretches to full height, momentarily towering, and the torn clothing tears further from the strain.
  Header "Attack 2" (3,2): The super sledge crashes downward in a devastating overhead slam, the engine-block head a blur of dark steel and rust. The impact is enormous and his massive frame follows the arc with full commitment.
  Header "Attack 3" (3,3): Impact — the engine-block head hits the ground at the cell edge, sending a shockwave of cracks through the surface. Dust and debris erupt outward and the Enforcer is buried to the wrists in the crater. Chains spark against stone.
  Header "Cast 1" (3,4): The Enforcer's radiation scars begin to glow — a sickly green luminescence pulses beneath his skin. He drops the sledge and clutches his head as the radiation within him surges, purple bruises intensifying.
  Header "Cast 2" (3,5): His entire body radiates green light, the scars becoming bright veins of toxic energy. His yellow eyes blaze and a shockwave of radioactive air distorts the space around him. The chains on his arms heat and glow.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Enforcer releases a burst of radiation — a green shockwave erupts outward from his body, distorting the air. His skin cracks momentarily with the energy release before sealing. He collapses to one knee afterward, drained.
  Header "Damage 1" (4,1): The Enforcer is knocked back a step — a remarkable feat given his size. A chunk of green skin tears revealing raw purple tissue beneath. The super sledge dips but he holds on, growling.
  Header "Damage 2" (4,2): Staggering, a chain bracer snaps and falls from his wrist. More skin tears open showing the purple bruised tissue and his torn clothing disintegrates further. The sledge handle cracks under his stressed grip.
  Header "Damage 3" (4,3): Recovery — the Enforcer steadies himself with a ground-shaking stomp. He hoists the damaged super sledge and roars, the radiation scars pulsing with renewed dim green light. His yellow eyes refocus with animal determination.
  Header "KO 1" (4,4): The super sledge slips from his massive hands and thuds to the ground. The Enforcer sways, his green skin losing its glow, and the yellow eyes dim. His enormous frame lists to one side.
  Header "KO 2" (4,5): The Enforcer topples like a felled tree, crashing to the ground with earth-shaking impact. The super sledge lies beside him and the chain bracers splay outward. His green skin is pale and the radiation scars are dark.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Enforcer lies in a small crater from his own impact, the super sledge nearby and chain bracers spread around him. His sickly green skin is faded to grey-green and the yellow eyes are closed. The torn clothing is now just rags.
  Header "Victory 1" (5,1): The Enforcer lifts the super sledge overhead with one hand and pounds his chest with the other, roaring victoriously. The engine-block head catches light above him and his green skin blazes with renewed radiation glow.
  Header "Victory 2" (5,2): He slams the super sledge down and stands over it, flexing his massive arms. The chain bracers jingle and his small head throws back in a triumphant bellow. The radiation scars pulse a bright, healthy green.
  Header "Victory 3" (5,3): The Enforcer sits on the super sledge engine-block head as a throne, massive arms resting on his knees. His dim yellow eyes show a rare, dull satisfaction and the purple bruises have faded slightly.
  Header "Weak Pose" (5,4): The Enforcer leans heavily on the upright super sledge, his massive frame sagging. The green skin is pale and the radiation scars are dim. Chain bracers drag on the ground and his yellow eyes are half-closed, flickering.
  Header "Critical Pose" (5,5): Barely standing, the Enforcer clutches the super sledge handle with both trembling hands. His green skin is almost grey, the radiation scars are completely dark, and his massive body shakes. Only a faint angry glow in his yellow eyes remains.`,
      groupGuidance: {
        "Walk South Animation Frames": "The Mutant Enforcer lumbers South with ground-shaking footfalls, the massive engine-block super sledge dragging in his right hand and his left chain-bracer arm swinging at his side. His sickly green skin shows purple bruising and radiation scars across his top-heavy hunched frame.",
        "Walk North Animation Frames": "The Mutant Enforcer lumbers North with ground-shaking footfalls, the massive engine-block super sledge dragging in his right hand and his left chain-bracer arm swinging at his side. His sickly green skin shows purple bruising and radiation scars across his top-heavy hunched frame.",
        "Walk West Animation Frames": "The Mutant Enforcer lumbers West with ground-shaking footfalls, the massive engine-block super sledge dragging in his right hand and his left chain-bracer arm swinging at his side. His sickly green skin shows purple bruising and radiation scars across his top-heavy hunched frame.",
        "Walk East Animation Frames": "The Mutant Enforcer lumbers East with ground-shaking footfalls, the massive engine-block super sledge dragging in his right hand and his left chain-bracer arm swinging at his side. His sickly green skin shows purple bruising and radiation scars across his top-heavy hunched frame."
      },
    },
    {
      id: 'caravan-trader',
      name: "Caravan Trader",
      genre: "Post-Apocalyptic",
      description: "A pragmatic traveling merchant with a weathered face, a wide-brimmed cowboy hat, and shrewd hazel eyes. Medium build wrapped in practical layers and a pack harness distributing heavy trade goods across the body.",
      equipment: "A wide-brimmed leather cowboy hat, a heavy pack harness with goods strapped across chest and back, barter items dangling from hooks (bottles, ammo boxes, canned food), a worn revolver in a thigh holster, and a walking staff made from a twisted rebar rod.",
      colorNotes: "Tan wide-brimmed hat and outer layers. Brown leather harness and holster. Brass-colored buckles, bullet casings, and barter goods. Gunmetal revolver. Dark brown boots. Rebar staff is rust-grey.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Trader stands with the rebar staff planted beside him, one hand resting on a dangling ammo box. His wide-brimmed hat tilts back showing his weathered face and hazel eyes. The pack harness hangs heavily but comfortably. The revolver is holstered.
  Header "Idle Up" (2,1): Facing away, the full pack harness load is visible — bottles, cans, ammo, and various barter goods strapped in organized chaos. The leather straps and brass buckles hold everything secure. The hat brim is visible at the top.
  Header "Idle Left" (2,2): Facing left, the Trader adjusts a strap on the harness with one hand, rebar staff tucked under his arm. His shrewd expression shows he is calculating something. Trade goods dangle from his near side.
  Header "Idle Right" (2,3): Facing right, he rests both hands on top of the rebar staff planted before him. The hat shades his profile and the revolver holster and barter goods create a distinctive merchant outline.
  Header "Battle Idle 1" (2,4): The Trader drops the rebar staff and draws the worn revolver from the thigh holster in a practiced quick-draw. He crouches behind the pack harness goods using them as improvised cover. Hazel eyes are sharp above the revolver sights.
  Header "Battle Idle 2" (2,5): He shifts behind the hanging pack goods, revolver tracking a target. The bottles and cans sway as he moves and the brass bullet casings on the harness clink. His weathered face is calm and calculating.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Trader holds steady with the revolver, one eye closed for aim. The wide-brimmed hat shadows his face and the pack harness goods shift as he breathes. His thigh holster hangs empty and his trigger finger is steady.
  Header "Attack 1" (3,1): Wind-up — the Trader thumbs back the revolver hammer with a click, sighting down the barrel. His hazel eyes narrow and the hat brim dips with his focused lean forward. The pack goods go still.
  Header "Attack 2" (3,2): The revolver fires — a small muzzle flash erupts from the barrel and the Trader's arm recoils upward. Smoke trails from the chamber and the barter goods rattle from the concussive blast.
  Header "Attack 3" (3,3): Follow-through — the bullet streaks to the cell edge as spent powder smoke drifts. The Trader steadies the revolver for another shot and an empty brass casing arcs through the air from the chamber.
  Header "Cast 1" (3,4): The Trader reaches into the pack harness and produces a bundle of dynamite sticks — salvaged mining explosives tied together with a long fuse. He bites a match head and strikes it on his hat brim.
  Header "Cast 2" (3,5): The fuse sizzles and sparks, casting orange light on the Trader's weathered face beneath the hat. The dynamite bundle crackles and he winds up for the throw, pack goods swaying from the motion.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Trader hurls the dynamite bundle — it tumbles end over end, fuse burning, and detonates at the cell edge in a thundering explosion of dust and fire. He ducks behind the pack harness from the blast wave.
  Header "Damage 1" (4,1): The Trader stumbles from a hit, barter goods flying from the harness. A bottle shatters and an ammo box spills open. The revolver wavers and the hat tilts askew. His hazel eyes show surprise.
  Header "Damage 2" (4,2): Staggering further, the pack harness snaps a strap and goods cascade — cans, bottles, and brass casings scatter. The hat flies off revealing thinning grey-brown hair. The revolver dips in his weakening grip.
  Header "Damage 3" (4,3): Recovery — the Trader catches his hat and jams it back on. He kicks a few scattered goods aside, steadies the revolver, and adjusts the damaged harness with one hand. His expression shifts from surprise to hardened resolve.
  Header "KO 1" (4,4): The revolver drops from his limp hand as the Trader's knees buckle. The pack harness tears free and goods spill everywhere — a cascade of bottles, cans, and ammo boxes. The hat falls over his eyes.
  Header "KO 2" (4,5): The Trader collapses amid his scattered merchandise, the rebar staff rolling away. Barter goods surround him like a halo of commerce — bottles, cans, ammo, and brass buckles. The hat lies beside his weathered face.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Trader lies among his scattered goods — bottles, canned food, ammo boxes, and brass casings spread around him. The revolver rests in his open palm, the hat covers his face, and the broken pack harness is draped across his legs.
  Header "Victory 1" (5,1): The Trader spins the revolver and holsters it with a practiced flourish. He tips the wide-brimmed hat with a satisfied smirk and adjusts the pack harness, which still holds most of its goods. Business is good.
  Header "Victory 2" (5,2): He plants the rebar staff and leans on it with casual confidence, one hand tipping the hat. The barter goods jingle merrily and his shrewd hazel eyes survey the spoils. A small grin creases his weathered face.
  Header "Victory 3" (5,3): The Trader pulls a bottle from the harness and uncorks it, raising it in a toast to himself. The revolver is holstered, the hat tilted back, and the remaining barter goods dangle with the satisfaction of a deal well done.
  Header "Weak Pose" (5,4): The Trader leans on the rebar staff, the pack harness half-empty and hanging by one strap. The hat droops and the revolver dangles loosely from one hand. Most of his barter goods are lost and his hazel eyes are weary.
  Header "Critical Pose" (5,5): Barely standing amid his scattered goods, the Trader clutches the revolver with his last round. The hat is torn, the harness is destroyed, and he stands guard over what remains of his trade goods with desperate, calculating eyes.`,
      groupGuidance: {
        "Walk South Animation Frames": "The Caravan Trader trudges South with his rebar staff planted in his right hand in time with each step, the worn revolver holstered at his right thigh. Barter goods jingle on the pack harness — bottles, ammo boxes, and brass casings clattering softly — and the wide-brimmed leather hat shades his weathered face.",
        "Walk North Animation Frames": "The Caravan Trader trudges North with his rebar staff planted in his right hand in time with each step, the worn revolver holstered at his right thigh. Barter goods jingle on the pack harness — bottles, ammo boxes, and brass casings clattering softly — and the wide-brimmed leather hat shades his weathered face.",
        "Walk West Animation Frames": "The Caravan Trader trudges West with his rebar staff planted in his right hand in time with each step, the worn revolver holstered at his right thigh. Barter goods jingle on the pack harness — bottles, ammo boxes, and brass casings clattering softly — and the wide-brimmed leather hat shades his weathered face.",
        "Walk East Animation Frames": "The Caravan Trader trudges East with his rebar staff planted in his right hand in time with each step, the worn revolver holstered at his right thigh. Barter goods jingle on the pack harness — bottles, ammo boxes, and brass casings clattering softly — and the wide-brimmed leather hat shades his weathered face."
      },
    },
    {
      id: 'power-armor-knight',
      name: "Power Armor Knight",
      genre: "Post-Apocalyptic",
      description: "A towering figure encased head-to-toe in pre-war powered combat armor. The suit is bulky and angular with a T-shaped visor slit glowing amber on a bucket-shaped helmet. Broad-shouldered, heavy, and imposing with hydraulic joints at the elbows and knees. Moves with deliberate, ground-shaking weight.",
      equipment: "Full suit of olive-drab T-51b power armor with scratched steel plating and faded military stencils, a shoulder-mounted lamp on the left pauldron, a heavy gatling laser with six rotating barrels held in both hands, and a fusion core glowing blue-white in the back-mounted power pack.",
      colorNotes: "Olive-drab steel armor plating with scratched gunmetal edges and faded white military stencils. Amber-glowing T-shaped visor. Fusion core is blue-white. Gatling laser barrels are dark chrome with red heat vents. Hydraulic pistons are brass-colored. Shoulder lamp is yellow when active.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Knight stands facing the viewer in a wide, planted stance, gatling laser held vertically with the barrels pointing up and the stock resting on the ground. The amber visor glows steadily and the shoulder lamp is off. Hydraulic joints hiss softly at rest. The fusion core pulses a calm blue-white.
  Header "Idle Up" (2,1): Facing away at rest, the gatling laser is mag-locked to the back alongside the fusion core housing. The olive-drab plating shows extensive battle scarring across the shoulders and back. Exhaust vents idle with faint heat shimmer and the helmet rear has cooling fins.
  Header "Idle Left" (2,2): Facing left, the Knight rests the gatling laser on one armored hip, the barrel tips angled down. The bucket helmet's T-visor is visible in profile, amber glow steady. The shoulder lamp housing and pauldron scratches are prominent.
  Header "Idle Right" (2,3): Facing right, the gatling laser is cradled in both arms across the chest. The fusion core's blue-white glow illuminates the near side of the armor and the brass hydraulic pistons at the elbow reflect it. The T-visor scans slowly.
  Header "Battle Idle 1" (2,4): The Knight brings the gatling laser to bear — both armored hands grip the weapon, the six barrels leveled forward. The shoulder lamp flicks on, casting a harsh yellow cone. The T-shaped visor brightens to a fierce amber and hydraulic actuators lock the arms steady. The fusion core ramps up, glowing brighter.
  Header "Battle Idle 2" (2,5): The gatling barrels begin to spin with a mechanical whine, not yet firing. The Knight shifts weight into a braced firing stance — one foot forward, torso angled. Red heat vents along the barrel housing begin to glow and the shoulder lamp beam cuts through dust particles.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The barrels spin at full speed, a blur of dark chrome. The Knight is locked in firing position, every hydraulic joint braced. The amber visor narrows to targeting mode — a faint crosshair pattern visible within the glow. The fusion core blazes blue-white and the shoulder lamp beam is a solid yellow bar.
  Header "Attack 1" (3,1): Wind-up — the gatling barrels reach maximum spin and the red heat vents flare bright. The Knight's armored frame plants and locks, servos whining under the bracing force. The fusion core surges energy into the weapon housing.
  Header "Attack 2" (3,2): The gatling laser fires — a torrent of red laser beams erupts from the spinning barrels in a devastating stream. Each barrel fires in sequence creating a near-continuous beam of destruction. The recoil pushes the entire armored frame back slightly despite its weight. Muzzle flash illuminates the olive-drab plating in red.
  Header "Attack 3" (3,3): Sustained fire — the laser stream rakes across the cell edge, red beams cutting through the air. The barrel housing glows cherry-red from heat and the shoulder lamp beam is lost in the laser glare. Spent heat radiates from every vent on the weapon and armor.
  Header "Cast 1" (3,4): The Knight reaches to the back-mounted power pack and pulls a secondary fusion core — a smaller blue-white cylinder. The gatling laser is held one-handed (the armor's strength makes this possible) while the other hand primes the core, which crackles with building energy.
  Header "Cast 2" (3,5): The primed fusion core blazes with intense blue-white light, arcs of energy jumping between the Knight's armored fingers. The T-shaped visor reflects the nuclear glow and the main fusion core in the back pack resonates in sympathy, pulsing brighter.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Knight hurls the overloaded fusion core — it tumbles through the air trailing blue-white energy arcs and detonates at the cell edge in a blinding nuclear flash. A miniature mushroom cloud erupts and the Knight raises one armored arm to shield the visor from the blast wave.
  Header "Damage 1" (4,1): The Knight staggers from a heavy hit — an armor plate on the left pauldron cracks and the shoulder lamp shatters, sparking. The gatling laser dips and hydraulic fluid sprays from a ruptured line at the elbow. The amber visor flickers.
  Header "Damage 2" (4,2): A second impact buckles the chest plate inward, exposing wiring and hydraulic lines beneath. The fusion core's housing cracks and the blue-white glow flickers erratically. Olive-drab plating falls away in chunks and the gatling laser's barrel housing is dented.
  Header "Damage 3" (4,3): Recovery — hydraulic systems compensate with a loud hiss, forcing the Knight upright. Emergency seals clamp over the cracked fusion core housing and the amber visor stabilizes. The Knight racks the gatling laser back to firing position with damaged but functional arms.
  Header "KO 1" (4,4): Systems failing — the gatling laser drops from powerless arms and clangs to the ground. The fusion core sputters and dies, its blue-white glow extinguishing. The amber visor dims to a faint flicker and hydraulic joints lock at random angles. The Knight sways, a dying machine.
  Header "KO 2" (4,5): The Knight topples forward with an earth-shaking crash, face-down in the dirt. Armor plates scatter on impact and the dead fusion core rolls free of its cracked housing. The gatling laser lies beside the fallen titan and the visor goes completely dark.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Knight lies face-down in a crater of cracked earth, the power armor split open in places showing the empty interior. The dead fusion core sits nearby, dark and inert. The gatling laser is half-buried beside the armored hull. The T-shaped visor is black and lifeless.
  Header "Victory 1" (5,1): The Knight raises the gatling laser overhead with one hand — a feat only power armor makes possible. The amber visor blazes bright and the fusion core surges with triumphant blue-white energy. The shoulder lamp sweeps the area and hydraulic pistons pump with a mechanical victory flex.
  Header "Victory 2" (5,2): The Knight plants the gatling laser barrel-down like a flag pole and stands beside it, one armored boot on a chunk of rubble. The T-visor glows steady amber and the fusion core hums contentedly. Faded military stencils and fresh battle scars tell the story.
  Header "Victory 3" (5,3): The Knight crosses armored arms over the chest plate, gatling laser mag-locked to the back. The amber visor dims to a calm glow and the shoulder lamp clicks off. The imposing silhouette stands at ease — a steel monument on the battlefield.
  Header "Weak Pose" (5,4): The Knight stands with one leg's hydraulics failing, leaning heavily to one side. The gatling laser drags on the ground in a weakening grip. Armor plates are cracked and hanging loose, the fusion core flickers between blue-white and dark, and the amber visor pulses in time with failing power reserves.
  Header "Critical Pose" (5,5): Barely standing, every hydraulic joint sparking and grinding. The gatling laser is braced against the ground as a crutch, barrels bent from impact. The fusion core is exposed and critical — flashing red through the cracked housing. The amber visor is a dying ember behind a shattered helmet plate, but the Knight still faces the enemy.`,
      groupGuidance: {
        "Walk South Animation Frames": "The Power Armor Knight stomps South with ground-cracking footfalls, the gatling laser held ready in both armored hands with its six barrels angled upward. Hydraulic knee pistons hiss with each step, the back-mounted fusion core glows blue-white, and the T-shaped amber visor cuts through dust beneath the bucket helmet.",
        "Walk North Animation Frames": "The Power Armor Knight stomps North with ground-cracking footfalls, the gatling laser held ready in both armored hands with its six barrels angled upward. Hydraulic knee pistons hiss with each step, the back-mounted fusion core glows blue-white, and the T-shaped amber visor cuts through dust beneath the bucket helmet.",
        "Walk West Animation Frames": "The Power Armor Knight stomps West with ground-cracking footfalls, the gatling laser held ready in both armored hands with its six barrels angled upward. Hydraulic knee pistons hiss with each step, the back-mounted fusion core glows blue-white, and the T-shaped amber visor cuts through dust beneath the bucket helmet.",
        "Walk East Animation Frames": "The Power Armor Knight stomps East with ground-cracking footfalls, the gatling laser held ready in both armored hands with its six barrels angled upward. Hydraulic knee pistons hiss with each step, the back-mounted fusion core glows blue-white, and the T-shaped amber visor cuts through dust beneath the bucket helmet."
      },
    },
    {
      id: 'xenomorph-drone',
      name: "Xenomorph Drone",
      genre: "Sci-Fi Horror",
      description: "A sleek, biomechanical predator with an elongated smooth skull, no visible eyes, and a lipless mouth hiding a deadly inner jaw. Tall, gaunt frame with a segmented exoskeleton, digitigrade legs, and a long segmented tail ending in a blade tip.",
      equipment: "Natural weapons only — razor-sharp claws, a bladed tail tip, dorsal tubes running along the back, and a telescoping inner mouth with silver teeth. No artificial equipment.",
      colorNotes: "Obsidian black exoskeleton with dark blue reflective highlights on curved surfaces. Silver metallic teeth on both outer and inner jaws. Dorsal tubes are dark steel grey. Saliva is translucent silver. Tail blade is polished dark steel.",
      rowGuidance: `
Xenomorph Drone is a tall, gaunt bipedal predator with digitigrade legs, a long segmented tail ending in a blade tip, and clawed hands — not human proportions. Its elongated smooth skull has no visible eyes. A lipless mouth hides a telescoping inner jaw with silver teeth. Dorsal tubes run along the back.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Drone crouches facing the viewer, the elongated skull tilted as if sensing the air. The lipless mouth is closed with silver teeth barely visible. The tail coils loosely behind and the clawed hands rest on the ground in a spider-like stance. Dorsal tubes rise above the shoulders.
  Header "Idle Up" (2,1): Crouched facing away, the dorsal tubes and segmented spine dominate the view. The tail curls to one side with the blade tip resting on the ground. The elongated skull is barely visible above the hunched shoulders.
  Header "Idle Left" (2,2): Facing left in a low crouch, the elongated skull extends horizontally. One clawed hand rests on the ground and the tail coils behind. The dark blue highlights on the obsidian exoskeleton catch ambient light.
  Header "Idle Right" (2,3): Facing right, crouched and still. The biomechanical ribbing of the torso is visible and the silver teeth are barely parted. The tail blade rests on the ground and translucent saliva hangs from the jaw.
  Header "Battle Idle 1" (2,4): The Drone rises to full height — towering and gaunt, the elongated skull tilting back. The inner jaw telescopes outward briefly in a threat display, silver teeth gleaming. The tail arches overhead like a scorpion and the claws spread wide.
  Header "Battle Idle 2" (2,5): It sways in the aggressive stance, the inner jaw retracting. The tail blade circles menacingly overhead and the dorsal tubes pulse with subtle movement. The dark blue highlights intensify across the black exoskeleton.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Drone holds its full-height aggressive stance, the tail poised overhead. The elongated skull tilts forward as if locking onto prey and the clawed hands open and close with anticipation. Silver teeth drip with translucent saliva.
  Header "Attack 1" (3,1): Wind-up — the Drone coils its gaunt body, pulling both clawed hands back and arching the tail high. The inner jaw begins extending from the lipless mouth and the dorsal tubes flatten against the spine.
  Header "Attack 2" (3,2): The Drone lunges forward with both claws slashing in a rapid double-strike, the inner jaw shooting outward at maximum extension. The obsidian body is a blur of dark blue streaks and the tail lashes forward simultaneously.
  Header "Attack 3" (3,3): Follow-through — the claws are fully extended from the dual slash and the inner jaw snaps at the cell edge, silver teeth biting. The tail blade stabs forward past the body. Translucent saliva sprays from the extended inner mouth.
  Header "Cast 1" (3,4): The Drone drops to all fours and raises the tail high, the blade tip vibrating. A small bead of acid-green substance forms at the tip of the inner jaw as it opens wide. The dorsal tubes flare outward.
  Header "Cast 2" (3,5): The acid builds — a viscous green glob grows at the inner jaw tip, dripping and sizzling. The Drone's body tenses and the tail arches forward, poised to catapult the acid. The exoskeleton steams where acid touches it.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Drone spits the acid glob forward — a compact blob of sizzling green that arcs to the cell edge and splatters, dissolving the surface with steaming hisses. The inner jaw retracts and the tail lowers after the release.
  Header "Damage 1" (4,1): The Drone recoils from a hit, the obsidian exoskeleton cracking at the impact point revealing dark blue inner tissue. Acid-green blood spurts from the wound, sizzling on the ground. The tail lashes in pain.
  Header "Damage 2" (4,2): Staggering, more cracks spider-web across the exoskeleton plates. Acid blood flows freely, burning anything it touches. The elongated skull shakes violently and the inner jaw extends in an involuntary pain response.
  Header "Damage 3" (4,3): Recovery — the Drone steadies on all fours, acid blood still dripping and sizzling. The cracked exoskeleton plates resettle and the inner jaw retracts. The tail blade rises again and the creature hisses through silver teeth.
  Header "KO 1" (4,4): The Drone collapses to its knees, the elongated skull drooping forward. Acid blood pools around the cracked exoskeleton, dissolving the ground. The tail goes limp and the clawed hands splay on the ground.
  Header "KO 2" (4,5): Falling onto its side, the Drone's exoskeleton shatters further, releasing more acid blood. The inner jaw hangs slack and the dorsal tubes lie flat. The obsidian body loses its dark blue highlights.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Drone lies motionless in a pool of sizzling acid blood, the obsidian exoskeleton cracked and dull. The elongated skull rests on the ground, inner jaw partially extended, and the tail blade lies flat. The acid slowly dissolves the surrounding surface.
  Header "Victory 1" (5,1): The Drone rises to full height and throws the elongated skull back, the inner jaw extending in a triumphant silent scream. Acid saliva sprays from the silver teeth and the tail lashes violently. The obsidian body gleams with dark blue highlights.
  Header "Victory 2" (5,2): It slams the tail blade into the ground and spreads the clawed hands wide, the dorsal tubes flaring. The inner jaw snaps in and out rapidly in a display of dominance. The exoskeleton ripples with predatory energy.
  Header "Victory 3" (5,3): The Drone drops to a low, satisfied crouch, the tail coiling around its body. The elongated skull tilts and the lipless mouth closes over the silver teeth. It is still and watchful — the perfect predator at rest.
  Header "Weak Pose" (5,4): The Drone crouches low, exoskeleton cracked and leaking acid blood. The tail drags limply and the claws barely grip the ground. The elongated skull hangs and the inner jaw extends weakly, silver teeth barely visible.
  Header "Critical Pose" (5,5): Barely alive, the Drone lies on its side with cracked, dull exoskeleton and acid blood pooling. The tail blade twitches and the inner jaw extends one last time in a feeble threat. Even dying, the creature remains terrifying.`,
      groupGuidance: {
        "Walk South Animation Frames": "The Xenomorph Drone stalks South in a silent low predatory stride, its digitigrade legs flexing and the elongated smooth skull tilted forward. The segmented bladed tail curves behind for balance and the obsidian exoskeleton catches dark blue highlights as translucent saliva drips from its jaw.",
        "Walk North Animation Frames": "The Xenomorph Drone stalks North in a silent low predatory stride, its digitigrade legs flexing and the elongated smooth skull tilted forward. The segmented bladed tail curves behind for balance and the obsidian exoskeleton catches dark blue highlights as translucent saliva drips from its jaw.",
        "Walk West Animation Frames": "The Xenomorph Drone stalks West in a silent low predatory stride, its digitigrade legs flexing and the elongated smooth skull tilted forward. The segmented bladed tail curves behind for balance and the obsidian exoskeleton catches dark blue highlights as translucent saliva drips from its jaw.",
        "Walk East Animation Frames": "The Xenomorph Drone stalks East in a silent low predatory stride, its digitigrade legs flexing and the elongated smooth skull tilted forward. The segmented bladed tail curves behind for balance and the obsidian exoskeleton catches dark blue highlights as translucent saliva drips from its jaw."
      },
    },
    {
      id: 'xenomorph-warrior',
      name: "Xenomorph Warrior",
      genre: "Sci-Fi Horror",
      description: "A larger, more heavily armored variant with a distinctive ridged head crest rising from the skull. Broader, more muscular build with thicker chitinous armor plates across the chest and limbs. More aggressive, upright stance than the drone.",
      equipment: "Natural weapons — larger, heavier claws, a thicker armored tail with a wider blade tip, reinforced chitinous chest plates, and a more powerful inner jaw. No artificial equipment.",
      colorNotes: "Primary black exoskeleton with dark brown undertones in the chitin plates. Head crest is glossy black with brown ridges. Acid-green blood visible at joints. Teeth are bone-white. Chest plates have a dark brown, almost woody texture.",
      rowGuidance: `
Xenomorph Warrior is a larger, broader bipedal predator with a distinctive ridged head crest, digitigrade legs, thicker chitinous armor plates, and a heavy armored tail with a wide blade tip. Massive clawed hands, no visible eyes, and a powerful inner jaw. More upright and muscular than the Drone variant.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Warrior stands nearly upright facing the viewer, the ridged head crest towering above. The chitinous chest plates are displayed prominently and the larger claws hang at its sides. The armored tail coils on the ground and bone-white teeth gleam in a closed-mouth expression.
  Header "Idle Up" (2,1): Facing away, the massive back and head crest fill the view. The armored tail lies in a heavy curve and the dark brown chitin plates overlap down the spine. The broader frame is noticeably bulkier than a drone.
  Header "Idle Left" (2,2): Facing left in an upright stance, the head crest extends far forward. One massive clawed hand rests at its side and the tail blade rests on the ground. The dark brown chitin plate texture is visible on the near flank.
  Header "Idle Right" (2,3): Facing right, standing tall with the head crest prominent. The chitinous chest plates and bone-white teeth create an armored, predatory profile. Acid-green blood traces at the joints mark its alien biology.
  Header "Battle Idle 1" (2,4): The Warrior drops into a wider, more aggressive stance than a drone, both massive claws raised and spread. The head crest tilts forward and the inner jaw extends partially, bone-white teeth bared in both jaws. The armored tail rises with the wide blade poised.
  Header "Battle Idle 2" (2,5): It shifts in the combat stance, the heavier frame moving with surprising speed. The chitinous chest plates expand with deep breathing and the head crest ridges seem to bristle. The tail blade circles in a wider, deadlier arc.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Warrior holds the aggressive stance, the inner jaw retracting as it coils for a strike. The head crest angles downward like a charging bull and the massive claws open wide. The armored tail is raised to maximum height.
  Header "Attack 1" (3,1): Wind-up — the Warrior pulls back its right arm, the massive claw clenched. The chitinous chest plates shift to allow the rotation and the head crest tilts with the torso. The tail arches for a secondary strike.
  Header "Attack 2" (3,2): A devastating claw swipe — the massive right claw rakes forward, tearing through the air. The head crest leads the body rotation and the inner jaw snaps outward simultaneously. The tail lashes from behind.
  Header "Attack 3" (3,3): Follow-through — the claw strike reaches maximum extension while the tail blade stabs forward from behind, creating a dual attack. The Warrior's body is fully rotated and the inner jaw is at full extension, bone-white teeth snapping.
  Header "Cast 1" (3,4): The Warrior rears back, the chitinous chest plates expanding as it inhales deeply. Acid-green fluid builds visibly behind the bone-white teeth, bubbling and sizzling. The head crest tilts back and the tail braces on the ground.
  Header "Cast 2" (3,5): The acid builds to a critical mass — the Warrior's throat bulges with the pressurized acid-green fluid. The chitin plates vibrate and the head crest ridges flatten. It aims the elongated skull forward like a cannon barrel.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Warrior launches a pressurized spray of acid-green blood from its mouth — a wide cone of sizzling fluid that fans out to the cell edge, dissolving everything it contacts. The recoil rocks its massive body backward and the head crest shakes.
  Header "Damage 1" (4,1): The Warrior staggers from a hit, a chitinous chest plate cracking and falling away. Acid-green blood spurts from the exposed area, sizzling on the ground. The head crest sways and the tail lashes in rage.
  Header "Damage 2" (4,2): More chitin plates shatter, exposing the dark brown inner tissue. Acid blood flows freely, creating a hazardous pool. The inner jaw extends in a pained screech and the massive claws clutch at the wounds.
  Header "Damage 3" (4,3): Recovery — the Warrior roars and slams both claws on the ground, forcing itself upright. Broken chitin plates hang loose and acid blood still drips, but the head crest rises defiantly. The tail blade rises again.
  Header "KO 1" (4,4): The Warrior's legs buckle under its massive frame. The head crest droops and the chitinous armor hangs in shattered pieces. Acid-green blood pools widely, dissolving the ground. The tail blade scrapes along the surface.
  Header "KO 2" (4,5): Crashing to the ground, the Warrior's armored body creates a heavy impact. The head crest cracks against the surface and acid blood seeps from multiple wounds. The massive claws splay outward and the tail goes still.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Warrior lies in a wide pool of sizzling acid-green blood, its shattered chitin plates scattered around the body. The head crest is cracked and the bone-white teeth are visible in the slack jaw. The armored tail lies flat and the claws are open and still.
  Header "Victory 1" (5,1): The Warrior rears to full height and roars, the inner jaw extending in a triumphant shriek. The head crest towers above and the massive claws spread wide. Acid-green blood drips from the bone-white teeth and the tail blade stabs the air.
  Header "Victory 2" (5,2): It slams both clawed fists on the ground in a display of dominance, the chitinous chest plates expanding. The head crest dips and rises in a predatory nod and the tail lashes in a wide, aggressive sweep.
  Header "Victory 3" (5,3): The Warrior stands tall and crosses its massive clawed arms over the chitinous chest plates. The head crest tilts with an almost regal bearing and the tail coils around its feet. Even in stillness, it radiates lethal power.
  Header "Weak Pose" (5,4): The Warrior hunches forward, broken chitin plates hanging loose. Acid blood drips steadily and the head crest droops. The massive claws grip the ground for support and the tail drags limply. The inner jaw hangs partially extended.
  Header "Critical Pose" (5,5): Barely standing, the Warrior sways with most of its chitin armor destroyed. Acid-green blood pools around its feet. The head crest is cracked but still raised and the bone-white teeth are bared in a final, defiant snarl.`,
      groupGuidance: {
        "Walk South Animation Frames": "The Xenomorph Warrior advances South with a heavier, more deliberate stride than a Drone, the ridged head crest rising above broader shoulders. Thick dark-brown chitinous chest plates overlap with each step and the wider armored tail swings behind while acid-green blood traces the joint seams.",
        "Walk North Animation Frames": "The Xenomorph Warrior advances North with a heavier, more deliberate stride than a Drone, the ridged head crest rising above broader shoulders. Thick dark-brown chitinous chest plates overlap with each step and the wider armored tail swings behind while acid-green blood traces the joint seams.",
        "Walk West Animation Frames": "The Xenomorph Warrior advances West with a heavier, more deliberate stride than a Drone, the ridged head crest rising above broader shoulders. Thick dark-brown chitinous chest plates overlap with each step and the wider armored tail swings behind while acid-green blood traces the joint seams.",
        "Walk East Animation Frames": "The Xenomorph Warrior advances East with a heavier, more deliberate stride than a Drone, the ridged head crest rising above broader shoulders. Thick dark-brown chitinous chest plates overlap with each step and the wider armored tail swings behind while acid-green blood traces the joint seams."
      },
    },
    {
      id: 'facehugger-swarm',
      name: "Facehugger Swarm",
      genre: "Sci-Fi Horror",
      description: "A group of 3-4 spider-like parasitic creatures moving as a unit. Each has a pale, fleshy body with long gripping finger-legs, a muscular whip-like tail, and a ventral proboscis. They scuttle and leap in unsettling coordinated motion.",
      equipment: "Natural weapons only — gripping finger-legs for latching, a muscular tail for constriction, and a ventral proboscis for implantation. No artificial equipment.",
      colorNotes: "Pale flesh bodies with pink-grey undersides. Finger-legs are slightly darker flesh tone with visible tendons. Tails are pink-grey and muscular. Ventral side has translucent membranes revealing pulsing internals. Overall wet, organic appearance.",
      rowGuidance: `
Facehugger Swarm is a group of 3-4 spider-like parasites — each has eight long gripping finger-legs, a muscular whip-like tail, and a ventral proboscis. No arms, no standard head, no bipedal movement. They scuttle as a coordinated unit with pale fleshy bodies low to the ground.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The swarm rests in a loose cluster facing the viewer, finger-legs slowly flexing in place. The lead facehugger raises its front legs periodically as if sensing. Pink-grey undersides are visible and the muscular tails lie in lazy coils. The pale flesh rises and falls with breathing.
  Header "Idle Up" (2,1): Resting in a cluster facing away, the smooth flesh domes of the facehugger bodies are visible. Finger-legs splay outward and tails intertwine. The pale bodies pulse gently with internal movement.
  Header "Idle Left" (2,2): The swarm rests facing left, two creatures on the ground and one perched atop them. Finger-legs grip each other and the ground. The side view shows the layered fleshy bodies and trailing tails.
  Header "Idle Right" (2,3): Facing right in a resting cluster, the finger-legs slowly open and close. The translucent ventral membranes pulse and the muscular tails curl and uncurl with idle motion. The wet surface of the bodies glistens.
  Header "Battle Idle 1" (2,4): The swarm springs to alertness — all three facehuggers raise their front finger-legs high and the tails whip upright. They spread into an attack formation, each creature slightly separated and oriented toward the threat. The ventral proboscises extend partially.
  Header "Battle Idle 2" (2,5): The swarm shifts in the attack formation, creatures circling each other in a disturbing dance. Finger-legs flex rapidly and the muscular tails vibrate with tension. The translucent membranes reveal quickened internal pulsing.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The swarm holds the attack formation, three sets of finger-legs spread wide and ready. The lead facehugger's ventral proboscis is fully extended and the muscular tails coil tight like springs. The pale flesh darkens slightly with arousal.
  Header "Attack 1" (3,1): Wind-up — the lead facehugger coils its finger-legs beneath its body and the tail whips backward, preparing to leap. The other two creatures press flat to the ground, clearing a launch path. The pale body compresses like a spring.
  Header "Attack 2" (3,2): The lead facehugger launches into a leaping attack, finger-legs spread wide and reaching forward. The ventral proboscis extends fully and the tail streams behind. The other two creatures rush forward on the ground in support.
  Header "Attack 3" (3,3): The lead facehugger latches on at the cell edge — finger-legs wrapping tight around an invisible target while the tail constricts. The two ground facehuggers attack the base, finger-legs gripping and tails whipping. The swarm strikes as one.
  Header "Cast 1" (3,4): The swarm clusters tightly together, finger-legs interlocking into a single mass. The bodies press together and the tails wrap around the group, forming a pulsing organic orb. The translucent membranes glow with combined internal energy.
  Header "Cast 2" (3,5): The orb of intertwined facehuggers pulses faster, the pale flesh darkening to pink as blood rushes through the combined mass. The finger-legs vibrate at the surface and a high-frequency tremor makes the ground around them ripple.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The swarm explodes outward — all three facehuggers launch in different directions simultaneously, each trailing a spray of pink-grey fluid. They arc to the cell edges in a burst of gripping finger-legs and whipping tails, covering maximum area.
  Header "Damage 1" (4,1): A hit scatters the swarm — one facehugger is knocked tumbling, its finger-legs curling protectively. The other two scatter sideways, tails lashing. The struck creature oozes pink fluid from a wound on its pale flesh.
  Header "Damage 2" (4,2): The swarm regroups in disarray — one creature drags a damaged leg and another has a torn translucent membrane leaking fluid. They cluster defensively, finger-legs interweaving for protection. The tails coil tightly.
  Header "Damage 3" (4,3): Recovery — the swarm rights itself, the damaged creatures pulling their wounded parts inward. They reform the attack formation with the healthiest facehugger in the lead. Finger-legs extend cautiously and tails rise again.
  Header "KO 1" (4,4): The swarm collapses — one facehugger goes limp, finger-legs curling inward in a death pose. The others slow and cluster around the fallen creature, finger-legs touching it. The pale flesh of all three goes a sickly grey.
  Header "KO 2" (4,5): Two facehuggers are now motionless with curled finger-legs, lying on their backs showing the translucent ventral membranes no longer pulsing. The last one crawls weakly before collapsing beside them, tail going slack.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): All three facehuggers lie motionless — finger-legs curled inward, tails limp, ventral membranes still and translucent. The pale flesh has gone grey and a small pool of pink fluid surrounds the cluster. They look like discarded organic husks.
  Header "Victory 1" (5,1): The swarm scurries in a celebratory circle, finger-legs clicking rapidly on the ground. The lead facehugger leaps and lands atop the others in a dominant display. Tails whip with energy and the pale flesh pulses a healthy pink.
  Header "Victory 2" (5,2): All three facehuggers rear up on their hind legs simultaneously, front finger-legs spread wide in a coordinated display. The ventral proboscises extend and retract and the tails lash in unison. A disturbing, synchronized victory.
  Header "Victory 3" (5,3): The swarm settles into a satisfied cluster, finger-legs intertwined. They breathe in synchronized pulses, the pale flesh rising and falling together. Tails coil lazily and the translucent membranes glow with contented internal warmth.
  Header "Weak Pose" (5,4): The swarm huddles in a weakened cluster — one creature is barely moving, finger-legs limp. The others press close protectively, their own finger-legs sluggish. The pale flesh is mottled grey and the tails hang without energy.
  Header "Critical Pose" (5,5): Only one facehugger remains functional, dragging itself forward with weakening finger-legs. The other two lie motionless behind it. Its translucent membrane barely pulses and the tail trails limply, but it still reaches toward the threat with desperate, instinctual gripping.`,
      groupGuidance: {
        "Walk South Animation Frames": "The Facehugger Swarm scuttles South in unsettling coordinated formation, pale fleshy bodies low to the ground with finger-legs reaching and muscular tails whipping for balance. The wet organic sheen of their skin catches the light and translucent ventral membranes pulse.",
        "Walk North Animation Frames": "The Facehugger Swarm scuttles North in unsettling coordinated formation, pale fleshy bodies low to the ground with finger-legs reaching and muscular tails whipping for balance. The wet organic sheen of their skin catches the light and translucent ventral membranes pulse.",
        "Walk West Animation Frames": "The Facehugger Swarm scuttles West in unsettling coordinated formation, pale fleshy bodies low to the ground with finger-legs reaching and muscular tails whipping for balance. The wet organic sheen of their skin catches the light and translucent ventral membranes pulse.",
        "Walk East Animation Frames": "The Facehugger Swarm scuttles East in unsettling coordinated formation, pale fleshy bodies low to the ground with finger-legs reaching and muscular tails whipping for balance. The wet organic sheen of their skin catches the light and translucent ventral membranes pulse."
      },
    },
    {
      id: 'biomechanical-entity',
      name: "Biomechanical Entity",
      genre: "Sci-Fi Horror",
      description: "An HR Giger-inspired fusion of organic tissue and mechanical structure. A humanoid frame where flesh merges seamlessly with chrome pipes, ribbed tubing, and exposed vertebral columns. Smooth, elongated skull-like head with no visible eyes, connected by cables and tubes to the torso.",
      equipment: "Integrated body-weapons — retractable chrome blade-arms that extend from forearm housings, ribbed pipes that vent steam, exposed vertebrae that flex and strike, and chrome-plated chest panels over raw flesh. No separate equipment.",
      colorNotes: "Chrome silver mechanical components contrasting with exposed flesh pink organic tissue. Dark steel ribbed pipes and tubes. Bone-white exposed vertebrae. The skull-head is smooth dark steel with chrome accents. Fluids are dark reddish-black.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Entity stands facing the viewer in an unsettling stillness, the smooth skull-head tilted slightly. Chrome chest panels gleam over exposed flesh and the ribbed tubes pulse with dark fluid. The forearm blade housings are retracted and steam drifts from shoulder pipes.
  Header "Idle Up" (2,1): Facing away, the exposed vertebral column is fully displayed — bone-white vertebrae connected by cables and tubes, flanked by ribbed pipes and chrome panels. The skull-head is barely visible above the mechanical nightmare of the back.
  Header "Idle Left" (2,2): Facing left in biomechanical stillness, the profile shows the smooth skull-head connected by tubes to the torso. Chrome panels reflect light while flesh-pink tissue pulses between them. The blade arm housing is dormant on the near forearm.
  Header "Idle Right" (2,3): Facing right, the ribbed tubes and chrome panels create a disturbing silhouette. Steam drifts lazily from shoulder pipes and dark fluid traces the cable connections. The bone-white vertebrae are visible through the back.
  Header "Battle Idle 1" (2,4): The Entity activates — chrome blade-arms extend from both forearm housings, sliding out with a mechanical hiss. The skull-head snaps forward and the ribbed pipes flare with pressurized steam. The exposed vertebrae arch aggressively and the flesh between the chrome plates pulses faster.
  Header "Battle Idle 2" (2,5): It shifts in the combat stance, the extended chrome blades catching light. The cables and tubes connecting the skull-head to the torso tighten and the vertebral column undulates. Dark reddish-black fluid drips from the blade housing seams.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Entity holds the combat stance, chrome blades forward and the skull-head locked in a targeting orientation. Steam vents from multiple ribbed pipes and the flesh-pink tissue between chrome plates darkens with blood flow. The vertebrae flex like a coiled serpent.
  Header "Attack 1" (3,1): Wind-up — the Entity pulls both chrome blade-arms back, the forearm housings retracting to extend the blades to maximum length. The skull-head tilts back and the vertebral column arches, storing kinetic energy.
  Header "Attack 2" (3,2): Dual blade strike — both chrome blades slash forward in a crossing arc, the mechanical arms driving with piston force. The skull-head snaps forward and the vertebrae release their stored energy. Steam bursts from every pipe.
  Header "Attack 3" (3,3): Follow-through — the chrome blades are fully extended in an X-pattern, dark reddish-black fluid spraying from the blade edges. The skull-head tilts with the motion and the ribbed pipes vent a powerful steam blast from the exertion.
  Header "Cast 1" (3,4): The Entity retracts the blade-arms and spreads its chrome-and-flesh hands. The ribbed pipes along the spine begin glowing with internal heat and the skull-head tilts back. The cables and tubes connecting to the torso pulse with accelerated dark fluid.
  Header "Cast 2" (3,5): The internal heat builds — the chrome panels begin radiating visible heat shimmer and the exposed flesh between them glows reddish-pink. The vertebrae pulse with energy and the skull-head emits a low mechanical drone. Every ribbed pipe vents superheated steam.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Entity releases a biomechanical shockwave — a burst of superheated steam and dark fluid erupts from every pipe and cable, creating a concussive ring of force. The chrome panels flash and the flesh pulses. The skull-head emits a piercing mechanical shriek.
  Header "Damage 1" (4,1): The Entity staggers, a chrome chest panel cracking and peeling back to reveal the raw flesh beneath. Dark reddish-black fluid sprays from severed tubes and the ribbed pipes sputter. The skull-head jerks sideways.
  Header "Damage 2" (4,2): More chrome panels shatter, exposing large areas of vulnerable flesh-pink tissue. Cables snap and flail, leaking dark fluid. The blade-arms retract involuntarily and the vertebral column locks in a pained arch. Steam vents erratically.
  Header "Damage 3" (4,3): Recovery — the Entity's damaged systems stabilize with mechanical clicks and hydraulic hisses. Severed tubes seal themselves and the blade-arms re-extend. The skull-head realigns and the vertebrae unlock. Dark fluid still drips but the chrome components realign.
  Header "KO 1" (4,4): Systems cascade failure — chrome panels fall away and the blade-arms retract permanently. The ribbed pipes stop venting and go silent. The cables connecting the skull-head go slack and the vertebral column collapses. The entity sinks to its knees.
  Header "KO 2" (4,5): The Entity collapses in a heap of chrome and flesh — mechanical components grinding to a halt and organic tissue going limp. Dark fluid pools around the body and the skull-head rests on the ground with disconnected tubes trailing. The silence is worse than the noise.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Entity lies motionless — a pile of chrome plates, exposed flesh, disconnected tubes, and silent ribbed pipes. The skull-head stares blankly and the exposed vertebrae have locked in a contorted position. Dark reddish-black fluid pools beneath the body. A final wisp of steam escapes one pipe.
  Header "Victory 1" (5,1): The Entity extends both chrome blade-arms and crosses them overhead, the skull-head tilting back in a mechanical roar. Every ribbed pipe vents steam in a coordinated blast and the vertebrae undulate in a display of biomechanical dominance. The chrome panels gleam.
  Header "Victory 2" (5,2): The blade-arms retract and the Entity stands tall, the chrome-plated chest expanding as cables and tubes pulse with fresh dark fluid. The skull-head scans slowly and the vertebrae ripple in a satisfied wave. It is a machine that has completed its function.
  Header "Victory 3" (5,3): The Entity returns to unsettling stillness — blade-arms retracted, ribbed pipes gently steaming, vertebrae settled. The skull-head tilts at an almost curious angle and the chrome panels gleam. It waits for the next directive with terrifying patience.
  Header "Weak Pose" (5,4): The Entity hunches with failing systems — chrome panels loose and hanging, blade-arms partially extended and sparking. Several tubes are disconnected and leaking dark fluid. The skull-head droops and the vertebral column sags. Only the faintest steam escapes the pipes.
  Header "Critical Pose" (5,5): Barely operational, the Entity stands on locked pistons. Most chrome plates are gone, exposing vulnerable flesh that pulses weakly. The blade-arms twitch and the skull-head hangs by a few cables. A single ribbed pipe still vents thin steam in a last mechanical breath.`,
      groupGuidance: {
        "Walk South Animation Frames": "The Biomechanical Entity strides South with mechanical precision, chrome blade-arms retracted into the forearm housings of both arms and ribbed pipes venting thin hisses of steam from its shoulders. Chrome pistons drive its legs and dark reddish-black fluid traces the seams where chrome panels meet exposed flesh-pink tissue.",
        "Walk North Animation Frames": "The Biomechanical Entity strides North with mechanical precision, chrome blade-arms retracted into the forearm housings of both arms and ribbed pipes venting thin hisses of steam from its shoulders. Chrome pistons drive its legs and dark reddish-black fluid traces the seams where chrome panels meet exposed flesh-pink tissue.",
        "Walk West Animation Frames": "The Biomechanical Entity strides West with mechanical precision, chrome blade-arms retracted into the forearm housings of both arms and ribbed pipes venting thin hisses of steam from its shoulders. Chrome pistons drive its legs and dark reddish-black fluid traces the seams where chrome panels meet exposed flesh-pink tissue.",
        "Walk East Animation Frames": "The Biomechanical Entity strides East with mechanical precision, chrome blade-arms retracted into the forearm housings of both arms and ribbed pipes venting thin hisses of steam from its shoulders. Chrome pistons drive its legs and dark reddish-black fluid traces the seams where chrome panels meet exposed flesh-pink tissue."
      },
    },
    {
      id: 'space-marine',
      name: "Space Marine",
      genre: "Sci-Fi Horror",
      description: "A hardened colonial marine in heavy tactical armor with a full-face helmet featuring an amber visor HUD. Athletic, combat-ready build with military bearing. Battle-scarred armor tells the story of encounters with alien threats.",
      equipment: "Olive drab tactical armor with gunmetal-grey reinforced plates, a pulse rifle with an underslung grenade launcher, a motion tracker mounted on the left forearm, a chest-mounted tactical lamp, and a tactical helmet with an amber-tinted visor.",
      colorNotes: "Olive drab primary armor with gunmetal-grey reinforced plates. Amber-tinted visor with HUD glow. Pulse rifle is dark gunmetal with olive grips. Motion tracker screen is green. Chest lamp casts white light. Boot soles are worn dark rubber.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Marine stands at combat rest facing the viewer, pulse rifle shouldered with the barrel up. The amber visor glows steadily with a green HUD readout. The chest lamp is on low and the motion tracker shows a clear green screen. Military bearing is evident in every line.
  Header "Idle Up" (2,1): Facing away at combat rest, the back armor plates and equipment webbing are visible. The pulse rifle barrel extends over the right shoulder and the tactical helmet's rear shows communication equipment. Olive drab armor is well-maintained despite battle scars.
  Header "Idle Left" (2,2): Facing left at rest, pulse rifle at port arms. The amber visor shows in profile and the motion tracker on the near arm displays the green sweep. The chest lamp is dimmed and the reinforced shoulder plate shows a deep scratch from an alien encounter.
  Header "Idle Right" (2,3): Facing right at combat rest, the pulse rifle resting against the shoulder. The amber visor casts a faint glow on the olive drab armor and the chest lamp is on standby. The military bearing remains sharp and the gunmetal plates are well-seated.
  Header "Battle Idle 1" (2,4): The Marine snaps to combat stance — pulse rifle aimed forward in a two-handed grip, the amber visor tracking with targeting data. The motion tracker beeps with contacts and the chest lamp blazes to full power. Every gunmetal plate locks tight and the grenade launcher safety clicks off.
  Header "Battle Idle 2" (2,5): He shifts in the combat stance, the pulse rifle tracking. The motion tracker blips increase and the amber visor flickers with multiple contacts. The chest lamp sweeps and the olive drab armor is taut against his combat-ready muscles. Sweat is visible on the chin beneath the visor.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Marine holds the firing stance, pulse rifle locked on target. The amber visor displays range and target data. The motion tracker sweeps rapidly and the chest lamp illuminates the kill zone. His finger is on the trigger and the grenade launcher is armed.
  Header "Attack 1" (3,1): Wind-up — the Marine braces the pulse rifle stock against his gunmetal shoulder plate, sighting through the amber visor. The weapon charges with a building whine and the chest lamp focuses on the target zone. The motion tracker confirms target lock.
  Header "Attack 2" (3,2): The pulse rifle fires — a rapid burst of bright muzzle flashes erupts from the barrel with spent casings ejecting. The recoil pushes against the shoulder plate and the amber visor flickers with each flash. The chest lamp illuminates the tracer paths.
  Header "Attack 3" (3,3): Follow-through — the burst impacts at the cell edge with small explosions of sparks. Spent casings litter the ground and the pulse rifle barrel steams. The Marine steadies for another burst, the motion tracker still sweeping.
  Header "Cast 1" (3,4): The Marine flips the pulse rifle to the underslung grenade launcher, the selector clicking to secondary fire. He crouches slightly and the amber visor switches to a grenade trajectory arc display. The chest lamp dims to reduce his profile.
  Header "Cast 2" (3,5): The grenade launcher charges — the Marine sights the arc through the amber visor's trajectory display, compensating for range. His body braces for the recoil and the motion tracker shows the target cluster.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The grenade launches with a heavy thump — a small explosive round arcs to the cell edge and detonates in a burst of fire and shrapnel. The recoil rocks the Marine backward and the amber visor flashes with the explosion. Smoke rolls across the ground.
  Header "Damage 1" (4,1): The Marine staggers from a hit, a gunmetal plate denting inward. The pulse rifle wavers and the amber visor flickers with static. Acid burns appear on the olive drab armor from alien contact and the chest lamp sputters.
  Header "Damage 2" (4,2): Stumbling back, a shoulder plate cracks and falls away. The motion tracker sparks and the screen goes dark. The amber visor shows damage warnings and the pulse rifle is gripped with trembling, blood-smeared gloves. The chest lamp flickers.
  Header "Damage 3" (4,3): Recovery — the Marine plants his feet and raises the pulse rifle, forcing himself back into firing stance. The amber visor reboots with a flash and the chest lamp steadies. The motion tracker is dead but his training keeps him focused through the pain.
  Header "KO 1" (4,4): The pulse rifle drops from weakening hands as the Marine's knees buckle. The amber visor dims and the chest lamp dies. The damaged armor sags on his failing body and the motion tracker arm hangs limp.
  Header "KO 2" (4,5): The Marine collapses forward, the tactical helmet cracking against the ground. The pulse rifle lies beside his outstretched arm and the amber visor goes completely dark. The olive drab armor is battered and acid-scarred. The chest lamp gives one final flicker.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Marine lies face-down in battered armor — the pulse rifle beside his arm, the amber visor dark, and the chest lamp dead. Acid scars mark the olive drab plates and the cracked motion tracker shows a blank screen. Spent casings surround the body. Game over, man.
  Header "Victory 1" (5,1): The Marine raises the pulse rifle overhead with one arm, the amber visor blazing with a victory readout. The chest lamp flashes in celebration and the motion tracker shows a clear screen — all contacts eliminated. He lets out a triumphant battle cry behind the helmet.
  Header "Victory 2" (5,2): He taps the motion tracker and confirms all clear, then slings the pulse rifle over one shoulder. The amber visor switches to standard mode and the chest lamp dims to normal. He gives a sharp military nod of satisfaction — mission accomplished.
  Header "Victory 3" (5,3): The Marine plants the pulse rifle butt on the ground and leans on it, pushing the amber visor up on the helmet. His face is revealed — exhausted but alive, with a grim, satisfied expression. The motion tracker beeps a steady all-clear and the chest lamp casts a warm glow.
  Header "Weak Pose" (5,4): The Marine leans on the pulse rifle as a crutch, the amber visor cracked and flickering. The chest lamp is dead, the motion tracker sparks intermittently, and acid scars cover the olive drab armor. He breathes heavily behind the damaged helmet.
  Header "Critical Pose" (5,5): Barely standing, the Marine grips the pulse rifle one-handed, the other arm limp. The amber visor shows critical damage warnings, most armor plates are gone or cracked, and the chest lamp is shattered. His last magazine is loaded and his finger is on the trigger — he will not go quietly.`,
      groupGuidance: {
        "Walk South Animation Frames": "The Space Marine advances South with a disciplined combat-ready stride, the pulse rifle held steady across his chest in both hands with the barrel angled right. The motion tracker on his left forearm sweeps with a green display, his amber visor glows with HUD data, and the chest lamp casts a white beam forward.",
        "Walk North Animation Frames": "The Space Marine advances North with a disciplined combat-ready stride, the pulse rifle held steady across his chest in both hands with the barrel angled right. The motion tracker on his left forearm sweeps with a green display, his amber visor glows with HUD data, and the chest lamp casts a white beam forward.",
        "Walk West Animation Frames": "The Space Marine advances West with a disciplined combat-ready stride, the pulse rifle held steady across his chest in both hands with the barrel angled right. The motion tracker on his left forearm sweeps with a green display, his amber visor glows with HUD data, and the chest lamp casts a white beam forward.",
        "Walk East Animation Frames": "The Space Marine advances East with a disciplined combat-ready stride, the pulse rifle held steady across his chest in both hands with the barrel angled right. The motion tracker on his left forearm sweeps with a green display, his amber visor glows with HUD data, and the chest lamp casts a white beam forward."
      },
    },
    {
      id: 'pickle-rick-rat-suit',
      name: "Pickle Rick (Rat Suit)",
      genre: "Sci-Fi / Comedy",
      description: "Pickle Rick from Rick and Morty — a pickle with a rat skeleton exosuit/armor. His green pickle face is fully exposed with small beady eyes and a confident smirk. The rat skeleton armor consists of a ribcage chest plate and bone limbs. He is tall and narrow — an elongated pickle body with improvised bone armor strapped to it.",
      equipment: "Rat skeleton exosuit armor (ribcage torso plate, bone arm and leg appendages), makeshift weapons fashioned from rat bones and sewer debris.",
      colorNotes: "Bright green pickle skin with darker green bumps/texture. Off-white/cream rat bones with occasional blood/grime. Beady black eyes. The pickle body has a slight translucent quality at the edges.",
      rowGuidance: `

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Pickle Rick stands facing the viewer, bone arms at his sides, smirking. The rat ribcage sits naturally on his pickle torso. Relaxed but cocky posture.
  Header "Idle Up" (2,1): Standing facing away, relaxed. The bone spine and ribcage back are visible against the green pickle skin.
  Header "Idle Left" (2,2): Facing left, relaxed idle. The tall narrow pickle silhouette is distinctive. One bone arm rests casually.
  Header "Idle Right" (2,3): Facing right, relaxed idle. Mirror of Idle Left.
  Header "Battle Idle 1" (2,4): Pickle Rick drops into a combat crouch, bone arms raised in a fighting stance. His smirk becomes a fierce grin. A bone-shiv is gripped in one hand.
  Header "Battle Idle 2" (2,5): Slight shift in battle stance — weight transfers between bone legs. The bone-shiv glints. His beady eyes are locked on the target.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Battle stance held firmly, bone armor rattling slightly. Pickle Rick's expression is pure aggression.
  Header "Attack 1" (3,1): Wind-up — Pickle Rick pulls the bone-shiv back, coiling his pickle body. The rat ribcage flexes with the twist.
  Header "Attack 2" (3,2): Mid-slash — the bone weapon slashes forward in a vicious arc. His pickle body rotates into the strike, bone limbs extending.
  Header "Attack 3" (3,3): Follow-through — weapon fully extended, pickle body stretched out from the force. Bone armor pieces rattle from the impact.
  Header "Cast 1" (3,4): Pickle Rick raises both bone arms, improvising some sewer-tech device from rat parts. Sparks begin to fly from the contraption.
  Header "Cast 2" (3,5): The improvised device crackles with energy. His beady eyes widen with manic glee. The pickle body glows slightly from the energy.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The device fires — a burst of sewer-tech energy erupts. Bone armor rattles from the discharge. Pickle Rick grins maniacally.
  Header "Damage 1" (4,1): Pickle Rick flinches from a hit, bone armor absorbing impact. A rib cracks on the chest plate. His smirk falters briefly.
  Header "Damage 2" (4,2): Staggering back, more bone armor cracking. The pickle body shows a bruise. His expression shifts to anger rather than pain.
  Header "Damage 3" (4,3): Recovery — Pickle Rick plants a bone-leg and steadies himself. Broken armor pieces hang loose. His smirk returns defiantly.
  Header "KO 1" (4,4): His bone legs buckle. The improvised weapons slip from his grip. The ribcage armor sags.
  Header "KO 2" (4,5): Falling — the pickle body tips sideways, bone limbs going limp. Armor pieces scatter.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Pickle Rick lies on the ground, bone armor scattered around him. Just a pickle with some bones. His beady eyes are closed.
  Header "Victory 1" (5,1): Pickle Rick raises the bone-shiv overhead triumphantly with one arm. His grin is enormous. He stands tall on his bone legs, ribcage puffed out.
  Header "Victory 2" (5,2): He flexes both bone arms in a power pose. The pickle body practically vibrates with self-satisfaction. His catchphrase face — "I'm Pickle Rick!"
  Header "Victory 3" (5,3): Cool confident pose — bone-shiv resting on his shoulder, one bone-hand on his hip. The smirk that says he was never worried.
  Header "Weak Pose" (5,4): Pickle Rick kneels on one bone-leg, using the bone-shiv as support. Several ribs on the chest plate are cracked. His pickle skin is dull. Breathing hard but still smirking.
  Header "Critical Pose" (5,5): Barely standing — most bone armor destroyed, pickle body dented and bruised. One bone arm hangs limp. But his beady eyes burn with defiance. He's been through worse.`,
      groupGuidance: {
        "Walk South Animation Frames": "Pickle Rick strides South with confident bone-leg steps inside his rat-skeleton exosuit, a bone-shiv gripped in his right bone-hand and his left bone-arm swinging naturally. The ribcage chest plate bounces slightly, his green pickle face keeps its perpetual smirk, and his beady eyes scan ahead.",
        "Walk North Animation Frames": "Pickle Rick strides North with confident bone-leg steps inside his rat-skeleton exosuit, a bone-shiv gripped in his right bone-hand and his left bone-arm swinging naturally. The ribcage chest plate bounces slightly, his green pickle face keeps its perpetual smirk, and his beady eyes scan ahead.",
        "Walk West Animation Frames": "Pickle Rick strides West with confident bone-leg steps inside his rat-skeleton exosuit, a bone-shiv gripped in his right bone-hand and his left bone-arm swinging naturally. The ribcage chest plate bounces slightly, his green pickle face keeps its perpetual smirk, and his beady eyes scan ahead.",
        "Walk East Animation Frames": "Pickle Rick strides East with confident bone-leg steps inside his rat-skeleton exosuit, a bone-shiv gripped in his right bone-hand and his left bone-arm swinging naturally. The ribcage chest plate bounces slightly, his green pickle face keeps its perpetual smirk, and his beady eyes scan ahead."
      },
    },
    {
      id: 'sewer-rat',
      name: "Sewer Rat",
      genre: "Sci-Fi / Comedy",
      description: "A hostile sewer rat enemy — scrappy, aggressive, mangy fur, bared teeth, hunched posture. Standard enemy-sized rat, not giant. Stands upright on hind legs in a semi-bipedal combat stance for sprite animation purposes.",
      equipment: "None — natural claws and teeth are its weapons.",
      colorNotes: "Dirty brown/gray matted fur, pink hairless tail and inner ears, yellowish teeth, beady red-orange eyes. Pale pink skin visible through thin patches of fur on belly.",
      rowGuidance: `
Sewer Rat is a quadruped rat standing semi-upright on its hind legs for sprite animation. It has four paws (forepaws used as hands), a long pink hairless tail, pointed snout with whiskers, and bared yellowish teeth. Mangy brown-gray fur covers its body with thin patches on the belly.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The rat stands hunched on hind legs facing the viewer. Paws hang at its sides, claws visible. Beady red eyes stare. Whiskers twitch. Aggressive but still.
  Header "Idle Up" (2,1): Standing facing away, tail curling on the ground. Ears twitch. Matted fur on the back.
  Header "Idle Left" (2,2): Facing left, idle. The rat's hunched profile, snout, and whiskers. Alert and twitchy.
  Header "Idle Right" (2,3): Facing right, idle. Mirror of Idle Left.
  Header "Battle Idle 1" (2,4): The rat rears up fully on hind legs, forepaws raised with claws bared. Teeth exposed in a hiss. Red eyes blaze. Aggressive stance.
  Header "Battle Idle 2" (2,5): Slight sway in battle stance — weight shifts, the rat snaps its jaws. Claws flex.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Battle stance held — tail whips behind for balance. The rat snarls, showing yellow teeth.
  Header "Attack 1" (3,1): Wind-up — the rat coils back on its haunches, claws pulled back. Ready to lunge.
  Header "Attack 2" (3,2): Mid-lunge — the rat springs forward with claws extended, jaws open. A vicious swipe. Pink tail snaps straight.
  Header "Attack 3" (3,3): Follow-through — claws slash through the air, the rat lands from its lunge. Fur bristles from exertion.
  Header "Cast 1" (3,4): The rat lets out a screech — mouth wide open, standing fully upright. A rallying call to summon more rats.
  Header "Cast 2" (3,5): Screeching intensifies — the rat's body vibrates with the shriek. Other tiny rat shadows seem to stir in the background.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The screech peaks — a shockwave of sound. The rat's entire body tenses with the effort. Ears flatten.
  Header "Damage 1" (4,1): The rat flinches from a hit, one paw clutching its side. Beady eyes wince. Fur ruffles from impact.
  Header "Damage 2" (4,2): Staggering back on hind legs, the rat squeals. A patch of fur is torn. Tail wraps protectively.
  Header "Damage 3" (4,3): Recovery — the rat shakes off the hit, snarling. It drops to all fours briefly then rises back to hind legs.
  Header "KO 1" (4,4): The rat's legs give out. It slumps forward, paws going limp. Eyes half-close.
  Header "KO 2" (4,5): Falling sideways — the rat topples, tail limp. Whiskers droop.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The rat lies on its side, paws curled, tail limp. Eyes closed. Just a dead sewer rat.
  Header "Victory 1" (5,1): The rat stands fully upright and squeaks triumphantly. Paws raised, claws gleaming. Chest puffed out.
  Header "Victory 2" (5,2): It chatters its teeth rapidly in celebration. Tail whips excitedly. Beady eyes gleam with feral pride.
  Header "Victory 3" (5,3): The rat grooms itself smugly, licking one paw. A satisfied rodent. Winner.
  Header "Weak Pose" (5,4): The rat crouches low, panting. Fur matted with sweat, one eye half-closed. Claws scrape the ground weakly. Still snarling.
  Header "Critical Pose" (5,5): Barely standing — the rat sways on shaky hind legs, mouth open, teeth bared in a final desperate hiss. One paw clutches a wound. Will bite to the last.`,
      groupGuidance: {
        "Walk South Animation Frames": "The Sewer Rat scurries South in a hunched semi-bipedal stance, mangy brown-gray fur bristling and beady red eyes glaring. Its pink tail drags behind and the whiskers twitch with constant wary attention.",
        "Walk North Animation Frames": "The Sewer Rat scurries North in a hunched semi-bipedal stance, mangy brown-gray fur bristling and beady red eyes glaring. Its pink tail drags behind and the whiskers twitch with constant wary attention.",
        "Walk West Animation Frames": "The Sewer Rat scurries West in a hunched semi-bipedal stance, mangy brown-gray fur bristling and beady red eyes glaring. Its pink tail drags behind and the whiskers twitch with constant wary attention.",
        "Walk East Animation Frames": "The Sewer Rat scurries East in a hunched semi-bipedal stance, mangy brown-gray fur bristling and beady red eyes glaring. Its pink tail drags behind and the whiskers twitch with constant wary attention."
      },
    },
    {
      id: 'sewer-cockroach',
      name: "Sewer Cockroach",
      genre: "Sci-Fi / Comedy",
      description: "A large aggressive sewer cockroach enemy — glossy dark carapace, twitchy antennae, six skittering legs. Viewed from a slight top-down angle to show the shell. Stands semi-upright on its back legs for sprite animation, front legs used as arms. About the size of a rat.",
      equipment: "None — natural mandibles, sharp front leg spines, and hard carapace shell.",
      colorNotes: "Dark reddish-brown glossy carapace/shell, lighter brown-tan underbelly and leg segments, dark brown-black legs, translucent amber wings folded under the shell. Beady black compound eyes.",
      rowGuidance: `
Sewer Cockroach has six legs — it stands on its four back legs with its two front legs held up as arms with spiny edges. It has a glossy dark reddish-brown carapace shell, mandibles, twitchy antennae, beady black compound eyes, and translucent amber wings folded under the shell. No human-like hands.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The cockroach stands on hind legs facing the viewer. Front leg-arms rest at its sides. Antennae wave lazily. Compound eyes reflect light. Mandibles click.
  Header "Idle Up" (2,1): Standing facing away. The carapace fills the frame. Antennae droop backward. Wings folded tight.
  Header "Idle Left" (2,2): Facing left, idle. Flat body profile visible. Antenna sweeps the air.
  Header "Idle Right" (2,3): Facing right, idle. Mirror of Idle Left.
  Header "Battle Idle 1" (2,4): The cockroach rears up aggressively — front legs raised with spiny edges visible. Mandibles spread wide. Antennae whip forward. The carapace lifts slightly, hinting at wing deployment.
  Header "Battle Idle 2" (2,5): Battle sway — the cockroach hisses (air through spiracles). Front leg-spines flex. Eyes gleam.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Held aggressive stance — antennae locked forward like targeting sensors. Mandibles click rhythmically. Ready to strike.
  Header "Attack 1" (3,1): Wind-up — the cockroach coils its body, pulling front leg-spines back. Carapace tilts forward.
  Header "Attack 2" (3,2): Mid-strike — front legs slash forward with spiny edges. The cockroach lunges, mandibles snapping. Fast and vicious.
  Header "Attack 3" (3,3): Follow-through — spines fully extended, the cockroach hisses after the strike. Carapace rattles.
  Header "Cast 1" (3,4): The cockroach spreads its translucent wings from under the carapace. A threatening display. The wings buzz ominously.
  Header "Cast 2" (3,5): Wings buzz at high frequency — a disorienting sonic attack. The air shimmers around the vibrating wings.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Wings reach peak buzz — a shockwave of sound and wind. The cockroach's body vibrates intensely. Nearby debris scatters.
  Header "Damage 1" (4,1): The cockroach recoils from a hit. A crack appears in the glossy carapace. Front legs clutch defensively. Antennae whip back.
  Header "Damage 2" (4,2): Staggering — more shell cracks. The cockroach's legs scramble for footing. One antenna is bent.
  Header "Damage 3" (4,3): Recovery — the cockroach rights itself, shell damaged but intact. It hisses defiantly, mandibles clicking.
  Header "KO 1" (4,4): Legs give out — the cockroach tips onto its back. Legs curl inward. Classic dying roach pose begins.
  Header "KO 2" (4,5): On its back, legs twitching. The glossy underbelly is exposed — lighter tan color. Wings crumple.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Fully on its back, legs curled up and still. Dead cockroach. Shell cracked, antennae limp.
  Header "Victory 1" (5,1): The cockroach rears up fully and spreads its wings in a dominance display. Mandibles click rapidly. Front leg-spines raised high.
  Header "Victory 2" (5,2): It buzzes its wings in short triumphant bursts. Antennae wave in circles. The carapace gleams with victory.
  Header "Victory 3" (5,3): The cockroach folds its wings smugly and begins grooming an antenna with one front leg. It has survived. It always survives.
  Header "Weak Pose" (5,4): The cockroach lists to one side, legs shaky. Shell cracked in multiple places, one antenna broken. Mandibles open and close weakly. Breathing hard through damaged spiracles.
  Header "Critical Pose" (5,5): Barely upright — multiple shell plates missing, legs trembling. But the compound eyes still gleam. It hisses with what little strength remains. Cockroaches don't give up. They never do.`,
      groupGuidance: {
        "Walk South Animation Frames": "For walking animations, Sewer Cockroach skitters on its back legs, front legs held up like arms. Glossy reddish-brown shell gleams. Antennae twitch forward. Compound eyes catch the light.",
        "Walk North Animation Frames": "For walking animations, Sewer Cockroach skitters on its back legs, front legs held up like arms. Glossy reddish-brown shell gleams. Antennae twitch forward. Compound eyes catch the light.",
        "Walk West Animation Frames": "For walking animations, Sewer Cockroach skitters on its back legs, front legs held up like arms. Glossy reddish-brown shell gleams. Antennae twitch forward. Compound eyes catch the light.",
        "Walk East Animation Frames": "For walking animations, Sewer Cockroach skitters on its back legs, front legs held up like arms. Glossy reddish-brown shell gleams. Antennae twitch forward. Compound eyes catch the light."
      },
    },
  ];

  const insert = db.prepare(
    `INSERT OR IGNORE INTO character_presets (id, name, genre, description, equipment, color_notes, overall_guidance, group_guidance, cell_guidance, is_preset)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  // Decompose guidance blobs: preamble text → preset overall_guidance, per-cell text → link cell_guidance
  const decomposed = new Map();
  const insertAll = db.transaction(() => {
    for (const p of PRESETS) {
      const { overall, groups, cells } = decomposeGuidanceBlob(p.rowGuidance || '', RPG_FULL_RENAME);
      decomposed.set(p.id, cells);
      insert.run(p.id, p.name, p.genre, p.description, p.equipment, p.colorNotes, overall, JSON.stringify(groups), '{}');
    }
  });

  insertAll();
  console.log(`[DB] Seeded ${PRESETS.length} character presets.`);

  // Link character presets to RPG Full 6x6 grid preset — cell guidance lives on the link
  const rpgFullGrid = db.prepare("SELECT id, cell_labels FROM grid_presets WHERE name = 'RPG Full' AND sprite_type = 'character'").get();
  if (rpgFullGrid) {
    const gridLabels = new Set(JSON.parse(rpgFullGrid.cell_labels || '[]'));
    const insertLink = db.prepare(`
      INSERT OR IGNORE INTO character_grid_links (character_preset_id, grid_preset_id, overall_guidance, group_guidance, cell_guidance, sort_order)
      VALUES (?, ?, '', ?, ?, 0)
    `);
    const presetById = new Map(PRESETS.map(p => [p.id, p]));
    const chars = db.prepare('SELECT id FROM character_presets').all();
    const linkAll = db.transaction(() => {
      for (const char of chars) {
        const cells = decomposed.get(char.id) || {};
        // Only include cell entries that match this grid's labels
        const linkCells = Object.fromEntries(Object.entries(cells).filter(([k]) => gridLabels.has(k)));
        const preset = presetById.get(char.id);
        const groupGuidance = preset?.groupGuidance || {};
        insertLink.run(char.id, rpgFullGrid.id, JSON.stringify(groupGuidance), JSON.stringify(linkCells));
      }
    });
    linkAll();
    console.log(`[DB] Created ${chars.length} character grid links.`);
  }

}
