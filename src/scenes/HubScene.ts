import Phaser from 'phaser';
import { P, hexNum } from '../art/palette';
import { DEPTH } from '../game/config';
import { Level } from '../game/level';
import { Gore } from '../game/gore';
import { Backdrop } from '../game/backdrop';
import { Dressing } from '../game/dressing';
import { NPC_SIZES } from '../art/creatures';
import { Fx } from '../game/fx';
import { Player } from '../game/player';
import { buildHeroSheet } from '../art/hero';
import { lookFromSeed } from '../art/look';
import { controls, hudState } from '../game/controls';
import { meta, maxHp, maxLucidity, maxStamina, save, startingLucidity, STIGMA_LUCIDITY_TOLL, type StigmaId } from '../game/state';
import { loop, sfx, stopLoop } from '../game/audio';
import { HUB_LAYOUT } from '../game/layouts';
import { NPC, STIGMA_TEXT, UPGRADE_TEXT } from '../game/lore';
import { descent } from '../game/run';
import { hud } from './HudScene';
import { pauseMenu } from '../ui/menus';
import type { Corpse, HitResult, World } from '../game/world';
import type { Enemy } from '../game/enemies';
import { txt } from '../ui/text';

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
  level!: Level;
  fx!: Fx;
  gore!: Gore;
  private backdrop!: Backdrop;
  private dressing!: Dressing;
  private leaving = false;
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
    this.leaving = false;
    if (!this.scene.isActive('Hud')) this.scene.launch('Hud');
    this.scene.bringToTop('Hud');
    hudState.inRun = false;
    hudState.bossVisible = false;
    hudState.depth = -1;
    this.backdrop = new Backdrop(this, 'cistern');
    this.level = new Level(this, HUB_LAYOUT, 'cistern');
    this.dressing = new Dressing(this, this.level, [{ x0: 0, y0: 0, x1: this.level.w - 1, y1: this.level.h - 1, theme: 'cistern' }], 7, {
      blocked: (tx, ty) => this.level.markers.some((m) => Math.abs(m.tx - tx) <= 3 && Math.abs(m.ty - ty) <= 1 && 'HMOLWc'.includes(m.ch)),
    });
    this.gore = new Gore(this, this.level);
    this.fx = new Fx(this);
    const chute = this.level.find('H')[0];
    const door = this.level.find('D')[0];
    const start = this.arrival === 'chute' ? { x: chute.x, y: chute.y } : { x: door.x - 30, y: door.y };
    this.player = new Player(this, start.x, start.y);

    const cam = this.cameras.main;
    const bw = Math.max(this.level.pxW, this.scale.width);
    const bh = Math.max(this.level.pxH, this.scale.height);
    cam.setBounds((this.level.pxW - bw) / 2, (this.level.pxH - bh) / 2, bw, bh);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 30);
    cam.setDeadzone(40, 30);
    cam.setBackgroundColor('#0b0507');
    cam.fadeIn(700, 11, 5, 7);
    if (cam.postFX) cam.postFX.addVignette(0.5, 0.5, 0.85, 0.35);

    this.buildScene();
    loop(this, 'amb_hub', 'amb');
    stopLoop(this, 'music');

    if (this.arrival === 'chute') this.fallIn();
    this.events.once('shutdown', () => {
      this.player.destroy();
      this.gore.destroy();
      this.level.destroy();
      this.backdrop.destroy();
      hudState.interact = '';
    });
  }

  private light(x: number, y: number, key: string, color: string, alpha: number) {
    return this.add.image(x, y, key).setBlendMode(Phaser.BlendModes.ADD).setTint(hexNum(color)).setAlpha(alpha).setDepth(DEPTH.light);
  }

  private buildScene() {
    const L = this.level;
    // Golden light falls through the street grates above, with the
    // muffled joy of Sanctum.
    for (let x = 140; x < L.pxW - 60; x += 190) {
      const l = this.add.image(x, 16, 'prop-grate-light').setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.light).setAlpha(0.7);
      this.tweens.add({ targets: l, alpha: 0.4, duration: 2400 + x, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    for (const m of L.markers) {
      switch (m.ch) {
        case 'M':
          this.add.sprite(m.x, m.y, 'magdalene').setOrigin(0.5, NPC_SIZES.magdalene.footY / NPC_SIZES.magdalene.h).play('magdalene:idle').setDepth(DEPTH.props + 3);
          this.light(m.x, m.y - 60, 'light-lg', P.blood1, 0.3);
          this.stations.push({ x: m.x, y: m.y, label: 'Speak with the Weaver', act: () => this.magdalene() });
          break;
        case 'O':
          this.add.sprite(m.x, m.y, 'vivisect').setOrigin(0.5, NPC_SIZES.vivisect.footY / NPC_SIZES.vivisect.h).play('vivisect:idle').setDepth(DEPTH.props + 3).setFlipX(true);
          this.add.sprite(m.x - 34, m.y, 'candelabra').setOrigin(0.5, 1).play('candelabra:flicker').setDepth(DEPTH.props + 2);
          this.light(m.x - 34, m.y - 40, 'light-lg', P.candle, 0.4);
          this.stations.push({ x: m.x, y: m.y, label: 'Speak with the Deacon', act: () => this.vivisect() });
          break;
        case 'L':
          this.add.sprite(m.x, m.y, 'hollow').setOrigin(0.5, NPC_SIZES.hollow.footY / NPC_SIZES.hollow.h).play('hollow:idle').setDepth(DEPTH.props + 3);
          this.light(m.x, m.y - 40, 'light-sm', P.tear1, 0.4);
          this.stations.push({ x: m.x, y: m.y, label: 'Trade with Brother Hollow', act: () => this.hollow() });
          break;
        case 'W':
          this.add.image(m.x, m.y, 'prop-lectern').setOrigin(0.5, 1).setDepth(DEPTH.props + 3);
          this.light(m.x, m.y - 30, 'light-sm', P.candle, 0.3);
          this.stations.push({ x: m.x, y: m.y, label: 'Read the Lineage', act: () => this.lineage() });
          break;
        case 'c':
          this.add.sprite(m.x, m.y, 'candelabra').setOrigin(0.5, 1).play('candelabra:flicker').setDepth(DEPTH.props + 2);
          this.light(m.x, m.y - 40, 'light-lg', P.candle, 0.4);
          break;
        case 'D': {
          const s = this.add.sprite(m.x, m.y, 'door').setOrigin(0.5, 1).setDepth(DEPTH.props + 2);
          s.play('door:open');
          this.add.image(m.x, m.y - 80, 'emblem-combat').setDepth(DEPTH.props + 3);
          this.stations.push({ x: m.x, y: m.y, label: 'The Descent', act: () => this.descend() });
          break;
        }
        case 'H':
          txt(this, m.x + 30, m.y + 6, 'The Echoing Chute', 'head', 10).setOrigin(0, 0.5).setTint(hexNum(P.bone2)).setDepth(DEPTH.overlay - 5).setAlpha(0.7);
          this.light(m.x, m.y + 10, 'light-lg', P.blood0, 0.2);
          break;
      }
    }
  }

  /** Newly severed citizens plummet down the Chute into the bloody water. */
  private fallIn() {
    const p = this.player;
    p.lock(true);
    p.body.vy = 80;
    const check = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!p.grounded) return;
        check.remove();
        sfx(this, 'hit_flesh', { rate: 0.6 });
        sfx(this, 'footstep_wet', { volume: 1.5, rate: 0.7 });
        this.gore.burst(p.x, p.y - 6, 40, 1.1);
        this.fx.shake(250, 0.012);
        this.time.delayedCall(700, () => {
          p.lock(false);
          this.greet();
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
    buildHeroSheet(this, lookFromSeed(m.citizen.seed, { maw: m.equipped.includes('maw'), helix: m.equipped.includes('helix') }));
    this.player = new Player(this, x, y);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 30);
    this.gore.burst(x, y - 30, 20);
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
      this.gore.spray(this.player.x, this.player.y - 30, -Math.PI / 2, 12, 0.8);
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
    if (i !== 0 || this.leaving) return;
    this.leaving = true;
    m.runs++;
    save();
    sfx(this, 'door_open');
    descent.reset();
    this.player.lock(true);
    this.cameras.main.fadeOut(700, 11, 5, 7);
    this.time.delayedCall(720, () => this.scene.start('Run', { fresh: true }));
  }

  update(_t: number, deltaMs: number) {
    const h = hud(this);
    this.backdrop.update();
    this.dressing.update();
    if (!h || h.modal) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    if (controls.take('pause')) {
      pauseMenu(this, false);
      return;
    }
    this.player.update(dt);
    this.gore.update(dt);
    // Muffled joy from the street above
    this.laughT -= dt;
    if (this.laughT <= 0) {
      this.laughT = 9 + Math.random() * 10;
      sfx(this, 'bell_distant', { volume: 0.35, rate: 0.8 + Math.random() * 0.3 });
    }
    const near = this.stations.find((s) => Math.abs(s.x - this.player.x) < 34 && Math.abs(s.y - this.player.y) < 30);
    hudState.interact = near && !this.busy ? near.label : '';
    hudState.canExecute = false;
    if (near && !this.busy && !this.leaving && controls.take('speak')) {
      this.busy = true;
      near.act().finally(() => (this.busy = false));
    }
    controls.take('speak');
  }
}
