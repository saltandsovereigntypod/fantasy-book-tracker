export type UploadKind = 'photo' | 'element';

export interface FontLibraryItem {
  id: string;
  name: string;
  family: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  createdAt: string;
}

export interface UploadLibraryItem {
  id: string;
  name: string;
  kind: UploadKind;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  createdAt: string;
}

type LibraryItem = FontLibraryItem | UploadLibraryItem;
type StoreName = 'fonts' | 'uploads';

const DATABASE_NAME = 'empyrean-v2-library';
const DATABASE_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('fonts')) database.createObjectStore('fonts', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('uploads')) database.createObjectStore('uploads', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open the asset library.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Library request failed.'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Library transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Library transaction was aborted.'));
  });
}

async function withStore<T>(storeName: StoreName, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, mode);
    const completion = transactionComplete(transaction);
    const result = await requestResult(action(transaction.objectStore(storeName)));
    await completion;
    return result;
  } finally {
    database.close();
  }
}

export async function listLibraryItems<T extends LibraryItem>(storeName: StoreName): Promise<T[]> {
  const items = await withStore<T[]>(storeName, 'readonly', (store) => store.getAll() as IDBRequest<T[]>);
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveLibraryItem<T extends LibraryItem>(storeName: StoreName, item: T): Promise<T> {
  await withStore<IDBValidKey>(storeName, 'readwrite', (store) => store.put(item));
  return item;
}

export async function removeLibraryItem(storeName: StoreName, id: string): Promise<void> {
  await withStore<undefined>(storeName, 'readwrite', (store) => store.delete(id) as IDBRequest<undefined>);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('File could not be read.'));
    reader.onerror = () => reject(reader.error ?? new Error('File could not be read.'));
    reader.readAsDataURL(file);
  });
}

export async function loadFontFace(item: FontLibraryItem): Promise<void> {
  const face = new FontFace(item.family, `url(${item.dataUrl})`);
  await face.load();
  document.fonts.add(face);
}
