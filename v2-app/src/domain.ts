export type CardSize = 'small' | 'medium' | 'large';
export type ReadingStatus = 'want' | 'reading' | 'paused' | 'completed' | 'dnf';
export type BookFieldPath = 'title' | 'author' | 'series' | 'status' | 'progress' | 'rating' | 'spice' | 'impact' | 'reaction' | 'coverUrl';
export type TheoryStatus = 'open' | 'confirmed' | 'disproven' | 'dormant';
export type SuspicionStatus = 'open' | 'resolved' | 'dismissed';
export type WallDossierCategory = 'character' | 'location' | 'faction' | 'object' | 'event' | 'creature' | 'custom';
export type WallSourceType = 'book' | 'theory' | 'suspicion' | 'dossier';
export type WallCardKind = 'home' | 'reference';
export type WallRegionRule = 'manual' | 'any' | 'book' | 'theory' | 'suspicion' | 'dossier' | 'open-investigation' | 'resolved-investigation';
export type WallRegionLayout = 'free' | 'grid' | 'list';
export type WallRegionSort = 'manual' | 'alphabetical' | 'updated' | 'confidence';

export interface BookNote { id: string; text: string; createdAt: string; updatedAt: string; }
export interface ReadingSession { id: string; startedAt: string; completedAt?: string; startProgress: number; endProgress: number; pagesRead?: number; minutesRead?: number; notes?: string; }
export interface BookRelationship { id: string; targetBookId: string; type: string; explanation?: string; notes?: string; createdAt: string; updatedAt: string; }
export interface EvidenceNote { id: string; text: string; createdAt: string; }
export interface InvestigationRevision { id: string; editedAt: string; title: string; body: string; confidence: number; status: TheoryStatus | SuspicionStatus; bookIds: string[]; }
export interface TheoryRecord { id: string; title: string; statement: string; status: TheoryStatus; confidence: number; bookIds: string[]; evidence: EvidenceNote[]; history: InvestigationRevision[]; createdAt: string; updatedAt: string; }
export interface SuspicionRecord { id: string; title: string; details: string; status: SuspicionStatus; confidence: number; bookIds: string[]; evidence: EvidenceNote[]; history: InvestigationRevision[]; createdAt: string; updatedAt: string; }
export interface WallDossierRecord {
  id: string;
  category: WallDossierCategory;
  title: string;
  shortSummary: string;
  overview: string;
  notes?: string;
  bookIds: string[];
  theoryIds: string[];
  suspicionIds: string[];
  dossierIds: string[];
  createdAt: string;
  updatedAt: string;
}
export interface WallCardRecord { id: string; sourceType: WallSourceType; sourceId: string; kind: WallCardKind; homeCardId?: string; x: number; y: number; width: number; height: number; regionId?: string; note?: string; color?: string; createdAt: string; updatedAt: string; }
export interface WallRegionRecord { id: string; title: string; description?: string; x: number; y: number; width: number; height: number; color: string; rule: WallRegionRule; autoSort: boolean; collapsed?: boolean; locked?: boolean; layout?: WallRegionLayout; sort?: WallRegionSort; createdAt: string; updatedAt: string; }
export interface WallRecord { id: string; title: string; cards: WallCardRecord[]; regions: WallRegionRecord[]; canvasWidth: number; canvasHeight: number; createdAt: string; updatedAt: string; }

export interface BookRecord {
  id: string; title: string; author: string; series: string; status: ReadingStatus; progress: number; rating: number; spice: number; impact: number; reaction: string; coverUrl: string;
  summary?: string; about?: string; genres?: string[]; tags?: string[]; notes?: BookNote[]; readingSessions?: ReadingSession[]; relationships?: BookRelationship[];
  mindMapNodeIds: string[]; wallCardIds: string[]; theoryIds: string[]; suspicionIds?: string[];
}

interface ElementBase { id: string; x: number; y: number; width: number; height: number; rotation?: number; opacity?: number; binding?: BookFieldPath; locked?: boolean; flipX?: boolean; flipY?: boolean; groupId?: string; }
export interface TextElement extends ElementBase { type: 'text'; text?: string; fontFamily: string; fontSize: number; fontWeight?: number; fontStyle?: 'normal' | 'italic'; textDecoration?: 'none' | 'underline' | 'line-through'; color: string; textAlign?: 'left' | 'center' | 'right'; lineHeight?: number; }
export interface ImageElement extends ElementBase { type: 'image'; src?: string; fit?: 'cover' | 'contain'; borderRadius?: number; }
export interface ShapeElement extends ElementBase { type: 'shape'; fill: string; stroke?: string; strokeWidth?: number; borderRadius?: number; }
export interface ProgressElement extends ElementBase { type: 'progress'; trackColor: string; fillColor: string; borderRadius?: number; }
export interface RatingElement extends ElementBase { type: 'rating'; metric: 'rating' | 'spice' | 'impact'; label: string; icon: string; emptyIcon: string; color: string; fontFamily: string; fontSize: number; }
export type DesignElement = TextElement | ImageElement | ShapeElement | ProgressElement | RatingElement;

export interface CardDesign { id: string; width: 420; height: 380; background: string; elements: DesignElement[]; version: number; }
export interface WorkspaceState { book: BookRecord; design: CardDesign; selectedElementId: string | null; cardSize: CardSize; dirty: boolean; }
export const CARD_WIDTHS: Record<CardSize, number> = { small: 300, medium: 420, large: 560 };
export const FIELD_LABELS: Record<BookFieldPath, string> = { title: 'Title', author: 'Author', series: 'Series', status: 'Reading status', progress: 'Progress', rating: 'Overall rating', spice: 'Spice', impact: 'Emotional impact', reaction: 'Reaction', coverUrl: 'Cover image' };
