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

