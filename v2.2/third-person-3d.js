/* ASTERFALL THIRD-PERSON 3D — WebGL2 scene; no dependencies or remote assets.
 * Retains the legacy Asterfall gameplay model and save data; only controls/rendering are replaced.
 */
(()=>{
'use strict';
const oldCanvas=document.getElementById('game');
const view=document.createElement('canvas');view.id='asterfall-3d';view.setAttribute('aria-label','3D third-person interactive view of Serenova and Terravelle');
view.style.cssText='position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none;z-index:0;cursor:grab';
oldCanvas.insertAdjacentElement('afterend',view);
const gl=view.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance'});
if(!gl){view.remove();console.warn('Asterfall: WebGL2 unavailable; original isometric renderer retained.');return;}
oldCanvas.style.display='none';
let yaw=0.7,pitch=0.49,distance=17,dragging=false,moved=false,startX=0,startY=0,ptrX=0,ptrY=0;
let desired=null,animation=0,renderClock=0,refreshClock=0;const follow=[100,1,82];
let lastWorld='';let terrainMesh=null,staticMesh=null,resourcesMesh=null,peopleMesh=null,placementsMesh=null,playerMesh=null;
const UP=[0,1,0], MAX_VIEW=105;
try{const pref=JSON.parse(localStorage.getItem('asterfall_camera_v1')||'null');if(pref){yaw=pref.yaw??yaw;pitch=pref.pitch??pitch;distance=pref.distance??distance}}catch(_){ }
function saveCamera(){try{localStorage.setItem('asterfall_camera_v1',JSON.stringify({yaw,pitch,distance}))}catch(_){}}
const help=document.createElement('aside');help.id='camera-guide';help.innerHTML='<strong>✦ SERENOVA · CHAPTER I</strong><span>WASD · walk &nbsp; Shift · sprint</span><span>Drag · orbit camera &nbsp; Scroll · zoom</span><span>E · interact &nbsp; M · atlas &nbsp; Esc · menu</span><button type="button" id="reset-camera">↺ Reset camera</button>';
help.style.cssText='position:fixed;bottom:126px;right:23px;z-index:4;padding:12px 15px;display:none;gap:4px;flex-direction:column;border:1px solid #d6b78099;background:#102821d9;color:#f6e9cb;border-radius:12px;font:12px/1.6 Segoe UI,sans-serif;box-shadow:0 9px 30px #07190daa;pointer-events:auto;backdrop-filter:blur(8px)';
help.querySelector('strong').style.cssText='font-size:10px;letter-spacing:.09em;color:#e9c78b';help.querySelector('button').style.cssText='margin-top:5px;padding:6px 10px;background:#335545;border:1px solid #d7b98588;color:#fff1cd;border-radius:7px;cursor:pointer';
document.body.appendChild(help);help.querySelector('button').addEventListener('click',()=>{yaw=.7;pitch=.49;distance=17;saveCamera()});
const legend=document.createElement('div');legend.id='view-mode';legend.textContent='ASTERFALL 2.2 • THIRD PERSON';legend.style.cssText='position:fixed;bottom:91px;right:25px;z-index:3;font:9px Segoe UI,sans-serif;letter-spacing:.14em;color:#e4d6b5;background:#17362ec9;padding:5px 9px;border:1px solid #c8a87566;border-radius:5px;pointer-events:none';document.body.appendChild(legend);
const vert=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
uniform mat4 uVP;
uniform vec3 uEye;
uniform float uTime;
out vec3 vColor;
out float vFog;
out float vHeight;
void main(){vec3 pos=aPos;gl_Position=uVP*vec4(pos,1.0);vec3 N=normalize(aNormal);vec3 sun=normalize(vec3(-.42,.82,.40));float diffuse=max(dot(N,sun),.0);float shade=.66+.34*floor(diffuse*3.0+0.5)/3.0;vColor=aColor*shade;vHeight=pos.y;vFog=clamp((distance(pos,uEye)-40.0)/136.0,0.0,.91);}`;
const frag=`#version 300 es
precision highp float;
in vec3 vColor;
in float vFog;
in float vHeight;
uniform float uTime;
out vec4 frag;
void main(){vec3 color=vColor;float soft=sin(gl_FragCoord.y*.10+uTime*.5)*.004;color+=soft;vec3 haze=vec3(.73,.82,.79);frag=vec4(mix(color,haze,vFog),1.);}`;
function shader(type,source){let s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,vert));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog));gl.useProgram(prog);const locVP=gl.getUniformLocation(prog,'uVP'),locEye=gl.getUniformLocation(prog,'uEye'),locTime=gl.getUniformLocation(prog,'uTime');gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
function persp(fov,aspect,near,far){let f=1/Math.tan(fov/2),m=new Float32Array(16);m[0]=f/aspect;m[5]=f;m[10]=(far+near)/(near-far);m[11]=-1;m[14]=2*far*near/(near-far);return m}
function look(eye,center,up){let z=norm(sub(eye,center)),x=norm(cross(up,z)),y=cross(z,x),m=new Float32Array(16);m[0]=x[0];m[1]=y[0];m[2]=z[0];m[4]=x[1];m[5]=y[1];m[6]=z[1];m[8]=x[2];m[9]=y[2];m[10]=z[2];m[12]=-dot(x,eye);m[13]=-dot(y,eye);m[14]=-dot(z,eye);m[15]=1;return m}
function mult(a,b){let r=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)r[col*4+row]+=a[k*4+row]*b[col*4+k];return r}
const sub=(a,b)=>a.map((n,i)=>n-b[i]),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=v=>{let l=Math.hypot(...v)||1;return v.map(x=>x/l)};
function rgb(hex){hex=String(hex||'#709574').replace('#','');if(hex.length===3)hex=hex.split('').map(x=>x+x).join('');return [parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4,6),16)/255]}
function tint(c,f){let v=rgb(c);return v.map(x=>Math.max(.015,Math.min(.98,x*f)))}
const groundPalette={grass:'#87a76e',dry:'#b5ae70',flowers:'#86ae7d',forest:'#557b57',hill:'#859476',field:'#cfbe77',town:'#bfb08b',road:'#cfb790',river:'#5498ac',riverbank:'#8db7a3',sea:'#398da8',shore:'#e7d0a5',void:'#7e9f83'};
const near0=(x,z)=>Math.hypot(x-100,z-83);
function elev(x,z){let typ=tile(x,z);if(typ==='sea'||typ==='river')return -.28;if(near0(x,z)<13)return .24;const hill=(typ==='hill'||typ==='forest')?1:0;let h=.3+noise(x*.026,z*.026,7)*.85+(noise(x*.079,z*.079,13)-.5)*.35+hill*.58;
return Math.max(-.1,h)}
function ground(x,z){return elev(Math.max(1,Math.min(W-2,x)),Math.max(1,Math.min(H-2,z)))}
class Batch{constructor(){this.p=[];this.n=[];this.c=[]}tri(a,b,c,col){let n=norm(cross(sub(b,a),sub(c,a)));for(let v of [a,b,c]){this.p.push(...v);this.n.push(...n);this.c.push(...col)}}quad(a,b,c,d,col){this.tri(a,b,c,col);this.tri(a,c,d,col)}box(x,y,z,w,h,d,color){let X=x+w/2,A=x-w/2,Z=z+d/2,B=z-d/2,T=y+h,bot=y;let p=[[A,bot,B],[X,bot,B],[X,T,B],[A,T,B],[A,bot,Z],[X,bot,Z],[X,T,Z],[A,T,Z]];let fs=[[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]];for(let i=0;i<6;i++){let f=fs[i];this.quad(p[f[0]],p[f[1]],p[f[2]],p[f[3]],tint(color,i===4?1.04:i===5?.77:i===2?.84:1))}}
cone(x,y,z,r,h,color,sides=7,angle=0){let top=[x,y+h,z];for(let i=0;i<sides;i++){let a=angle+i*2*Math.PI/sides,b=angle+(i+1)*2*Math.PI/sides;this.tri([x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],top,tint(color,i%3===0?.90:i%3===1?1.04:.98))}}
cylinder(x,y,z,r,h,color,n=8){for(let i=0;i<n;i++){let a=2*Math.PI*i/n,b=2*Math.PI*(i+1)/n;this.quad([x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],[x+Math.cos(b)*r,y+h,z+Math.sin(b)*r],[x+Math.cos(a)*r,y+h,z+Math.sin(a)*r],tint(color,i%2?.9:1.06))}}
roof(x,y,z,w,d,h,color){let A=x-w/2,X=x+w/2,B=z-d/2,Z=z+d/2,peak=y+h;this.quad([A,y,B-.2],[x,peak,B-.2],[x,peak,Z+.2],[A,y,Z+.2],tint(color,1));this.quad([x,peak,B-.2],[X,y,B-.2],[X,y,Z+.2],[x,peak,Z+.2],tint(color,.78));this.tri([A,y,B],[X,y,B],[x,peak,B],tint(color,.68));this.tri([X,y,Z],[A,y,Z],[x,peak,Z],tint(color,.73))}
icosa(x,y,z,r,color){this.cone(x,y-r*.75,z,r,r*1.6,color,7);this.cone(x,y+r*.25,z,r*.67,r*.92,color,7)}
}
function mesh(batch){if(!batch||!batch.p.length)return null;let vao=gl.createVertexArray();gl.bindVertexArray(vao);let arrays=[batch.p,batch.n,batch.c],buffers=[];for(let i=0;i<3;i++){let b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arrays[i]),gl.STATIC_DRAW);gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,0,0)}gl.bindVertexArray(null);return {vao,count:batch.p.length/3,buffers:buffers}}
function dispose(m){if(m){gl.deleteVertexArray(m.vao);for(const b of m.buffers||[])gl.deleteBuffer(b)}}
function draw(m){if(!m)return;gl.bindVertexArray(m.vao);gl.drawArrays(gl.TRIANGLES,0,m.count)}
function makeTerrain(){let B=new Batch();let step=1.55;for(let z=0;z<H-1;z+=step)for(let x=0;x<W-1;x+=step){const c=tile(x+.7,z+.7),base=groundPalette[c]||groundPalette.grass;let v=.92+noise(x*.125,z*.125,8)*.18,clr=tint(base,v),x1=Math.min(W-1,x+step),z1=Math.min(H-1,z+step);let a=[x,elev(x,z),z],b=[x1,elev(x1,z),z],d=[x,elev(x,z1),z1],cc=[x1,elev(x1,z1),z1];B.quad(a,d,cc,b,clr)}terrainMesh=mesh(B)}
function shrub(B,x,z,k){let y=ground(x,z);B.icosa(x,y+.42,z,.42,k||'#73956b')}
function makeStatic(){let B=new Batch();for(const b of buildings){let x=b.x,z=b.y,y=ground(x,z);if(['ward','gate'].includes(b.type)){B.box(x,y,z,.4,4,.4,'#cdc2a5');B.box(x,y+3.8,z,1,.23,1,'#c5b38d');if(b.type==='ward')B.icosa(x,y+4.5,z,.7,'#75c4c2');else B.box(x,y+1.5,z,.55,.7,.55,'#c6a76e');continue}
const w=(b.type==='inn'||b.type==='manor')?5.8:4.4,d=(b.type==='inn'||b.type==='manor')?4.9:3.5,h=b.type==='manor'?4.6:3.35;
B.box(x,y,z,w,h,d,b.type==='workshop'?'#b4a48b':'#f1dec4');B.roof(x,y+h,z,w+.65,d+.6,1.7,b.type==='manor'?'#76897c':b.type==='inn'?'#b76e50':'#bf7653');B.box(x,y+.15,z+d/2+.03,1.05,2,.1,'#6d5542');for(let dx of [-w*.32,w*.32])B.box(x+dx,y+1.7,z+d/2+.08,.72,.85,.13,'#78adc0');B.box(x+w*.35,y+h+.7,z-.6,.48,1.5,.48,'#c4b6a2');
if(b.type==='manor'){for(let dx of [-w*.36,w*.36]){B.cylinder(x+dx,y,z+d*.66,.23,3.6,'#eadabe');B.cone(x+dx,y+3.6,z+d*.66,.66,1.25,'#a46a54') }} }
for(const [a,b] of roadSegments){let dx=b[0]-a[0],dz=b[1]-a[1],dist=Math.hypot(dx,dz),steps=Math.ceil(dist/1.9);for(let s=0;s<steps;s++){let u=(s+.5)/steps,x=a[0]+dx*u,z=a[1]+dz*u,y=ground(x,z)+.045;B.box(x,y,z,2.2,.03,2.2,'#c7b592')}}
for(let i=0;i<610;i++){let x=3+rand(i,17)*179,z=3+rand(i,31)*146;if(near0(x,z)<9||tile(x,z)==='river'||tile(x,z)==='sea'||buildings.some(b=>Math.hypot(x-b.x,z-b.y)<3))continue;let typ=tile(x,z);if((typ==='grass'||typ==='flowers'||typ==='forest')&&rand(i,71)>.39){let c=rand(i,14)>.75?'#d8b87d':rand(i,21)>.6?'#dfe2b7':'#619479';shrub(B,x,z,c)}}
staticMesh=mesh(B)}
function makeResources(){let B=new Batch(),r2=MAX_VIEW*MAX_VIEW,px=player.x,pz=player.y;for(const r of resources){if(!r.available||(r.x-px)**2+(r.y-pz)**2>r2)continue;let x=r.x,z=r.y,y=ground(x,z);if(r.kind==='tree'){let v=(r.variation||.5),sc=.9+v*.85;B.cylinder(x,y,z,.18*sc,2.7*sc,'#775b3d',7);if(v<.66){for(let a=0;a<3;a++)B.cone(x,y+1.5*sc+a*.72*sc,z,(1.65-a*.25)*sc,(2.3-a*.08)*sc,a%2?'#386a55':'#2e644b',7)}else {B.icosa(x,y+3.5*sc,z,1.6*sc,'#538a5e');B.icosa(x+.72*sc,y+3.1*sc,z,1.1*sc,'#5c9c67')}}else if(r.kind==='stone'){B.icosa(x,y+.53,z,.72,'#a5aba2');B.icosa(x+.46,y+.25,z+.30,.38,'#7e918c')}else if(r.kind==='herb'){for(let i=0;i<3;i++)B.cone(x+Math.cos(i*2)*.27,y,z+Math.sin(i*2)*.25,.30,.65,'#448b68',5)}else if(r.kind==='fruit'){B.icosa(x,y+.43,z,.47,'#d9a458');B.cone(x,y+.6,z,.28,.32,'#588a53',5)}}dispose(resourcesMesh);resourcesMesh=mesh(B)}
// Asterfall 2.2: anime-inspired layered adventurer, retaining gameplay state.
function person(B,x,z,skin,coat,walking=0,heading=0,playerChar=false){
 const y=ground(x,z),s=skin||'#c78c68',c=coat||'#587363',hair=playerChar?'#302832':'#544036',linen='#f1e5d0',gold='#cda765';
 const step=walking?Math.sin(animation*10)*.22:Math.sin(animation*2.1)*.025,sway=Math.sin(animation*2+x)*.035;
 for(let side of [-1,1]){let dz=side*step;
  B.box(x+side*.20,y+.10,z+dz,.29,.35,.43,'#42332e');
  B.box(x+side*.20,y+.39,z+dz*.85,.24,.53,.27,'#5a4840');
  B.box(x+side*.20,y+.78,z+dz*.44,.34,.36,.32,'#4a4544');
  B.box(x+side*.53,y+1.18+side*step*.35,z+sway,.21,.83,.26,linen);
  B.box(x+side*.54,y+1.06+side*step*.35,z+sway,.25,.25,.31,'#715541');
  B.box(x+side*.54,y+.95+side*step*.35,z+sway,.21,.20,.28,s);
 }
 B.cone(x,y+.65,z,.64,1.1,c,10,heading);
 B.cone(x,y+.80,z,.69,.22,gold,10,heading);
 B.box(x,y+1.05,z,.70,.79,.41,linen);
 B.box(x,y+1.08,z+.23,.59,.10,.12,'#684732');
 B.box(x,y+1.35,z+.24,.23,.44,.12,c);
 B.box(x,y+1.30,z+.315,.09,.25,.08,gold);
 B.box(x,y+1.65,z,.89,.25,.45,c);
 B.box(x,y+1.77,z+.10,.72,.19,.52,'#e7dbcb');
 B.box(x,y+1.78,z-.33,.66,.16,.14,playerChar?'#34475b':'#536659');
 B.box(x+.35,y+1.46,z-.34,.15,.45,.13,'#825c3a');
 B.box(x+.36,y+1.39,z-.36,.12,.18,.17,gold);
 B.cylinder(x,y+1.85,z,.17,.22,s,10);
 B.icosa(x,y+2.17,z,.43,s);
 B.icosa(x,y+2.34,z-.15,.44,hair);
 B.cone(x,y+2.15,z-.16,.45,.55,hair,11,heading);
 for(let side of [-1,1]){
  B.cone(x+side*.34,y+1.91,z+.03,.17,.59,hair,6);
  B.box(x+side*.19,y+2.15,z+.375,.13,.095,.09,'#fbfbf2');
  B.box(x+side*.19,y+2.16,z+.430,.072,.082,.042,playerChar?'#547c76':'#745d4c');
  B.box(x+side*.19,y+2.22,z+.437,.16,.033,.03,'#302b31');
 }
 B.box(x,y+2.01,z+.43,.17,.025,.03,'#915c52');
 B.cone(x-.15,y+2.29,z+.22,.25,.45,hair,6,.2);
 B.cone(x+.20,y+2.46,z-.04,.15,.32,hair,6);
 if(playerChar){
  B.box(x,y+1.50,z-.49,.67,.64,.13,'#354657');
  B.cone(x,y+1.2,z-.49,.38,.5,'#354657',7);
  B.box(x-.37,y+1.12,z+.20,.32,.51,.23,'#74513b');
  B.box(x-.36,y+1.17,z+.36,.32,.08,.08,gold);
 }
}
function makePeople(){let B=new Batch();for(const n of npcs){let p=npcPosition(n);person(B,p.x,p.y,n.color,n.coat,.1,0,false)}dispose(peopleMesh);peopleMesh=mesh(B)}
function makePlayer(){let B=new Batch();person(B,player.x,player.y,skins[player.skin]||skins[3],cloaks[player.cloak]||cloaks[0],playerMoving,heading,true);dispose(playerMesh);playerMesh=mesh(B)}
function makePlacements(){let B=new Batch();for(const p of player.placements||[]){let x=p.x,z=p.y,y=ground(x,z);if(p.type==='campfire'){for(let n=0;n<8;n++){let a=n*Math.PI/4;B.icosa(x+Math.cos(a)*.7,y+.15,z+Math.sin(a)*.7,.25,'#a49b83')}B.cone(x,y+.1,z,.6,1.4,'#eaab5b')}else if(p.type==='cottage'){B.box(x,y,z,4,3.1,3.4,'#d9c5a5');B.roof(x,y+3.1,z,4.4,3.8,1.4,'#a46d58')}else {B.box(x,y,z,2,1.1,1.4,p.type==='planter'?'#a98555':'#8c785b')}}dispose(placementsMesh);placementsMesh=mesh(B)}
function freshWorld(){makeTerrain();makeStatic();makeResources();makePlacements();lastWorld='ready'}
function resize(){let r=Math.min(window.devicePixelRatio||1,1.65),w=Math.max(2,Math.floor(innerWidth*r)),h=Math.max(2,Math.floor(innerHeight*r));if(view.width!==w||view.height!==h){view.width=w;view.height=h;gl.viewport(0,0,w,h)}}
function getEye(){const center=[follow[0],follow[1]+1.4,follow[2]];return [center[0]+Math.sin(yaw)*Math.cos(pitch)*distance,center[1]+Math.sin(pitch)*distance,center[2]+Math.cos(yaw)*Math.cos(pitch)*distance]}
function viewProj(){let eye=getEye(),at=[follow[0],follow[1]+1.4,follow[2]],p=persp(Math.PI/3.6,view.width/view.height,.075,250);return {vp:mult(p,look(eye,at,UP)),eye}}
function findGroundClick(clientX,clientY){const {vp,eye}=viewProj();const rect=view.getBoundingClientRect();let nx=2*(clientX-rect.left)/rect.width-1,ny=1-2*(clientY-rect.top)/rect.height;let forward=norm(sub([follow[0],follow[1]+1.4,follow[2]],eye)),right=norm(cross(forward,UP)),up=cross(right,forward);let fov=Math.PI/3.6,aspect=rect.width/rect.height,dir=norm([forward[0]+right[0]*nx*Math.tan(fov/2)*aspect+up[0]*ny*Math.tan(fov/2),forward[1]+right[1]*nx*Math.tan(fov/2)*aspect+up[1]*ny*Math.tan(fov/2),forward[2]+right[2]*nx*Math.tan(fov/2)*aspect+up[2]*ny*Math.tan(fov/2)]);if(dir[1]>=-.01)return null;let scale=(ground(eye[0],eye[2])-eye[1])/dir[1];if(scale<0||scale>250)return null;let x=Math.max(1,Math.min(W-2,eye[0]+dir[0]*scale)),z=Math.max(1,Math.min(H-2,eye[2]+dir[2]*scale));return {x,y:z}}
view.addEventListener('pointerdown',e=>{if(state!=='playing'||openPanel)return;if(e.button!==0&&e.button!==2)return;dragging=true;moved=false;startX=ptrX=e.clientX;startY=ptrY=e.clientY;view.setPointerCapture(e.pointerId);view.style.cursor='grabbing'});
view.addEventListener('pointermove',e=>{if(!dragging)return;let dx=e.clientX-ptrX,dy=e.clientY-ptrY;ptrX=e.clientX;ptrY=e.clientY;if(Math.hypot(e.clientX-startX,e.clientY-startY)>4)moved=true;if(moved){yaw-=dx*.006;pitch=Math.max(.12,Math.min(1.15,pitch+dy*.0045));saveCamera()}});
view.addEventListener('pointerup',e=>{if(!dragging)return;dragging=false;view.style.cursor='grab';if(!moved&&state==='playing'&&!openPanel){let p=findGroundClick(e.clientX,e.clientY);if(p)desired=p}});
view.addEventListener('pointercancel',()=>{dragging=false});view.addEventListener('contextmenu',e=>e.preventDefault());
view.addEventListener('wheel',e=>{if(state!=='playing'||openPanel)return;e.preventDefault();distance=Math.max(5.5,Math.min(32,distance*(e.deltaY>0?1.11:.90)));saveCamera()},{passive:false});
let touchDist=0;view.addEventListener('touchmove',e=>{if(e.touches.length===2){let a=e.touches[0],b=e.touches[1],d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);if(touchDist)distance=Math.max(5.5,Math.min(32,distance*touchDist/d));touchDist=d;saveCamera()}},{passive:false});view.addEventListener('touchend',()=>touchDist=0);
window.addEventListener('keydown',e=>{if(state!=='playing'||openPanel)return;if(e.key==='+'||e.key==='='){distance=Math.max(5.5,distance*.90);saveCamera()}if(e.key==='-'){distance=Math.min(32,distance*1.11);saveCamera()}if(e.key==='r'||e.key==='R'){yaw=.7;pitch=.49;distance=17;saveCamera()}},true);
const legacyUpdate=update;let playerMoving=false,heading=0,oldPlacementCount=-1,lastRefreshX=Infinity,lastRefreshZ=Infinity;
update=function(dt){
  const was={};for(const k of ['w','a','s','d','ArrowUp','ArrowLeft','ArrowRight','ArrowDown','Shift']){was[k]=keys[k];keys[k]=false}const holdPointer=pointerTarget;pointerTarget=null;
  legacyUpdate(dt);
  for(const k in was)keys[k]=was[k];pointerTarget=null;
  if(state==='playing'&&!openPanel){
    let fw=(was.w||was.ArrowUp?1:0)-(was.s||was.ArrowDown?1:0),side=(was.d||was.ArrowRight?1:0)-(was.a||was.ArrowLeft?1:0),dx=0,dz=0;
    if(fw||side){desired=null;dx=-Math.sin(yaw)*fw+Math.cos(yaw)*side;dz=-Math.cos(yaw)*fw-Math.sin(yaw)*side}
    else if(desired){let xx=desired.x-player.x,zz=desired.y-player.y,rr=Math.hypot(xx,zz);if(rr>.8){dx=xx/rr;dz=zz/rr}else desired=null}
    playerMoving=!!(dx||dz);
    if(playerMoving){let m=Math.hypot(dx,dz)||1,spd=(was.Shift&&player.stamina>4?7.5:4.8)*dt,px=dx/m*spd,pz=dz/m*spd;let nx=player.x+px,nz=player.y+pz;if(!blocked(nx,player.y))player.x=clamp(nx,1,W-2);if(!blocked(player.x,nz))player.y=clamp(nz,1,H-2);player.steps+=Math.hypot(px,pz);player.stamina=clamp(player.stamina-(was.Shift?9:1.5)*dt,0,100);heading=Math.atan2(dx,dz)}
    if(frameCount%14===0)renderHud();
  }else playerMoving=false;
  if(Math.hypot(player.x-lastRefreshX,player.y-lastRefreshZ)>12||t-refreshClock>4){makeResources();lastRefreshX=player.x;lastRefreshZ=player.y;refreshClock=t}
};
const oldGather=gather;gather=function(...args){const result=oldGather(...args);makeResources();return result};
const oldStart=startGame;startGame=function(...args){oldStart(...args);if(state==='playing'){desired=null;follow[0]=player.x;follow[1]=ground(player.x,player.y);follow[2]=player.y;makeResources();makePlacements();renderHud()}};
const oldSave=saveGame;saveGame=function(...args){saveCamera();return oldSave(...args)};
const originalDraw=drawWorld;
function draw3d(){
 resize();if(!terrainMesh)freshWorld();renderClock+=.016;
 if(state==='playing'){help.style.display=innerWidth>760?'flex':'none';legend.style.display='block'}else{help.style.display='none';legend.style.display='none'}
 let k=Math.min(.24,1/11);follow[0]+=(player.x-follow[0])*k;follow[2]+=(player.y-follow[2])*k;follow[1]+=(ground(player.x,player.y)-follow[1])*k;
 animation+=.016;
 if(state==='playing'&&(oldPlacementCount!==(player.placements||[]).length)){makePlacements();oldPlacementCount=player.placements.length}
 if(frameCount%5===0)makePeople();if(frameCount%3===0)makePlayer();gl.clearColor(.71,.81,.82,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(prog);let cam=viewProj();gl.uniformMatrix4fv(locVP,false,cam.vp);gl.uniform3fv(locEye,cam.eye);gl.uniform1f(locTime,animation);
 draw(terrainMesh);draw(staticMesh);draw(resourcesMesh);draw(placementsMesh);draw(peopleMesh);draw(playerMesh);gl.bindVertexArray(null)
}
drawWorld=function(){try{draw3d()}catch(e){console.error('3D renderer fallback',e);oldCanvas.style.display='block';view.style.display='none';drawWorld=originalDraw;originalDraw()}};
const tip=$('play-tutorial');if(tip){tip.innerHTML='Welcome to <strong>Serenova Barony</strong>. Use <strong>WASD</strong> to walk, <strong>drag</strong> to rotate the 3D camera, <strong>scroll</strong> to zoom, and press <strong>E</strong> near residents and resources. Start by meeting <strong>Maren</strong> the village steward. <button class="btn small" onclick="this.parentElement.classList.add(\'hidden\')">Begin exploring</button>'}
const h=document.querySelector('#help .control-grid');if(h)h.insertAdjacentHTML('beforeend','<span class="keycap">Drag</span><span>Rotate your third-person camera around the character</span><span class="keycap">R</span><span>Reset the camera behind the traveler</span><span class="keycap">WASD</span><span>Walk in the direction the camera faces</span>');
window.asterfall3d={render:draw3d,mode:'webgl2',getCamera:()=>({yaw,pitch,distance})};
})();