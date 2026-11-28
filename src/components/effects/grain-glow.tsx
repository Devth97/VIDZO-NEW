'use client';
import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from './use-motion';

/**
 * A speckled lime-to-olive glow that rises from the bottom of the hero.
 * One small WebGL fragment shader: fbm noise shapes the glow, per-pixel hash dithering turns it into grain.
 * Runs at ~30 fps only while visible; reduced motion draws one still frame; no WebGL means no glow.
 */
const vertex = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const fragment = `precision mediump float;
uniform vec2 r;uniform vec2 mouse;uniform float t;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  vec2 p=vec2(uv.x*r.x/r.y,uv.y);
  vec2 cursor=vec2(mouse.x*r.x/r.y,mouse.y);
  p+=(p-cursor)*exp(-length(p-cursor)*2.5)*.22;
  float f=fbm(p*1.8+vec2(t*.04,-t*.07));
  float g=fbm(p*1.1-vec2(t*.025,0.)+f*1.4);
  float side=1.-.55*smoothstep(.0,.5,abs(uv.x-.5));
  float rise=(1.-smoothstep(.05,.95,uv.y+(g-.5)*.55))*side;
  float d=clamp(rise*(.45+.75*g),0.,1.);
  float grain=h(floor(gl_FragCoord.xy)+floor(t*14.)*vec2(1.7,9.2));
  float speck=step(grain,d*d*1.15);
  vec3 lime=vec3(.82,.94,.43);vec3 olive=vec3(.38,.49,.23);
  vec3 col=mix(lime,olive,smoothstep(.35,.9,d));
  float ribbon=exp(-abs(uv.y-.44-sin(p.x*1.55+t*.12+g*.8)*.12)*14.);
  float alpha=clamp(speck*(.2+.3*d)+d*.10+ribbon*.14,0.,.65);
  gl_FragColor=vec4(col*alpha,alpha);
}`;

export function GrainGlow() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const visible = useInView(canvas);
  const [contextVersion, setContextVersion] = useState(0);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const gl = c.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
    c.dataset.shader = 'fallback';
    if (!gl) return;
    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src); gl.compileShader(shader);
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
      gl.deleteShader(shader); return null;
    };
    const vert = compile(gl.VERTEX_SHADER, vertex), frag = compile(gl.FRAGMENT_SHADER, fragment);
    const prog = gl.createProgram(), buffer = gl.createBuffer();
    const release = () => { if (prog) gl.deleteProgram(prog); if (buffer) gl.deleteBuffer(buffer); if (vert) gl.deleteShader(vert); if (frag) gl.deleteShader(frag); };
    if (!prog || !buffer || !vert || !frag) { release(); return; }
    gl.attachShader(prog, vert); gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { release(); return; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't'), uMouse = gl.getUniformLocation(prog, 'mouse');
    const pointer = { x: .5, y: .5, tx: .5, ty: .5 };

    const resize = () => { // grain is drawn at CSS-pixel scale so specks stay crisp and cheap
      const scale = Math.min(1, 1440 / Math.max(c.clientWidth, 1), 900 / Math.max(c.clientHeight, 1));
      const w = Math.max(1, Math.round(c.clientWidth * scale)), h = Math.max(1, Math.round(c.clientHeight * scale));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; gl.viewport(0, 0, w, h); }
      gl.uniform2f(uR, w, h);
    };
    const draw = (time: number) => {
      resize(); pointer.x += (pointer.tx - pointer.x) * .08; pointer.y += (pointer.ty - pointer.y) * .08;
      gl.uniform2f(uMouse, pointer.x, pointer.y); gl.uniform1f(uT, time); gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    let raf = 0, last = 0;
    const start = performance.now();
    let lost = false;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return;
      last = now; draw((now - start) / 1000 + 12);
    };
    const sync = () => {
      cancelAnimationFrame(raf);
      if (lost) return;
      c.dataset.motion = reduce ? 'static' : visible && !document.hidden ? 'running' : 'offscreen';
      draw((performance.now() - start) / 1000 + 12);
      if (!reduce && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const move = (event: PointerEvent) => {
      if (reduce) return;
      const bounds = c.getBoundingClientRect();
      pointer.tx = Math.min(1, Math.max(0, (event.clientX - bounds.left) / Math.max(bounds.width, 1)));
      pointer.ty = 1 - Math.min(1, Math.max(0, (event.clientY - bounds.top) / Math.max(bounds.height, 1)));
    };
    const leave = () => { pointer.tx = .5; pointer.ty = .5; };
    const onLost = (event: Event) => { event.preventDefault(); lost = true; cancelAnimationFrame(raf); c.dataset.shader = 'fallback'; c.dataset.motion = 'static'; };
    const onRestored = () => setContextVersion(version => version + 1);
    const parent = c.parentElement;
    parent?.addEventListener('pointermove', move);
    parent?.addEventListener('pointerleave', leave);
    c.addEventListener('webglcontextlost', onLost);
    c.addEventListener('webglcontextrestored', onRestored);
    document.addEventListener('visibilitychange', sync);
    const observer = new ResizeObserver(() => { if (!lost) draw((performance.now() - start) / 1000 + 12); });
    observer.observe(c);
    c.dataset.shader = 'ready'; sync();
    return () => {
      cancelAnimationFrame(raf); observer.disconnect();
      parent?.removeEventListener('pointermove', move); parent?.removeEventListener('pointerleave', leave);
      c.removeEventListener('webglcontextlost', onLost); c.removeEventListener('webglcontextrestored', onRestored);
      document.removeEventListener('visibilitychange', sync); release();
    };
  }, [reduce, visible, contextVersion]);

  return <canvas ref={canvas} className="grain-glow" aria-hidden="true"/>;
}
