import Phaser from 'phaser';

/**
 * The last pass over the play camera: snap every pixel to the SNES's 15-bit
 * colour (5 bits per channel), and band the colour a little further in the
 * darks, so lights, smoke and vignettes step like 16-bit colour math
 * instead of blending smoothly.
 */
const FRAG = `
precision mediump float;
uniform sampler2D uMainSampler;
varying vec2 outTexCoord;
void main() {
  vec4 c = texture2D(uMainSampler, outTexCoord);
  float l = dot(c.rgb, vec3(0.3, 0.55, 0.15));
  float steps = mix(12.0, 31.0, clamp(l * 1.6, 0.0, 1.0));
  c.rgb = floor(c.rgb * steps + 0.5) / steps;
  gl_FragColor = vec4(c.rgb, 1.0);
}`;

export class SnesPost extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({ game, name: 'SnesPost', fragShader: FRAG });
  }
}

export function addSnesPost(scene: Phaser.Scene) {
  if (!(scene.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
  scene.cameras.main.setPostPipeline(SnesPost);
}
