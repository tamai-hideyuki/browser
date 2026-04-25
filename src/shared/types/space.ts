import type { SpaceId } from './tab';

export type Space = {
  id: SpaceId;
  name: string;
  icon: string | null;
  position: number;
  createdAt: number;
  updatedAt: number;
};
