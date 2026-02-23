import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../socket';
import { GameStateData, CommanderInputData, CommanderStructureType, CommanderUnitType } from '../types';

interface Props { gameState: GameStateData; }

const MAP_W = 8000;
const MAP_H = 8000;
const FOG_COLS = 100;
const FOG_ROWS = 100;

const STRUCTURE_COSTS: Record<CommanderStructureType, number> = {
  base: 0, factory: 150, turret: 100, research: 200,
};
const UNIT_COSTS: Record<CommanderUnitType, number> = {
  attack: 60, mining: 40, scout: 30,
};

const MINI_W = 180;
const MINI_H = 180;

export default function CommanderView({ gameState }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState({ w: window.innerWidth - 220, h: window.innerHeight });
  const camRef = useRef({ x: 7000, y: 4000, zoom: 0.1 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 });
  const selBoxRef = useRef<{ active: boolean; x1: number; y1: number; x2: number; y2: number }>({ active: false, x1: 0, y1: 0, x2: 0, y2: 0 });
  const keysRef = useRef<Set<string>>(new Set());
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null);
  const [buildMode, setBuildMode] = useState<CommanderStructureType | null>(null);

  const panelW = 220;

  useEffect(() => {
    const onResize = () => setDims({ w: window.innerWidth - panelW, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // WASD pan
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key === 'Escape') setBuildMode(null);
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const interval = setInterval(() => {
      const k = keysRef.current;
      const cam = camRef.current;
      const BASE_PAN_SPEED = 400;
      const speed = BASE_PAN_SPEED / cam.zoom;
      const dt = 0.033;
      if (k.has('w') || k.has('arrowup'))    cam.y -= speed * dt;
      if (k.has('s') || k.has('arrowdown'))  cam.y += speed * dt;
      if (k.has('a') || k.has('arrowleft'))  cam.x -= speed * dt;
      if (k.has('d') || k.has('arrowright')) cam.x += speed * dt;
      cam.x = Math.max(0, Math.min(MAP_W, cam.x));
      cam.y = Math.max(0, Math.min(MAP_H, cam.y));
    }, 33);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      clearInterval(interval);
    };
  }, []);

  const toWorld = useCallback((sx: number, sy: number) => {
    const cam = camRef.current;
    return {
      x: (sx - dims.w / 2) / cam.zoom + cam.x,
      y: (sy - dims.h / 2) / cam.zoom + cam.y,
    };
  }, [dims]);

  const toScreen = useCallback((wx: number, wy: number) => {
    const cam = camRef.current;
    return {
      x: (wx - cam.x) * cam.zoom + dims.w / 2,
      y: (wy - cam.y) * cam.zoom + dims.h / 2,
    };
  }, [dims]);

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cam = camRef.current;
    const { w, h } = dims;
    const z = cam.zoom;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    // Stars
    ctx.fillStyle = '#ffffff22';
    for (let i = 0; i < 150; i++) {
      const sx = ((i * 137.5 * 3 - cam.x * 0.2) % w + w) % w;
      const sy = ((i * 97.3 * 3 - cam.y * 0.2) % h + h) % h;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fog of war - draw darkened overlay where not visible
    const fog = gameState.commanderFog;
    const cellW = MAP_W / FOG_COLS;
    const cellH = MAP_H / FOG_ROWS;

    for (let r = 0; r < FOG_ROWS; r++) {
      for (let c = 0; c < FOG_COLS; c++) {
        const cell = fog[r]?.[c];
        if (!cell) continue;
        const s = toScreen(c * cellW, r * cellH);
        const sw = cellW * z;
        const sh = cellH * z;
        if (s.x + sw < 0 || s.x > w || s.y + sh < 0 || s.y > h) continue;

        if (!cell.visible) {
          ctx.fillStyle = cell.revealed ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.92)';
          ctx.fillRect(s.x, s.y, sw + 1, sh + 1);
        }
      }
    }

    // Map border
    const tl = toScreen(0, 0);
    const br = toScreen(MAP_W, MAP_H);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 3;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    // Asteroids (only if visible in fog)
    for (const ast of gameState.asteroids) {
      const fc = Math.floor(ast.x / cellW);
      const fr = Math.floor(ast.y / cellH);
      const fogCell = fog[fr]?.[fc];
      if (fogCell && !fogCell.visible && !fogCell.revealed) continue;
      const s = toScreen(ast.x, ast.y);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(ast.angle);
      ctx.beginPath();
      if (ast.vertices.length >= 3) {
        ctx.moveTo(ast.vertices[0].x * z, ast.vertices[0].y * z);
        for (let i = 1; i < ast.vertices.length; i++) ctx.lineTo(ast.vertices[i].x * z, ast.vertices[i].y * z);
        ctx.closePath();
      }
      ctx.strokeStyle = ast.hasOre ? '#aa8820' : '#444';
      ctx.fillStyle = ast.hasOre ? '#1a1508' : '#111';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Ore chunks
    for (const chunk of gameState.oreChunks) {
      const s = toScreen(chunk.x, chunk.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4 * z, 0, Math.PI * 2);
      ctx.fillStyle = '#ffaa00';
      ctx.fill();
    }

    // Structures
    for (const struct of gameState.commanderStructures) {
      const s = toScreen(struct.x, struct.y);
      const sizes: Record<string, number> = { base: 60, factory: 35, turret: 25, research: 30 };
      const sz = (sizes[struct.type] || 30) * z;
      ctx.save();
      ctx.translate(s.x, s.y);

      const isSelected = selectedStructureId === struct.id;
      ctx.strokeStyle = isSelected ? '#ffffff' : '#ff4444';
      ctx.fillStyle = isSelected ? '#ff444422' : '#1a0000';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;

      if (struct.type === 'base') {
        ctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
        ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
      } else if (struct.type === 'turret') {
        ctx.beginPath(); ctx.arc(0, 0, sz, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(sz * 1.5, 0);
        ctx.strokeStyle = '#ff6666'; ctx.lineWidth = 3 * z; ctx.stroke();
      } else if (struct.type === 'factory') {
        ctx.fillRect(-sz, -sz * 0.7, sz * 2, sz * 1.4);
        ctx.strokeRect(-sz, -sz * 0.7, sz * 2, sz * 1.4);
      } else {
        ctx.beginPath(); ctx.arc(0, 0, sz, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0022'; ctx.strokeStyle = '#aa44ff'; ctx.fill(); ctx.stroke();
      }

      // Range circle (only for turret/base)
      if ((struct.type === 'turret' || struct.type === 'base') && isSelected) {
        ctx.beginPath();
        ctx.arc(0, 0, struct.range * z, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff444444';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Health bar
      const hpPct = struct.health / struct.maxHealth;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(-sz, sz + 3 * z, sz * 2, 4 * z);
      ctx.fillStyle = '#00ff41';
      ctx.fillRect(-sz, sz + 3 * z, sz * 2 * hpPct, 4 * z);

      // Build queue indicator
      if (struct.buildQueue.length > 0) {
        ctx.fillStyle = '#ffaa00';
        ctx.font = `${10 * z}px Courier New`;
        ctx.fillText(`[${struct.buildQueue.length}]`, -sz, -sz - 3 * z);
      }

      ctx.restore();
    }

    // Units
    for (const unit of gameState.commanderUnits) {
      const s = toScreen(unit.x, unit.y);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(unit.angle);
      const colors: Record<string, string> = { attack: '#ff4444', mining: '#ffaa00', scout: '#00bfff' };
      const color = colors[unit.type] || '#888';
      ctx.strokeStyle = unit.selected ? '#ffffff' : color;
      ctx.fillStyle = unit.selected ? '#ffffff22' : `${color}22`;
      ctx.lineWidth = unit.selected ? 2 : 1.5;
      const sz = 8 * z;
      if (unit.type === 'attack') {
        ctx.beginPath();
        ctx.moveTo(sz, 0); ctx.lineTo(-sz, sz * 0.6); ctx.lineTo(-sz * 0.5, 0); ctx.lineTo(-sz, -sz * 0.6);
        ctx.closePath();
      } else if (unit.type === 'mining') {
        ctx.beginPath(); ctx.rect(-sz * 0.8, -sz * 0.8, sz * 1.6, sz * 1.6);
      } else {
        ctx.beginPath(); ctx.arc(0, 0, sz * 0.7, 0, Math.PI * 2);
      }
      ctx.fill(); ctx.stroke();
      const hpPct = unit.health / unit.maxHealth;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(-sz, sz + 2 * z, sz * 2, 3 * z);
      ctx.fillStyle = '#00ff41';
      ctx.fillRect(-sz, sz + 2 * z, sz * 2 * hpPct, 3 * z);
      ctx.restore();
    }

    // Spaceship (always visible)
    const ship = gameState.spaceship;
    const ss = toScreen(ship.x, ship.y);
    ctx.save();
    ctx.translate(ss.x, ss.y);
    ctx.rotate(ship.angle);
    const sz2 = 20 * z;
    if (ship.shields > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, sz2 * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,191,255,${Math.min(0.3, ship.shields / ship.maxShields * 0.3)})`;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(sz2, 0); ctx.lineTo(-sz2 * 0.7, sz2 * 0.6); ctx.lineTo(-sz2 * 0.4, 0); ctx.lineTo(-sz2 * 0.7, -sz2 * 0.6);
    ctx.closePath();
    ctx.strokeStyle = '#00ff41'; ctx.fillStyle = '#0d1a0d'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
    ctx.restore();

    // Projectiles
    for (const proj of gameState.projectiles) {
      const s = toScreen(proj.x, proj.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2 * z, 0, Math.PI * 2);
      ctx.fillStyle = proj.ownerTeam === 'crew' ? '#00ff41' : '#ff4444';
      ctx.fill();
    }

    // Selection box
    const sel = selBoxRef.current;
    if (sel.active) {
      ctx.strokeStyle = '#00ff4188';
      ctx.fillStyle = '#00ff4111';
      ctx.lineWidth = 1;
      ctx.strokeRect(sel.x1, sel.y1, sel.x2 - sel.x1, sel.y2 - sel.y1);
      ctx.fillRect(sel.x1, sel.y1, sel.x2 - sel.x1, sel.y2 - sel.y1);
    }

    // Build mode ghost
    // (rendered in mousemove instead)

    // Minimap
    const msx = w - MINI_W - 8;
    const msy = h - MINI_H - 8;
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(msx, msy, MINI_W, MINI_H);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(msx, msy, MINI_W, MINI_H);

    const miniScale = MINI_W / MAP_W;
    // Fog on minimap
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    for (let r = 0; r < FOG_ROWS; r++) {
      for (let c = 0; c < FOG_COLS; c++) {
        if (fog[r]?.[c] && !fog[r][c].revealed) {
          ctx.fillRect(msx + c * (MINI_W / FOG_COLS), msy + r * (MINI_H / FOG_ROWS), MINI_W / FOG_COLS + 1, MINI_H / FOG_ROWS + 1);
        }
      }
    }

    // Units on minimap
    for (const u of gameState.commanderUnits) {
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(msx + u.x * miniScale - 1.5, msy + u.y * miniScale - 1.5, 3, 3);
    }
    for (const s of gameState.commanderStructures) {
      ctx.fillStyle = '#ff6666';
      ctx.fillRect(msx + s.x * miniScale - 3, msy + s.y * miniScale - 3, 6, 6);
    }
    // Ship on minimap
    ctx.fillStyle = '#00ff41';
    ctx.fillRect(msx + ship.x * miniScale - 2, msy + ship.y * miniScale - 2, 4, 4);

    // Camera viewport on minimap
    const vp = {
      x: msx + (cam.x - dims.w / (2 * z)) * miniScale,
      y: msy + (cam.y - dims.h / (2 * z)) * miniScale,
      w: (dims.w / z) * miniScale,
      h: (dims.h / z) * miniScale,
    };
    ctx.strokeStyle = '#ffffff44';
    ctx.lineWidth = 1;
    ctx.strokeRect(vp.x, vp.y, vp.w, vp.h);

  });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const cam = camRef.current;
    const factor = e.deltaY > 0 ? 0.85 : 1.15;
    const newZoom = Math.max(0.05, Math.min(1.5, cam.zoom * factor));
    // Zoom toward cursor
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldX = (mx - dims.w / 2) / cam.zoom + cam.x;
      const worldY = (my - dims.h / 2) / cam.zoom + cam.y;
      cam.x = worldX - (mx - dims.w / 2) / newZoom;
      cam.y = worldY - (my - dims.h / 2) / newZoom;
    }
    cam.zoom = newZoom;
  }, [dims]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      // Middle mouse pan start
      dragRef.current = {
        dragging: true,
        startX: e.clientX, startY: e.clientY,
        camStartX: camRef.current.x, camStartY: camRef.current.y,
      };
      return;
    }
    if (e.button === 2) {
      // Right click - move or build
      if (buildMode) return;
      const world = toWorld(e.clientX, e.clientY);
      const selected = gameState.commanderUnits.filter(u => u.selected);
      if (selected.length > 0) {
        const input: CommanderInputData = { type: 'move', position: world };
        socket.emit('commanderInput', input);
      }
      return;
    }
    if (e.button === 0) {
      if (buildMode) {
        const world = toWorld(e.clientX, e.clientY);
        const cost = STRUCTURE_COSTS[buildMode];
        if (gameState.commanderOre >= cost) {
          socket.emit('commanderInput', { type: 'build_structure', structureType: buildMode, position: world } as CommanderInputData);
        }
        setBuildMode(null);
        return;
      }

      // Check if clicking on structure
      const world = toWorld(e.clientX, e.clientY);
      const struct = gameState.commanderStructures.find(s => {
        const sizes: Record<string, number> = { base: 60, factory: 35, turret: 25, research: 30 };
        const sz = sizes[s.type] || 30;
        return Math.abs(s.x - world.x) < sz && Math.abs(s.y - world.y) < sz;
      });
      if (struct) {
        setSelectedStructureId(struct.id);
        // Deselect units
        socket.emit('commanderInput', { type: 'select', selectedIds: [] } as CommanderInputData);
        return;
      }

      // Start selection box
      setSelectedStructureId(null);
      selBoxRef.current = { active: true, x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY };
    }
  }, [buildMode, gameState, toWorld]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current.dragging) {
      const cam = camRef.current;
      const dx = (e.clientX - dragRef.current.startX) / cam.zoom;
      const dy = (e.clientY - dragRef.current.startY) / cam.zoom;
      cam.x = dragRef.current.camStartX - dx;
      cam.y = dragRef.current.camStartY - dy;
    }
    if (selBoxRef.current.active) {
      selBoxRef.current.x2 = e.clientX;
      selBoxRef.current.y2 = e.clientY;
    }
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      dragRef.current.dragging = false;
      return;
    }
    if (e.button === 0 && selBoxRef.current.active) {
      const sel = selBoxRef.current;
      selBoxRef.current = { ...sel, active: false };
      const w1 = toWorld(Math.min(sel.x1, sel.x2), Math.min(sel.y1, sel.y2));
      const w2 = toWorld(Math.max(sel.x1, sel.x2), Math.max(sel.y1, sel.y2));
      if (Math.abs(sel.x2 - sel.x1) > 5 || Math.abs(sel.y2 - sel.y1) > 5) {
        socket.emit('commanderInput', {
          type: 'select',
          selectionBox: { x1: w1.x, y1: w1.y, x2: w2.x, y2: w2.y },
        } as CommanderInputData);
      }
    }
  }, [toWorld]);

  const selectedStruct = selectedStructureId ? gameState.commanderStructures.find(s => s.id === selectedStructureId) : null;
  const selectedUnits = gameState.commanderUnits.filter(u => u.selected);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#0a0a0f', fontFamily: "'Courier New', Courier, monospace" }}>
      {/* Canvas */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={dims.w}
          height={dims.h}
          style={{ display: 'block', cursor: buildMode ? 'crosshair' : 'default' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={e => e.preventDefault()}
        />
        {/* HUD */}
        <div style={{ position: 'absolute', top: 12, left: 12, color: '#ff4444', fontSize: 13, pointerEvents: 'none' }}>
          <div>◆ COMMANDER STATION</div>
          <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>WASD/Arrows: Pan  Scroll: Zoom  MMB: Drag</div>
          <div style={{ color: '#888', fontSize: 11 }}>LMB: Select/Build  RMB: Move units</div>
        </div>
        {buildMode && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', color: '#ffaa00', fontSize: 13, background: '#0a0a0f99', padding: '4px 12px', border: '1px solid #ffaa00' }}>
            PLACING: {buildMode.toUpperCase()} — Click to place | ESC to cancel
          </div>
        )}
      </div>

      {/* Side panel */}
      <div style={{ width: panelW, background: '#0d0d1a', borderLeft: '1px solid #1a1a2e', padding: 12, overflowY: 'auto', color: '#888', fontSize: 12 }}>
        <div style={{ color: '#ff4444', fontSize: 14, marginBottom: 12 }}>◆ COMMAND CENTER</div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#ffaa00', fontSize: 14 }}>ORE: {gameState.commanderOre}</div>
          <div style={{ color: '#555', fontSize: 11 }}>TECH LVL: {gameState.techLevel}</div>
          <div style={{ color: '#555', fontSize: 11 }}>UNITS: {gameState.commanderUnits.length}</div>
          <div style={{ color: '#555', fontSize: 11 }}>STRUCTS: {gameState.commanderStructures.length}</div>
        </div>

        {/* Selected units info */}
        {selectedUnits.length > 0 && (
          <div style={{ marginBottom: 16, borderTop: '1px solid #1a1a2e', paddingTop: 10 }}>
            <div style={{ color: '#00bfff', marginBottom: 6 }}>SELECTED: {selectedUnits.length} unit(s)</div>
            {selectedUnits.slice(0, 5).map(u => (
              <div key={u.id} style={{ marginBottom: 4, fontSize: 11 }}>
                <span style={{ color: u.type === 'attack' ? '#ff4444' : u.type === 'mining' ? '#ffaa00' : '#00bfff' }}>
                  {u.type.toUpperCase()}
                </span>
                <span style={{ color: '#555' }}> HP:{u.health.toFixed(0)}/{u.maxHealth} {u.state}</span>
              </div>
            ))}
            {selectedUnits.length > 5 && <div style={{ color: '#555', fontSize: 11 }}>+{selectedUnits.length - 5} more</div>}
            <button onClick={() => socket.emit('commanderInput', { type: 'stop' } as CommanderInputData)}
              style={{ marginTop: 6, background: '#1a0000', border: '1px solid #ff4444', color: '#ff4444', padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
              STOP
            </button>
          </div>
        )}

        {/* Selected structure info */}
        {selectedStruct && (
          <div style={{ marginBottom: 16, borderTop: '1px solid #1a1a2e', paddingTop: 10 }}>
            <div style={{ color: '#ff4444', marginBottom: 6 }}>{selectedStruct.type.toUpperCase()}</div>
            <div style={{ fontSize: 11, marginBottom: 6 }}>HP: {selectedStruct.health.toFixed(0)}/{selectedStruct.maxHealth}</div>
            {(selectedStruct.type === 'base' || selectedStruct.type === 'factory') && (
              <>
                <div style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>BUILD QUEUE: {selectedStruct.buildQueue.length}</div>
                {(['attack', 'mining', 'scout'] as CommanderUnitType[]).map(type => (
                  <button key={type}
                    onClick={() => socket.emit('commanderInput', { type: 'build_unit', unitType: type, sourceStructureId: selectedStruct.id } as CommanderInputData)}
                    style={{ display: 'block', width: '100%', marginBottom: 4, background: '#0d0d1a', border: '1px solid #555', color: '#ccc', padding: '5px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                    {type.toUpperCase()} [{UNIT_COSTS[type]} ore]
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {/* Build structures */}
        <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: 10, marginBottom: 10 }}>
          <div style={{ color: '#ff4444', marginBottom: 8, fontSize: 12 }}>BUILD STRUCTURES</div>
          {(['factory', 'turret', 'research'] as CommanderStructureType[]).map(type => {
            const cost = STRUCTURE_COSTS[type];
            const canAfford = gameState.commanderOre >= cost;
            return (
              <button key={type}
                onClick={() => canAfford && setBuildMode(type)}
                style={{
                  display: 'block', width: '100%', marginBottom: 4,
                  background: buildMode === type ? '#1a0000' : '#0d0d1a',
                  border: `1px solid ${buildMode === type ? '#ff4444' : canAfford ? '#555' : '#2a2a2a'}`,
                  color: canAfford ? '#ccc' : '#444', padding: '5px', fontSize: 11,
                  cursor: canAfford ? 'pointer' : 'not-allowed', fontFamily: 'inherit', textAlign: 'left',
                }}>
                {type.toUpperCase()} [{cost} ore]
              </button>
            );
          })}
        </div>

        {/* Ship status */}
        <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: 10 }}>
          <div style={{ color: '#00ff41', marginBottom: 6, fontSize: 12 }}>CREW SHIP</div>
          <div style={{ fontSize: 11 }}>
            <div>HULL: {gameState.spaceship.health.toFixed(0)}/{gameState.spaceship.maxHealth}</div>
            <div style={{ width: '100%', height: 4, background: '#222', margin: '3px 0' }}>
              <div style={{ width: `${(gameState.spaceship.health / gameState.spaceship.maxHealth) * 100}%`, height: '100%', background: '#00ff41' }} />
            </div>
            <div>SHIELDS: {gameState.spaceship.shields.toFixed(0)}/{gameState.spaceship.maxShields}</div>
            <div style={{ width: '100%', height: 4, background: '#222', margin: '3px 0' }}>
              <div style={{ width: `${(gameState.spaceship.shields / gameState.spaceship.maxShields) * 100}%`, height: '100%', background: '#00bfff' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
