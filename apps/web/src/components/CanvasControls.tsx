type CanvasControlsProps = {
  onAddSqlNode: () => void;
  onAddPythonNode: () => void;
  onDeleteSelection?: () => void;
};

export function CanvasControls({
  onAddSqlNode,
  onAddPythonNode,
  onDeleteSelection,
}: CanvasControlsProps) {
  return (
    <div className="canvas-controls">
      <div className="canvas-controls__bar canvas-controls__bar--compact">
        <div className="canvas-controls__segment">
          <div className="canvas-controls__group canvas-controls__group--tight">
            <button type="button" onClick={onAddSqlNode} className="canvas-controls__action">
              + SQL node
            </button>
            <button type="button" onClick={onAddPythonNode} className="canvas-controls__action">
              + Python node
            </button>
            {onDeleteSelection && (
              <button type="button" onClick={onDeleteSelection} className="canvas-controls__action">
                Delete selection
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

