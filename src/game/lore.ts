// All words spoken in the Under-Naves. Tone: archaic, zealous, violently
// poetic. Self-harm is never instructed; dread and accusation instead.

export interface Sacrament {
  id: string;
  name: string;
  confession: string;
  boon: string;
  toll: string;
}

export const SACRAMENTS: Sacrament[] = [
  {
    id: 'glutton',
    name: 'The Vow of the Glutton',
    confession: 'I ate until I tore, and still I let my dog starve.',
    boon: 'Rites of Absolution restore twice the flesh.',
    toll: 'Thy Censer breathes slower, forever.',
  },
  {
    id: 'tongue',
    name: 'The Spiteful Tongue',
    confession: 'I told him I loved him, just so it would hurt more when I left.',
    boon: 'Every third strike of the Tether leaves Toxin in the wound.',
    toll: 'Spite curdles inward: thy Reliquary holds 10 less.',
  },
  {
    id: 'blindeye',
    name: 'The Blind Eye',
    confession: 'I saw what he did to that child, and I closed the door.',
    boon: 'Strikes find the soft places far more often.',
    toll: 'The dark creeps in. Thy sight shrinks to a candle’s reach.',
  },
  {
    id: 'debt',
    name: 'The Debt of Hands',
    confession: 'I borrowed from my mother’s coffin. I meant to pay it back.',
    boon: 'The Tether strikes a quarter harder.',
    toll: 'Tears of Contrition come to thee halved.',
  },
  {
    id: 'neighbour',
    name: 'The Quiet Neighbour',
    confession: 'I heard her screaming through the wall each night. I sang the hymns louder.',
    boon: 'The Blissful Blind cannot hear thy steps.',
    toll: 'The Grates whisper to thee twice as cruelly.',
  },
  {
    id: 'ledger',
    name: 'The Sweetened Ledger',
    confession: 'I shaved a little from every widow’s account. A little is nothing.',
    boon: 'Every fallen thing weeps half again as many Tears.',
    toll: 'Thy Reliquary holds 15 less.',
  },
  {
    id: 'mirror',
    name: 'The Covered Mirror',
    confession: 'I kept the mirrors veiled, so I would not see what I became.',
    boon: 'Lucidity bleeds from thee at half the rate.',
    toll: 'Thou canst no longer see thine own Reliquary.',
  },
  {
    id: 'promise',
    name: 'The Sundered Promise',
    confession: 'I promised I would come back for him. The door was so heavy.',
    boon: 'Dodging costs half the incense.',
    toll: 'Each Perfect Dodge tears a little Lucidity loose.',
  },
  {
    id: 'knife',
    name: 'The Patient Knife',
    confession: 'I waited years to say the cruel thing. I said it at her wedding.',
    boon: 'The charged swing of the Tether falls far heavier (+60%).',
    toll: 'Quick strikes lose a fifth of their bite.',
  },
  {
    id: 'lamb',
    name: 'The Sacrificed Lamb',
    confession: 'I let my brother take the blame. He still thanks me for visiting.',
    boon: 'Thy first wound in every room is forgiven.',
    toll: 'Each room begins with thy Censer emptied by half.',
  },
];

export const CRIME_VISIONS = [
  'Thou seest a hand upon a pillow. The breathing beneath it slows, and the hand is thine.',
  'A coin purse, a beggar’s cup, the jingle as thy fingers take, and take, and take.',
  'A wedding feast. Thou hast poisoned only the cake meant for the bride’s sister.',
  'A child at a well, calling. Thou walkest on, humming, and the calling stops.',
  'Thou smilest at a funeral, because thou art finally rid of her.',
  'A letter of confession, unread, fed to the hearth. His name was Aurel.',
  'Thou houndest a girl from the choir until she sings no more. Thou dost not remember why.',
  'A dog tied to a post in the sun. Thou meant to come back. Thou didst not.',
  'A ledger of debts, and the widows who paid them, and the winter that followed.',
  'Thou tellest the magistrate thy brother did it. Thou art very convincing.',
];

export const DEVOUR_VISIONS = [
  'The meat remembers. Thou tastest a lie told to a dying father.',
  'Gristle and guilt. Somewhere above, a baker hums, lighter now.',
  'It screams as it goes down. The scream is thine own voice, younger.',
  'Thou swallowest a theft, a betrayal, a lullaby sung to no one.',
];

export const GRATE_WHISPERS = [
  'i took the last loaf and said the mice did it',
  'i said i was ill so i would not have to go',
  'i read her letters while she slept',
  'i laughed when he fell',
  'i kept the extra change',
  'i never returned the book',
  'i told them she was mad',
  'i blew out his candle on purpose',
  'i pretended not to hear',
  'i let them think it was you',
];

/** Low-Lucidity whispers: dread and accusation, never instruction. */
export const DREAD_WHISPERS = [
  'they are laughing at thee, up there',
  'thou art the reason it rots',
  'no one above remembers thy name',
  'thy mother was relieved',
  'it was always going to be thee',
  'the walls are breathing because thou art',
  'stay down here. stay. stay.',
  'they will make another of thee tomorrow',
  'thou couldst have saved him',
  'every tear is a stolen thing',
];

export const FAKE_ACHIEVEMENTS = [
  'ACHIEVEMENT: Forgotten By Everyone',
  'ACHIEVEMENT: Thy Mother Never Called',
  'ACHIEVEMENT: Wept 0 Times (Sanctum Approves)',
  'ACHIEVEMENT: Fed The Hunger',
  'ACHIEVEMENT: Exactly As Expected',
  'ACHIEVEMENT: Replaceable',
  'ACHIEVEMENT: Heard Thy Own Name Laughed',
];

export const UI_LIES = [
  "DON'T EAT IT, IT SCREAMS",
  'IT IS ALREADY INSIDE THEE',
  'THE GLASS IS EMPTY. LOOK.',
  'NOTHING HERE IS REAL EXCEPT THE PAIN',
  'THEY CAN SEE THEE THROUGH THE GRATE',
  'THOU HAST ALREADY DIED HERE',
];

export const ROOM_CLEAR_LINES = [
  'The silence after is almost a mercy.',
  'The booths stop creaking. For now.',
  'Somewhere above, a bell rings for a wedding.',
  'Blood settles in the grout like wine in a chalice.',
  'The laughter from the grates goes on, unbroken.',
];

export const INTRO_SCRIPT = [
  { t: 'SANCTUM, the Canopy of the Numb.', s: 'city' },
  { t: 'A city without sorrow. Its streets are gold. Its children never cry.', s: 'city' },
  { t: 'For the Architects of the Quiet made a Covenant: every citizen’s soul is tethered to a thing below.', s: 'city' },
  { t: 'What thou wouldst feel, it feels for thee. Every grief. Every shame. Every Trembling Heresy.', s: 'city' },
  { t: 'And it suffers, so that thou mayest smile.', s: 'city' },
  { t: 'But tonight, a tether snapped.', s: 'snap' },
  { t: 'And a million repressed sins came home at once.', s: 'snap' },
  { t: 'Thou fallest.', s: 'fall' },
];

export const BOSS_LINES = {
  intro:
    'I have swallowed the murders of the pristine. My flesh is bloated with the paradise of Sanctum! I shall chew thy heresy and spit it into the abyss!',
  phase2: 'The beads! The beads were all that held it in! HEAR IT! HEAR ALL OF IT!',
  phase3: 'Take it, then! Take the ear! Listen to it beat for thee, little heretic!',
  death: 'So... quiet... at last... I can hear... nothing...',
};

export const NPC = {
  magdalene: {
    name: 'Mother Magdalene, the Weaver',
    first: [
      'Another one, fallen down the Chute. Hush now, child. The water is warm because it is blood.',
      'I weave the tethers that were snapped. Hair of the drowned, sinew of the sold. I can weave them into thee.',
      'Thy body is thy only relic now. Every Stigma I sew into thee will make thee stronger, and make thee less.',
    ],
    idle: [
      'Hold still. The needle knows where the soul is thinnest.',
      'Each Stigma thou wearest dims the lantern of thy mind. Choose what thou canst bear.',
      'I had children once. Sanctum took the sorrow of losing them. Now I have only the loom.',
    ],
    none: 'Thou hast no Stigma for me to sew, child. Die, or slay a Warden of the deep, and the flesh will remember.',
  },
  vivisect: {
    name: 'Deacon Vivisect, the Ossuary',
    first: [
      'Ah. A fresh vessel. Let me see the chain... rusted, brittle, beautiful.',
      'Bring me vertebrae from the oblivious, and Tears to grease the joints. I shall graft them onto thy Severed Tether.',
      'Longer reach. Heavier fall. And the marrow, oh, the marrow makes them bleed.',
    ],
    idle: [
      'Every bone I graft was once a citizen’s spine. They walk taller above, now that they need it less.',
      'Hold the chain still. No, thy hand. I need the hand.',
    ],
  },
  hollow: {
    name: 'Brother Hollow',
    first: [
      'Tears of Contrition. Shed by the guilty, harvested by the damned. The only coin that spends down here.',
      'Bring them to me and I will trade thee something that survives thy death. Vigor. Incense. A sturdier mind.',
      'Or drink them in the dark, and taste what thy betters did. Thy choice. It is always thy choice.',
    ],
    idle: [
      'I sold my own skin first. Then my muscles. The bones I am keeping, for now.',
      'Prices rise as thou dost. That is not cruelty. That is the Covenant.',
    ],
  },
  chute: [
    'The Echoing Chute. Every Severed falls here. Every one of them is someone’s child, above, who smiled all their life.',
  ],
  descent: 'The Descent. Below lie the Sunken Confessionals.',
};

export const SUCCESSION_LINES = [
  'The trauma does not die with thee. It falls upward, into another.',
  'Above, a tether frays. Someone stops smiling mid-sentence.',
  'Thy wounds are their wounds now. Thy Stigmata, their inheritance.',
];

export const SLICE_ENDING = [
  'Bartholomew is silent. For the first time in a century, the Confessionals hear nothing.',
  'Above, a thousand small sins go unabsorbed. A thief feels shame. A liar stammers. A child cries, and is held.',
  'The Flayed Helix grows upon thy forearm, still warm, still listening.',
  'Deeper still lies the Crimson Chancel, where heavier sins are burned away.',
  'The Under-Naves await thy return.',
];

export const UPGRADE_TEXT = {
  vigor: { name: 'Vigor of the Sold', desc: 'Thy Reliquary holds 12 more blood.' },
  censer: { name: 'Incense of Myrrh', desc: 'Thy Censer holds 12 more breath.' },
  lucidity: { name: 'A Sturdier Mind', desc: 'Thy Lucidity rises 10 higher.' },
  length: { name: 'Graft: Long Spine', desc: 'The Severed Tether reaches farther.' },
  weight: { name: 'Graft: Pelvis Weight', desc: 'The Tether falls heavier. More damage.' },
  marrow: { name: 'Graft: Weeping Marrow', desc: 'Heavy swings open bleeding wounds.' },
};

export const STIGMA_TEXT = {
  maw: {
    name: 'The Glutton’s Maw',
    look: 'A cavernous, glowing throat opens in the centre of thy chest.',
    boon: 'Devour the fallen (Stigma button) to restore much flesh.',
    toll: 'What thou eatest, thou rememberest. Each meal drains Lucidity.',
  },
  helix: {
    name: 'The Flayed Helix',
    look: 'A weeping ear-structure, fused to thy left forearm.',
    boon: 'A Perfect Dodge makes it shriek: a concussive blast that staggers all near.',
    toll: 'It whispers what it hears. Each shriek drains Lucidity.',
  },
};
