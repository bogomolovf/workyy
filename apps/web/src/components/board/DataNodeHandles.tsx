import { Handle, Position } from 'reactflow';

export const DATA_NODE_HANDLE_CLASS = '!h-3 !w-3 !bg-slate-400';

const dataNodeHandles = [
  { id: 'left', type: 'target' as const, position: Position.Left },
  { id: 'top', type: 'target' as const, position: Position.Top },
  { id: 'right', type: 'source' as const, position: Position.Right },
  { id: 'bottom', type: 'source' as const, position: Position.Bottom },
];

export function DataNodeHandles({ selected }: { selected?: boolean }) {
  return (
    <>
      {dataNodeHandles.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type={handle.type}
          position={handle.position}
          className={DATA_NODE_HANDLE_CLASS}
          data-handle-id={handle.id}
          style={{ opacity: selected ? 1 : 0, pointerEvents: selected ? 'auto' : 'none' }}
        />
      ))}
    </>
  );
}
