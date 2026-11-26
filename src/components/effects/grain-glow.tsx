'use client';
import { useEffect, useRef } from 'react';
import { useInView, useReducedMotion } from './use-motion';

/**
 * A speckled lime-to-olive glow that rises from the bottom of the hero.
 * One small WebGL fragment shader: fbm noise shapes the glow, per-pixel hash dithering turns it into grain.
 * Runs at ~30 fps only while visible; reduced motion draws one still frame; no WebGL means no glow.
 */
const vertex = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const fragment = `precision mediump float;
uniform vec2 r;uniform float t;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  vec2 p=vec2(uv.x*r.x/r.y,uv.y);
  float f=fbm(p*1.8+vec2(t*.04,-t*.07));
  float g=fbm(p*1.1-vec2(t*.025,0.)+f*1.4);
  float side=1.-.55*smoothstep(.0,.5,abs(uv.x-.5));
  float rise=smoothstep(.95,.05,uv.y+(g-.5)*.55)*side;
  float d=clamp(rise*(.45+.75*g),0.,1.);
  float grain=h(floor(gl_FragCoord.xy)+floor(t*30.)*vec2(1.7,9.2));
  float speck=step(grain,d*d*1.15);
  vec3 lime=vec3(.847,.984,.392);vec3 olive=vec3(.31,.42,.13);
  vec3 col=mix(lime,olive,smoothstep(.35,.9,d));
  float alpha=speck*(.4+.6*d);
  gl_FragColor=vec4(col*alpha,alpha);
}`;

export function GrainGlow() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const visible = useInView(canvas);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const gl = c.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
    if (!gl) { c.hidden = true; return; }
    const compile = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertex)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { c.hidden = true; return; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't');

    const resize = () => { // grain is drawn at CSS-pixel scale so specks stay crisp and cheap
      const w = Math.max(1, Math.round(c.clientWidth)), h = Math.max(1, Math.round(c.clientHeight));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; gl.viewport(0, 0, w, h); }
      gl.uniform2f(uR, w, h);
    };
    const draw = (t: number) => { resize(); gl.uniform1f(uT, t); gl.drawArrays(gl.TRIANGLES, 0, 3); };

    let raf = 0, last = 0;
    const start = performance.now();
    const cleanup = () => { cancelAnimationFrame(raf); gl.deleteProgram(prog); };
    if (reduce || !visible) { draw(12); return cleanup; }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return;
      last = now; draw((now - start) / 1000 + 12);
    };
    raf = requestAnimationFrame(loop);
    return cleanup;
  }, [reduce, visible]);

  return <canvas ref={canvas} className="grain-glow" aria-hidden="true"/>;
}
