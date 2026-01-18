export type PenPoint = [number, number, number]; // [x, y, pressure]

export type PenLine = {
  id: string;
  points: PenPoint[];
  color: string;
  width: number;
  initialSize: {
    width: number;
    height: number;
  };
};

export type PenNodeData = {
  points: PenPoint[];
  initialSize: {
    width: number;
    height: number;
  };
  color?: string;
  strokeWidth?: number;
  opacity?: number;
  smoothing?: number;
  thinning?: number;
};
