import Phaser from 'phaser';
import { BuildingKind, BUILDING_FOOTPRINT } from '../../domain/building';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../../config';
import { TT_SHEET, buildingLayout, buildingFrame } from '../../rendering/frames';
import { worldPixelToTile } from './placementRules';

export type PlacementCallbacks = {
  /** true si le bâtiment peut être posé sur cette tuile (coin haut-gauche). */
  readonly isValid: (tileX: number, tileY: number) => boolean;
  readonly onConfirm: (coords: { x: number; y: number }) => void;
  readonly onCancel: () => void;
};

const GHOST_ALPHA = 0.6;
const VALID_COLOR = 0x33dd55;
const INVALID_COLOR = 0xdd3333;
const CONFIRM_MS = 180;

/**
 * Mode placement interactif : ghost semi-transparent qui suit le curseur,
 * surlignage vert/rouge, confirmation au clic gauche, annulation au clic
 * droit ou Échap. Possède tous ses GameObjects ; `destroy()` nettoie tout.
 */
export class PlacementController {
  private readonly ghost: Phaser.GameObjects.Container;
  private readonly highlight: Phaser.GameObjects.Rectangle;
  private readonly fpW: number;
  private readonly fpH: number;
  private tileX: number;
  private tileY: number;
  private valid: boolean;
  private finished = false;
  private readonly keyEsc: Phaser.Input.Keyboard.Key | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly kind: BuildingKind,
    initial: { x: number; y: number },
    private readonly cb: PlacementCallbacks,
  ) {
    const fp = BUILDING_FOOTPRINT[kind];
    this.fpW = fp.w;
    this.fpH = fp.h;
    this.tileX = initial.x;
    this.tileY = initial.y;

    this.highlight = scene.add
      .rectangle(0, 0, this.fpW * TILE_SIZE, this.fpH * TILE_SIZE, VALID_COLOR, 0.3)
      .setOrigin(0, 0)
      .setDepth(900);
    this.ghost = this.buildGhost();
    this.ghost.setDepth(901);

    this.valid = cb.isValid(this.tileX, this.tileY);
    this.sync();

    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerdown', this.onDown, this);
    this.keyEsc = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyEsc?.on('down', this.onEsc, this);
  }

  /** Container dont le point de transfert (0,0) est le CENTRE du footprint. */
  private buildGhost(): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);
    const halfW = (this.fpW * TILE_SIZE) / 2;
    const halfH = (this.fpH * TILE_SIZE) / 2;
    const layout = buildingLayout(this.kind);
    if (layout) {
      const rows = layout.length;
      const cols = layout[0]!.length;
      const cellW = (this.fpW * TILE_SIZE) / cols;
      const cellH = (this.fpH * TILE_SIZE) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const img = this.scene.add
            .image(c * cellW - halfW, r * cellH - halfH, TT_SHEET, layout[r]![c]!)
            .setOrigin(0, 0)
            .setDisplaySize(cellW, cellH);
          container.add(img);
        }
      }
    } else {
      const img = this.scene.add
        .image(-halfW, -halfH, TT_SHEET, buildingFrame(this.kind))
        .setOrigin(0, 0)
        .setDisplaySize(this.fpW * TILE_SIZE, this.fpH * TILE_SIZE);
      container.add(img);
    }
    container.setAlpha(GHOST_ALPHA);
    return container;
  }

  /** Repositionne ghost (centré) + surlignage (coin haut-gauche) sur la tuile courante. */
  private sync(): void {
    const px = this.tileX * TILE_SIZE;
    const py = this.tileY * TILE_SIZE;
    this.ghost.setPosition(px + (this.fpW * TILE_SIZE) / 2, py + (this.fpH * TILE_SIZE) / 2);
    this.highlight.setPosition(px, py);
    this.highlight.setFillStyle(this.valid ? VALID_COLOR : INVALID_COLOR, 0.3);
  }

  private setVisible(on: boolean): void {
    this.ghost.setVisible(on);
    this.highlight.setVisible(on);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.finished) return;
    const wp = this.scene.cameras.main.getWorldPoint(p.x, p.y);
    const t = worldPixelToTile(wp.x, wp.y);
    if (t.x < 0 || t.y < 0 || t.x >= MAP_WIDTH || t.y >= MAP_HEIGHT) {
      this.setVisible(false);
      return;
    }
    this.setVisible(true);
    this.tileX = t.x;
    this.tileY = t.y;
    this.valid = this.cb.isValid(t.x, t.y);
    this.sync();
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.finished) return;
    if (p.rightButtonDown()) {
      this.cancel();
      return;
    }
    if (!this.ghost.visible || !this.valid) return;
    this.confirm();
  }

  private onEsc(): void {
    if (this.finished) return;
    this.cancel();
  }

  /** Tween d'apparition sur le ghost, puis teardown + callback de confirmation. */
  private confirm(): void {
    this.finished = true;
    const coords = { x: this.tileX, y: this.tileY };
    this.ghost.setScale(0.85);
    this.scene.tweens.add({
      targets: this.ghost,
      alpha: 1,
      scale: 1,
      duration: CONFIRM_MS,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.destroy();
        this.cb.onConfirm(coords);
      },
    });
  }

  private cancel(): void {
    this.finished = true;
    this.destroy();
    this.cb.onCancel();
  }

  /** Retire tous les handlers et détruit ghost + surlignage. Idempotent en pratique. */
  destroy(): void {
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerdown', this.onDown, this);
    this.keyEsc?.off('down', this.onEsc, this);
    if (this.keyEsc) this.scene.input.keyboard?.removeKey(this.keyEsc);
    this.ghost.destroy(true);
    this.highlight.destroy();
  }
}
