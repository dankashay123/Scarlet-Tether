import Phaser from 'phaser';
import { P, hexNum } from '../art/palette';
import { FONT_OUTLINE } from '../art/font';
import { DEPTH } from '../game/config';
import { Room } from '../game/room';
import { Fx } from '../game/fx';
import { Player } from '../game/player';
import { buildPlayerSheet, lookFromSeed } from '../art/characters';
import { controls, hudState } from '../game/controls';
import { meta, maxHp, maxLucidity, maxStamina, save, startingLucidity, STIGMA_LUCIDITY_TOLL, type StigmaId } from '../game/state';
import { loop, sfx, stopLoop } from '../game/audio';
import { HUB_LAYOUT } from '../game/layouts';
import { NPC, STIGMA_TEXT, UPGRADE_TEXT } from '../game/lore';
import { plan } from '../game/run';
import { hud } from './HudScene';
import { pauseMenu } from '../ui/menus';
import type { Corpse, HitResult, World } from '../game/world';
import type { Enemy } from '../game/enemies';

interface Station {
  x: number;
  y: number;
  label: string;
  act: () => Promise<void>;
}

const MAX_GRAFT = 3;
const MAX_UPGRADE = 5;

export function graftCost(lvl: number) {
  return { vertebrae: (lvl + 1) * 2, tears: 15 * (lvl + 1) };
}
export function upgradeCost(lvl: number) {
  return Math.round(25 * Math.pow(lvl + 1, 1.35));
}

/** The Drain of Absolution: a cistern just beneath the golden streets. */
export class HubScene extends Phaser.Scene implements World {
  room!: Room;
  fx!: Fx;
  player!: Player;
  enemies: Enemy[] = [];
  corpses: Corpse[] = [];
  enemyTimeScale = 1;
  private stations: Station[] = [];
  private busy = false;
  private arrival: 'chute' | 'door' = 'chute';
  private laughT = 3;

  constructor() {
    super('Hub');
  }

  get sc(): Phaser.Scene {
    return this;
  }

  init(data: { arrival?: 'chute' | 'door' }) {
    this.arrival = data.arrival ?? 'chute';
    this.stations = [];
    this.busy = false;
  }

  create() {
    if (!this.scene.isActive('Hud')) this.scene.launch('Hud');
    this.scene.bringToTop('Hud');
    hudState.inRun = false;
    hudState.bossVisible = false;
    this.room = new Room(this, HUB_LAYOUT, 'cistern');
    this.fx = new Fx(this);
    const chute = this.room.find('H')[0];
    const door = this.room.find('D')[0];
    const start = this.arrival === 'chute' ? { x: chute.x + 40, y: chute.y + 40 } : { x: door.x, y: door.y + 30 };
    this.player = new Player(this, start.x, start.y);

    const cam = this.cameras.main;
    const bw = Math.max(this.room.pxW, this.scale.width);
    const bh = Math.max(this.room.pxH, this.scale.height);
    cam.setBounds((this.room.pxW - bw) / 2, (this.room.pxH - bh) / 2, bw, bh);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 12);
    cam.setBackgroundColor('#0b0507');
    cam.fadeIn(700, 11, 5, 7);
    if (cam.postFX) cam.postFX.addVignette(0.5, 0.5, 0.85, 0.35);

    this.buildScene();
    loop(this, 'amb_hub', 'amb');
    stopLoop(this, 'music');

    if (this.arrival === 'chute') this.fallIn(chute.x, chute.y);
    this.events.once('shutdown', () => {
      this.player.destroy();
      this.fx.destroy();
      this.room.destroy();
      hudState.interact = '';
    });
  }

  private buildScene() {
    const r = this.room;
    // Golden light falls through the street grates above
    for (let i = 0; i < 5; i++) {
      const x = 90 + i * 130 + (i % 2) * 30;
      const l = this.add.image(x, 30, 'grate-light').setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.light).setAlpha(0.55);
      this.tweens.add({ targets: l, alpha: 0.35, duration: 2200 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    for (const m of r.markers) {
      switch (m.ch) {
        case 'M': {
          this.add.sprite(m.x, m.y + 10, 'magdalene').setOrigin(0.5, 1).play('magdalene:idle').setDepth(DEPTH.actorBase + m.y);
          this.block(m.tx, m.ty, 2);
          this.add.image(m.x, m.y - 20, 'light-lg').setBlendMode(Phaser.BlendModes.ADD).setTint(hexNum(P.blood1)).setAlpha(0.25).setDepth(DEPTH.light);
          this.stations.push({ x: m.x, y: m.y + 22, label: 'Speak with the Weaver', act: () => this.magdalene() });
          break;
        }
        case 'O': {
          this.add.sprite(m.x, m.y + 8, 'vivisect').setOrigin(0.5, 1).play('vivisect:idle').setDepth(DEPTH.actorBase + m.y);
          this.block(m.tx, m.ty, 0);
          this.add.sprite(m.x - 22, m.y + 6, 'candle').setOrigin(0.5, 1).play('candle:flicker').setDepth(DEPTH.actorBase + m.y);
          this.add.image(m.x - 22, m.y - 4, 'light-sm').setBlendMode(Phaser.BlendModes.ADD).setTint(hexNum(P.candle)).setAlpha(0.5).setDepth(DEPTH.light);
          this.stations.push({ x: m.x, y: m.y + 18, label: 'Speak with the Deacon', act: () => this.vivisect() });
          break;
        }
        case 'L': {
          this.add.sprite(m.x, m.y + 8, 'hollow').setOrigin(0.5, 1).play('hollow:idle').setDepth(DEPTH.actorBase + m.y);
          this.block(m.tx, m.ty, 0);
          this.add.image(m.x, m.y - 10, 'light-sm').setBlendMode(Phaser.BlendModes.ADD).setTint(hexNum(P.tear1)).setAlpha(0.35).setDepth(DEPTH.light);
          this.stations.push({ x: m.x, y: m.y + 18, label: 'Trade with Brother Hollow', act: () => this.hollow() });
          break;
        }
        case 'W': {
          this.add.image(m.x, m.y + 8, 'lectern').setOrigin(0.5, 1).setDepth(DEPTH.actorBase + m.y);
          this.block(m.tx, m.ty, 0);
          this.stations.push({ x: m.x, y: m.y + 16, label: 'Read the Lineage', act: () => this.lineage() });
          break;
        }
        case 'D': {
          const s = this.add.sprite(m.x, m.y + 8, 'door').setOrigin(0.5, 1).setDepth(DEPTH.actorBase + m.y);
          s.play('door:open');
          this.add.image(m.x, m.y - 38, 'emblem-combat').setDepth(DEPTH.actorBase + m.y + 1);
          this.room.setSolid(m.tx, m.ty, false);
          this.stations.push({ x: m.x, y: m.y + 20, label: 'The Descent', act: () => this.descend() });
          break;
        }
        case 'H': {
          this.add.bitmapText(m.x, m.y - 14, FONT_OUTLINE, 'The Echoing Chute').setOrigin(0.5).setTint(hexNum(P.bone2)).setDepth(DEPTH.overlay - 5).setAlpha(0.7);
          break;
        }
      }
    }
  }

  private block(tx: number, ty: number, half: number) {
    for (let dx = -half; dx <= half; dx++) this.room.setSolid(tx + dx, ty, true);
  }

  private fallIn(x: number, y: number) {
    const p = this.player;
    p.lock(true);
    p.x = x;
    p.y = y;
    const s = p.sprite;
    s.play('player:roll');
    const fall = { z: 260 };
    this.tweens.add({
      targets: fall,
      z: 0,
      duration: 900,
      ease: 'Quad.In',
      onUpdate: () => s.setY(p.y - fall.z),
      onComplete: () => {
        sfx(this, 'hit_flesh', { rate: 0.6 });
        sfx(this, 'footstep_wet', { volume: 1.5, rate: 0.7 });
        this.fx.blood(x, y, 30, 0, 0, 1.2);
        this.fx.shake(250, 0.01);
        // Wade out of the pool
        this.tweens.add({
          targets: p,
          x: x + 40,
          y: y + 40,
          duration: 900,
          onComplete: () => {
            p.lock(false);
            this.greet();
          },
        });
      },
    });
  }

  private async greet() {
    const m = meta();
    if (!m.flags.hubIntro) {
      m.flags.hubIntro = true;
      save();
      await hud(this).dialog(NPC.magdalene.name, NPC.magdalene.first);
    } else hud(this).toast(`${m.citizen.name} wakes in the Drain`, P.bone1);
  }

  // -------------------------------------------------------------------------
  // World (the Drain is peaceful)
  // -------------------------------------------------------------------------
  noise() {}
  hitPlayer(): HitResult {
    return 'ignored';
  }
  addProjectile() {}
  spawnTears() {}
  onEnemyKilled() {}
  hitstop() {}
  slowEnemies() {}
  changeLucidity() {}
  addSmoke() {}
  vision() {}

  // -------------------------------------------------------------------------
  // Stations
  // -------------------------------------------------------------------------

  private async magdalene() {
    const m = meta();
    if (m.unlocked.length === 0) {
      await hud(this).dialog(NPC.magdalene.name, [Phaser.Utils.Array.GetRandom(NPC.magdalene.idle), NPC.magdalene.none]);
      return;
    }
    if (!m.flags.metMagdaleneStigma) {
      m.flags.metMagdaleneStigma = true;
      await hud(this).dialog(NPC.magdalene.name, [NPC.magdalene.first[2]]);
    }
    for (;;) {
      const opts = m.unlocked.map((id) => {
        const t = STIGMA_TEXT[id];
        const on = m.equipped.includes(id);
        return { label: `${on ? '✞ ' : ''}${t.name}${on ? ' (sewn)' : ''}`, desc: `${t.look} ${t.boon} Toll: ${t.toll}`, tint: on ? hexNum(P.blood0) : undefined };
      });
      const i = await hud(this).menu({
        title: 'The Loom of Hair',
        body: `Each Stigma sewn lowers thy starting Lucidity by ${STIGMA_LUCIDITY_TOLL}. Thou wouldst begin with ${startingLucidity()} of ${maxLucidity()}.`,
        options: opts,
        cancel: 'Enough',
        width: 440,
      });
      if (i < 0) break;
      const id = m.unlocked[i] as StigmaId;
      if (m.equipped.includes(id)) m.equipped = m.equipped.filter((e) => e !== id);
      else m.equipped.push(id);
      sfx(this, 'devour', { volume: 0.5, rate: 1.3 });
      save();
      this.rebuildPlayer();
    }
  }

  private rebuildPlayer() {
    // The body changes: redraw the citizen with their new Stigmata.
    const m = meta();
    const x = this.player.x;
    const y = this.player.y;
    this.player.destroy();
    buildPlayerSheet(this, lookFromSeed(m.citizen.seed, { maw: m.equipped.includes('maw'), helix: m.equipped.includes('helix') }));
    this.player = new Player(this, x, y);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 12);
    this.fx.blood(x, y - 12, 14);
  }

  private async vivisect() {
    const m = meta();
    if (!m.flags.metVivisect) {
      m.flags.metVivisect = true;
      await hud(this).dialog(NPC.vivisect.name, NPC.vivisect.first);
    }
    for (;;) {
      const keys = ['length', 'weight', 'marrow'] as const;
      const opts = keys.map((k) => {
        const lvl = m.weapon[k];
        const c = graftCost(lvl);
        const maxed = lvl >= MAX_GRAFT;
        const afford = m.vertebrae >= c.vertebrae && m.tears >= c.tears;
        return {
          label: `${UPGRADE_TEXT[k].name}  ${'✞'.repeat(lvl)}${'.'.repeat(MAX_GRAFT - lvl)}`,
          desc: maxed ? 'The spine can bear no more.' : `${UPGRADE_TEXT[k].desc} Cost: ${c.vertebrae} Vertebrae, ${c.tears} Tears.`,
          disabled: maxed || !afford,
        };
      });
      const i = await hud(this).menu({
        title: 'The Ossuary',
        body: `Thou hast ${m.vertebrae} Vertebrae and ${m.tears} Tears.`,
        options: opts,
        cancel: 'Leave the chain as it is',
        width: 420,
      });
      if (i < 0) break;
      const k = keys[i];
      const c = graftCost(m.weapon[k]);
      m.vertebrae -= c.vertebrae;
      m.tears -= c.tears;
      m.weapon[k]++;
      save();
      sfx(this, 'execute', { volume: 0.6 });
      this.fx.blood(this.player.x, this.player.y - 10, 10);
      await hud(this).dialog(NPC.vivisect.name, [Phaser.Utils.Array.GetRandom(NPC.vivisect.idle)]);
    }
  }

  private async hollow() {
    const m = meta();
    if (!m.flags.metHollow) {
      m.flags.metHollow = true;
      await hud(this).dialog(NPC.hollow.name, NPC.hollow.first);
    }
    for (;;) {
      const keys = ['vigor', 'censer', 'lucidity'] as const;
      const now = { vigor: `${maxHp()}`, censer: `${maxStamina()}`, lucidity: `${maxLucidity()}` };
      const opts = keys.map((k) => {
        const lvl = m.upgrades[k];
        const cost = upgradeCost(lvl);
        const maxed = lvl >= MAX_UPGRADE;
        return {
          label: `${UPGRADE_TEXT[k].name}  (${now[k]})`,
          desc: maxed ? 'Even Hollow has nothing more to sell.' : `${UPGRADE_TEXT[k].desc} Cost: ${cost} Tears.`,
          disabled: maxed || m.tears < cost,
        };
      });
      const i = await hud(this).menu({
        title: 'Brother Hollow’s Wares',
        body: `Thou hast ${m.tears} Tears of Contrition.`,
        options: opts,
        cancel: 'Keep thy Tears',
        width: 400,
      });
      if (i < 0) break;
      const k = keys[i];
      m.tears -= upgradeCost(m.upgrades[k]);
      m.upgrades[k]++;
      save();
      sfx(this, 'pickup_tear');
      await hud(this).dialog(NPC.hollow.name, [Phaser.Utils.Array.GetRandom(NPC.hollow.idle)]);
    }
  }

  private async lineage() {
    const m = meta();
    const lines = m.lineage.slice(-8).reverse().map((l) => `${l.name}, ${l.occupation}: ${l.fate}`);
    await hud(this).menu({
      title: 'The Lineage of the Severed',
      body:
        (lines.length ? lines.join('\n') : 'The first page is blank. Thine is the first name it will hold.') +
        `\n\nWeight of Sin carried: ${m.weightOfSin}. Deaths: ${m.deaths}. Wardens slain: ${m.bossKills}.`,
      options: [],
      cancel: 'Close the book',
      width: 460,
    });
  }

  private async descend() {
    const m = meta();
    const stig = m.equipped.length ? m.equipped.map((e) => STIGMA_TEXT[e].name).join(', ') : 'none';
    const i = await hud(this).menu({
      title: NPC.descent,
      body: `${m.citizen.name}. Flesh ${maxHp()}, Censer ${maxStamina()}, Lucidity ${startingLucidity()} of ${maxLucidity()}. Stigmata: ${stig}. Weight of Sin: ${m.weightOfSin}.`,
      options: [{ label: 'Descend' }],
      cancel: 'Not yet',
      width: 420,
    });
    if (i !== 0) return;
    m.runs++;
    save();
    sfx(this, 'door_open');
    plan.current = null;
    this.player.lock(true);
    this.cameras.main.fadeOut(700, 11, 5, 7);
    this.time.delayedCall(720, () => this.scene.start('Run', { fresh: true }));
  }

  update(_t: number, deltaMs: number) {
    const h = hud(this);
    if (!h || h.modal) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    if (controls.take('pause')) {
      pauseMenu(this, false);
      return;
    }
    this.player.update(dt);
    this.fx.update(dt);
    // Muffled joy from the street above
    this.laughT -= dt;
    if (this.laughT <= 0) {
      this.laughT = 9 + Math.random() * 10;
      sfx(this, 'bell_distant', { volume: 0.35, rate: 0.8 + Math.random() * 0.3 });
    }
    const near = this.stations.find((s) => Phaser.Math.Distance.Between(s.x, s.y, this.player.x, this.player.y) < 34);
    hudState.interact = near && !this.busy ? near.label : '';
    hudState.canExecute = false;
    if (near && !this.busy && controls.take('speak')) {
      this.busy = true;
      near.act().finally(() => (this.busy = false));
    }
    controls.take('speak');
  }
}
