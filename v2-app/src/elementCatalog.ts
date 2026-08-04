import type { DesignElement } from './domain';

export type ElementCategory = 'shapes' | 'dividers' | 'symbols' | 'emoji' | 'badges';

export interface ElementCatalogItem {
  id: string;
  name: string;
  category: ElementCategory;
  tags: string[];
  preview: string;
  create: () => DesignElement;
}

const id = () => `element-${crypto.randomUUID()}`;

function textSymbol(symbol: string, name: string, fontSize = 34