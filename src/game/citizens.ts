import { mulberry32 } from '../art/pixel';

export interface Citizen {
  seed: number;
  name: string;
  occupation: string;
  bliss: string;
}

const NAMES = [
  'Ilse', 'Matthias', 'Agnes', 'Corvin', 'Benedikt', 'Oda', 'Lucan', 'Marthe', 'Seraphine', 'Tobiah',
  'Hesper', 'Anselm', 'Brigid', 'Dorian', 'Elske', 'Fenna', 'Gideon', 'Hilde', 'Ivo', 'Jorinde',
  'Kaspar', 'Liesel', 'Magnus', 'Nell', 'Osric', 'Perpetua', 'Quill', 'Rosalind', 'Silas', 'Thekla',
  'Ulric', 'Veronika', 'Wendel', 'Ysolde', 'Zacharias', 'Amabel', 'Bartok', 'Cosima', 'Desmond', 'Eulalie',
  'Florian', 'Grete', 'Hollis', 'Imke', 'Jasper', 'Klara', 'Leopold', 'Mina', 'Nikolai', 'Odile',
];

const SURNAMES = [
  'of the Lantern Row', 'of Seventh Bell', 'of the Gilt Steps', 'of Choirhouse Lane', 'of the Quiet Orchard',
  'of Marble Quay', 'of the Sunward Arcade', 'of Psalter Court', 'of the White Fountain', 'of Lily Close',
];

const OCCUPATIONS = [
  'baker', 'lamplighter', 'choir-child', 'notary', 'glassblower', 'midwife', 'gilder', 'tutor of hymns',
  'fountain-keeper', 'perfumer', 'bell-ringer', 'scribe of the Covenant', 'confectioner', 'florist',
  'portraitist', 'street-sweeper', 'cobbler', 'organist', 'weaver of white linen', 'keeper of doves',
];

const BLISS = [
  'has never wept.',
  'smiles in sleep, and does not know why.',
  'has forgotten a mother’s face, and is glad.',
  'sang at a funeral and felt nothing at all.',
  'believes pain is a rumour told to frighten children.',
  'has never once been afraid of the dark.',
  'walked past a drowning man, humming.',
  'loves everyone equally, and no one in particular.',
  'cannot remember a single bad day.',
  'keeps a diary of perfect afternoons, all identical.',
  'was told of grief once, and laughed politely.',
  'has not dreamt in eleven years.',
];

export function makeCitizen(seed: number): Citizen {
  const r = mulberry32(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  return {
    seed,
    name: `${pick(NAMES)} ${pick(SURNAMES)}`,
    occupation: pick(OCCUPATIONS),
    bliss: pick(BLISS),
  };
}

export function firstName(c: Citizen) {
  return c.name.split(' ')[0];
}
