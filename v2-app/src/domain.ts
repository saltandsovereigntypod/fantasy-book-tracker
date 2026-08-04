export type CardSize = 'small' | 'medium' | 'large';
export type ReadingStatus = 'want' | 'reading' | 'paused' | 'completed' | 'dnf';
export type BookFieldPath = 'title' | 'author' | 'series' | 'status' | 'progress' | 'rating' | 'spice' | 'impact' | 'reaction' | 'coverUrl';
export type CardActionType = 'profile' | 'edit' | 'favorite' | 'progress' | 'add-note' | 'start-reading' | 'finish-reading' | 'archive' | 'delete';
export type CardActionVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface CardAction {
  id: string;
  action: CardActionType;
  label: string;
  icon?: string;
  variant: CardActionVariant;
  background: string;
  color: string;
  borderColor: string;
  borderRadius: number;
  fontSize: number;
  visibleOn: CardSize[];
}

export interface BookNote {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingSession {
  id: string;
  startedAt: string;
  completedAt?: string;
  startProgress: number;
  endProgress: number;
  pagesRead?: number;
  minutesRead?: number;
  notes?: string;
}

export interface BookRelationship {
  id: string;
  targetBookId: string;
  type: string;
  explanation?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookRecord {
  id: string;
  title: string;
  author: string;
  series: string;
  status: ReadingStatus;
  progress: number;
  rating: number;
  spice: number;
  impact: number;
  reaction: string;
  coverUrl: string;
  summary?: string;
  about?: string;
  genres?: string[];
  tags?: string[];
  notes?: BookNote[];
  readingSessions?: ReadingSession[];
  relationships?: BookRelationship[];
  mindMapNodeIds: string[];
  wallCardIds: string[];
  theoryIds: string[];
  suspicionIds?: string[];
}

interface ElementBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  binding?: BookFieldPath;
  locked?: boolean;
  flipX?: boolean;
  flipY?: boolean;
  groupId?: string;
}

export interface TextElement extends ElementBase {
  type: 'text';
  text?: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  color: string;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
}

export interface ImageElement extends ElementBase {
  type: 'image';
  src?: string;
  fit?: 'cover' | 'contain';
  borderRadius?: number;
}

export interface ShapeElement extends ElementBase {
  type: 'shape';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
}

export interface ProgressElement extends ElementBase {
  type: 'progress';
  trackColor: string;
  fillColor: string;
  borderRadius?: number;
}

export interface RatingElement extends ElementBase {
  type: 'rating';
  metric: 'rating' | 'spice' | 'impact';
  label: string;
  icon: string;
  emptyIcon: string;
  color: string;
  fontFamily: string;
  fontSize: number;
}

export type DesignElement = TextElement | ImageElement | ShapeElement | ProgressElement | RatingElement;

export interface CardDesign {
  id: string;
  width: 420;
  height: 380;
  background: string;
  elements: DesignElement[];
  actions: CardAction[];
  version: number;
}

export interface WorkspaceState {
  book: BookRecord;
  design: CardDesign;
  selectedElementId: string | null;
  cardSize: CardSize;
  dirty: boolean;
}

export const CARD_WIDTHS: Record<CardSize, number> = {
  small: 300,
  medium: 420,
  large: 560,
};

export const FIELD_LABELS: Record<BookFieldPath, string> = {
  title: 'Title',
  author: 'Author',
  series: 'Series',
  status: 'Reading status',
  progress: 'Progress',
  rating: 'Overall rating',
  spice: 'Spice',
  impact: 'Emotional impact',
  reaction: 'Reaction',
  coverUrl: 'Cover image',
};
